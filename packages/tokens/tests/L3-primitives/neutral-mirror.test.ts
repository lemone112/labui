/**
 * Pivot-mirror invariant — neutral[i] in light == neutral[steps-1-i] in dark.
 *
 * @layer L3 (primitive)
 * @governs plan-v2 §4.1 · Neutrals
 * @invariant Neutral scale is generated once; dark mode is a pivot-mirror
 *            (index reverse) of light mode physical L values. When the
 *            neutrals are fully ladder-driven (`L/C/H_ladder` set) the
 *            mirror is exact because perceptual-comp is bypassed — see
 *            `generatePrimitiveColors`. Otherwise the `-0.02` dark HK
 *            shift applies and is subtracted before comparison.
 * @why Pivot-mirror gives consistent perceptual stepping on both modes
 *      without a second ladder to maintain.
 * @on-fail inspect generatePrimitiveColors neutral loop. Check whether
 *          ladder skip-comp path and curve-path still produce the same
 *          physical L reference.
 */

import { describe, expect, test } from 'bun:test'
import { primitive, config } from '../_helpers/fixtures'

const n = config.colors.neutrals
const LADDER_DRIVEN = Boolean(n.L_ladder || n.C_ladder || n.H_ladder)
const HK_SHIFT = LADDER_DRIVEN
  ? 0
  : config.colors.perceptual_comp.dark.lightness_shift

describe('Neutral · pivot-mirror', () => {
  const steps = primitive.neutrals.length
  test(`${steps} neutrals, each mirrors across pivot`, () => {
    for (let i = 0; i < steps; i++) {
      const light = primitive.neutrals[i].values['light/normal']
      const mirror = primitive.neutrals[steps - 1 - i].values['dark/normal']
      // Physical L equality after accounting for HK shift applied in dark.
      expect(Math.abs(light.L - (mirror.L - HK_SHIFT))).toBeLessThan(0.01)
    }
  })

  test('IC mode neutrals reach pure-black (L=0) at N12 (or mirror)', () => {
    const n12 = primitive.neutrals[12].values['light/ic']
    expect(n12.L).toBeLessThan(0.05)
  })
})
