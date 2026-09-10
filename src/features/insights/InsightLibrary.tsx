'use client';

import { Archive, Copy, ExternalLink, Search, Star } from 'lucide-react';
import { type FormEvent, useMemo, useState } from 'react';
import { useStudioLocale } from '@/features/i18n/useStudioLocale';
import { AccessibleDialog } from '@/features/studio-shell/AccessibleDialog';
import type { AnalysisQueryV1 } from '@/server/analytics/contracts';
import styles from './InsightLibrary.module.css';
import {
  useCreateInsight,
  useDuplicateInsight,
  useInsights,
  useUpdateInsight,
} from './useInsights';

export function SaveInsightDialog({
  open,
  projectId,
  query,
  onClose,
  onSaved,
}: {
  open: boolean;
  projectId: string;
  query: AnalysisQueryV1;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const create = useCreateInsight(projectId);
  const { t } = useStudioLocale();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await create.mutateAsync({
        title,
        description,
        query,
        visualization: { type: query.visualization },
      });
      setTitle('');
      setDescription('');
      onSaved?.();
      onClose();
    } catch {
      // The localized inline error state is rendered below.
    }
  };

  return (
    <AccessibleDialog
      open={open}
      title={t('Save insight', 'Сохранить инсайт')}
      description={t(
        'Persist the normalized question and visualization without storing result rows.',
        'Сохраните нормализованный вопрос и визуализацию без строк результата.',
      )}
      onClose={onClose}
    >
      <form className={styles.saveForm} onSubmit={submit}>
        <label>
          {t('Insight title', 'Название инсайта')}
          <input
            value={title}
            onChange={event => setTitle(event.target.value)}
            maxLength={200}
            required
          />
        </label>
        <label>
          {t('Description', 'Описание')}
          <textarea
            value={description}
            onChange={event => setDescription(event.target.value)}
            maxLength={500}
          />
        </label>
        {create.error ? (
          <p role="alert">{t('Insight could not be saved.', 'Не удалось сохранить инсайт.')}</p>
        ) : null}
        <div className={styles.dialogActions}>
          <button type="button" onClick={onClose}>
            {t('Cancel', 'Отмена')}
          </button>
          <button type="submit" disabled={create.isPending}>
            {create.isPending ? t('Saving…', 'Сохранение…') : t('Save insight', 'Сохранить инсайт')}
          </button>
        </div>
      </form>
    </AccessibleDialog>
  );
}

export function InsightLibrary({
  open,
  projectId,
  onClose,
  onReopen,
}: {
  open: boolean;
  projectId: string;
  onClose: () => void;
  onReopen: (query: AnalysisQueryV1) => void;
}) {
  const { locale, t } = useStudioLocale();
  const [search, setSearch] = useState('');
  const [owner, setOwner] = useState<'all' | 'mine'>('all');
  const [favorites, setFavorites] = useState(false);
  const [editingId, setEditingId] = useState<string>();
  const [editTitle, setEditTitle] = useState('');
  const list = useInsights(projectId, {
    search: search || undefined,
    owner,
    favorite: favorites || undefined,
  });
  const update = useUpdateInsight(projectId);
  const duplicate = useDuplicateInsight(projectId);
  const insights = useMemo(() => list.data?.pages.flatMap(page => page.data) ?? [], [list.data]);
  const mutationError = update.error ?? duplicate.error;

  return (
    <AccessibleDialog
      open={open}
      title={t('Insight library', 'Библиотека инсайтов')}
      description={t(
        'Search reusable, versioned analytical questions for this project.',
        'Поиск повторно используемых версионированных аналитических вопросов проекта.',
      )}
      onClose={onClose}
    >
      <div className={styles.library}>
        <div className={styles.filters}>
          <label className={styles.search}>
            <Search aria-hidden="true" />
            <span className="sr-only">{t('Search insights', 'Поиск инсайтов')}</span>
            <input
              aria-label={t('Search insights', 'Поиск инсайтов')}
              type="search"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder={t('Search title or description', 'Поиск по названию или описанию')}
            />
          </label>
          <label>
            {t('Owner', 'Владелец')}
            <select
              value={owner}
              onChange={event => setOwner(event.target.value as 'all' | 'mine')}
            >
              <option value="all">{t('Everyone', 'Все')}</option>
              <option value="mine">{t('Mine', 'Мои')}</option>
            </select>
          </label>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={favorites}
              onChange={event => setFavorites(event.target.checked)}
            />
            {t('Favorites', 'Избранное')}
          </label>
        </div>

        {mutationError ? (
          <p role="alert">{t('The change was rolled back.', 'Изменение отменено.')}</p>
        ) : null}
        {list.isPending ? (
          <p role="status">{t('Loading recent Insights…', 'Загрузка недавних инсайтов…')}</p>
        ) : null}
        {list.error ? (
          <p role="alert">{t('Insights could not be loaded.', 'Не удалось загрузить инсайты.')}</p>
        ) : null}
        {!list.isPending && !insights.length ? (
          <p>{t('No Insights match these filters.', 'Нет инсайтов, соответствующих фильтрам.')}</p>
        ) : null}

        <ul className={styles.insightList}>
          {insights.map(insight => (
            <li key={insight.id}>
              <header>
                <div>
                  {editingId === insight.id ? (
                    <label>
                      {t('Edit title', 'Изменить название')}
                      <input
                        value={editTitle}
                        onChange={event => setEditTitle(event.target.value)}
                        maxLength={200}
                      />
                    </label>
                  ) : (
                    <h3>{insight.title}</h3>
                  )}
                  <p>{insight.description || t('No description', 'Без описания')}</p>
                </div>
                <button
                  type="button"
                  aria-label={
                    insight.favorite
                      ? t(
                          `Remove ${insight.title} from favorites`,
                          `Убрать «${insight.title}» из избранного`,
                        )
                      : t(`Favorite ${insight.title}`, `Добавить «${insight.title}» в избранное`)
                  }
                  onClick={() =>
                    update.mutate({ id: insight.id, patch: { favorite: !insight.favorite } })
                  }
                >
                  <Star aria-hidden="true" fill={insight.favorite ? 'currentColor' : 'none'} />
                </button>
              </header>
              <dl>
                <div>
                  <dt>{t('Owner', 'Владелец')}</dt>
                  <dd>{insight.owner.username}</dd>
                </div>
                <div>
                  <dt>{t('Updated', 'Обновлено')}</dt>
                  <dd>{new Date(insight.updatedAt).toLocaleString(locale)}</dd>
                </div>
                <div>
                  <dt>{t('Dependencies', 'Зависимости')}</dt>
                  <dd>
                    {insight.dependencies.dashboards} {t('dashboards', 'дашбордов')}
                  </dd>
                </div>
              </dl>
              {insight.compatibility.state === 'unsupported' ? (
                <p role="status">
                  {t('This Insight cannot be reopened.', 'Этот инсайт нельзя открыть повторно.')}
                </p>
              ) : null}
              <div className={styles.itemActions}>
                {editingId === insight.id ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        update.mutate({ id: insight.id, patch: { title: editTitle } });
                        setEditingId(undefined);
                      }}
                    >
                      {t('Save title', 'Сохранить название')}
                    </button>
                    <button type="button" onClick={() => setEditingId(undefined)}>
                      {t('Cancel', 'Отмена')}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(insight.id);
                      setEditTitle(insight.title);
                    }}
                  >
                    {t('Edit title', 'Изменить название')}
                  </button>
                )}
                <button
                  type="button"
                  disabled={!insight.query}
                  onClick={() => insight.query && onReopen(insight.query)}
                >
                  <ExternalLink aria-hidden="true" /> {t('Reopen', 'Открыть повторно')}
                </button>
                <button type="button" onClick={() => duplicate.mutate(insight.id)}>
                  <Copy aria-hidden="true" /> {t('Duplicate', 'Дублировать')}
                </button>
                <button
                  type="button"
                  aria-label={t(
                    `Archive ${insight.title}; referenced by ${insight.dependencies.dashboards} dashboards`,
                    `Архивировать «${insight.title}»; используется в дашбордах: ${insight.dependencies.dashboards}`,
                  )}
                  onClick={() => update.mutate({ id: insight.id, patch: { status: 'archived' } })}
                >
                  <Archive aria-hidden="true" /> {t('Archive', 'Архивировать')}
                </button>
              </div>
            </li>
          ))}
        </ul>

        {list.hasNextPage ? (
          <button
            type="button"
            onClick={() => list.fetchNextPage()}
            disabled={list.isFetchingNextPage}
          >
            {list.isFetchingNextPage ? t('Loading…', 'Загрузка…') : t('Load more', 'Загрузить ещё')}
          </button>
        ) : null}
      </div>
    </AccessibleDialog>
  );
}
