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
  SlidersHorizontal,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ExportControls } from '@/features/exports/ExportControls';
import { useGuestWorkspace } from '@/features/guest/GuestWorkspaceContext';
import { useStudioLocale } from '@/features/i18n/useStudioLocale';
import { InsightLibrary, SaveInsightDialog } from '@/features/insights/InsightLibrary';
import { AccessibleDialog } from '@/features/studio-shell/AccessibleDialog';
import { StudioState } from '@/features/studio-shell/StudioState';
import { eventLabel } from '@/features/visual/eventLabel';
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
import { createChartScale } from './chartScale';
import styles from './ExploreWorkspace.module.css';
import { GuestQuestions } from './GuestQuestions';
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
  withAnalysisMode,
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

function safeQuery(params: URLSearchParams, projectId: string, defaultQuery?: AnalysisQueryV1) {
  if (!params.has('aqv')) {
    return { query: defaultQuery ?? createDefaultAnalysisQuery(projectId) };
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

export function ExploreWorkspace({ projectId }: { projectId: string; projectName: string }) {
  const { t, locale } = useStudioLocale();
  const guest = useGuestWorkspace();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const paramsKey = searchParams.toString();
  const restored = useMemo(
    () => safeQuery(new URLSearchParams(paramsKey), projectId, guest?.defaultQuery),
    [paramsKey, projectId, guest?.defaultQuery],
  );
  const [draft, setDraft] = useState<AnalysisQueryV1>(
    () => restored.query ?? createDefaultAnalysisQuery(projectId),
  );
  const [activeBlock, setActiveBlock] = useState<BlockId>('signal');
  const [selectedRow, setSelectedRow] = useState<DisplayRow>();
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [saveOpen, setSaveOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [queryError, setQueryError] = useState('');
  const [libraryOpen, setLibraryOpen] = useState(false);
  const result = useAnalysisResult(restored.error ? undefined : restored.query);

  useEffect(() => {
    if (!searchParams.has('aqv')) {
      const query = guest?.defaultQuery ?? createDefaultAnalysisQuery(projectId);
      router.replace(`${pathname}?${serializeAnalysisQuery(query)}`, { scroll: false });
    }
  }, [pathname, projectId, router, searchParams, guest?.defaultQuery]);

  useEffect(() => {
    if (restored.query) setDraft(restored.query);
  }, [restored.query]);

  const apply = () => {
    try {
      const serialized = serializeAnalysisQuery(draft);
      setQueryError('');
      setEditorOpen(false);
      if (serialized === serializeAnalysisQuery(restored.query)) {
        void result.refetch();
      } else {
        router.push(`${pathname}?${serialized}`, { scroll: false });
      }
    } catch {
      setQueryError(
        t(
          'Check the event, filters and dates before running.',
          'Проверьте событие, фильтры и даты перед запуском.',
        ),
      );
      setActiveBlock('context');
    }
  };

  const resetFilters = () => {
    const nextParams = resetAnalysisFilters(searchParams);
    router.push(`${pathname}?${nextParams}`, { scroll: false });
  };

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), 1400);
    } catch {
      setCopyState('failed');
    }
  };

  const composer = (
    <>
      <div className={styles.spineHeading}>
        <p className={styles.eyebrow}>{t('Query Spine', 'Цепочка анализа')}</p>
        <h2>{t('Question definition', 'Определение вопроса')}</h2>
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
              <strong>
                {t(
                  block.label,
                  {
                    signal: 'События',
                    measure: 'Метрика',
                    breakdown: 'Представление',
                    filters: 'Фильтры',
                    context: 'Период',
                  }[block.id],
                )}
              </strong>
              <small>{blockValue(block.id, draft, t)}</small>
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
        {queryError ? (
          <p role="alert" className={styles.help}>
            {queryError}
          </p>
        ) : null}
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
    </>
  );

  return (
    <section
      className={styles.workspace}
      aria-label={t('Explore analysis workspace', 'Рабочая область анализа')}
    >
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>{t('Behavior research', 'Исследование поведения')}</p>
          <h1>
            {restored.query.mode === 'funnel'
              ? t('How far do people get?', 'До какого шага доходят люди?')
              : restored.query.mode === 'retention'
                ? t('What brings people back?', 'Что возвращает людей?')
                : t('How is product use changing?', 'Как используют продукт?')}
          </h1>
          <p>
            {restored.query.mode === 'funnel'
              ? restored.query.funnel?.steps.map(step => eventLabel(step.value, locale)).join(' → ')
              : t('Your question. A reproducible answer.', 'Ваш вопрос. Воспроизводимый ответ.')}
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
            aria-label={t('Insight library', 'Сохранённые анализы')}
            title={t('Insight library', 'Сохранённые анализы')}
          >
            <BookOpen aria-hidden="true" />{' '}
            <span>{t('Insight library', 'Сохранённые анализы')}</span>
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            disabled={!!restored.error}
            onClick={() => setSaveOpen(true)}
          >
            <Save aria-hidden="true" /> {t('Save insight', 'Сохранить анализ')}
          </button>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={copyUrl}
            aria-label={
              copyState === 'copied'
                ? t('URL copied', 'URL скопирован')
                : t('Copy URL', 'Копировать URL')
            }
            title={t('Copy URL', 'Копировать URL')}
          >
            {copyState === 'copied' ? (
              <Check aria-hidden="true" />
            ) : (
              <Clipboard aria-hidden="true" />
            )}
            <span>
              {copyState === 'copied'
                ? t('URL copied', 'URL скопирован')
                : t('Copy URL', 'Копировать URL')}
            </span>
          </button>
        </div>
      </header>

      {copyState === 'failed' ? (
        <p role="alert" className={styles.notice}>
          {t(
            'Copying is unavailable. Select and copy the address in your browser.',
            'Копирование недоступно. Выделите и скопируйте адрес в браузере.',
          )}
        </p>
      ) : null}
      {guest ? (
        <GuestQuestions
          baseQuery={guest.defaultQuery}
          onChoose={query => {
            router.push(`${pathname}?${serializeAnalysisQuery(query)}`, { scroll: false });
          }}
        />
      ) : null}

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

      <div className={styles.analysisToolbar}>
        <div
          className={styles.modeTabs}
          role="group"
          aria-label={t('Analysis type', 'Вид анализа')}
        >
          {(['trend', 'breakdown', 'funnel', 'retention'] as const).map(mode => (
            <button
              key={mode}
              type="button"
              aria-pressed={restored.query.mode === mode}
              onClick={() => {
                const next = withAnalysisMode(restored.query, mode);
                setDraft(next);
                setActiveBlock('signal');
                router.push(pathname + '?' + serializeAnalysisQuery(next), { scroll: false });
              }}
            >
              {t(
                {
                  trend: 'Trend',
                  breakdown: 'Breakdown',
                  funnel: 'Funnel',
                  retention: 'Retention',
                }[mode],
                {
                  trend: 'Динамика',
                  breakdown: 'Разбивка',
                  funnel: 'Воронка',
                  retention: 'Удержание',
                }[mode],
              )}
            </button>
          ))}
        </div>
        <button className={styles.mobileEdit} type="button" onClick={() => setEditorOpen(true)}>
          <SlidersHorizontal size={16} aria-hidden="true" />
          {t('Edit query', 'Изменить запрос')}
        </button>
      </div>
      {restored.query ? (
        <div className={styles.instrument}>
          <div
            className={styles.queryTrack}
            role="group"
            aria-label={t('Query Spine', 'Цепочка анализа')}
          >
            {blocks.map(block => (
              <button
                key={block.id}
                type="button"
                onFocus={event =>
                  event.currentTarget.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
                }
                onClick={() => {
                  setActiveBlock(block.id);
                  setEditorOpen(true);
                }}
              >
                <i aria-hidden="true" />
                <span>
                  {t(
                    block.label,
                    {
                      signal: 'События',
                      measure: 'Метрика',
                      breakdown: 'Вид',
                      filters: 'Фильтры',
                      context: 'Период',
                    }[block.id],
                  )}
                </span>
                <strong>{blockValue(block.id, restored.query, t)}</strong>
              </button>
            ))}
          </div>
          <div className={styles.canvas}>
            {restored.error ? (
              <StudioState
                variant="empty"
                title={t('Ready for a valid question', 'Готово к корректному вопросу')}
                message={t(
                  'Edit the Query Spine or start a valid analysis to run the PostgreSQL query.',
                  'Измените цепочку анализа или начните новый анализ, чтобы получить результат.',
                )}
              />
            ) : (
              <ResultCanvas query={restored.query} result={result} onSelectRow={setSelectedRow} />
            )}
          </div>
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
      <AccessibleDialog
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={t('Edit query', 'Изменить запрос')}
        fullScreenOnMobile
      >
        <div className={styles.mobileEditorBody}>{composer}</div>
      </AccessibleDialog>
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

function blockValue(block: BlockId, query: AnalysisQueryV1, t: (en: string, ru: string) => string) {
  switch (block) {
    case 'signal':
      if (query.mode === 'funnel')
        return `${query.funnel?.steps.length ?? 0} ${t('ordered steps', 'последовательных шагов')}`;
      if (query.mode === 'retention')
        return t('Entry → return behavior', 'Первое действие → возвращение');
      return query.measure.key === '*'
        ? t('All custom events', 'Все пользовательские события')
        : query.measure.key;
    case 'measure':
      if (query.mode === 'funnel') {
        const minutes = query.funnel?.conversionWindowMinutes ?? 0;
        return minutes % 60 === 0
          ? new Intl.NumberFormat(t('en-US', 'ru-RU'), {
              style: 'unit',
              unit: 'hour',
              unitDisplay: 'long',
            }).format(minutes / 60)
          : new Intl.NumberFormat(t('en-US', 'ru-RU'), {
              style: 'unit',
              unit: 'minute',
              unitDisplay: 'long',
            }).format(minutes);
      }
      if (query.mode === 'retention')
        return new Intl.NumberFormat(t('en-US', 'ru-RU'), {
          style: 'unit',
          unit: query.retention?.granularity ?? 'day',
          unitDisplay: 'long',
        }).format(query.retention?.periods ?? 0);
      return query.measure.source === 'event' && query.measure.aggregation === 'count'
        ? t('Exact event count', 'Точное число событий')
        : `${query.measure.source} · ${query.measure.aggregation}${query.measure.property ? ' · ' + query.measure.property : ''}`;
    case 'breakdown':
      return query.mode === 'trend'
        ? t('Trend over time', 'Динамика по времени')
        : query.mode === 'funnel'
          ? (query.breakdown?.field ?? t('Funnel', 'Воронка'))
          : query.mode === 'retention'
            ? t('Retention matrix', 'Таблица удержания')
            : (query.breakdown?.field ?? t('Choose dimension', 'Выберите группировку'));
    case 'filters':
      return query.filters.length
        ? `${query.filters.length} · ${query.match === 'all' ? t('match all', 'все условия') : t('match any', 'любое условие')}`
        : t('No filters', 'Без фильтров');
    case 'context':
      return `${new Intl.NumberFormat(t('en-US', 'ru-RU'), { style: 'unit', unit: 'day', unitDisplay: 'long' }).format(Math.ceil((new Date(query.range.endAt).getTime() - new Date(query.range.startAt).getTime()) / 86_400_000))} · ${query.range.timezone}`;
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
  const [dateError, setDateError] = useState(false);
  const updateDate = (field: 'startAt' | 'endAt', value: string) => {
    if (!value) {
      setDateError(true);
      return;
    }
    setDateError(false);
    onChange({ ...query, range: { ...query.range, [field]: dateInputToUtc(value) } });
  };
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
            onChange={event =>
              onChange(withAnalysisMode(query, event.target.value as AnalysisQueryV1['mode']))
            }
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
                <option value="browser">{t('Browser', 'Браузер')}</option>
                <option value="os">{t('Operating system', 'Операционная система')}</option>
                <option value="device">{t('Device', 'Устройство')}</option>
                <option value="country">{t('Country', 'Страна')}</option>
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
            onChange={event => updateDate('startAt', event.target.value)}
          />
        </label>
        <label>
          {t('End date · exclusive', 'Дата окончания · не включается')}
          <input
            aria-label={t('End date', 'Дата окончания')}
            type="date"
            value={query.range.endAt.slice(0, 10)}
            onChange={event => updateDate('endAt', event.target.value)}
          />
        </label>
      </div>
      {dateError ? (
        <p role="alert" className={styles.help}>
          {t(
            'A date is required. The previous date has been kept; choose a new date to change it.',
            'Дата обязательна. Предыдущая дата сохранена; выберите новую, чтобы её изменить.',
          )}
        </p>
      ) : null}
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
  if (result.isPending || result.isPlaceholderData) {
    return (
      <div className={styles.resultState} role="status" aria-live="polite">
        <LoaderCircle className={styles.spin} aria-hidden="true" />
        <h2>{t('Calculating your answer', 'Рассчитываем результат')}</h2>
        <p>
          {t(
            'Checking the events that match your question.',
            'Считаем события, соответствующие вашему вопросу.',
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
        message={t(
          'Check your connection, then try this question again.',
          'Проверьте соединение и повторите расчёт этого вопроса.',
        )}
        action={
          error.status !== 403 ? (
            <button type="button" onClick={() => void result.refetch()}>
              {t('Retry analysis', 'Повторить расчёт')}
            </button>
          ) : undefined
        }
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
  const funnelSteps =
    query.mode === 'funnel' && !query.breakdown
      ? data.data.rows.filter(
          (row): row is import('@/server/analytics/contracts').AnalysisFunnelStepRow =>
            'kind' in row && row.kind === 'funnel-step',
        )
      : [];
  const firstStep = funnelSteps[0];
  const lastStep = funnelSteps.at(-1);
  const answer =
    data.data.total ??
    (firstStep && lastStep
      ? {
          value: lastStep.converted,
          denominator: firstStep.converted,
          rate: lastStep.overallConversionRate,
        }
      : query.mode === 'trend' &&
          query.measure.source === 'event' &&
          query.measure.aggregation === 'count'
        ? { value: rows.reduce((sum, row) => sum + row.value, 0) }
        : undefined);

  return (
    <div className={styles.result} data-mode={query.mode}>
      <header className={styles.resultHeader}>
        <div>
          <p className={styles.eyebrow}>{t('Your answer', 'Результат')}</p>
          <h2>
            {query.mode === 'funnel'
              ? t('From the first step to the last', 'От первого шага до последнего')
              : query.mode === 'retention'
                ? t('Behavioral retention', 'Поведенческое удержание')
                : query.measure.key === '*'
                  ? t('All custom events', 'Все пользовательские события')
                  : query.measure.key}
          </h2>
          <p>
            {comparisonLabel(query, locale)} ·{' '}
            {data.exactness === 'exact'
              ? t('Exact count', 'Точный подсчёт')
              : t('Estimate', 'Оценка')}{' '}
          </p>
        </div>
        <span className={styles.freshness} data-stale={stale || undefined}>
          {stale
            ? t('Stale result', 'Устаревший результат')
            : t('Up to date', 'Актуальный результат')}
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
      {answer ? (
        <section aria-label={t('Range total', 'Итог диапазона')} className={styles.answer}>
          <div>
            <span>
              {query.mode === 'funnel'
                ? t('Completed every step', 'Прошли все шаги')
                : t('Exact range total', 'Точный итог диапазона')}
            </span>
            <strong>{answer.value.toLocaleString(locale)}</strong>
            {query.measure.source === 'revenue' ? ` ${query.measure.property}` : ''}
            {answer.denominator !== undefined ? (
              <small>
                {t('of', 'из')} {answer.denominator.toLocaleString(locale)}{' '}
                {t('eligible users', 'подходящих участников')}
              </small>
            ) : (
              <small>
                {query.measure.aggregation === 'count'
                  ? t('events in the selected range', 'событий за выбранный период')
                  : t('in the selected range', 'за выбранный период')}
              </small>
            )}
          </div>
          {answer.rate != null ? (
            <div>
              <span>{t('Conversion', 'Конверсия')}</span>
              <strong>
                {new Intl.NumberFormat(locale, {
                  style: 'percent',
                  maximumFractionDigits: 1,
                }).format(answer.rate)}
              </strong>
              <small>{t('with the current definition', 'по текущему определению')}</small>
            </div>
          ) : null}
          {data.data.comparisonTotal ? (
            <div>
              <span>{t('Previous period total', 'Итог предыдущего периода')}: </span>
              <strong>{data.data.comparisonTotal.value.toLocaleString(locale)}</strong>
              <small>
                {data.data.comparisonTotal.rate != null
                  ? new Intl.NumberFormat(locale, {
                      style: 'percent',
                      maximumFractionDigits: 1,
                    }).format(data.data.comparisonTotal.rate)
                  : t('in the previous period', 'за предыдущий период')}
              </small>
            </div>
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
          <div>
            <dt>{t('Result generated', 'Результат сформирован')}</dt>
            <dd>{new Date(data.generatedAt).toLocaleString(locale)}</dd>
          </div>
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
  const { locale, t } = useStudioLocale();
  const scale = createChartScale(rows.flatMap(row => [row.value, row.comparison ?? 0]));
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
                <span className={styles.signedTrack}>
                  <span className={styles.zeroLine} style={{ left: `${scale.zero}%` }} />
                  <i
                    style={{
                      left: `${scale.bar(row.value).left}%`,
                      width: `${scale.bar(row.value).width}%`,
                    }}
                  />
                </span>
                {row.comparison !== undefined ? (
                  <span className={styles.signedTrack}>
                    <span className={styles.zeroLine} style={{ left: `${scale.zero}%` }} />
                    <i
                      className={styles.comparisonBar}
                      style={{
                        left: `${scale.bar(row.comparison).left}%`,
                        width: `${scale.bar(row.comparison).width}%`,
                      }}
                    />
                  </span>
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
      const y = scale.lineY(row.value);
      return `${x},${y}`;
    })
    .join(' ');
  const comparisonPoints = rows.every(row => row.comparison !== undefined)
    ? rows
        .map((row, index) => {
          const x = rows.length === 1 ? 50 : (index / (rows.length - 1)) * 100;
          const y = scale.lineY(row.comparison ?? 0);
          return `${x},${y}`;
        })
        .join(' ')
    : undefined;

  return (
    <figure className={styles.chart} role="img" aria-label={label}>
      <figcaption>{label}</figcaption>
      <div className={styles.linePlot}>
        <div
          className={styles.yAxis}
          style={{ position: 'relative', padding: 0 }}
          aria-hidden="true"
        >
          {scale.ticks.map(value => (
            <span
              key={value}
              style={{
                position: 'absolute',
                right: 0,
                top: `${scale.lineY(value)}%`,
                transform: 'translateY(-50%)',
              }}
            >
              {value.toLocaleString(locale, { maximumFractionDigits: 1 })}
            </span>
          ))}
        </div>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <g className={styles.gridLines}>
            <line x1="0" y1="25" x2="100" y2="25" />
            <line x1="0" y1="50" x2="100" y2="50" />
            <line x1="0" y1="75" x2="100" y2="75" />
          </g>
          <line
            className={styles.zeroLine}
            x1="0"
            y1={scale.lineY(0)}
            x2="100"
            y2={scale.lineY(0)}
          />
          <polyline points={points} />
          {comparisonPoints ? (
            <polyline className={styles.comparisonLine} points={comparisonPoints} />
          ) : null}
        </svg>
      </div>
      <div className={styles.xAxis} aria-hidden="true">
        <span>{rows[0]?.key.slice(0, 10)}</span>
        <span>{rows[Math.floor(rows.length / 2)]?.key.slice(0, 10)}</span>
        <span>{rows.at(-1)?.key.slice(0, 10)}</span>
      </div>
      <div className={styles.legend}>
        <span>
          <i aria-hidden="true" />
          {query.measure.key === '*' ? t('All events', 'Все события') : query.measure.key}
        </span>
        {comparisonPoints ? (
          <span>
            <i aria-hidden="true" />
            {t('Previous period', 'Предыдущий период')}
          </span>
        ) : null}
      </div>
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
            {query.comparison !== 'none' ? (
              <th scope="col">{comparisonLabel(query, locale)}</th>
            ) : null}
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
