import { randomUUID } from 'node:crypto';
import type { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import type { InsightDto } from '@/server/insights/insight-service';
import { toInsightDto } from '@/server/insights/insight-service';
import type { InsightAccess } from '@/server/permissions/insights';
import type { DashboardGlobalContext } from './context';
import { DASHBOARD_WIDGET_LIMIT } from './contracts';

export class DashboardNotFoundError extends Error {}
export class DashboardForbiddenError extends Error {}
export class DashboardLimitError extends Error {}
export class DashboardInsightError extends Error {}

export interface DashboardWidgetDto {
  id: string;
  dashboardId: string;
  kind: 'insight' | 'note' | 'header';
  insightId: string | null;
  insight: InsightDto | null;
  title: string;
  body: string;
  position: number;
  width: number;
  height: number;
}

export interface DashboardDto {
  id: string;
  projectId: string;
  owner: { id: string; username: string };
  title: string;
  description: string;
  globalContext: DashboardGlobalContext;
  sharePolicy: Record<string, unknown>;
  canEdit: boolean;
  widgets: DashboardWidgetDto[];
  createdAt: string;
  updatedAt: string;
}

function objectValue(value: Prisma.JsonValue): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toDashboardDto(record: any, access: InsightAccess): DashboardDto {
  return {
    id: record.id,
    projectId: record.projectId,
    owner: record.owner,
    title: record.title,
    description: record.description,
    globalContext: objectValue(record.globalContext) as DashboardGlobalContext,
    sharePolicy: objectValue(record.sharePolicy),
    canEdit: canMutateDashboard(access, record.ownerId),
    widgets: (record.widgets ?? []).map((widget: any) => ({
      id: widget.id,
      dashboardId: widget.dashboardId,
      kind: widget.kind,
      insightId: widget.insightId,
      insight: widget.insight ? toInsightDto(widget.insight) : null,
      title: widget.title,
      body: widget.body,
      position: widget.position,
      width: widget.width,
      height: widget.height,
    })),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

const dashboardInclude: Prisma.StudioDashboardInclude = {
  owner: { select: { id: true, username: true } },
  widgets: {
    orderBy: [{ position: 'asc' as const }, { id: 'asc' as const }],
    include: {
      insight: {
        include: {
          owner: { select: { id: true, username: true } },
          _count: { select: { dashboardWidgets: true } },
        },
      },
    },
  },
};

export async function listDashboards(access: InsightAccess) {
  const records = await prisma.client.studioDashboard.findMany({
    where: { projectId: access.projectId },
    include: dashboardInclude,
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    take: 50,
  });
  return records.map(record => toDashboardDto(record, access));
}

export async function getDashboard(access: InsightAccess, dashboardId: string) {
  const record = await prisma.client.studioDashboard.findFirst({
    where: { id: dashboardId, projectId: access.projectId },
    include: dashboardInclude,
  });
  if (!record) throw new DashboardNotFoundError('Dashboard was not found.');
  return toDashboardDto(record, access);
}

export async function createDashboard({
  access,
  title,
  description = '',
}: {
  access: InsightAccess;
  title: string;
  description?: string;
}) {
  if (!(access.canEditDashboards ?? access.canCreate))
    throw new DashboardForbiddenError('This role cannot create dashboards.');
  const record = await prisma.client.studioDashboard.create({
    data: {
      id: randomUUID(),
      projectId: access.projectId,
      ownerId: access.actorUserId,
      title,
      description,
      globalContext: {},
      sharePolicy: { mode: 'private', version: 1 },
    },
    include: dashboardInclude,
  });
  return toDashboardDto(record, access);
}

async function requireDashboardWrite(access: InsightAccess, dashboardId: string) {
  const dashboard = await prisma.client.studioDashboard.findFirst({
    where: { id: dashboardId, projectId: access.projectId },
    select: { id: true, ownerId: true },
  });
  if (!dashboard) throw new DashboardNotFoundError('Dashboard was not found.');
  if (!canMutateDashboard(access, dashboard.ownerId)) {
    throw new DashboardForbiddenError('This role cannot edit this dashboard.');
  }
  return dashboard;
}

export async function updateDashboard({
  access,
  dashboardId,
  title,
  description,
  globalContext,
}: {
  access: InsightAccess;
  dashboardId: string;
  title?: string;
  description?: string;
  globalContext?: DashboardGlobalContext;
}) {
  await requireDashboardWrite(access, dashboardId);
  const record = await prisma.client.studioDashboard.update({
    where: { id: dashboardId },
    data: {
      ...(title !== undefined ? { title } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(globalContext !== undefined
        ? { globalContext: globalContext as Prisma.InputJsonValue }
        : {}),
    },
    include: dashboardInclude,
  });
  return toDashboardDto(record, access);
}

export async function addDashboardWidget({
  access,
  dashboardId,
  kind,
  insightId,
  title = '',
  body = '',
}: {
  access: InsightAccess;
  dashboardId: string;
  kind: 'insight' | 'note' | 'header';
  insightId?: string;
  title?: string;
  body?: string;
}) {
  await requireDashboardWrite(access, dashboardId);
  const count = await prisma.client.studioDashboardWidget.count({ where: { dashboardId } });
  if (count >= DASHBOARD_WIDGET_LIMIT) {
    throw new DashboardLimitError(`Dashboards support at most ${DASHBOARD_WIDGET_LIMIT} widgets.`);
  }
  if (kind === 'insight') {
    if (!insightId) throw new DashboardInsightError('Choose an active Insight from this project.');
    const insight = await prisma.client.insight.findFirst({
      where: { id: insightId, projectId: access.projectId, status: 'active' },
      select: { id: true },
    });
    if (!insight) throw new DashboardInsightError('Choose an active Insight from this project.');
  }

  await prisma.client.studioDashboardWidget.create({
    data: {
      id: randomUUID(),
      dashboardId,
      insightId: kind === 'insight' ? insightId : null,
      kind,
      title,
      body,
      position: count,
      width: kind === 'header' ? 3 : 1,
      height: 1,
    },
  });
  return getDashboard(access, dashboardId);
}

export async function updateDashboardWidget({
  access,
  dashboardId,
  widgetId,
  position,
  ...patch
}: {
  access: InsightAccess;
  dashboardId: string;
  widgetId: string;
  position?: number;
  title?: string;
  body?: string;
  width?: number;
  height?: number;
}) {
  await requireDashboardWrite(access, dashboardId);
  const widgets = await prisma.client.studioDashboardWidget.findMany({
    where: { dashboardId },
    orderBy: [{ position: 'asc' }, { id: 'asc' }],
    select: { id: true },
  });
  const currentIndex = widgets.findIndex(widget => widget.id === widgetId);
  if (currentIndex < 0) {
    throw new DashboardNotFoundError('Dashboard widget was not found.');
  }
  const ordered = widgets.map(widget => widget.id).filter(id => id !== widgetId);
  ordered.splice(Math.min(position ?? currentIndex, ordered.length), 0, widgetId);
  const operations = ordered.map((id, index) =>
    prisma.client.studioDashboardWidget.update({
      where: { id },
      data: {
        position: index,
        ...(id === widgetId ? patch : {}),
      },
    }),
  );
  await prisma.transaction(operations);
  return getDashboard(access, dashboardId);
}

export async function removeDashboardWidget(
  access: InsightAccess,
  dashboardId: string,
  widgetId: string,
) {
  await requireDashboardWrite(access, dashboardId);
  const widget = await prisma.client.studioDashboardWidget.findFirst({
    where: { id: widgetId, dashboardId },
    select: { id: true },
  });
  if (!widget) throw new DashboardNotFoundError('Dashboard widget was not found.');
  await prisma.client.studioDashboardWidget.delete({ where: { id: widgetId } });
  const remaining = await prisma.client.studioDashboardWidget.findMany({
    where: { dashboardId },
    orderBy: [{ position: 'asc' }, { id: 'asc' }],
    select: { id: true },
  });
  await prisma.transaction(
    remaining.map((item, position) =>
      prisma.client.studioDashboardWidget.update({ where: { id: item.id }, data: { position } }),
    ),
  );
  return getDashboard(access, dashboardId);
}
function canMutateDashboard(access: InsightAccess, ownerId: string) {
  const canEdit = access.canEditDashboards ?? access.canCreate;
  return access.canManageAll || (canEdit && ownerId === access.actorUserId);
}
