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
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { dateInputToUtc } from '@/features/explore/model';
import { useAnalysisResult } from '@/features/explore/useAnalysisQuery';
import { useStudioLocale } from '@/features/i18n/useStudioLocale';
import { ExportControls } from '@/features/exports/ExportControls';
import { useInsights } from '@/features/insights/useInsights';
import { StudioState } from '@/features/studio-shell/StudioState';
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
        message={t(
          'Preparing reusable Insight references.',
          'Подготавливаем ссылки на повторно используемые инсайты.',
        )}
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
          <p>
            {t(
              'Reusable Insights · shared context · isolated failures',
              'Повторно используемые инсайты · общий контекст · изолированные ошибки',
            )}
          </p>
          <h1>{t('Dashboards', 'Дашборды')}</h1>
          <span>
            {t('Curate decision surfaces for', 'Собирайте панели решений для')} {projectName}{' '}
            {t('without copying analytical queries.', 'без копирования аналитических запросов.')}
          </span>
        </div>
        <form
          onSubmit={event => {
            event.preventDefault();
            createDashboard();
          }}
        >
          <label>
            <span className="sr-only">{t('New dashboard title', 'Название нового дашборда')}</span>
            <input
              aria-label={t('New dashboard title', 'Название нового дашборда')}
              value={newTitle}
              onChange={event => setNewTitle(event.target.value)}
              placeholder={t('Executive product pulse', 'Пульс продукта для руководства')}
              required
            />
          </label>
          <button type="submit" disabled={create.isPending}>
            <Plus aria-hidden="true" /> {t('Create dashboard', 'Создать дашборд')}
          </button>
        </form>
      </header>

      {!list.length ? (
        <StudioState
          variant="empty"
          title={t('No dashboards yet', 'Дашбордов пока нет')}
          message={t(
            'Name the first dashboard above, then add existing Insights.',
            'Назовите первый дашборд и добавьте существующие инсайты.',
          )}
        />
      ) : selected ? (
        <div className={styles.layout}>
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

          <main className={styles.canvas}>
            <div className={styles.dashboardHeader}>
              <div>
                <p>
                  {selected.owner.username} · {t('updated', 'обновлено')}{' '}
                  {new Date(selected.updatedAt).toLocaleString(locale)}
                </p>
                <h2>{selected.title}</h2>
                <span>
                  {selected.description || t('No dashboard description', 'Без описания дашборда')}
                </span>
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
                <div className={styles.contextEditor}>
                  <h3>
                    <Settings2 aria-hidden="true" /> {t('Global context', 'Общий контекст')}
                  </h3>
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
                  <article
                    key={widget.id}
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
                  </article>
                ))}
              </div>
            )}
          </main>
        </div>
      ) : null}
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
  const applied = useMemo(
    () => (widget.insight?.query ? applyDashboardContext(widget.insight.query, context) : null),
    [context, widget.insight?.query],
  );
  const result = useAnalysisResult(
    applied && applied.state !== 'incompatible' ? applied.query : undefined,
  );

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
          <p>
            {t('Insight', 'Инсайт')} · {widget.insight.owner.username}
          </p>
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
            <ExportControls projectId={applied.query.projectId} source={{ kind: 'analysis', query: applied.query }} disabled={result.isFetching} />
            <strong>
              {result.data.data.rows
                .reduce(
                  (sum, row: any) => sum + Number(row.value ?? row.converted ?? row.retained ?? 0),
                  0,
                )
                .toLocaleString(locale)}
            </strong>
            <span>
              {result.data.exactness} · {result.data.cache} ·{' '}
              {new Date(result.data.freshnessAt).toLocaleTimeString(locale)}
            </span>
          </div>
          <table>
            <caption>
              {t('Data for', 'Данные для')} {widget.insight.title}
            </caption>
            <thead>
              <tr>
                <th scope="col">{t('Value', 'Значение')}</th>
                <th scope="col">{t('Count', 'Количество')}</th>
              </tr>
            </thead>
            <tbody>
              {result.data.data.rows.slice(0, 6).map((row: any, index) => (
                <tr
                  key={`${row.kind ?? 'metric'}-${row.bucket ?? row.key ?? row.cohortStart ?? row.step}-${index}`}
                >
                  <th scope="row">
                    {row.label ?? row.bucket ?? row.key ?? `${row.cohortStart} · P${row.period}`}
                  </th>
                  <td>
                    {Number(row.value ?? row.converted ?? row.retained ?? 0).toLocaleString(locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <details>
            <summary>{t('Definition and freshness', 'Определение и свежесть')}</summary>
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
