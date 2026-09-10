import { describe, expect, test, vi } from 'vitest';
import { serverError } from './response';

describe('serverError', () => {
  test('does not expose internal error details in the response body', async () => {
    const logSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = serverError(new Error('database exploded'));

    expect(await response.json()).toEqual({
      error: {
        message: 'Server error',
        code: 'server-error',
        status: 500,
      },
    });

    expect(response.headers.get('x-request-id')).toBeTruthy();
    expect(JSON.stringify(logSpy.mock.calls)).not.toContain('database exploded');
    logSpy.mockRestore();
  });

  test('does not expose string errors that may contain internal details', async () => {
    const logSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = serverError('Redis is disabled');

    expect(await response.json()).toEqual({
      error: {
        message: 'Server error',
        code: 'server-error',
        status: 500,
      },
    });
    expect(JSON.stringify(logSpy.mock.calls)).not.toContain('Redis is disabled');
    logSpy.mockRestore();
  });
});
