import { expect, test, vi } from 'vitest';
vi.mock('@/lib/storage', () => ({ getItem: () => 'en-US' }));
import { useApp } from './app';
import { DEFAULT_LOCALE } from '@/lib/constants';
test('saved browser language does not change the server hydration snapshot', () => {
  expect(useApp.getInitialState().locale).toBe(process.env.defaultLocale || DEFAULT_LOCALE);
});
