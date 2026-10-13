import { defineConfig, devices } from '@playwright/test'

const baseURL = 'http://127.0.0.1:4173'

export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: [
    {
      command: 'mix phx.server',
      cwd: './api',
      env: { MIX_ENV: 'test', PHX_SERVER: 'true', PUBLIC_ORIGIN: baseURL,
        ...(process.env.IZZY_E2E_DATABASE_URL ? { DATABASE_URL: process.env.IZZY_E2E_DATABASE_URL } : {}) },
      url: 'http://127.0.0.1:4002/api/network',
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'npx vite --config vite.config.ts --host 127.0.0.1 --port 4173 --strictPort',
      env: { VITE_SOCKET_URL: 'ws://127.0.0.1:4002/socket', IZZY_API_PROXY: 'http://127.0.0.1:4002' },
      url: baseURL,
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
})
