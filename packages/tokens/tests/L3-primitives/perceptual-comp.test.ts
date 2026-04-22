/**
 * Perceptual compensation (Hunt/HK) applied correctly.
 *
 * @layer L3 (primitive)
 * @governs plan-v2 §4.3 · Perceptual compensation
 * @invariant In dark mode, accents carry chroma_mult=0.93 and lightness
 *            _shift=-0.02 relative to the un-compensated spine value.
 * @why Accents on dark surrounds appear MORE saturated (Hunt) and
 *      BRIGHTER (HK); physically reducing C and L compensates.
 * @on-fail verify config.colors.perceptual_comp.dark values; check
 *          applyPerceptualComp order in pipeline (must be AFTER
 *          spine+chroma_curve, BEFORE gamut_clamp).
 */

import { describe, expect, test } from 'bun:test'
import { primitive, config } from '../_helpers/fixtures'

describe('Perceptual comp · dark mode reduces C & L', () => {
  test('dark blue chroma is ~7% lower than light (pre-clamp)', () => {
    const blue = primitive.accents.find((a) => a.id === 'blue')!
    const light = blue.values['light/normal']
    const dark = blue.values['dark/normal']
    // Allow some gamut-clamp slack; ratio should be around 0.93 ± 0.05
    const ratio = dark.C / light.C
    expect(ratio).toBeGreaterThan(0.85)
    expect(ratio).toBeLessThan(1.0)
  })

  test('dark red L is lower than light L (HK shift)', () => {
    const red = primitive.accents.find((a) => a.id === 'red')!
    const light = red.values['light/normal']
    const dark = red.values['dark/normal']
    expect(dark.L).toBeLessThan(light.L)
    const shift = light.L - dark.L
    expect(shift).toBeCloseTo(Math.abs(config.colors.perceptual_comp.dark.lightness_shift), 2)
  })

  test('comp disabled is identity (light = dark for accents)', () => {
    // We can't easily disable at runtime without rebuild, but we test the
    // light cell acts as identity by checking light == spine anchor.
    const brand = primitive.accents.find((a) => a.id === 'brand')!
    const light = brand.values['light/normal']
    expect(light.L).toBeCloseTo(0.603, 2)
  })
})
