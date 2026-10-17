import type { Metadata } from 'next';
import { StudioEntry } from '@/features/studio-shell/StudioEntry';

export const metadata: Metadata = {
  title: 'Кинорит',
};

export default function StudioIndexPage() {
  return <StudioEntry />;
}
