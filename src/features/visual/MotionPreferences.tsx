'use client';

import { MotionConfig, useReducedMotion } from 'motion/react';
import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';

const MotionContext = createContext({
  animate: true,
  ambient: true,
  enabled: true,
  toggle: () => {},
});

export function MotionPreferences({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  const [enabled, setEnabled] = useState(true);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    try {
      setEnabled(localStorage.getItem('yasnosled.motion') !== 'off');
    } catch {}
    const update = () => setVisible(document.visibilityState === 'visible');
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  const animate = enabled && !reduced;
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
    <MotionContext.Provider value={{ animate, ambient: animate && visible, enabled, toggle }}>
      <MotionConfig
        reducedMotion={animate ? 'user' : 'always'}
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
