'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { requestJson } from '@/features/explore/useAnalysisQuery';
import { getApiUrl } from '@/lib/api-url';
import type { LifecycleRequest } from '@/server/lifecycle/contracts';

export interface LifecycleStatus {
  id: string;
  status: string;
  deletedRows: number;
  errorCode: string | null;
  definition: LifecycleRequest;
  createdAt: string;
  completedAt: string | null;
}
export function useLifecycle(projectId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['studio-lifecycle', projectId],
    enabled,
    queryFn: ({ signal }) =>
      requestJson<{ data: LifecycleStatus[] }>(getApiUrl(`/projects/${projectId}/lifecycle`), {
        method: 'GET',
        signal,
      }),
    refetchInterval: enabled ? 5000 : false,
    refetchIntervalInBackground: false,
  });
}
export function useCreateLifecycle(projectId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (definition: LifecycleRequest) =>
      requestJson<{ data: LifecycleStatus }>(getApiUrl(`/projects/${projectId}/lifecycle`), {
        method: 'POST',
        body: JSON.stringify(definition),
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['studio-lifecycle', projectId] }),
  });
}
