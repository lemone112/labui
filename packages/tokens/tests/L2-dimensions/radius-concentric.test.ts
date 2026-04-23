/**
 * L2 Radius · concentric clamp() pattern + ESM helpers (PR-N, TDD skeleton).
 *
 * @layer L2 (dimensions · radius)
 * @governs plan-v2 §3.4 Concentric radius pattern
 * @invariant `innerOf(outer, pad)` returns
 *            `clamp(var(--radius-min), calc(outer - pad), var(--radius-max))`;
 *            `outerOf(inner, pad)` returns
 *            `min(var(--radius-max), calc(inner + pad))`; floor = radius-min
 *            (never 0), ceiling = radius-max (never radius-full/infinity).
 * @on-fail update writers/esm.ts helpers to emit the exact clamp/min
 *          string shape from plan §3.4; confirm neither helper leaks
 *          the pill sentinel (radius-full) into auto-computed nesting.
 *
 * PR-N target: add two ESM helpers that produce CSS `clamp()` /
 * `min()` expressions for concentric nesting, and verify their
 * output shape matches the pattern documented in the plan.
 *
 * Tests are currently `test.skip` because the helpers
 * (`innerOf`, `outerOf`) do not yet exist in the ESM output.
 * Flip skip → test when PR-N implementation lands.
 */

import { describe, expect, test } from 'bun:test'

// Imports below will only resolve after PR-N implementation adds
// innerOf / outerOf to the ESM entry point. Suppress via any-cast
// in the skeleton so the test file itself still compiles today.
// (Removed once helpers exist.)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const tokens: {
  innerOf?: (outer: string, padding: string) => string
  outerOf?: (inner: string, padding: string) => string
  radiusBase?: string
  radiusMin?: string
  radiusMax?: string
  paddingM?: string
  paddingS?: string
} = {}

describe('L2 Radius · innerOf helper (outside-in, plan §3.4)', () => {
  test.skip('innerOf returns clamp(min, outer - padding, max) expression', () => {
    const expr = tokens.innerOf!('var(--radius-base)', 'var(--padding-m)')
    expect(expr).toBe(
      'clamp(var(--radius-min), calc(var(--radius-base) - var(--padding-m)), var(--radius-max))',
    )
  })

  test.skip('innerOf composes with real token vars', () => {
    const expr = tokens.innerOf!(tokens.radiusBase!, tokens.paddingM!)
    // Both args expand to `var(--radius-base)` / `var(--padding-m)`
    expect(expr).toMatch(/^clamp\(var\(--radius-min\), calc\(.+\), var\(--radius-max\)\)$/)
  })

  test.skip('floor anchor is always radius-min (never 0)', () => {
    // Key design decision: when outer - padding goes negative, we snap
    // to radius-min, NOT to 0 (preserves softness in nested contexts).
    const expr = tokens.innerOf!('var(--radius-min)', 'var(--padding-l)')
    expect(expr).toContain('var(--radius-min)') // floor
    expect(expr).not.toContain('0px')
    expect(expr).not.toContain('max(0')
  })
})

describe('L2 Radius · outerOf helper (inside-out, plan §3.4)', () => {
  test.skip('outerOf returns min(max, inner + padding) expression', () => {
    const expr = tokens.outerOf!('var(--radius-min)', 'var(--padding-s)')
    expect(expr).toBe(
      'min(var(--radius-max), calc(var(--radius-min) + var(--padding-s)))',
    )
  })

  test.skip('ceiling anchor is radius-max (never infinity)', () => {
    // Inside-out: if inner + padding blows past max, we cap at max_shape,
    // NOT at radius-full (pill is an explicit opt-in, not a side-effect).
    const expr = tokens.outerOf!('var(--radius-base)', 'var(--padding-2xl)')
    expect(expr).toContain('var(--radius-max)')
    expect(expr).not.toContain('var(--radius-full)')
    expect(expr).not.toContain('infinity')
  })
})

describe('L2 Radius · concentric numeric invariant (plan §3.6)', () => {
  // Numeric simulation of `clamp(min, outer-padding, max)` for every
  // combination of outer ∈ {min, base, max} × padding ∈ padding-family.
  // This doesn't involve any CSS — it's a pure math check that the
  // CSS browser would arrive at a value ≥ radius-min for every pair.

  test.skip('clamp(min, outer-padding, max) ≥ radius-min for all anchor × padding pairs', () => {
    const radiusAnchors = { min: 4, base: 12, max: 32 }
    const paddingFamily = [0, 4, 8, 12, 16, 24, 32, 40, 48, 64, 80, 96, 108]

    for (const [anchorName, outer] of Object.entries(radiusAnchors)) {
      for (const padding of paddingFamily) {
        const ideal = outer - padding
        const clamped = Math.max(
          radiusAnchors.min,
          Math.min(radiusAnchors.max, ideal),
        )
        expect(
          clamped,
          `outer=${anchorName}(${outer}), padding=${padding}, ideal=${ideal}, clamped=${clamped}`,
        ).toBeGreaterThanOrEqual(radiusAnchors.min)
      }
    }
  })

  test.skip('clamp(min, outer-padding, max) ≤ radius-max for all anchor × padding pairs', () => {
    const radiusAnchors = { min: 4, base: 12, max: 32 }
    const paddingFamily = [0, 4, 8, 12, 16, 24, 32, 40, 48, 64, 80, 96, 108]

    for (const [, outer] of Object.entries(radiusAnchors)) {
      for (const padding of paddingFamily) {
        const ideal = outer - padding
        const clamped = Math.max(
          radiusAnchors.min,
          Math.min(radiusAnchors.max, ideal),
        )
        expect(clamped).toBeLessThanOrEqual(radiusAnchors.max)
      }
    }
  })
})
