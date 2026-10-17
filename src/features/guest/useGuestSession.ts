'use client';

import { useQuery } from '@tanstack/react-query';
import { getApiUrl } from '@/lib/api-url';
import { getClientAuthHeaders } from '@/lib/client';
import type { AnalysisQueryV1 } from '@/server/analytics/contracts';

export interface GuestSessionDto {
  id: string;
  projectId: string;
  workspaceId: string;
  expiresAt: string;
  defaultQuery: AnalysisQueryV1;
  dataset: {
    synthetic: true;
    days: number;
    users: number;
    accounts: number;
    events: number;
    customEvents: number;
    startAt: string;
    endAt: string;
  };
  limits: Record<string, number>;
}

export function useGuestSession(enabled = true) {
  return useQuery({
    queryKey: ['guest-session'],
    queryFn: async ({ signal }) => {
      const response = await fetch(getApiUrl('/guest'), {
        signal,
        headers: getClientAuthHeaders(),
      });
      if (!response.ok) throw new Error('Guest session unavailable');
      return ((await response.json()) as { guest: GuestSessionDto | null }).guest;
    },
    enabled,
    retry: false,
    staleTime: 60_000,
  });
}
