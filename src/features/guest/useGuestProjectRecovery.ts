'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { serializeAnalysisQuery } from '@/server/analytics/url-codec';
import type { GuestSessionDto } from './useGuestSession';

/** An expired/rotated guest project URL must not strand the current guest on a 403. */
export function useGuestProjectRecovery(projectId: string, guest?: GuestSessionDto | null) {
  const router = useRouter();
  const needsRecovery = !!guest && guest.projectId !== projectId;
  useEffect(() => {
    if (!needsRecovery || !guest) return;
    const params = new URLSearchParams(serializeAnalysisQuery(guest.defaultQuery));
    const locale = new URLSearchParams(window.location.search).get('locale');
    if (locale === 'ru-RU' || locale === 'en-US') params.set('locale', locale);
    router.replace(`/studio/${guest.projectId}/explore?${params}`);
  }, [guest, needsRecovery, router]);
  return needsRecovery;
}
