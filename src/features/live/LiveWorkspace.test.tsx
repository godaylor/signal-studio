import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { LiveSnapshot } from '@/server/live/contracts';
import { LiveWorkspace } from './LiveWorkspace';

const useLiveSnapshot = vi.fn();
vi.mock('@/features/i18n/useStudioLocale', () => ({ useStudioLocale: () => ({ locale: 'en-US', isRussian: false, t: (en: string) => en }) }));
vi.mock('./LiveWorkspace.module.css', () => ({ default: new Proxy({}, { get: (_target, key) => String(key) }) }));
vi.mock('./useLiveSnapshot', () => ({ useLiveSnapshot: (projectId: string, paused: boolean) => useLiveSnapshot(projectId, paused) }));
vi.mock('react-window', () => ({
  List: ({ rowComponent: Row, rowCount, rowProps, 'aria-label': ariaLabel }: any) => <div role="list" aria-label={ariaLabel}>{Array.from({ length: rowCount }, (_, index) => <Row key={index} index={index} style={{}} {...rowProps} />)}</div>,
}));

const snapshot: LiveSnapshot = {
  version: 1,
  snapshotId: 'snapshot-1',
  generatedAt: '2026-09-03T12:00:00.000Z',
  freshnessAt: '2026-09-03T11:59:30.000Z',
  range: { start: '2026-09-03T11:30:00.000Z', end: '2026-09-03T12:00:00.000Z', boundary: '[start,end)', timezone: 'UTC', unit: 'minute' },
  transport: { kind: 'polling', recommendedPollMs: 10_000, cacheTtlMs: 8_000 },
  cache: 'hit',
  totals: { views: 8, visitors: 4, events: 2, countries: 2, activeUsers: 3, activeAccounts: 1 },
  series: { views: [{ time: '2026-09-03T11:59:00.000Z', value: 8 }], visitors: [{ time: '2026-09-03T11:59:00.000Z', value: 4 }] },
  activity: [{ id: 'event-1', type: 'event', sessionId: 'session-a', eventName: 'upgrade_clicked', createdAt: '2026-09-03T11:59:30.000Z', urlPath: '/billing', browser: 'chrome', device: 'desktop', country: 'US' }],
  topBehaviors: [{ key: 'event:upgrade_clicked', label: 'upgrade_clicked', current: 2, previous: 1, changePercent: 100 }],
  warnings: [],
  definitions: { activeUsers: 'Distinct users.', activeAccounts: 'Distinct accounts.', lateArrivals: 'Late events appear next.' },
};

describe('LiveWorkspace', () => {
  beforeEach(() => {
    useLiveSnapshot.mockReset();
    useLiveSnapshot.mockReturnValue({ data: snapshot, error: null, isPending: false, isFetching: false, visible: true, refetch: vi.fn() });
  });

  test('uses one snapshot for metrics, table, changing behavior and virtualized activity', () => {
    render(<LiveWorkspace projectId="project-a" projectName="Demo" />);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByRole('table')).toHaveAccessibleName(/equivalent tabular summary/i);
    expect(screen.getAllByText('upgrade_clicked')).toHaveLength(2);
    expect(screen.getByRole('list', { name: /recent live activity/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Inspect' })).toHaveAttribute('href', expect.stringContaining('sessionId=session-a'));
  });

  test('pause and resume preserve the rendered snapshot', () => {
    render(<LiveWorkspace projectId="project-a" projectName="Demo" />);
    fireEvent.click(screen.getByRole('button', { name: 'Pause live view' }));
    expect(useLiveSnapshot).toHaveBeenLastCalledWith('project-a', true);
    expect(screen.getByRole('button', { name: 'Resume live view' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByText('upgrade_clicked')).toHaveLength(2);
  });

  test('connection loss keeps the last valid result and exposes retry', () => {
    useLiveSnapshot.mockReturnValue({ data: snapshot, error: new Error('offline'), isPending: false, isFetching: false, visible: true, refetch: vi.fn() });
    render(<LiveWorkspace projectId="project-a" projectName="Demo" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Showing the last valid snapshot');
    expect(screen.getAllByText('upgrade_clicked')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled();
  });
});
