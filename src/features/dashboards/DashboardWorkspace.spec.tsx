import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import type { AnalysisQueryV1 } from '@/server/analytics/contracts';
import type { DashboardWidgetDto } from '@/server/dashboards/dashboard-service';
import { DashboardWidget } from './DashboardWorkspace';

vi.mock('@/lib/client', () => ({ getClientAuthToken: () => 'token' }));
vi.mock('@/features/exports/ExportControls', () => ({ ExportControls: () => null }));
const projectId = 'd5a950d4-4d31-4c0f-b7a4-41dce9e0a003';
const query: AnalysisQueryV1 = {
  version: 1,
  projectId,
  mode: 'trend',
  range: {
    startAt: '2026-03-01T00:00:00.000Z',
    endAt: '2026-03-10T00:00:00.000Z',
    timezone: 'UTC',
    unit: 'day',
  },
  measure: { source: 'event', key: 'signup', aggregation: 'count' },
  filters: [],
  match: 'all',
  comparison: 'none',
  visualization: 'line',
};
function widget(id: string, input = query): DashboardWidgetDto {
  return {
    id,
    dashboardId: '20000000-0000-4000-8000-000000000001',
    kind: 'insight',
    insightId: id,
    title: '',
    body: '',
    position: 0,
    width: 1,
    height: 1,
    insight: {
      id,
      projectId,
      owner: { id: '30000000-0000-4000-8000-000000000001', username: 'owner' },
      title: input.measure.key,
      description: '',
      queryVersion: 1,
      query: input,
      visualization: {},
      status: 'active',
      favorite: false,
      compatibility: { state: 'ready' },
      dependencies: { dashboards: 1 },
      createdAt: '2026-03-01T00:00:00.000Z',
      updatedAt: '2026-03-01T00:00:00.000Z',
    },
  };
}
function success(event: string) {
  return {
    queryVersion: 1,
    generatedAt: '2026-03-10T00:00:00.000Z',
    freshnessAt: '2026-03-10T00:00:00.000Z',
    exactness: 'exact',
    cache: 'miss',
    data: { mode: 'trend', rows: [{ bucket: '2026-03-01', value: event === 'signup' ? 3 : 7 }] },
    definitions: [{ key: 'event.count', label: event, description: 'Exact count.' }],
  };
}
function wrapper(children: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{children}</QueryClientProvider>);
}

afterEach(() => vi.restoreAllMocks());

test('identical dashboard widget queries share one TanStack request', async () => {
  const fetchMock = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(Response.json(success('signup')));
  wrapper(
    <>
      <DashboardWidget widget={widget('10000000-0000-4000-8000-000000000001')} context={{}} />
      <DashboardWidget widget={widget('10000000-0000-4000-8000-000000000002')} context={{}} />
    </>,
  );
  await waitFor(() => expect(screen.getAllByRole('table')).toHaveLength(2));
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test('one widget error does not remove a successful sibling', async () => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    return body.measure.key === 'purchase'
      ? Response.json({ error: { message: 'Bounded query failed' } }, { status: 500 })
      : Response.json(success('signup'));
  });
  const purchase = { ...query, measure: { ...query.measure, key: 'purchase' } };
  wrapper(
    <>
      <DashboardWidget widget={widget('10000000-0000-4000-8000-000000000003')} context={{}} />
      <DashboardWidget
        widget={widget('10000000-0000-4000-8000-000000000004', purchase)}
        context={{}}
      />
    </>,
  );
  await waitFor(() => expect(screen.getByText(/This widget could not be loaded/)).toBeInTheDocument());
  expect(screen.getByRole('table', { name: /Data for signup/ })).toBeInTheDocument();
});
