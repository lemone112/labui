/**
 * L2 Radius · concentric clamp() pattern + ESM helpers.
 *
 * @layer L2 (dimensions · radius)
 * @governs plan-v2 §3.4 Concentric radius pattern · §3.5 ESM helpers
 * @invariant `innerOf(outer, pad)` returns
 *            `clamp(var(--radius-min), calc(outer - pad), var(--radius-max))`;
 *            `outerOf(inner, pad)` returns
 *            `min(var(--radius-max), calc(inner + pad))`; floor = radius-min
 *            (never 0), ceiling = radius-max (never radius-full/infinity).
 * @on-fail update writers/esm.ts helpers to emit the exact clamp/min
 *          string shape from plan §3.4; confirm neither helper leaks
 *          the pill sentinel (radius-full) into auto-computed nesting.
 */

import { describe, expect, test } from 'bun:test'
import { config } from '../../config/tokens.config'
import { generateDimensions } from '../../src/generators/dimensions'
import { generatePrimitiveColors } from '../../src/generators/primitive-colors'
import { generateSemanticColors } from '../../src/generators/semantic-colors'
import { generateUnits } from '../../src/generators/units'
import { innerOf, outerOf, writeESM } from '../../src/writers/esm'

describe('L2 Radius · innerOf helper (outside-in, plan §3.4)', () => {
  test('returns clamp(min, outer - padding, max) expression', () => {
    expect(innerOf('var(--radius-base)', 'var(--padding-m)')).toBe(
      'clamp(var(--radius-min), calc(var(--radius-base) - var(--padding-m)), var(--radius-max))',
    )
  })

  test('output shape matches expected pattern for any inputs', () => {
    const expr = innerOf('var(--radius-max)', 'var(--padding-l)')
    expect(expr).toMatch(
      /^clamp\(var\(--radius-min\), calc\(.+ - .+\), var\(--radius-max\)\)$/,
    )
  })

  test('floor anchor is always radius-min (never 0)', () => {
    // Key design decision: when outer - padding goes negative, we snap
    // to radius-min, NOT to 0 (preserves softness in nested contexts).
    const expr = innerOf('var(--radius-min)', 'var(--padding-l)')
    expect(expr).toContain('var(--radius-min)')
    expect(expr).not.toContain('0px')
    expect(expr).not.toMatch(/max\(0[,)]/)
  })
})

describe('L2 Radius · outerOf helper (inside-out, plan §3.4)', () => {
  test('returns min(max, inner + padding) expression', () => {
    expect(outerOf('var(--radius-min)', 'var(--padding-s)')).toBe(
      'min(var(--radius-max), calc(var(--radius-min) + var(--padding-s)))',
    )
  })

  test('ceiling anchor is radius-max (never radius-full/infinity)', () => {
    // Inside-out: if inner + padding blows past max, we cap at the shape
    // ceiling. The pill sentinel (`radius-full`) is an explicit opt-in,
    // never a side-effect of auto-computed nesting.
    const expr = outerOf('var(--radius-base)', 'var(--padding-2xl)')
    expect(expr).toContain('var(--radius-max)')
    expect(expr).not.toContain('var(--radius-full)')
    expect(expr).not.toContain('infinity')
  })
})

describe('L2 Radius · ESM barrel exposes helpers (plan §3.5)', () => {
  const warnings: string[] = []
  const primitive = generatePrimitiveColors(config.colors, { warnings })
  const semantic = generateSemanticColors(
    config.semantics,
    primitive,
    config.colors,
  )
  const { units } = generateUnits(config.units)
  const { dimensions } = generateDimensions(config.dimensions, config.units)
  const src = writeESM(primitive, semantic, units, dimensions)

  test('writeESM emits innerOf and outerOf as exported functions', () => {
    expect(src).toContain('export function innerOf')
    expect(src).toContain('export function outerOf')
  })

  test('emitted helpers use --radius-min / --radius-max anchors', () => {
    // Sanity: the inlined function bodies reference the correct vars.
    const innerIdx = src.indexOf('function innerOf')
    const outerIdx = src.indexOf('function outerOf')
    expect(innerIdx).toBeGreaterThan(-1)
    expect(outerIdx).toBeGreaterThan(innerIdx)
    const innerBody = src.slice(innerIdx, outerIdx)
    expect(innerBody).toContain('var(--radius-min)')
    expect(innerBody).toContain('var(--radius-max)')
    expect(innerBody).not.toContain('var(--radius-full)')
  })
})

describe('L2 Radius · concentric numeric invariant (plan §3.6)', () => {
  // Numeric simulation of `clamp(min, outer-padding, max)` for every
  // combination of outer ∈ {min, base, max} × padding ∈ padding-family.
  // This doesn't touch CSS — it's the math the browser would arrive at.
  const radiusAnchors = { min: 4, base: 12, max: 32 } as const
  const paddingFamily = [0, 4, 8, 12, 16, 24, 32, 40, 48, 64, 80, 96, 108]

  test('clamp(min, outer-padding, max) ≥ radius-min for all anchor × padding pairs', () => {
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

  test('clamp(min, outer-padding, max) ≤ radius-max for all anchor × padding pairs', () => {
    for (const outer of Object.values(radiusAnchors)) {
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
