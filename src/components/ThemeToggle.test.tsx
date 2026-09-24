import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import ThemeToggle, { THEME_STORAGE_KEY } from './ThemeToggle';

describe('ThemeToggle', () => {
  it('offers light mode when the page is dark', () => {
    document.documentElement.dataset.theme = 'dark';
    render(<ThemeToggle />);
    expect(screen.getByRole('button')).toHaveAccessibleName('Switch to light theme');
  });

  it('switches the page theme and remembers the choice', async () => {
    const user = userEvent.setup();
    document.documentElement.dataset.theme = 'dark';
    render(<ThemeToggle />);

    await user.click(screen.getByRole('button'));
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(await screen.findByRole('button', { name: 'Switch to dark theme' })).toBeInTheDocument();

    await user.click(screen.getByRole('button'));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('reflects a saved light theme applied before it mounted', () => {
    document.documentElement.dataset.theme = 'light';
    render(<ThemeToggle />);
    expect(screen.getByRole('button')).toHaveAccessibleName('Switch to dark theme');
  });
});
