'use client';
import { motion, useMotionValue, useSpring } from 'motion/react';
import type { PointerEvent } from 'react';
import { useVisualMotion } from './MotionPreferences';
import styles from './OpticalScene.module.css';

/** Brand illustration. These traces never represent analytical results. */
export function OpticalScene({ className = '' }: { className?: string }) {
  const { animate, ambient } = useVisualMotion();
  const targetX = useMotionValue(0),
    targetY = useMotionValue(0);
  const x = useSpring(targetX, { stiffness: 80, damping: 24 });
  const y = useSpring(targetY, { stiffness: 80, damping: 24 });
  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (!animate || event.pointerType !== 'mouse') return;
    const box = event.currentTarget.getBoundingClientRect();
    targetX.set(((event.clientX - box.left) / box.width - 0.5) * 24);
    targetY.set(((event.clientY - box.top) / box.height - 0.5) * 18);
  };
  return (
    <div
      className={`${styles.scene} ${className}`}
      onPointerMove={move}
      onPointerLeave={() => {
        targetX.set(0);
        targetY.set(0);
      }}
      aria-hidden="true"
      data-ambient
      data-active={ambient}
    >
      <motion.div className={styles.art} style={{ x: animate ? x : 0, y: animate ? y : 0 }}>
        <img src="/brand/yasnosled/optical-flow.webp" alt="" width="1600" height="900" />
        <div className={styles.reflection} />
      </motion.div>
      <svg className={styles.traces} viewBox="0 0 900 500" fill="none">
        {[0, 1, 2].map(i => (
          <g key={i}>
            <path
              d={`M 50 ${140 + i * 115} C 310 ${40 + i * 130}, 430 ${300 - i * 70}, 850 235`}
              stroke={i === 2 ? '#8de1e7' : '#8877ff'}
              strokeOpacity=".2"
            />
            <path
              className={styles.pulse}
              style={{ animationDelay: `${i * -2.4}s` }}
              d={`M 50 ${140 + i * 115} C 310 ${40 + i * 130}, 430 ${300 - i * 70}, 850 235`}
              pathLength="100"
              stroke={i === 2 ? '#8de1e7' : '#8877ff'}
              strokeWidth="2"
            />
          </g>
        ))}
      </svg>
    </div>
  );
}
