'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getApiUrl } from '@/lib/api-url';
import { getClientAuthToken } from '@/lib/client';
import type { CreateExport, ExportJobDto } from '@/server/exports/contracts';

async function request(projectId: string, suffix = '', init: RequestInit = {}) {
  const response = await fetch(getApiUrl(`/projects/${projectId}/exports${suffix}`), {
    ...init,
    headers: {
      authorization: `Bearer ${getClientAuthToken()}`,
      'content-type': 'application/json',
    },
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.error?.code ?? 'export-unavailable');
  }
  return response;
}

async function saveResponse(response: Response) {
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download =
    response.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1] ??
    'signal-studio-export';
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function useExports(projectId: string, enabled: boolean) {
  const client = useQueryClient();
  const key = ['studio-exports', projectId];
  const refresh = () => client.invalidateQueries({ queryKey: key });
  const jobs = useQuery({
    queryKey: key,
    enabled,
    queryFn: async ({ signal }) => {
      const response = await request(projectId, '', { signal });
      return (await response.json()).data as ExportJobDto[];
    },
    refetchInterval: enabled ? 3000 : false,
    refetchIntervalInBackground: false,
  });
  const create = useMutation({
    mutationFn: async (definition: CreateExport) => {
      const response = await request(projectId, '', {
        method: 'POST',
        body: JSON.stringify(definition),
      });
      if (response.status === 202) return (await response.json()).data as ExportJobDto;
      await saveResponse(response);
      return null;
    },
    onSuccess: refresh,
  });
  const download = useMutation({
    mutationFn: async (id: string) => saveResponse(await request(projectId, `/${id}`)),
  });
  const cancel = useMutation({
    mutationFn: async (id: string) => {
      await request(projectId, `/${id}`, { method: 'DELETE' });
    },
    onSuccess: refresh,
  });
  return { jobs, create, download, cancel };
}
