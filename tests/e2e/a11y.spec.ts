import AxeBuilder from '@axe-core/playwright';
import { POSTS, expect, test } from './fixtures';

// Every post is checked because code samples bring their own colors.
const PAGES = ['/', '/about/', '/tags/', '/tags/ai/', '/404.html', ...POSTS.map((post) => `/posts/${post.slug}/`)];

// axe gives the same answer in every browser, so run it once, in Chromium.
test.skip(({ browserName, isMobile }) => browserName !== 'chromium' || isMobile, 'Chromium desktop only');

for (const theme of ['dark', 'light'] as const) {
  for (const path of PAGES) {
    test(`no accessibility violations: ${path} (${theme})`, async ({ page }) => {
      await page.addInitScript((value) => localStorage.setItem('theme', value), theme);
      await page.goto(path);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);

      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      const summary = results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
      expect(summary).toEqual([]);
    });
  }
}
