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
import { useEffect, useMemo, useState } from 'react';
import { dateInputToUtc } from '@/features/explore/model';
import { useAnalysisResult } from '@/features/explore/useAnalysisQuery';
import { ExportControls } from '@/features/exports/ExportControls';
import { useGuestWorkspace } from '@/features/guest/GuestWorkspaceContext';
import { useStudioLocale } from '@/features/i18n/useStudioLocale';
import { useInsights } from '@/features/insights/useInsights';
import { AccessibleDialog } from '@/features/studio-shell/AccessibleDialog';
import { StudioState } from '@/features/studio-shell/StudioState';
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

export function DashboardWorkspace({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const { locale, t } = useStudioLocale();
  const { animate } = useVisualMotion();
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
  const list = dashboards.data?.data ?? [];
  const selected = list.find(item => item.id === selectedId) ?? list[0];

  useEffect(() => {
    if (!selectedId && list[0]) setSelectedId(list[0].id);
  }, [list, selectedId]);
  useEffect(() => {
    if (selected) setContextDraft(selected.globalContext ?? {});
  }, [selected]);

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
              'Keep the answers that matter in one view.',
              'Соберите важные ответы в одном представлении.',
            )}
          </span>
        </div>
        <button
          className={styles.newDashboard}
          type="button"
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
            'Create your first dashboard and add a saved Insight.',
            'Создайте первый дашборд и добавьте сохранённый инсайт.',
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
                <p>
                  <span className="sr-only">{selected.owner.username} · </span>
                  {t('updated', 'обновлено')} {new Date(selected.updatedAt).toLocaleString(locale)}
                </p>
              </div>
              <div className={styles.modeSwitch} aria-label={t('Dashboard mode', 'Режим дашборда')}>
                <button
                  type="button"
                  aria-pressed={mode === 'view'}
                  onClick={() => setMode('view')}
                >
                  {t('View', 'Просмотр')}
                </button>
                <button
                  type="button"
                  aria-pressed={mode === 'edit'}
                  disabled={!selected.canEdit}
                  onClick={() => setMode('edit')}
                >
                  {t('Edit', 'Редактирование')}
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
                        onChange={event =>
                          setContextDraft(current => ({
                            ...current,
                            range: {
                              startAt: dateInputToUtc(event.target.value),
                              endAt: current.range?.endAt ?? dateInputToUtc(event.target.value),
                              timezone: current.range?.timezone ?? 'UTC',
                            },
                          }))
                        }
                      />
                    </label>
                    <label>
                      {t('End date', 'Дата окончания')}
                      <input
                        type="date"
                        value={utcDate(contextDraft.range?.endAt)}
                        onChange={event =>
                          setContextDraft(current => ({
                            ...current,
                            range: {
                              startAt: current.range?.startAt ?? dateInputToUtc(event.target.value),
                              endAt: dateInputToUtc(event.target.value),
                              timezone: current.range?.timezone ?? 'UTC',
                            },
                          }))
                        }
                      />
                    </label>
                    <label>
                      {t('Segment field', 'Поле сегмента')}
                      <select
                        value={contextDraft.segment?.field ?? ''}
                        onChange={event =>
                          setContextDraft(current =>
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
                          setContextDraft(current =>
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
                      <button
                        type="button"
                        onClick={() =>
                          update.mutate({ id: selected.id, patch: { globalContext: contextDraft } })
                        }
                      >
                        {t('Apply shared context', 'Применить общий контекст')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setContextDraft({});
                          update.mutate({ id: selected.id, patch: { globalContext: {} } });
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
                      {t('Add existing Insight', 'Добавить существующий инсайт')}
                      <select
                        aria-label={t('Insight to add', 'Инсайт для добавления')}
                        value={selectedInsightId}
                        onChange={event => setSelectedInsightId(event.target.value)}
                        required
                      >
                        <option value="">{t('Choose Insight', 'Выберите инсайт')}</option>
                        {insights.map(insight => (
                          <option key={insight.id} value={insight.id}>
                            {insight.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button type="submit">
                      <Plus aria-hidden="true" /> {t('Add Insight', 'Добавить инсайт')}
                    </button>
                  </form>
                  <form
                    onSubmit={event => {
                      event.preventDefault();
                      addWidget.mutate({
                        dashboardId: selected.id,
                        widget: { kind: 'note', title: noteTitle, body: noteBody },
                      });
                      setNoteTitle('');
                      setNoteBody('');
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
                    <button type="submit">
                      <FileText aria-hidden="true" /> {t('Add note', 'Добавить заметку')}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        noteTitle &&
                        addWidget.mutate({
                          dashboardId: selected.id,
                          widget: { kind: 'header', title: noteTitle, body: noteBody },
                        })
                      }
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
                  'A dashboard change failed. Existing widgets remain available.',
                  'Не удалось изменить дашборд. Существующие виджеты остаются доступными.',
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
        open={createOpen}
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
          <button type="submit" disabled={create.isPending}>
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
  const { animate } = useVisualMotion();
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
  const eventLabel = (label: string) =>
    guest
      ? ({
          signup: t('Signup', 'Регистрация'),
          onboarding_completed: t('Onboarding completed', 'Завершили онбординг'),
          core_feature_used: t('Core feature used', 'Использовали функцию'),
        }[label] ?? label)
      : label;
  const rows = result.data?.data.mode === 'funnel' ? funnelSteps : (result.data?.data.rows ?? []);
  const visibleRows = rows.slice(
    0,
    result.data?.data.mode === 'funnel' && !hasFunnelSegments ? 8 : 6,
  );
  const rowLabel = (row: (typeof rows)[number]) => {
    if ('label' in row)
      return 'segment' in row && row.segment ? `${row.segment} · ${row.label}` : row.label;
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
          <p>{t('Insight', 'Инсайт')}</p>
          <h3>{widget.insight.title}</h3>
        </div>
        <span data-context={applied.state}>
          {applied.state === 'incompatible'
            ? t('Override incompatible', 'Переопределение несовместимо')
            : applied.state === 'applied'
              ? t('Context applied', 'Контекст применён')
              : t('Saved context', 'Сохранённый контекст')}
        </span>
      </header>
      {applied.state === 'incompatible' ? (
        <div className={styles.widgetError}>
          <AlertTriangle aria-hidden="true" />
          <p>{applied.reasons.join(' ')}</p>
        </div>
      ) : result.isPending ? (
        <p role="status">{t('Loading Insight…', 'Загрузка инсайта…')}</p>
      ) : result.error ? (
        <div className={styles.widgetError}>
          <AlertTriangle aria-hidden="true" />
          <p>{t('This widget could not be loaded.', 'Не удалось загрузить этот виджет.')}</p>
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
                {result.data.exactness === 'exact'
                  ? t('Exact count', 'Точный подсчёт')
                  : t('Estimate', 'Оценка')}{' '}
                · {new Date(result.data.freshnessAt).toLocaleTimeString(locale)}
              </small>
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
          {funnelSteps.length && !hasFunnelSegments ? (
            <ol
              className={styles.funnelBars}
              aria-label={t('Funnel conversion by step', 'Конверсия воронки по шагам')}
            >
              {funnelSteps.map(row => (
                <li key={row.step}>
                  <span title={row.label}>{eventLabel(row.label)}</span>
                  <div aria-hidden="true">
                    <motion.i
                      style={{
                        width: `${row.overallConversionRate * 100}%`,
                        transformOrigin: 'left',
                      }}
                      initial={animate ? { scaleX: 0 } : false}
                      animate={{ scaleX: 1 }}
                      transition={{
                        type: 'tween',
                        duration: animate ? 0.6 : 0,
                        delay: animate ? row.step * 0.08 : 0,
                        ease: 'easeOut',
                      }}
                    />
                  </div>
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
          ) : null}
          <table>
            <caption>
              {t('Data for', 'Данные для')} {widget.insight.title}
            </caption>
            <thead>
              <tr>
                <th scope="col">{t('Value', 'Значение')}</th>
                <th scope="col">{t('Count', 'Количество')}</th>
                {funnelSteps.length ? <th scope="col">{t('Conversion', 'Конверсия')}</th> : null}
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
          <details>
            <summary>{t('Definition and freshness', 'Определение и свежесть')}</summary>
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
