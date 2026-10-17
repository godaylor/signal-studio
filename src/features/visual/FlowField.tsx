'use client';

import { motion, useMotionValue, useSpring } from 'motion/react';
import { type PointerEvent, useEffect, useId, useRef, useState } from 'react';
import { useVisualMotion } from './MotionPreferences';
import styles from './FlowField.module.css';

/** Aggregate geometry only. Moving traces encode direction, never individual people or new events. */
export function flowGeometry(values: readonly number[]) {
  const base = values[0] ?? 0;
  return values.slice(0, 8).map((value, index, bounded) => ({
    x: bounded.length === 1 ? 500 : 80 + (index * 840) / (bounded.length - 1),
    height: base > 0 && Number.isFinite(value) ? Math.max(0, Math.min(1, value / base)) * 168 : 0,
    lost: index > 0 ? Math.max(0, bounded[index - 1] - value) : 0,
  }));
}

export function FlowField({
  values,
  active,
  className = '',
  panoramic = false,
}: {
  values: readonly number[];
  active?: number;
  className?: string;
  panoramic?: boolean;
}) {
  const { animate, ambient } = useVisualMotion();
  const id = useId().replaceAll(':', '');
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(true);
  const pointer = useMotionValue(0);
  const shift = useSpring(pointer, { stiffness: 70, damping: 24 });
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
      rootMargin: '100px',
    });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  const geometry = values[0] > 0 ? flowGeometry(values) : [];
  // Keep a complete eight-step query within the same filament budget as a short funnel.
  const lineCount = Math.min(32, Math.max(8, Math.floor(96 / Math.max(1, geometry.length))));
  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (!animate || event.pointerType !== 'mouse') return;
    const box = event.currentTarget.getBoundingClientRect();
    pointer.set(((event.clientY - box.top) / box.height - 0.5) * 12);
  };
  return (
    <div
      ref={ref}
      className={`${styles.field} ${className}`}
      data-ambient
      data-active={ambient && inView}
      data-animate={animate}
      data-panoramic={panoramic || undefined}
      data-empty={!values[0] || undefined}
      onPointerMove={move}
      onPointerLeave={() => pointer.set(0)}
      aria-hidden="true"
    >
      <div className={styles.depthGrid} />
      <motion.svg
        viewBox="0 0 1000 360"
        preserveAspectRatio="none"
        className={styles.svg}
        style={{ y: animate ? shift : 0 }}
      >
        <defs>
          <linearGradient id={`${id}-water`} x1="0" x2="1" y1="0" y2="0">
            <stop stopColor="#5089ff" />
            <stop offset=".52" stopColor="#2fd9e1" />
            <stop offset="1" stopColor="#86f4db" />
          </linearGradient>
          <linearGradient id={`${id}-loss`} x1="0" x2=".5" y1="0" y2="1">
            <stop stopColor="#ffba89" stopOpacity=".12" />
            <stop offset="1" stopColor="#ffac74" stopOpacity=".65" />
          </linearGradient>
          <linearGradient id={`${id}-gate`} x1="0" x2="1" y1="0" y2="0">
            <stop stopColor="#35e0cf" stopOpacity=".02" />
            <stop offset="1" stopColor="#8bf8ef" stopOpacity=".42" />
          </linearGradient>
          <linearGradient id={`${id}-fade`} x1="0" x2="1">
            <stop stopColor="white" stopOpacity="0" />
            <stop offset=".08" stopColor="white" />
            <stop offset=".92" stopColor="white" />
            <stop offset="1" stopColor="white" stopOpacity="0" />
          </linearGradient>
          <mask id={`${id}-mask`}>
            <rect width="1000" height="360" fill={`url(#${id}-fade)`} />
          </mask>
        </defs>
        <g mask={`url(#${id}-mask)`}>
          {geometry.map((point, index) => {
            const next = geometry[index + 1];
            const left = point.x;
            const right = next?.x ?? 1000;
            const nextHeight = next?.height ?? point.height * 0.9;
            const middle = (left + right) / 2;
            const center = 158 + Math.sin(index * 2.2) * 16;
            const nextCenter = next ? 158 + Math.sin((index + 1) * 2.2) * 16 : center - 8;
            const top = center - point.height / 2;
            const nextTop = nextCenter - nextHeight / 2;
            const selected = active == null || active === index;
            return (
              <g key={index} opacity={selected ? 1 : 0.42} className={styles.segment}>
                <path
                  data-flow-body
                  className={styles.body}
                  d={`M${left} ${top} C${middle} ${top} ${middle} ${nextTop} ${right} ${nextTop} L${right} ${nextCenter + nextHeight / 2} C${middle} ${nextCenter + nextHeight / 2} ${middle} ${center + point.height / 2} ${left} ${center + point.height / 2} Z`}
                  fill={`url(#${id}-water)`}
                />
                {Array.from({ length: lineCount }, (_, line) => {
                  const fraction = (line + 0.5) / lineCount - 0.5;
                  const y = center + fraction * point.height;
                  const endY = nextCenter + fraction * nextHeight;
                  const d = `M${left} ${y} C${middle} ${y} ${middle} ${endY} ${right} ${endY}`;
                  return (
                    <g key={line}>
                      <path d={d} stroke={`url(#${id}-water)`} className={styles.filament} />
                      {line % 4 === 0 ? (
                        <path
                          data-flow-pulse
                          d={d}
                          pathLength="100"
                          className={styles.pulse}
                          style={{
                            animationDelay: `${line * -0.37 - index * 1.2}s`,
                            animationDuration: `${5 + index * 0.7}s`,
                          }}
                        />
                      ) : null}
                    </g>
                  );
                })}
                {next && next.lost > 0 && point.height > next.height ? (
                  <g>
                    <path
                      d={`M${left + 8} ${center + next.height / 2} C${middle} ${center + next.height / 2} ${right - 70} 235 ${right - 38} 306 L${right - 25} 306 C${right - 34} 220 ${middle} ${center + point.height / 2} ${left + 8} ${center + point.height / 2} Z`}
                      fill={`url(#${id}-loss)`}
                    />
                    {Array.from({ length: 12 }, (_, line) => (
                      <path
                        key={line}
                        className={styles.lossLine}
                        d={`M${left + 8} ${center + next.height / 2 + ((point.height - next.height) / 2) * (line / 12)} C${middle} ${180 + line * 2} ${right - 70 + line} 245 ${right - 38 + line} 306`}
                      />
                    ))}
                  </g>
                ) : null}
                <path
                  d={`M${left - 9} 37 L${left + 7} 29 L${left + 7} 282 L${left - 9} 290 Z`}
                  fill={`url(#${id}-gate)`}
                  stroke="#7deded"
                  strokeOpacity=".25"
                  strokeWidth=".6"
                />
                <path d={`M${left + 7} 29 V282`} className={styles.gateLine} />
                <circle cx={left + 7} cy={center} r="3" className={styles.node} />
              </g>
            );
          })}
        </g>
      </motion.svg>
    </div>
  );
}
