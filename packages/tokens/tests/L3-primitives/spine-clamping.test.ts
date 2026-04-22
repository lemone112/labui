/**
 * Spine clamping at endpoints.
 *
 * @layer L3 (primitive)
 * @governs plan-v2 §4.2 · Accent spines
 * @invariant Sampling below spine[0].L returns spine[0]; above spine[-1].L
 *            returns spine[-1]. Never extrapolate.
 * @why Extrapolation off the ends produces wild H values that violate the
 *      monotonic invariant and break gamut-clamp.
 * @on-fail check spineInterp clamp logic; confirm caller is not passing
 *          negative or >1 L.
 */

import { describe, expect, test } from 'bun:test'
import { spineInterp } from '../../src/utils/spine'

describe('Spine · endpoint clamping', () => {
  const spine = [
    { L: 0.2, H: 45 },
    { L: 0.8, H: 100 },
  ]

  test('L below first point clamps to first', () => {
    expect(spineInterp(spine, 0.0).H).toBe(45)
    expect(spineInterp(spine, -1).H).toBe(45)
  })

  test('L above last point clamps to last', () => {
    expect(spineInterp(spine, 1.0).H).toBe(100)
    expect(spineInterp(spine, 99).H).toBe(100)
  })

  test('single-point spine returns that point for any L', () => {
    const single = [{ L: 0.5, H: 180 }]
    expect(spineInterp(single, 0).H).toBe(180)
    expect(spineInterp(single, 0.5).H).toBe(180)
    expect(spineInterp(single, 1).H).toBe(180)
  })

  test('empty spine throws', () => {
    expect(() => spineInterp([], 0.5)).toThrow()
  })
})
