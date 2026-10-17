'use client';

import { ArrowUpRight } from 'lucide-react';
import { useStudioLocale } from '@/features/i18n/useStudioLocale';
import type { AnalysisQueryV1 } from '@/server/analytics/contracts';
import styles from './ExploreWorkspace.module.css';

export function GuestQuestions({
  baseQuery,
  onChoose,
}: {
  baseQuery: AnalysisQueryV1;
  onChoose: (query: AnalysisQueryV1) => void;
}) {
  const { t } = useStudioLocale();
  const questions = [
    { label: t('Where do people stop?', 'На каком шаге уходят?'), query: baseQuery },
    {
      label: t('Phone or computer?', 'Телефон или компьютер?'),
      query: { ...baseQuery, breakdown: { field: 'device' as const, limit: 5 } },
    },
    {
      label: t('Who starts a subscription?', 'Кто оформляет подписку?'),
      query: {
        ...baseQuery,
        funnel: baseQuery.funnel
          ? {
              ...baseQuery.funnel,
              steps: baseQuery.funnel.steps.map((step, index, steps) =>
                index === steps.length - 1 ? { ...step, value: 'subscription_started' } : step,
              ),
            }
          : undefined,
      },
    },
  ];
  return (
    <aside
      className={styles.guestQuestions}
      aria-label={t('Sample questions', 'Вопросы к примеру')}
    >
      <p>
        <strong>
          {t('Orbit is a fictional online service.', 'Orbit — вымышленный онлайн-сервис.')}
        </strong>{' '}
        {t(
          'Explore the path from signup to subscription using synthetic events.',
          'Исследуйте путь от регистрации до подписки на синтетических событиях.',
        )}
      </p>
      <div>
        <span>{t('Try a question', 'Попробуйте вопрос')}:</span>
        {questions.map(({ label, query }) => (
          <button key={label} type="button" onClick={() => onChoose(query)}>
            {label}
            <ArrowUpRight size={14} aria-hidden="true" />
          </button>
        ))}
      </div>
    </aside>
  );
}
