import { test, expect } from '@playwright/test';

const BASE = 'https://www.alphalabquant.com';

test.describe('Smoke Tests — Public Pages', () => {

  test('homepage loads', async ({ page }) => {
    await page.goto(BASE);
    await expect(page.locator('#root')).toBeAttached();
    await expect(page.locator('text=AlphaLab').first()).toBeVisible();
  });

  test('signin page loads', async ({ page }) => {
    await page.goto(`${BASE}/signin`);
    await expect(page.locator('#root')).toBeAttached();
    await page.waitForTimeout(2000);
    const body = await page.textContent('body');
    expect(body).toContain('Sign In');
  });

  test('signup page loads', async ({ page }) => {
    await page.goto(`${BASE}/signup`);
    await expect(page.locator('#root')).toBeAttached();
    await page.waitForTimeout(2000);
    const body = await page.textContent('body');
    expect(body).toContain('Sign Up');
  });

  test('forgot-password page loads', async ({ page }) => {
    await page.goto(`${BASE}/forgot-password`);
    await expect(page.locator('#root')).toBeAttached();
  });

  test('security page loads', async ({ page }) => {
    await page.goto(`${BASE}/security`);
    await expect(page.locator('#root')).toBeAttached();
    await page.waitForTimeout(2000);
    const body = await page.textContent('body');
    expect(body).toContain('Security');
  });

  test('404 page shows for unknown route', async ({ page }) => {
    await page.goto(`${BASE}/some-nonexistent-page-xyz`);
    await expect(page.locator('#root')).toBeAttached();
    await page.waitForTimeout(2000);
    const body = await page.textContent('body');
    expect(body).toContain('404');
  });

  test('protected route redirects to signin', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    await expect(page.locator('#root')).toBeAttached();
    await page.waitForTimeout(3000);
    const url = page.url();
    expect(url).toContain('/signin');
  });
});
