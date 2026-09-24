import { POSTS, expect, test } from './fixtures';

test.describe('home page', () => {
  test('shows the profile, three featured builds and every post', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/TJ Klug/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Technology and AI operator in private equity.');
    await expect(page.getByRole('img', { name: 'TJ Klug' })).toBeVisible();

    const featured = page.locator('section[aria-labelledby="featured"] a.cell');
    await expect(featured).toHaveCount(3);
    await expect(featured.first()).toContainText('$0.91');

    await expect(page.locator('#posts .rows a')).toHaveCount(POSTS.length);
  });

  test('filters posts by topic and keeps the filter in the URL', async ({ page }) => {
    await page.goto('/');
    const rows = page.locator('#posts .rows a');
    const engineering = POSTS.filter((post) => post.topic === 'ai-engineering').length;

    await page.getByRole('button', { name: 'AI Engineering' }).click();
    await expect(rows).toHaveCount(engineering);
    await expect(page).toHaveURL(/\?topic=ai-engineering/);

    await page.reload();
    await expect(rows).toHaveCount(engineering);
    await expect(page.getByRole('button', { name: 'AI Engineering' })).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('button', { name: 'All' }).click();
    await expect(rows).toHaveCount(POSTS.length);
  });

  test('defaults to dark and remembers a switch to light', async ({ page }) => {
    await page.goto('/');
    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-theme', 'dark');

    await page.getByRole('button', { name: 'Switch to light theme' }).click();
    await expect(html).toHaveAttribute('data-theme', 'light');

    await page.goto('/about/');
    await expect(html).toHaveAttribute('data-theme', 'light');
    await expect(page.getByRole('button', { name: 'Switch to dark theme' })).toBeVisible();
  });

  test('opens a post from the list', async ({ page }) => {
    await page.goto('/');
    const first = page.locator('#posts .rows a').first();
    const title = await first.locator('.title').innerText();
    await first.click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
  });
});
