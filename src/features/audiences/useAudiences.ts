'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getApiUrl } from '@/lib/api-url';
import { getClientAuthToken } from '@/lib/client';
import type { OperationalSegmentDefinition } from '@/server/audiences/contracts';

type IdentityPage<T> = { data: T[]; nextCursor: string | null; permissionScope: string };

export type IdentityRow = {
  id: string;
  externalId?: string;
  displayName?: string | null;
  name?: string | null;
  traits: Record<string, unknown>;
  lifecycleStage: string;
  definitionVersion: string;
  activatedAt: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  membership?: { account: { id: string; name?: string | null; externalId?: string } } | null;
  _count?: { memberships: number };
};

export type IdentityProfile = {
  id: string;
  label: string;
  externalId?: string;
  displayName?: string | null;
  name?: string | null;
  traits: Record<string, unknown>;
  sensitiveTraits?: Record<string, unknown>;
  lifecycle: {
    stage: string;
    activatedAt: string | null;
    firstSeenAt: string;
    lastSeenAt: string;
    storedDefinitionVersion: string;
    definition: { label: string; description: string; exactness: string; steps: string[] };
  };
  adoption: {
    sessions: number;
    events: number;
    definition: { label: string; description: string; exactness: string };
  };
  account?: { id: string; label: string; lifecycleStage: string; observedAt: string } | null;
  sessions?: SessionSummary[];
  members?: Array<{
    id: string;
    label: string;
    lifecycleStage: string;
    observedAt: string;
    sessions: SessionSummary[];
  }>;
  permissionScope: string;
};

export type SessionSummary = {
  id: string;
  browser: string | null;
  os: string | null;
  device: string | null;
  country: string | null;
  createdAt: string;
  eventCount: number;
};

export type OperationalSegment = {
  id: string;
  name: string;
  definition: OperationalSegmentDefinition;
  dependencies: { insights: Array<{ id: string; title: string }>; dashboards: number };
  updatedAt: string | null;
};

async function requestJson<T>(url: string, init: RequestInit = {}): Promise<T> {
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
    throw Object.assign(new Error(source.message ?? 'Audience request failed.'), {
      status: response.status,
      code: source.code,
      details: source.details,
    });
  }
  return payload as T;
}

export function useIdentityList(
  projectId: string,
  entity: 'accounts' | 'tracked-users',
  filters: { search?: string; sort: string; direction: string; lifecycle?: string },
) {
  return useInfiniteQuery({
    queryKey: ['studio-audiences', projectId, entity, filters],
    initialPageParam: '',
    queryFn: ({ pageParam, signal }) => {
      const params = new URLSearchParams({
        limit: '30',
        sort: filters.sort,
        direction: filters.direction,
      });
      if (filters.search) params.set('search', filters.search);
      if (filters.lifecycle) params.set('lifecycle', filters.lifecycle);
      if (pageParam) params.set('cursor', pageParam);
      return requestJson<IdentityPage<IdentityRow>>(
        `${getApiUrl(`/projects/${projectId}/${entity}`)}?${params}`,
        { signal },
      );
    },
    getNextPageParam: page => page.nextCursor ?? undefined,
    staleTime: 30_000,
  });
}

export function useIdentityProfile(projectId: string, entity: 'account' | 'user', id?: string) {
  const path = entity === 'account' ? 'accounts' : 'tracked-users';
  return useQuery({
    queryKey: ['studio-identity-profile', projectId, entity, id],
    queryFn: ({ signal }) =>
      requestJson<IdentityProfile>(getApiUrl(`/projects/${projectId}/${path}/${id}`), { signal }),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useOperationalSegments(projectId: string) {
  return useQuery({
    queryKey: ['studio-operational-segments', projectId],
    queryFn: ({ signal }) =>
      requestJson<{ data: OperationalSegment[] }>(getApiUrl(`/projects/${projectId}/segments`), {
        signal,
      }),
    staleTime: 30_000,
  });
}

export function usePreviewSegment(projectId: string) {
  return useMutation({
    mutationFn: (definition: OperationalSegmentDefinition) =>
      requestJson<{
        exactness: 'exact';
        evaluatedAt: string;
        entity: 'user' | 'account';
        count: number;
        sample: Array<{ id: string; label: string; lifecycleStage: string }>;
      }>(getApiUrl(`/projects/${projectId}/segments/preview`), {
        method: 'POST',
        body: JSON.stringify({ definition }),
      }),
  });
}

export function useSaveSegment(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; definition: OperationalSegmentDefinition }) =>
      requestJson<OperationalSegment>(getApiUrl(`/projects/${projectId}/segments`), {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['studio-operational-segments', projectId] }),
  });
}

export function useDeleteSegment(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (segmentId: string) =>
      requestJson<{ ok: true }>(getApiUrl(`/projects/${projectId}/segments/${segmentId}`), {
        method: 'DELETE',
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['studio-operational-segments', projectId] }),
  });
}
