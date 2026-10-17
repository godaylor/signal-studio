import { startOfMonth, subMonths } from 'date-fns';
import { z } from 'zod';
import { checkAuth, getBearerToken } from '@/lib/auth';
import { DEFAULT_PAGE_SIZE, FILTER_COLUMNS, OPERATORS } from '@/lib/constants';
import {
  DATE_BOUNDARY_OFFSET_MESSAGE,
  getAllowedUnits,
  getMinimumUnit,
  hasExplicitTimezoneOffset,
  maxDate,
  parseDateRange,
} from '@/lib/date';
import { fetchAccount, fetchWebsite } from '@/lib/load';
import {
  filtersArrayToObject,
  parseSessionPropertyFilters,
  parseUniversalEventPropertyFilters,
} from '@/lib/params';
import { badRequest, forbidden, unauthorized } from '@/lib/response';
import type { QueryFilters } from '@/lib/types';
import { getWebsiteSegment } from '@/queries/prisma';
import { enforceGuestRequest } from '@/server/guest/guard';
import { GuestError, guestErrorResponse } from '@/server/guest/contracts';
import { guestCookieToken } from '@/server/guest/session';

export async function parseRequest(
  request: Request,
  schema?: any,
  options?: { skipAuth: boolean },
): Promise<any> {
  const url = new URL(request.url);
  let query = Object.fromEntries(url.searchParams);
  let body: any;
  try {
    body = await getJsonBody(request, !options?.skipAuth);
  } catch (bodyError) {
    return { url, query, body: undefined, auth: null,
      error: () => guestErrorResponse(bodyError, crypto.randomUUID()) };
  }
  let error: () => undefined | undefined | Response;
  let auth = null;

  if (schema) {
    const isGet = request.method === 'GET';
    const rawQuery = query;
    const result = schema.safeParse(isGet ? query : body);

    if (!result.success) {
      error = () => badRequest(z.treeifyError(result.error));
    } else if (isGet) {
      query = result.data;

      // Re-add dynamic params stripped by Zod schema: suffixed filter params (browser1, os2)
      for (const key of Object.keys(rawQuery)) {
        if (
          (/\d+$/.test(key) || /^pf_/.test(key) || /^epf\d+$/.test(key) || /^spf\d+$/.test(key)) &&
          !(key in query)
        ) {
          query[key] = rawQuery[key];
        }
      }
    } else {
      body = result.data;
    }
  }

  if (!options?.skipAuth && !error) {
    auth = await checkAuth(request);

    if (!auth) {
      error = () => unauthorized();
    } else if (auth.assuranceRequired && !isAssuranceRoute(url.pathname)) {
      error = () =>
        forbidden({
          code: 'two-factor-assurance-required',
          message: 'Two-factor authentication is required before this action.',
        });
    } else if (auth.guest) {
      const response = await enforceGuestRequest(request, auth);
      if (response) error = () => response;
    }
  }

  return { url, query, body, auth, error };
}

function isAssuranceRoute(pathname: string) {
  return [
    '/api/auth/verify',
    '/api/auth/logout',
    '/api/2fa/status',
    '/api/2fa/setup/initiate',
    '/api/2fa/setup/confirm',
  ].some(path => pathname.endsWith(path));
}

export async function getJsonBody(request: Request, limitGuestBody = true) {
  try {
    if (limitGuestBody && !getBearerToken(request) && guestCookieToken(request)) {
      const reader = request.clone().body?.getReader();
      if (!reader) return undefined;
      const chunks: Uint8Array[] = [];
      let bytes = 0;
      try {
        while (true) {
          const item = await reader.read();
          if (item.done) break;
          bytes += item.value.byteLength;
          if (bytes > 65_536) {
            void reader.cancel();
            throw new GuestError('guest-request-too-large', 413);
          }
          chunks.push(item.value);
        }
      } finally { reader.releaseLock(); }
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    }
    return await request.clone().json();
  } catch (error) {
    if (error instanceof GuestError) throw error;
    return undefined;
  }
}

type RequestDateRangeInput = {
  startAt?: string | number;
  endAt?: string | number;
  startDate?: string | Date;
  endDate?: string | Date;
  timezone?: string;
  unit?: string;
};

function parseRequestDateBoundary(value: string | Date) {
  if (typeof value === 'string' && !hasExplicitTimezoneOffset(value)) {
    throw new TypeError(DATE_BOUNDARY_OFFSET_MESSAGE);
  }

  return value instanceof Date ? new Date(value.getTime()) : new Date(value);
}

export function getRequestDateRange(query: RequestDateRangeInput) {
  const { startAt, endAt, unit, timezone = 'UTC' } = query;
  const hasTimestamps = startAt != null && endAt != null;
  const hasDates = query.startDate != null && query.endDate != null;

  if (!hasTimestamps && !hasDates) {
    if (startAt != null || endAt != null || query.startDate != null || query.endDate != null) {
      throw new TypeError('Date range requires both start and end boundaries');
    }

    return { startDate: undefined, endDate: undefined, timezone, unit };
  }

  // timezone controls query bucketing only. It never reinterprets offsetless wall-clock strings.
  const startDate = hasTimestamps
    ? new Date(Number(startAt))
    : parseRequestDateBoundary(query.startDate);
  const endDate = hasTimestamps ? new Date(Number(endAt)) : parseRequestDateBoundary(query.endDate);

  if (
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(endDate.getTime()) ||
    startDate.getTime() >= endDate.getTime()
  ) {
    throw new TypeError('Date range must have valid boundaries with start before end');
  }

  return {
    startDate,
    endDate,
    timezone,
    unit: getAllowedUnits(startDate, endDate).includes(unit)
      ? unit
      : getMinimumUnit(startDate, endDate),
  };
}

export function getRequestFilters(query: Record<string, any>) {
  const result: Record<string, any> = {};

  for (const key of Object.keys(query)) {
    const baseName = key.replace(/\d+$/, '');
    if (baseName in FILTER_COLUMNS) {
      result[key] = query[key];
    }
  }

  return result;
}

export async function setWebsiteDate(websiteId: string, data: Record<string, any>) {
  const website = await fetchWebsite(websiteId);
  const cloudMode = !!process.env.CLOUD_MODE;

  if (cloudMode && website && !website.teamId) {
    const account = await fetchAccount(website.userId);

    if (!account?.hasSubscription) {
      data.startDate = maxDate(data.startDate, startOfMonth(subMonths(new Date(), 6)));
    }
  }

  if (website?.resetAt) {
    data.startDate = maxDate(data.startDate, new Date(website?.resetAt));
  }

  return data;
}

export async function getQueryFilters(
  params: Record<string, any>,
  websiteId?: string,
): Promise<QueryFilters> {
  const dateRange = getRequestDateRange(params);
  const filters = getRequestFilters(params);
  const eventPropertyFilters = parseUniversalEventPropertyFilters(params);
  const sessionPropertyFilters = parseSessionPropertyFilters(params);

  let match = params?.match;

  if (websiteId) {
    await setWebsiteDate(websiteId, dateRange);

    if (params.segment) {
      const segmentParams = (await getWebsiteSegment(websiteId, params.segment))
        ?.parameters as Record<string, any>;

      Object.assign(filters, filtersArrayToObject(segmentParams.filters));

      if (segmentParams.match) {
        match = segmentParams.match;
      }
    }

    if (params.cohort) {
      const cohortParams = (await getWebsiteSegment(websiteId, params.cohort))
        ?.parameters as Record<string, any>;

      const { startDate, endDate } = parseDateRange(cohortParams.dateRange);

      const cohortFilters = cohortParams.filters.map(({ name, ...props }) => ({
        ...props,
        name: `cohort_${name}`,
      }));

      cohortFilters.push({
        name: `cohort_${cohortParams.action.type}`,
        operator: OPERATORS.equals,
        value: cohortParams.action.value,
      });

      Object.assign(filters, {
        ...filtersArrayToObject(cohortFilters),
        cohort_startDate: startDate,
        cohort_endDate: endDate,
        ...(cohortParams.match && {
          cohort_match: cohortParams.match,
          cohort_actionName: `cohort_${cohortParams.action.type}`,
        }),
      });
    }

    if (params.excludeBounce) {
      Object.assign(filters, { excludeBounce: true });
    }
  }

  return {
    ...dateRange,
    ...filters,
    match,
    minDuration: params?.minDuration,
    eventPropertyFilters,
    sessionPropertyFilters,
    page: params?.page,
    pageSize: params?.pageSize ? params?.pageSize || DEFAULT_PAGE_SIZE : undefined,
    orderBy: params?.orderBy,
    sortDescending: params?.sortDescending,
    search: params?.search,
    compare: params?.compare,
    maxResults: params?.maxResults,
  };
}
