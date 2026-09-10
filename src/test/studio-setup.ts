import { beforeEach } from 'vitest';
import { LOCALE_CONFIG } from '@/lib/constants';
import { setItem } from '@/lib/storage';
import { setLocale } from '@/store/app';

// Historical Studio component assertions are English; production still defaults to RU.
beforeEach(() => {
  setItem(LOCALE_CONFIG, 'en-US');
  setLocale('en-US');
});
