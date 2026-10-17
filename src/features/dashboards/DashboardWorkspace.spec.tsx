import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { useProjectAccess } from '@/features/access/useProjectAccess';
import { useGuestWorkspace } from '@/features/guest/GuestWorkspaceContext';
import type { AnalysisQueryV1 } from '@/server/analytics/contracts';
import type { DashboardWidgetDto } from '@/server/dashboards/dashboard-service';
import { DashboardWidget, DashboardWorkspace } from './DashboardWorkspace';

vi.mock('@/lib/client', () => ({
  getClientAuthHeaders: () => ({ authorization: 'Bearer token' }),
}));
vi.mock('@/features/exports/ExportControls', () => ({ ExportControls: () => null }));
vi.mock('@/features/access/useProjectAccess', () => ({ useProjectAccess: vi.fn() }));
vi.mock('@/features/guest/GuestWorkspaceContext', () => ({ useGuestWorkspace: vi.fn() }));
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
beforeEach(() => {
  vi.mocked(useProjectAccess).mockReturnValue({
    data: { capabilities: { editDashboards: true } },
  } as ReturnType<typeof useProjectAccess>);
  vi.mocked(useGuestWorkspace).mockReturnValue(null);
});

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

test('a viewer cannot open or submit dashboard creation', async () => {
  vi.mocked(useProjectAccess).mockReturnValue({
    data: { capabilities: { editDashboards: false } },
  } as ReturnType<typeof useProjectAccess>);
  const fetchMock = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(Response.json({ data: [], nextCursor: null }));
  wrapper(<DashboardWorkspace projectId={projectId} projectName="Demo" />);
  const create = await screen.findByRole('button', { name: 'New dashboard' });
  expect(create).toBeDisabled();
  fireEvent.click(create);
  expect(screen.queryByRole('dialog', { name: 'Create dashboard' })).not.toBeInTheDocument();
  expect(screen.getByText(/A project editor can create one for you/)).toBeVisible();
  expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
});

test('a failed note save retains its draft and successful retry clears it', async () => {
  const dashboard = {
    id: '20000000-0000-4000-8000-000000000001',
    title: 'Product pulse',
    updatedAt: '2026-03-10T00:00:00Z',
    owner: { username: 'owner' },
    widgets: [],
    globalContext: {},
    canEdit: true,
  };
  let saves = 0;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    if (init?.method === 'POST') {
      saves += 1;
      return saves === 1
        ? Response.json({ error: { message: 'Storage unavailable' } }, { status: 503 })
        : Response.json(dashboard);
    }
    return Response.json(
      String(url).includes('/insights') ? { data: [], nextCursor: null } : { data: [dashboard] },
    );
  });
  wrapper(<DashboardWorkspace projectId={projectId} projectName="Demo" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
  fireEvent.change(screen.getByLabelText('Note title'), {
    target: { value: 'Activation finding' },
  });
  fireEvent.change(screen.getByLabelText('Note body'), { target: { value: 'Keep the evidence' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add note' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Your note draft');
  expect(screen.getByLabelText('Note title')).toHaveValue('Activation finding');
  expect(screen.getByLabelText('Note body')).toHaveValue('Keep the evidence');
  fireEvent.click(screen.getByRole('button', { name: 'Add note' }));
  await waitFor(() => expect(screen.getByLabelText('Note body')).toHaveValue(''));
  expect(screen.getByLabelText('Note title')).toHaveValue('');
  expect(saves).toBe(2);
});

test('clearing a shared date retains the valid period without sending an invalid context', async () => {
  const dashboard = {
    id: '20000000-0000-4000-8000-000000000001',
    title: 'Product pulse',
    updatedAt: '2026-03-10T00:00:00Z',
    owner: { username: 'owner' },
    widgets: [],
    globalContext: { range: query.range },
    canEdit: true,
  };
  const fetchMock = vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async url =>
      Response.json(
        String(url).includes('/insights') ? { data: [], nextCursor: null } : { data: [dashboard] },
      ),
    );
  wrapper(<DashboardWorkspace projectId={projectId} projectName="Demo" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
  fireEvent.click(screen.getByText('Shared context', { exact: true }));
  const start = screen.getByLabelText('Start date');
  fireEvent.change(start, { target: { value: '' } });
  expect(start).toHaveValue('2026-03-01');
  expect(screen.getByRole('alert')).toHaveTextContent('previous period has been kept');
  expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(false);
  fireEvent.change(start, { target: { value: '2026-03-02' } });
  expect(start).toHaveValue('2026-03-02');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
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

test('a failed widget can retry without reloading the dashboard', async () => {
  vi.spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(
      Response.json({ error: { message: 'Temporary failure' } }, { status: 503 }),
    )
    .mockResolvedValueOnce(Response.json(success('signup')));
  wrapper(<DashboardWidget widget={widget('10000000-0000-4000-8000-000000000009')} context={{}} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Retry widget' }));
  expect(await screen.findByRole('table', { name: /Data for signup/ })).toBeVisible();
});

test('a changed shared period never relabels the previous period result', async () => {
  let finish: ((response: Response) => void) | undefined;
  vi.spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(Response.json(success('signup')))
    .mockImplementationOnce(
      () =>
        new Promise<Response>(resolve => {
          finish = resolve;
        }),
    );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const item = widget('10000000-0000-4000-8000-000000000010');
  const { rerender } = render(
    <QueryClientProvider client={client}>
      <DashboardWidget widget={item} context={{}} />
    </QueryClientProvider>,
  );
  expect(await screen.findByRole('table')).toBeVisible();
  rerender(
    <QueryClientProvider client={client}>
      <DashboardWidget
        widget={item}
        context={{
          range: {
            startAt: '2026-03-02T00:00:00.000Z',
            endAt: '2026-03-10T00:00:00.000Z',
            timezone: 'UTC',
          },
        }}
      />
    </QueryClientProvider>,
  );
  expect(screen.getByRole('status')).toHaveTextContent('Loading Insight');
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
  finish?.(Response.json(success('signup')));
  expect(await screen.findByRole('table')).toBeVisible();
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

test('guest funnel chart and its scrollable table use the same readable event labels', async () => {
  vi.mocked(useGuestWorkspace).mockReturnValue({} as ReturnType<typeof useGuestWorkspace>);
  const funnel: AnalysisQueryV1 = {
    ...query,
    mode: 'funnel',
    funnel: {
      steps: [
        { type: 'event', value: 'signup', filters: [] },
        { type: 'event', value: 'subscription_started', filters: [] },
      ],
      conversionWindowMinutes: 1440,
    },
    visualization: 'bar',
  };
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    Response.json({
      ...success('signup'),
      data: {
        mode: 'funnel',
        rows: [336, 84].map((value, index) => ({
          kind: 'funnel-step',
          step: index + 1,
          label: ['signup', 'subscription_started'][index],
          value,
          converted: value,
          overallConversionRate: value / 336,
        })),
      },
    }),
  );
  wrapper(
    <DashboardWidget
      widget={widget('10000000-0000-4000-8000-000000000008', funnel)}
      context={{}}
    />,
  );
  const table = await screen.findByRole('table');
  expect(within(table).getByRole('rowheader', { name: 'Subscription' })).toBeVisible();
  expect(screen.getByText('Subscription', { selector: 'span' })).toBeVisible();
  expect(screen.getByRole('region', { name: 'Data for signup' })).toHaveAttribute('tabindex', '0');
  expect(screen.getByRole('region', { name: 'Funnel conversion by step' })).toHaveAttribute(
    'tabindex',
    '0',
  );
});
