import AxeBuilder from '@axe-core/playwright';
import { test, expect, Page } from '@playwright/test';

const assertNoCriticalAccessibilityViolations = async (page: Page) => {
  const result = await new AxeBuilder({ page }).analyze();
  const critical = result.violations
    .filter((violation) => violation.impact === 'critical')
    .map(({ id, help, nodes }) => ({ id, help, targets: nodes.map((node) => node.target) }));
  expect(critical).toEqual([]);
};

test.describe('Public application smoke tests', () => {
  test('homepage renders meaningful content without a horizontal overflow', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#root')).toBeAttached();
    await expect(page.locator('main')).toBeVisible();
    await expect(page).toHaveTitle(/AlphaLab|Quant Research Platform/);
    await expect.poll(() => page.evaluate(() => document.body.scrollWidth <= window.innerWidth + 1)).toBe(true);
  });

  test('sign-in form is keyboard-labelled and links to account creation', async ({ page }) => {
    await page.goto('/signin');
    const email = page.locator('input[type="email"]');
    const password = page.locator('input[type="password"]');
    await expect(email).toBeVisible();
    await expect(password).toBeVisible();
    await expect(email).toHaveAttribute('id', /email/i);
    await expect(password).toHaveAttribute('id', /password/i);
    await expect(page.locator('a[href="/signup"]')).toBeVisible();
    await expect(page.locator('a[href="/forgot-password"]')).toBeVisible();
  });

  test('OAuth callback errors are localized and removed from the address bar', async ({ page }) => {
    const preservedHistoryState = {
      idx: 7,
      key: 'oauth-error-state',
      usr: { returnContext: 'preserved' },
    };
    await page.addInitScript((state) => {
      window.history.replaceState(state, document.title, window.location.href);
    }, preservedHistoryState);
    await page.goto('/signin?error=access_denied&error_description=Provider+cancelled');
    await expect(page.getByRole('alert')).toContainText('OAuth login failed. Please try again.');
    await expect(page).toHaveURL('/signin');
    await expect.poll(() => page.evaluate(() => window.history.state)).toEqual(preservedHistoryState);
  });

  test('OAuth fragment errors are localized without discarding a safe next target', async ({ page }) => {
    await page.goto('/signin?next=%2Fresearch#error=access_denied&error_description=Provider+cancelled');
    await expect(page.getByRole('alert')).toContainText('OAuth login failed. Please try again.');
    await expect(page).toHaveURL('/signin?next=%2Fresearch');
  });

  test('account creation and recovery forms remain available without credentials', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toHaveCount(2);
    await expect(page.locator('a[href="/signin"]')).toBeVisible();

    await page.goto('/forgot-password');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('form')).toBeVisible();

    await page.goto('/reset-password');
    await expect(page.locator('a[href="/forgot-password"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
  });

  test('unknown routes show the public 404 recovery page', async ({ page }) => {
    await page.goto('/some-nonexistent-page-xyz');
    await expect(page.locator('main')).toContainText('404');
    await expect(page.locator('a, button').filter({ hasText: /home|首页/i }).first()).toBeVisible();
  });

  for (const route of ['/dashboard', '/market', '/crypto', '/kalshi', '/agent', '/portfolio', '/settings/configuration']) {
    test(`protected route ${route} redirects to sign in`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/signin(?:\?|$)/);
      await expect(page.locator('input[type="email"]')).toBeVisible();
      await expect(page.locator('input[type="password"]')).toBeVisible();
    });
  }

  for (const unsafeNext of ['//malicious.example/path', '/%5C%5Cmalicious.example/path']) {
    test(`unsafe redirect target ${unsafeNext} cannot escape the application`, async ({ page }) => {
      await page.goto(`/signin?next=${encodeURIComponent(unsafeNext)}`);
      await expect(page).toHaveURL(/\/signin\?/);
      await expect(page.locator('input[type="email"]')).toBeVisible();
    });
  }

  test('homepage and sign-in have no critical axe violations', async ({ page }) => {
    await page.goto('/');
    await assertNoCriticalAccessibilityViolations(page);
    await page.goto('/signin');
    await assertNoCriticalAccessibilityViolations(page);
  });

  test('the unversioned theme bootstrap is never cached as an immutable asset', async ({ request }) => {
    const response = await request.get('/theme-bootstrap.js');
    expect(response.ok()).toBe(true);
    expect(response.headers()['cache-control'] || '').not.toContain('immutable');
  });

  test('sign-in remains usable on a narrow mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto('/signin');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.body.scrollWidth <= window.innerWidth + 1)).toBe(true);
  });
});
