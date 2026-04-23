/**
 * IC amplification — IC endpoints extend further than normal.
 *
 * @layer L3 (primitive)
 * @governs plan-v2 §4.1 · Neutrals (endpoints_ic)
 * @invariant IC contrast stretches the neutral endpoints (L12 in IC = 0.0
 *            pure black vs 0.08 in normal). Ensures higher contrast ratios
 *            are mathematically achievable.
 * @why IC mode must reach AAA Lc targets; that requires broader L range.
 * @on-fail check config.colors.neutrals.endpoints_ic; verify primitive
 *          generator branches on contrast.
 */

import { describe, expect, test } from 'bun:test'
import { primitive, config } from '../_helpers/fixtures'

describe('IC amplification', () => {
  test('neutral-12 L is closer to 0 in IC than normal', () => {
    const n12 = primitive.neutrals[12]
    expect(n12.values['light/ic'].L).toBeLessThan(n12.values['light/normal'].L)
  })

  test('neutral endpoints match config', () => {
    const n = config.colors.neutrals
    const n0 = primitive.neutrals[0]
    const n12 = primitive.neutrals[12]
    // Prefer `L_ladder` when present (Figma-calibrated), otherwise
    // fall back to the closed-form `endpoints_*` anchors.
    const L0Normal = n.L_ladder?.normal[0] ?? n.endpoints_normal.L0
    const L12Normal =
      n.L_ladder?.normal[n.steps - 1] ?? n.endpoints_normal.L12
    const L12Ic = n.L_ladder?.ic[n.steps - 1] ?? n.endpoints_ic.L12
    expect(n0.values['light/normal'].L).toBeCloseTo(L0Normal, 2)
    expect(n12.values['light/normal'].L).toBeCloseTo(L12Normal, 2)
    expect(n12.values['light/ic'].L).toBeCloseTo(L12Ic, 2)
  })
})
