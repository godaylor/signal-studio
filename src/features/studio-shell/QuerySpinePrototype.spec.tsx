import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';
import { QuerySpinePrototype } from './QuerySpinePrototype';

describe('QuerySpinePrototype', () => {
  test('uses an ordered, keyboard-operable query definition', async () => {
    const user = userEvent.setup();
    const { container } = render(<QuerySpinePrototype />);
    const blocks = screen.getAllByRole('button');

    expect(container.querySelector('ol')).toBeInTheDocument();
    expect(blocks).toHaveLength(5);
    expect(blocks[0]).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: /Filters/ }));
    expect(screen.getByRole('button', { name: /Filters/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
