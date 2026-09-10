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
    expect(replace).toHaveBeenCalledWith(expect.stringContaining('profileId=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), { scroll: false });
    search = new URLSearchParams('profileEntity=account&profileId=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
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
});
