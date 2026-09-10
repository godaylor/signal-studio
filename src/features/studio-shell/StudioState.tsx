'use client';

import { AlertTriangle, Inbox, LoaderCircle, LockKeyhole } from 'lucide-react';
import type { ReactNode } from 'react';
import { useStudioLocale } from '@/features/i18n/useStudioLocale';
import styles from './StudioPage.module.css';

type StudioStateVariant = 'loading' | 'empty' | 'error' | 'permission';

const stateIcons = {
  loading: LoaderCircle,
  empty: Inbox,
  error: AlertTriangle,
  permission: LockKeyhole,
};

export function StudioState({
  variant,
  title,
  message,
  action,
}: {
  variant: StudioStateVariant;
  title: string;
  message: string;
  action?: ReactNode;
}) {
  const Icon = stateIcons[variant];
  const role = variant === 'error' ? 'alert' : 'status';

  return (
    <section className={styles.statePanel} data-variant={variant} role={role} aria-live="polite">
      <span className={styles.stateIcon}>
        <Icon aria-hidden="true" size={20} />
      </span>
      <div>
        <h2>{title}</h2>
        <p>{message}</p>
        {action ? <div className={styles.stateAction}>{action}</div> : null}
      </div>
    </section>
  );
}

export function StudioLoadingScreen() {
  const { t } = useStudioLocale();

  return (
    <main className={styles.fullPageState}>
      <StudioState
        variant="loading"
        title={t('Loading project', 'Загрузка проекта')}
        message={t(
          'Checking your session and project access.',
          'Проверяем сессию и доступ к проекту.',
        )}
      />
    </main>
  );
}
