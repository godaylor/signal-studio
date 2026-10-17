export const GUEST_COOKIE = 'signal-studio-guest';
export const GUEST_LIMITS = Object.freeze({
  lifetimeSeconds: 24 * 60 * 60,
  activeWorkspaces: 50,
  startsPerMinute: 5,
  startsPerClientHour: 10,
  requestsPerMinute: 120,
  lifetimeRequests: 5_000,
  queries: 500,
  insights: 30,
  dashboards: 8,
  widgets: 40,
  segments: 15,
  exports: 12,
  mutations: 150,
});

export class GuestError extends Error {
  constructor(
    public code: string,
    public status = 429,
    public retryAfterSeconds = 60,
  ) {
    super(code);
  }
}

export function guestErrorResponse(error: unknown, requestId: string) {
  const known = error instanceof GuestError;
  const status = known ? error.status : 503;
  const code = known ? error.code : 'guest-unavailable';
  console.info(JSON.stringify({ event: 'guest.request', requestId, outcome: 'blocked', code }));
  return Response.json(
    { error: { code, status, message: code }, requestId },
    {
      status,
      headers: {
        'cache-control': 'no-store',
        'x-request-id': requestId,
        ...(status === 429 ? { 'retry-after': String(known ? error.retryAfterSeconds : 60) } : {}),
      },
    },
  );
}

export function sameOriginGuestRequest(request: Request) {
  const origin = request.headers.get('origin');
  if (request.headers.get('sec-fetch-site') === 'cross-site') return false;
  if (!origin) return true;
  try {
    const source = new URL(origin);
    const destination = new URL(request.url);
    // Next may normalize request.url to localhost in development. Host is the
    // browser's actual destination; never trust a caller-supplied forwarded host.
    return (
      source.protocol === destination.protocol &&
      source.host === (request.headers.get('host') || destination.host)
    );
  } catch {
    return false;
  }
}
