'use client';

import { useSearchParams } from 'next/navigation';
import { useStudioLocale } from '@/features/i18n/useStudioLocale';
import { AnalysisValidationError } from '@/server/analytics/errors';
import { parseAnalysisQueryUrl } from '@/server/analytics/url-codec';
import styles from './StudioPage.module.css';

export function AnalysisUrlSummary({ projectId }: { projectId: string }) {
  const { t } = useStudioLocale();
  const searchParams = useSearchParams();

  if (!searchParams.has('aqv')) return null;

  try {
    const query = parseAnalysisQueryUrl(searchParams);

    if (query.projectId !== projectId) {
      throw new AnalysisValidationError(
        'analysis-project-mismatch',
        'This analytical URL belongs to another project.',
      );
    }

    const filterSummary = query.filters.length
      ? query.filters
          .map(filter => `${filter.field} ${filter.operator} ${filter.value}`)
          .join(` ${query.match} `)
      : t('No filters', 'Без фильтров');

    return (
      <section
        className={styles.urlQuestion}
        aria-labelledby="restored-question-title"
        data-analysis-state="valid"
      >
        <div>
          <p className={styles.eyebrow}>
            {t('Restored from URL', 'Восстановлено из URL')} · AnalysisQuery v1
          </p>
          <h2 id="restored-question-title">
            {query.measure.key} · {query.mode}
          </h2>
          <p>
            {query.range.startAt} → {query.range.endAt} · {query.range.timezone} ·{' '}
            {query.range.unit}
          </p>
        </div>
        <dl>
          <div>
            <dt>{t('Breakdown', 'Разбивка')}</dt>
            <dd>{query.breakdown?.field ?? t('None', 'Нет')}</dd>
          </div>
          <div>
            <dt>{t('Comparison', 'Сравнение')}</dt>
            <dd>{query.comparison === 'none' ? t('None', 'Нет') : query.comparison}</dd>
          </div>
          <div>
            <dt>{t('Filters', 'Фильтры')}</dt>
            <dd>{filterSummary}</dd>
          </div>
          <div>
            <dt>{t('View', 'Представление')}</dt>
            <dd>{query.visualization}</dd>
          </div>
        </dl>
      </section>
    );
  } catch (error) {
    const message =
      error instanceof AnalysisValidationError
        ? error.message
        : t(
            'This analytical URL could not be restored.',
            'Не удалось восстановить аналитический URL.',
          );

    return (
      <section className={styles.urlQuestion} role="status" data-analysis-state="invalid">
        <div>
          <p className={styles.eyebrow}>
            {t('Analysis URL needs attention', 'Проверьте аналитический URL')}
          </p>
          <h2>{t('Question not restored', 'Вопрос не восстановлен')}</h2>
          <p>{t(message, 'Параметры URL недействительны или относятся к другому проекту.')}</p>
        </div>
      </section>
    );
  }
}
