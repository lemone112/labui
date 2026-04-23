import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright R1–R4 config.
 *
 * - R1 (vars resolve)      — every expected `--token` is non-empty
 * - R2 (mode toggle)       — light/dark swap changes `--bg-primary`
 * - R3 (contrast toggle)   — normal/ic swap changes IC-specific vars
 * - R4 (tailwind == raw)   — `.bg-accent` computed color equals `var(--accent)`
 *
 * Two ways to drive the app:
 *   - Local dev (default)   — Playwright launches `vite` on :5173.
 *   - Against a prod build  — set `PW_USE_PREVIEW=1` (CI path). Playwright
 *     runs `vite preview --port 4173` so R1–R4 exercise the same artifact
 *     that would ship, not the dev-only transform pipeline.
 */
const usePreview = !!process.env.PW_USE_PREVIEW
const port = usePreview ? 4173 : 5173
const baseURL =
  process.env.PW_BASE_URL ?? `http://localhost:${port}`

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL,
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
        command: usePreview
          ? 'pnpm exec vite preview --port 4173 --strictPort'
          : 'pnpm dev',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        stdout: 'pipe',
        stderr: 'pipe',
        timeout: 60_000,
      },
})
