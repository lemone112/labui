/**
 * Units + Dimensions · CSS emit check.
 *
 * @layer L1/L2 × Emit
 * @governs plan-v2 §2.4 · Units output · §3 · Dimensions
 * @invariant Emitted tokens.css contains --px-*, --pt-*, --padding-*,
 *            --radius-*, --size-* in a mode-invariant :root block.
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

  test('core px vars emitted with px unit', () => {
    expect(css).toContain('--px-0: 0px;')
    expect(css).toContain('--px-1: 4px;')
    expect(css).toContain('--px--1: -4px;')
  })

  test('pt vars emitted with pt unit', () => {
    expect(css).toContain('--pt-0: 0pt;')
    expect(css).toContain('--pt-1: 2pt;')
  })

  test('padding / radius / size families emitted', () => {
    expect(css).toContain('--padding-m:')
    expect(css).toContain('--padding-2xl:')
    expect(css).toContain('--radius-m:')
    expect(css).toContain('--radius-full: 9999px;')
    expect(css).toContain('--size-m:')
  })

  test('margin negatives emitted', () => {
    expect(css).toContain('--margin-neg-xs:')
    expect(css).toContain('--margin-neg-l:')
  })

  test('fx families emitted', () => {
    expect(css).toContain('--blur-m:')
    expect(css).toContain('--shift-m:')
    expect(css).toContain('--spread-s:')
  })
})
