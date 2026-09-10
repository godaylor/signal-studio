import { type InfiniteData, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import type { InsightDto } from '@/server/insights/insight-service';
import { useUpdateInsight } from './useInsights';

vi.mock('@/lib/client', () => ({ getClientAuthToken: () => 'test-token' }));

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
} as InsightDto;

afterEach(() => vi.restoreAllMocks());

test('optimistic archive removes the item and restores it when the API fails', async () => {
  let finish: (response: Response) => void = () => {};
  vi.spyOn(globalThis, 'fetch').mockReturnValue(
    new Promise(resolve => {
      finish = resolve;
    }),
  );
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const key = ['studio-insights', projectId, { owner: 'all' }];
  client.setQueryData<InfiniteData<{ data: InsightDto[]; nextCursor: string | null }>>(key, {
    pages: [{ data: [insight], nextCursor: null }],
    pageParams: [''],
  });
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useUpdateInsight(projectId), { wrapper });

  act(() => result.current.mutate({ id: insight.id, patch: { status: 'archived' } }));
  await waitFor(() => expect(client.getQueryData<any>(key).pages[0].data).toEqual([]));

  finish(Response.json({ error: { message: 'Write denied' } }, { status: 403 }));
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(client.getQueryData<any>(key).pages[0].data).toEqual([insight]);
});
