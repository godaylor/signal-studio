'use client';

import { useState } from 'react';
import { useProjectAccess } from '@/features/access/useProjectAccess';
import { useStudioLocale } from '@/features/i18n/useStudioLocale';
import { AccessibleDialog } from '@/features/studio-shell/AccessibleDialog';
import type { ExportDefinition, ExportStatus } from '@/server/exports/contracts';
import styles from './ExportControls.module.css';
import { useExports } from './useExports';

export function ExportControls({
  projectId,
  source,
  disabled = false,
  className,
}: {
  projectId: string;
  source: ExportDefinition['source'];
  disabled?: boolean;
  className?: string;
}) {
  const { locale, t } = useStudioLocale();
  const access = useProjectAccess(projectId);
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [allRows, setAllRows] = useState(false);
  const exports = useExports(projectId, open && !!access.data?.capabilities.exportData);
  const error = exports.create.error ?? exports.download.error ?? exports.cancel.error;
  const labels: Record<ExportStatus, string> = {
    queued: t('Queued', 'В очереди'),
    running: t('Preparing', 'Подготовка'),
    completed: t('Ready', 'Готово'),
    failed: t('Failed', 'Ошибка'),
    expired: t('Expired', 'Срок истёк'),
    cancelled: t('Cancelled', 'Отменено'),
  };
  if (!access.data?.capabilities.exportData) return null;
  return (
    <>
      <button
        type="button"
        className={className ?? styles.button}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        {t('Export', 'Экспорт')}
      </button>
      <AccessibleDialog
        open={open}
        onClose={() => setOpen(false)}
        title={t('Export data', 'Экспорт данных')}
        description={t(
          'Download the results with your current filters.',
          'Скачайте результаты с выбранными фильтрами.',
        )}
      >
        <div className={styles.content}>
          <label>
            {t('File format', 'Формат файла')}{' '}
            <select
              value={format}
              onChange={event => setFormat(event.target.value as 'csv' | 'json')}
            >
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
            </select>
          </label>
          {source.kind !== 'analysis' ? (
            <label>
              <input
                type="checkbox"
                checked={allRows}
                onChange={event => setAllRows(event.target.checked)}
              />{' '}
              {t('All matching rows', 'Все строки по фильтрам')}
            </label>
          ) : null}
          <details className={styles.definition}>
            <summary>{t('File limits and availability', 'Ограничения и срок хранения')}</summary>
            <p>
              {t(
                'Small exports download immediately. Larger exports run in the background and expire one hour after the request. File size and row limits depend on this deployment. Narrow the period or filters if a limit is reached.',
                'Небольшие файлы скачиваются сразу. Большие экспорты готовятся в фоне и доступны в течение часа после запроса. Ограничения объёма и числа строк зависят от размещения. Если достигнут лимит, сократите период или уточните фильтры.',
              )}
            </p>
            <p>
              {t(
                'The applied filters and metric definitions are preserved. Download access follows your current permissions.',
                'Применённые фильтры и определения метрик сохраняются. Для скачивания нужны текущие права доступа.',
              )}
            </p>
          </details>
          <button
            type="button"
            className={styles.primaryButton}
            aria-disabled={exports.create.isPending}
            onClick={() =>
              !exports.create.isPending &&
              exports.create.mutate({
                version: 1,
                source,
                format,
                allRows,
                idempotencyKey: crypto.randomUUID(),
              })
            }
          >
            {exports.create.isPending
              ? t('Preparing…', 'Подготовка…')
              : t('Export data', 'Экспортировать данные')}
          </button>
          {exports.create.isSuccess ? (
            <p role="status">
              {exports.create.data
                ? t(
                    'Export queued. Keep this dialog open to follow progress.',
                    'Экспорт в очереди. Здесь можно следить за готовностью.',
                  )
                : t('Download started.', 'Скачивание началось.')}
            </p>
          ) : null}
          {error ? (
            <p role="alert">
              {t(
                'Export failed. Check permissions, limits, and retry.',
                'Экспорт не выполнен. Проверьте права, ограничения и повторите.',
              )}{' '}
              <code>{error.message}</code>
            </p>
          ) : null}
          <h3>{t('Recent exports', 'Недавние экспорты')}</h3>
          {exports.jobs.isPending ? (
            <p role="status">{t('Loading…', 'Загрузка…')}</p>
          ) : exports.jobs.error ? (
            <p role="alert">
              {t('Jobs unavailable.', 'Задания недоступны.')}{' '}
              <button type="button" onClick={() => exports.jobs.refetch()}>
                {t('Retry', 'Повторить')}
              </button>
            </p>
          ) : !exports.jobs.data?.length ? (
            <p>{t('No background exports yet.', 'Фоновых экспортов пока нет.')}</p>
          ) : (
            <ul className={styles.jobs}>
              {exports.jobs.data.map(job => (
                <li key={job.id}>
                  <strong>{job.filename}</strong>
                  <span>
                    {labels[job.status]} · {job.rowCount.toLocaleString(locale)}{' '}
                    {t('rows', 'строк')}
                  </span>
                  <span>
                    {t('Expires', 'Срок до')}: {new Date(job.expiresAt).toLocaleString(locale)}
                  </span>
                  {job.errorCode ? <code>{job.errorCode}</code> : null}
                  {job.errorCode === 'export-storage-capacity' ? (
                    <p>
                      {t(
                        'Export storage is temporarily full. Existing downloads remain available until expiry. Try again after they expire.',
                        'Хранилище экспортов временно заполнено. Готовые файлы доступны до истечения срока. Повторите после их удаления по сроку.',
                      )}
                    </p>
                  ) : null}
                  {['export-size-limit', 'export-row-limit', 'export-time-limit'].includes(
                    job.errorCode ?? '',
                  ) ? (
                    <p>
                      {t(
                        'This export is too large. Narrow the date range or audience filters and export each part separately.',
                        'Экспорт слишком большой. Сократите период или уточните фильтры аудитории и выгрузите данные частями.',
                      )}
                    </p>
                  ) : null}
                  {job.status === 'completed' ? (
                    <button
                      type="button"
                      disabled={exports.download.isPending}
                      onClick={() => exports.download.mutate(job.id)}
                    >
                      {t('Download', 'Скачать')} {job.filename}
                    </button>
                  ) : null}
                  {job.status === 'queued' || job.status === 'running' ? (
                    <button
                      type="button"
                      disabled={exports.cancel.isPending}
                      onClick={() => exports.cancel.mutate(job.id)}
                    >
                      {t('Cancel export', 'Отменить экспорт')} {job.filename}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </AccessibleDialog>
    </>
  );
}
