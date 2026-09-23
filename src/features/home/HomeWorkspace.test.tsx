import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { HomeWorkspace } from './HomeWorkspace';
import { useHome } from './useHome';
import { homeQueries, homeRanges } from '@/server/home/queries';
vi.mock('./useHome', () => ({ useHome: vi.fn() }));
let russian = false;
vi.mock('@/features/i18n/useStudioLocale', () => ({
  useStudioLocale: () => ({ locale: russian ? 'ru-RU' : 'en-US', t: (en: string, ru: string) => russian ? ru : en }),
}));
const projectId = '11111111-1111-4111-8111-111111111111';
const now = new Date('2026-09-08T12:00:00Z');
describe('Home product states and defined KPI links', () => {
  beforeEach(() => {
    russian = false;
    vi.mocked(useHome).mockReturnValue({
      data: {
        ...homeRanges(now), generatedAt: now.toISOString(), currenciesTruncated: false,
        metrics: homeQueries(projectId, now, ['USD']).map(item => ({
          ...item, error: null, result: { data: { rows: [], total: { value: 2, denominator: 4, rate: 0.5 }, comparisonTotal: { value: 4, denominator: 4, rate: 1 } } },
        })),
        health: { state: 'empty', lastEventAt: null, observedEvents24h: 0, deliveryLoss: 'unknown' },
        atRisk: { permitted: false, accounts: [] }, recent: [],
      }, isPending: false, isError: false, isFetching: false, refetch: vi.fn(),
    } as any);
  });
  test('shows activation comparison and canonical Explore source, never identity data for Viewer', () => {
    render(<HomeWorkspace projectId={projectId} projectName="Demo" />);
    expect(screen.getAllByText('50%')).toHaveLength(2);
    expect(screen.getByText(/Your role cannot view account identities/)).toBeVisible();
    const links = screen.getAllByRole('link', { name: 'Open definition in Explore' });
    expect(links[0]).toHaveAttribute('href', expect.stringContaining('source=lifecycle'));
    expect(links[4]).toHaveAttribute('href', expect.stringContaining('property=USD'));
  });
  test('RU copy has meaningful empty data and recent Insight guidance', () => {
    russian = true;
    render(<HomeWorkspace projectId={projectId} projectName="Demo" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Главная' })).toBeVisible();
    expect(screen.getByText('События ещё не поступали')).toBeVisible();
    expect(screen.getByText(/Сохраните результат анализа/)).toBeVisible();
  });
  test('has a recoverable loading state', () => {
    vi.mocked(useHome).mockReturnValue({ isPending: true } as any);
    render(<HomeWorkspace projectId={projectId} projectName="Demo" />);
    expect(screen.getByRole('heading', { name: 'Loading product health' })).toBeVisible();
  });
  test('has a recoverable error state', () => {
    vi.mocked(useHome).mockReturnValue({ isError: true, refetch: vi.fn() } as any);
    render(<HomeWorkspace projectId={projectId} projectName="Demo" />);
    expect(screen.getByRole('button', { name: 'Retry' })).toBeVisible();
  });
});
