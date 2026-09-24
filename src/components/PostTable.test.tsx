import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import PostTable from './PostTable';
import type { PostSummary } from '../lib/posts';

const thumb = (name: string) => ({
  src: `/_astro/${name}.webp`,
  srcset: `/_astro/${name}.webp 120w`,
  width: 120,
  height: 60,
});

const posts: PostSummary[] = [
  {
    slug: 'slopcheck',
    title: 'Building slopcheck',
    date: '2026-09-17',
    topic: 'ai-engineering',
    minutes: 15,
    thumb: thumb('slop'),
  },
  {
    slug: 'tests',
    title: '1,500 tests',
    date: '2026-07-17',
    topic: 'ai-operations',
    minutes: 10,
    thumb: thumb('tests'),
  },
  {
    slug: 'storybook',
    title: 'Storybook mocks',
    date: '2024-10-25',
    topic: 'frontend-devops',
    minutes: 4,
    thumb: thumb('sb'),
  },
];

function rows() {
  return within(screen.getByRole('list')).getAllByRole('link');
}

describe('PostTable', () => {
  it('lists every post with its date, topic and reading time', () => {
    render(<PostTable posts={posts} />);
    expect(rows()).toHaveLength(3);
    const first = rows()[0];
    expect(first).toHaveAttribute('href', '/posts/slopcheck/');
    expect(first).toHaveTextContent('2026.09.17');
    expect(first).toHaveTextContent('AI Engineering');
    expect(first).toHaveTextContent('15 min');
  });

  it('shows each header image as a decorative thumbnail', () => {
    const { container } = render(<PostTable posts={posts} />);
    const images = container.querySelectorAll('.rows img');
    expect(images).toHaveLength(3);
    expect(images[0]).toHaveAttribute('src', '/_astro/slop.webp');
    expect(images[0]).toHaveAttribute('alt', '');
    expect(images[0]).toHaveAttribute('loading', 'lazy');
  });

  it('has no topic chips unless filterable', () => {
    render(<PostTable posts={posts} />);
    expect(screen.queryByRole('group', { name: /filter/i })).not.toBeInTheDocument();
  });

  it('filters by topic and records the choice in the URL', async () => {
    const user = userEvent.setup();
    render(<PostTable posts={posts} filterable />);

    await user.click(screen.getByRole('button', { name: 'AI in Operations' }));
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toHaveTextContent('1,500 tests');
    expect(screen.getByRole('button', { name: 'AI in Operations' })).toHaveAttribute('aria-pressed', 'true');
    expect(window.location.search).toBe('?topic=ai-operations');
    expect(window.location.hash).toBe('#posts');

    await user.click(screen.getByRole('button', { name: 'All' }));
    expect(rows()).toHaveLength(3);
    expect(window.location.search).toBe('');
  });

  it('starts from a topic in the URL, as old category links do', () => {
    window.history.replaceState(null, '', '/?topic=frontend-devops');
    render(<PostTable posts={posts} filterable />);
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toHaveTextContent('Storybook mocks');
  });

  it('ignores an unknown topic in the URL', () => {
    window.history.replaceState(null, '', '/?topic=nonsense');
    render(<PostTable posts={posts} filterable />);
    expect(rows()).toHaveLength(3);
  });
});
