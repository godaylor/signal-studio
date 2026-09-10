'use client';

import { Search, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useStudioLocale } from '@/features/i18n/useStudioLocale';
import { AccessibleDialog } from '@/features/studio-shell/AccessibleDialog';
import type {
  AnalysisBehavior,
  AnalysisFunnelDurationRow,
  AnalysisFunnelStepRow,
  AnalysisFunnelTrendRow,
  AnalysisQueryV1,
  AnalysisResult,
  AnalysisRetentionRow,
} from '@/server/analytics/contracts';
import { serializeAnalysisQuery } from '@/server/analytics/url-codec';
import styles from './ExploreWorkspace.module.css';
import {
  type AdvancedMemberSelection,
  useAdvancedMembers,
  useCohorts,
  useSaveCohort,
} from './useAnalysisQuery';

function updateBehavior(
  behavior: AnalysisBehavior,
  update: Partial<AnalysisBehavior>,
): AnalysisBehavior {
  return { ...behavior, ...update };
}

function memberEvidenceHref(query: AnalysisQueryV1, sessionId: string) {
  const returnTo = `/studio/${query.projectId}/explore?${serializeAnalysisQuery(query)}`;
  const params = new URLSearchParams({
    sessionId,
    startAt: query.range.startAt,
    endAt: query.range.endAt,
    returnTo,
  });
  return `/studio/${query.projectId}/experience?${params}`;
}

function BehaviorEditor({
  label,
  behavior,
  onChange,
  onRemove,
}: {
  label: string;
  behavior: AnalysisBehavior;
  onChange: (behavior: AnalysisBehavior) => void;
  onRemove?: () => void;
}) {
  const { t } = useStudioLocale();
  return (
    <div className={styles.filterRow}>
      <span>{label}</span>
      <select
        aria-label={`${label} · ${t('type', 'тип')}`}
        value={behavior.type}
        onChange={event =>
          onChange(updateBehavior(behavior, { type: event.target.value as 'event' | 'path' }))
        }
      >
        <option value="event">{t('Event', 'Событие')}</option>
        <option value="path">{t('Path', 'Путь')}</option>
      </select>
      <input
        aria-label={`${label} · ${t('value', 'значение')}`}
        value={behavior.value}
        maxLength={500}
        onChange={event => onChange(updateBehavior(behavior, { value: event.target.value }))}
      />
      {onRemove ? (
        <button
          type="button"
          aria-label={t(`Remove ${label}`, `Удалить: ${label}`)}
          onClick={onRemove}
        >
          <X aria-hidden="true" />
        </button>
      ) : null}
      <div>
        {behavior.filters.map((filter, index) => (
          <div key={`${filter.property}-${index}`} className={styles.filterRow}>
            <input
              aria-label={`${label} · ${t('property', 'свойство')} ${index + 1}`}
              value={filter.property}
              placeholder={t('Property', 'Свойство')}
              onChange={event => {
                const filters = behavior.filters.map((item, itemIndex) =>
                  itemIndex === index ? { ...item, property: event.target.value } : item,
                );
                onChange({ ...behavior, filters });
              }}
            />
            <select
              aria-label={`${label} · ${t('property operator', 'оператор свойства')} ${index + 1}`}
              value={filter.operator}
              onChange={event => {
                const filters = behavior.filters.map((item, itemIndex) =>
                  itemIndex === index
                    ? { ...item, operator: event.target.value as typeof item.operator }
                    : item,
                );
                onChange({ ...behavior, filters });
              }}
            >
              <option value="equals">{t('Equals', 'Равно')}</option>
              <option value="notEquals">{t('Does not equal', 'Не равно')}</option>
              <option value="contains">{t('Contains', 'Содержит')}</option>
              <option value="doesNotContain">{t('Does not contain', 'Не содержит')}</option>
            </select>
            <input
              aria-label={`${label} · ${t('property value', 'значение свойства')} ${index + 1}`}
              value={filter.value}
              placeholder={t('Value', 'Значение')}
              onChange={event => {
                const filters = behavior.filters.map((item, itemIndex) =>
                  itemIndex === index ? { ...item, value: event.target.value } : item,
                );
                onChange({ ...behavior, filters });
              }}
            />
            <button
              type="button"
              aria-label={t(
                `Remove ${label} property filter ${index + 1}`,
                `Удалить фильтр свойства ${index + 1}: ${label}`,
              )}
              onClick={() =>
                onChange({
                  ...behavior,
                  filters: behavior.filters.filter((_, item) => item !== index),
                })
              }
            >
              <X aria-hidden="true" />
            </button>
          </div>
        ))}
        <button
          type="button"
          className={styles.textButton}
          disabled={behavior.type === 'path' || behavior.filters.length >= 4}
          onClick={() =>
            onChange({
              ...behavior,
              filters: [
                ...behavior.filters,
                { property: 'plan', operator: 'equals', value: 'pro' },
              ],
            })
          }
        >
          {t('Add step property filter', 'Добавить фильтр свойства шага')}
        </button>
      </div>
    </div>
  );
}

export function AdvancedSignalEditor({
  query,
  onChange,
}: {
  query: AnalysisQueryV1;
  onChange: (query: AnalysisQueryV1) => void;
}) {
  const { t } = useStudioLocale();
  if (query.mode === 'funnel' && query.funnel) {
    const funnel = query.funnel;
    return (
      <fieldset>
        <legend>{t('Ordered funnel steps', 'Упорядоченные шаги воронки')}</legend>
        <p className={styles.help}>
          {t(
            'Two to eight steps. Every property filter applies only to its step.',
            'От двух до восьми шагов. Каждый фильтр свойства применяется только к своему шагу.',
          )}
        </p>
        {funnel.steps.map((step, index) => (
          <BehaviorEditor
            key={index}
            label={t(`Step ${index + 1}`, `Шаг ${index + 1}`)}
            behavior={step}
            onChange={next => {
              const steps = funnel.steps.map((item, itemIndex) =>
                itemIndex === index ? next : item,
              );
              onChange({
                ...query,
                measure: { ...query.measure, key: steps[0].value.slice(0, 50) },
                funnel: { ...funnel, steps },
              });
            }}
            onRemove={
              index >= 2
                ? () =>
                    onChange({
                      ...query,
                      funnel: {
                        ...funnel,
                        steps: funnel.steps.filter((_, item) => item !== index),
                      },
                    })
                : undefined
            }
          />
        ))}
        <button
          type="button"
          className={styles.secondaryButton}
          disabled={funnel.steps.length >= 8}
          onClick={() =>
            onChange({
              ...query,
              funnel: {
                ...funnel,
                steps: [...funnel.steps, { type: 'event', value: 'purchase', filters: [] }],
              },
            })
          }
        >
          {t('Add funnel step', 'Добавить шаг воронки')}
        </button>
      </fieldset>
    );
  }
  if (query.mode === 'retention' && query.retention) {
    const retention = query.retention;
    return (
      <fieldset>
        <legend>{t('Entry and return behaviors', 'Входное и возвратное поведение')}</legend>
        <BehaviorEditor
          label={t('Entry behavior', 'Входное поведение')}
          behavior={retention.entry}
          onChange={entry =>
            onChange({
              ...query,
              measure: { ...query.measure, key: entry.value.slice(0, 50) },
              retention: { ...retention, entry },
            })
          }
        />
        <BehaviorEditor
          label={t('Return behavior', 'Возвратное поведение')}
          behavior={retention.returning}
          onChange={returning => onChange({ ...query, retention: { ...retention, returning } })}
        />
      </fieldset>
    );
  }
  return null;
}

function CohortControls({
  query,
  onChange,
}: {
  query: AnalysisQueryV1;
  onChange: (query: AnalysisQueryV1) => void;
}) {
  const { t } = useStudioLocale();
  const cohorts = useCohorts(query.projectId, query.mode === 'retention');
  const save = useSaveCohort(query.projectId);
  const [name, setName] = useState(() => t('Activation retention', 'Удержание после активации'));
  if (!query.retention) return null;
  const retention = query.retention;
  return (
    <div>
      <label>
        {t('Reuse saved Cohort', 'Использовать сохранённую когорту')}
        <select
          aria-label={t('Reuse saved Cohort', 'Использовать сохранённую когорту')}
          value={retention.cohortId ?? ''}
          onChange={event => {
            const cohort = cohorts.data?.data.find(item => item.id === event.target.value);
            if (!cohort) return;
            onChange({
              ...query,
              filters: cohort.definition.filters,
              match: cohort.definition.match,
              range: { ...query.range, unit: cohort.definition.granularity },
              retention: { ...cohort.definition, cohortId: cohort.id },
            });
          }}
        >
          <option value="">{t('Current definition', 'Текущее определение')}</option>
          {cohorts.data?.data.map(cohort => (
            <option key={cohort.id} value={cohort.id}>
              {cohort.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t('Cohort name', 'Название когорты')}
        <input
          aria-label={t('Cohort name', 'Название когорты')}
          value={name}
          maxLength={200}
          onChange={event => setName(event.target.value)}
        />
      </label>
      <button
        type="button"
        className={styles.secondaryButton}
        disabled={!name.trim() || save.isPending}
        onClick={() =>
          save.mutate({
            name: name.trim(),
            definition: {
              version: 1,
              entry: retention.entry,
              returning: retention.returning,
              granularity: retention.granularity,
              periods: retention.periods,
              filters: query.filters,
              match: query.match,
            },
          })
        }
      >
        {save.isPending
          ? t('Saving Cohort…', 'Сохранение когорты…')
          : t('Save Cohort', 'Сохранить когорту')}
      </button>
      {save.isSuccess ? (
        <p role="status">
          {t(
            'Cohort saved and ready to reuse.',
            'Когорта сохранена и готова к повторному использованию.',
          )}
        </p>
      ) : null}
      {save.error ? (
        <p role="alert">{t('Cohort could not be saved.', 'Не удалось сохранить когорту.')}</p>
      ) : null}
    </div>
  );
}

export function AdvancedMeasureEditor({
  query,
  onChange,
}: {
  query: AnalysisQueryV1;
  onChange: (query: AnalysisQueryV1) => void;
}) {
  const { t } = useStudioLocale();
  if (query.mode === 'funnel' && query.funnel) {
    const funnel = query.funnel;
    return (
      <fieldset>
        <legend>{t('Funnel measure', 'Метрика воронки')}</legend>
        <label>
          {t('Conversion window · minutes', 'Окно конверсии · минуты')}
          <input
            aria-label={t('Conversion window minutes', 'Окно конверсии в минутах')}
            type="number"
            min={1}
            max={43200}
            value={funnel.conversionWindowMinutes}
            onChange={event =>
              onChange({
                ...query,
                funnel: { ...funnel, conversionWindowMinutes: Number(event.target.value) },
              })
            }
          />
        </label>
        <p className={styles.help}>
          {t(
            'Entrants, per-step conversion, drop-off, overall conversion and time-to-convert are exact.',
            'Вошедшие участники, конверсия по шагам, отток, общая конверсия и время до конверсии рассчитываются точно.',
          )}
        </p>
      </fieldset>
    );
  }
  if (query.mode === 'retention' && query.retention) {
    const retention = query.retention;
    return (
      <fieldset>
        <legend>{t('Retention measure', 'Метрика удержания')}</legend>
        <label>
          {t('Cohort period', 'Период когорты')}
          <select
            aria-label={t('Cohort period', 'Период когорты')}
            value={retention.granularity}
            onChange={event => {
              const granularity = event.target.value as 'day' | 'week' | 'month';
              onChange({
                ...query,
                range: { ...query.range, unit: granularity },
                retention: { ...retention, granularity },
              });
            }}
          >
            <option value="day">{t('Daily', 'Ежедневно')}</option>
            <option value="week">{t('Weekly', 'Еженедельно')}</option>
            <option value="month">{t('Monthly', 'Ежемесячно')}</option>
          </select>
        </label>
        <label>
          {t('Return periods', 'Периоды возврата')}
          <input
            aria-label={t('Return periods', 'Периоды возврата')}
            type="number"
            min={1}
            max={12}
            value={retention.periods}
            onChange={event =>
              onChange({
                ...query,
                retention: { ...retention, periods: Number(event.target.value) },
              })
            }
          />
        </label>
        <CohortControls query={query} onChange={onChange} />
      </fieldset>
    );
  }
  return null;
}

function percent(value: number, locale: string) {
  return `${(value * 100).toLocaleString(locale, { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`;
}

export function AdvancedResults({
  query,
  result,
}: {
  query: AnalysisQueryV1;
  result: AnalysisResult;
}) {
  const { locale, t } = useStudioLocale();
  const [selection, setSelection] = useState<AdvancedMemberSelection>();
  const members = useAdvancedMembers(query, selection);
  const comparison = result.data.comparison ?? [];
  if (query.mode === 'funnel') {
    const rows = result.data.rows as Array<
      AnalysisFunnelStepRow | AnalysisFunnelTrendRow | AnalysisFunnelDurationRow
    >;
    const steps = rows.filter(
      (row): row is AnalysisFunnelStepRow => 'kind' in row && row.kind === 'funnel-step',
    );
    const trend = rows.filter(
      (row): row is AnalysisFunnelTrendRow => 'kind' in row && row.kind === 'funnel-trend',
    );
    const duration = rows.filter(
      (row): row is AnalysisFunnelDurationRow => 'kind' in row && row.kind === 'funnel-duration',
    );
    const comparedSteps = comparison.filter(
      (row): row is AnalysisFunnelStepRow => 'kind' in row && row.kind === 'funnel-step',
    );
    return (
      <>
        <figure
          className={styles.chart}
          aria-label={t(
            'Ordered funnel conversion chart',
            'График конверсии упорядоченной воронки',
          )}
        >
          <figcaption>
            {t(
              'Ordered funnel · exact actors; bar length is overall conversion',
              'Упорядоченная воронка · точные участники; длина столбца — общая конверсия',
            )}
          </figcaption>
          <div className={styles.bars} aria-hidden="true">
            {steps.map(row => (
              <div key={`${row.segment ?? 'all'}-${row.step}`}>
                <span>
                  {row.segment ? `${row.segment} · ` : ''}
                  {row.step}. {row.label}
                </span>
                <div className={styles.barTracks}>
                  <i style={{ width: `${Math.max(row.overallConversionRate * 100, 1)}%` }} />
                </div>
                <b>
                  {row.converted.toLocaleString(locale)} ·{' '}
                  {percent(row.overallConversionRate, locale)}
                </b>
              </div>
            ))}
          </div>
        </figure>
        <div className={styles.tableWrap}>
          <table>
            <caption>
              {t('Equivalent funnel data table', 'Эквивалентная таблица данных воронки')}
            </caption>
            <thead>
              <tr>
                <th scope="col">{t('Step', 'Шаг')}</th>
                <th scope="col">{t('Reached', 'Достигли')}</th>
                <th scope="col">{t('Drop-off', 'Отток')}</th>
                <th scope="col">{t('Step conversion', 'Конверсия шага')}</th>
                <th scope="col">{t('Overall', 'Общая')}</th>
                {query.comparison !== 'none' ? (
                  <th scope="col">{t('Compared reached', 'Достигли в сравнении')}</th>
                ) : null}
                <th scope="col">{t('Evidence', 'Данные')}</th>
              </tr>
            </thead>
            <tbody>
              {steps.map(row => {
                const compared = comparedSteps.find(
                  item => item.step === row.step && item.segment === row.segment,
                );
                return (
                  <tr key={`${row.segment ?? 'all'}-${row.step}`}>
                    <th scope="row">
                      {row.segment ? `${row.segment} · ` : ''}
                      {row.step}. {row.label}
                    </th>
                    <td>{row.converted.toLocaleString(locale)}</td>
                    <td>{row.dropped.toLocaleString(locale)}</td>
                    <td>{percent(row.stepConversionRate, locale)}</td>
                    <td>{percent(row.overallConversionRate, locale)}</td>
                    {query.comparison !== 'none' ? (
                      <td>{compared?.converted.toLocaleString(locale) ?? '—'}</td>
                    ) : null}
                    <td>
                      <button
                        type="button"
                        className={styles.rowButton}
                        onClick={() =>
                          setSelection({ kind: 'funnel-step', step: row.step, outcome: 'dropped' })
                        }
                      >
                        <Search aria-hidden="true" /> {t('Dropped actors', 'Выбывшие участники')}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className={styles.tableWrap}>
          <table>
            <caption>{t('Conversion trend', 'Тренд конверсии')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('Entry bucket', 'Интервал входа')}</th>
                <th scope="col">{t('Entrants', 'Вошли')}</th>
                <th scope="col">{t('Converted', 'Конвертировались')}</th>
                <th scope="col">{t('Rate', 'Доля')}</th>
              </tr>
            </thead>
            <tbody>
              {trend.map(row => (
                <tr key={row.bucket}>
                  <th scope="row">{row.bucket}</th>
                  <td>{row.entrants.toLocaleString(locale)}</td>
                  <td>{row.converted.toLocaleString(locale)}</td>
                  <td>{percent(row.conversionRate, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={styles.tableWrap}>
          <table>
            <caption>
              {t('Time-to-convert distribution', 'Распределение времени до конверсии')}
            </caption>
            <thead>
              <tr>
                <th scope="col">{t('Duration', 'Длительность')}</th>
                <th scope="col">{t('Converted actors', 'Конвертированные участники')}</th>
              </tr>
            </thead>
            <tbody>
              {duration.map(row => (
                <tr key={row.bucket}>
                  <th scope="row">{row.bucket}</th>
                  <td>{row.converted.toLocaleString(locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <MemberDialog
          query={query}
          selection={selection}
          result={members}
          onClose={() => setSelection(undefined)}
        />
      </>
    );
  }

  const rows = result.data.rows as AnalysisRetentionRow[];
  const cohortStarts = [...new Set(rows.map(row => row.cohortStart))];
  const periods = Array.from({ length: (query.retention?.periods ?? 0) + 1 }, (_, index) => index);
  const compared = comparison as AnalysisRetentionRow[];
  return (
    <>
      <div className={styles.tableWrap}>
        <table>
          <caption>
            {t(
              'Retention matrix. Period 0 is cohort size; N means return in that exact period.',
              'Матрица удержания. Период 0 — размер когорты; N означает возврат в конкретном периоде.',
            )}
          </caption>
          <thead>
            <tr>
              <th scope="col">{t('Entry cohort', 'Входная когорта')}</th>
              <th scope="col">{t('Size', 'Размер')}</th>
              {periods.map(period => (
                <th key={period} scope="col">
                  P{period}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cohortStarts.map(cohortStart => {
              const cohort = rows.filter(row => row.cohortStart === cohortStart);
              return (
                <tr key={cohortStart}>
                  <th scope="row">{cohortStart}</th>
                  <td>{(cohort[0]?.cohortSize ?? 0).toLocaleString(locale)}</td>
                  {periods.map(period => {
                    const cell = cohort.find(row => row.period === period);
                    const comparisonCell = compared.find(
                      row => row.cohortStart === cohortStart && row.period === period,
                    );
                    return (
                      <td key={period}>
                        <button
                          type="button"
                          className={styles.rowButton}
                          aria-label={t(
                            `${cohortStart}, period ${period}: ${cell?.retained ?? 0} retained, ${percent(cell?.retentionRate ?? 0, locale)}`,
                            `${cohortStart}, период ${period}: удержано ${cell?.retained ?? 0}, ${percent(cell?.retentionRate ?? 0, locale)}`,
                          )}
                          onClick={() =>
                            setSelection({ kind: 'retention-cell', cohortStart, period })
                          }
                        >
                          {percent(cell?.retentionRate ?? 0, locale)}
                          <small>
                            {cell?.retained ?? 0}
                            {comparisonCell ? ` / ${comparisonCell.retained}` : ''}
                          </small>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className={styles.tableWrap}>
        <table>
          <caption>{t('Weighted retention curve', 'Взвешенная кривая удержания')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('Period', 'Период')}</th>
              <th scope="col">{t('Retained', 'Удержаны')}</th>
              <th scope="col">{t('Eligible cohort members', 'Подходящие участники когорт')}</th>
              <th scope="col">{t('Rate', 'Доля')}</th>
            </tr>
          </thead>
          <tbody>
            {periods.map(period => {
              const cells = rows.filter(row => row.period === period);
              const retained = cells.reduce((sum, row) => sum + row.retained, 0);
              const eligible = cells.reduce((sum, row) => sum + row.cohortSize, 0);
              return (
                <tr key={period}>
                  <th scope="row">P{period}</th>
                  <td>{retained.toLocaleString(locale)}</td>
                  <td>{eligible.toLocaleString(locale)}</td>
                  <td>{percent(eligible ? retained / eligible : 0, locale)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <MemberDialog
        query={query}
        selection={selection}
        result={members}
        onClose={() => setSelection(undefined)}
      />
    </>
  );
}

function MemberDialog({
  query,
  selection,
  result,
  onClose,
}: {
  query: AnalysisQueryV1;
  selection?: AdvancedMemberSelection;
  result: ReturnType<typeof useAdvancedMembers>;
  onClose: () => void;
}) {
  const { locale, t } = useStudioLocale();
  return (
    <AccessibleDialog
      open={!!selection}
      title={t('Exact members', 'Точные участники')}
      description={t(
        'Up to 20 exact actors with linked product user, account and sessions. Aggregate membership remains authoritative.',
        'До 20 точных участников со связанными пользователем, аккаунтом и сессиями. Состав агрегата остаётся источником истины.',
      )}
      onClose={onClose}
    >
      <div className={styles.drawerBody}>
        {result.isPending ? (
          <p role="status">{t('Loading exact members…', 'Загрузка точных участников…')}</p>
        ) : null}
        {result.error ? (
          <p role="alert">
            {t(
              'Member evidence requires identity-sensitive project access.',
              'Для данных об участниках требуется доступ к идентифицирующим данным проекта.',
            )}
          </p>
        ) : null}
        {result.data ? (
          <>
            <p>
              {result.data.total.toLocaleString(locale)}{' '}
              {t('exact actors · showing up to', 'точных участников · показано до')}{' '}
              {result.data.limit.toLocaleString(locale)}
            </p>
            <ul className={styles.sessionList}>
              {result.data.members.map(member => (
                <li key={member.actorId}>
                  <div>
                    <strong>
                      {member.trackedUser?.displayName ??
                        member.trackedUser?.externalId ??
                        member.actorId}
                    </strong>
                    <span>
                      {member.account
                        ? `${t('Account', 'Аккаунт')} ${member.account.name ?? member.account.externalId}`
                        : t('No linked account', 'Нет связанного аккаунта')}
                    </span>
                  </div>
                  <div>
                    <span>
                      {member.sessionIds.length.toLocaleString(locale)}{' '}
                      {t('linked sessions', 'связанных сессий')}
                    </span>
                    {member.sessionIds.map(sessionId => {
                      return (
                        <Link key={sessionId} href={memberEvidenceHref(query, sessionId)}>
                          {t('Open session', 'Открыть сессию')} {sessionId.slice(0, 8)}
                        </Link>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </AccessibleDialog>
  );
}
