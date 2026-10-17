'use client';

import { ArrowUpRight } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { useId } from 'react';
import { useStudioLocale } from '@/features/i18n/useStudioLocale';
import { useVisualMotion } from '@/features/visual/MotionPreferences';
import { serializeAnalysisQuery } from '@/server/analytics/url-codec';
import type { HomeMetric } from '@/server/home/contracts';
import styles from './HomeWorkspace.module.css';

const stages = ['signups', 'activation', 'retention'] as const;

export function ProductFlow({ metrics }: { metrics: HomeMetric[] }) {
  const { t, locale } = useStudioLocale();
  const { animate } = useVisualMotion();
  const gradientId = useId();
  const labels = {
    signups: t('Signed up', 'Регистрация'),
    activation: t('Activated', 'Активация'),
    retention: t('Returned', 'Возвращение'),
  };

  return (
    <div className={styles.productFlow}>
      <div className={styles.flowTrace} aria-hidden="true">
        <svg viewBox="0 0 1000 100" preserveAspectRatio="none">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
              <stop stopColor="var(--studio-cobalt)" />
              <stop offset="1" stopColor="var(--studio-cyan, #8de1e7)" />
            </linearGradient>
          </defs>
          <path
            className={styles.flowTraceBase}
            d="M 0 66 C 190 66 320 40 500 66 S 810 92 1000 66"
          />
          <motion.path
            className={styles.flowTraceActive}
            stroke={`url(#${gradientId})`}
            d="M 0 66 C 190 66 320 40 500 66 S 810 92 1000 66"
            initial={animate ? { pathLength: 0, opacity: 0 } : false}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ type: 'tween', duration: animate ? 0.8 : 0, ease: 'easeInOut' }}
          />
        </svg>
      </div>
      <ol className={styles.flowStages}>
        {stages.map((id, index) => {
          const metric = metrics.find(item => item.id === id);
          const total = metric?.result?.data.total;
          const previous = metric?.result?.data.comparisonTotal;
          const rate = total?.rate;
          const difference =
            id === 'signups'
              ? total && previous
                ? total.value - previous.value
                : null
              : rate != null && previous?.rate != null
                ? (rate - previous.rate) * 100
                : null;

          return (
            <motion.li
              key={id}
              data-stage={id}
              initial={animate ? { y: 10 } : false}
              animate={{ y: 0 }}
              transition={{
                type: 'tween',
                duration: animate ? 0.4 : 0,
                delay: animate ? index * 0.12 : 0,
              }}
            >
              {index > 0 ? (
                <div className={styles.flowConversion}>
                  <strong>
                    {rate == null
                      ? '—'
                      : rate.toLocaleString(locale, { style: 'percent', maximumFractionDigits: 1 })}
                  </strong>
                  <span>
                    {metric?.error
                      ? t('Unavailable', 'Недоступно')
                      : total?.denominator != null
                        ? `${total.value.toLocaleString(locale)} ${t('of', 'из')} ${total.denominator.toLocaleString(locale)}`
                        : t('No eligible users', 'Нет подходящих участников')}
                  </span>
                </div>
              ) : null}
              <span className={styles.flowNode} aria-hidden="true" />
              {metric ? (
                <Link
                  href={`/studio/${metric.query.projectId}/explore?${serializeAnalysisQuery(metric.query)}`}
                  className={styles.flowStageLink}
                >
                  <span>
                    {labels[id]} <ArrowUpRight size={13} aria-hidden="true" />
                  </span>
                  <strong>{total?.value.toLocaleString(locale) ?? '—'}</strong>
                  {metric.error ? (
                    <small>{t('Unavailable', 'Недоступно')}</small>
                  ) : difference != null ? (
                    <small>
                      {difference === 0
                        ? t('Same as previous period', 'Как в прошлом периоде')
                        : `${new Intl.NumberFormat(locale, { signDisplay: 'always', maximumFractionDigits: 1 }).format(difference)} ${id === 'signups' ? t('vs previous period', 'к прошлому периоду') : t('pp vs previous period', 'п. п. к прошлому периоду')}`}
                    </small>
                  ) : (
                    <small>{t('Tracked users', 'Отслеживаемые пользователи')}</small>
                  )}
                </Link>
              ) : (
                <span className={styles.flowStageLink}>
                  <span>{labels[id]}</span>
                  <strong>—</strong>
                </span>
              )}
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}
