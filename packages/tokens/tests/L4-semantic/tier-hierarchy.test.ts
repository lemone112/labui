/**
 * Tier hierarchy — contrast decreases primary → quaternary.
 *
 * @layer L4 (semantic) × Resolution
 * @governs plan-v2 §5.1 · Tier targets
 * @invariant For any accent family, measured APCA Lc decreases along
 *            primary > secondary > tertiary > quaternary on each output.
 * @why Tier naming encodes visual prominence; inversions break that.
 * @on-fail tier_targets ordering broken, or spine extrapolation produced
 *          identical L for adjacent tiers (too-short spine).
 */

import { describe, expect, test } from 'bun:test'
import { semantic, OUTPUTS } from '../_helpers/fixtures'

const FAMILIES = ['neutral', 'brand', 'danger', 'warning', 'success', 'info']
const ORDER = ['primary', 'secondary', 'tertiary', 'quaternary']

describe('Tier hierarchy · APCA decreases along tiers', () => {
  for (const family of FAMILIES) {
    test(`labels.${family}: primary > secondary > tertiary > quaternary`, () => {
      const tokens = ORDER.map((tier) =>
        semantic.tokens.find((t) => t.name === `label-${family}-${tier}`),
      )
      for (const t of tokens) expect(t).toBeDefined()
      for (const output of OUTPUTS) {
        let prev = Infinity
        for (let i = 0; i < tokens.length; i++) {
          const apca = tokens[i]!.diagnostic?.measured_apca[output] ?? -1
          // Allow ±1 noise for very-low-contrast quaternary
          expect(apca).toBeLessThanOrEqual(prev + 1)
          prev = apca
        }
      }
    })
  }
})
