import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';
import { InsightLibrary } from './InsightLibrary';

vi.mock('@/lib/client', () => ({
  getClientAuthHeaders: () => ({ authorization: 'Bearer test-token' }),
}));

const projectId = 'd5a950d4-4d31-4c0f-b7a4-41dce9e0a003';
const insight = {
  id: '10000000-0000-4000-8000-000000000001',
  projectId,
  owner: { id: '10000000-0000-4000-8000-000000000002', username: 'owner' },
  title: 'Activation',
  description: '',
  queryVersion: 1,
  query: null,
  visualization: {},
  status: 'active',
  favorite: false,
  compatibility: { state: 'ready' },
  dependencies: { dashboards: 0 },
  createdAt: '2026-03-01T00:00:00.000Z',
  updatedAt: '2026-03-01T00:00:00.000Z',
};

afterEach(() => vi.restoreAllMocks());

test('a failed rename retains its editor and title draft for a successful retry', async () => {
  const user = userEvent.setup();
  let saved = insight;
  let writes = 0;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
    if (init?.method === 'PATCH') {
      writes += 1;
      if (writes === 1)
        return Response.json({ error: { message: 'Temporarily unavailable' } }, { status: 503 });
      saved = { ...saved, title: JSON.parse(String(init.body)).title };
      return Response.json(saved);
    }
    return Response.json({ data: [saved], nextCursor: null });
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <InsightLibrary open projectId={projectId} onClose={vi.fn()} onReopen={vi.fn()} />
    </QueryClientProvider>,
  );
  await user.click(await screen.findByRole('button', { name: 'Edit title' }));
  const draft = screen.getByLabelText('Edit title');
  await user.clear(draft);
  await user.type(draft, 'New activation finding');
  await user.click(screen.getByRole('button', { name: 'Save title' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('rolled back');
  expect(screen.getByLabelText('Edit title')).toHaveValue('New activation finding');
  expect(screen.getByRole('button', { name: 'Save title' })).toBeEnabled();
  await user.click(screen.getByRole('button', { name: 'Save title' }));
  expect(await screen.findByRole('heading', { name: 'New activation finding' })).toBeVisible();
  await waitFor(() => expect(screen.queryByLabelText('Edit title')).not.toBeInTheDocument());
  expect(writes).toBe(2);
});
