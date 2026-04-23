/**
 * Units · integer px invariant.
 *
 * @layer L1 (units)
 * @governs plan-v2 §2.3 · Constraint
 * @invariant Every internal `units.values.unit-N` is an integer pixel at
 *            root font-size 16 across the plan's four recommended scaling
 *            presets {0.75, 1.0, 1.166, 1.333}. Non-integer unit-1 would
 *            break subpixel rendering after `rem` → px resolution.
 * @on-fail pick a scaling factor from plan §2.3 presets
 *          {0.75, 1.0, 1.166, 1.333}. If you need stricter grid
 *          alignment (base_px*scaling integer), use {0.75, 1.0, 1.25}.
 */

import { describe, expect, test } from 'bun:test'
import { config } from '../../config/tokens.config'
import { generateUnits, unit } from '../../src/generators/units'

describe('Units · integer px', () => {
  const { units, warnings } = generateUnits(config.units)

  test('unit map covers the configured range inclusive', () => {
    const expectedKeys =
      config.units.range.max - config.units.range.min + 1
    expect(Object.keys(units.values).length).toBe(expectedKeys)
  })

  test('every unit value is an integer (px, pre-rem-conversion)', () => {
    for (const [, value] of Object.entries(units.values)) {
      expect(Number.isInteger(value)).toBe(true)
    }
  })

  test('unit(0) = 0, unit(1) = 4, unit(-1) = -4 at default scaling', () => {
    expect(unit(0, config.units)).toBe(0)
    expect(unit(1, config.units)).toBe(4)
    expect(unit(-1, config.units)).toBe(-4)
  })

  test('no warnings at default scaling', () => {
    expect(warnings.length).toBe(0)
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
      for (const [name, v] of Object.entries(units.values)) {
        expect(
          Number.isInteger(v),
          `${name} at scaling=${scaling} is ${v}, not integer`,
        ).toBe(true)
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
      for (const v of Object.values(units.values)) {
        expect(Number.isInteger(v)).toBe(true)
      }
    })
  }
})
