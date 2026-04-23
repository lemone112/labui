/**
 * Units · integer px invariant.
 *
 * @layer L1 (units)
 * @governs plan-v2 §2.3 · Constraint
 * @invariant Every --px-N value is an integer pixel. Non-integer px-1
 *            would break subpixel rendering.
 * @on-fail pick a scaling factor where base_px*scaling is integer:
 *          {0.75, 1.0, 1.25}. Recommended presets in config comment.
 */

import { describe, expect, test } from 'bun:test'
import { config } from '../../config/tokens.config'
import { generateUnits, px, pt } from '../../src/generators/units'

describe('Units · integer px', () => {
  const { units, warnings } = generateUnits(config.units)

  test('px map covers the configured range inclusive', () => {
    const expectedKeys =
      config.units.px_range.max - config.units.px_range.min + 1
    expect(Object.keys(units.px).length).toBe(expectedKeys)
  })

  test('every px is an integer', () => {
    for (const [name, value] of Object.entries(units.px)) {
      expect(Number.isInteger(value)).toBe(true)
    }
  })

  test('px(0) = 0, px(1) = 4, px(-1) = -4 at default scaling', () => {
    expect(px(0, config.units)).toBe(0)
    expect(px(1, config.units)).toBe(4)
    expect(px(-1, config.units)).toBe(-4)
  })

  test('pt is a 0.5-precision value', () => {
    for (const value of Object.values(units.pt)) {
      expect(value * 2).toBe(Math.round(value * 2))
    }
  })

  test('no warnings at default scaling', () => {
    expect(warnings.length).toBe(0)
  })

  test('pt(1) = base/2 = 2 at default', () => {
    expect(pt(1, config.units)).toBe(2)
    expect(pt(0, config.units)).toBe(0)
  })
})

describe('Units · scaling presets produce integer px', () => {
  const RECOMMENDED = [0.75, 1.0, 1.25]

  for (const scaling of RECOMMENDED) {
    test(`scaling=${scaling} yields integer px across range`, () => {
      const cfg = { ...config.units, scaling }
      const { units } = generateUnits(cfg)
      for (const [, v] of Object.entries(units.px)) {
        expect(Number.isInteger(v)).toBe(true)
      }
    })
  }

  test('scaling=1.166 triggers non-integer warning', () => {
    const cfg = { ...config.units, scaling: 1.166 }
    const { warnings } = generateUnits(cfg)
    expect(warnings.length).toBeGreaterThan(0)
    expect(warnings[0]).toMatch(/not integer/)
  })
})
