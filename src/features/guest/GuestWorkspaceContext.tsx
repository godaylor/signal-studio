'use client';

import { createContext, useContext } from 'react';
import type { GuestSessionDto } from './useGuestSession';

export const GuestWorkspaceContext = createContext<GuestSessionDto | null>(null);
export function useGuestWorkspace() {
  return useContext(GuestWorkspaceContext);
}
