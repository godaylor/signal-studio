import { parseRequest } from '@/lib/request';
import { json } from '@/lib/response';
import { listProjects } from '@/server/projects/project-service';

export async function GET(request: Request) {
  const { auth, error } = await parseRequest(request);

  if (error) {
    return error();
  }

  return json({ data: await listProjects(auth) });
}
