import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { StudioState } from './StudioState';

describe('StudioState', () => {
  test('announces recoverable errors without exposing implementation details', () => {
    render(
      <StudioState
        variant="error"
        title="Query could not be loaded"
        message="Change the date range or retry."
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Query could not be loaded');
    expect(screen.getByRole('alert')).not.toHaveTextContent('stack');
  });

  test('announces permission denial as a non-destructive status', () => {
    render(
      <StudioState
        variant="permission"
        title="Project access is unavailable"
        message="No project data was loaded."
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('No project data was loaded');
  });
});
