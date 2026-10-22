'use client';

import { MotionConfig } from 'motion/react';
import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';

type MotionPolicy = {
  readonly ready: boolean;
  readonly animate: boolean;
  readonly ambient: boolean;
  readonly enabled: boolean;
  toggle: () => void;
};

const MotionContext = createContext<MotionPolicy>({
  ready: false,
  animate: false,
  ambient: false,
  enabled: true,
  toggle: () => {},
});

export function MotionPreferences({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [reduced, setReduced] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateReduced = () => setReduced(preference.matches);
    const updateVisibility = () => setVisible(document.visibilityState === 'visible');
    preference.addEventListener('change', updateReduced);
    document.addEventListener('visibilitychange', updateVisibility);
    try {
      setEnabled(localStorage.getItem('yasnosled.motion') !== 'off');
    } catch {}
    updateReduced();
    updateVisibility();
    setReady(true);
    return () => {
      preference.removeEventListener('change', updateReduced);
      document.removeEventListener('visibilitychange', updateVisibility);
    };
  }, []);
  const animate = ready && enabled && !reduced;
  useEffect(() => {
    document.documentElement.dataset.visualMotion = animate ? 'on' : 'off';
    document.documentElement.dataset.visualAmbient = animate && visible ? 'on' : 'off';
  }, [animate, visible]);
  const toggle = () =>
    setEnabled(value => {
      const next = !value;
      try {
        localStorage.setItem('yasnosled.motion', next ? 'on' : 'off');
      } catch {}
      return next;
    });
  return (
    <MotionContext.Provider
      value={{ ready, animate, ambient: animate && visible, enabled, toggle }}
    >
      <MotionConfig
        reducedMotion={animate ? 'never' : 'always'}
        transition={{ type: 'spring', stiffness: 330, damping: 32 }}
      >
        {children}
      </MotionConfig>
    </MotionContext.Provider>
  );
}

export function useVisualMotion() {
  return useContext(MotionContext);
}
