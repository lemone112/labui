/**
 * Pivot-mirror invariant — neutral[i] in light == neutral[steps-1-i] in dark
 * (modulo perceptual compensation shift).
 *
 * @layer L3 (primitive)
 * @governs plan-v2 §4.1 · Neutrals
 * @invariant Neutral scale is generated once; dark mode is a pivot-mirror
 *            (index reverse) of light mode physical L values.
 * @why Pivot-mirror gives consistent perceptual stepping on both modes
 *      without a second ladder to maintain.
 * @on-fail inspect generatePrimitiveColors neutral loop. The comp shift
 *          (-0.02 in dark) is expected; reject only larger deltas.
 */

import { describe, expect, test } from 'bun:test'
import { primitive, config } from '../_helpers/fixtures'

const HK_SHIFT = config.colors.perceptual_comp.dark.lightness_shift // -0.02

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
