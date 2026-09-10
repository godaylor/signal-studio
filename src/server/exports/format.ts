import type { ExportDefinition } from './contracts';
import { ExportError } from './contracts';

export type ExportRow = Record<string, unknown>;
export interface ExportDataset {
  metadata: Record<string, unknown>;
  columns: string[];
  rows: AsyncIterable<ExportRow>;
}

export function csvCell(value: unknown): string {
  let text =
    value == null
      ? ''
      : value instanceof Date
        ? value.toISOString()
        : typeof value === 'object'
          ? JSON.stringify(value)
          : String(value);
  // Spreadsheet engines can ignore leading spaces and control characters.
  // biome-ignore lint/suspicious/noControlCharactersInRegex: Deliberately detects spreadsheet-injection prefixes, including C0 controls.
  if (/^[\s\u0000-\u001f]*[=+\-@]/u.test(text) || /^[\t\r\n]/u.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function exportFilename(
  projectName: string,
  definition: ExportDefinition,
  now = new Date(),
) {
  const slug =
    projectName
      .normalize('NFKD')
      .replace(/[^a-zA-Z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 70) || 'project';
  const source = definition.source;
  const name = source.kind === 'analysis' ? source.query.mode : source.kind;
  const dates =
    source.kind === 'analysis'
      ? `${source.query.range.startAt.slice(0, 10)}_${source.query.range.endAt.slice(0, 10)}`
      : now.toISOString().slice(0, 10);
  return `${slug}-${name}-${dates}.${definition.format}`;
}

export async function* encodeExport(
  dataset: ExportDataset,
  format: 'csv' | 'json',
  limits: { rows: number; bytes: number },
  progress = (_rows: number, _bytes: number) => {},
) {
  let bytes = 0;
  let rows = 0;
  function chunk(text: string) {
    const buffer = Buffer.from(text, 'utf8');
    bytes += buffer.length;
    if (bytes > limits.bytes) throw new ExportError('export-size-limit', 413);
    return buffer;
  }
  if (format === 'json') yield chunk(`{"metadata":${JSON.stringify(dataset.metadata)},"rows":[`);
  else {
    yield chunk(['record_type', 'metadata', ...dataset.columns].map(csvCell).join(',') + '\r\n');
    yield chunk(
      ['metadata', dataset.metadata, ...dataset.columns.map(() => '')].map(csvCell).join(',') +
        '\r\n',
    );
  }
  for await (const row of dataset.rows) {
    if (++rows > limits.rows) throw new ExportError('export-row-limit', 413);
    yield chunk(
      format === 'json'
        ? `${rows === 1 ? '' : ','}${JSON.stringify(row)}`
        : ['data', '', ...dataset.columns.map(column => row[column])].map(csvCell).join(',') +
            '\r\n',
    );
    progress(rows, bytes);
  }
  if (format === 'json') yield chunk(']}');
  progress(rows, bytes);
}
