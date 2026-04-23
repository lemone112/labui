/**
 * Typography · scale generation.
 *
 * @layer L5 (typography)
 * @governs plan-v2 §6.2 · Генерация · §6.3 · Constraint
 * @invariant Sizes ascend monotonically and sit on a base_px/2 grid
 *            (§02 rule 1). 'm' equals base_size_step × base_px × scaling.
 * @on-fail if a step collapses onto its predecessor, either raise
 *          scale_ratio or lower base_size_step; generator enforces
 *          strict monotonic by bumping +1 grid unit when needed.
 */

import { describe, expect, test } from 'bun:test'
import { config } from '../../config/tokens.config'
import {
  generateTypography,
  TYPOGRAPHY_KEYS,
  snapToGrid,
} from '../../src/generators/typography'

describe('Scale · generation', () => {
  const { typography, warnings } = generateTypography(
    config.typography,
    config.units,
  )

  test('no warnings at default config', () => {
    expect(warnings).toEqual([])
  })

  test("'m' is the base size (base_size_step × base_px × scaling)", () => {
    const expected =
      config.typography.base_size_step *
      config.units.base_px *
      config.units.scaling
    expect(typography.size.m).toBe(expected)
  })

  test('sizes are strictly ascending', () => {
    for (let i = 1; i < TYPOGRAPHY_KEYS.length; i++) {
      const cur = typography.size[TYPOGRAPHY_KEYS[i]]
      const prev = typography.size[TYPOGRAPHY_KEYS[i - 1]]
      expect(cur).toBeGreaterThan(prev)
    }
  })

  test('every size sits on base_px/2 grid', () => {
    const grid = (config.units.base_px * config.units.scaling) / 2
    for (const key of TYPOGRAPHY_KEYS) {
      const v = typography.size[key]
      expect(Math.abs(v % grid)).toBeLessThan(1e-6)
    }
  })

  test('line-heights are whole pixels', () => {
    for (const key of TYPOGRAPHY_KEYS) {
      expect(Number.isInteger(typography.lh_body[key])).toBe(true)
      expect(Number.isInteger(typography.lh_headline[key])).toBe(true)
    }
  })

  test('body line-height equals round(size × body_density)', () => {
    for (const key of TYPOGRAPHY_KEYS) {
      const expected = Math.round(
        typography.size[key] * config.typography.lh_body_density,
      )
      expect(typography.lh_body[key]).toBe(expected)
    }
  })

  test('headline line-height is tighter than body at same size', () => {
    // Only valid when lh_headline_density < lh_body_density.
    for (const key of TYPOGRAPHY_KEYS) {
      expect(typography.lh_headline[key]).toBeLessThanOrEqual(
        typography.lh_body[key],
      )
    }
  })
})

describe('Scale · tracking', () => {
  const { typography } = generateTypography(config.typography, config.units)

  test('tracking is 0 for body-sized text (<18px)', () => {
    for (const key of TYPOGRAPHY_KEYS) {
      if (typography.size[key] < 18) {
        expect(typography.tracking[key]).toBe(0)
      }
    }
  })

  test('tracking tightens (negative) for headline sizes (≥18px)', () => {
    for (const key of TYPOGRAPHY_KEYS) {
      if (typography.size[key] >= 18) {
        expect(typography.tracking[key]).toBeLessThanOrEqual(0)
      }
    }
  })

  test('tracking monotonically tightens as size grows', () => {
    const vals = TYPOGRAPHY_KEYS.map((k) => typography.tracking[k])
    for (let i = 1; i < vals.length; i++) {
      if (typography.size[TYPOGRAPHY_KEYS[i]] >= 18) {
        expect(vals[i]).toBeLessThanOrEqual(vals[i - 1])
      }
    }
  })
})

describe('snapToGrid', () => {
  test('0 grid is pass-through', () => {
    expect(snapToGrid(13.7, 0)).toBe(13.7)
  })
  test('snaps to nearest multiple', () => {
    expect(snapToGrid(15, 2)).toBe(16)
    expect(snapToGrid(14.9, 2)).toBe(14)
    expect(snapToGrid(18, 2)).toBe(18)
  })
})
