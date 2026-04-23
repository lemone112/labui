/**
 * Z-index · integer invariant + CSS emit.
 *
 * @layer L6 (z-index)
 * @governs plan-v2 §7 · Layer 6 Z-index
 * @invariant Every --z-* value is a finite integer. Layer is
 *            mode-invariant (single :root block).
 * @on-fail non-integer → browsers implementation-define behavior;
 *          adjust config to integer values or check for typos.
 */

import { describe, expect, test } from 'bun:test'
import { config } from '../../config/tokens.config'
import { generateZIndex } from '../../src/generators/z-index'
import { writeZIndexCss } from '../../src/writers/extras'

describe('Z-index · values', () => {
  const { z_index, warnings } = generateZIndex(config.z_index)

  test('no warnings at default config', () => {
    expect(warnings).toEqual([])
  })

  test('every value is a finite integer', () => {
    for (const [name, value] of Object.entries(z_index)) {
      expect(Number.isFinite(value)).toBe(true)
      expect(Number.isInteger(value)).toBe(true)
    }
  })

  test('canonical names exist', () => {
    const required = [
      'primary',
      'dropdown',
      'sticky',
      'modal-underlay',
      'modal',
      'toast',
      'tooltip',
    ]
    for (const name of required) {
      expect(z_index).toHaveProperty(name)
    }
  })

  test('tooltip is the topmost canonical layer', () => {
    expect(z_index.tooltip).toBeGreaterThan(z_index.toast)
    expect(z_index.toast).toBeGreaterThan(z_index.modal)
    expect(z_index.modal).toBeGreaterThan(z_index['modal-underlay'])
    expect(z_index['modal-underlay']).toBeGreaterThan(z_index.sticky)
  })

  test('non-integer input is rejected with warning', () => {
    const result = generateZIndex({ broken: 1.5 })
    expect(result.z_index.broken).toBeUndefined()
    expect(result.warnings.length).toBe(1)
    expect(result.warnings[0]).toContain('broken')
  })
})

describe('Z-index · emit', () => {
  const { z_index } = generateZIndex(config.z_index)
  const css = writeZIndexCss(z_index)

  test('emits :root block', () => {
    expect(css).toMatch(/:root \{/)
  })

  test('every name produces --z-<name>: <int>;', () => {
    for (const [name, value] of Object.entries(z_index)) {
      expect(css).toContain(`--z-${name}: ${value};`)
    }
  })

  test('values emit without px/em suffix (pure integer)', () => {
    expect(css).not.toMatch(/--z-[a-z-]+: \d+px/)
    expect(css).not.toMatch(/--z-[a-z-]+: \d+em/)
  })
})
