'use client';
import { useId, useState } from 'react';
import { useStudioLocale } from '@/features/i18n/useStudioLocale';
import type { AnalysisFunnelStepRow } from '@/server/analytics/contracts';
import { eventLabel } from './eventLabel';
import styles from './FunnelTrace.module.css';
import { useVisualMotion } from './MotionPreferences';

const colors = [
  '#8b72ef',
  '#6092ed',
  '#4bb9cc',
  '#6198d0',
  '#a38acb',
  '#a881b9',
  '#a57b94',
  '#9986ad',
];
export function FunnelTrace({
  steps,
  onInspect,
}: {
  steps: AnalysisFunnelStepRow[];
  onInspect: (row: AnalysisFunnelStepRow) => void;
}) {
  const { locale, t } = useStudioLocale();
  const { animate } = useVisualMotion();
  const uid = useId().replaceAll(':', '');
  const [active, setActive] = useState<number>();
  const groups = [...new Set(steps.map(row => row.segment ?? ''))];
  return (
    <figure
      className={styles.figure}
      aria-label={t('Ordered funnel conversion chart', 'График конверсии упорядоченной воронки')}
      data-animate={animate}
    >
      <figcaption>
        {t('The path to value', 'Путь к ценности')}{' '}
        <span>
          {t(
            'Unique users · conversion from the first step',
            'Уникальные пользователи · конверсия от первого шага',
          )}
        </span>
      </figcaption>
      {groups.map((segment, groupIndex) => {
        const rows = steps.filter(row => (row.segment ?? '') === segment);
        const gap = 1000 / Math.max(rows.length, 1);
        return (
          <div key={segment} className={styles.group}>
            {segment ? <h3>{segment}</h3> : null}
            <div
              className={styles.labels}
              style={{ gridTemplateColumns: `repeat(${rows.length},minmax(0,1fr))` }}
            >
              {rows.map((row, i) => (
                <button
                  key={row.step}
                  type="button"
                  onMouseEnter={() => setActive(row.step)}
                  onMouseLeave={() => setActive(undefined)}
                  onFocus={() => setActive(row.step)}
                  onBlur={() => setActive(undefined)}
                  onClick={() => onInspect(row)}
                  aria-label={`${t('Explore drop-off', 'Исследовать отток')}: ${eventLabel(row.label, locale)}`}
                  data-highlight={active === row.step || undefined}
                >
                  <span className={styles.label}>
                    <i style={{ background: colors[i % colors.length] }} />
                    {eventLabel(row.label, locale)}
                  </span>
                  <strong>
                    {row.converted.toLocaleString(locale)}
                    <small>
                      {new Intl.NumberFormat(locale, {
                        style: 'percent',
                        maximumFractionDigits: 1,
                      }).format(row.overallConversionRate)}
                    </small>
                  </strong>
                  <span className={styles.mobileTrack} aria-hidden="true">
                    <i
                      style={{
                        width: `${Math.max(0, Math.min(100, row.overallConversionRate * 100))}%`,
                        background: `linear-gradient(90deg,${colors[i % colors.length]},${colors[Math.min(i + 1, colors.length - 1)]})`,
                      }}
                    />
                  </span>
                </button>
              ))}
            </div>
            <svg
              className={styles.flow}
              viewBox="0 0 1000 130"
              aria-hidden="true"
              preserveAspectRatio="none"
            >
              <defs>
                {rows.map((_, i) => (
                  <linearGradient key={i} id={`${uid}-${groupIndex}-${i}`}>
                    <stop stopColor={colors[i % colors.length]} />
                    <stop offset="1" stopColor={colors[Math.min(i + 1, colors.length - 1)]} />
                  </linearGradient>
                ))}
              </defs>
              {rows.map((row, i) => {
                const height = Math.max(row.overallConversionRate * 86, row.converted ? 3 : 0);
                const start = i * gap + 8,
                  width = gap * 0.7,
                  top = 65 - height / 2;
                const next = rows[i + 1],
                  nextHeight = next
                    ? Math.max(next.overallConversionRate * 86, next.converted ? 3 : 0)
                    : 0;
                const from = start + width,
                  to = (i + 1) * gap + 8,
                  mid = (from + to) / 2;
                return (
                  <g
                    key={row.step}
                    opacity={active !== undefined && active !== row.step ? '.45' : '1'}
                  >
                    {next ? (
                      <path
                        d={`M${from},${top} C${mid},${top} ${mid},${65 - nextHeight / 2} ${to},${65 - nextHeight / 2} L${to},${65 + nextHeight / 2} C${mid},${65 + nextHeight / 2} ${mid},${65 + height / 2} ${from},${65 + height / 2} Z`}
                        fill={`url(#${uid}-${groupIndex}-${i})`}
                        opacity=".22"
                      />
                    ) : null}
                    <rect
                      className={styles.bar}
                      x={start}
                      y={top}
                      width={Math.max(1, width)}
                      height={height}
                      rx="7"
                      fill={`url(#${uid}-${groupIndex}-${i})`}
                      style={{ animationDelay: `${i * 0.1}s` }}
                    />
                  </g>
                );
              })}
            </svg>
          </div>
        );
      })}
    </figure>
  );
}
