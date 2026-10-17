import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { homeQueries, homeRanges } from '@/server/home/queries';
import { HomeWorkspace } from './HomeWorkspace';
import { useHome } from './useHome';

vi.mock('./useHome', () => ({ useHome: vi.fn() }));
vi.mock('@/features/visual/MotionPreferences', () => ({
  useVisualMotion: () => ({ animate: false, ambient: false }),
}));
let russian = false;
vi.mock('@/features/i18n/useStudioLocale', () => ({
  useStudioLocale: () => ({
    locale: russian ? 'ru-RU' : 'en-US',
    t: (en: string, ru: string) => (russian ? ru : en),
  }),
}));
const projectId = '11111111-1111-4111-8111-111111111111';
const now = new Date('2026-09-08T12:00:00Z');
describe('Home product states and defined KPI links', () => {
  beforeEach(() => {
    russian = false;
    vi.mocked(useHome).mockReturnValue({
      data: {
        ...homeRanges(now),
        generatedAt: now.toISOString(),
        currenciesTruncated: false,
        metrics: homeQueries(projectId, now, ['USD']).map(item => ({
          ...item,
          error: null,
          result: {
            data: {
              rows: [],
              total: { value: 2, denominator: 4, rate: 0.5 },
              comparisonTotal: { value: 4, denominator: 4, rate: 1 },
            },
          },
        })),
        health: {
          state: 'empty',
          lastEventAt: null,
          observedEvents24h: 0,
          deliveryLoss: 'unknown',
        },
        atRisk: { permitted: false, accounts: [] },
        recent: [],
      },
      isPending: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    } as any);
  });
  test('shows activation comparison and canonical Explore source, never identity data for Viewer', () => {
    render(<HomeWorkspace projectId={projectId} projectName="Demo" />);
    expect(screen.getAllByText('50%')).toHaveLength(3);
    expect(screen.getByText(/Your role cannot view account identities/)).toBeVisible();
    expect(screen.getByRole('link', { name: /Explore the journey/ })).toHaveAttribute(
      'href',
      expect.stringContaining('source=lifecycle'),
    );
    expect(screen.getByRole('link', { name: /Activated/ })).toHaveAttribute(
      'href',
      expect.stringContaining('event=activated'),
    );
    const links = screen.getAllByRole('link', { name: 'Open definition in Explore' });
    expect(links[2]).toHaveAttribute('href', expect.stringContaining('property=USD'));
  });
  test('RU copy has meaningful empty data and recent Insight guidance', () => {
    russian = true;
    render(<HomeWorkspace projectId={projectId} projectName="Demo" />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Как пользователи находят ценность?' }),
    ).toBeVisible();
    expect(screen.getByText('События ещё не поступали')).toBeVisible();
    expect(screen.getByText(/Сохраните результат анализа/)).toBeVisible();
  });
  test('flow keeps the two server-defined denominators and distinct query links', () => {
    const state = vi.mocked(useHome)(projectId);
    const values = {
      signups: { value: 56 },
      activation: { value: 28, denominator: 56, rate: 0.5 },
      retention: { value: 21, denominator: 28, rate: 0.75 },
    };
    vi.mocked(useHome).mockReturnValue({
      ...state,
      data: {
        ...state.data,
        metrics: state.data.metrics.map((metric: any) => ({
          ...metric,
          result: {
            ...metric.result,
            data: {
              ...metric.result.data,
              total: values[metric.id as keyof typeof values] ?? metric.result.data.total,
            },
          },
        })),
      },
    } as any);
    render(<HomeWorkspace projectId={projectId} projectName="Demo" />);
    expect(screen.getByText('28 of 56')).toBeVisible();
    expect(screen.getByText('21 of 28')).toBeVisible();
    expect(screen.getByText('75%')).toBeVisible();
    expect(screen.getByText('+52 vs previous period')).toBeVisible();
    expect(screen.getByRole('link', { name: /Returned/ })).toHaveAttribute(
      'href',
      expect.stringContaining('event=retained'),
    );
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
