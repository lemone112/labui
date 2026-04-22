/**
 * Opacity primitive — 29 stops, monotonic, within [0, 100].
 *
 * @layer L3 (primitive)
 * @governs plan-v2 §4.4 · Opacity primitive
 * @invariant Stops are sorted, unique, include 0, include boundary values
 *            (1, 99), and span 0..99.
 * @why Opacity is a primitive axis; semantic tokens compose with it.
 * @on-fail check config.colors.opacity.stops.
 */

import { describe, expect, test } from 'bun:test'
import { primitive } from '../_helpers/fixtures'

describe('Opacity ladder', () => {
  test('29 stops', () => {
    expect(primitive.opacityStops.length).toBe(29)
  })
  test('all in [0, 100]', () => {
    for (const s of primitive.opacityStops) {
      expect(s).toBeGreaterThanOrEqual(0)
      expect(s).toBeLessThanOrEqual(100)
    }
  })
  test('monotonic ascending', () => {
    const arr = [...primitive.opacityStops]
    const sorted = [...arr].sort((a, b) => a - b)
    expect(arr).toEqual(sorted)
  })
  test('unique', () => {
    expect(new Set(primitive.opacityStops).size).toBe(primitive.opacityStops.length)
  })
  test('contains 0, 1, 99', () => {
    expect(primitive.opacityStops).toContain(0)
    expect(primitive.opacityStops).toContain(1)
    expect(primitive.opacityStops).toContain(99)
  })
})
