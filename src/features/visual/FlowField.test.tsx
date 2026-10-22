import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { AnalysisFunnelStepRow } from '@/server/analytics/contracts';
import { FlowField, flowGeometry } from './FlowField';
import { FunnelTrace } from './FunnelTrace';

const policy = vi.hoisted(() => ({ ready: true, animate: false, ambient: false }));
vi.mock('./MotionPreferences', () => ({ useVisualMotion: () => policy }));
vi.mock('@/features/i18n/useStudioLocale', () => ({
  useStudioLocale: () => ({ locale: 'en-US', t: (en: string) => en }),
}));

beforeEach(() => {
  Object.assign(policy, { ready: true, animate: false, ambient: false });
});
afterEach(() => vi.unstubAllGlobals());

function observeVisibility() {
  const observers: Array<{
    callback: IntersectionObserverCallback;
    observer: IntersectionObserver;
  }> = [];
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: IntersectionObserverCallback) {
        observers.push({ callback, observer: this as unknown as IntersectionObserver });
      }
      observe() {}
      disconnect() {}
    },
  );
  return (visible: boolean) =>
    act(() => {
      for (const { callback, observer } of observers)
        callback([{ isIntersecting: visible } as IntersectionObserverEntry], observer);
    });
}

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
    expect(container.querySelectorAll('[data-flow-filament]')).toHaveLength(96);
    expect(container.querySelectorAll('[data-flow-pulse]').length).toBeLessThanOrEqual(24);
  });
  test('ambient work starts only after the field becomes visible', () => {
    Object.assign(policy, { animate: true, ambient: true });
    const visible = observeVisibility();
    const { container } = render(<FlowField values={[336, 252, 168]} />);
    const field = container.querySelector('[data-ambient]');
    expect(field).toHaveAttribute('data-active', 'false');
    visible(true);
    expect(field).toHaveAttribute('data-active', 'true');
    visible(false);
    expect(field).toHaveAttribute('data-active', 'false');
  });
  test.each(['complete', 'pause', 'hidden', 'offscreen'] as const)(
    'a goal change interpolates real geometry and settles exactly when %s',
    async reason => {
      const visible = observeVisibility();
      const { container, rerender } = render(<FlowField values={[336, 252, 84]} />);
      const body = () => container.querySelectorAll('[data-flow-body]')[2].getAttribute('d');
      const target = body();
      rerender(<FlowField values={[336, 252, 168]} />);
      await waitFor(() => expect(body()).not.toBe(target));
      const previous = body();
      expect(previous).not.toBe(target);
      Object.assign(policy, { animate: true, ambient: true });
      rerender(<FlowField values={[336, 252, 168]} />);
      visible(true);
      rerender(<FlowField values={[336, 252, 84]} />);
      await waitFor(() => expect(body()).not.toBe(previous));
      expect(body()).not.toBe(target);
      if (reason === 'offscreen') visible(false);
      else if (reason !== 'complete') {
        Object.assign(
          policy,
          reason === 'hidden' ? { ambient: false } : { animate: false, ambient: false },
        );
        rerender(<FlowField values={[336, 252, 84]} />);
      }
      await waitFor(() => expect(body()).toBe(target), { timeout: 1500 });
      await new Promise(resolve => setTimeout(resolve, 80));
      expect(body()).toBe(target);
      expect(container.querySelector('[data-ambient]')).toHaveAttribute(
        'data-active',
        reason === 'complete' ? 'true' : 'false',
      );
    },
  );
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
