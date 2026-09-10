import { json, notFound } from '@/lib/response';
import {
  resolveStudioShareToken,
  StudioShareNotFoundError,
} from '@/server/shares/share-service';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  try {
    return json(await resolveStudioShareToken(slug, request));
  } catch (error) {
    if (error instanceof StudioShareNotFoundError)
      return notFound({ code: 'studio-share-unavailable' });
    throw error;
  }
}
