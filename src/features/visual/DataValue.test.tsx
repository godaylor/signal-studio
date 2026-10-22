import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { DataValue } from './DataValue';

const policy = vi.hoisted(() => ({ ready: true, animate: true, ambient: true }));
vi.mock('./MotionPreferences', () => ({ useVisualMotion: () => policy }));

let show: IntersectionObserverCallback;
const finish = vi.fn();
const cancel = vi.fn();
const animate = vi.fn(() => ({ finish, cancel }));
const originalAnimate = Object.getOwnPropertyDescriptor(Element.prototype, 'animate');

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(policy, { ready: true, animate: true, ambient: true });
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: IntersectionObserverCallback) {
        show = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
  Object.defineProperty(Element.prototype, 'animate', { configurable: true, value: animate });
});
afterEach(() => {
  vi.restoreAllMocks();
  if (originalAnimate) Object.defineProperty(Element.prototype, 'animate', originalAnimate);
  else Reflect.deleteProperty(Element.prototype, 'animate');
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function enter() {
  act(() =>
    show([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver),
  );
}

test('keeps the exact current value readable before exposure and throughout the arrival', () => {
  const { rerender } = render(<DataValue value="168" />);
  expect(screen.getByText('168')).toBeVisible();
  expect(animate).not.toHaveBeenCalled();
  enter();
  expect(animate).toHaveBeenCalledOnce();
  rerender(<DataValue value="84" />);
  expect(screen.queryByText('168')).not.toBeInTheDocument();
  expect(screen.getByText('84')).toBeVisible();
  enter();
  expect(animate).toHaveBeenCalledTimes(2);
});

test('finishes immediately on pause and does not replay old values after resume', () => {
  const { rerender } = render(<DataValue value="75%" />);
  enter();
  policy.animate = false;
  rerender(<DataValue value="75%" />);
  expect(finish).toHaveBeenCalledOnce();
  expect(cancel).toHaveBeenCalledOnce();
  expect(screen.getByText('75%')).toBeVisible();
  policy.animate = true;
  rerender(<DataValue value="75%" />);
  expect(animate).toHaveBeenCalledOnce();
});

test('resolves saved preferences before enabling motion and keeps reduced/hidden values static', () => {
  policy.ready = false;
  const { rerender } = render(<DataValue value="25%" />);
  expect(animate).not.toHaveBeenCalled();
  policy.ready = true;
  policy.ambient = false;
  rerender(<DataValue value="25%" />);
  enter();
  expect(animate).not.toHaveBeenCalled();
  policy.ambient = true;
  rerender(<DataValue value="25%" />);
  expect(animate).not.toHaveBeenCalled();
  policy.animate = false;
  rerender(<DataValue value="0%" />);
  enter();
  expect(screen.getByText('0%')).toBeVisible();
  expect(animate).not.toHaveBeenCalled();
});
