import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright R1–R4 config.
 *
 * - R1 (vars resolve)      — every expected `--token` is non-empty
 * - R2 (mode toggle)       — light/dark swap changes `--bg-primary`
 * - R3 (contrast toggle)   — normal/ic swap changes IC-specific vars
 * - R4 (tailwind == raw)   — `.bg-accent` computed color equals `var(--accent)`
 *
 * Dev server is launched by Playwright (vite on :5173) unless one is
 * already listening. In CI we build once then `vite preview` on :4173.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: process.env.PW_BASE_URL ?? 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: process.env.PW_BASE_URL
    ? undefined
    : {
        command: 'pnpm dev',
        url: 'http://localhost:5173',
        reuseExistingServer: !process.env.CI,
        stdout: 'pipe',
        stderr: 'pipe',
        timeout: 60_000,
      },
})
