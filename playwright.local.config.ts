import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './test/offline', fullyParallel: false, workers: 1, timeout: 45000,
  expect: { timeout: 10000 }, reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4186', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: { command: 'npx vite preview --host 127.0.0.1 --port 4186 --strictPort',
    url: 'http://127.0.0.1:4186/local', reuseExistingServer: false },
})
