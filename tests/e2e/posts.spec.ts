import { POSTS, expect, test } from './fixtures';

for (const post of POSTS) {
  test(`post renders: ${post.slug}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    const response = await page.goto(`/posts/${post.slug}/`);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(post.title);

    const hero = page.locator('img.post-hero');
    await expect(hero).toBeVisible();
    expect(await hero.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    await expect(page.locator('.prose p').first()).not.toBeEmpty();
    expect(errors).toEqual([]);
  });
}

test('the contents list jumps to its section', async ({ page, isMobile }) => {
  await page.goto('/posts/typesafe-jev-slopcheck/');
  const link = page.getByRole('navigation', { name: 'Contents' }).getByRole('link', { name: 'Where It Falls Down' });
  await link.click();
  await expect(page).toHaveURL(/#where-it-falls-down$/);
  await expect(page.getByRole('heading', { name: 'Where It Falls Down' })).toBeInViewport();
  if (!isMobile) await expect(link).toHaveAttribute('aria-current', 'true');
});

test('GitHub Actions expressions in code samples survive (Jekyll used to strip them)', async ({ page }) => {
  await page.goto('/posts/real-time-package-updates/');
  await expect(page.locator('pre').first()).toContainText('${{ secrets.GITHUB_TOKEN }}');
});

test('old category URLs land on the matching topic', async ({ page }) => {
  await page.goto('/categories/frontend/');
  await expect(page).toHaveURL(/\/\?topic=frontend-devops#posts$/);
  await expect(page.getByRole('button', { name: 'Frontend & DevOps' })).toHaveAttribute('aria-pressed', 'true');
});

test('tag pages list their posts', async ({ page }) => {
  await page.goto('/tags/claude-code/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('#claude-code');
  await expect(page.locator('.rows a').first()).toBeVisible();
});

test('unknown URLs get the 404 page', async ({ page }) => {
  const response = await page.goto('/no-such-page/');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText("That page isn't here.");
});

test('old image URLs still serve images, for search results and earlier social shares', async ({ request }) => {
  for (const path of ['/assets/img/hybrid.png', '/assets/img/aidlc.jpg', '/assets/img/avatar3.png']) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    expect(response.headers()['content-type'], path).toMatch(/^image\/(png|jpeg)/);
  }
});
