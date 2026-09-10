'use client';

import { useStudioLocale } from '@/features/i18n/useStudioLocale';
import styles from '@/features/studio-shell/StudioPage.module.css';
import { StudioState } from '@/features/studio-shell/StudioState';

export default function StudioProjectError({ retry }: { retry: () => void }) {
  const { t } = useStudioLocale();

  return (
    <main className={styles.fullPageState}>
      <StudioState
        variant="error"
        title={t('Studio could not render this project', 'Studio не удалось открыть проект')}
        message={t(
          'The analytical question remains unchanged. Retry the project frame or return later.',
          'Аналитический вопрос не изменился. Повторите загрузку проекта или вернитесь позже.',
        )}
        action={
          <button type="button" onClick={retry}>
            {t('Retry', 'Повторить')}
          </button>
        }
      />
    </main>
  );
}
