import type { Auth } from '@/lib/types';
import { resolveProjectAccess } from '@/server/permissions/capabilities';
import { projectDataScopeForCapabilities } from '@/server/permissions/project-data';
import { type ExportDefinition, ExportError } from './contracts';
import { exportDb } from './database';

export async function requireExportAccess(
  auth: Auth,
  projectId: string,
  definition?: ExportDefinition,
) {
  const access = await resolveProjectAccess(auth, projectId);
  if (!access?.capabilities.exportData || !access.capabilities.viewAggregate)
    throw new ExportError('export-access-denied', 403);
  const lifecycle = await exportDb.$queryRaw<Array<{ id: string }>>`SELECT id FROM data_lifecycle_job WHERE project_id=${projectId}::uuid AND status IN ('queued','running') LIMIT 1`;
  if (lifecycle.length) throw new ExportError('export-source-maintenance', 409);
  if (definition && definition.source.kind !== 'analysis' && !access.capabilities.viewIdentity)
    throw new ExportError('export-identity-denied', 403);
  return { ...access, permissionScope: projectDataScopeForCapabilities(access.capabilities) };
}

export async function getExportWorkerAuth(
  requesterId: string,
  sessionVersion: number,
): Promise<Auth> {
  const user = await exportDb.user.findFirst({
    where: { id: requesterId, deletedAt: null },
    select: { id: true, username: true, role: true, sessionVersion: true },
  });
  if (!user || user.sessionVersion !== sessionVersion)
    throw new ExportError('export-access-revoked', 403);
  return {
    user: { id: user.id, username: user.username, role: user.role, isAdmin: user.role === 'admin' },
  };
}
