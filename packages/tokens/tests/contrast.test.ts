/**
 * APCA contrast — tier targets met across all output keys.
 *
 * @layer L4 (semantic) × Resolution
 * @governs plan-v2 §5.1 · Tier targets
 * @invariant primary/secondary/border_strong tiers meet their APCA target
 *            (±2 tolerance) on their canonical_bg across all 4 OutputKeys.
 * @why Labels must be readable; strict tiers are the body-text / strong-
 *      border cases where failure breaks accessibility.
 * @on-fail adjust the accent spine — usually by pulling the dark control
 *          point lower in L, or raising chroma_boost_per_dL. If structural,
 *          revisit tier_targets in config.
 */

import { describe, expect, test } from 'bun:test'
import { primitive, semantic, OUTPUTS } from './_helpers/fixtures'
import { validateApca } from '../src/validators/apca'

describe('APCA · tier targets', () => {
  const r = validateApca(primitive, semantic)

  test('no strict-tier error reported', () => {
    if (r.errors.length) throw new Error(r.errors.join('\n\n'))
    expect(r.errors.length).toBe(0)
  })

  test('label-neutral-primary ≥ Lc 60 in normal modes', () => {
    const fg = semantic.tokens.find((t) => t.name === 'label-neutral-primary')!
    expect(fg.diagnostic).toBeDefined()
    for (const output of ['light/normal', 'dark/normal'] as const) {
      const m = fg.diagnostic!.measured_apca[output]
      expect(m).toBeGreaterThanOrEqual(58) // tolerance
    }
  })

  test('label-neutral-primary ≥ Lc 75 in IC modes', () => {
    const fg = semantic.tokens.find((t) => t.name === 'label-neutral-primary')!
    for (const output of ['light/ic', 'dark/ic'] as const) {
      const m = fg.diagnostic!.measured_apca[output]
      expect(m).toBeGreaterThanOrEqual(73)
    }
  })

  test('every pipeline token has diagnostic with all 4 outputs', () => {
    for (const token of semantic.tokens) {
      if (token.diagnostic) {
        for (const output of OUTPUTS) {
          expect(token.diagnostic.measured_apca[output]).toBeGreaterThanOrEqual(0)
          expect(token.diagnostic.target_apca[output]).toBeGreaterThan(0)
        }
      }
    }
  })
})
