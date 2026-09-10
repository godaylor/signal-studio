'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { getApiUrl } from '@/lib/api-url';
import { getClientAuthToken } from '@/lib/client';
import type { LiveSnapshot } from '@/server/live/contracts';

async function requestSnapshot(projectId: string, signal?: AbortSignal) {
  const response = await fetch(getApiUrl(`/projects/${projectId}/live`), {
    signal,
    headers: { authorization: `Bearer ${getClientAuthToken()}` },
  });
  const payload = await response.json();
  if (!response.ok) {
    const source = payload?.error ?? {};
    throw Object.assign(new Error(source.message ?? 'Live snapshot request failed.'), {
      code: source.code,
      status: response.status,
    });
  }
  return payload as LiveSnapshot;
}

export function usePageVisibility() {
  const [visible, setVisible] = useState(() =>
    typeof document === 'undefined' ? true : document.visibilityState !== 'hidden',
  );

  useEffect(() => {
    const onVisibilityChange = () => setVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  return visible;
}

export function getLiveRefetchInterval({
  paused,
  visible,
  snapshot,
}: {
  paused: boolean;
  visible: boolean;
  snapshot?: LiveSnapshot;
}) {
  if (paused || !visible || snapshot?.transport.kind === 'sse') return false;
  return snapshot?.transport.recommendedPollMs ?? 10_000;
}

export function useLiveSnapshot(projectId: string, paused: boolean) {
  const visible = usePageVisibility();
  const query = useQuery({
    queryKey: ['studio-live-snapshot', projectId],
    queryFn: ({ signal }) => requestSnapshot(projectId, signal),
    placeholderData: previous => previous,
    refetchInterval: current =>
      getLiveRefetchInterval({ paused, visible, snapshot: current.state.data }),
    refetchOnWindowFocus: false,
    retry: 1,
  });

  return { ...query, visible };
}
