/**
 * Units + Dimensions · CSS emit check.
 *
 * @layer L1/L2 × Emit
 * @governs plan-v2 §2.4 · Units output · §3 · Dimensions
 * @invariant Emitted tokens.css contains --unit-*, --padding-*, --radius-*,
 *            --size-* in a mode-invariant :root block. Values are in `rem`
 *            (except --radius-full, which stays 9999px as pill sentinel).
 * @on-fail check writers/dimensions.ts slugs and iteration.
 */

import { describe, expect, test } from 'bun:test'
import { config } from '../../config/tokens.config'
import { generateDimensions } from '../../src/generators/dimensions'
import { generateUnits } from '../../src/generators/units'
import { writeUnitsDimensionsCss } from '../../src/writers/dimensions'

describe('L1/L2 CSS emit', () => {
  const { units } = generateUnits(config.units)
  const { dimensions } = generateDimensions(config.dimensions, config.units)
  const css = writeUnitsDimensionsCss(units, dimensions)

  test(':root block present', () => {
    expect(css).toMatch(/:root \{/)
  })

  test('core unit vars emitted in rem (zero is bare, non-zero has rem suffix)', () => {
    expect(css).toContain('--unit-0: 0;')
    expect(css).toContain('--unit-1: 0.25rem;') // 4px / 16
    expect(css).toContain('--unit-4: 1rem;') //    16px / 16
    expect(css).toContain('--unit--1: -0.25rem;') // negative
  })

  test('no legacy --px-* or --pt-* vars remain', () => {
    expect(css).not.toMatch(/--px-\d/)
    expect(css).not.toMatch(/--pt-\d/)
  })

  test('padding / radius / size families emitted in rem', () => {
    expect(css).toContain('--padding-m: 1rem;') //   step 4 × 4 / 16
    expect(css).toContain('--padding-2xl: 2.5rem;') // step 10 × 4 / 16
    expect(css).toContain('--radius-m: 0.5rem;') //  step 2 × 4 / 16
    expect(css).toContain('--size-m: 2rem;') //      step 8 × 4 / 16
  })

  test('radius-full stays density-immune at 9999px (pill sentinel)', () => {
    expect(css).toContain('--radius-full: 9999px;')
  })

  test('margin negatives emitted in rem', () => {
    expect(css).toContain('--margin-neg-xs: -0.25rem;')
    expect(css).toContain('--margin-neg-l: -1rem;')
  })

  test('fx families emitted', () => {
    expect(css).toContain('--blur-m:')
    expect(css).toContain('--shift-m:')
    expect(css).toContain('--spread-s:')
  })

  test('no raw `px` unit slipped through (except radius-full sentinel)', () => {
    // Only one legitimate `px` occurrence in the output: the full-radius pill.
    const pxMatches = css.match(/: -?[\d.]+px;/g) ?? []
    expect(pxMatches).toEqual([': 9999px;'])
  })
})
