'use client';

import { useLinkStatus } from 'next/link';
import { QueryProgress } from '@/features/visual/QueryProgress';
import styles from './StudioShell.module.css';

export function NavigationFeedback() {
  const { pending } = useLinkStatus();
  return (
    <span className={styles.navigationProgress} data-pending={pending} aria-hidden="true">
      {pending ? <QueryProgress /> : null}
    </span>
  );
}
