'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getApiUrl } from '@/lib/api-url';
import { getClientAuthToken } from '@/lib/client';
import type {
  CapabilityOverrides,
  StudioCapabilities,
  StudioRole,
} from '@/server/permissions/capabilities';

export interface ProjectAccessDto {
  projectId: string;
  workspaceId: string;
  studioRole: StudioRole;
  capabilities: StudioCapabilities;
  permissionScope: string;
  isSystemAdmin: boolean;
  isDirectOwner: boolean;
}

export interface WorkspaceMemberDto {
  id: string;
  user: { id: string; username: string; displayName: string | null };
  studioRole: StudioRole;
  legacyRole: string;
  capabilityOverrides: CapabilityOverrides;
  capabilities: StudioCapabilities;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface StudioShareDto {
  id: string;
  projectId: string;
  resourceId: string;
  resourceType: 'insight' | 'dashboard';
  name: string;
  visibility: 'internal' | 'public';
  slug: string;
  scope: {
    version: 1;
    includeDefinitions: true;
    includeAggregateData: true;
    allowDrilldown: false;
    allowIdentity: false;
    allowSensitiveTraits: false;
    allowReplay: false;
  };
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

async function requestJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      authorization: `Bearer ${getClientAuthToken()}`,
      'content-type': 'application/json',
      ...init.headers,
    },
  });
  const payload = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(payload?.error?.message ?? 'Access request failed.');
  return payload as T;
}

const accessKey = (projectId: string) => ['studio-access', projectId] as const;
const membersKey = (projectId: string) => ['studio-members', projectId] as const;
const sharesKey = (projectId: string) => ['studio-shares', projectId] as const;

export function useProjectAccess(projectId: string, enabled = true) {
  return useQuery({
    queryKey: accessKey(projectId),
    queryFn: ({ signal }) =>
      requestJson<{ data: ProjectAccessDto }>(getApiUrl(`/projects/${projectId}/access`), {
        signal,
      }).then(response => response.data),
    enabled: enabled && Boolean(projectId),
    staleTime: 30_000,
  });
}

export function useWorkspaceMembers(projectId: string, enabled = true) {
  return useQuery({
    queryKey: membersKey(projectId),
    queryFn: ({ signal }) =>
      requestJson<{ data: WorkspaceMemberDto[]; limit: number }>(
        getApiUrl(`/projects/${projectId}/members?limit=100`),
        { signal },
      ),
    enabled: enabled && Boolean(projectId),
    staleTime: 15_000,
  });
}

export function useCreateWorkspaceMember(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      username: string;
      studioRole: Exclude<StudioRole, 'owner'>;
      capabilityOverrides?: CapabilityOverrides;
    }) =>
      requestJson<{ data: WorkspaceMemberDto }>(getApiUrl(`/projects/${projectId}/members`), {
        method: 'POST',
        body: JSON.stringify(input),
      }).then(response => response.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: membersKey(projectId) }),
  });
}

export function useUpdateWorkspaceMember(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      memberId,
      patch,
    }: {
      memberId: string;
      patch: {
        studioRole?: Exclude<StudioRole, 'owner'>;
        capabilityOverrides?: CapabilityOverrides;
      };
    }) =>
      requestJson<{ data: WorkspaceMemberDto }>(
        getApiUrl(`/projects/${projectId}/members/${memberId}`),
        { method: 'PATCH', body: JSON.stringify(patch) },
      ).then(response => response.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: membersKey(projectId) }),
  });
}

export function useDeleteWorkspaceMember(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) =>
      requestJson<void>(getApiUrl(`/projects/${projectId}/members/${memberId}`), {
        method: 'DELETE',
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: membersKey(projectId) }),
  });
}

export function useStudioShares(projectId: string, enabled = true) {
  return useQuery({
    queryKey: sharesKey(projectId),
    queryFn: ({ signal }) =>
      requestJson<{ data: StudioShareDto[]; limit: number }>(
        getApiUrl(`/projects/${projectId}/shares`),
        { signal },
      ),
    enabled: enabled && Boolean(projectId),
    staleTime: 15_000,
  });
}

export function useCreateStudioShare(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      resourceType: 'insight' | 'dashboard';
      resourceId: string;
      name: string;
      visibility: 'internal' | 'public';
      expiresAt: string;
    }) =>
      requestJson<{ data: StudioShareDto }>(getApiUrl(`/projects/${projectId}/shares`), {
        method: 'POST',
        body: JSON.stringify(input),
      }).then(response => response.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sharesKey(projectId) }),
  });
}

export function useRevokeStudioShare(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (shareId: string) =>
      requestJson<{ data: StudioShareDto }>(
        getApiUrl(`/projects/${projectId}/shares/${shareId}`),
        { method: 'DELETE' },
      ).then(response => response.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sharesKey(projectId) }),
  });
}
