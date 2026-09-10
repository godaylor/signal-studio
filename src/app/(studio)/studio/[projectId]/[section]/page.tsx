import type { Metadata } from 'next';
import { StudioPage } from '@/features/studio-shell/StudioPage';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ section: string }>;
}): Promise<Metadata> {
  const { section } = await params;
  const title = section.slice(0, 1).toLocaleUpperCase() + section.slice(1);
  return { title };
}

export default async function StudioSectionPage({
  params,
}: {
  params: Promise<{ projectId: string; section: string }>;
}) {
  const { projectId, section } = await params;

  return <StudioPage section={section} projectId={projectId} />;
}
