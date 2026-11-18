import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test as base, expect } from '@playwright/test';

// Keep tests off the network: block Google Analytics, which only loads in production builds.
export const test = base.extend<{ blockAnalytics: void }>({
  blockAnalytics: [
    async ({ page }, use) => {
      await page.route(/googletagmanager\.com|google-analytics\.com/, (route) => route.abort());
      await use();
    },
    { auto: true },
  ],
});

export { expect };

export interface PostFile {
  slug: string;
  title: string;
  topic: string;
  date: string;
}

const POSTS_DIR = resolve(import.meta.dirname, '../../src/content/posts');

/**
 * The published posts on disk, newest first, so tests follow the content instead of hard-coding counts.
 * Drafts are left out: the tests run against the production build, which does not include them.
 */
export const POSTS: PostFile[] = readdirSync(POSTS_DIR)
  .filter((name) => /\.mdx?$/.test(name))
  .map((name) => {
    const text = readFileSync(resolve(POSTS_DIR, name), 'utf8');
    const field = (key: string) => new RegExp(`^${key}: "?(.*?)"?$`, 'm').exec(text)?.[1] ?? '';
    return {
      slug: name.slice(11).replace(/\.mdx?$/, ''),
      title: field('title'),
      topic: field('topic'),
      date: name.slice(0, 10),
      draft: field('draft') === 'true',
    };
  })
  .filter((post) => !post.draft)
  .sort((a, b) => b.date.localeCompare(a.date));
