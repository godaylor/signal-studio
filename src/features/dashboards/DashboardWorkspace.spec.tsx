import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import type { AnalysisQueryV1 } from '@/server/analytics/contracts';
import type { DashboardWidgetDto } from '@/server/dashboards/dashboard-service';
import { DashboardWidget, DashboardWorkspace } from './DashboardWorkspace';

vi.mock('@/lib/client', () => ({
  getClientAuthHeaders: () => ({ authorization: 'Bearer token' }),
}));
vi.mock('@/features/exports/ExportControls', () => ({ ExportControls: () => null }));
vi.mock('@/features/visual/MotionPreferences', () => ({
  useVisualMotion: () => ({ animate: false, ambient: false }),
}));
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

test('new dashboard is created in a focused dialog and context stays collapsed until requested', async () => {
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    if (init?.method === 'POST')
      return Response.json({
        id: '20000000-0000-4000-8000-000000000001',
        title: JSON.parse(String(init.body)).title,
        updatedAt: '2026-10-17T00:00:00Z',
        owner: { username: 'owner' },
        widgets: [],
        globalContext: {},
        canEdit: true,
      });
    return Response.json(
      String(url).includes('/insights') ? { data: [], nextCursor: null } : { data: [] },
    );
  });
  wrapper(<DashboardWorkspace projectId={projectId} projectName="Demo" />);
  const trigger = await screen.findByRole('button', { name: 'New dashboard' });
  expect(screen.queryByLabelText('New dashboard title')).not.toBeInTheDocument();
  trigger.focus();
  fireEvent.click(trigger);
  const dialog = screen.getByRole('dialog', { name: 'Create dashboard' });
  const input = within(dialog).getByLabelText('New dashboard title');
  await waitFor(() => expect(input).toHaveFocus());
  fireEvent.change(input, { target: { value: 'Activation pulse' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Create dashboard' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.getByRole('heading', { name: 'Activation pulse' })).toBeVisible();
  expect(screen.getByLabelText('Dashboard editor')).toBeVisible();
  expect(screen.getByLabelText('Start date')).not.toBeVisible();
  fireEvent.click(screen.getByText('Shared context', { exact: true }));
  expect(screen.getByLabelText('Start date')).toBeVisible();
  expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
  await waitFor(() => expect(trigger).toHaveFocus());
});

test('failed dashboard creation retains the draft and a recoverable error in the dialog', async () => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) =>
    init?.method === 'POST'
      ? Response.json({ error: { message: 'Bounded storage unavailable' } }, { status: 503 })
      : Response.json({ data: [], nextCursor: null }),
  );
  wrapper(<DashboardWorkspace projectId={projectId} projectName="Demo" />);
  fireEvent.click(await screen.findByRole('button', { name: 'New dashboard' }));
  fireEvent.change(screen.getByLabelText('New dashboard title'), {
    target: { value: 'Keep my title' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Create dashboard' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Try again');
  expect(screen.getByLabelText('New dashboard title')).toHaveValue('Keep my title');
  expect(screen.getByRole('button', { name: 'Create dashboard' })).toBeEnabled();
});

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
  await waitFor(() =>
    expect(screen.getByText(/This widget could not be loaded/)).toBeInTheDocument(),
  );
  expect(screen.getByRole('table', { name: /Data for signup/ })).toBeInTheDocument();
});

test('widget headline uses the server total instead of adding analytical rows', async () => {
  const response = success('signup');
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    Response.json({
      ...response,
      data: {
        ...response.data,
        rows: [
          { bucket: '2026-03-01', value: 7 },
          { bucket: '2026-03-02', value: 8 },
        ],
        total: { value: 11, denominator: 20, rate: 0.55 },
      },
    }),
  );
  wrapper(<DashboardWidget widget={widget('10000000-0000-4000-8000-000000000005')} context={{}} />);
  await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument());
  expect(screen.getByText('11', { selector: 'strong' })).toBeInTheDocument();
  expect(screen.getByText(/of 20 · 55%/)).toBeInTheDocument();
  expect(screen.queryByText('15', { selector: 'strong' })).not.toBeInTheDocument();
});

test('widget does not invent a headline total when the response has none', async () => {
  const response = success('signup');
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    Response.json({
      ...response,
      data: {
        ...response.data,
        rows: [
          { bucket: '2026-03-01', value: 7 },
          { bucket: '2026-03-02', value: 8 },
        ],
      },
    }),
  );
  wrapper(<DashboardWidget widget={widget('10000000-0000-4000-8000-000000000006')} context={{}} />);
  await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument());
  expect(screen.queryByText('15', { selector: 'strong' })).not.toBeInTheDocument();
  expect(screen.getByRole('cell', { name: '7' })).toBeInTheDocument();
  expect(screen.getByRole('cell', { name: '8' })).toBeInTheDocument();
});

test('an empty analytical result explains the state and keeps its query available', async () => {
  const response = success('signup');
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    Response.json({
      ...response,
      data: { ...response.data, rows: [] },
    }),
  );
  wrapper(<DashboardWidget widget={widget('10000000-0000-4000-8000-000000000007')} context={{}} />);
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('No matching results.'));
  expect(screen.getByRole('link', { name: 'Open Insight in Explore' })).toHaveAttribute(
    'href',
    expect.stringContaining('event=signup'),
  );
  expect(screen.queryByText('0', { selector: 'strong' })).not.toBeInTheDocument();
});
