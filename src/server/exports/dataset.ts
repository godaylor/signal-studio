import type prisma from '@/lib/prisma';
import { analysisQueryService } from '@/server/analytics/query-service';
import { listTrackedAccounts, listTrackedUsers } from '@/server/identities/read-service';
import type { requireExportAccess } from './access';
import type { ExportDefinition } from './contracts';
import type { ExportDataset, ExportRow } from './format';

type Access = Awaited<ReturnType<typeof requireExportAccess>>;
const analysisColumns = [
  'series',
  'kind',
  'bucket',
  'key',
  'label',
  'step',
  'segment',
  'value',
  'entrants',
  'converted',
  'dropped',
  'stepConversionRate',
  'overallConversionRate',
  'conversionRate',
  'cohortStart',
  'period',
  'cohortSize',
  'retained',
  'retentionRate',
];
const identityColumns = [
  'id',
  'lifecycleStage',
  'definitionVersion',
  'activatedAt',
  'firstSeenAt',
  'lastSeenAt',
  'traits',
  'accountId',
  'memberCount',
];

export async function exportDataset(
  definition: ExportDefinition,
  access: Access,
  requestId: string,
  client?: Pick<typeof prisma.client, 'trackedUser' | 'trackedAccount'>,
): Promise<ExportDataset> {
  const source = definition.source;
  const metadata = {
    version: 1,
    projectId: access.projectId,
    generatedAt: new Date().toISOString(),
    permissionScope: access.permissionScope,
    definition,
  };
  if (source.kind === 'analysis') {
    const result = await analysisQueryService.execute({
      query: source.query,
      projectId: access.projectId,
      tenantId: access.workspaceId ?? access.projectId,
      permissionScope: access.permissionScope,
      requestId,
    });
    return {
      metadata: {
        ...metadata,
        generatedAt: result.generatedAt,
        freshnessAt: result.freshnessAt,
        exactness: result.exactness,
        definitions: result.definitions,
        warnings: result.warnings ?? [],
        ...(result.data.total ? { total: result.data.total } : {}),
        ...(result.data.comparisonTotal ? { comparisonTotal: result.data.comparisonTotal } : {}),
      },
      columns: analysisColumns,
      rows: (async function* () {
        for (const row of result.data.rows) yield { series: 'primary', ...row };
        for (const row of result.data.comparison ?? []) yield { series: 'comparison', ...row };
      })(),
    };
  }
  const sensitive = access.capabilities.viewSensitiveTraits;
  const columns = [
    ...identityColumns,
    ...(sensitive ? ['externalId', 'displayName', 'sensitiveTraits'] : []),
  ];
  return {
    metadata: {
      ...metadata,
      exactness: 'exact',
      consistency: definition.allRows
        ? 'repeatable-read snapshot at worker execution'
        : 'visible page at request time',
    },
    columns,
    rows: (async function* () {
      let cursor = definition.allRows ? undefined : source.list.cursor;
      let emitted = 0;
      const visibleRows = source.visibleRows ?? source.list.limit;
      do {
        const list = source.kind === 'users' ? listTrackedUsers : listTrackedAccounts;
        const page = await list(
          {
            ...source.list,
            projectId: access.projectId,
            scope: access.permissionScope,
            cursor,
            limit: definition.allRows ? 100 : Math.min(100, visibleRows - emitted),
          },
          client,
        );
        for (const item of page.data) {
          const row: ExportRow = Object.fromEntries(
            identityColumns.map(column => [column, item[column] ?? null]),
          );
          row.accountId = item.membership?.account?.id ?? null;
          row.memberCount = item._count?.memberships ?? null;
          if (sensitive) {
            row.externalId = item.externalId;
            row.displayName = item.displayName ?? item.name;
            row.sensitiveTraits = item.sensitiveTraits;
          }
          yield row;
          emitted++;
        }
        cursor = page.nextCursor ?? undefined;
      } while (cursor && (definition.allRows || emitted < visibleRows));
    })(),
  };
}
