import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { AudiencesWorkspace } from './AudiencesWorkspace';
import {
  useDeleteSegment,
  useIdentityList,
  useIdentityProfile,
  useOperationalSegments,
  usePreviewSegment,
  useSaveSegment,
} from './useAudiences';

const projectId = '11111111-1111-4111-8111-111111111111';
vi.mock('@/features/exports/ExportControls', () => ({ ExportControls: () => null }));
const replace = vi.fn();
let search = new URLSearchParams();

vi.mock('next/navigation', () => ({
  usePathname: () => `/studio/${projectId}/audiences`,
  useRouter: () => ({ replace }),
  useSearchParams: () => search,
}));

vi.mock('./useAudiences', () => ({
  useIdentityList: vi.fn(),
  useIdentityProfile: vi.fn(),
  useOperationalSegments: vi.fn(),
  usePreviewSegment: vi.fn(),
  useSaveSegment: vi.fn(),
  useDeleteSegment: vi.fn(),
}));

const idleMutation = { mutate: vi.fn(), isPending: false, isSuccess: false, error: null };

describe('Audiences workspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    search = new URLSearchParams();
    vi.mocked(useIdentityList).mockReturnValue({
      data: {
        pages: [
          {
            permissionScope: 'identity-standard',
            nextCursor: null,
            data: [
              {
                id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                traits: { plan: 'enterprise' },
                lifecycleStage: 'activated',
                activatedAt: null,
                firstSeenAt: '2026-03-01T00:00:00.000Z',
                lastSeenAt: '2026-03-02T00:00:00.000Z',
                definitionVersion: 'activation.v1',
              },
            ],
          },
        ],
      },
      isPending: false,
      error: null,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
    } as unknown as ReturnType<typeof useIdentityList>);
    vi.mocked(useIdentityProfile).mockImplementation(
      (_project, _entity, id) =>
        ({
          data: id
            ? {
                id,
                label: 'Account account-',
                traits: { plan: 'enterprise' },
                lifecycle: {
                  stage: 'activated',
                  activatedAt: null,
                  firstSeenAt: '2026-03-01T00:00:00.000Z',
                  lastSeenAt: '2026-03-02T00:00:00.000Z',
                  storedDefinitionVersion: 'activation.v1',
                  definition: {
                    label: 'Activation',
                    description: 'Observed the activation sequence.',
                    exactness: 'exact',
                    steps: ['signup', 'core_feature_used'],
                  },
                },
                adoption: {
                  sessions: 1,
                  events: 3,
                  definition: {
                    label: 'Observed adoption',
                    description: 'Exact linked session and event counts.',
                    exactness: 'exact',
                  },
                },
                sessions: [
                  {
                    id: '22222222-2222-4222-8222-222222222222',
                    browser: 'Chrome',
                    os: 'Windows',
                    device: 'desktop',
                    country: 'DE',
                    createdAt: '2026-03-02T00:00:00.000Z',
                    eventCount: 3,
                  },
                ],
                permissionScope: 'identity-standard',
              }
            : undefined,
          isPending: false,
          error: null,
        }) as ReturnType<typeof useIdentityProfile>,
    );
    vi.mocked(useOperationalSegments).mockReturnValue({
      data: { data: [] },
      isPending: false,
      error: null,
    } as ReturnType<typeof useOperationalSegments>);
    vi.mocked(usePreviewSegment).mockReturnValue(
      idleMutation as unknown as ReturnType<typeof usePreviewSegment>,
    );
    vi.mocked(useSaveSegment).mockReturnValue(
      idleMutation as unknown as ReturnType<typeof useSaveSegment>,
    );
    vi.mocked(useDeleteSegment).mockReturnValue(
      idleMutation as unknown as ReturnType<typeof useDeleteSegment>,
    );
  });

  test('keeps masked cursor-list data keyboard operable through profile and session evidence', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<AudiencesWorkspace projectId={projectId} projectName="Demo" />);
    expect(screen.getByRole('table', { name: 'Project accounts' })).toBeVisible();
    expect(screen.getByText(/Sensitive names.*masked/)).toBeVisible();
    const open = screen.getByRole('button', { name: /Open profile/ });
    open.focus();
    await user.keyboard('{Enter}');
    expect(replace).toHaveBeenCalledWith(
      expect.stringContaining('profileId=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
      { scroll: false },
    );
    search = new URLSearchParams(
      'profileEntity=account&profileId=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    );
    rerender(<AudiencesWorkspace projectId={projectId} projectName="Demo" />);
    expect(screen.getByRole('dialog', { name: 'Account account-' })).toBeVisible();
    expect(screen.getByText('1 sessions · 3 events')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Open evidence' })).toHaveAttribute(
      'href',
      expect.stringContaining(`/studio/${projectId}/experience?sessionId=`),
    );
  });

  test('writes reproducible sorting state to the URL', async () => {
    const user = userEvent.setup();
    render(<AudiencesWorkspace projectId={projectId} projectName="Demo" />);
    await user.selectOptions(screen.getByLabelText('Identity sort'), 'firstSeenAt');
    expect(replace).toHaveBeenCalledWith(expect.stringContaining('sort=firstSeenAt'), {
      scroll: false,
    });
  });

  test('an empty filtered audience offers a direct reset without implying that event data is missing', async () => {
    const user = userEvent.setup();
    search = new URLSearchParams('q=missing&lifecycle=inactive');
    vi.mocked(useIdentityList).mockReturnValue({
      data: { pages: [{ data: [], nextCursor: null, permissionScope: 'identity-standard' }] },
      isPending: false,
      error: null,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
    } as unknown as ReturnType<typeof useIdentityList>);
    render(<AudiencesWorkspace projectId={projectId} projectName="Demo" />);
    expect(screen.getByText(/This does not mean there are no events/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Clear search and stage' }));
    expect(replace).toHaveBeenCalledWith(`/studio/${projectId}/audiences?`, { scroll: false });
    expect(screen.getByRole('textbox', { name: 'Search identities' })).toHaveValue('');
  });

  test('an unavailable audience can be retried with the current filters', async () => {
    const retry = vi.fn();
    vi.mocked(useIdentityList).mockReturnValue({
      isPending: false,
      error: new Error('offline'),
      refetch: retry,
    } as unknown as ReturnType<typeof useIdentityList>);
    render(<AudiencesWorkspace projectId={projectId} projectName="Demo" />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }));
    expect(retry).toHaveBeenCalledOnce();
  });

  test('restoring a different search in the URL updates the draft instead of overwriting navigation', async () => {
    search = new URLSearchParams('q=activated');
    const { rerender } = render(<AudiencesWorkspace projectId={projectId} projectName="Demo" />);
    expect(screen.getByRole('textbox', { name: 'Search identities' })).toHaveValue('activated');
    search = new URLSearchParams('q=retained');
    rerender(<AudiencesWorkspace projectId={projectId} projectName="Demo" />);
    expect(screen.getByRole('textbox', { name: 'Search identities' })).toHaveValue('retained');
    await new Promise(resolve => window.setTimeout(resolve, 300));
    expect(replace).not.toHaveBeenCalled();
  });

  test('a saved segment opens its own conditions and evaluates members without carrying over an unrelated draft name', async () => {
    const user = userEvent.setup();
    search = new URLSearchParams('view=segments');
    const definition = {
      version: 1 as const,
      entity: 'account' as const,
      match: 'all' as const,
      conditions: [
        {
          kind: 'trait' as const,
          field: 'plan' as const,
          operator: 'equals' as const,
          value: 'enterprise',
        },
      ],
    };
    vi.mocked(useOperationalSegments).mockReturnValue({
      data: {
        data: [
          {
            id: 'segment-a',
            name: 'Enterprise teams',
            definition,
            dependencies: { insights: [], dashboards: 0 },
            updatedAt: null,
          },
        ],
      },
      isPending: false,
      error: null,
    } as ReturnType<typeof useOperationalSegments>);
    const evaluate = vi.fn();
    const resetSaved = vi.fn();
    vi.mocked(usePreviewSegment).mockReturnValue({
      ...idleMutation,
      mutate: evaluate,
    } as unknown as ReturnType<typeof usePreviewSegment>);
    vi.mocked(useSaveSegment).mockReturnValue({
      ...idleMutation,
      reset: resetSaved,
    } as unknown as ReturnType<typeof useSaveSegment>);
    render(<AudiencesWorkspace projectId={projectId} projectName="Demo" />);
    await user.click(screen.getByRole('button', { name: 'Preview members of Enterprise teams' }));
    expect(evaluate).toHaveBeenCalledWith(definition);
    expect(screen.getByLabelText('Entity')).toHaveValue('account');
    expect(screen.getByLabelText('Condition 1 trait')).toHaveValue('plan');
    expect(screen.getByLabelText('Condition 1 value')).toHaveValue('enterprise');
    expect(screen.getByLabelText('Segment name')).toHaveValue('');
    expect(resetSaved).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Save Segment' })).toBeDisabled();
  });

  test('does not present the previous segment count as the result of edited conditions', async () => {
    const user = userEvent.setup();
    search = new URLSearchParams('view=segments');
    vi.mocked(usePreviewSegment).mockReturnValue({
      ...idleMutation,
      variables: {
        version: 1,
        entity: 'user',
        match: 'all',
        conditions: [{ kind: 'lifecycle', value: 'activated' }],
      },
      data: {
        count: 42,
        entity: 'user',
        exactness: 'exact',
        evaluatedAt: '2026-03-02T00:00:00.000Z',
        sample: [],
      },
    } as unknown as ReturnType<typeof usePreviewSegment>);
    render(<AudiencesWorkspace projectId={projectId} projectName="Demo" />);
    expect(screen.getByText('42 exact users')).toBeVisible();
    await user.selectOptions(screen.getByLabelText('Condition 1 lifecycle'), 'retained');
    expect(screen.queryByText('42 exact users')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Conditions changed');
    expect(screen.getByRole('button', { name: 'Preview size' })).toBeEnabled();
  });

  test('does not show a late preview response for an older definition or saved status for a renamed draft', async () => {
    const user = userEvent.setup();
    search = new URLSearchParams('view=segments');
    const definition = {
      version: 1,
      entity: 'user',
      match: 'all',
      conditions: [{ kind: 'lifecycle', value: 'activated' }],
    };
    vi.mocked(useSaveSegment).mockReturnValue({
      ...idleMutation,
      isSuccess: true,
      variables: { name: 'Activated users', definition },
    } as unknown as ReturnType<typeof useSaveSegment>);
    const { rerender } = render(<AudiencesWorkspace projectId={projectId} projectName="Demo" />);
    expect(screen.getByRole('status')).toHaveTextContent('Segment saved');
    await user.type(screen.getByLabelText('Segment name'), ' edited');
    expect(
      screen.queryByText('Segment saved with its reusable definition.'),
    ).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Condition 1 lifecycle'), 'retained');
    vi.mocked(usePreviewSegment).mockReturnValue({
      ...idleMutation,
      variables: definition,
      data: {
        count: 42,
        entity: 'user',
        exactness: 'exact',
        evaluatedAt: '2026-03-02T00:00:00.000Z',
        sample: [],
      },
    } as unknown as ReturnType<typeof usePreviewSegment>);
    rerender(<AudiencesWorkspace projectId={projectId} projectName="Demo" />);
    expect(screen.queryByText('42 exact users')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Conditions changed');
  });
});
