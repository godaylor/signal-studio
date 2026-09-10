'use client';
import { useQuery } from '@tanstack/react-query';
import { requestJson } from '@/features/explore/useAnalysisQuery';
import { getApiUrl } from '@/lib/api-url';
import type { HomeSnapshot } from '@/server/home/contracts';
export function useHome(projectId: string) {
  return useQuery({
    queryKey: ['studio-home', projectId],
    queryFn: ({ signal }) =>
      requestJson<HomeSnapshot>(getApiUrl(`/projects/${projectId}/home`), {
        method: 'GET',
        signal,
      }),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
}
