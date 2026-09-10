import prisma from '@/lib/prisma';
import { restoreReplayEventFragments } from '@/lib/replay';
import { getReplayChunks } from '@/queries/sql';
import { canViewSensitiveTraits, type ProjectDataScope } from '@/server/permissions/project-data';
import type { SessionEvidenceQuery } from './contracts';

export class SessionEvidenceNotFoundError extends Error {}
export class ReplayEvidenceForbiddenError extends Error {}
export class InvalidEvidenceCursorError extends Error {}

type EvidenceCursor = { version: 1; createdAt: string; id: string };

export function deriveExperienceCapabilities(
  scope: ProjectDataScope,
  explicit?: { viewSensitiveTraits: boolean; viewReplay: boolean },
) {
  return {
    canViewEvidence: scope !== 'deny',
    canViewSensitiveTraits: explicit?.viewSensitiveTraits ?? scope === 'identity-sensitive',
    canViewReplay: explicit?.viewReplay ?? scope === 'identity-sensitive',
  };
}

function decodeCursor(value?: string): EvidenceCursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString()) as EvidenceCursor;
    if (
      parsed.version !== 1 ||
      !parsed.id ||
      !parsed.createdAt ||
      Number.isNaN(new Date(parsed.createdAt).getTime())
    )
      throw new Error();
    return parsed;
  } catch {
    throw new InvalidEvidenceCursorError('Evidence cursor is invalid or expired.');
  }
}

function encodeCursor(value: EvidenceCursor) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function recorderState(config: unknown) {
  if (!config || typeof config !== 'object' || Array.isArray(config))
    return { replayEnabled: false, maskLevel: 'moderate' };
  const value = config as Record<string, unknown>;
  return {
    replayEnabled: value.replayEnabled === true,
    maskLevel: value.maskLevel === 'strict' ? 'strict' : 'moderate',
  };
}

function propertyValue(value: {
  stringValue: string | null;
  numberValue: unknown;
  dateValue: Date | null;
}) {
  if (value.stringValue !== null) return value.stringValue;
  if (value.numberValue !== null) return String(value.numberValue);
  return value.dateValue?.toISOString() ?? null;
}

function metricAverage(values: Array<number | null>) {
  const present = values.filter((value): value is number => value !== null);
  if (!present.length) return null;
  return Math.round((present.reduce((sum, value) => sum + value, 0) / present.length) * 100) / 100;
}

export async function getSessionEvidence({
  projectId,
  scope,
  capabilities: explicitCapabilities,
  query,
}: {
  projectId: string;
  scope: ProjectDataScope;
  capabilities?: { viewSensitiveTraits: boolean; viewReplay: boolean };
  query: SessionEvidenceQuery;
}) {
  const capabilities = deriveExperienceCapabilities(scope, explicitCapabilities);
  const sensitive = explicitCapabilities
    ? explicitCapabilities.viewSensitiveTraits
    : canViewSensitiveTraits(scope);
  const cursor = decodeCursor(query.cursor);
  const session = await prisma.client.session.findFirst({
    where: { id: query.sessionId, websiteId: projectId },
    select: {
      id: true,
      distinctId: true,
      browser: true,
      os: true,
      device: true,
      country: true,
      createdAt: true,
      websiteEvents: {
        where: {
          ...(query.startAt || query.endAt
            ? {
                createdAt: {
                  ...(query.startAt ? { gte: new Date(query.startAt) } : {}),
                  ...(query.endAt ? { lt: new Date(query.endAt) } : {}),
                },
              }
            : {}),
          ...(query.urlPath ? { urlPath: query.urlPath } : {}),
          ...(cursor
            ? {
                OR: [
                  { createdAt: { gt: new Date(cursor.createdAt) } },
                  { createdAt: new Date(cursor.createdAt), id: { gt: cursor.id } },
                ],
              }
            : {}),
        },
        select: {
          id: true,
          createdAt: true,
          eventName: true,
          eventType: true,
          urlPath: true,
          pageTitle: true,
          lcp: true,
          inp: true,
          cls: true,
          fcp: true,
          ttfb: true,
          ...(sensitive
            ? {
                eventData: {
                  select: {
                    dataKey: true,
                    stringValue: true,
                    numberValue: true,
                    dateValue: true,
                  },
                  take: 20,
                },
              }
            : {}),
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: query.limit + 1,
      },
    },
  });
  if (!session) throw new SessionEvidenceNotFoundError('Session evidence was not found.');

  const events = session.websiteEvents.slice(0, query.limit);
  const hasMore = session.websiteEvents.length > query.limit;
  const last = events.at(-1);
  const identity = session.distinctId
    ? await prisma.client.trackedUser.findFirst({
        where: { projectId, externalId: session.distinctId },
        select: {
          id: true,
          externalId: true,
          displayName: true,
          traits: true,
          ...(sensitive ? { sensitiveTraits: true } : {}),
          membership: {
            select: { account: { select: { id: true, externalId: true, name: true } } },
          },
        },
      })
    : null;
  const replayConfig = await prisma.client.website.findFirst({
    where: { id: projectId },
    select: { replayConfig: true },
  });
  const recorder = recorderState(replayConfig?.replayConfig);
  const replay = capabilities.canViewReplay
    ? await prisma.client.sessionReplay.findFirst({
        where: { websiteId: projectId, sessionId: session.id },
        select: { visitId: true, startedAt: true, endedAt: true, eventCount: true },
        orderBy: [{ chunkIndex: 'asc' }],
      })
    : null;
  const eventDtos = events.map(event => ({
    id: event.id,
    createdAt: event.createdAt?.toISOString() ?? null,
    label: event.eventName ?? (event.eventType === 1 ? 'Page view' : 'Observed event'),
    urlPath: event.urlPath,
    pageTitle: sensitive ? event.pageTitle : null,
    properties:
      sensitive && 'eventData' in event
        ? event.eventData.map(item => ({ key: item.dataKey, value: propertyValue(item) }))
        : [],
    performance: {
      lcp: event.lcp === null ? null : Number(event.lcp),
      inp: event.inp === null ? null : Number(event.inp),
      cls: event.cls === null ? null : Number(event.cls),
      fcp: event.fcp === null ? null : Number(event.fcp),
      ttfb: event.ttfb === null ? null : Number(event.ttfb),
    },
  }));
  return {
    session: {
      id: session.id,
      createdAt: session.createdAt?.toISOString() ?? null,
      browser: session.browser,
      os: session.os,
      device: session.device,
      country: session.country,
    },
    identity: identity
      ? {
          id: identity.id,
          label: sensitive
            ? (identity.displayName ?? identity.externalId)
            : `Tracked user ${identity.id.slice(0, 8)}`,
          traits: identity.traits,
          ...(sensitive
            ? {
                externalId: identity.externalId,
                sensitiveTraits: 'sensitiveTraits' in identity ? identity.sensitiveTraits : {},
              }
            : {}),
          account: identity.membership
            ? {
                id: identity.membership.account.id,
                label: sensitive
                  ? (identity.membership.account.name ?? identity.membership.account.externalId)
                  : `Account ${identity.membership.account.id.slice(0, 8)}`,
              }
            : null,
        }
      : null,
    timeline: {
      data: eventDtos,
      nextCursor:
        hasMore && last?.createdAt
          ? encodeCursor({ version: 1, createdAt: last.createdAt.toISOString(), id: last.id })
          : null,
      limit: query.limit,
      masked: !sensitive,
    },
    performance: {
      definition: 'Average observed Web Vitals across the events in this bounded timeline page.',
      lcp: metricAverage(eventDtos.map(event => event.performance.lcp)),
      inp: metricAverage(eventDtos.map(event => event.performance.inp)),
      cls: metricAverage(eventDtos.map(event => event.performance.cls)),
    },
    replay: !capabilities.canViewReplay
      ? { state: 'permission-denied' as const, maskLevel: recorder.maskLevel }
      : !recorder.replayEnabled
        ? { state: 'recording-disabled' as const, maskLevel: recorder.maskLevel }
        : !replay
          ? { state: 'unavailable' as const, maskLevel: recorder.maskLevel }
          : {
              state: 'available' as const,
              replayId: replay.visitId,
              startedAt: replay.startedAt.toISOString(),
              endedAt: replay.endedAt.toISOString(),
              eventCount: replay.eventCount,
              maskLevel: recorder.maskLevel,
            },
    capabilities,
    compatibleContext: {
      startAt: query.startAt ?? null,
      endAt: query.endAt ?? null,
      urlPath: query.urlPath ?? null,
    },
  };
}

export async function getEvidenceReplay(
  projectId: string,
  visitId: string,
  scope: ProjectDataScope,
  canViewReplay?: boolean,
) {
  if (!(canViewReplay ?? deriveExperienceCapabilities(scope).canViewReplay))
    throw new ReplayEvidenceForbiddenError('Replay requires the replay capability.');
  const chunks = await getReplayChunks(projectId, visitId, { endChunkIndex: 49 });
  if (!chunks.length) throw new SessionEvidenceNotFoundError('Replay evidence was not found.');
  const events = restoreReplayEventFragments(chunks.flatMap(chunk => chunk.events)).slice(
    0,
    50_000,
  );
  return {
    events,
    eventCount: events.length,
    chunkCount: chunks.length,
    bounded: chunks.length === 50 || events.length === 50_000,
  };
}
