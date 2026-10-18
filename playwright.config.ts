import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './qa',
  timeout: 60000,
  retries: 0,
  workers: 1,
  use: {
    headless: true,
    channel: 'chrome',
    viewport: { width: 390, height: 844 },
    ignoreHTTPSErrors: true
  }
})
