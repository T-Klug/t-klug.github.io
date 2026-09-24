// Checks the post files themselves, beyond what the front matter schema can see.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const POSTS_DIR = resolve(__dirname, '../../src/content/posts');
const files = readdirSync(POSTS_DIR).filter((name) => /\.mdx?$/.test(name));

function frontMatter(name: string): Record<string, string> {
  const text = readFileSync(join(POSTS_DIR, name), 'utf8');
  const block = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!block) throw new Error(`${name} has no front matter block`);
  return Object.fromEntries(
    block[1]
      .split('\n')
      .map((line) => /^([a-z]+):\s*(.*)$/.exec(line))
      .filter((match): match is RegExpExecArray => match !== null)
      .map(([, key, value]) => [key, value.replace(/^"|"$/g, '')]),
  );
}

describe.each(files)('%s', (name) => {
  const data = frontMatter(name);

  it('is named YYYY-MM-DD-slug', () => {
    expect(name).toMatch(/^\d{4}-\d{2}-\d{2}-[a-z0-9-]+\.mdx?$/);
  });

  it('has a date that matches its filename', () => {
    expect(data.date).toBe(name.slice(0, 10));
  });

  it('points at a header image that exists', () => {
    expect(data.image, 'image is required').toBeTruthy();
    expect(existsSync(resolve(dirname(join(POSTS_DIR, name)), data.image))).toBe(true);
  });
});

describe('featured posts', () => {
  const featured = files
    .map((name) => ({ name, order: Number(frontMatter(name).featured) }))
    .filter((post) => post.order > 0);

  it('has three, numbered 1 to 3 with no gaps', () => {
    expect(featured.map((post) => post.order).sort()).toEqual([1, 2, 3]);
  });
});

describe('old site URLs', () => {
  const legacy = readFileSync(resolve(__dirname, '../fixtures/legacy-urls.txt'), 'utf8').split('\n').filter(Boolean);

  it('still has a post for every old /posts/ URL', () => {
    const slugs = new Set(files.map((name) => name.slice(11).replace(/\.mdx?$/, '')));
    const missing = legacy
      .filter((path) => path.startsWith('/posts/'))
      .map((path) => path.split('/')[2])
      .filter((slug) => !slugs.has(slug));
    expect(missing).toEqual([]);
  });
});
