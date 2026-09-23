import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { DemoWalkthrough } from './DemoWalkthrough';

vi.mock('@/features/i18n/useStudioLocale', () => ({
  useStudioLocale: () => ({ t: (_en: string, ru: string) => ru }),
}));

test('public demo explains isolation and links saved analysis to dashboard without a session', () => {
  render(<DemoWalkthrough />);
  expect(screen.getByText(/Данные production не читаются/)).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Дашборд' }));
  expect(screen.getByText('Сначала сохраните анализ на шаге 4.')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Сохранённый анализ' }));
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить анализ в демо' }));
  fireEvent.click(screen.getByRole('button', { name: 'Дашборд' }));
  fireEvent.click(screen.getByRole('button', { name: 'Добавить сохранённый анализ' }));
  expect(screen.getByText('40%')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Открыть анализ' }));
  expect(screen.getByRole('table')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Аудитория' }));
  fireEvent.click(screen.getByRole('button', { name: 'Посмотреть аудиторию демо' }));
  expect(screen.getByRole('status')).toHaveTextContent('36 вымышленных пользователей');
});

test('demo export contains only labeled fictional data and a bounded date range', () => {
  const create = vi.fn(() => 'blob:demo');
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: create, revokeObjectURL: vi.fn() }));
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  render(<DemoWalkthrough />);
  fireEvent.click(screen.getByRole('button', { name: 'Экспорт' }));
  fireEvent.click(screen.getByRole('button', { name: 'Скачать JSON демо' }));
  expect(create).toHaveBeenCalledWith(expect.any(Blob));
  expect(click).toHaveBeenCalledOnce();
  expect(screen.getByRole('status')).toHaveTextContent('Демо-файл подготовлен');
  click.mockRestore();
  vi.unstubAllGlobals();
});
