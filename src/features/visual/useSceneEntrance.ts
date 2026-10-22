'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useVisualMotion } from './MotionPreferences';

/** One bounded arrival, with content and focus available throughout. */
export function useSceneEntrance<T extends HTMLElement>(delay = 0) {
  return useArrival<T>(surfaceArrival, delay);
}

/** Reveal the incoming plot; axes, labels and equivalent tables stay intact. */
export function usePlotEntrance<T extends HTMLElement>() {
  return useArrival<T>(plotArrival, 0);
}

function surfaceArrival(element: HTMLElement, delay: number) {
  return [
    element.animate([{ transform: 'translateY(12px)' }, { transform: 'translateY(0)' }], {
      duration: 620,
      delay: Math.min(250, Math.max(0, delay)),
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
    }),
  ];
}

function plotArrival(element: HTMLElement) {
  return Array.from(element.querySelectorAll<HTMLElement | SVGElement>('[data-plot-arrival]'))
    .slice(0, 40)
    .filter(target => typeof target.animate === 'function')
    .map((target, index) =>
      target.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], {
        duration: 660,
        delay: Math.min(index * 20, 160),
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      }),
    );
}

function useArrival<T extends HTMLElement>(
  start: (element: HTMLElement, delay: number) => Animation[],
  delay: number,
) {
  const [element, setElement] = useState<T | null>(null);
  const ref = useCallback((node: T | null) => setElement(node), []);
  const entered = useRef<T | null>(null);
  const { ready, animate, ambient } = useVisualMotion();

  useEffect(() => {
    if (!element || !ready || entered.current === element) return;
    let disposed = false;
    let animations: Animation[] = [];
    let observer: IntersectionObserver | undefined;
    const enter = () => {
      if (disposed || entered.current === element) return;
      entered.current = element;
      observer?.disconnect();
      if (!animate || !ambient || typeof element.animate !== 'function') return;
      animations = start(element, delay);
    };
    if (typeof IntersectionObserver === 'undefined') enter();
    else {
      observer = new IntersectionObserver(
        entries => {
          if (entries.some(entry => entry.isIntersecting)) enter();
        },
        { threshold: 0.08 },
      );
      observer.observe(element);
    }
    return () => {
      disposed = true;
      observer?.disconnect();
      // Finish immediately on pause/reduced/hidden changes, leaving the final
      // readable content in place. A later resume never replays this arrival.
      for (const animation of animations) {
        try {
          animation.finish();
        } catch {}
        animation.cancel();
      }
    };
  }, [element, ready, animate, ambient, delay, start]);
  return ref;
}
