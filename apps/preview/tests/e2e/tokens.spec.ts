/**
 * @layer Runtime (R1–R4) — plan/test-strategy.md §12
 * @governs The Tailwind v4 preset + raw CSS vars actually render correctly in a real
 *          browser under all four `(mode × contrast)` sectors, and that the Tailwind
 *          utilities resolve to the same computed color as the raw `var(--token)`.
 * @invariant
 *   R1 — every expected `--token` resolves to a non-empty string in every sector.
 *   R2 — toggling `data-mode` swaps `--bg-primary` and `--label-neutral-primary`.
 *   R3 — toggling `data-contrast` shifts IC-affected values.
 *   R4 — `.bg-{accent}` computed background equals `var(--{accent})` verbatim.
 * @on-fail Inspect `apps/preview/src/styles.css` (Tailwind preset import order,
 *          `@source inline` safelist) and `packages/tokens/dist/tokens.css`
 *          (scope selectors). Re-run `bun test` in packages/tokens to confirm
 *          the underlying token layer is intact.
 */

import { test, expect, Page } from '@playwright/test'

const ACCENTS = [
  'brand',
  'red',
  'orange',
  'yellow',
  'green',
  'teal',
  'mint',
  'blue',
  'indigo',
  'purple',
  'pink',
] as const

const BG_TIERS = ['primary', 'secondary', 'tertiary'] as const
const LABEL_TIERS = ['primary', 'secondary', 'tertiary', 'quaternary'] as const

async function cssVar(page: Page, name: string): Promise<string> {
  return await page.evaluate(
    n => getComputedStyle(document.documentElement).getPropertyValue(n).trim(),
    name,
  )
}

async function setSector(
  page: Page,
  mode: 'light' | 'dark',
  contrast: 'normal' | 'ic',
): Promise<void> {
  await page.evaluate(
    ([m, c]) => {
      document.documentElement.dataset.mode = m
      document.documentElement.dataset.contrast = c
    },
    [mode, contrast] as const,
  )
}

test.describe('R1 · every expected --token resolves in every sector', () => {
  for (const mode of ['light', 'dark'] as const) {
    for (const contrast of ['normal', 'ic'] as const) {
      test(`sector ${mode}/${contrast}`, async ({ page }) => {
        await page.goto('/')
        await setSector(page, mode, contrast)
        for (const tier of BG_TIERS) {
          const v = await cssVar(page, `--bg-${tier}`)
          expect(v, `--bg-${tier}`).not.toBe('')
        }
        for (const a of ACCENTS) {
          const v = await cssVar(page, `--${a}`)
          expect(v, `--${a}`).not.toBe('')
        }
        for (const tier of LABEL_TIERS) {
          const v = await cssVar(page, `--label-neutral-${tier}`)
          expect(v, `--label-neutral-${tier}`).not.toBe('')
        }
      })
    }
  }
})

test.describe('R2 · mode toggle swaps mode-scoped vars', () => {
  test('light ↔ dark flips --bg-primary and --label-neutral-primary', async ({
    page,
  }) => {
    await page.goto('/')
    await setSector(page, 'light', 'normal')
    const lightBg = await cssVar(page, '--bg-primary')
    const lightLabel = await cssVar(page, '--label-neutral-primary')
    await setSector(page, 'dark', 'normal')
    const darkBg = await cssVar(page, '--bg-primary')
    const darkLabel = await cssVar(page, '--label-neutral-primary')
    expect(lightBg).not.toBe('')
    expect(darkBg).not.toBe('')
    expect(lightBg).not.toBe(darkBg)
    expect(lightLabel).not.toBe(darkLabel)
  })
})

test.describe('R3 · contrast toggle shifts IC-specific vars', () => {
  test('normal ↔ ic changes at least one accent primitive', async ({
    page,
  }) => {
    await page.goto('/')
    await setSector(page, 'light', 'normal')
    const normalByAccent = new Map<string, string>()
    for (const a of ACCENTS) {
      normalByAccent.set(a, await cssVar(page, `--${a}`))
    }
    await setSector(page, 'light', 'ic')
    const changed: string[] = []
    for (const a of ACCENTS) {
      const ic = await cssVar(page, `--${a}`)
      if (ic !== normalByAccent.get(a)) changed.push(a)
    }
    // Yellow and Orange in particular are required to shift (IC design
    // intent — brown/earth-tone replacements for low-contrast hues).
    expect(changed, 'no accent primitive shifted under IC').not.toHaveLength(0)
    expect(changed).toEqual(expect.arrayContaining(['yellow', 'orange']))
  })
})

test.describe('R4 · Tailwind utility bg-{accent} == raw var(--{accent})', () => {
  test('every accent pair computes to identical color', async ({ page }) => {
    await page.goto('/')
    await setSector(page, 'light', 'normal')
    for (const a of ACCENTS) {
      const [tw, raw] = await Promise.all([
        page.evaluate(
          sel =>
            getComputedStyle(document.querySelector(sel)!).backgroundColor,
          `[data-testid="tw-${a}"]`,
        ),
        page.evaluate(
          sel =>
            getComputedStyle(document.querySelector(sel)!).backgroundColor,
          `[data-testid="raw-${a}"]`,
        ),
      ])
      expect(tw, `tailwind bg-${a}`).not.toBe('')
      expect(raw, `raw var(--${a})`).not.toBe('')
      expect(tw, `bg-${a} should match var(--${a})`).toBe(raw)
    }
  })
})
