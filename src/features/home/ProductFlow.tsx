'use client';

import { ArrowUpRight } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { useStudioLocale } from '@/features/i18n/useStudioLocale';
import { DataValue } from '@/features/visual/DataValue';
import { useVisualMotion } from '@/features/visual/MotionPreferences';
import { FlowField } from '@/features/visual/FlowField';
import { serializeAnalysisQuery } from '@/server/analytics/url-codec';
import type { HomeMetric } from '@/server/home/contracts';
import styles from './HomeWorkspace.module.css';

const stages = ['signups', 'activation', 'retention'] as const;

export function ProductFlow({ metrics }: { metrics: HomeMetric[] }) {
  const { t, locale } = useStudioLocale();
  const { animate } = useVisualMotion();
  const labels = {
    signups: t('Signed up', 'Регистрация'),
    activation: t('Activated', 'Активация'),
    retention: t('Returned', 'Возвращение'),
  };

  return (
    <div className={styles.productFlow}>
      <FlowField
        className={styles.journeyField}
        values={stages.map(
          id => metrics.find(item => item.id === id)?.result?.data.total.value ?? 0,
        )}
      />
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
              {metric ? (
                <Link
                  href={`/studio/${metric.query.projectId}/explore?${serializeAnalysisQuery(metric.query)}`}
                  className={styles.flowStageLink}
                >
                  <span>
                    {labels[id]} <ArrowUpRight size={13} aria-hidden="true" />
                  </span>
                  <strong>
                    <DataValue value={total?.value.toLocaleString(locale) ?? '—'} />
                  </strong>
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
