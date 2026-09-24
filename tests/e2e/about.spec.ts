import { expect, test } from './fixtures';

test('about page shows the bio, numbers and experience', async ({ page }) => {
  await page.goto('/about/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Engineer first. Now an operator.');
  await expect(page.getByText('Operating Principal for Technology & AI at Clearhaven Partners')).toBeVisible();
  await expect(page.locator('section[aria-labelledby="numbers"] .cell')).toHaveCount(4);
  await expect(page.locator('.xp .row')).toHaveCount(6);
  await expect(page.getByText('ByteChek (acquired by Armanino)')).toBeVisible();
  await expect(page.getByText('Views are my own.')).toBeVisible();
});
