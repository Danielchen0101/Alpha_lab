import AxeBuilder from '@axe-core/playwright';
import { expect, Page, test } from '@playwright/test';

const PUBLIC_ROUTES = [
  '/',
  '/platform',
  '/workflow',
  '/research',
  '/examples',
  '/data',
  '/technology',
  '/about',
  '/security',
  '/terms',
  '/privacy',
  '/signin',
  '/signup',
  '/forgot-password',
  '/auth/confirmed',
  '/reset-password',
] as const;

const ACCESSIBILITY_ROUTES = [
  '/',
  '/platform',
  '/examples',
  '/security',
  '/terms',
] as const;

type RuntimeFailures = {
  pageErrors: string[];
  appConsoleErrors: string[];
  sameOriginServerErrors: string[];
};

const watchRuntimeFailures = (page: Page): RuntimeFailures => {
  const failures: RuntimeFailures = {
    pageErrors: [],
    appConsoleErrors: [],
    sameOriginServerErrors: [],
  };

  page.on('pageerror', (error) => failures.pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    // Third-party/network failures are validated through user-facing states.
    // Keep this assertion focused on uncaught application/runtime failures.
    if (/(?:uncaught|typeerror|referenceerror|cannot read|invariant|rendered (?:more|fewer) hooks)/i.test(text)) {
      failures.appConsoleErrors.push(text);
    }
  });
  page.on('response', (response) => {
    const responseUrl = new URL(response.url());
    const pageUrl = page.url() ? new URL(page.url()) : null;
    if (
      pageUrl
      && responseUrl.origin === pageUrl.origin
      && response.status() >= 500
    ) {
      failures.sameOriginServerErrors.push(`${response.status()} ${responseUrl.pathname}`);
    }
  });

  return failures;
};

const setPublicPreferences = async (
  page: Page,
  language: 'en-US' | 'zh-CN',
  theme: 'light' | 'dark',
) => {
  await page.addInitScript(({ selectedLanguage, selectedTheme }) => {
    localStorage.setItem('quant-platform-language', selectedLanguage);
    localStorage.setItem('quant-platform-language-version', '2');
    localStorage.setItem('alphaLabThemeMode', selectedTheme);
    localStorage.setItem('alphaLabThemeModeVersion', '2');
  }, { selectedLanguage: language, selectedTheme: theme });
};

const waitForPublicPageToSettle = async (page: Page) => {
  await expect(page.locator('main')).toBeVisible();
  await page.evaluate(async () => {
    await document.fonts?.ready;
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
};

const assertPageQuality = async (
  page: Page,
  route: string,
  expected: { language: 'en' | 'zh'; theme: 'light' | 'dark' },
) => {
  await waitForPublicPageToSettle(page);
  await expect(page, `${route} should set a descriptive title`).not.toHaveTitle('');
  await expect(
    page.locator('html'),
    `${route} should apply the selected language`,
  ).toHaveAttribute('lang', expected.language);
  await expect(
    page.locator('html'),
    `${route} should apply the selected theme`,
  ).toHaveAttribute('data-theme', expected.theme);
  await expect.poll(
    () => page.evaluate(() => document.body.scrollWidth <= window.innerWidth + 1),
    { message: `${route} should not overflow horizontally` },
  ).toBe(true);

  const visibleCopy = await page.locator('main').innerText();
  expect(visibleCopy.trim().length, `${route} should render meaningful copy`).toBeGreaterThan(8);
  expect(visibleCopy, `${route} should not contain replacement characters`).not.toContain('\uFFFD');
  expect(
    visibleCopy,
    `${route} should not expose raw translation keys`,
  ).not.toMatch(/(?:^|\s)(?:auth|common|landing|security)\.[A-Za-z][\w.]*/);
  if (expected.language === 'zh') {
    expect(visibleCopy, `${route} should render Chinese copy`).toMatch(/[\u3400-\u9FFF]/);
  }
};

test.describe('Public route quality matrix', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route} renders cleanly in English light mode`, async ({ page }) => {
      const failures = watchRuntimeFailures(page);
      await setPublicPreferences(page, 'en-US', 'light');

      await page.goto(route);
      await assertPageQuality(page, route, { language: 'en', theme: 'light' });
      expect(failures.pageErrors, `${route} should not raise page errors`).toEqual([]);
      expect(failures.appConsoleErrors, `${route} should not log runtime errors`).toEqual([]);
      expect(failures.sameOriginServerErrors, `${route} should not receive local 5xx responses`).toEqual([]);
    });
  }

  test('all public routes remain usable in Chinese dark mobile mode', async ({ page }) => {
    const failures = watchRuntimeFailures(page);
    await page.setViewportSize({ width: 360, height: 780 });
    await setPublicPreferences(page, 'zh-CN', 'dark');

    for (const route of PUBLIC_ROUTES) {
      await page.goto(route);
      await assertPageQuality(page, route, { language: 'zh', theme: 'dark' });
    }

    expect(failures.pageErrors, 'Chinese dark mobile routes should not raise page errors').toEqual([]);
    expect(failures.appConsoleErrors, 'Chinese dark mobile routes should not log runtime errors').toEqual([]);
    expect(failures.sameOriginServerErrors, 'Chinese dark mobile routes should not receive local 5xx responses').toEqual([]);
  });

  for (const route of ['/', '/platform', '/examples'] as const) {
    test(`${route} renders a distinct native dark marketing surface`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(route);
      await page.evaluate(() => {
        localStorage.setItem('quant-platform-language', 'en-US');
        localStorage.setItem('quant-platform-language-version', '2');
        localStorage.setItem('alphaLabThemeMode', 'light');
        localStorage.setItem('alphaLabThemeModeVersion', '2');
      });
      await page.reload();
      await waitForPublicPageToSettle(page);

      const surface = page.locator('main.market-field-page, main.public-page').first();
      await expect(surface).toBeVisible();
      const light = await surface.evaluate((element) => {
        const style = getComputedStyle(element);
        return { colorScheme: style.colorScheme, backgroundColor: style.backgroundColor, color: style.color };
      });
      expect(light.colorScheme).toContain('light');

      await page.evaluate(() => localStorage.setItem('alphaLabThemeMode', 'dark'));
      await page.reload();
      await waitForPublicPageToSettle(page);
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

      const dark = await surface.evaluate((element) => {
        const style = getComputedStyle(element);
        return { colorScheme: style.colorScheme, backgroundColor: style.backgroundColor, color: style.color };
      });
      expect(dark.colorScheme).toContain('dark');
      expect(dark.backgroundColor).not.toBe(light.backgroundColor);
      expect(dark.color).not.toBe(light.color);
    });
  }

  for (const theme of ['light', 'dark'] as const) {
    for (const route of ACCESSIBILITY_ROUTES) {
      test(`${route} has no serious or critical accessibility violations in ${theme} mode`, async ({ page }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await setPublicPreferences(page, 'en-US', theme);
        await page.goto(route);
        await waitForPublicPageToSettle(page);
        const result = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();
        const seriousOrCritical = result.violations
          .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
          .map(({ id, help, nodes }) => ({
            id,
            help,
            targets: nodes.map((node) => node.target),
          }));
        expect(seriousOrCritical).toEqual([]);
      });
    }
  }
});
