/**
 * Dimensions · airiness shift invariant.
 *
 * @layer L2 (dimensions)
 * @governs plan-v2 §3.3 · Airiness application
 * @invariant airiness=1.0 is identity. airiness>1.0 shifts larger
 *            steps more than smaller ones (log2 factor × step).
 * @why Compact semantic names (xxs, xs) stay compact; big names (xl, 2xl)
 *      scale more with airiness — matches perceived looseness.
 * @on-fail inspect applyAiriness in generators/dimensions.ts.
 */

import { describe, expect, test } from 'bun:test'
import { config } from '../../config/tokens.config'
import {
  applyAiriness,
  generateDimensions,
} from '../../src/generators/dimensions'

describe('Airiness · identity at 1.0', () => {
  test('applyAiriness(step, 1.0) === step for any step', () => {
    for (const step of [0, 1, 3, 8, 16, 27]) {
      expect(applyAiriness(step, 1.0)).toBe(step)
    }
  })

  test('generateDimensions at airiness=1.0 equals raw step × base_px', () => {
    const { dimensions } = generateDimensions(config.dimensions, config.units)
    // spacing_padding.m = step 4 → 4 * 4 * 1.0 = 16
    expect(dimensions.spacing_padding.m).toBe(16)
    // spacing_padding.xxs = step 1 → 4
    expect(dimensions.spacing_padding.xxs).toBe(4)
    // radius.base = step 3 → 12 (R1 Hybrid anchor, plan §3.2)
    expect(dimensions.radius.base).toBe(12)
  })

  test('full radius sentinel preserved (Infinity)', () => {
    const { dimensions } = generateDimensions(config.dimensions, config.units)
    // R1 Hybrid: full is emitted as `calc(infinity * 1rem)`, stored as ∞.
    expect(dimensions.radius.full).toBe(Number.POSITIVE_INFINITY)
  })
})

describe('Airiness · log2 scaling', () => {
  test('airiness=2.0 doubles the index (log2(2)=1 → step + 1·step)', () => {
    expect(applyAiriness(4, 2.0)).toBeCloseTo(8, 5)
    expect(applyAiriness(1, 2.0)).toBeCloseTo(2, 5)
  })

  test('airiness=0.5 halves the index', () => {
    expect(applyAiriness(4, 0.5)).toBeCloseTo(0, 5)
  })

  test('larger steps move more than smaller at airiness=1.25', () => {
    const smallDelta = applyAiriness(1, 1.25) - 1
    const largeDelta = applyAiriness(8, 1.25) - 8
    expect(largeDelta).toBeGreaterThan(smallDelta)
  })
})
