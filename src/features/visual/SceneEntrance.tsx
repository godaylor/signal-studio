'use client';

import type { ReactNode } from 'react';
import { useSceneEntrance } from './useSceneEntrance';

export function SceneEntrance({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useSceneEntrance<HTMLDivElement>(delay);
  return (
    <div ref={ref} className={className} data-scene-entrance>
      {children}
    </div>
  );
}
