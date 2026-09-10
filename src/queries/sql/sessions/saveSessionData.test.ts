import { beforeEach, describe, expect, test, vi } from 'vitest';
import { DATA_TYPE } from '@/lib/constants';
import { relationalQuery } from './saveSessionData';

const { writeRawQueryMock } = vi.hoisted(() => ({
  writeRawQueryMock: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    writeRawQuery: writeRawQueryMock,
  },
}));

describe('relationalQuery', () => {
  beforeEach(() => {
    writeRawQueryMock.mockReset();
    writeRawQueryMock.mockResolvedValue(undefined);
  });

  test('writes session data with a Postgres upsert keyed by sessionId and dataKey', async () => {
    const createdAt = new Date('2026-07-30T10:00:00.000Z');

    await relationalQuery({
      websiteId: 'website-1',
      sessionId: 'session-1',
      sessionData: { plan: 'pro', seats: 3 },
      distinctId: 'distinct-1',
      createdAt,
    });

    expect(writeRawQueryMock).toHaveBeenCalledTimes(1);

    const [query, params, tag] = writeRawQueryMock.mock.calls[0];

    expect(query).toContain('insert into session_data');
    expect(query).toContain('jsonb_to_recordset({{rows}}::jsonb)');
    expect(query).toContain('on conflict (session_id, data_key)');
    expect(query).toContain('do update set');
    expect(query).toContain('coalesce({{createdAt}}, now())');
    expect(query).toContain('created_at = coalesce({{createdAt}}, session_data.created_at)');
    expect(params).toEqual({
      websiteId: 'website-1',
      sessionId: 'session-1',
      distinctId: 'distinct-1',
      createdAt,
      rows: expect.any(String),
    });
    expect(JSON.parse(params.rows)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          data_key: 'plan',
          string_value: 'pro',
          data_type: DATA_TYPE.string,
        }),
        expect.objectContaining({
          data_key: 'seats',
          number_value: 3,
          data_type: DATA_TYPE.number,
        }),
      ]),
    );
    expect(tag).toBe('saveSessionData');
  });

  test('preserves default and existing createdAt behavior when createdAt is omitted', async () => {
    await relationalQuery({
      websiteId: 'website-1',
      sessionId: 'session-1',
      sessionData: { plan: 'pro' },
      distinctId: 'distinct-1',
    });

    const [query, params] = writeRawQueryMock.mock.calls[0];

    expect(query).toContain('coalesce({{createdAt}}, now())');
    expect(query).toContain('created_at = coalesce({{createdAt}}, session_data.created_at)');
    expect(params.createdAt).toBeUndefined();
  });

  test('does not issue a query for empty flattened input', async () => {
    await relationalQuery({
      websiteId: 'website-1',
      sessionId: 'session-1',
      sessionData: {},
      distinctId: 'distinct-1',
    });

    expect(writeRawQueryMock).not.toHaveBeenCalled();
  });
});
