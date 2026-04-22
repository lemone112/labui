/**
 * Snapshot regression tests for generated output.
 *
 * These lock in key invariants so parameter tweaks trigger an obvious diff.
 * They do NOT compare the entire CSS (that would be too brittle); instead
 * they assert on specific deterministic values.
 */

import { describe, expect, test } from 'bun:test'
import { config } from '../config/tokens.config'
import { generatePrimitiveColors } from '../src/generators/primitive-colors'
import { generateSemanticColors } from '../src/generators/semantic-colors'
import { writeCSS } from '../src/writers/css'

const primitive = generatePrimitiveColors(config.colors)
const semantic = generateSemanticColors(config.ladders, primitive, config.colors)
const css = writeCSS(primitive, semantic)

describe('CSS snapshot', () => {
  test('neutral scale has 13 steps', () => {
    expect(primitive.neutrals.length).toBe(13)
  })

  test('opacity ladder has 29 stops', () => {
    expect(primitive.opacityStops.length).toBe(29)
  })

  test('N0 in light is pure white', () => {
    const n0 = primitive.neutrals[0]
    expect(n0.values.light.L).toBeCloseTo(1.0, 3)
    expect(n0.values.light.C).toBeCloseTo(0, 3)
  })

  test('N12 in light is near-black', () => {
    const n12 = primitive.neutrals[12]
    expect(n12.values.light.L).toBeCloseTo(0.08, 3)
  })

  test('neutral scale inverts in dark mode', () => {
    const n0 = primitive.neutrals[0]
    const n12 = primitive.neutrals[12]
    expect(n0.values.dark.L).toBeCloseTo(0.08, 3)
    expect(n12.values.dark.L).toBeCloseTo(1.0, 3)
  })

  test('has all 11 accents', () => {
    const names = primitive.accents.map((a) => a.name).sort()
    expect(names).toEqual(
      ['blue', 'brand', 'green', 'indigo', 'mint', 'orange', 'pink', 'purple', 'red', 'teal', 'yellow'].sort(),
    )
  })

  test('yellow IC uses per-mode override (hue shift toward amber)', () => {
    const yellow = primitive.accents.find((a) => a.name === 'yellow')!
    expect(yellow.values.light_ic.H).toBeCloseTo(50, 1) // override hue, not default 83
  })

  test('CSS contains :root block with light-mode primitives', () => {
    expect(css).toContain(':root {')
    expect(css).toContain('--neutral-0:')
    expect(css).toContain('--brand:')
    expect(css).toContain('--label-brand-primary:')
  })

  test('CSS contains dark-mode selector and prefers-color-scheme block', () => {
    expect(css).toContain('[data-mode="dark"]')
    expect(css).toContain('@media (prefers-color-scheme: dark)')
    expect(css).toContain('[data-mode="light-ic"]')
    expect(css).toContain('[data-mode="dark-ic"]')
  })

  test('CSS emits opacity ladder variables for a primitive', () => {
    expect(css).toContain('--neutral-0-a0:')
    expect(css).toContain('--neutral-0-a72:')
    expect(css).toContain('--neutral-0-a99:')
    expect(css).toContain('--brand-a12:')
  })

  test('accent fills are mode-invariant (same opacity across all modes)', () => {
    const token = semantic.tokens.find((t) => t.name === 'fill-brand-primary')!
    const refs = Object.values(token.values).map((v) =>
      v.kind === 'primitive' ? `${v.primitive}@${v.alpha}` : 'ref',
    )
    const uniq = new Set(refs)
    expect(uniq.size).toBe(1)
    expect([...uniq][0]).toBe('brand@0.12')
  })

  test('neutral fills vary by mode', () => {
    const token = semantic.tokens.find((t) => t.name === 'fill-neutral-primary')!
    const light = token.values.light
    const dark = token.values.dark
    expect(light.kind).toBe('primitive')
    expect(dark.kind).toBe('primitive')
    if (light.kind === 'primitive' && dark.kind === 'primitive') {
      expect(light.alpha).toBeCloseTo(0.2, 2)
      expect(dark.alpha).toBeCloseTo(0.36, 2)
    }
  })
})
