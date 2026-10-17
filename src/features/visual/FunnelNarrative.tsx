'use client';

import { useStudioLocale } from '@/features/i18n/useStudioLocale';
import type { AnalysisFunnelStepRow } from '@/server/analytics/contracts';
import { eventLabel } from './eventLabel';
import styles from './FunnelTrace.module.css';

/** Describe observed counts only. Drop-off does not establish why someone left. */
export function summarizeFunnel(steps: AnalysisFunnelStepRow[]) {
  const groups = [...new Set(steps.map(row => row.segment ?? ''))];
  return groups.flatMap(segment => {
    const rows = steps.filter(row => (row.segment ?? '') === segment);
    const first = rows[0];
    const last = rows.at(-1);
    if (!first || !last || first.converted <= 0) return [];
    const losses = rows.slice(1).map((row, index) => ({
      from: rows[index].label,
      to: row.label,
      count: Math.max(0, rows[index].converted - row.converted),
    }));
    const biggest = losses.reduce<(typeof losses)[number] | undefined>(
      (best, loss) => (!best || loss.count > best.count ? loss : best),
      undefined,
    );
    return [{ segment, entered: first.converted, completed: last.converted, biggest }];
  });
}

export function FunnelNarrative({ steps }: { steps: AnalysisFunnelStepRow[] }) {
  const { t, locale } = useStudioLocale();
  const summaries = summarizeFunnel(steps);
  if (!summaries.length) return null;
  const byRate = [...summaries].sort((a, b) => b.completed / b.entered - a.completed / a.entered);
  const best = byRate[0];
  const lowest = byRate.at(-1) ?? best;
  const rate = (value: number) =>
    value.toLocaleString(locale, { style: 'percent', maximumFractionDigits: 1 });
  return (
    <section
      className={styles.narrative}
      aria-label={t('What the result means', 'Что означает результат')}
    >
      <h3>{t('What the result means', 'Что означает результат')}</h3>
      {summaries.length > 1 ? (
        <p className={styles.segmentContrast}>
          <strong>
            {best.segment} · {rate(best.completed / best.entered)}
          </strong>
          <span>{t('vs', 'и')}</span>
          <strong>
            {lowest.segment} · {rate(lowest.completed / lowest.entered)}
          </strong>
          <small>
            {t('Difference in completion', 'Разница в прохождении')}:{' '}
            {(
              (best.completed / best.entered - lowest.completed / lowest.entered) *
              100
            ).toLocaleString(locale, { maximumFractionDigits: 1 })}{' '}
            {t('percentage points', 'п. п.')}
          </small>
        </p>
      ) : null}
      {summaries.map(({ segment, entered, completed, biggest }) => (
        <div key={segment}>
          <p>
            {segment ? <strong>{segment}: </strong> : null}
            {t(
              `${completed.toLocaleString(locale)} of ${entered.toLocaleString(locale)} participants completed every selected step in order.`,
              `${completed.toLocaleString(locale)} из ${entered.toLocaleString(locale)} участников прошли все выбранные шаги по порядку.`,
            )}
          </p>
          {biggest && biggest.count > 0 ? (
            <details className={styles.narrativeDetail}>
              <summary>
                {t('Largest step loss', 'Наибольшая потеря между шагами')}:{' '}
                <strong>{biggest.count.toLocaleString(locale)}</strong>
              </summary>
              <p>
                {eventLabel(biggest.from, locale)} → {eventLabel(biggest.to, locale)}.{' '}
                {t(
                  'The events show where, not why. Select a stage to inspect participants.',
                  'События показывают где, но не почему. Нажмите на этап, чтобы изучить участников.',
                )}
              </p>
            </details>
          ) : null}
        </div>
      ))}
    </section>
  );
}
