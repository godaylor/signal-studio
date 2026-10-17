import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { getJsonBody } from '@/lib/request';
import { sameOriginGuestRequest } from './contracts';
import { GUEST_DATASET, guestDatasetRange, guestExampleQuery } from './dataset';
import { guestRouteOperation } from './guard';
import { guestCookie, guestCookieToken, guestTokenHash } from './session';

const projectId = randomUUID();
const request = (path: string, method = 'GET') =>
  new Request(`https://studio.test${path}`, { method });

describe('temporary guest boundary', () => {
  it('only permits selected real Studio routes for the owned project', () => {
    expect(
      guestRouteOperation(request(`/api/projects/${projectId}/analytics/query`, 'POST'), projectId),
    ).toBe('queries');
    expect(
      guestRouteOperation(request(`/api/projects/${projectId}/insights`, 'POST'), projectId),
    ).toBe('insights');
    expect(
      guestRouteOperation(
        request(`/api/projects/${projectId}/dashboards/${randomUUID()}/widgets`, 'POST'),
        projectId,
      ),
    ).toBe('widgets');
    for (const path of [
      `/api/projects/${randomUUID()}/home`,
      `/api/projects/${projectId}/members`,
      `/api/projects/${projectId}/shares`,
      '/api/users',
      '/api/teams',
      `/api/websites/${projectId}`,
    ]) {
      expect(() => guestRouteOperation(request(path, 'POST'), projectId)).toThrow(
        'guest-operation-denied',
      );
    }
    expect(() =>
      guestRouteOperation(request(`/api/projects/${projectId}/live/stream`), projectId),
    ).toThrow();
    const userId = randomUUID();
    expect(guestRouteOperation(request(`/api/websites/${projectId}`), projectId, userId)).toBe(
      'read',
    );
    expect(guestRouteOperation(request(`/api/users/${userId}/websites`), projectId, userId)).toBe(
      'read',
    );
    expect(() =>
      guestRouteOperation(request(`/api/users/${randomUUID()}/websites`), projectId, userId),
    ).toThrow();
    expect(() =>
      guestRouteOperation(request(`/api/websites/${randomUUID()}`), projectId, userId),
    ).toThrow();
  });

  it('preserves normal bearer-account request bodies when a guest cookie coexists', async () => {
    const payload = { value: 'x'.repeat(70_000) };
    const normalRequest = new Request('https://studio.test/api/projects', {
      method: 'POST',
      headers: {
        authorization: 'Bearer current-management-token',
        cookie: `signal-studio-guest=${'a'.repeat(64)}`,
      },
      body: JSON.stringify(payload),
    });
    expect(await getJsonBody(normalRequest)).toEqual(payload);
  });

  it('rejects cross-origin writes and malformed opaque cookie values', () => {
    expect(
      sameOriginGuestRequest(
        new Request('http://localhost:32240/api/guest', {
          headers: { host: '127.0.0.1:32240', origin: 'http://127.0.0.1:32240' },
        }),
      ),
    ).toBe(true);
    expect(
      sameOriginGuestRequest(
        new Request('http://localhost:32240/api/guest', {
          headers: {
            host: '127.0.0.1:32240',
            origin: 'http://malicious.test',
            'x-forwarded-host': 'malicious.test',
          },
        }),
      ),
    ).toBe(false);
    expect(
      sameOriginGuestRequest(
        new Request('https://studio.test/api/guest', { headers: { origin: 'https://other.test' } }),
      ),
    ).toBe(false);
    expect(
      sameOriginGuestRequest(
        new Request('https://studio.test/api/guest', {
          headers: { 'sec-fetch-site': 'cross-site' },
        }),
      ),
    ).toBe(false);
    expect(
      guestCookieToken(
        new Request('https://studio.test', { headers: { cookie: 'signal-studio-guest=bad' } }),
      ),
    ).toBeNull();
    const token = 'a'.repeat(64);
    expect(
      guestCookieToken(
        new Request('https://studio.test', {
          headers: { cookie: `theme=light; signal-studio-guest=${token}` },
        }),
      ),
    ).toBe(token);
    expect(guestTokenHash(token)).not.toBe(token);
    expect(guestCookie(token, request('/api/guest'))).toContain(
      'HttpOnly; SameSite=Lax; Path=/; Max-Age=86400; Secure',
    );
  });

  it('defines a stable half-open UTC fictional event fixture and a real query', () => {
    const { start, end } = guestDatasetRange(new Date('2026-10-17T21:59:00Z'));
    expect(start.toISOString()).toBe('2026-09-05T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-10-17T00:00:00.000Z');
    const query = guestExampleQuery(projectId, start, end);
    expect(query.funnel?.steps.map(step => step.value)).toEqual([
      'signup',
      'onboarding_completed',
      'core_feature_used',
    ]);
    expect(query.measure.aggregation).toBe('count');
    expect(GUEST_DATASET.events).toBe(336 + 336 + 252 + 168 + 84 + 105);
  });
});
