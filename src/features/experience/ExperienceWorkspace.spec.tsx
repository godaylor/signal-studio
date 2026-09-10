import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { ExperienceWorkspace } from './ExperienceWorkspace';
import { useEvidenceReplay, useSessionEvidence } from './useEvidence';

const projectId = '11111111-1111-4111-8111-111111111111';
const sessionId = '22222222-2222-4222-8222-222222222222';
let search = new URLSearchParams();

vi.mock('next/navigation', () => ({ useSearchParams: () => search }));
vi.mock('./useEvidence', () => ({ useSessionEvidence: vi.fn(), useEvidenceReplay: vi.fn() }));

const evidence = {
  session: {
    id: sessionId,
    createdAt: '2026-03-02T09:00:00.000Z',
    browser: 'Chrome',
    os: 'Windows',
    device: 'desktop',
    country: 'DE',
  },
  identity: {
    id: 'user-1',
    label: 'Tracked user user-1',
    traits: { plan: 'enterprise' },
    account: { id: 'account-1', label: 'Account account-' },
  },
  timeline: {
    data: [
      {
        id: 'event-1',
        createdAt: '2026-03-02T10:00:00.000Z',
        label: 'core_feature_used',
        urlPath: '/workspace',
        pageTitle: null,
        properties: [],
        performance: { lcp: 1200, inp: 80, cls: 0.05 },
      },
    ],
    nextCursor: null,
    limit: 50,
    masked: true,
  },
  performance: {
    definition: 'Average observed Web Vitals across this page.',
    lcp: 1200,
    inp: 80,
    cls: 0.05,
  },
  replay: { state: 'permission-denied' as const, maskLevel: 'strict' },
  capabilities: {
    canViewEvidence: true,
    canViewSensitiveTraits: false,
    canViewReplay: false,
  },
  compatibleContext: {
    startAt: '2026-03-01T00:00:00.000Z',
    endAt: '2026-03-10T00:00:00.000Z',
    urlPath: '/workspace',
  },
};

describe('Experience workspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    search = new URLSearchParams();
    vi.mocked(useSessionEvidence).mockReturnValue({
      data: undefined,
      isPending: false,
      error: null,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
    } as unknown as ReturnType<typeof useSessionEvidence>);
    vi.mocked(useEvidenceReplay).mockReturnValue({
      data: undefined,
      error: null,
    } as ReturnType<typeof useEvidenceReplay>);
  });

  test('shows an explicit empty state when no aggregate session was selected', () => {
    render(<ExperienceWorkspace projectId={projectId} projectName="Demo" />);
    expect(screen.getByRole('heading', { name: 'Choose a session from evidence' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Browse Audiences' })).toHaveAttribute(
      'href',
      `/studio/${projectId}/audiences`,
    );
  });

  test('renders masked evidence and restores a same-project aggregate URL', () => {
    const returnTo = `/studio/${projectId}/explore?mode=funnel`;
    search = new URLSearchParams({ sessionId, returnTo });
    vi.mocked(useSessionEvidence).mockReturnValue({
      data: { pages: [evidence] },
      isPending: false,
      error: null,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
    } as unknown as ReturnType<typeof useSessionEvidence>);
    render(<ExperienceWorkspace projectId={projectId} projectName="Demo" />);
    expect(screen.getByRole('link', { name: 'Back to analysis' })).toHaveAttribute(
      'href',
      returnTo,
    );
    expect(screen.getByText('core_feature_used')).toBeVisible();
    expect(screen.getByText(/Sensitive traits.*masked/)).toBeVisible();
    expect(screen.getByText('Replay requires a separate replay capability.')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Load replay' })).not.toBeInTheDocument();
  });

  test('does not request an available replay until the user activates its control', async () => {
    const user = userEvent.setup();
    search = new URLSearchParams({ sessionId });
    vi.mocked(useSessionEvidence).mockReturnValue({
      data: {
        pages: [
          {
            ...evidence,
            timeline: { ...evidence.timeline, masked: false },
            replay: {
              state: 'available',
              replayId: 'visit-1',
              startedAt: '2026-03-02T09:00:00.000Z',
              endedAt: '2026-03-02T09:10:00.000Z',
              eventCount: 3,
              maskLevel: 'strict',
            },
          },
        ],
      },
      isPending: false,
      error: null,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
    } as unknown as ReturnType<typeof useSessionEvidence>);
    render(<ExperienceWorkspace projectId={projectId} projectName="Demo" />);
    expect(useEvidenceReplay).toHaveBeenLastCalledWith(projectId, 'visit-1', false);
    await user.click(screen.getByRole('button', { name: 'Load replay' }));
    expect(useEvidenceReplay).toHaveBeenLastCalledWith(projectId, 'visit-1', true);
  });
});
