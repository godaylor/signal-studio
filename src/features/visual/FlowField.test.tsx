import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import type { AnalysisFunnelStepRow } from '@/server/analytics/contracts';
import { FlowField, flowGeometry } from './FlowField';
import { FunnelTrace } from './FunnelTrace';

vi.mock('./MotionPreferences', () => ({
  useVisualMotion: () => ({ animate: false, ambient: false }),
}));
vi.mock('@/features/i18n/useStudioLocale', () => ({
  useStudioLocale: () => ({ locale: 'en-US', t: (en: string) => en }),
}));

describe('Aggregate flow preserves real result geometry and evidence actions', () => {
  test('widths use the first-step denominator; losses use adjacent actual counts', () => {
    expect(flowGeometry([336, 252, 168]).map(p => p.height)).toEqual([168, 126, 84]);
    expect(flowGeometry([336, 252, 84]).map(p => p.height)).toEqual([168, 126, 42]);
    expect(flowGeometry([336, 252, 84]).map(p => p.lost)).toEqual([0, 84, 168]);
    expect(flowGeometry([56, 28, 21]).map(p => p.height)).toEqual([168, 84, 63]);
  });
  test('empty results never render moving particles or invent people', () => {
    const { container } = render(<FlowField values={[0, 0, 0]} />);
    expect(container.querySelector('[data-empty]')).not.toBeNull();
    expect(container.querySelectorAll('circle')).toHaveLength(0);
    expect(container.querySelectorAll('path')).toHaveLength(0);
  });
  test('the schema maximum bounds SVG work to eight stages', () => {
    expect(flowGeometry(Array.from({ length: 100 }, () => 1))).toHaveLength(8);
    const { container } = render(<FlowField values={[100, 90, 80, 70, 60, 50, 40, 30]} />);
    expect(container.querySelectorAll('path').length).toBeLessThan(350);
  });
  test('visible stages and drop-off open the original result row', () => {
    const steps = [336, 252, 168].map((converted, i) => ({
      kind: 'funnel-step',
      step: i + 1,
      label: ['signup', 'onboarding_completed', 'core_feature_used'][i],
      converted,
      overallConversionRate: converted / 336,
    })) as AnalysisFunnelStepRow[];
    const inspect = vi.fn();
    render(<FunnelTrace steps={steps} onInspect={inspect} />);
    const stage = screen.getByRole('button', { name: 'Explore drop-off: Core feature' });
    expect(stage).toHaveTextContent('168');
    fireEvent.focus(stage);
    expect(stage).toHaveAttribute('data-highlight', 'true');
    fireEvent.click(stage);
    expect(inspect).toHaveBeenLastCalledWith(steps[2]);
    fireEvent.click(screen.getByRole('button', { name: /84.*did not reach.*core feature/i }));
    expect(inspect).toHaveBeenLastCalledWith(steps[2]);
  });
});
