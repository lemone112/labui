/**
 * Perceptual compensation (Hunt/HK) applied correctly.
 *
 * @layer L3 (primitive)
 * @governs plan-v2 §4.3 · Perceptual compensation
 * @invariant `applyPerceptualComp` with the `dark` cell reduces chroma
 *            by `chroma_mult` (≈0.93) and lightness by
 *            `|lightness_shift|` (≈0.02) relative to the input. Accents
 *            that do NOT carry an explicit `primitive_per_mode` flow
 *            through this transform in `generatePrimitiveColors`.
 * @why Accents on dark surrounds appear MORE saturated (Hunt) and
 *      BRIGHTER (HK); physically reducing C and L compensates.
 * @on-fail verify config.colors.perceptual_comp.dark values; check
 *          applyPerceptualComp order in pipeline (must be AFTER
 *          spine+chroma_curve, BEFORE gamut_clamp).
 *
 * Post primitive-per-mode calibration: every accent now pins its
 * light + dark primitive value directly against the Figma anchor, so
 * `generateAccents` bypasses the comp transform. We still validate the
 * transform itself as a pure function so the fallback path (any accent
 * without `primitive_per_mode`) keeps working.
 */

import { describe, expect, test } from 'bun:test'
import { primitive, config } from '../_helpers/fixtures'
import { applyPerceptualComp } from '../../src/generators/resolver'

describe('Perceptual comp · dark mode reduces C & L', () => {
  test('applyPerceptualComp dark cell reduces chroma by ~chroma_mult', () => {
    const input = { L: 0.65, C: 0.2, H: 260 }
    const out = applyPerceptualComp(input, 'dark', config.colors.perceptual_comp)
    const ratio = out.C / input.C
    expect(ratio).toBeCloseTo(config.colors.perceptual_comp.dark.chroma_mult, 2)
  })

  test('applyPerceptualComp dark cell shifts L by lightness_shift', () => {
    const input = { L: 0.65, C: 0.2, H: 28 }
    const out = applyPerceptualComp(input, 'dark', config.colors.perceptual_comp)
    const shift = input.L - out.L
    expect(shift).toBeCloseTo(
      Math.abs(config.colors.perceptual_comp.dark.lightness_shift),
      3,
    )
  })

  test('applyPerceptualComp light cell is identity', () => {
    const input = { L: 0.5, C: 0.15, H: 120 }
    const out = applyPerceptualComp(input, 'light', config.colors.perceptual_comp)
    expect(out.L).toBe(input.L)
    expect(out.C).toBe(input.C)
    expect(out.H).toBe(input.H)
  })

  test('brand primitive pins to Figma light/normal (L ≈ 0.603)', () => {
    // Sanity: the per-mode pinning reached the emitted primitive; if this
    // regresses, someone unwired `primitive_per_mode` or changed the
    // Figma anchor without updating the config.
    const brand = primitive.accents.find((a) => a.id === 'brand')!
    const light = brand.values['light/normal']
    expect(light.L).toBeCloseTo(0.603, 2)
  })
})
