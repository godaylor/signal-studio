'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getApiUrl } from '@/lib/api-url';
import { getClientAuthToken } from '@/lib/client';
import type { AnalysisQueryV1, AnalysisResult } from '@/server/analytics/contracts';
import { serializeAnalysisQuery } from '@/server/analytics/url-codec';
import type { DisplayRow } from './model';
import { sessionFilterParams } from './model';

type ApiError = Error & { code?: string; status?: number; details?: unknown };

export async function requestJson<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      authorization: `Bearer ${getClientAuthToken()}`,
      'content-type': 'application/json',
      ...init.headers,
    },
  });
  const payload = await response.json();

  if (!response.ok) {
    const source = payload?.error ?? {};
    throw Object.assign(new Error(source.message ?? 'The request failed.'), {
      code: source.code,
      status: response.status,
      details: source.details,
    }) as ApiError;
  }

  return payload as T;
}

export type AdvancedMemberSelection =
  | { kind: 'funnel-step'; step: number; outcome: 'reached' | 'dropped' }
  | { kind: 'retention-cell'; cohortStart: string; period: number };

export type AdvancedMemberResult = {
  total: number;
  limit: number;
  members: Array<{
    actorId: string;
    trackedUser: { id: string; externalId: string; displayName: string | null } | null;
    account: { id: string; externalId: string; name: string | null } | null;
    sessionIds: string[];
  }>;
};

export function useAdvancedMembers(query: AnalysisQueryV1, selection?: AdvancedMemberSelection) {
  return useQuery({
    queryKey: ['studio-analysis-members', serializeAnalysisQuery(query), selection],
    queryFn: ({ signal }) =>
      requestJson<AdvancedMemberResult>(
        getApiUrl(`/projects/${query.projectId}/analytics/drilldown`),
        {
          method: 'POST',
          body: JSON.stringify({ query, selection }),
          signal,
        },
      ),
    enabled: !!selection,
    staleTime: 30_000,
  });
}

export type BehavioralCohort = {
  id: string;
  name: string;
  definition: {
    version: 1;
    entry: NonNullable<AnalysisQueryV1['retention']>['entry'];
    returning: NonNullable<AnalysisQueryV1['retention']>['returning'];
    granularity: NonNullable<AnalysisQueryV1['retention']>['granularity'];
    periods: number;
    filters: AnalysisQueryV1['filters'];
    match: AnalysisQueryV1['match'];
  };
};

export function useCohorts(projectId: string, enabled = true) {
  return useQuery({
    queryKey: ['studio-cohorts', projectId],
    queryFn: () =>
      requestJson<{ data: BehavioralCohort[] }>(getApiUrl(`/projects/${projectId}/cohorts`), {
        method: 'GET',
      }),
    enabled,
    staleTime: 30_000,
  });
}

export function useSaveCohort(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; definition: BehavioralCohort['definition'] }) =>
      requestJson<BehavioralCohort>(getApiUrl(`/projects/${projectId}/cohorts`), {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['studio-cohorts', projectId] }),
  });
}

export function useAnalysisResult(query?: AnalysisQueryV1) {
  const serialized = query ? serializeAnalysisQuery(query) : '';

  return useQuery({
    queryKey: ['studio-analysis', serialized],
    queryFn: ({ signal }) =>
      requestJson<AnalysisResult>(getApiUrl(`/projects/${query?.projectId}/analytics/query`), {
        method: 'POST',
        body: JSON.stringify(query),
        signal,
      }),
    enabled: !!query,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

export type AffectedSession = {
  id: string;
  browser?: string | null;
  device?: string | null;
  country?: string | null;
  events: number;
  views: number;
  createdAt: string;
};

export function useAffectedSessions(
  query: AnalysisQueryV1,
  selected?: DisplayRow,
  enabled = false,
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sessionFilterParams(query, selected))) {
    params.set(key, String(value));
  }

  return useQuery({
    queryKey: ['studio-analysis-sessions', query.projectId, params.toString()],
    queryFn: ({ signal }) =>
      requestJson<{ data: AffectedSession[]; count: number }>(
        `${getApiUrl(`/websites/${query.projectId}/sessions`)}?${params}`,
        { method: 'GET', signal },
      ),
    enabled,
    staleTime: 30_000,
  });
}
