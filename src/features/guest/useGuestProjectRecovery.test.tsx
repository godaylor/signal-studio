import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { normalizeAnalysisQuery } from '@/server/analytics/normalize';
import { validAnalysisQuery } from '@/server/analytics/test-fixtures';
import { getTestRouter, setTestUrl } from '@/test/navigation';
import { useGuestProjectRecovery } from './useGuestProjectRecovery';
import type { GuestSessionDto } from './useGuestSession';

const projectId = 'f74b2da9-319b-4a2d-b831-51346ed168b8';
const previousProjectId = 'e62149c1-3d79-43af-a358-7888b232019f';
const guest: GuestSessionDto = {
  id: 'guest-session',
  projectId,
  workspaceId: 'guest-workspace',
  expiresAt: '2026-10-19T00:00:00.000Z',
  defaultQuery: normalizeAnalysisQuery(validAnalysisQuery({ projectId })),
  dataset: {
    synthetic: true,
    days: 42,
    users: 336,
    accounts: 84,
    events: 1281,
    customEvents: 945,
    startAt: '2026-09-05T00:00:00.000Z',
    endAt: '2026-10-17T00:00:00.000Z',
  },
  limits: {},
};

describe('guest project URL recovery', () => {
  test('replaces a previous guest project with the currently owned query and preserves locale', async () => {
    setTestUrl(`/studio/${previousProjectId}/dashboards?dashboard=old&locale=ru-RU`);
    const { result } = renderHook(() => useGuestProjectRecovery(previousProjectId, guest));
    expect(result.current).toBe(true);
    await waitFor(() => expect(getTestRouter().replace).toHaveBeenCalledTimes(1));
    const destination = new URL(getTestRouter().replace.mock.calls[0][0], 'https://studio.test');
    expect(destination.pathname).toBe(`/studio/${projectId}/explore`);
    expect(destination.searchParams.get('project')).toBe(projectId);
    expect(destination.searchParams.get('locale')).toBe('ru-RU');
    expect(destination.searchParams.has('dashboard')).toBe(false);
  });

  test('leaves normal accounts and the current guest project untouched', () => {
    const { result, rerender } = renderHook(
      ({ data }) => useGuestProjectRecovery(projectId, data),
      { initialProps: { data: undefined as GuestSessionDto | undefined } },
    );
    expect(result.current).toBe(false);
    rerender({ data: guest });
    expect(result.current).toBe(false);
    expect(getTestRouter().replace).not.toHaveBeenCalled();
  });
});
