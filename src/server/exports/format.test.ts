import { describe, expect, test } from 'vitest';
import { csvCell, type ExportDataset, encodeExport, exportFilename } from './format';

const dataset = (count = 2): ExportDataset => ({
  metadata: { exactness: 'exact', range: '[start,end)' },
  columns: ['name', 'value'],
  rows: (async function* () {
    for (let i = 0; i < count; i++)
      yield { name: i === 0 ? '=SUM(A1)' : 'Привет,"world"', value: i };
  })(),
});
async function collect(format: 'csv' | 'json', rows = 2, bytes = 10000) {
  const chunks: Buffer[] = [];
  for await (const chunk of encodeExport(dataset(), format, { rows, bytes })) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

describe('bounded export encoding', () => {
  test.each(['=1', '+cmd', '-1', '@SUM(A1)', '  =1', '\ttext', '\rtext', '\ntext'])(
    'protects CSV formula/control prefix %s',
    value => {
      expect(csvCell(value)).toBe(`"'${value}"`);
    },
  );
  test('quotes embedded separators and preserves Unicode', () => {
    expect(csvCell('Привет,"world"')).toBe('"Привет,""world"""');
  });
  test('JSON contains metadata and original typed values', async () => {
    expect(JSON.parse(await collect('json'))).toEqual({
      metadata: { exactness: 'exact', range: '[start,end)' },
      rows: [
        { name: '=SUM(A1)', value: 0 },
        { name: 'Привет,"world"', value: 1 },
      ],
    });
  });
  test('CSV includes metadata and safe data records', async () => {
    const text = await collect('csv');
    expect(text).toContain('"record_type","metadata","name","value"\r\n');
    expect(text).toContain('"data","","\'=SUM(A1)","0"');
  });
  test('row limit accepts boundary and rejects one beyond', async () => {
    await expect(collect('json', 2)).resolves.toBeTruthy();
    await expect(collect('json', 1)).rejects.toMatchObject({
      code: 'export-row-limit',
      status: 413,
    });
  });
  test('byte limit counts UTF-8 including metadata and closing syntax', async () => {
    const bytes = Buffer.byteLength(await collect('json'));
    await expect(collect('json', 2, bytes)).resolves.toBeTruthy();
    await expect(collect('json', 2, bytes - 1)).rejects.toMatchObject({
      code: 'export-size-limit',
    });
  });
  test('empty data still has valid metadata', async () => {
    const chunks = [];
    for await (const chunk of encodeExport(dataset(0), 'json', { rows: 0, bytes: 1000 }))
      chunks.push(chunk);
    expect(JSON.parse(Buffer.concat(chunks).toString()).rows).toEqual([]);
  });
  test('large generators are consumed lazily', async () => {
    let produced = 0;
    const input = {
      ...dataset(),
      rows: (async function* () {
        while (produced < 100_000) {
          produced++;
          yield { name: 'x', value: produced };
        }
      })(),
    };
    const generator = encodeExport(input, 'json', { rows: 100_000, bytes: 10_000_000 });
    await generator.next();
    expect(produced).toBe(0);
    await generator.next();
    expect(produced).toBe(1);
    await generator.return(undefined);
  });
  test('filename cannot inject headers or paths', () => {
    expect(
      exportFilename(
        '../A\r\n"/B',
        {
          version: 1,
          format: 'csv',
          allRows: false,
          source: { kind: 'users', list: { limit: 50, sort: 'lastSeenAt', direction: 'desc' } },
        },
        new Date('2026-09-08'),
      ),
    ).toBe('A-B-users-2026-09-08.csv');
  });
});
