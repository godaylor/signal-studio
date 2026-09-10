'use client';

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { getApiUrl } from '@/lib/api-url';
import { getClientAuthToken } from '@/lib/client';

export type EvidenceEvent = {
  id: string;
  createdAt: string | null;
  label: string;
  urlPath: string;
  pageTitle: string | null;
  properties: Array<{ key: string; value: string | null }>;
  performance: { lcp: number | null; inp: number | null; cls: number | null };
};

export type SessionEvidence = {
  session: {
    id: string;
    createdAt: string | null;
    browser: string | null;
    os: string | null;
    device: string | null;
    country: string | null;
  };
  identity: {
    id: string;
    label: string;
    externalId?: string;
    traits: Record<string, unknown>;
    sensitiveTraits?: Record<string, unknown>;
    account: { id: string; label: string } | null;
  } | null;
  timeline: { data: EvidenceEvent[]; nextCursor: string | null; limit: number; masked: boolean };
  performance: { definition: string; lcp: number | null; inp: number | null; cls: number | null };
  replay:
    | { state: 'permission-denied' | 'recording-disabled' | 'unavailable'; maskLevel: string }
    | {
        state: 'available';
        replayId: string;
        startedAt: string;
        endedAt: string;
        eventCount: number;
        maskLevel: string;
      };
  capabilities: {
    canViewEvidence: boolean;
    canViewSensitiveTraits: boolean;
    canViewReplay: boolean;
  };
  compatibleContext: { startAt: string | null; endAt: string | null; urlPath: string | null };
};

async function requestJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    signal,
    headers: { authorization: `Bearer ${getClientAuthToken()}` },
  });
  const payload = await response.json();
  if (!response.ok) {
    const source = payload?.error ?? {};
    throw Object.assign(new Error(source.message ?? 'Evidence request failed.'), {
      code: source.code,
      status: response.status,
    });
  }
  return payload as T;
}

export function useSessionEvidence(
  projectId: string,
  input: { sessionId?: string; startAt?: string; endAt?: string; urlPath?: string },
) {
  return useInfiniteQuery({
    queryKey: ['studio-session-evidence', projectId, input],
    initialPageParam: '',
    queryFn: ({ pageParam, signal }) => {
      const params = new URLSearchParams({ sessionId: input.sessionId ?? '', limit: '50' });
      if (input.startAt) params.set('startAt', input.startAt);
      if (input.endAt) params.set('endAt', input.endAt);
      if (input.urlPath) params.set('urlPath', input.urlPath);
      if (pageParam) params.set('cursor', pageParam);
      return requestJson<SessionEvidence>(
        `${getApiUrl(`/projects/${projectId}/evidence`)}?${params}`,
        signal,
      );
    },
    getNextPageParam: page => page.timeline.nextCursor ?? undefined,
    enabled: !!input.sessionId,
    staleTime: 30_000,
  });
}

export function useEvidenceReplay(projectId: string, visitId?: string, enabled = false) {
  return useQuery({
    queryKey: ['studio-evidence-replay', projectId, visitId],
    queryFn: ({ signal }) =>
      requestJson<{ events: unknown[]; eventCount: number; chunkCount: number; bounded: boolean }>(
        getApiUrl(`/projects/${projectId}/evidence/replay/${visitId}`),
        signal,
      ),
    enabled: !!visitId && enabled,
    staleTime: 5 * 60_000,
  });
}
