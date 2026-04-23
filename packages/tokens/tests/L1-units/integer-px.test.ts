/**
 * Units · integer px invariant.
 *
 * @layer L1 (units)
 * @governs plan-v2 §2.3 · Constraint
 * @invariant Every --px-N value is an integer pixel across the plan's
 *            four recommended scaling presets {0.75, 1.0, 1.166, 1.333};
 *            non-integer px-1 would break subpixel rendering.
 * @on-fail pick a scaling factor from plan §2.3 presets
 *          {0.75, 1.0, 1.166, 1.333}. If you need stricter grid
 *          alignment (base_px*scaling integer), use {0.75, 1.0, 1.25}.
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

describe('Units · scaling presets produce integer px (plan §2.3)', () => {
  // Plan §2.3 literal: "В CI проверяем для пресетов
  // {0.75, 1.0, 1.166, 1.333} что все N в range дают целые."
  const PLAN_PRESETS = [0.75, 1.0, 1.166, 1.333]

  for (const scaling of PLAN_PRESETS) {
    test(`scaling=${scaling} yields integer px across range`, () => {
      const cfg = { ...config.units, scaling }
      const { units } = generateUnits(cfg)
      for (const [name, v] of Object.entries(units.px)) {
        expect(Number.isInteger(v), `${name} at scaling=${scaling} is ${v}, not integer`).toBe(true)
      }
    })

    test(`scaling=${scaling} yields 0.5-precision pt across range`, () => {
      const cfg = { ...config.units, scaling }
      const { units } = generateUnits(cfg)
      for (const [name, v] of Object.entries(units.pt)) {
        expect(v * 2, `${name} at scaling=${scaling} is ${v}, not 0.5-precision`).toBe(Math.round(v * 2))
      }
    })
  }

  // Strict-grid presets (base_px*scaling integer): no warning fires.
  const STRICT_GRID = [0.75, 1.0, 1.25]
  for (const scaling of STRICT_GRID) {
    test(`scaling=${scaling} is strict-grid (no non-integer warning)`, () => {
      const cfg = { ...config.units, scaling }
      const { warnings } = generateUnits(cfg)
      expect(warnings.filter((w) => /not integer/.test(w))).toHaveLength(0)
    })
  }

  // Rounded-grid presets ({1.166, 1.333}): px values are still integer
  // (via Math.round) but the grid drifts — a warning is emitted.
  const ROUNDED_GRID = [1.166, 1.333]
  for (const scaling of ROUNDED_GRID) {
    test(`scaling=${scaling} is rounded-grid (warning emitted, px still integer)`, () => {
      const cfg = { ...config.units, scaling }
      const { units, warnings } = generateUnits(cfg)
      expect(warnings.some((w) => /not integer/.test(w))).toBe(true)
      for (const v of Object.values(units.px)) {
        expect(Number.isInteger(v)).toBe(true)
      }
    })
  }
})
