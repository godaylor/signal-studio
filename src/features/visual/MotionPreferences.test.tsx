import { act, fireEvent, render, screen } from '@testing-library/react';
import { MotionConfigContext } from 'motion/react';
import { useContext } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { MotionPreferences, useVisualMotion } from './MotionPreferences';

const storageKey = 'yasnosled.motion';
let reduced = false;
type MediaListener = EventListenerOrEventListenerObject | ((event: MediaQueryListEvent) => void);
let listeners: Set<MediaListener>;

function Probe({ record }: { record?: (allowed: boolean) => void }) {
  const { ready, animate, ambient, enabled, toggle } = useVisualMotion();
  const config = useContext(MotionConfigContext);
  record?.(animate);
  return (
    <>
      <output aria-label="Interaction motion">{animate ? 'allowed' : 'paused'}</output>
      <output aria-label="Motion preferences">{ready ? 'resolved' : 'unresolved'}</output>
      <output aria-label="Ambient motion">{ambient ? 'running' : 'paused'}</output>
      <output aria-label="Motion configuration">{config.reducedMotion}</output>
      <button type="button" onClick={toggle}>
        {enabled ? 'Pause' : 'Resume'}
      </button>
    </>
  );
}

function changeReduced(next: boolean) {
  act(() => {
    reduced = next;
    const event = Object.assign(new Event('change'), {
      matches: reduced,
      media: '(prefers-reduced-motion: reduce)',
    });
    for (const listener of listeners) {
      if (typeof listener === 'function') listener(event);
      else listener.handleEvent(event);
    }
  });
}

describe('Resolved visual motion policy', () => {
  beforeEach(() => {
    localStorage.removeItem(storageKey);
    reduced = false;
    listeners = new Set();
    vi.spyOn(window, 'matchMedia').mockImplementation(query => ({
      media: query,
      get matches() {
        return reduced;
      },
      onchange: null,
      addEventListener: (_event: string, listener: MediaListener) => {
        listeners.add(listener);
      },
      removeEventListener: (_event: string, listener: MediaListener) => {
        listeners.delete(listener);
      },
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  });

  afterEach(() => {
    localStorage.removeItem(storageKey);
    delete document.documentElement.dataset.visualMotion;
    delete document.documentElement.dataset.visualAmbient;
  });

  test('never enables motion before resolving the browser and stored preferences', () => {
    const frames: boolean[] = [];
    render(
      <MotionPreferences>
        <Probe record={value => frames.push(value)} />
      </MotionPreferences>,
    );
    expect(frames[0]).toBe(false);
    expect(screen.getByLabelText('Motion preferences')).toHaveTextContent('resolved');
    expect(screen.getByLabelText('Interaction motion')).toHaveTextContent('allowed');
    expect(screen.getByLabelText('Motion configuration')).toHaveTextContent('never');
  });

  test('a persisted pause is respected on the first render and can be resumed', () => {
    localStorage.setItem(storageKey, 'off');
    const frames: boolean[] = [];
    render(
      <MotionPreferences>
        <Probe record={value => frames.push(value)} />
      </MotionPreferences>,
    );
    expect(frames.every(value => !value)).toBe(true);
    expect(screen.getByLabelText('Ambient motion')).toHaveTextContent('paused');
    expect(screen.getByLabelText('Motion configuration')).toHaveTextContent('always');
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    expect(screen.getByLabelText('Interaction motion')).toHaveTextContent('allowed');
    expect(localStorage.getItem(storageKey)).toBe('on');
  });

  test('a live OS preference change stops motion without reloading or losing the manual pause', () => {
    render(
      <MotionPreferences>
        <Probe />
      </MotionPreferences>,
    );
    changeReduced(true);
    expect(screen.getByLabelText('Interaction motion')).toHaveTextContent('paused');
    expect(screen.getByLabelText('Ambient motion')).toHaveTextContent('paused');
    expect(screen.getByLabelText('Motion configuration')).toHaveTextContent('always');
    expect(document.documentElement.dataset.visualMotion).toBe('off');
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    changeReduced(false);
    expect(screen.getByLabelText('Interaction motion')).toHaveTextContent('paused');
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    expect(screen.getByLabelText('Interaction motion')).toHaveTextContent('allowed');
    expect(screen.getByLabelText('Motion configuration')).toHaveTextContent('never');
  });

  test('hidden tabs pause ambient loops and restore them without changing the user preference', () => {
    render(
      <MotionPreferences>
        <Probe />
      </MotionPreferences>,
    );
    const visibility = vi.spyOn(document, 'visibilityState', 'get');
    visibility.mockReturnValue('hidden');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(screen.getByLabelText('Ambient motion')).toHaveTextContent('paused');
    expect(document.documentElement.dataset.visualAmbient).toBe('off');
    expect(screen.getByRole('button', { name: 'Pause' })).toBeVisible();
    visibility.mockReturnValue('visible');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(screen.getByLabelText('Ambient motion')).toHaveTextContent('running');
    expect(document.documentElement.dataset.visualAmbient).toBe('on');
    expect(localStorage.getItem(storageKey)).toBeNull();
  });

  test('unmount releases the media and visibility subscriptions', () => {
    const remove = vi.spyOn(document, 'removeEventListener');
    const { unmount } = render(
      <MotionPreferences>
        <Probe />
      </MotionPreferences>,
    );
    expect(listeners.size).toBe(1);
    unmount();
    expect(listeners.size).toBe(0);
    expect(remove).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
  });
});
