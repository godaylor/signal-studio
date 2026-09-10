import { enUS, ru } from 'date-fns/locale';
import { describe, expect, test } from 'vitest';
import { getDateLocale, getTextDirection, normalizePublicLocale } from './lang';

describe('getDateLocale', () => {
  test('returns the configured public date-fns locales', () => {
    expect(getDateLocale('ru-RU')).toBe(ru);
    expect(getDateLocale('en-US')).toBe(enUS);
  });

  test('falls back to Russian for unknown locales', () => {
    expect(getDateLocale('xx-XX')).toBe(ru);
  });

  test('falls back to Russian for retained upstream locales', () => {
    expect(getDateLocale('fo-FO')).toBe(ru);
  });
});

describe('getTextDirection', () => {
  test('returns ltr for both public locales', () => {
    expect(getTextDirection('ru-RU')).toBe('ltr');
    expect(getTextDirection('en-US')).toBe('ltr');
  });

  test('uses the safe Russian fallback for non-public locales', () => {
    expect(getTextDirection('ar-SA')).toBe('ltr');
    expect(getTextDirection('xx-XX')).toBe('ltr');
  });
});

describe('normalizePublicLocale', () => {
  test('exposes only en-US and Russian as the safe default', () => {
    expect(normalizePublicLocale('en-US')).toBe('en-US');
    expect(normalizePublicLocale('ru-RU')).toBe('ru-RU');
    expect(normalizePublicLocale('fr-FR')).toBe('ru-RU');
    expect(normalizePublicLocale(undefined)).toBe('ru-RU');
  });
});
