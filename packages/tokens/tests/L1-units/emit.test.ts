/**
 * Units + Dimensions · CSS emit check.
 *
 * @layer L1/L2 × Emit
 * @governs plan-v2 §2.4 · Units output · §3 · Dimensions
 * @invariant Emitted tokens.css contains --unit-*, --padding-*, --radius-*,
 *            --size-* in a mode-invariant :root block. Values are in `rem`
 *            (except --radius-full, which uses calc(infinity * 1rem)).
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
    expect(css).toContain('--radius-base: 0.75rem;') // R1 Hybrid: step 3 × 4 / 16
    expect(css).toContain('--size-m: 2rem;') //      step 8 × 4 / 16
  })

  test('radius-full uses calc(infinity * 1rem) sentinel (plan §3.5)', () => {
    expect(css).toContain('--radius-full: calc(infinity * 1rem);')
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

  test('no raw `px` unit slipped through — everything in rem or infinity sentinel', () => {
    // Post-PR-N: the pill sentinel is `calc(infinity * 1rem)`; no bare `px`.
    const pxMatches = css.match(/: -?[\d.]+px;/g) ?? []
    expect(pxMatches).toEqual([])
  })
})
