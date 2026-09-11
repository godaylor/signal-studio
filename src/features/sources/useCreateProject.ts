'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { requestJson } from '@/features/explore/useAnalysisQuery';
import { getApiUrl } from '@/lib/api-url';

export function useCreateProject() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; domain: string }) =>
      requestJson<{ id: string; name: string; domain: string }>(getApiUrl('/websites'), {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['websites'] }),
  });
}
