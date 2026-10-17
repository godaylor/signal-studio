'use client';
import { useState } from 'react';
import { useStudioLocale } from '@/features/i18n/useStudioLocale';
import type { AnalysisFunnelStepRow } from '@/server/analytics/contracts';
import { eventLabel } from './eventLabel';
import { FlowField } from './FlowField';
import styles from './FunnelTrace.module.css';

export function FunnelTrace({
  steps,
  onInspect,
}: {
  steps: AnalysisFunnelStepRow[];
  onInspect: (row: AnalysisFunnelStepRow) => void;
}) {
  const { locale, t } = useStudioLocale();
  const [active, setActive] = useState<number>();
  const groups = [...new Set(steps.map(row => row.segment ?? ''))];
  return (
    <figure
      className={styles.figure}
      aria-label={t('Ordered funnel conversion chart', 'График конверсии упорядоченной воронки')}
    >
      <figcaption>
        <span>{t('The participant journey', 'Путь участников')}</span>
        <small>{t('Flow width = share of participants', 'Толщина потока = доля участников')}</small>
      </figcaption>
      {groups.map(segment => {
        const rows = steps.filter(row => (row.segment ?? '') === segment);
        return (
          <div key={segment} className={styles.group}>
            {segment ? <h3>{segment}</h3> : null}
            <div
              className={styles.traceViewport}
              role="region"
              aria-label={t(
                'Funnel stages, scroll horizontally for more',
                'Этапы воронки: прокрутите по горизонтали, чтобы увидеть все',
              )}
              tabIndex={0}
            >
              <div style={{ minWidth: rows.length > 3 ? rows.length * 130 : undefined }}>
                <div
                  className={styles.labels}
                  style={{ gridTemplateColumns: `repeat(${rows.length}, minmax(0,1fr))` }}
                >
                  {rows.map((row, i) => (
                    <button
                      key={row.step}
                      type="button"
                      onMouseEnter={() => setActive(i)}
                      onMouseLeave={() => setActive(undefined)}
                      onFocus={() => setActive(i)}
                      onBlur={() => setActive(undefined)}
                      onClick={() => onInspect(row)}
                      aria-label={`${t('Explore drop-off', 'Исследовать отток')}: ${eventLabel(row.label, locale)}`}
                      data-highlight={active === i || undefined}
                    >
                      <span className={styles.label}>{eventLabel(row.label, locale)}</span>
                      <strong>
                        {row.converted.toLocaleString(locale)}
                        <small>
                          {row.overallConversionRate.toLocaleString(locale, {
                            style: 'percent',
                            maximumFractionDigits: 1,
                          })}
                        </small>
                      </strong>
                    </button>
                  ))}
                </div>
                <FlowField values={rows.map(row => row.converted)} active={active} />
                <div
                  className={styles.losses}
                  style={{
                    gridTemplateColumns: `repeat(${Math.max(1, rows.length - 1)}, minmax(0,1fr))`,
                  }}
                >
                  {rows.slice(1).map((row, i) => (
                    <button key={row.step} type="button" onClick={() => onInspect(row)}>
                      <span className={styles.lossDot} aria-hidden="true" />
                      <strong>
                        {Math.max(0, rows[i].converted - row.converted).toLocaleString(locale)}
                      </strong>
                      <span>
                        {t('did not reach', 'не дошли до')}{' '}
                        {eventLabel(row.label, locale).toLocaleLowerCase(locale)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })}
      <p className={styles.caption}>
        {t(
          'Motion shows direction, not incoming events. Select a stage to inspect drop-off.',
          'Движение показывает направление, а не новые события. Выберите этап, чтобы исследовать отток.',
        )}
      </p>
    </figure>
  );
}
