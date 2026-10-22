'use client';

import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ExternalLink,
  FileText,
  LayoutDashboard,
  Minus,
  Plus,
  Settings2,
  Trash2,
} from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useProjectAccess } from '@/features/access/useProjectAccess';
import { dateInputToUtc } from '@/features/explore/model';
import { useAnalysisResult } from '@/features/explore/useAnalysisQuery';
import { ExportControls } from '@/features/exports/ExportControls';
import { useGuestWorkspace } from '@/features/guest/GuestWorkspaceContext';
import { useStudioLocale } from '@/features/i18n/useStudioLocale';
import { useInsights } from '@/features/insights/useInsights';
import { AccessibleDialog } from '@/features/studio-shell/AccessibleDialog';
import { StudioState } from '@/features/studio-shell/StudioState';
import { eventLabel } from '@/features/visual/eventLabel';
import { FlowField } from '@/features/visual/FlowField';
import { useVisualMotion } from '@/features/visual/MotionPreferences';
import type { AnalysisFunnelStepRow } from '@/server/analytics/contracts';
import { serializeAnalysisQuery } from '@/server/analytics/url-codec';
import { applyDashboardContext, type DashboardGlobalContext } from '@/server/dashboards/context';
import type { DashboardWidgetDto } from '@/server/dashboards/dashboard-service';
import styles from './DashboardWorkspace.module.css';
import {
  useAddDashboardWidget,
  useCreateDashboard,
  useDashboards,
  useRemoveDashboardWidget,
  useUpdateDashboard,
  useUpdateDashboardWidget,
} from './useDashboards';

function utcDate(value?: string) {
  return value ? new Date(value).toISOString().slice(0, 10) : '';
}

function contextIdentity(context: DashboardGlobalContext) {
  return JSON.stringify({
    ...(context.range
      ? {
          range: {
            startAt: context.range.startAt,
            endAt: context.range.endAt,
            ...(context.range.timezone ? { timezone: context.range.timezone } : {}),
          },
        }
      : {}),
    ...(context.segment
      ? {
          segment: {
            field: context.segment.field,
            operator: context.segment.operator,
            value: context.segment.value,
          },
        }
      : {}),
  });
}

export function DashboardWorkspace({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const { locale, t } = useStudioLocale();
  const { animate } = useVisualMotion();
  const access = useProjectAccess(projectId);
  const canCreate = !!access.data?.capabilities.editDashboards;
  const dashboards = useDashboards(projectId);
  const create = useCreateDashboard(projectId);
  const update = useUpdateDashboard(projectId);
  const addWidget = useAddDashboardWidget(projectId);
  const updateWidget = useUpdateDashboardWidget(projectId);
  const removeWidget = useRemoveDashboardWidget(projectId);
  const insightsQuery = useInsights(projectId, { owner: 'all', status: 'active' });
  const insights = useMemo(
    () => insightsQuery.data?.pages.flatMap(page => page.data) ?? [],
    [insightsQuery.data],
  );
  const [selectedId, setSelectedId] = useState<string>();
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [newTitle, setNewTitle] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedInsightId, setSelectedInsightId] = useState('');
  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [contextDraft, setContextDraft] = useState<DashboardGlobalContext>({});
  const [contextDateError, setContextDateError] = useState(false);
  const contextDashboardId = useRef<string | undefined>(undefined);
  const contextEditRevision = useRef(0);
  const contextSavedRevision = useRef(0);
  const list = dashboards.data?.data ?? [];
  const selected = list.find(item => item.id === selectedId) ?? list[0];
  const selectedDashboardId = selected?.id;
  const appliedContextIdentity = contextIdentity(selected?.globalContext ?? {});

  useEffect(() => {
    if (!selectedId && list[0]) setSelectedId(list[0].id);
  }, [list, selectedId]);
  useEffect(() => {
    if (!selectedDashboardId) return;
    const switched = contextDashboardId.current !== selectedDashboardId;
    if (switched) {
      contextDashboardId.current = selectedDashboardId;
      contextEditRevision.current += 1;
      contextSavedRevision.current = contextEditRevision.current;
      setContextDateError(false);
    }
    setContextDraft(current =>
      switched || contextEditRevision.current === contextSavedRevision.current
        ? (JSON.parse(appliedContextIdentity) as DashboardGlobalContext)
        : current,
    );
  }, [selectedDashboardId, appliedContextIdentity]);

  const editContext = (change: (current: DashboardGlobalContext) => DashboardGlobalContext) => {
    contextEditRevision.current += 1;
    setContextDraft(change);
  };

  const applyContext = (context: DashboardGlobalContext) => {
    if (!selected?.canEdit || update.isPending) return;
    const dashboardId = selected.id;
    const submittedRevision = contextEditRevision.current;
    update.mutate(
      { id: dashboardId, patch: { globalContext: context } },
      {
        onSuccess: dashboard => {
          if (
            contextDashboardId.current === dashboardId &&
            contextEditRevision.current === submittedRevision
          ) {
            contextSavedRevision.current = submittedRevision;
            setContextDraft(dashboard.globalContext ?? {});
          }
        },
      },
    );
  };

  const updateContextDate = (field: 'startAt' | 'endAt', value: string) => {
    if (!value) {
      setContextDateError(true);
      return;
    }
    const date = dateInputToUtc(value);
    setContextDateError(false);
    editContext(current => ({
      ...current,
      range: {
        startAt: current.range?.startAt ?? date,
        endAt: current.range?.endAt ?? date,
        timezone: current.range?.timezone ?? 'UTC',
        [field]: date,
      },
    }));
  };

  if (dashboards.isPending)
    return (
      <StudioState
        variant="loading"
        title={t('Loading dashboards', 'Загрузка дашбордов')}
        message={t('Loading your saved views.', 'Загружаем сохранённые представления.')}
      />
    );
  if (dashboards.error)
    return (
      <StudioState
        variant="error"
        title={t('Dashboards unavailable', 'Дашборды недоступны')}
        message={t('Dashboards could not be loaded.', 'Не удалось загрузить дашборды.')}
      />
    );

  const createDashboard = async () => {
    if (!canCreate || create.isPending) return;
    try {
      const dashboard = await create.mutateAsync({
        title: newTitle || `${projectName} ${t('dashboard', 'дашборд')}`,
      });
      setNewTitle('');
      setSelectedId(dashboard.id);
      setMode('edit');
      setCreateOpen(false);
    } catch {
      // A localized mutation error is rendered below.
    }
  };

  const addTextWidget = async (kind: 'note' | 'header') => {
    if (!selected?.canEdit || addWidget.isPending || (kind === 'header' && !noteTitle.trim()))
      return;
    const title = noteTitle;
    const body = noteBody;
    try {
      await addWidget.mutateAsync({
        dashboardId: selected.id,
        widget: { kind, title, body },
      });
      // Keep any newer text typed while the submitted draft was being saved.
      setNoteTitle(current => (current === title ? '' : current));
      setNoteBody(current => (current === body ? '' : current));
    } catch {
      // Retain the draft; the shared mutation error below offers another attempt.
    }
  };

  return (
    <section
      className={styles.workspace}
      aria-label={t('Dashboard workspace', 'Рабочая область дашбордов')}
    >
      <header className={styles.heading}>
        <div>
          <p>{projectName}</p>
          <h1>{t('Dashboards', 'Дашборды')}</h1>
          <span>
            {t(
              'Saved analyses and notes, together on one screen.',
              'Дашборд — сохранённые анализы и заметки на одном экране.',
            )}
          </span>
        </div>
        <button
          className={styles.newDashboard}
          type="button"
          disabled={!canCreate}
          aria-label={t('New dashboard', 'Новый дашборд')}
          title={
            !canCreate
              ? t(
                  'Dashboard editing permission required',
                  'Нужно право на редактирование дашбордов',
                )
              : undefined
          }
          onClick={() => {
            create.reset();
            setCreateOpen(true);
          }}
        >
          <Plus aria-hidden="true" /> {t('New dashboard', 'Новый дашборд')}
        </button>
      </header>

      {!list.length ? (
        <StudioState
          variant="empty"
          title={t('No dashboards yet', 'Дашбордов пока нет')}
          message={t(
            canCreate
              ? 'Create a dashboard, then add an analysis saved in Explore.'
              : 'No dashboards have been created. A project editor can create one for you.',
            canCreate
              ? 'Создайте дашборд, затем добавьте анализ, сохранённый в разделе «Анализ».'
              : 'Дашбордов пока нет. Участник с правом редактирования может создать их для вас.',
          )}
        />
      ) : selected ? (
        <div className={styles.layout}>
          {list.length > 1 ? (
            <nav
              aria-label={t('Project dashboards', 'Дашборды проекта')}
              className={styles.dashboardList}
            >
              {list.map(dashboard => (
                <button
                  key={dashboard.id}
                  type="button"
                  data-selected={dashboard.id === selected.id || undefined}
                  onClick={() => {
                    setSelectedId(dashboard.id);
                    setMode('view');
                  }}
                >
                  <LayoutDashboard aria-hidden="true" />
                  <span>
                    <strong>{dashboard.title}</strong>
                    <small>
                      {dashboard.widgets.length.toLocaleString(locale)} {t('widgets', 'виджетов')}
                    </small>
                  </span>
                </button>
              ))}
            </nav>
          ) : null}

          <main className={styles.canvas}>
            <div className={styles.dashboardHeader}>
              <div>
                <h2>{selected.title}</h2>
                {selected.description ? <span>{selected.description}</span> : null}
                <p className={styles.dashboardUpdated}>
                  <span className="sr-only">{selected.owner.username} · </span>
                  {t('updated', 'обновлено')} {new Date(selected.updatedAt).toLocaleString(locale)}
                </p>
              </div>
              <div className={styles.modeSwitch} aria-label={t('Dashboard mode', 'Режим дашборда')}>
                <button
                  type="button"
                  aria-pressed={mode === 'edit'}
                  disabled={!selected.canEdit}
                  onClick={() => setMode(current => (current === 'view' ? 'edit' : 'view'))}
                >
                  {mode === 'view' ? t('Edit', 'Редактировать') : t('View', 'Готово')}
                </button>
              </div>
            </div>

            {mode === 'edit' ? (
              <section
                className={styles.editor}
                aria-label={t('Dashboard editor', 'Редактор дашборда')}
              >
                <details className={styles.contextPanel}>
                  <summary>
                    <Settings2 aria-hidden="true" /> {t('Shared context', 'Общий контекст')}
                  </summary>
                  <div className={styles.contextEditor}>
                    <label>
                      {t('Start date', 'Дата начала')}
                      <input
                        type="date"
                        value={utcDate(contextDraft.range?.startAt)}
                        onChange={event => updateContextDate('startAt', event.target.value)}
                      />
                    </label>
                    <label>
                      {t('End date', 'Дата окончания')}
                      <input
                        type="date"
                        value={utcDate(contextDraft.range?.endAt)}
                        onChange={event => updateContextDate('endAt', event.target.value)}
                      />
                    </label>
                    <label>
                      {t('Segment field', 'Поле сегмента')}
                      <select
                        value={contextDraft.segment?.field ?? ''}
                        onChange={event =>
                          editContext(current =>
                            event.target.value
                              ? {
                                  ...current,
                                  segment: {
                                    field: event.target.value as any,
                                    operator: 'equals',
                                    value: current.segment?.value ?? 'US',
                                  },
                                }
                              : { ...current, segment: undefined },
                          )
                        }
                      >
                        <option value="">{t('No override', 'Без переопределения')}</option>
                        <option value="urlPath">{t('URL path', 'Путь URL')}</option>
                        <option value="country">{t('Country', 'Страна')}</option>
                        <option value="browser">{t('Browser', 'Браузер')}</option>
                        <option value="device">{t('Device', 'Устройство')}</option>
                      </select>
                    </label>
                    <label>
                      {t('Segment value', 'Значение сегмента')}
                      <input
                        value={contextDraft.segment?.value ?? ''}
                        disabled={!contextDraft.segment}
                        onChange={event =>
                          editContext(current =>
                            current.segment
                              ? {
                                  ...current,
                                  segment: { ...current.segment, value: event.target.value },
                                }
                              : current,
                          )
                        }
                      />
                    </label>
                    <div className={styles.contextActions}>
                      {contextDateError ? (
                        <p role="alert">
                          {t(
                            'A date is required. The previous period has been kept. Use Clear to remove the shared period.',
                            'Дата обязательна. Предыдущий период сохранён. Нажмите «Очистить», чтобы убрать общий период.',
                          )}
                        </p>
                      ) : null}
                      <button
                        type="button"
                        disabled={update.isPending}
                        onClick={() => applyContext(contextDraft)}
                      >
                        {t('Apply shared context', 'Применить общий контекст')}
                      </button>
                      <button
                        type="button"
                        disabled={update.isPending}
                        onClick={() => {
                          editContext(() => ({}));
                          setContextDateError(false);
                          applyContext({});
                        }}
                      >
                        {t('Clear', 'Очистить')}
                      </button>
                    </div>
                  </div>
                </details>

                <div className={styles.adders}>
                  <form
                    onSubmit={event => {
                      event.preventDefault();
                      if (selectedInsightId)
                        addWidget.mutate({
                          dashboardId: selected.id,
                          widget: { kind: 'insight', insightId: selectedInsightId },
                        });
                    }}
                  >
                    <label>
                      {t('Add existing Insight', 'Добавить сохранённый анализ')}
                      <select
                        aria-label={t('Insight to add', 'Инсайт для добавления')}
                        value={selectedInsightId}
                        onChange={event => setSelectedInsightId(event.target.value)}
                        disabled={insightsQuery.isPending || !insights.length}
                        required
                      >
                        <option value="">{t('Choose Insight', 'Выберите анализ')}</option>
                        {insights.map(insight => (
                          <option key={insight.id} value={insight.id}>
                            {insight.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button type="submit" disabled={!selectedInsightId || addWidget.isPending}>
                      <Plus aria-hidden="true" /> {t('Add Insight', 'Добавить инсайт')}
                    </button>
                    <div className={styles.contextActions} style={{ gridColumn: '1 / -1' }}>
                      {insightsQuery.isPending ? (
                        <p role="status">
                          {t('Loading saved analyses…', 'Загружаем сохранённые анализы…')}
                        </p>
                      ) : insightsQuery.error ? (
                        <p role="alert">
                          {t(
                            insights.length
                              ? 'More analyses could not be loaded. The loaded choices remain available.'
                              : 'Saved analyses could not be loaded.',
                            insights.length
                              ? 'Не удалось загрузить остальные анализы. Уже загруженные доступны для выбора.'
                              : 'Не удалось загрузить сохранённые анализы.',
                          )}
                        </p>
                      ) : !insights.length ? (
                        <p>
                          {t('No saved analyses yet. ', 'Сохранённых анализов пока нет. ')}
                          <Link href={`/studio/${projectId}/explore`}>
                            {t(
                              'Save an analysis in Explore',
                              'Сохраните результат в разделе «Анализ»',
                            )}
                          </Link>
                        </p>
                      ) : null}
                      {insightsQuery.hasNextPage ? (
                        <button
                          type="button"
                          disabled={insightsQuery.isFetchingNextPage}
                          onClick={() => void insightsQuery.fetchNextPage()}
                        >
                          {insightsQuery.isFetchingNextPage
                            ? t('Loading more analyses…', 'Загружаем ещё анализы…')
                            : insightsQuery.isFetchNextPageError
                              ? t('Retry loading more analyses', 'Повторить загрузку анализов')
                              : t('Load more saved analyses', 'Загрузить ещё анализы')}
                        </button>
                      ) : insightsQuery.error ? (
                        <button type="button" onClick={() => void insightsQuery.refetch()}>
                          {t('Retry saved analyses', 'Повторить загрузку анализов')}
                        </button>
                      ) : null}
                    </div>
                  </form>
                  <form
                    onSubmit={event => {
                      event.preventDefault();
                      void addTextWidget('note');
                    }}
                  >
                    <label>
                      {t('Note title', 'Название заметки')}
                      <input
                        value={noteTitle}
                        onChange={event => setNoteTitle(event.target.value)}
                      />
                    </label>
                    <label>
                      {t('Note body', 'Текст заметки')}
                      <input
                        value={noteBody}
                        onChange={event => setNoteBody(event.target.value)}
                        required
                      />
                    </label>
                    <button type="submit" disabled={addWidget.isPending}>
                      <FileText aria-hidden="true" /> {t('Add note', 'Добавить заметку')}
                    </button>
                    <button
                      type="button"
                      disabled={!noteTitle.trim() || addWidget.isPending}
                      onClick={() => void addTextWidget('header')}
                    >
                      {t('Add section header', 'Добавить заголовок раздела')}
                    </button>
                  </form>
                </div>
              </section>
            ) : null}

            {update.error || addWidget.error || updateWidget.error || removeWidget.error ? (
              <p role="alert" className={styles.error}>
                {t(
                  'A dashboard change failed. Your note draft and existing widgets are kept. Try again.',
                  'Не удалось изменить дашборд. Текст заметки и существующие виджеты сохранены. Повторите попытку.',
                )}
              </p>
            ) : null}

            {!selected.widgets.length ? (
              <StudioState
                variant="empty"
                title={t('Dashboard is empty', 'Дашборд пуст')}
                message={t(
                  'Switch to Edit and add an existing Insight or a note.',
                  'Перейдите в режим редактирования и добавьте существующий инсайт или заметку.',
                )}
              />
            ) : (
              <div className={styles.grid} data-mode={mode}>
                {selected.widgets.map((widget, index) => (
                  <motion.article
                    key={widget.id}
                    layout={animate ? 'position' : false}
                    initial={animate ? { y: 12 } : false}
                    animate={{ y: 0 }}
                    transition={{ type: 'tween', duration: animate ? 0.32 : 0, ease: 'easeOut' }}
                    style={{ gridColumn: `span ${widget.width}` }}
                    data-height={widget.height}
                    data-kind={widget.kind}
                  >
                    {mode === 'edit' ? (
                      <div
                        className={styles.layoutControls}
                        aria-label={t(
                          `Layout controls for ${widget.insight?.title ?? (widget.title || 'widget')}`,
                          `Настройки расположения: ${widget.insight?.title ?? (widget.title || 'виджет')}`,
                        )}
                      >
                        <button
                          type="button"
                          aria-label={t('Move earlier', 'Переместить выше')}
                          disabled={index === 0}
                          onClick={() =>
                            updateWidget.mutate({
                              dashboardId: selected.id,
                              widgetId: widget.id,
                              patch: { position: index - 1 },
                            })
                          }
                        >
                          <ArrowUp aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          aria-label={t('Move later', 'Переместить ниже')}
                          disabled={index === selected.widgets.length - 1}
                          onClick={() =>
                            updateWidget.mutate({
                              dashboardId: selected.id,
                              widgetId: widget.id,
                              patch: { position: index + 1 },
                            })
                          }
                        >
                          <ArrowDown aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          aria-label={t('Narrow widget', 'Сузить виджет')}
                          disabled={widget.width === 1}
                          onClick={() =>
                            updateWidget.mutate({
                              dashboardId: selected.id,
                              widgetId: widget.id,
                              patch: { width: widget.width - 1 },
                            })
                          }
                        >
                          <Minus aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          aria-label={t('Widen widget', 'Расширить виджет')}
                          disabled={widget.width === 3}
                          onClick={() =>
                            updateWidget.mutate({
                              dashboardId: selected.id,
                              widgetId: widget.id,
                              patch: { width: widget.width + 1 },
                            })
                          }
                        >
                          <Plus aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          aria-label={t('Remove widget', 'Удалить виджет')}
                          onClick={() =>
                            removeWidget.mutate({ dashboardId: selected.id, widgetId: widget.id })
                          }
                        >
                          <Trash2 aria-hidden="true" />
                        </button>
                      </div>
                    ) : null}
                    <DashboardWidget widget={widget} context={selected.globalContext} />
                  </motion.article>
                ))}
              </div>
            )}
          </main>
        </div>
      ) : null}
      <AccessibleDialog
        open={createOpen && canCreate}
        onClose={() => setCreateOpen(false)}
        title={t('Create dashboard', 'Создать дашборд')}
        description={t(
          'Give this collection of answers a name.',
          'Назовите подборку ответов на ваши вопросы.',
        )}
      >
        <form
          className={styles.createForm}
          onSubmit={event => {
            event.preventDefault();
            createDashboard();
          }}
        >
          <label>
            {t('New dashboard title', 'Название нового дашборда')}
            <input
              data-autofocus
              value={newTitle}
              onChange={event => setNewTitle(event.target.value)}
              placeholder={t('Product pulse', 'Пульс продукта')}
              maxLength={200}
              required
            />
          </label>
          {create.error ? (
            <p role="alert">
              {t(
                'Dashboard could not be created. Try again.',
                'Не удалось создать дашборд. Попробуйте ещё раз.',
              )}
            </p>
          ) : null}
          <button type="submit" disabled={!canCreate || create.isPending}>
            <Plus size={16} aria-hidden="true" />
            {t('Create dashboard', 'Создать дашборд')}
          </button>
        </form>
      </AccessibleDialog>
    </section>
  );
}

export function DashboardWidget({
  widget,
  context,
}: {
  widget: DashboardWidgetDto;
  context: DashboardGlobalContext;
}) {
  const { locale, t } = useStudioLocale();
  const guest = useGuestWorkspace();
  const applied = useMemo(
    () => (widget.insight?.query ? applyDashboardContext(widget.insight.query, context) : null),
    [context, widget.insight?.query],
  );
  const result = useAnalysisResult(
    applied && applied.state !== 'incompatible' ? applied.query : undefined,
  );
  const funnelSteps =
    result.data?.data.mode === 'funnel'
      ? result.data.data.rows.filter(
          (row): row is AnalysisFunnelStepRow => 'kind' in row && row.kind === 'funnel-step',
        )
      : [];
  const hasFunnelSegments = funnelSteps.some(row => row.segment !== undefined);
  const displayEvent = (label: string) => (guest ? eventLabel(label, locale) : label);
  const rows = result.data?.data.mode === 'funnel' ? funnelSteps : (result.data?.data.rows ?? []);
  const visibleRows = rows.slice(
    0,
    result.data?.data.mode === 'funnel' && !hasFunnelSegments ? 8 : 6,
  );
  const rowLabel = (row: (typeof rows)[number]) => {
    if ('label' in row)
      return 'segment' in row && row.segment
        ? `${row.segment} · ${displayEvent(row.label)}`
        : displayEvent(row.label);
    if ('key' in row) return row.key;
    if ('bucket' in row) {
      const date = new Date(row.bucket);
      return Number.isNaN(date.getTime())
        ? row.bucket
        : date.toLocaleDateString(locale, {
            timeZone: applied?.query.range.timezone ?? 'UTC',
            day: 'numeric',
            month: 'short',
          });
    }
    return `${new Date(row.cohortStart).toLocaleDateString(locale, { timeZone: 'UTC' })} · P${row.period}`;
  };
  const rangeDate = (value: string | number) =>
    new Date(value).toLocaleDateString(locale, {
      timeZone: applied?.query.range.timezone ?? 'UTC',
      day: 'numeric',
      month: 'short',
    });

  if (widget.kind === 'header')
    return (
      <header className={styles.sectionHeader}>
        <h3>{widget.title}</h3>
        <p>{widget.body}</p>
      </header>
    );
  if (widget.kind === 'note')
    return (
      <div className={styles.note}>
        <h3>{widget.title || t('Note', 'Заметка')}</h3>
        <p>{widget.body}</p>
      </div>
    );
  if (!widget.insight || !applied)
    return (
      <StudioState
        variant="error"
        title={t('Insight unavailable', 'Инсайт недоступен')}
        message={t(
          'The referenced Insight may have been removed.',
          'Возможно, связанный инсайт был удалён.',
        )}
      />
    );

  return (
    <div className={styles.widget}>
      <header>
        <div>
          <p>{t('Saved analysis', 'Сохранённый анализ')}</p>
          <h3>{widget.insight.title}</h3>
        </div>
        {applied.state !== 'unchanged' ? (
          <span data-context={applied.state}>
            {applied.state === 'incompatible'
              ? t('Override incompatible', 'Переопределение несовместимо')
              : applied.state === 'applied'
                ? t('Context applied', 'Контекст применён')
                : t('Saved context', 'Сохранённый контекст')}
          </span>
        ) : null}
      </header>
      {applied.state === 'incompatible' ? (
        <div className={styles.widgetError}>
          <AlertTriangle aria-hidden="true" />
          <p>{applied.reasons.join(' ')}</p>
        </div>
      ) : result.isPending || result.isPlaceholderData ? (
        <p role="status">{t('Loading Insight…', 'Загрузка инсайта…')}</p>
      ) : result.error ? (
        <div className={styles.widgetError}>
          <AlertTriangle aria-hidden="true" />
          <div>
            <p>{t('This widget could not be loaded.', 'Не удалось загрузить этот виджет.')}</p>
            <button type="button" onClick={() => result.refetch()} disabled={result.isFetching}>
              {t('Retry widget', 'Повторить загрузку')}
            </button>
          </div>
        </div>
      ) : result.data ? (
        <>
          <div className={styles.widgetMeta}>
            <div>
              {result.data.data.total ? (
                <>
                  <strong>{result.data.data.total.value.toLocaleString(locale)}</strong>
                  {result.data.data.total.denominator != null ? (
                    <span>
                      {' '}
                      {t('of', 'из')} {result.data.data.total.denominator.toLocaleString(locale)}
                      {result.data.data.total.rate != null
                        ? ` · ${result.data.data.total.rate.toLocaleString(locale, { style: 'percent', maximumFractionDigits: 1 })}`
                        : ''}
                    </span>
                  ) : null}
                </>
              ) : null}
              <small>
                {rangeDate(applied.query.range.startAt)} —{' '}
                {rangeDate(new Date(applied.query.range.endAt).getTime() - 1)} ·{' '}
                {applied.query.range.timezone}
              </small>
            </div>
            <ExportControls
              className={styles.exportAction}
              projectId={applied.query.projectId}
              source={{ kind: 'analysis', query: applied.query }}
              disabled={result.isFetching}
            />
          </div>
          {!rows.length && !result.data.data.total?.value ? (
            <p className={styles.emptyResult} role="status">
              {t(
                'No matching results. Try a different period or filters in Explore.',
                'Нет подходящих результатов. Попробуйте другой период или фильтры в анализе.',
              )}
            </p>
          ) : null}
          {funnelSteps.length > 0 && !hasFunnelSegments ? (
            <div
              className={styles.funnelStage}
              role="region"
              tabIndex={0}
              aria-label={t('Funnel conversion by step', 'Конверсия воронки по шагам')}
            >
              <div
                className={styles.funnelScene}
                style={{ minWidth: `${funnelSteps.length * 80}px` }}
              >
                <ol
                  style={{ gridTemplateColumns: `repeat(${funnelSteps.length}, minmax(0,1fr))` }}
                  className={styles.funnelBars}
                >
                  {funnelSteps.map(row => (
                    <li key={row.step}>
                      <span title={row.label}>{displayEvent(row.label)}</span>
                      <strong>
                        {row.converted.toLocaleString(locale)}{' '}
                        <small>
                          {row.overallConversionRate.toLocaleString(locale, {
                            style: 'percent',
                            maximumFractionDigits: 1,
                          })}
                        </small>
                      </strong>
                    </li>
                  ))}
                </ol>
                <FlowField values={funnelSteps.map(row => row.converted)} />
              </div>
            </div>
          ) : null}
          <div
            className={styles.tableScroll}
            role="region"
            tabIndex={0}
            aria-label={`${t('Data for', 'Данные для')} ${widget.insight.title}`}
          >
            <table>
              <caption>
                {t('Data for', 'Данные для')} {widget.insight.title}
              </caption>
              <thead>
                <tr>
                  <th scope="col">{t('Value', 'Значение')}</th>
                  <th scope="col">{t('Count', 'Количество')}</th>
                  {funnelSteps.length > 0 ? (
                    <th scope="col">{t('Conversion', 'Конверсия')}</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, index) => (
                  <tr key={`${rowLabel(row)}-${index}`}>
                    <th scope="row">{rowLabel(row)}</th>
                    <td>{row.value.toLocaleString(locale)}</td>
                    {'overallConversionRate' in row ? (
                      <td>
                        {row.overallConversionRate.toLocaleString(locale, {
                          style: 'percent',
                          maximumFractionDigits: 1,
                        })}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <details>
            <summary>{t('Definition and freshness', 'Определение и свежесть')}</summary>
            <p>
              {result.data.exactness === 'exact'
                ? t('Exact count', 'Точный подсчёт')
                : t('Estimate', 'Оценка')}
            </p>
            <p>
              {t('Owner', 'Владелец')}: {widget.insight.owner.username}
            </p>
            <p>
              {t('Period', 'Период')}: [{applied.query.range.startAt}, {applied.query.range.endAt})
              · {applied.query.range.timezone}
            </p>
            <p>
              {t('Updated', 'Обновлено')}:{' '}
              {new Date(result.data.freshnessAt).toLocaleString(locale)}
            </p>
            {rows.length > visibleRows.length ? (
              <p>
                {t(
                  `Showing ${visibleRows.length} of ${rows.length} rows. Open the insight to see every result.`,
                  `Показано ${visibleRows.length} из ${rows.length} строк. Откройте инсайт, чтобы увидеть все результаты.`,
                )}
              </p>
            ) : null}
            {result.data.definitions.map(definition => (
              <p key={definition.key}>
                <strong>{definition.label}</strong> — {definition.description}
              </p>
            ))}
          </details>
        </>
      ) : null}
      {widget.insight.query ? (
        <Link
          href={`/studio/${widget.insight.projectId}/explore?${serializeAnalysisQuery(widget.insight.query)}`}
        >
          <ExternalLink aria-hidden="true" />{' '}
          {t('Open Insight in Explore', 'Открыть инсайт в анализе')}
        </Link>
      ) : null}
    </div>
  );
}
