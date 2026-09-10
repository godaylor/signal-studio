'use client';
import { useQuery } from '@tanstack/react-query';
import { requestJson } from '@/features/explore/useAnalysisQuery';
import { useStudioLocale } from '@/features/i18n/useStudioLocale';
import { getApiUrl } from '@/lib/api-url';
import type { operationSnapshot } from '@/server/operations/telemetry';
type Snapshot = ReturnType<typeof operationSnapshot> & {
  live: Record<string, number>; exports: Array<{ status: string; count: number }>;
};
export function OperationsPanel() {
  const { t, locale } = useStudioLocale();
  const query = useQuery({ queryKey: ['studio-operations'], queryFn: ({ signal }) => requestJson<Snapshot>(getApiUrl('/operations'), { method: 'GET', signal }), staleTime: 15_000 });
  return <details>
    <summary style={{ minHeight: 44, cursor: 'pointer' }}>{t('Runtime operations · administrator', 'Работа сервера · администратор')}</summary>
    <p>{t('Process-local HTTP/query counters since startup; not an event-loss estimate. Durable export status comes from PostgreSQL.', 'Счётчики HTTP/запросов текущего процесса с момента запуска; это не оценка потерь событий. Состояние экспортов хранится в PostgreSQL.')}</p>
    <button type="button" aria-disabled={query.isFetching} onClick={() => { if (!query.isFetching) query.refetch(); }}>{t('Refresh operations', 'Обновить показатели сервера')}</button>
    {query.isPending ? <p role="status">{t('Loading operations…', 'Загружаем показатели…')}</p> : query.isError ? <p role="alert">{t('Operations unavailable. Check administrator access and database readiness.', 'Показатели недоступны. Проверьте права администратора и готовность базы.')}</p> : query.data ? <>
      <p>{t('Since', 'С момента')}: {new Date(query.data.startedAt).toLocaleString(locale)}</p>
      <div style={{ overflowX: 'auto' }}><table><caption>{t('HTTP and analysis operations', 'HTTP и аналитические запросы')}</caption><thead><tr><th scope="col">{t('Operation', 'Операция')}</th><th scope="col">{t('Count', 'Количество')}</th><th scope="col">{t('Maximum ms', 'Максимум, мс')}</th></tr></thead><tbody>{Object.entries(query.data.metrics).map(([name, metric]) => <tr key={name}><th scope="row">{name}</th><td>{metric.count.toLocaleString(locale)}</td><td>{Math.round(metric.maxDurationMs).toLocaleString(locale)}</td></tr>)}</tbody></table></div>
      <h2>{t('Live snapshot counters', 'Счётчики актуальных снимков')}</h2><dl>{Object.entries(query.data.live).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value.toLocaleString(locale)}</dd></div>)}</dl>
      <h2>{t('Export queue', 'Очередь экспортов')}</h2><dl>{query.data.exports.map(job => <div key={job.status}><dt>{job.status}</dt><dd>{job.count.toLocaleString(locale)}</dd></div>)}</dl>
    </> : null}
  </details>;
}
