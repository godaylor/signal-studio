import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { getLiveRefetchInterval, usePageVisibility } from './useLiveSnapshot';

function VisibilityProbe() {
  const visible = usePageVisibility();
  return <output>{visible ? 'visible' : 'hidden'}</output>;
}

describe('Live visibility contract', () => {
  test('stops polling while paused, hidden or using a future SSE transport', () => {
    expect(getLiveRefetchInterval({ paused: true, visible: true })).toBe(false);
    expect(getLiveRefetchInterval({ paused: false, visible: false })).toBe(false);
    expect(
      getLiveRefetchInterval({
        paused: false,
        visible: true,
        snapshot: { transport: { kind: 'sse', recommendedPollMs: 10_000 } } as never,
      }),
    ).toBe(false);
    expect(getLiveRefetchInterval({ paused: false, visible: true })).toBe(10_000);
  });

  test('tracks hidden and resumed tabs so polling can stop and continue', () => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    render(<VisibilityProbe />);
    expect(screen.getByText('visible')).toBeInTheDocument();

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    fireEvent(document, new Event('visibilitychange'));
    expect(screen.getByText('hidden')).toBeInTheDocument();

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    fireEvent(document, new Event('visibilitychange'));
    expect(screen.getByText('visible')).toBeInTheDocument();
  });
});
