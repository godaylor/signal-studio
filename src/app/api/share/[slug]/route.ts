import { json, notFound } from '@/lib/response';
import { getShareByCode } from '@/queries/prisma';
import { resolveStudioShare, StudioShareNotFoundError } from '@/server/shares/share-service';

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const share = await getShareByCode(slug);
  if (!share) return notFound();
  if (share.resourceType !== 'insight' && share.resourceType !== 'dashboard') {
    // Records remain intact; recreate legacy links as scoped Studio shares.
    return Response.json({ error: { code: 'legacy-share-retired' } }, { status: 410 });
  }
  try {
    return json(await resolveStudioShare(share, request));
  } catch (error) {
    if (error instanceof StudioShareNotFoundError)
      return notFound({ code: 'studio-share-unavailable' });
    throw error;
  }
}
