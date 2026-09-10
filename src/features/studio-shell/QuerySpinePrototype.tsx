'use client';

import { useState } from 'react';
import { useStudioLocale } from '@/features/i18n/useStudioLocale';
import styles from './StudioPage.module.css';

const queryBlocks = [
  { id: 'signal', label: 'Signal', value: 'Choose an event or metric' },
  { id: 'measure', label: 'Measure', value: 'Count, users, accounts or value' },
  { id: 'breakdown', label: 'Breakdown', value: 'Add one bounded dimension' },
  { id: 'filters', label: 'Filters', value: 'Match all or any conditions' },
  { id: 'context', label: 'Context', value: 'Range, timezone and comparison' },
] as const;

export function QuerySpinePrototype() {
  const { t } = useStudioLocale();
  const [activeBlock, setActiveBlock] = useState<(typeof queryBlocks)[number]['id']>('signal');

  return (
    <section className={styles.queryPrototype} aria-labelledby="query-spine-title">
      <div className={styles.querySpine}>
        <header>
          <p>Query Spine</p>
          <h2 id="query-spine-title">{t('Question definition', 'Определение вопроса')}</h2>
        </header>
        <ol>
          {queryBlocks.map((block, index) => (
            <li key={block.id} data-active={block.id === activeBlock || undefined}>
              <span className={styles.queryIndex} aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <button
                type="button"
                aria-pressed={block.id === activeBlock}
                onClick={() => setActiveBlock(block.id)}
              >
                <strong>
                  {t(
                    block.label,
                    {
                      Signal: 'Сигнал',
                      Measure: 'Метрика',
                      Breakdown: 'Разбивка',
                      Filters: 'Фильтры',
                      Context: 'Контекст',
                    }[block.label],
                  )}
                </strong>
                <span>
                  {t(
                    block.value,
                    {
                      'Choose an event or metric': 'Выберите событие или метрику',
                      'Count, users, accounts or value':
                        'Количество, пользователи, аккаунты или значение',
                      'Add one bounded dimension': 'Добавьте одно ограниченное измерение',
                      'Match all or any conditions': 'Совпадение всех или любых условий',
                      'Range, timezone and comparison': 'Диапазон, часовой пояс и сравнение',
                    }[block.value],
                  )}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>
      <div className={styles.resultPrototype}>
        <div className={styles.resultRule} aria-hidden="true">
          <span />
        </div>
        <p className={styles.eyebrow}>{t('Result canvas', 'Область результата')}</p>
        <h2>{t('Ready for a valid question', 'Готово к корректному вопросу')}</h2>
        <p>
          {t(
            'The Query Spine keeps analytical lineage visible from the question to its result.',
            'Query Spine сохраняет видимую связь аналитического вопроса с его результатом.',
          )}
        </p>
        <div
          className={styles.prototypeAxes}
          aria-label={t(
            'Empty analytical result preview',
            'Предпросмотр пустого аналитического результата',
          )}
        >
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>
    </section>
  );
}
