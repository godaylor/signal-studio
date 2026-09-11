import { describe, expect, test, vi } from 'vitest';
import { normalizeAnalysisQuery } from '../normalize';
import { validAnalysisQuery } from '../test-fixtures';
import { buildEventStatement } from './event-postgresql';
import { postgresqlAnalysisAdapter } from './postgresql';

const { read } = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  default: {
    client: {
      $transaction: (fn: (tx: unknown) => unknown) =>
        fn({ $executeRawUnsafe: vi.fn(), $queryRawUnsafe: read }),
    },
  },
}));

describe('independent PostgreSQL event analytics', () => {
  test('binds event names, literal filters, timezone and half-open bounds', () => {
    const query = normalizeAnalysisQuery(
      validAnalysisQuery({
        filters: [{ field: 'urlPath', operator: 'contains', value: "%' OR true --" }],
      }),
    );
    const statement = buildEventStatement(query);
    expect(statement.sql).not.toContain("%' OR true --");
    expect(statement.values).toContain("%' OR true --");
    expect(statement.sql).toContain('strpos(');
    expect(statement.sql).toMatch(/created_at >= \$\d+/);
    expect(statement.sql).toMatch(/created_at < \$\d+/);
    expect(statement.values).toContainEqual(new Date(query.range.endAt));
    expect(statement.sql).not.toContain('join session');
  });
  test('bounds breakdowns and joins session dimensions without identity fanout', async () => {
    const query = normalizeAnalysisQuery(
      validAnalysisQuery({
        mode: 'breakdown',
        breakdown: { field: 'browser', limit: 20 },
        visualization: 'table',
      }),
    );
    const statement = buildEventStatement(query);
    expect(statement.sql).toContain('s.website_id = e.website_id');
    expect(statement.sql).not.toContain('account_membership');
    expect(statement.values.at(-1)).toBe(20);
    read.mockResolvedValue([{ label: 'Chrome', value: 4n }]);
    expect((await postgresqlAnalysisAdapter.execute(query)).rows).toEqual([
      { key: 'Chrome', value: 4 },
    ]);
  });
  test('keeps a selected event outside OR filters and maps trend values', async () => {
    const query = normalizeAnalysisQuery(
      validAnalysisQuery({
        match: 'any',
        filters: [
          { field: 'browser', operator: 'equals', value: 'Chrome' },
          { field: 'country', operator: 'equals', value: 'US' },
        ],
      }),
    );
    const statement = buildEventStatement(query);
    expect(statement.sql).toMatch(/e.event_name = \$\d+ AND \(.+ OR .+\)/);
    read.mockResolvedValue([{ label: '2026-03-07 00:00:00', value: 2n }]);
    expect((await postgresqlAnalysisAdapter.execute(query)).rows).toEqual([
      { bucket: '2026-03-07 00:00:00', value: 2 },
    ]);
  });
});
