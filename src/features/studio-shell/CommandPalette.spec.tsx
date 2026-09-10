import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Home, Search } from 'lucide-react';
import { describe, expect, test, vi } from 'vitest';
import { CommandPalette } from './CommandPalette';

const items = [
  {
    id: 'home' as const,
    label: 'Home',
    description: 'Project health',
    icon: Home,
    path: '/studio/project/home',
  },
  {
    id: 'explore' as const,
    label: 'Explore',
    description: 'Define a question',
    icon: Search,
    path: '/studio/project/explore',
  },
];

describe('CommandPalette', () => {
  test('filters bounded permitted pages and navigates with the keyboard', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <CommandPalette
        items={items}
        open={true}
        onOpenChange={onOpenChange}
        onNavigate={onNavigate}
      />,
    );

    const input = await screen.findByRole('textbox', { name: 'Search Studio pages' });
    await user.type(input, 'Explore');
    expect(screen.queryByRole('option', { name: /Home/ })).not.toBeInTheDocument();
    await user.keyboard('{Enter}');

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onNavigate).toHaveBeenCalledWith('/studio/project/explore');
  });
});
