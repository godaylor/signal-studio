'use client';

import { useSceneEntrance } from './useSceneEntrance';
import styles from './DataValue.module.css';

/** The current value is always the real value; only its arrival moves. */
export function DataValue({ value }: { value: string }) {
  return <IncomingValue key={value} value={value} />;
}

function IncomingValue({ value }: { value: string }) {
  const ref = useSceneEntrance<HTMLSpanElement>();
  return (
    <span ref={ref} className={styles.value} data-motion-value>
      {value}
    </span>
  );
}
