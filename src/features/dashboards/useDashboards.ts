'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getApiUrl } from '@/lib/api-url';
import { getClientAuthToken } from '@/lib/client';
import type { DashboardGlobalContext } from '@/server/dashboards/context';
import type { DashboardDto } from '@/server/dashboards/dashboard-service';

async function requestJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      authorization: `Bearer ${getClientAuthToken()}`,
      'content-type': 'application/json',
      ...init.headers,
    },
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message ?? 'Dashboard request failed.');
  return payload as T;
}

const key = (projectId: string) => ['studio-dashboards', projectId] as const;

function replaceDashboard(current: { data: DashboardDto[] } | undefined, dashboard: DashboardDto) {
  if (!current) return { data: [dashboard] };
  const exists = current.data.some(item => item.id === dashboard.id);
  return {
    data: exists
      ? current.data.map(item => (item.id === dashboard.id ? dashboard : item))
      : [dashboard, ...current.data],
  };
}

export function useDashboards(projectId: string) {
  return useQuery({
    queryKey: key(projectId),
    queryFn: ({ signal }) =>
      requestJson<{ data: DashboardDto[] }>(getApiUrl(`/projects/${projectId}/dashboards`), {
        signal,
      }),
    staleTime: 30_000,
  });
}

export function useCreateDashboard(projectId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { title: string; description?: string }) =>
      requestJson<DashboardDto>(getApiUrl(`/projects/${projectId}/dashboards`), {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: dashboard =>
      client.setQueryData(key(projectId), (current: { data: DashboardDto[] } | undefined) =>
        replaceDashboard(current, dashboard),
      ),
  });
}

export function useUpdateDashboard(projectId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: { title?: string; description?: string; globalContext?: DashboardGlobalContext };
    }) =>
      requestJson<DashboardDto>(getApiUrl(`/projects/${projectId}/dashboards/${id}`), {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    onSuccess: dashboard =>
      client.setQueryData(key(projectId), (current: { data: DashboardDto[] } | undefined) =>
        replaceDashboard(current, dashboard),
      ),
  });
}

export function useAddDashboardWidget(projectId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      dashboardId,
      widget,
    }: {
      dashboardId: string;
      widget:
        | { kind: 'insight'; insightId: string }
        | { kind: 'note' | 'header'; title?: string; body: string };
    }) =>
      requestJson<DashboardDto>(
        getApiUrl(`/projects/${projectId}/dashboards/${dashboardId}/widgets`),
        { method: 'POST', body: JSON.stringify(widget) },
      ),
    onSuccess: dashboard =>
      client.setQueryData(key(projectId), (current: { data: DashboardDto[] } | undefined) =>
        replaceDashboard(current, dashboard),
      ),
  });
}

export function useUpdateDashboardWidget(projectId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      dashboardId,
      widgetId,
      patch,
    }: {
      dashboardId: string;
      widgetId: string;
      patch: { position?: number; width?: number; height?: number; title?: string; body?: string };
    }) =>
      requestJson<DashboardDto>(
        getApiUrl(`/projects/${projectId}/dashboards/${dashboardId}/widgets/${widgetId}`),
        { method: 'PATCH', body: JSON.stringify(patch) },
      ),
    onSuccess: dashboard =>
      client.setQueryData(key(projectId), (current: { data: DashboardDto[] } | undefined) =>
        replaceDashboard(current, dashboard),
      ),
  });
}

export function useRemoveDashboardWidget(projectId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ dashboardId, widgetId }: { dashboardId: string; widgetId: string }) =>
      requestJson<DashboardDto>(
        getApiUrl(`/projects/${projectId}/dashboards/${dashboardId}/widgets/${widgetId}`),
        { method: 'DELETE' },
      ),
    onSuccess: dashboard =>
      client.setQueryData(key(projectId), (current: { data: DashboardDto[] } | undefined) =>
        replaceDashboard(current, dashboard),
      ),
  });
}
