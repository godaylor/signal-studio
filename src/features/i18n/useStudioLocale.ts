'use client';

import { useCallback } from 'react';
import { useLocale } from '@/components/hooks';

export function useStudioLocale() {
  const { locale } = useLocale();
  const isRussian = locale !== 'en-US';
  const t = useCallback(
    (english: string, russian: string) => (isRussian ? russian : english),
    [isRussian],
  );

  return { locale, isRussian, t };
}
