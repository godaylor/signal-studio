import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { AnalysisResult } from '@/server/analytics/contracts';
import { AdvancedResults } from './AdvancedAnalysis';
import { ExploreWorkspace } from './ExploreWorkspace';
import { compatibleOperators, createDefaultAnalysisQuery, mergeAnalysisRows } from './model';
import {
  useAdvancedMembers,
  useAffectedSessions,
  useAnalysisResult,
  useCohorts,
  useSaveCohort,
} from './useAnalysisQuery';

const projectId = '11111111-1111-4111-8111-111111111111';
vi.mock('@/features/exports/ExportControls', () => ({ ExportControls: () => null }));
const replace = vi.fn();
const push = vi.fn();

vi.mock('@/features/insights/InsightLibrary', () => ({
  InsightLibrary: () => null,
  SaveInsightDialog: () => null,
}));

vi.mock('next/navigation', () => ({
  usePathname: () => `/studio/${projectId}/explore`,
  useRouter: () => ({ replace, push }),
  useSearchParams: () =>
    new URLSearchParams(
      [
        'aqv=1',
        `project=${projectId}`,
        'mode=trend',
        'event=signup',
        'aggregation=count',
        'start=2026-03-01T00%3A00%3A00.000Z',
        'end=2026-03-05T00%3A00%3A00.000Z',
        'tz=UTC',
        'unit=day',
        'compare=previousPeriod',
        'view=line',
        'match=all',
      ].join('&'),
    ),
}));

vi.mock('./useAnalysisQuery', () => ({
  useAnalysisResult: vi.fn(),
  useAffectedSessions: vi.fn(),
  useAdvancedMembers: vi.fn(),
  useCohorts: vi.fn(),
  useSaveCohort: vi.fn(),
}));

const result = {
  queryVersion: 1,
  generatedAt: '2026-03-05T00:00:01.000Z',
  freshnessAt: '2026-03-05T00:00:01.000Z',
  exactness: 'exact',
  cache: 'miss',
  data: {
    mode: 'trend',
    rows: [
      { bucket: '2026-03-01', value: 2 },
      { bucket: '2026-03-02', value: 4 },
    ],
    comparison: [
      { bucket: '2026-03-01', value: 1 },
      { bucket: '2026-03-02', value: 2 },
    ],
  },
  definitions: [{ key: 'event.count', label: 'signup', description: 'Exact event count.' }],
};

describe('Explore model', () => {
  test('keeps chart/table rows and comparison math on one transform', () => {
    expect(mergeAnalysisRows(result.data.rows, result.data.comparison)).toEqual([
      { key: '2026-03-01', value: 2, comparison: 1, change: 100 },
      { key: '2026-03-02', value: 4, comparison: 2, change: 100 },
    ]);
  });

  test('aligns previous-period trend buckets by position instead of calendar label', () => {
    expect(
      mergeAnalysisRows(
        result.data.rows,
        [
          { bucket: '2026-02-27', value: 1 },
          { bucket: '2026-02-28', value: 2 },
        ],
        true,
      ),
    ).toEqual([
      { key: '2026-03-01', value: 2, comparison: 1, change: 100 },
      { key: '2026-03-02', value: 4, comparison: 2, change: 100 },
    ]);
  });

  test('enforces equality-only operators for country filters', () => {
    expect(compatibleOperators('country')).toEqual(['equals', 'notEquals']);
    expect(compatibleOperators('urlPath')).toContain('contains');
  });

  test('creates a bounded URL-ready default question', () => {
    const query = createDefaultAnalysisQuery(projectId, new Date('2026-03-31T12:00:00.000Z'));
    expect(query).toMatchObject({
      projectId,
      mode: 'trend',
      measure: { key: '*', aggregation: 'count' },
      range: {
        startAt: '2026-03-02T00:00:00.000Z',
        endAt: '2026-04-01T00:00:00.000Z',
      },
    });
  });
});

describe('ExploreWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAnalysisResult).mockReturnValue({
      data: result,
      dataUpdatedAt: Date.now(),
      isPending: false,
      isFetching: false,
      error: null,
    } as ReturnType<typeof useAnalysisResult>);
    vi.mocked(useAffectedSessions).mockReturnValue({
      isPending: false,
      error: null,
      data: { data: [], count: 0 },
    } as ReturnType<typeof useAffectedSessions>);
    vi.mocked(useAdvancedMembers).mockReturnValue({
      isPending: false,
      error: null,
      data: undefined,
    } as ReturnType<typeof useAdvancedMembers>);
    vi.mocked(useCohorts).mockReturnValue({ data: { data: [] } } as ReturnType<typeof useCohorts>);
    vi.mocked(useSaveCohort).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isSuccess: false,
      error: null,
    } as unknown as ReturnType<typeof useSaveCohort>);
  });

  test('restores URL state into a keyboard-operable Query Spine and equivalent table', async () => {
    const user = userEvent.setup();
    render(<ExploreWorkspace projectId={projectId} projectName="Demo project" />);

    expect(screen.getByRole('heading', { name: 'Question definition' })).toBeVisible();
    expect(screen.getByRole('img')).toHaveAccessibleName(/signup returned 6 exact events/);
    expect(screen.getByRole('table')).toHaveAccessibleName(/Equivalent data table/);
    expect(screen.getAllByRole('cell', { name: '100.0%' })).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: /Filters/ }));
    expect(screen.getByRole('button', { name: /Filters/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Add filter' })).toBeVisible();
  });

  test('keeps the query editable when the result is empty', () => {
    vi.mocked(useAnalysisResult).mockReturnValue({
      data: { ...result, data: { mode: 'trend', rows: [] } },
      dataUpdatedAt: Date.now(),
      isPending: false,
      isFetching: false,
      error: null,
    } as ReturnType<typeof useAnalysisResult>);

    render(<ExploreWorkspace projectId={projectId} projectName="Demo project" />);
    expect(screen.getByRole('heading', { name: 'No events matched this question' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Run analysis' })).toBeVisible();
  });

  test('renders permission denial without hiding the Query Spine', () => {
    vi.mocked(useAnalysisResult).mockReturnValue({
      data: undefined,
      dataUpdatedAt: 0,
      isPending: false,
      isFetching: false,
      error: Object.assign(new Error('Denied'), { status: 403 }),
    } as ReturnType<typeof useAnalysisResult>);

    render(<ExploreWorkspace projectId={projectId} projectName="Demo project" />);
    expect(screen.getByRole('heading', { name: 'Analysis permission required' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Question definition' })).toBeVisible();
  });

  test('edits two-to-eight ordered funnel steps from the Query Spine', async () => {
    const user = userEvent.setup();
    render(<ExploreWorkspace projectId={projectId} projectName="Demo project" />);
    await user.click(screen.getByRole('button', { name: /Breakdown/ }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Analysis mode' }), 'funnel');
    await user.click(screen.getByRole('button', { name: /Signal/ }));
    expect(screen.getByRole('group', { name: 'Ordered funnel steps' })).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Step 1 · value' })).toHaveValue('signup');
    expect(screen.getByRole('button', { name: 'Add funnel step' })).toBeEnabled();
  });

  test('renders a keyboard-operable retention matrix with an equivalent curve table', async () => {
    const user = userEvent.setup();
    const query = {
      ...createDefaultAnalysisQuery(projectId),
      mode: 'retention' as const,
      range: { ...createDefaultAnalysisQuery(projectId).range, unit: 'day' as const },
      retention: {
        entry: { type: 'event' as const, value: 'signup', filters: [] },
        returning: { type: 'event' as const, value: 'active', filters: [] },
        granularity: 'day' as const,
        periods: 1,
      },
      visualization: 'matrix' as const,
    };
    const retentionResult = {
      ...result,
      data: {
        mode: 'retention' as const,
        rows: [
          {
            kind: 'retention-cell' as const,
            value: 2,
            cohortStart: '2026-03-01',
            period: 0,
            cohortSize: 2,
            retained: 2,
            retentionRate: 1,
          },
          {
            kind: 'retention-cell' as const,
            value: 1,
            cohortStart: '2026-03-01',
            period: 1,
            cohortSize: 2,
            retained: 1,
            retentionRate: 0.5,
          },
        ],
      },
    };
    render(<AdvancedResults query={query} result={retentionResult as AnalysisResult} />);
    expect(screen.getByRole('table', { name: /Retention matrix/ })).toBeVisible();
    expect(screen.getByRole('table', { name: /Weighted retention curve/ })).toBeVisible();
    const cell = screen.getByRole('button', { name: /2026-03-01, period 1/ });
    cell.focus();
    await user.keyboard('{Enter}');
    expect(cell).toHaveFocus();
    expect(screen.getByRole('dialog', { name: 'Exact members' })).toBeVisible();
  });
});
