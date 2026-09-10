'use client';

import {
  AlertTriangle,
  BookOpen,
  Check,
  Clipboard,
  Filter,
  LoaderCircle,
  Save,
  Search,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ExportControls } from '@/features/exports/ExportControls';
import { useStudioLocale } from '@/features/i18n/useStudioLocale';
import { InsightLibrary, SaveInsightDialog } from '@/features/insights/InsightLibrary';
import { AccessibleDialog } from '@/features/studio-shell/AccessibleDialog';
import { StudioState } from '@/features/studio-shell/StudioState';
import type {
  AnalysisFilter,
  AnalysisOperator,
  AnalysisQueryV1,
  AnalysisResult,
} from '@/server/analytics/contracts';
import { AnalysisValidationError } from '@/server/analytics/errors';
import {
  parseAnalysisQueryUrl,
  resetAnalysisFilters,
  serializeAnalysisQuery,
} from '@/server/analytics/url-codec';
import { AdvancedMeasureEditor, AdvancedResults, AdvancedSignalEditor } from './AdvancedAnalysis';
import styles from './ExploreWorkspace.module.css';
import {
  analysisDimensions,
  analysisOperators,
  analysisSummary,
  comparisonLabel,
  compatibleOperators,
  createDefaultAnalysisQuery,
  type DisplayRow,
  dateInputToUtc,
  mergeAnalysisRows,
} from './model';
import { useAffectedSessions, useAnalysisResult } from './useAnalysisQuery';

const blocks = [
  { id: 'signal', label: 'Signal' },
  { id: 'measure', label: 'Measure' },
  { id: 'breakdown', label: 'Breakdown' },
  { id: 'filters', label: 'Filters' },
  { id: 'context', label: 'Context' },
] as const;

type BlockId = (typeof blocks)[number]['id'];

function drilldownEvidenceHref(query: AnalysisQueryV1, sessionId: string, selected?: DisplayRow) {
  const returnTo = `/studio/${query.projectId}/explore?${serializeAnalysisQuery(query)}`;
  const pathFilter = query.filters.find(
    filter => filter.field === 'urlPath' && filter.operator === 'equals',
  );
  const selectedPath =
    query.mode === 'breakdown' && query.breakdown?.field === 'urlPath' ? selected?.key : undefined;
  const params = new URLSearchParams({
    sessionId,
    startAt: query.range.startAt,
    endAt: query.range.endAt,
    returnTo,
  });
  if (selectedPath ?? pathFilter?.value) {
    params.set('urlPath', selectedPath ?? pathFilter?.value ?? '');
  }
  return `/studio/${query.projectId}/experience?${params}`;
}

function safeQuery(params: URLSearchParams, projectId: string) {
  if (!params.has('aqv')) {
    return { query: createDefaultAnalysisQuery(projectId) };
  }

  try {
    const query = parseAnalysisQueryUrl(params);
    if (query.projectId !== projectId) {
      throw new AnalysisValidationError(
        'analysis-project-mismatch',
        'This analytical URL belongs to another project.',
      );
    }
    return { query };
  } catch (error) {
    return {
      query: createDefaultAnalysisQuery(projectId),
      error: error instanceof Error ? error.message : 'This analytical URL could not be restored.',
    };
  }
}

function setFilter(
  query: AnalysisQueryV1,
  index: number,
  update: Partial<AnalysisFilter>,
): AnalysisQueryV1 {
  const filters = query.filters.map((filter, itemIndex) => {
    if (itemIndex !== index) return filter;
    const next = { ...filter, ...update };
    const operators = compatibleOperators(next.field);
    return operators.includes(next.operator) ? next : { ...next, operator: operators[0] };
  });
  return { ...query, filters };
}

export function ExploreWorkspace({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const { t } = useStudioLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const paramsKey = searchParams.toString();
  const restored = useMemo(
    () => safeQuery(new URLSearchParams(paramsKey), projectId),
    [paramsKey, projectId],
  );
  const [draft, setDraft] = useState<AnalysisQueryV1>(
    () => restored.query ?? createDefaultAnalysisQuery(projectId),
  );
  const [activeBlock, setActiveBlock] = useState<BlockId>('signal');
  const [selectedRow, setSelectedRow] = useState<DisplayRow>();
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');
  const [saveOpen, setSaveOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const result = useAnalysisResult(restored.error ? undefined : restored.query);

  useEffect(() => {
    if (!searchParams.has('aqv')) {
      const query = createDefaultAnalysisQuery(projectId);
      router.replace(`${pathname}?${serializeAnalysisQuery(query)}`, { scroll: false });
    }
  }, [pathname, projectId, router, searchParams]);

  useEffect(() => {
    if (restored.query) setDraft(restored.query);
  }, [restored.query]);

  const apply = () => {
    try {
      const serialized = serializeAnalysisQuery(draft);
      router.push(`${pathname}?${serialized}`, { scroll: false });
    } catch {
      setActiveBlock('context');
    }
  };

  const resetFilters = () => {
    const nextParams = resetAnalysisFilters(searchParams);
    router.push(`${pathname}?${nextParams}`, { scroll: false });
  };

  const copyUrl = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopyState('copied');
    window.setTimeout(() => setCopyState('idle'), 1400);
  };

  return (
    <section
      className={styles.workspace}
      aria-label={t('Explore analysis workspace', 'Рабочая область анализа')}
    >
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>
            {t('Reproducible analysis', 'Воспроизводимая аналитика')} · AnalysisQuery v1
          </p>
          <h1>{t('Explore', 'Анализ')}</h1>
          <p>
            {t('Ask a product-behavior question for', 'Задайте вопрос о поведении продукта для')}{' '}
            {projectName},{' '}
            {t(
              'compare context, and keep the exact definition in the URL.',
              'сравните контекст и сохраните точное определение в URL.',
            )}
          </p>
        </div>
        <div className={styles.headerActions}>
          <ExportControls
            projectId={projectId}
            source={{ kind: 'analysis', query: restored.query }}
            disabled={!!restored.error || !result.data || result.isFetching}
            className={styles.secondaryButton}
          />
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => setLibraryOpen(true)}
          >
            <BookOpen aria-hidden="true" /> {t('Insight library', 'Библиотека инсайтов')}
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            disabled={!!restored.error}
            onClick={() => setSaveOpen(true)}
          >
            <Save aria-hidden="true" /> {t('Save insight', 'Сохранить инсайт')}
          </button>
          <button type="button" className={styles.secondaryButton} onClick={copyUrl}>
            {copyState === 'copied' ? (
              <Check aria-hidden="true" />
            ) : (
              <Clipboard aria-hidden="true" />
            )}
            {copyState === 'copied'
              ? t('URL copied', 'URL скопирован')
              : t('Copy URL', 'Копировать URL')}
          </button>
        </div>
      </header>

      {restored.error ? (
        <StudioState
          variant="error"
          title={t('Question not restored', 'Вопрос не восстановлен')}
          message={t(
            'The analytical URL is invalid or belongs to another project.',
            'Аналитический URL недействителен или относится к другому проекту.',
          )}
          action={
            <button
              type="button"
              onClick={() => {
                const query = createDefaultAnalysisQuery(projectId);
                router.replace(`${pathname}?${serializeAnalysisQuery(query)}`);
              }}
            >
              {t('Start a valid analysis', 'Начать корректный анализ')}
            </button>
          }
        />
      ) : null}

      {restored.query ? (
        <div className={styles.instrument}>
          <aside className={styles.spine} aria-labelledby="query-spine-heading">
            <div className={styles.spineHeading}>
              <p className={styles.eyebrow}>Query Spine</p>
              <h2 id="query-spine-heading">{t('Question definition', 'Определение вопроса')}</h2>
            </div>
            <ol className={styles.blockList}>
              {blocks.map((block, index) => (
                <li key={block.id} data-active={activeBlock === block.id || undefined}>
                  <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                  <button
                    type="button"
                    aria-pressed={activeBlock === block.id}
                    onClick={() => setActiveBlock(block.id)}
                  >
                    <strong>{block.label}</strong>
                    <small>{blockValue(block.id, draft)}</small>
                  </button>
                </li>
              ))}
            </ol>

            <form
              className={styles.editor}
              onSubmit={event => {
                event.preventDefault();
                apply();
              }}
            >
              <QueryBlockEditor block={activeBlock} query={draft} onChange={setDraft} />
              <div className={styles.editorActions}>
                <button type="submit" className={styles.primaryButton}>
                  {t('Run analysis', 'Выполнить анализ')}
                </button>
                <button
                  type="button"
                  className={styles.textButton}
                  onClick={() => {
                    setDraft({ ...draft, filters: [], match: 'all' });
                    resetFilters();
                  }}
                >
                  {t('Reset filters only', 'Сбросить только фильтры')}
                </button>
              </div>
            </form>
          </aside>

          <main className={styles.canvas}>
            {restored.error ? (
              <StudioState
                variant="empty"
                title={t('Ready for a valid question', 'Готово к корректному вопросу')}
                message={t(
                  'Edit the Query Spine or start a valid analysis to run the PostgreSQL query.',
                  'Измените Query Spine или начните корректный анализ, чтобы выполнить запрос PostgreSQL.',
                )}
              />
            ) : (
              <ResultCanvas query={restored.query} result={result} onSelectRow={setSelectedRow} />
            )}
          </main>
        </div>
      ) : null}

      {restored.query ? (
        <>
          <DrilldownDialog
            query={restored.query}
            selected={selectedRow}
            onClose={() => setSelectedRow(undefined)}
          />
          <SaveInsightDialog
            open={saveOpen}
            projectId={projectId}
            query={restored.query}
            onClose={() => setSaveOpen(false)}
            onSaved={() => setLibraryOpen(true)}
          />
        </>
      ) : null}
      <InsightLibrary
        open={libraryOpen}
        projectId={projectId}
        onClose={() => setLibraryOpen(false)}
        onReopen={query => {
          router.push(`${pathname}?${serializeAnalysisQuery(query)}`, { scroll: false });
          setLibraryOpen(false);
        }}
      />
    </section>
  );
}

function blockValue(block: BlockId, query: AnalysisQueryV1) {
  switch (block) {
    case 'signal':
      if (query.mode === 'funnel') return `${query.funnel?.steps.length ?? 0} ordered steps`;
      if (query.mode === 'retention') return 'Entry → return behavior';
      return query.measure.key === '*' ? 'All custom events' : query.measure.key;
    case 'measure':
      if (query.mode === 'funnel')
        return `${query.funnel?.conversionWindowMinutes ?? 0} minute window`;
      if (query.mode === 'retention')
        return `${query.retention?.periods ?? 0} ${query.retention?.granularity} periods`;
      return query.measure.source === 'event' && query.measure.aggregation === 'count'
        ? 'Exact event count'
        : `${query.measure.source} · ${query.measure.aggregation}${query.measure.property ? ' · ' + query.measure.property : ''}`;
    case 'breakdown':
      return query.mode === 'trend'
        ? 'Trend over time'
        : query.mode === 'funnel'
          ? (query.breakdown?.field ?? 'Funnel')
          : query.mode === 'retention'
            ? 'Retention matrix'
            : (query.breakdown?.field ?? 'Choose dimension');
    case 'filters':
      return query.filters.length ? `${query.filters.length} · match ${query.match}` : 'No filters';
    case 'context':
      return `${query.range.timezone} · ${comparisonLabel(query)}`;
  }
}

function QueryBlockEditor({
  block,
  query,
  onChange,
}: {
  block: BlockId;
  query: AnalysisQueryV1;
  onChange: (query: AnalysisQueryV1) => void;
}) {
  const { t } = useStudioLocale();
  if (block === 'signal' && (query.mode === 'funnel' || query.mode === 'retention')) {
    return <AdvancedSignalEditor query={query} onChange={onChange} />;
  }

  if (block === 'signal') {
    return (
      <fieldset>
        <legend>{t('Signal', 'Сигнал')}</legend>
        <label>
          {t('Data source', 'Источник данных')}
          <select
            aria-label={t('Data source', 'Источник данных')}
            value={query.measure.source}
            onChange={event => {
              const source = event.target.value as AnalysisQueryV1['measure']['source'];
              onChange({
                ...query,
                mode: 'trend',
                breakdown: undefined,
                filters: [],
                comparisonFilter: undefined,
                comparison: 'previousPeriod',
                measure:
                  source === 'revenue'
                    ? { source, key: '*', aggregation: 'sum', property: 'USD' }
                    : {
                        source,
                        key: source === 'lifecycle' ? 'activated' : '*',
                        aggregation: 'count',
                      },
              });
            }}
          >
            <option value="event">{t('Custom events', 'Пользовательские события')}</option>
            <option value="revenue">{t('Tracked revenue', 'Отслеживаемая выручка')}</option>
            <option value="lifecycle">
              {t('Observed lifecycle cohort', 'Наблюдаемая lifecycle-когорта')}
            </option>
          </select>
        </label>
        <label>
          {t('Event or metric', 'Событие или метрика')}
          <input
            aria-label={t('Event or metric', 'Событие или метрика')}
            value={query.measure.key}
            list="studio-events"
            onChange={event =>
              onChange({ ...query, measure: { ...query.measure, key: event.target.value } })
            }
          />
        </label>
        <datalist id="studio-events">
          <option value="*" />
          <option value="signup" />
          <option value="onboarding_completed" />
          <option value="core_feature_used" />
          <option value="purchase" />
          {query.measure.source === 'lifecycle' ? (
            <>
              <option value="activated" />
              <option value="retained" />
            </>
          ) : null}
        </datalist>
        <p className={styles.help}>
          {t(
            'Use * for all custom events. Raw event names remain unchanged.',
            'Используйте * для всех пользовательских событий. Исходные имена событий не изменяются.',
          )}
        </p>
      </fieldset>
    );
  }

  if (block === 'measure' && (query.mode === 'funnel' || query.mode === 'retention')) {
    return <AdvancedMeasureEditor query={query} onChange={onChange} />;
  }

  if (block === 'measure') {
    return (
      <fieldset>
        <legend>{t('Measure', 'Метрика')}</legend>
        <label>
          {t('Aggregation', 'Агрегация')}
          <select
            aria-label={t('Aggregation', 'Агрегация')}
            value={query.measure.aggregation}
            disabled={query.measure.source !== 'event'}
            onChange={event => {
              const aggregation = event.target.value as AnalysisQueryV1['measure']['aggregation'];
              onChange({
                ...query,
                measure: {
                  ...query.measure,
                  aggregation,
                  property: ['sum', 'average'].includes(aggregation)
                    ? (query.measure.property ?? 'value')
                    : undefined,
                },
              });
            }}
          >
            <option value="count">{t('Count · exact', 'Количество · точно')}</option>
            <option value="uniqueUsers">
              {t('Distinct tracked users', 'Уникальные отслеживаемые пользователи')}
            </option>
            <option value="uniqueAccounts">
              {t('Distinct current accounts', 'Уникальные текущие аккаунты')}
            </option>
            <option value="sessions">{t('Distinct sessions', 'Уникальные сессии')}</option>
            <option value="sum">{t('Sum', 'Сумма')}</option>
            <option value="average">{t('Average', 'Среднее')}</option>
          </select>
        </label>
        <p className={styles.help}>
          {t(
            'Distinct totals are recomputed over the whole range. Account membership is current, not historical. Numeric metrics exclude missing values; revenue requires one currency.',
            'Уникальные итоги вычисляются по всему диапазону. Членство аккаунтов текущее, не историческое. Числовые метрики исключают пропуски; выручка требует одну валюту.',
          )}
        </p>
        {['sum', 'average'].includes(query.measure.aggregation) ? (
          <label>
            {query.measure.source === 'revenue'
              ? t('Currency code', 'Код валюты')
              : t('Numeric property', 'Числовое свойство')}
            <input
              aria-label={
                query.measure.source === 'revenue'
                  ? t('Currency code', 'Код валюты')
                  : t('Numeric property', 'Числовое свойство')
              }
              value={query.measure.property ?? ''}
              maxLength={50}
              onChange={event =>
                onChange({ ...query, measure: { ...query.measure, property: event.target.value } })
              }
            />
          </label>
        ) : null}
      </fieldset>
    );
  }

  if (block === 'breakdown') {
    return (
      <fieldset>
        <legend>{t('Shape', 'Форма')}</legend>
        <label>
          {t('Analysis mode', 'Режим анализа')}
          <select
            aria-label={t('Analysis mode', 'Режим анализа')}
            value={query.mode}
            onChange={event => {
              const mode = event.target.value as AnalysisQueryV1['mode'];
              if (mode === 'funnel') {
                onChange({
                  ...query,
                  mode,
                  comparison: query.comparison === 'previousPeriod' ? 'none' : query.comparison,
                  breakdown: undefined,
                  retention: undefined,
                  funnel: query.funnel ?? {
                    steps: [
                      { type: 'event', value: 'signup', filters: [] },
                      { type: 'event', value: 'onboarding_completed', filters: [] },
                    ],
                    conversionWindowMinutes: 1440,
                  },
                  measure: { source: 'event', key: 'signup', aggregation: 'count' },
                  visualization: 'bar',
                });
                return;
              }
              if (mode === 'retention') {
                onChange({
                  ...query,
                  mode,
                  comparison: query.comparison === 'previousPeriod' ? 'none' : query.comparison,
                  breakdown: undefined,
                  funnel: undefined,
                  retention: query.retention ?? {
                    entry: { type: 'event', value: 'signup', filters: [] },
                    returning: { type: 'event', value: 'core_feature_used', filters: [] },
                    granularity: 'week',
                    periods: 8,
                  },
                  range: { ...query.range, unit: 'week' },
                  measure: { source: 'event', key: 'signup', aggregation: 'count' },
                  visualization: 'matrix',
                });
                return;
              }
              onChange({
                ...query,
                mode,
                funnel: undefined,
                retention: undefined,
                ...(mode === 'breakdown'
                  ? { breakdown: { field: 'urlPath', limit: 10 }, visualization: 'bar' }
                  : { breakdown: undefined, visualization: 'line' }),
              });
            }}
          >
            <option value="trend">{t('Trend', 'Тренд')}</option>
            <option value="breakdown">{t('Breakdown', 'Разбивка')}</option>
            <option value="funnel">{t('Funnel', 'Воронка')}</option>
            <option value="retention">{t('Retention', 'Удержание')}</option>
          </select>
        </label>
        {query.mode === 'breakdown' ? (
          <>
            <label>
              {t('Dimension', 'Измерение')}
              <select
                aria-label={t('Breakdown dimension', 'Измерение разбивки')}
                value={query.breakdown?.field ?? 'urlPath'}
                onChange={event =>
                  onChange({
                    ...query,
                    breakdown: {
                      field: event.target.value as AnalysisFilter['field'],
                      limit: query.breakdown?.limit ?? 10,
                    },
                  })
                }
              >
                <option value="eventName">{t('Event name', 'Имя события')}</option>
                <option value="urlPath">{t('URL path', 'Путь URL')}</option>
              </select>
            </label>
            <label>
              {t('Top values', 'Максимум значений')}
              <input
                aria-label={t('Breakdown limit', 'Лимит разбивки')}
                type="number"
                min={1}
                max={50}
                value={query.breakdown?.limit ?? 10}
                onChange={event =>
                  onChange({
                    ...query,
                    breakdown: {
                      field: query.breakdown?.field ?? 'urlPath',
                      limit: Number(event.target.value),
                    },
                  })
                }
              />
            </label>
          </>
        ) : null}
        {query.mode === 'funnel' ? (
          <>
            <label>
              {t('Optional breakdown', 'Необязательная разбивка')}
              <select
                aria-label={t('Funnel breakdown', 'Разбивка воронки')}
                value={query.breakdown?.field ?? ''}
                onChange={event =>
                  onChange({
                    ...query,
                    breakdown: event.target.value
                      ? {
                          field: event.target.value as AnalysisFilter['field'],
                          limit: query.breakdown?.limit ?? 5,
                        }
                      : undefined,
                  })
                }
              >
                <option value="">{t('None', 'Нет')}</option>
                <option value="browser">{t('Browser', 'Браузер')}</option>
                <option value="os">{t('OS', 'ОС')}</option>
                <option value="device">{t('Device', 'Устройство')}</option>
                <option value="country">{t('Country', 'Страна')}</option>
              </select>
            </label>
            {query.breakdown ? (
              <label>
                {t('Top segments', 'Максимум сегментов')}
                <input
                  aria-label={t('Funnel breakdown limit', 'Лимит разбивки воронки')}
                  type="number"
                  min={1}
                  max={10}
                  value={query.breakdown.limit}
                  onChange={event =>
                    onChange({
                      ...query,
                      breakdown: {
                        field: query.breakdown?.field ?? 'browser',
                        limit: Number(event.target.value),
                      },
                    })
                  }
                />
              </label>
            ) : null}
          </>
        ) : null}
      </fieldset>
    );
  }

  if (block === 'filters') {
    return (
      <fieldset>
        <legend>{t('Filters', 'Фильтры')}</legend>
        <label>
          {t('Match', 'Совпадение')}
          <select
            aria-label={t('Filter match', 'Совпадение фильтров')}
            value={query.match}
            disabled={query.comparison === 'segment' && query.filters.length > 0}
            onChange={event =>
              onChange({ ...query, match: event.target.value as AnalysisQueryV1['match'] })
            }
          >
            <option value="all">{t('All filters', 'Все фильтры')}</option>
            <option value="any">{t('Any filter', 'Любой фильтр')}</option>
          </select>
        </label>
        <div className={styles.filters}>
          {query.filters.map((filter, index) => (
            <FilterEditor
              key={`${index}-${filter.field}`}
              filter={filter}
              label={t(`Filter ${index + 1}`, `Фильтр ${index + 1}`)}
              onChange={next => onChange(setFilter(query, index, next))}
              onRemove={() =>
                onChange({ ...query, filters: query.filters.filter((_, item) => item !== index) })
              }
            />
          ))}
        </div>
        <button
          type="button"
          className={styles.secondaryButton}
          disabled={query.filters.length >= 8}
          onClick={() =>
            onChange({
              ...query,
              filters: [
                ...query.filters,
                { field: 'urlPath', operator: 'contains', value: '/app' },
              ],
            })
          }
        >
          <Filter aria-hidden="true" /> {t('Add filter', 'Добавить фильтр')}
        </button>
      </fieldset>
    );
  }

  return (
    <fieldset>
      <legend>{t('Context', 'Контекст')}</legend>
      <div className={styles.fieldGrid}>
        <label>
          {t('Start date', 'Дата начала')}
          <input
            aria-label={t('Start date', 'Дата начала')}
            type="date"
            value={query.range.startAt.slice(0, 10)}
            onChange={event =>
              onChange({
                ...query,
                range: { ...query.range, startAt: dateInputToUtc(event.target.value) },
              })
            }
          />
        </label>
        <label>
          {t('End date · exclusive', 'Дата окончания · не включается')}
          <input
            aria-label={t('End date', 'Дата окончания')}
            type="date"
            value={query.range.endAt.slice(0, 10)}
            onChange={event =>
              onChange({
                ...query,
                range: { ...query.range, endAt: dateInputToUtc(event.target.value) },
              })
            }
          />
        </label>
      </div>
      <label>
        {t('Timezone', 'Часовой пояс')}
        <select
          aria-label={t('Timezone', 'Часовой пояс')}
          value={query.range.timezone}
          onChange={event =>
            onChange({
              ...query,
              range: {
                ...query.range,
                timezone: event.target.value,
                unit:
                  query.range.unit === 'hour' && event.target.value !== 'UTC'
                    ? 'day'
                    : query.range.unit,
              },
            })
          }
        >
          <option value="UTC">UTC</option>
          <option value="America/New_York">America/New_York</option>
          <option value="Europe/Moscow">Europe/Moscow</option>
        </select>
      </label>
      <label>
        {t('Interval', 'Интервал')}
        <select
          aria-label={t('Interval', 'Интервал')}
          value={query.range.unit}
          onChange={event => {
            const unit = event.target.value as AnalysisQueryV1['range']['unit'];
            onChange({
              ...query,
              range: { ...query.range, unit },
              ...(query.retention && unit !== 'hour'
                ? { retention: { ...query.retention, granularity: unit } }
                : {}),
            });
          }}
        >
          <option value="hour" disabled={query.range.timezone !== 'UTC'}>
            {t('Hour · UTC only', 'Час · только UTC')}
          </option>
          <option value="day">{t('Day', 'День')}</option>
          <option value="week">{t('Week', 'Неделя')}</option>
          <option value="month">{t('Month', 'Месяц')}</option>
        </select>
      </label>
      <label>
        {t('Comparison', 'Сравнение')}
        <select
          aria-label={t('Comparison', 'Сравнение')}
          value={query.comparison}
          onChange={event => {
            const comparison = event.target.value as AnalysisQueryV1['comparison'];
            onChange({
              ...query,
              comparison,
              match: comparison === 'segment' && query.filters.length ? 'all' : query.match,
              comparisonFilter:
                comparison === 'segment'
                  ? (query.comparisonFilter ?? {
                      field: 'urlPath',
                      operator: 'contains',
                      value: '/app',
                    })
                  : undefined,
            });
          }}
        >
          <option value="none">{t('None', 'Нет')}</option>
          <option
            value="previousPeriod"
            disabled={query.mode === 'funnel' || query.mode === 'retention'}
          >
            {t('Previous period', 'Предыдущий период')}
          </option>
          <option value="segment">{t('Selected segment', 'Выбранный сегмент')}</option>
        </select>
      </label>
      {query.comparison === 'segment' && query.comparisonFilter ? (
        <FilterEditor
          filter={query.comparisonFilter}
          label={t('Comparison segment', 'Сегмент сравнения')}
          onChange={next => {
            const field = next.field ?? query.comparisonFilter?.field ?? 'urlPath';
            const operators = compatibleOperators(field);
            const operator = next.operator ?? query.comparisonFilter?.operator ?? operators[0];
            onChange({
              ...query,
              comparisonFilter: {
                ...query.comparisonFilter,
                ...next,
                field,
                operator: operators.includes(operator) ? operator : operators[0],
              } as AnalysisFilter,
            });
          }}
        />
      ) : null}
      <label>
        {t('Result view', 'Представление результата')}
        <select
          aria-label={t('Result view', 'Представление результата')}
          value={query.visualization}
          onChange={event =>
            onChange({
              ...query,
              visualization: event.target.value as AnalysisQueryV1['visualization'],
            })
          }
        >
          <option value="line">{t('Line', 'Линия')}</option>
          <option value="bar">{t('Bars', 'Столбцы')}</option>
          <option value="table">{t('Table only', 'Только таблица')}</option>
          <option value="matrix" disabled={query.mode !== 'retention'}>
            {t('Matrix', 'Матрица')}
          </option>
        </select>
      </label>
    </fieldset>
  );
}

function FilterEditor({
  filter,
  label,
  onChange,
  onRemove,
}: {
  filter: AnalysisFilter;
  label: string;
  onChange: (update: Partial<AnalysisFilter>) => void;
  onRemove?: () => void;
}) {
  const { t } = useStudioLocale();
  const operators = compatibleOperators(filter.field);
  return (
    <div className={styles.filterRow}>
      <span>{label}</span>
      <select
        aria-label={`${label} · ${t('field', 'поле')}`}
        value={filter.field}
        onChange={event => onChange({ field: event.target.value as AnalysisFilter['field'] })}
      >
        {analysisDimensions.map(field => (
          <option key={field} value={field}>
            {field}
          </option>
        ))}
      </select>
      <select
        aria-label={`${label} · ${t('operator', 'оператор')}`}
        value={filter.operator}
        onChange={event => onChange({ operator: event.target.value as AnalysisOperator })}
      >
        {analysisOperators.map(operator => (
          <option key={operator} value={operator} disabled={!operators.includes(operator)}>
            {operator}
          </option>
        ))}
      </select>
      <input
        aria-label={`${label} · ${t('value', 'значение')}`}
        value={filter.value}
        maxLength={200}
        onChange={event => onChange({ value: event.target.value })}
      />
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={t(`Remove ${label}`, `Удалить: ${label}`)}
        >
          <X aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

function ResultCanvas({
  query,
  result,
  onSelectRow,
}: {
  query: AnalysisQueryV1;
  result: ReturnType<typeof useAnalysisResult>;
  onSelectRow: (row: DisplayRow) => void;
}) {
  const { locale, t } = useStudioLocale();
  if (result.isPending) {
    return (
      <div className={styles.resultState} role="status" aria-live="polite">
        <LoaderCircle className={styles.spin} aria-hidden="true" />
        <h2>{t('Running exact PostgreSQL analysis', 'Выполняется точный анализ PostgreSQL')}</h2>
        <p>
          {t(
            'Keeping the chart and table layout stable while the query runs.',
            'Сохраняем стабильную разметку графика и таблицы во время выполнения запроса.',
          )}
        </p>
      </div>
    );
  }

  if (result.error) {
    const error = result.error as Error & { status?: number };
    return (
      <StudioState
        variant={error.status === 403 ? 'permission' : 'error'}
        title={
          error.status === 403
            ? t('Analysis permission required', 'Требуется право на анализ')
            : t('Analysis failed', 'Анализ завершился ошибкой')
        }
        message={t('The analysis could not be loaded.', 'Не удалось загрузить результат анализа.')}
      />
    );
  }

  const data = result.data as AnalysisResult;
  const advanced = query.mode === 'funnel' || query.mode === 'retention';
  if (advanced && !data.data.rows.length) {
    return (
      <StudioState
        variant="empty"
        title={t('No actors matched this behavior', 'Нет участников с таким поведением')}
        message={t(
          'Widen the date range, edit the entry behavior, or remove one filter. The exact definition remains editable.',
          'Расширьте диапазон дат, измените входное поведение или удалите фильтр. Точное определение остаётся доступным для редактирования.',
        )}
      />
    );
  }
  const rows = mergeAnalysisRows(
    data.data.rows as Parameters<typeof mergeAnalysisRows>[0],
    data.data.comparison as Parameters<typeof mergeAnalysisRows>[1],
    query.mode === 'trend' && query.comparison === 'previousPeriod',
  );
  if (!advanced && !rows.length) {
    return (
      <StudioState
        variant="empty"
        title={t('No events matched this question', 'Нет событий, соответствующих вопросу')}
        message={t(
          'Widen the date range, choose another event, or remove one filter. The query remains editable.',
          'Расширьте диапазон дат, выберите другое событие или удалите фильтр. Запрос остаётся доступным для редактирования.',
        )}
      />
    );
  }

  const stale = Date.now() - result.dataUpdatedAt > 120_000;

  return (
    <div className={styles.result}>
      <header className={styles.resultHeader}>
        <div>
          <p className={styles.eyebrow}>{t('Result canvas', 'Область результата')}</p>
          <h2>
            {query.mode === 'funnel'
              ? t('Ordered funnel', 'Упорядоченная воронка')
              : query.mode === 'retention'
                ? t('Behavioral retention', 'Поведенческое удержание')
                : query.measure.key === '*'
                  ? t('All custom events', 'Все пользовательские события')
                  : query.measure.key}
          </h2>
          <p>
            {comparisonLabel(query)} · {data.exactness} · {t('generated', 'сформировано')}{' '}
            {new Date(data.generatedAt).toLocaleString(locale)}
          </p>
        </div>
        <span className={styles.freshness} data-stale={stale || undefined}>
          {stale
            ? t('Stale result', 'Устаревший результат')
            : `${t('Fresh', 'Свежий')} · ${data.cache}`}
        </span>
      </header>

      {result.isFetching ? (
        <p className={styles.notice}>
          {t(
            'Updating · last successful result remains visible.',
            'Обновление · последний успешный результат остаётся видимым.',
          )}
        </p>
      ) : null}
      {data.data.total ? (
        <section aria-label={t('Range total', 'Итог диапазона')} className={styles.notice}>
          <p>
            {t('Exact range total', 'Точный итог диапазона')}:{' '}
            {data.data.total.value.toLocaleString(locale)}
            {query.measure.source === 'revenue' ? ` ${query.measure.property}` : ''}
            {data.data.total.denominator !== undefined
              ? ` / ${data.data.total.denominator.toLocaleString(locale)}`
              : ''}
            {data.data.total.rate !== undefined
              ? ` · ${data.data.total.rate === null ? t('No eligible denominator', 'Нет подходящего знаменателя') : new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(data.data.total.rate)}`
              : ''}
          </p>
          {data.data.comparisonTotal ? (
            <p>
              {t('Previous period total', 'Итог предыдущего периода')}:{' '}
              {data.data.comparisonTotal.value.toLocaleString(locale)}
              {data.data.comparisonTotal.rate != null
                ? ` · ${new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(data.data.comparisonTotal.rate)}`
                : ''}
            </p>
          ) : null}
        </section>
      ) : null}
      {data.warnings?.length ? (
        <div className={styles.warning} role="status">
          <AlertTriangle aria-hidden="true" />
          <span>
            {t(
              data.warnings.some(item => item.code === 'lifecycle-observation-incomplete')
                ? 'Partial cohort: its 21-day observation horizon is not complete.'
                : 'Partial result. Some bounded data was omitted.',
              data.warnings.some(item => item.code === 'lifecycle-observation-incomplete')
                ? 'Незрелая когорта: окно наблюдения 21 день ещё не завершено.'
                : 'Частичный результат. Часть ограниченных данных не показана.',
            )}
          </span>
        </div>
      ) : null}
      {stale ? (
        <p className={styles.notice}>
          {t(
            'Last successful result is shown. Run the query again to refresh it.',
            'Показан последний успешный результат. Выполните запрос снова для обновления.',
          )}
        </p>
      ) : null}

      {advanced ? (
        <AdvancedResults query={query} result={data} />
      ) : (
        <>
          {query.visualization !== 'table' ? <ResultChart query={query} rows={rows} /> : null}
          <ResultTable query={query} rows={rows} onSelectRow={onSelectRow} />
        </>
      )}
      <details className={styles.definitions}>
        <summary>{t('Definitions and freshness', 'Определения и свежесть')}</summary>
        <dl>
          {data.definitions.map(definition => (
            <div key={definition.key}>
              <dt>{definition.label}</dt>
              <dd>{definition.description}</dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}

function ResultChart({ query, rows }: { query: AnalysisQueryV1; rows: DisplayRow[] }) {
  const { locale } = useStudioLocale();
  const max = Math.max(...rows.flatMap(row => [row.value, row.comparison ?? 0]), 1);
  const label = analysisSummary(query, rows);

  if (query.visualization === 'bar' || query.mode === 'breakdown') {
    return (
      <figure className={styles.chart} role="img" aria-label={label}>
        <figcaption>{label}</figcaption>
        <div className={styles.bars} aria-hidden="true">
          {rows.map(row => (
            <div key={row.key}>
              <span>{row.key}</span>
              <div className={styles.barTracks}>
                <i style={{ width: `${Math.max((row.value / max) * 100, 1)}%` }} />
                {row.comparison !== undefined ? (
                  <i
                    className={styles.comparisonBar}
                    style={{ width: `${Math.max((row.comparison / max) * 100, 1)}%` }}
                  />
                ) : null}
              </div>
              <b>
                {row.value.toLocaleString(locale)}
                {row.comparison !== undefined ? ` / ${row.comparison.toLocaleString(locale)}` : ''}
              </b>
            </div>
          ))}
        </div>
      </figure>
    );
  }

  const points = rows
    .map((row, index) => {
      const x = rows.length === 1 ? 50 : (index / (rows.length - 1)) * 100;
      const y = 92 - (row.value / max) * 78;
      return `${x},${y}`;
    })
    .join(' ');
  const comparisonPoints = rows.every(row => row.comparison !== undefined)
    ? rows
        .map((row, index) => {
          const x = rows.length === 1 ? 50 : (index / (rows.length - 1)) * 100;
          const y = 92 - ((row.comparison ?? 0) / max) * 78;
          return `${x},${y}`;
        })
        .join(' ')
    : undefined;

  return (
    <figure className={styles.chart} role="img" aria-label={label}>
      <figcaption>{label}</figcaption>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <g className={styles.gridLines}>
          <line x1="0" y1="25" x2="100" y2="25" />
          <line x1="0" y1="50" x2="100" y2="50" />
          <line x1="0" y1="75" x2="100" y2="75" />
        </g>
        <polyline points={points} />
        {comparisonPoints ? (
          <polyline className={styles.comparisonLine} points={comparisonPoints} />
        ) : null}
        {points.split(' ').map(point => {
          const [cx, cy] = point.split(',');
          return <circle key={point} cx={cx} cy={cy} r="1.7" />;
        })}
      </svg>
    </figure>
  );
}

function ResultTable({
  query,
  rows,
  onSelectRow,
}: {
  query: AnalysisQueryV1;
  rows: DisplayRow[];
  onSelectRow: (row: DisplayRow) => void;
}) {
  const { locale, t } = useStudioLocale();
  return (
    <div className={styles.tableWrap}>
      <table>
        <caption>
          {t('Equivalent data table for the chart', 'Эквивалентная таблица данных для графика')}
        </caption>
        <thead>
          <tr>
            <th scope="col">
              {query.mode === 'trend' ? t('Bucket', 'Интервал') : query.breakdown?.field}
            </th>
            <th scope="col">{t('Exact count', 'Точное количество')}</th>
            {query.comparison !== 'none' ? <th scope="col">{comparisonLabel(query)}</th> : null}
            {query.comparison !== 'none' ? <th scope="col">{t('Change', 'Изменение')}</th> : null}
            <th scope="col">{t('Evidence', 'Данные')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.key}>
              <th scope="row">{row.key}</th>
              <td>{row.value.toLocaleString(locale)}</td>
              {query.comparison !== 'none' ? (
                <td>{row.comparison?.toLocaleString(locale) ?? '—'}</td>
              ) : null}
              {query.comparison !== 'none' ? (
                <td>
                  {row.change === null
                    ? t('New', 'Новое')
                    : row.change === undefined
                      ? '—'
                      : `${row.change.toFixed(1)}%`}
                </td>
              ) : null}
              <td>
                <button type="button" className={styles.rowButton} onClick={() => onSelectRow(row)}>
                  <Search aria-hidden="true" /> {t('Drill down', 'Детализация')}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DrilldownDialog({
  query,
  selected,
  onClose,
}: {
  query: AnalysisQueryV1;
  selected?: DisplayRow;
  onClose: () => void;
}) {
  const { locale, t } = useStudioLocale();
  const sessions = useAffectedSessions(query, selected, !!selected);

  return (
    <AccessibleDialog
      open={!!selected}
      title={
        selected
          ? `${t('Affected sessions', 'Затронутые сессии')} · ${selected.key}`
          : t('Affected sessions', 'Затронутые сессии')
      }
      description={t(
        'Bounded evidence matching the selected event, range, base filters and result row where supported.',
        'Ограниченные данные, соответствующие выбранному событию, диапазону, базовым фильтрам и строке результата.',
      )}
      onClose={onClose}
    >
      <div className={styles.drawerBody}>
        {sessions.isPending ? (
          <p role="status">{t('Loading affected sessions…', 'Загрузка затронутых сессий…')}</p>
        ) : null}
        {sessions.error ? (
          <p role="alert">
            {t(
              'Affected sessions could not be loaded. The aggregate result remains available.',
              'Не удалось загрузить затронутые сессии. Агрегированный результат остаётся доступным.',
            )}
          </p>
        ) : null}
        {sessions.data && sessions.data.data.length === 0 ? (
          <p>{t('No matching sessions were found.', 'Совпадающие сессии не найдены.')}</p>
        ) : null}
        {sessions.data?.data.length ? (
          <ul className={styles.sessionList}>
            {sessions.data.data.map(session => (
              <li key={session.id}>
                <div>
                  <strong>
                    {t('Session', 'Сессия')} {session.id.slice(0, 8)}
                  </strong>
                  <span>
                    {session.browser ?? t('Unknown browser', 'Неизвестный браузер')} ·{' '}
                    {session.device ?? t('Unknown device', 'Неизвестное устройство')} ·{' '}
                    {session.country ?? t('Unknown country', 'Страна неизвестна')}
                  </span>
                </div>
                <div>
                  <span>
                    {session.events.toLocaleString(locale)} {t('events', 'событий')} ·{' '}
                    {new Date(session.createdAt).toLocaleString(locale)}
                  </span>
                  <Link href={drilldownEvidenceHref(query, session.id, selected)}>
                    {t('Open evidence', 'Открыть данные')}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        <p className={styles.help}>
          {t(
            'Session evidence is capped at 8 rows. Unsupported property-level membership is never implied.',
            'Данные сессий ограничены 8 строками. Неподдерживаемая принадлежность по свойствам не подразумевается.',
          )}
        </p>
      </div>
    </AccessibleDialog>
  );
}
