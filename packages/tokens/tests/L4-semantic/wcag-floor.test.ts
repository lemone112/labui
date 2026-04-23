/**
 * WCAG floor — label tiers meet their declared WCAG 2.x ratio floor.
 *
 * @layer L4 (semantic) × Contrast
 * @governs plan-v2 §5.3.2 · Tier targets (apca + wcag)
 * @governs test-strategy.md §L4.5 · WCAG ratio met for every tier
 * @invariant For every label tier whose config declares
 *            `tier_targets[tier][contrast].wcag`, the measured WCAG
 *            contrast ratio on the tier's canonical bg is ≥ the target
 *            ratio, within tolerance. Tiers that do not declare a WCAG
 *            floor (fills, borders) are excluded from this assertion —
 *            §L4.4 (APCA) covers them.
 * @why APCA alone is not enough for our design system's "readability
 *      floor" invariant: for some hues (notably blue label tiers on
 *      white), WCAG demands a darker L than the APCA target would
 *      produce. The resolver picks the stricter of the two; this test
 *      guards that behaviour.
 * @on-fail Either the resolver regressed (no longer searches the WCAG
 *          axis), or the tier's spine can't physically reach the
 *          declared WCAG floor inside the chosen gamut. Inspect
 *          diagnostic.measured_wcag for the failing output key.
 */

import { describe, expect, test } from 'bun:test'
import { semantic, OUTPUTS, config } from '../_helpers/fixtures'

const WCAG_TOLERANCE = 0.05

describe('WCAG floor · labels', () => {
  const labelTokens = semantic.tokens.filter(
    (t) =>
      t.diagnostic?.target_wcag != null &&
      t.name.startsWith('label-'),
  )

  test('at least one label tier declares a WCAG floor (sanity)', () => {
    expect(labelTokens.length).toBeGreaterThan(0)
  })

  for (const token of semantic.tokens) {
    const d = token.diagnostic
    if (!d?.target_wcag || !d.measured_wcag) continue

    test(`${token.name} meets WCAG floor on ${d.bg_path}`, () => {
      for (const output of OUTPUTS) {
        const target = d.target_wcag![output]
        const measured = d.measured_wcag![output]
        expect(measured + WCAG_TOLERANCE).toBeGreaterThanOrEqual(target)
      }
    })
  }

  test('config: every label tier declares both apca and wcag', () => {
    const labelTiers = ['primary', 'secondary', 'tertiary', 'quaternary'] as const
    for (const tier of labelTiers) {
      for (const contrast of ['normal', 'ic'] as const) {
        const entry = config.colors.tier_targets[tier][contrast]
        expect(typeof entry.apca).toBe('number')
        expect(typeof entry.wcag).toBe('number')
      }
    }
  })
})
