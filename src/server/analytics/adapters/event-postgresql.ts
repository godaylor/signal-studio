import prisma from '@/lib/prisma';
import type { PrismaClient } from '@/generated/prisma/client';
import type { AnalysisQueryV1, AnalysisRows } from '../contracts';

// Signal Studio's event-count executor. One fact is one stored custom event;
// identity memberships never fan out an event. Values are bound parameters.
const fields = {
  eventName: 'e.event_name',
  urlPath: 'e.url_path',
  browser: 's.browser',
  os: 's.os',
  device: 's.device',
  country: 's.country',
} as const;

export function buildEventStatement(query: AnalysisQueryV1) {
  const values: unknown[] = [];
  const bind = (value: unknown) => {
    values.push(value);
    return `$${values.length}`;
  };
  const project = bind(query.projectId);
  const conditions = [
    `e.website_id = ${project}::uuid`,
    'e.event_type = 2',
    `e.created_at >= ${bind(new Date(query.range.startAt))}`,
    `e.created_at < ${bind(new Date(query.range.endAt))}`,
  ];
  if (query.measure.key !== '*') conditions.push(`e.event_name = ${bind(query.measure.key)}`);
  const filters = query.filters.map(filter => {
    const column = `coalesce(${fields[filter.field]}, '')`;
    const value = bind(filter.value);
    switch (filter.operator) {
      case 'equals':
        return `${column} = ${value}`;
      case 'notEquals':
        return `${column} <> ${value}`;
      case 'contains':
        return `strpos(lower(${column}), lower(${value})) > 0`;
      case 'doesNotContain':
        return `strpos(lower(${column}), lower(${value})) = 0`;
      default:
        throw new Error('Unsupported event filter operator');
    }
  });
  if (filters.length)
    conditions.push(`(${filters.join(query.match === 'all' ? ' AND ' : ' OR ')})`);
  const usesSession = [...query.filters.map(filter => filter.field), query.breakdown?.field].some(
    field => field && ['browser', 'os', 'device', 'country'].includes(field),
  );
  const label =
    query.mode === 'trend'
      ? `to_char(date_trunc(${bind(query.range.unit)}, e.created_at at time zone ${bind(query.range.timezone)}), ${bind(query.range.timezone === 'UTC' ? 'YYYY-MM-DD"T"HH24:MI:SS"Z"' : 'YYYY-MM-DD HH24:MI:SS')})`
      : `coalesce(${fields[query.breakdown!.field]}, '(not set)')`;
  const sql = `select ${label} as label, count(*) as value
    from website_event e
    ${usesSession ? 'join session s on s.website_id = e.website_id and s.session_id = e.session_id' : ''}
    where ${conditions.join(' AND ')}
    group by 1
    order by ${query.mode === 'trend' ? 'label asc' : 'value desc, label asc'}
    limit ${bind(query.mode === 'trend' ? 900 : query.breakdown!.limit)}`;
  return { sql, values };
}

export async function executeEventPostgresql(query: AnalysisQueryV1): Promise<AnalysisRows> {
  const { sql, values } = buildEventStatement(query);
  const db = (
    '$primary' in prisma.client ? prisma.client.$primary() : prisma.client
  ) as PrismaClient;
  const rows = await db.$transaction(
    async tx => {
      await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '15s'");
      return tx.$queryRawUnsafe<Array<{ label: string; value: bigint }>>(sql, ...values);
    },
    { timeout: 20_000 },
  );
  return query.mode === 'trend'
    ? rows.map(row => ({ bucket: row.label, value: Number(row.value) }))
    : rows.map(row => ({ key: row.label, value: Number(row.value) }));
}
