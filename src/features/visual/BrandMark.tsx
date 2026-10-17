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
      <img className={styles.mark} src="/brand/yasnosled/mark.webp" width="44" height="44" alt="" />
      {wordmark ? <span className={styles.wordmark}>Яснослед</span> : null}
    </span>
  );
}
