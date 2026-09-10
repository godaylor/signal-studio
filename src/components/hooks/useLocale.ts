import { useEffect } from 'react';
import { LOCALE_CONFIG } from '@/lib/constants';
import { getDateLocale, getTextDirection, normalizePublicLocale } from '@/lib/lang';
import { getItem, setItem } from '@/lib/storage';
import { setLocale, useApp } from '@/store/app';
import enUS from '../../../public/intl/messages/en-US.json';
import ruRU from '../../../public/intl/messages/ru-RU.json';
import { useForceUpdate } from './useForceUpdate';

const messages = {
  'ru-RU': ruRU,
  'en-US': enUS,
};

const selector = (state: { locale: string }) => state.locale;

export function useLocale() {
  const storedLocale = useApp(selector);
  const locale = normalizePublicLocale(storedLocale);
  const forceUpdate = useForceUpdate();
  const dir = getTextDirection(locale);
  const dateLocale = getDateLocale(locale);

  async function saveLocale(value: string) {
    const nextLocale = normalizePublicLocale(value);

    setItem(LOCALE_CONFIG, nextLocale);

    if (locale !== nextLocale) {
      setLocale(nextLocale);
    } else {
      forceUpdate();
    }
  }

  useEffect(() => {
    document.documentElement.lang = locale.split('-')[0];
    document.documentElement.setAttribute('dir', getTextDirection(locale));
  }, [locale]);

  useEffect(() => {
    const url = new URL(window?.location?.href);
    const requestedLocale = url.searchParams.get('locale');
    const persistedLocale = getItem(LOCALE_CONFIG);
    const nextLocale = normalizePublicLocale(requestedLocale ?? persistedLocale);
    setItem(LOCALE_CONFIG, nextLocale);
    setLocale(nextLocale);
  }, []);

  return { locale, saveLocale, messages, dir, dateLocale };
}
