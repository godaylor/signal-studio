import styles from './VisualIdentity.module.css';

export function BrandMark({
  wordmark = false,
  className = '',
}: {
  wordmark?: boolean;
  className?: string;
}) {
  return (
    <span className={`${styles.brand} ${className}`}>
      <svg className={styles.mark} viewBox="0 0 44 44" fill="none" aria-hidden="true">
        <path
          d="M5 32 18 9M14 35 27 12M23 32 36 9"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <path d="m8 26 12-2 10-5 9-1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="8" cy="26" r="3" fill="currentColor" />
        <circle cx="30" cy="19" r="3" fill="currentColor" />
      </svg>
      {wordmark ? <span className={styles.wordmark}>Кинорит</span> : null}
    </span>
  );
}
