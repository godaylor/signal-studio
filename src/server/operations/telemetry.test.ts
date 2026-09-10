import { describe, expect, test, vi } from 'vitest';
import { observeIngestion, operationSnapshot, requestId, safeFailure } from './telemetry';
describe('bounded redacted operations', () => {
  test('accepts bounded correlation IDs and replaces unsafe or oversized input', () => {
    expect(requestId('request_123')).toBe('request_123');
    expect(requestId('secret\nvalue')).toMatch(/^[0-9a-f-]{36}$/);
    expect(requestId('x'.repeat(1000))).toHaveLength(36);
  });
  test('preserves response body/status and adds a safe receipt without logging payloads', async () => {
    const log = vi.spyOn(console, 'info').mockImplementation(() => {});
    const request = new Request('http://localhost/api/send', { method: 'POST', body: 'secret-payload' });
    const response = await observeIngestion('ingestion.send', request, async () => Response.json({ skipped: true }));
    expect(await response.json()).toEqual({ skipped: true });
    expect(response.headers.get('x-request-id')).toHaveLength(36);
    expect(JSON.stringify(log.mock.calls)).not.toContain('secret-payload');
    expect(operationSnapshot().metrics['ingestion.send.success'].count).toBeGreaterThan(0);
    log.mockRestore();
  });
  test('logs a safe code rather than an exception or secret', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    safeFailure('server-error');
    expect(JSON.parse(log.mock.calls[0][0])).toMatchObject({ event: 'operation.failed', code: 'server-error' });
    log.mockRestore();
  });
});
