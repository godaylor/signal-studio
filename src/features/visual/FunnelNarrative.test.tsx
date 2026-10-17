import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import type { AnalysisFunnelStepRow } from '@/server/analytics/contracts';
import { FunnelNarrative, summarizeFunnel } from './FunnelNarrative';

vi.mock('@/features/i18n/useStudioLocale', () => ({
  useStudioLocale: () => ({ locale: 'en-US', t: (en: string) => en }),
}));
const rows = (values: number[], segment?: string) =>
  values.map((converted, index) => ({
    kind: 'funnel-step',
    step: index + 1,
    label: ['signup', 'onboarding_completed', 'subscription_started'][index],
    converted,
    segment,
  })) as AnalysisFunnelStepRow[];

describe('Funnel interpretation', () => {
  test('describes actual adjacent loss and does not invent its cause', () => {
    render(<FunnelNarrative steps={rows([336, 252, 84])} />);
    expect(
      screen.getByText('84 of 336 participants completed every selected step in order.'),
    ).toBeVisible();
    expect(screen.getByText('168')).toBeVisible();
    fireEvent.click(screen.getByText('Largest step loss', { exact: false }));
    expect(screen.getByText(/The events show where, not why/)).toBeVisible();
  });
  test('keeps segment denominators independent instead of summing or mixing them', () => {
    expect(
      summarizeFunnel([...rows([100, 75, 50], 'desktop'), ...rows([40, 20, 10], 'mobile')]),
    ).toMatchObject([
      { segment: 'desktop', entered: 100, completed: 50, biggest: { count: 25 } },
      { segment: 'mobile', entered: 40, completed: 10, biggest: { count: 20 } },
    ]);
  });
  test('no participants does not become a successful or failed conversion claim', () => {
    expect(summarizeFunnel(rows([0, 0, 0]))).toEqual([]);
  });
  test('compares completion rates using each segment entry population', () => {
    render(
      <FunnelNarrative
        steps={[...rows([168, 168, 126], 'desktop'), ...rows([168, 84, 42], 'mobile')]}
      />,
    );
    expect(screen.getByText('desktop · 75%')).toBeVisible();
    expect(screen.getByText('mobile · 25%')).toBeVisible();
    expect(screen.getByText(/50 percentage points/)).toBeVisible();
  });
});
