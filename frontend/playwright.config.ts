import { defineConfig, devices } from '@playwright/test';

const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL;
const localBaseURL = 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: externalBaseURL || localBaseURL,
    trace: process.env.CI ? 'on-first-retry' : 'off',
    screenshot: 'only-on-failure',
  },
  webServer: externalBaseURL ? undefined : {
    command: 'npm run build && npm run serve:e2e',
    url: localBaseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      HOST: '127.0.0.1',
      PORT: '4173',
      BUILD_PATH: 'build-e2e',
      REACT_APP_API_BASE_URL: '/api',
      REACT_APP_ENABLE_ANALYTICS: 'false',
      REACT_APP_SUPABASE_URL: 'https://example.supabase.co',
      REACT_APP_SUPABASE_ANON_KEY: 'ci-public-placeholder',
      REACT_APP_TURNSTILE_SITE_KEY: '',
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
