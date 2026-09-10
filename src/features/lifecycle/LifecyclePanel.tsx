'use client';
import { useState } from 'react';
import { useStudioLocale } from '@/features/i18n/useStudioLocale';
import type { LifecycleRequest } from '@/server/lifecycle/contracts';
import { useCreateLifecycle, useLifecycle } from './useLifecycle';
import styles from './LifecyclePanel.module.css';

export function LifecyclePanel({ projectId }: { projectId: string }) {
  const { t, locale } = useStudioLocale();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<LifecycleRequest['category']>('replay');
  const [target, setTarget] = useState<'project' | 'user' | 'account'>('project');
  const [targetId, setTargetId] = useState('');
  const [before, setBefore] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const jobs = useLifecycle(projectId, open);
  const create = useCreateLifecycle(projectId);
  const active = jobs.data?.data.some(job => ['queued', 'running'].includes(job.status));
  const labels = {
    events: t('Events and dependent evidence', 'События и связанное evidence'),
    properties: t('Event/session properties', 'Свойства событий и сессий'),
    replay: t('Replay recordings', 'Записи сессий'),
    heatmaps: t('Heatmap events', 'События тепловых карт'),
    exports: t('Export artifacts', 'Файлы экспорта'),
    all: t('All analytical data and identities', 'Все аналитические данные и идентичности'),
  };
  const statuses: Record<string, string> = {
    queued: t('Queued', 'В очереди'),
    running: t('Running', 'Выполняется'),
    completed: t('Completed', 'Завершено'),
    blocked: t('Blocked — see reason', 'Заблокировано — см. причину'),
    failed: t('Failed — see reason', 'Ошибка — см. причину'),
  };
  return (
    <details className={styles.panel} onToggle={event => setOpen(event.currentTarget.open)}>
      <summary>{t('Data retention and deletion', 'Хранение и удаление данных')}</summary>
      <p>
        {t(
          'Automatic retention is off. Each confirmed request runs once; timestamps use UTC and exclude the cutoff. Identity erasure removes the complete linked history, including shared sessions. Project settings and application logins remain.',
          'Автоматическая очистка выключена. Каждый подтверждённый запрос выполняется один раз; дата указана в UTC и не включается в диапазон. Удаление идентичности очищает всю связанную историю, включая общие сессии. Настройки проекта и учётные записи приложения сохраняются.',
        )}
      </p>
      <p>
        {t(
          'All project exports are invalidated for any erasure. PostgreSQL and owned export files are covered; backups and previously downloaded files require separate operator action. Security audit is retained indefinitely, separately from analytics. Cached results expire within 120 seconds.',
          'Любое удаление аннулирует все экспорты проекта. Охвачены PostgreSQL и собственные файлы экспорта; резервные копии и ранее скачанные файлы требуют отдельного действия оператора. Журнал безопасности хранится бессрочно, отдельно от аналитики. Кэшированные результаты истекают в течение 120 секунд.',
        )}
      </p>
      <form
        className={styles.form}
        onSubmit={event => {
          event.preventDefault();
          if (confirmation !== projectId || active || create.isPending || (target === 'project' && !before)) return;
          create.mutate(
            {
              version: 1,
              idempotencyKey: crypto.randomUUID(),
              confirmProjectId: projectId,
              category: target === 'project' ? category : 'all',
              before: target === 'project' ? new Date(`${before}T00:00:00.000Z`).toISOString() : new Date().toISOString(),
              target: target === 'project' ? { kind: 'project' } : { kind: target, id: targetId },
            },
            { onSuccess: () => setConfirmation('') },
          );
        }}
      >
        <label>
          {t('Scope', 'Область')}
          <select value={target} onChange={e => setTarget(e.target.value as typeof target)}>
            <option value="project">{t('Project retention', 'Очистка проекта по сроку')}</option>
            <option value="user">
              {t('Tracked user erasure', 'Удаление отслеживаемого пользователя')}
            </option>
            <option value="account">
              {t('Tracked account erasure', 'Удаление отслеживаемого аккаунта')}
            </option>
          </select>
        </label>
        {target === 'project' ? (
          <label>
            {t('Category', 'Категория')}
            <select value={category} onChange={e => setCategory(e.target.value as typeof category)}>
              {Object.entries(labels).map(([key, value]) => (
                <option key={key} value={key}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label>
            {t('Tracked entity UUID', 'UUID отслеживаемой сущности')}
            <input
              value={targetId}
              onChange={e => setTargetId(e.target.value)}
              required
              pattern="[0-9a-fA-F-]{36}"
            />
          </label>
        )}
        {target === 'project' ? <label>
          {t('Delete before date (UTC)', 'Удалить до даты (UTC)')}
          <input
            type="date"
            value={before}
            max={new Date().toISOString().slice(0, 10)}
            required
            onChange={e => setBefore(e.target.value)}
          />
        </label> : null}
        <label>
          {t(
            'Confirm permanent deletion: enter project UUID',
            'Подтвердите безвозвратное удаление: введите UUID проекта',
          )}
          <code>{projectId}</code>
          <input
            value={confirmation}
            onChange={e => setConfirmation(e.target.value)}
            autoComplete="off"
            required
          />
        </label>
        <button
          type="submit"
          disabled={
            confirmation !== projectId ||
            create.isPending ||
            Boolean(active) ||
            jobs.isError ||
            !jobs.data
          }
        >
          {create.isPending
            ? t('Requesting…', 'Отправляем…')
            : t('Delete selected data permanently', 'Безвозвратно удалить выбранные данные')}
        </button>
      </form>
      {create.isError ? (
        <p role="alert">
          {t('Deletion request failed', 'Запрос удаления не выполнен')}:{' '}
          {(create.error as Error & { code?: string }).code ?? 'lifecycle-unavailable'}
        </p>
      ) : null}
      {create.isSuccess ? (
        <p role="status">
          {t(
            'Request recorded. Follow its status below.',
            'Запрос записан. Его состояние показано ниже.',
          )}
        </p>
      ) : null}
      {jobs.isPending ? (
        <p role="status">{t('Loading deletion status…', 'Загружаем состояние удаления…')}</p>
      ) : jobs.isError ? (
        <p role="alert">{t('Deletion status unavailable', 'Состояние удаления недоступно')}</p>
      ) : !jobs.data?.data.length ? (
        <p>
          {t(
            'No deletion requests. Existing data is unchanged.',
            'Запросов удаления нет. Существующие данные не изменены.',
          )}
        </p>
      ) : (
        <div className={styles.table}>
          <table>
            <caption>{t('Latest deletion requests', 'Последние запросы удаления')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('Created', 'Создан')}</th>
                <th scope="col">{t('Category', 'Категория')}</th>
                <th scope="col">{t('Status', 'Состояние')}</th>
                <th scope="col">{t('Deleted rows/files', 'Удалено строк/файлов')}</th>
              </tr>
            </thead>
            <tbody>
              {jobs.data.data.map(job => (
                <tr key={job.id}>
                  <td>{new Date(job.createdAt).toLocaleString(locale)}</td>
                  <td>{labels[job.definition.category]}</td>
                  <td>
                    {statuses[job.status] ?? job.status}
                    {job.errorCode ? <div>{job.errorCode}</div> : null}
                  </td>
                  <td>{job.deletedRows}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </details>
  );
}
