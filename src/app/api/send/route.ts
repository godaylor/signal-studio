import { startOfHour } from 'date-fns';
import { isbot } from 'isbot';
import { z } from 'zod';
import clickhouse from '@/lib/clickhouse';
import { CACHE_TOKEN_TYPE, COLLECTION_TYPE, EVENT_TYPE } from '@/lib/constants';
import { getSalt, hash, secret, uuid } from '@/lib/crypto';
import { getClientInfo, hasBlockedIp } from '@/lib/detect';
import { createToken, parseToken } from '@/lib/jwt';
import { fetchWebsite } from '@/lib/load';
import { parseRequest } from '@/lib/request';
import { badRequest, forbidden, json, serverError } from '@/lib/response';
import { anyObjectParam, urlOrPathParam } from '@/lib/schema';
import { safeDecodeURI, safeDecodeURIComponent } from '@/lib/url';
import {
  createSession,
  saveEvent,
  saveSessionData,
  saveSessionLink,
  updateSession,
} from '@/queries/sql';
import { COLLECTION_TOKEN_AUDIENCE, getCollectionTokenTtlSeconds } from '@/server/auth/constants';
import {
  trackedAccountInputSchema,
  versionedIdentifyInputSchema,
} from '@/server/identities/contracts';
import { upsertTrackedIdentity } from '@/server/identities/upsert';
import { observeIngestion, safeFailure } from '@/server/operations/telemetry';
import { withLifecycleIngestion } from '@/server/lifecycle/ingestion';

interface Cache {
  websiteId: string;
  sessionId: string;
  visitId: string;
  iat: number;
  sessionLinkId?: string;
  context: string;
}

// Reject strings whose first character is a spreadsheet formula trigger to
// prevent CSV formula injection in analytics exports (defense-in-depth).
const FORMULA_TRIGGER_RE = /^[=+\-@\t\r]/;
const safeStringParam = () =>
  z.string().refine(val => !FORMULA_TRIGGER_RE.test(val), {
    message: 'Value must not start with =, +, -, @, tab, or carriage return',
  });

const schema = z
  .object({
    type: z.enum(['event', 'identify', 'performance']),
    payload: z
      .object({
        website: z.uuid().optional(),
        link: z.uuid().optional(),
        pixel: z.uuid().optional(),
        data: anyObjectParam.optional(),
        hostname: z.string().optional(),
        language: z.string().optional(),
        referrer: urlOrPathParam.optional(),
        screen: z.string().optional(),
        title: z.string().optional(),
        url: urlOrPathParam.optional(),
        name: safeStringParam().optional(),
        tag: safeStringParam().optional(),
        ip: z.string().optional(),
        userAgent: z.string().optional(),
        timestamp: z.coerce.number().int().optional(),
        id: z.string().optional(),
        identityVersion: z.literal(1).optional(),
        account: trackedAccountInputSchema.optional(),
        browser: z.string().optional(),
        os: z.string().optional(),
        device: z.string().optional(),
        lcp: z.number().nonnegative().max(60000).optional(),
        inp: z.number().nonnegative().max(60000).optional(),
        cls: z.number().nonnegative().max(100).optional(),
        fcp: z.number().nonnegative().max(60000).optional(),
        ttfb: z.number().nonnegative().max(60000).optional(),
      })
      .refine(
        data => {
          const keys = [data.website, data.link, data.pixel];
          const count = keys.filter(Boolean).length;
          return count === 1;
        },
        {
          message: 'Exactly one of website, link, or pixel must be provided',
          path: ['website'],
        },
      ),
  })
  .superRefine(({ type, payload }, ctx) => {
    if (payload.identityVersion === 1) {
      if (type !== 'identify' || !payload.website) {
        ctx.addIssue({
          code: 'custom',
          message: 'Versioned identity requires identify type and a website Project.',
          path: ['payload', 'identityVersion'],
        });
      }

      const result = versionedIdentifyInputSchema.safeParse({
        identityVersion: payload.identityVersion,
        id: payload.id,
        data: payload.data,
        account: payload.account,
      });
      for (const issue of result.success ? [] : result.error.issues) {
        ctx.addIssue({ code: 'custom', message: issue.message, path: ['payload', ...issue.path] });
      }
    } else if (payload.account) {
      ctx.addIssue({
        code: 'custom',
        message: 'Account identity requires identityVersion 1.',
        path: ['payload', 'account'],
      });
    }
  });

export async function POST(request: Request) {
  return observeIngestion('ingestion.send', request, handleSend);
}

async function handleSend(request: Request) {
  try {
    const { body, error } = await parseRequest(request, schema, { skipAuth: true });

    if (error) {
      return error();
    }

    const { type, payload } = body;

    const {
      website: websiteId,
      pixel: pixelId,
      link: linkId,
      hostname,
      screen,
      language,
      url,
      referrer,
      name,
      data,
      title,
      tag,
      timestamp,
      id,
      identityVersion,
      account,
      lcp,
      inp,
      cls,
      fcp,
      ttfb,
    } = payload;

    const sourceId = websiteId || pixelId || linkId;
    return await withLifecycleIngestion(websiteId, async () => {
      const { ip, userAgent, device, browser, os, country, region, city } = await getClientInfo(
        request,
        payload,
      );
      const collectionContext = hash('collection-context', sourceId, ip || '', userAgent || '');

      // Cache check
      let cache: Cache | null = null;

      if (websiteId) {
        const cacheHeader = request.headers.get('x-umami-cache');

        if (cacheHeader) {
          const result = await parseToken(cacheHeader, secret(), {
            audience: COLLECTION_TOKEN_AUDIENCE,
          });

          if (
            result?.type === CACHE_TOKEN_TYPE &&
            result.websiteId === websiteId &&
            result.context === collectionContext
          ) {
            cache = result;
          }
        }

        // Find website
        if (!cache?.websiteId) {
          const website = await fetchWebsite(websiteId);

          if (!website) {
            return badRequest({ message: 'Website not found.' });
          }
        }
      }

      // Carried forward in the cache token so repeat identify calls skip identity writes
      let sessionLinkId = cache?.sessionLinkId;

      // Bot check
      if (!process.env.DISABLE_BOT_CHECK && isbot(userAgent)) {
        return json({ beep: 'boop' });
      }

      // IP block
      if (hasBlockedIp(ip)) {
        return forbidden();
      }

      const createdAt = timestamp ? new Date(timestamp * 1000) : new Date();
      const now = Math.floor(Date.now() / 1000);

      const saltRotation = process.env.SALT_ROTATION || 'month';
      const sessionSalt = getSalt(saltRotation, createdAt);
      const visitSalt = hash(startOfHour(createdAt).toUTCString());

      const sessionId = uuid(sourceId, ip, userAgent, sessionSalt);
      const sessionDrift = !!websiteId && !!cache?.sessionId && cache.sessionId !== sessionId;
      const shouldEnsureSession = !clickhouse.enabled && sessionDrift;

      // Create a session if not found
      if ((!clickhouse.enabled && !cache?.sessionId) || shouldEnsureSession) {
        await createSession({
          id: sessionId,
          websiteId: sourceId,
          browser,
          os,
          device,
          screen,
          language,
          country,
          region,
          city,
          distinctId: id,
          createdAt,
        });
      }

      // Visit info
      let visitId = cache?.visitId || uuid(sessionId, visitSalt);
      let iat = cache?.iat || now;

      // A drifted cache session should start a fresh visit on the recomputed session.
      if (sessionDrift) {
        visitId = uuid(sessionId, visitSalt);
        iat = now;
      }

      // Expire visit after 30 minutes
      if (!timestamp && now - iat > 1800) {
        visitId = uuid(sessionId, visitSalt);
        iat = now;
      }

      if (type === COLLECTION_TYPE.event) {
        const base = hostname ? `https://${hostname}` : 'https://localhost';
        const currentUrl = new URL(url, base);

        let urlPath =
          currentUrl.pathname === '/undefined' ? '' : currentUrl.pathname + currentUrl.hash;
        const urlQuery = currentUrl.search.substring(1);
        const urlDomain = currentUrl.hostname.replace(/^www\./, '');

        let referrerPath: string;
        let referrerQuery: string;
        let referrerDomain: string;

        // UTM Params
        const utmSource = currentUrl.searchParams.get('utm_source');
        const utmMedium = currentUrl.searchParams.get('utm_medium');
        const utmCampaign = currentUrl.searchParams.get('utm_campaign');
        const utmContent = currentUrl.searchParams.get('utm_content');
        const utmTerm = currentUrl.searchParams.get('utm_term');

        // Click IDs
        const gclid = currentUrl.searchParams.get('gclid');
        const fbclid = currentUrl.searchParams.get('fbclid');
        const msclkid = currentUrl.searchParams.get('msclkid');
        const ttclid = currentUrl.searchParams.get('ttclid');
        const lifatid = currentUrl.searchParams.get('li_fat_id');
        const twclid = currentUrl.searchParams.get('twclid');

        if (process.env.REMOVE_TRAILING_SLASH) {
          // Never strip the root slash, otherwise the home page is saved with an empty path
          urlPath = urlPath.replace(/(?!^)\/(?=(#.*)?$)/, '');
        }

        if (referrer) {
          // Canonicalize the event domain (lowercase, punycode, no port) so it
          // compares correctly against the parsed referrer hostname
          let eventDomain = urlDomain;
          if (hostname) {
            try {
              eventDomain = new URL(`https://${hostname}`).hostname.replace(/^www\./, '');
            } catch {
              eventDomain = hostname.replace(/^www\./, '');
            }
          }
          // Resolve path-only referrers against the event's domain, not the localhost fallback
          const referrerUrl = new URL(referrer, eventDomain ? `https://${eventDomain}` : base);

          referrerPath = referrerUrl.pathname;
          referrerQuery = referrerUrl.search.substring(1);
          referrerDomain = referrerUrl.hostname.replace(/^www\./, '');

          // Never save the referrer domain for self-referrals
          if (referrerDomain === eventDomain) {
            referrerDomain = undefined;
          }
        }

        const eventType = linkId
          ? EVENT_TYPE.linkEvent
          : pixelId
            ? EVENT_TYPE.pixelEvent
            : name
              ? EVENT_TYPE.customEvent
              : EVENT_TYPE.pageView;

        await saveEvent({
          websiteId: sourceId,
          sessionId,
          visitId,
          eventType,
          createdAt,

          // Page
          pageTitle: safeDecodeURIComponent(title),
          hostname: hostname || urlDomain,
          urlPath: safeDecodeURI(urlPath),
          urlQuery,
          referrerPath: safeDecodeURI(referrerPath),
          referrerQuery,
          referrerDomain,

          // Session
          distinctId: id,
          browser,
          os,
          device,
          screen,
          language,
          country,
          region,
          city,

          // Events
          eventName: name,
          eventData: data,
          tag,

          // UTM
          utmSource,
          utmMedium,
          utmCampaign,
          utmContent,
          utmTerm,

          // Click IDs
          gclid,
          fbclid,
          msclkid,
          ttclid,
          lifatid,
          twclid,
        });
      } else if (type === COLLECTION_TYPE.identify) {
        if (websiteId && id) {
          const newLinkId = hash(sessionId, id);

          if (sessionLinkId !== newLinkId) {
            // Best-effort: identity link failures must not block the session data write below.
            try {
              await Promise.all([
                saveSessionLink({
                  websiteId,
                  sessionId,
                  distinctId: id,
                  createdAt,
                }),
                updateSession({
                  websiteId,
                  sessionId,
                  distinctId: id,
                }),
              ]);
              sessionLinkId = newLinkId;
            } catch (e) {
              // eslint-disable-next-line no-console
              safeFailure('identity-projection-failed');
            }
          }
        }

        if (websiteId && id) {
          try {
            const versionedIdentity =
              identityVersion === 1
                ? versionedIdentifyInputSchema.parse({ identityVersion, id, data, account })
                : null;
            const projected = await upsertTrackedIdentity({
              projectId: websiteId,
              externalId: versionedIdentity?.id ?? id,
              traits: versionedIdentity?.data ?? data,
              account: versionedIdentity?.account ?? account,
              observedAt: createdAt,
            });

            if (identityVersion === 1 && !projected) {
              return badRequest({
                code: 'identity-project-not-found',
                message: 'Project not found for identity projection.',
              });
            }
          } catch (error) {
            if (identityVersion === 1) {
              throw error;
            }
            console.error('Tracked identity projection failed for legacy identify.');
          }
        }

        if (data) {
          await saveSessionData({
            websiteId,
            sessionId,
            sessionData: data,
            distinctId: id,
            createdAt,
          });
        }
      } else if (type === COLLECTION_TYPE.performance) {
        const base = hostname ? `https://${hostname}` : 'https://localhost';
        const currentUrl = new URL(url, base);
        const urlPath = currentUrl.pathname === '/undefined' ? '' : currentUrl.pathname;

        await saveEvent({
          websiteId: sourceId,
          sessionId,
          visitId,
          urlPath,
          pageTitle: safeDecodeURIComponent(title),
          eventType: EVENT_TYPE.performance,
          browser,
          os,
          device,
          screen,
          language,
          country,
          region,
          city,
          lcp,
          inp,
          cls,
          fcp,
          ttfb,
          createdAt,
        });
      }

      const token = createToken(
        {
          websiteId,
          sessionId,
          visitId,
          iat,
          sessionLinkId,
          context: collectionContext,
          type: CACHE_TOKEN_TYPE,
        },
        secret(),
        {
          audience: COLLECTION_TOKEN_AUDIENCE,
          expiresIn: getCollectionTokenTtlSeconds(),
        },
      );

      return json({ cache: token, sessionId, visitId });
    });
  } catch (e) {
    return serverError(e);
  }
}
