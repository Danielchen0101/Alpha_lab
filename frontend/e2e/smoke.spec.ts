import { test, expect } from '@playwright/test';

const BASE = 'https://www.alphalabquant.com';

test.describe('Smoke Tests — Public Pages', () => {

  test('homepage loads', async ({ page }) => {
    await page.goto(BASE);
    await expect(page.locator('#root')).toBeAttached();
    await page.waitForTimeout(1500);
    // Verify React rendered content (not just the noscript fallback)
    await expect(page.locator('button').first()).toBeVisible();
  });

  test('signin page loads', async ({ page }) => {
    await page.goto(`${BASE}/signin`);
    await expect(page.locator('#root')).toBeAttached();
    await page.waitForTimeout(2000);
    // Locale-agnostic: check for email input or sign-in button
    const hasInput = await page.locator('input[type="email"], input[placeholder*="mail"], input[id*="email"]').count();
    expect(hasInput).toBeGreaterThanOrEqual(1);
  });

  test('signup page loads', async ({ page }) => {
    await page.goto(`${BASE}/signup`);
    await expect(page.locator('#root')).toBeAttached();
    await page.waitForTimeout(2000);
    // Check for password field (locale-agnostic)
    const hasPasswordInput = await page.locator('input[type="password"]').count();
    expect(hasPasswordInput).toBeGreaterThanOrEqual(1);
  });

  test('forgot-password page loads', async ({ page }) => {
    await page.goto(`${BASE}/forgot-password`);
    await expect(page.locator('#root')).toBeAttached();
    await page.waitForTimeout(2000);
    // Check for email input
    const hasEmailInput = await page.locator('input[type="email"], input[placeholder*="mail"]').count();
    expect(hasEmailInput).toBeGreaterThanOrEqual(1);
  });

  test('unknown route shows 404 page', async ({ page }) => {
    await page.goto(`${BASE}/some-nonexistent-page-xyz`);
    await expect(page.locator('#root')).toBeAttached();
    await page.waitForTimeout(2500);
    // Should render 404 content (not the app layout)
    const body = await page.textContent('body');
    expect(body).toContain('404');
  });

  test('protected route redirects to signin', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/signin/);
    await expect(page.locator('#root')).toBeAttached();
    // Confirm sign-in form rendered — check for any input field (locale-agnostic)
    await expect(page.locator('input').first()).toBeVisible({ timeout: 5000 });
  });
});
