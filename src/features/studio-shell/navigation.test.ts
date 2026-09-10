import { describe, expect, test } from 'vitest';
import { getLocalizedStudioNavigation, getStudioPath, studioNavigation } from './navigation';

describe('Studio navigation contract', () => {
  test('keeps the product IA exact and ordered', () => {
    expect(studioNavigation.map(item => item.label)).toEqual([
      'Home',
      'Explore',
      'Dashboards',
      'Audiences',
      'Experience',
      'Live',
    ]);
  });

  test('builds project-oriented paths without Website vocabulary', () => {
    expect(getStudioPath('project-1', 'explore')).toBe('/studio/project-1/explore');
  });

  test('localizes the public navigation to Russian and en-US only', () => {
    expect(getLocalizedStudioNavigation('ru-RU').map(item => item.label)).toEqual([
      'Главная',
      'Анализ',
      'Дашборды',
      'Аудитории',
      'Опыт',
      'Сейчас',
    ]);
    expect(getLocalizedStudioNavigation('en-US')).toBe(studioNavigation);
    expect(getLocalizedStudioNavigation('fr-FR')[0].label).toBe('Главная');
  });
});
