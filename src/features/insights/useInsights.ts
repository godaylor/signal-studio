'use client';

import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { getApiUrl } from '@/lib/api-url';
import { getClientAuthToken } from '@/lib/client';
import type { AnalysisQueryV1 } from '@/server/analytics/contracts';
import type { InsightDto, InsightStatus } from '@/server/insights/insight-service';

type InsightPage = { data: InsightDto[]; nextCursor: string | null };
type InsightFilters = {
  search?: string;
  owner?: 'all' | 'mine';
  status?: InsightStatus;
  favorite?: boolean;
};
type ApiError = Error & { status?: number; code?: string };

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
    throw Object.assign(new Error(source.message ?? 'Insight request failed.'), {
      status: response.status,
      code: source.code,
    }) as ApiError;
  }
  return payload as T;
}

export function useInsights(projectId: string, filters: InsightFilters) {
  return useInfiniteQuery({
    queryKey: ['studio-insights', projectId, filters],
    initialPageParam: '',
    queryFn: ({ pageParam, signal }) => {
      const params = new URLSearchParams({
        owner: filters.owner ?? 'all',
        status: filters.status ?? 'active',
        limit: '20',
      });
      if (filters.search) params.set('search', filters.search);
      if (filters.favorite !== undefined) params.set('favorite', String(filters.favorite));
      if (pageParam) params.set('cursor', pageParam);
      return requestJson<InsightPage>(`${getApiUrl(`/projects/${projectId}/insights`)}?${params}`, {
        signal,
      });
    },
    getNextPageParam: page => page.nextCursor ?? undefined,
    staleTime: 30_000,
  });
}

export function useCreateInsight(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      title: string;
      description?: string;
      query: AnalysisQueryV1;
      visualization?: Record<string, unknown>;
    }) =>
      requestJson<InsightDto>(getApiUrl(`/projects/${projectId}/insights`), {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['studio-insights', projectId] }),
  });
}

export function useUpdateInsight(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<InsightDto> }) =>
      requestJson<InsightDto>(getApiUrl(`/projects/${projectId}/insights/${id}`), {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    onMutate: async ({ id, patch }) => {
      const key = ['studio-insights', projectId];
      await queryClient.cancelQueries({ queryKey: key });
      const snapshots = queryClient.getQueriesData<InfiniteData<InsightPage>>({ queryKey: key });
      queryClient.setQueriesData<InfiniteData<InsightPage>>({ queryKey: key }, current =>
        current
          ? {
              ...current,
              pages: current.pages.map(page => ({
                ...page,
                data: page.data
                  .map(insight => (insight.id === id ? { ...insight, ...patch } : insight))
                  .filter(insight => insight.status !== 'archived'),
              })),
            }
          : current,
      );
      return { snapshots };
    },
    onError: (_error, _variables, context) => {
      for (const [key, value] of context?.snapshots ?? []) queryClient.setQueryData(key, value);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['studio-insights', projectId] }),
  });
}

export function useDuplicateInsight(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      requestJson<InsightDto>(getApiUrl(`/projects/${projectId}/insights/${id}/duplicate`), {
        method: 'POST',
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['studio-insights', projectId] }),
  });
}
