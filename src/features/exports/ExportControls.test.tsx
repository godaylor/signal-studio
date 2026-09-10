import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { ExportControls } from './ExportControls';

const mocks = vi.hoisted(() => ({ allowed: true, russian: false, create: vi.fn(), download: vi.fn(), cancel: vi.fn(), jobs: [] as any[], error: null as Error | null }));
vi.mock('@/features/access/useProjectAccess', () => ({ useProjectAccess: () => ({ data: { capabilities: { exportData: mocks.allowed } } }) }));
vi.mock('@/features/i18n/useStudioLocale', () => ({ useStudioLocale: () => ({ locale: mocks.russian ? 'ru-RU' : 'en-US', t: (en: string, ru: string) => mocks.russian ? ru : en }) }));
vi.mock('./useExports', () => ({ useExports: () => ({ jobs: { data: mocks.jobs, isPending: false, error: null }, create: { mutate: mocks.create, error: mocks.error }, download: { mutate: mocks.download }, cancel: { mutate: mocks.cancel } }) }));
const source = { kind: 'users' as const, list: { limit: 50, sort: 'lastSeenAt' as const, direction: 'desc' as const }, visibleRows: 75 };
beforeEach(() => { mocks.allowed = true; mocks.russian = false; mocks.jobs = []; mocks.error = null; vi.clearAllMocks(); });

test('does not offer export without capability', () => { mocks.allowed = false; render(<ExportControls projectId="project" source={source} />); expect(screen.queryByRole('button', { name: 'Export' })).not.toBeInTheDocument(); });
test('submits normalized visible scope and chosen format from a named dialog', () => {
  render(<ExportControls projectId="project" source={source} />);
  fireEvent.click(screen.getByRole('button', { name: 'Export' }));
  expect(screen.getByRole('dialog', { name: 'Export data' })).toBeInTheDocument();
  fireEvent.change(screen.getByRole('combobox', { name: 'File format' }), { target: { value: 'json' } });
  fireEvent.click(screen.getByRole('button', { name: 'Export data' }));
  expect(mocks.create).toHaveBeenCalledWith({ version: 1, source, format: 'json', allRows: false, idempotencyKey: expect.any(String) });
});
test('RU controls offer all matching rows and close on Escape', () => {
  mocks.russian = true; render(<ExportControls projectId="project" source={source} />);
  fireEvent.click(screen.getByRole('button', { name: 'Экспорт' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Все строки по фильтрам' }));
  fireEvent.click(screen.getByRole('button', { name: 'Экспортировать данные' }));
  expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ allRows: true }));
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
test('shows job status/expiry and only completed jobs can download', () => {
  mocks.jobs = [{ id: 'ready', filename: 'ready.csv', status: 'completed', rowCount: 5, expiresAt: '2026-09-08T12:00:00Z' }, { id: 'expired', filename: 'expired.csv', status: 'expired', rowCount: 5, expiresAt: '2026-09-07T12:00:00Z' }];
  render(<ExportControls projectId="project" source={source} />); fireEvent.click(screen.getByRole('button', { name: 'Export' }));
  fireEvent.click(screen.getByRole('button', { name: 'Download ready.csv' }));
  expect(mocks.download).toHaveBeenCalledWith('ready');
  expect(screen.queryByRole('button', { name: 'Download expired.csv' })).not.toBeInTheDocument();
});
test('shows safe failure code and a retryable action', () => {
  mocks.error = new Error('export-active-limit'); render(<ExportControls projectId="project" source={source} />); fireEvent.click(screen.getByRole('button', { name: 'Export' }));
  expect(screen.getByRole('alert')).toHaveTextContent('export-active-limit');
  expect(screen.getByRole('button', { name: 'Export data' })).toBeEnabled();
});
