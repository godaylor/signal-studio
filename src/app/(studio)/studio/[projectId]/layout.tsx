import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { StudioShell } from '@/features/studio-shell/StudioShell';

export const metadata: Metadata = {
  title: {
    template: '%s | Signal Studio',
    default: 'Signal Studio',
  },
};

export default async function StudioProjectLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  return <StudioShell projectId={projectId}>{children}</StudioShell>;
}
