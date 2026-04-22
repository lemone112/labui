/**
 * Progressive shadow presets — structural and CSS emit checks.
 *
 * @layer L4 (semantic) × Emit
 * @governs plan-v2 §6 · Emit · §5.2 · fx.shadow_presets
 * @invariant 5 presets (xs/s/m/l/xl), 1-4 layers each, xs=1, xl=4 layers.
 *            Each layer carries tint_var referencing a shadow-tint var.
 * @on-fail adjust config.semantics.fx.shadow_presets.
 */

import { describe, expect, test } from 'bun:test'
import { semantic, css } from '../_helpers/fixtures'

describe('Shadow presets · structure', () => {
  test('5 presets emitted', () => {
    expect(semantic.shadow_presets.length).toBe(5)
    const names = semantic.shadow_presets.map((p) => p.name).sort()
    expect(names).toEqual(['l', 'm', 's', 'xl', 'xs'])
  })

  test('xs has 1 layer, xl has 4 layers', () => {
    const xs = semantic.shadow_presets.find((p) => p.name === 'xs')!
    const xl = semantic.shadow_presets.find((p) => p.name === 'xl')!
    expect(xs.layers.length).toBe(1)
    expect(xl.layers.length).toBe(4)
  })

  test('every layer references a tint var', () => {
    for (const preset of semantic.shadow_presets) {
      for (const layer of preset.layers) {
        expect(layer.tint_var).toMatch(/^--fx-shadow-/)
      }
    }
  })
})

describe('Shadow presets · CSS emit', () => {
  test('tokens.css has all 5 shadow vars', () => {
    for (const n of ['xs', 's', 'm', 'l', 'xl']) {
      expect(css).toContain(`--fx-shadow-${n}:`)
    }
  })

  test('XL shadow CSS string has 4 comma-separated layers', () => {
    const xlLine = css.split('\n').find((l) => l.trim().startsWith('--fx-shadow-xl:'))!
    const segments = xlLine.split(',')
    expect(segments.length).toBe(4)
  })

  test('shadow layer format: "0px Ypx BLURpx SPREADpx var(--fx-shadow-TINT)"', () => {
    const xsLine = css.split('\n').find((l) => l.trim().startsWith('--fx-shadow-xs:'))!
    expect(xsLine).toMatch(/0px \d+px \d+px \d+px var\(--fx-shadow-\w+\)/)
  })
})
