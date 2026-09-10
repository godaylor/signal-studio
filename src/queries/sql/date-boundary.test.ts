import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

const querySources = [
  {
    path: 'src/queries/sql/getWebsiteStats.ts',
    postgresStarts: 3,
    postgresEnds: 3,
    clickhouseRanges: 3,
  },
  {
    path: 'src/queries/sql/reports/getFunnel.ts',
    postgresStarts: 2,
    postgresEnds: 3,
    clickhouseRanges: 2,
  },
  {
    path: 'src/queries/sql/reports/getRetention.ts',
    postgresStarts: 2,
    postgresEnds: 2,
    clickhouseRanges: 2,
  },
];

describe('core analytics SQL half-open boundaries', () => {
  test.each(querySources)('$path uses only exclusive selected-range ends', definition => {
    const source = readFileSync(resolve(process.cwd(), definition.path), 'utf8');
    const postgresStarts = source.match(/created_at\s*>=\s*\{\{startDate\}\}/gi) ?? [];
    const postgresEnds = source.match(/created_at\s*<\s*\{\{endDate\}\}/gi) ?? [];
    const clickhouseStarts = source.match(/created_at\s*>=\s*\{startDate:DateTime64\}/gi) ?? [];
    const clickhouseEnds = source.match(/created_at\s*<\s*\{endDate:DateTime64\}/gi) ?? [];

    expect(source).not.toMatch(/created_at\s+between\s+\{\{startDate\}\}\s+and\s+\{\{endDate\}\}/i);
    expect(source).not.toMatch(
      /created_at\s+between\s+\{startDate:DateTime64\}\s+and\s+\{endDate:DateTime64\}/i,
    );
    expect(source).not.toMatch(/created_at\s*<=\s*\{\{endDate\}\}/i);
    expect(source).not.toMatch(/created_at\s*<=\s*\{endDate:DateTime64\}/i);
    expect(postgresStarts).toHaveLength(definition.postgresStarts);
    expect(postgresEnds).toHaveLength(definition.postgresEnds);
    expect(clickhouseStarts).toHaveLength(definition.clickhouseRanges);
    expect(clickhouseEnds).toHaveLength(definition.clickhouseRanges);
  });
});
