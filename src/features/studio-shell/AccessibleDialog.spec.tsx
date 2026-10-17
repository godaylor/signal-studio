import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, test } from 'vitest';
import { LOCALE_CONFIG } from '@/lib/constants';
import { setItem } from '@/lib/storage';
import { setLocale } from '@/store/app';
import { AccessibleDialog } from './AccessibleDialog';

function DialogHarness() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open palette
      </button>
      <AccessibleDialog open={open} title="Go to" onClose={() => setOpen(false)}>
        <input data-autofocus aria-label="Search pages" />
        <button type="button">Last action</button>
      </AccessibleDialog>
    </>
  );
}

describe('AccessibleDialog', () => {
  test('escapes the animated route while inheriting the studio theme container', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <div data-studio-shell>
        <div data-animated-route>
          <DialogHarness />
        </div>
      </div>,
    );
    await user.click(screen.getByRole('button', { name: 'Open palette' }));
    const dialog = screen.getByRole('dialog');
    expect(container.querySelector('[data-studio-shell]')).toContainElement(dialog);
    expect(container.querySelector('[data-animated-route]')).not.toContainElement(dialog);
    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Open palette' })).toHaveFocus();
  });
  test('moves focus in, closes with Escape and restores trigger focus', async () => {
    const user = userEvent.setup();
    render(<DialogHarness />);
    const trigger = screen.getByRole('button', { name: 'Open palette' });

    await user.click(trigger);

    expect(screen.getByRole('dialog', { name: 'Go to' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'Search pages' })).toHaveFocus();
    });

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  test('traps forward and reverse tab navigation', async () => {
    setItem(LOCALE_CONFIG, 'ru-RU');
    setLocale('ru-RU');
    const user = userEvent.setup();
    render(<DialogHarness />);
    await user.click(screen.getByRole('button', { name: 'Open palette' }));

    const close = screen.getByRole('button', { name: 'Закрыть' });
    const last = screen.getByRole('button', { name: 'Last action' });
    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(close).toHaveFocus();
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(last).toHaveFocus();
  });
});
