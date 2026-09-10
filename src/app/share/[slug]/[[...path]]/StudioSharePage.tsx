'use client';
import { useLocale, useShare } from '@/components/hooks';

const copy = {
  'ru-RU': {
    publicView: 'Публичный просмотр',
    updated: 'Обновлено',
    expires: 'Ссылка действует до',
    noData: 'Для этого представления пока нет данных.',
    note: 'Заметка',
  },
  'en-US': {
    publicView: 'Public view',
    updated: 'Updated',
    expires: 'Link expires',
    noData: 'There is no data for this view yet.',
    note: 'Note',
  },
} as const;

function ResultTable({ result, noData }: { result: any; noData: string }) {
  const rows = Array.isArray(result?.data?.rows) ? result.data.rows : [];
  const columns: string[] = Array.from(
    new Set<string>(rows.flatMap((row: Record<string, unknown>) => Object.keys(row))),
  ).slice(0, 12);
  if (!rows.length || !columns.length) return <p>{noData}</p>;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {columns.map(column => (
              <th
                key={column}
                scope="col"
                style={{ padding: 10, textAlign: 'left', borderBottom: '1px solid #d7dce2' }}
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 100).map((row: Record<string, unknown>, index: number) => (
            <tr key={index}>
              {columns.map(column => (
                <td key={column} style={{ padding: 10, borderBottom: '1px solid #eef0f3' }}>
                  {row[column] == null ? '—' : String(row[column])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StudioSharePage() {
  const share = useShare();
  const { locale, saveLocale } = useLocale();
  const activeLocale = locale === 'en-US' ? 'en-US' : 'ru-RU';
  const t = copy[activeLocale];
  const resource = share.resource as any;
  const date = (value?: string) =>
    value
      ? new Intl.DateTimeFormat(activeLocale, { dateStyle: 'medium', timeStyle: 'short' }).format(
          new Date(value),
        )
      : '—';

  return (
    <main style={{ maxWidth: 1180, margin: '0 auto', padding: '32px 20px 64px' }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 24,
          alignItems: 'flex-start',
          marginBottom: 32,
        }}
      >
        <div>
          <div
            style={{
              color: '#52606d',
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '.06em',
              textTransform: 'uppercase',
            }}
          >
            Signal Studio · {t.publicView}
          </div>
          <h1 style={{ margin: '8px 0', fontSize: 'clamp(2rem, 5vw, 3.5rem)', lineHeight: 1.05 }}>
            {resource.title}
          </h1>
          {resource.description ? (
            <p style={{ maxWidth: 720, color: '#52606d' }}>{resource.description}</p>
          ) : null}
        </div>
        <div
          aria-label={activeLocale === 'en-US' ? 'Language' : 'Язык'}
          style={{ display: 'flex', gap: 8 }}
        >
          {(['ru-RU', 'en-US'] as const).map(value => (
            <button
              key={value}
              type="button"
              aria-pressed={activeLocale === value}
              onClick={() => saveLocale(value)}
            >
              {value === 'ru-RU' ? 'RU' : 'EN'}
            </button>
          ))}
        </div>
      </header>

      {resource.type === 'insight' ? (
        <section aria-label={resource.title}>
          <ResultTable result={resource.result} noData={t.noData} />
        </section>
      ) : (
        <div style={{ display: 'grid', gap: 20 }}>
          {(resource.widgets ?? []).map((widget: any) => (
            <section
              key={widget.id}
              style={{ border: '1px solid #d7dce2', borderRadius: 12, padding: 20 }}
            >
              <h2 style={{ marginTop: 0 }}>{widget.title || widget.insight?.title || t.note}</h2>
              {widget.kind === 'insight' ? (
                <ResultTable result={widget.insight?.result} noData={t.noData} />
              ) : (
                <p>{widget.body}</p>
              )}
            </section>
          ))}
        </div>
      )}

      <footer style={{ marginTop: 36, color: '#52606d', fontSize: 13 }}>
        {t.updated}: {date(resource.updatedAt)} · {t.expires}: {date(share.expiresAt)}
      </footer>
    </main>
  );
}
