'use client';

import { useVisualMotion } from './MotionPreferences';
import styles from './QueryProgress.module.css';

/** Indeterminate activity, never a fabricated percentage or incoming event. */
export function QueryProgress({ className = '' }: { className?: string }) {
  const { ambient } = useVisualMotion();
  return (
    <span className={`${styles.track} ${className}`} data-active={ambient} aria-hidden="true">
      <span className={styles.pulse} />
    </span>
  );
}
