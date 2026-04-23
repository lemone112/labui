/**
 * Snapshot / structural guards — locks key values so parameter tweaks
 * trigger obvious diffs.
 *
 * @layer L3/L4 · Guard
 * @governs plan-v2 §6 · Emit layer · §9 · Invariants
 * @invariant Canonical anchors (13 neutrals, 29 opacity stops, Figma
 *            brand anchor L, tier Lc targets) stay stable across
 *            routine edits; a change here means parameters moved.
 * @on-fail if intentional, update the snapshot; otherwise investigate what
 *          upstream changed (commit SHA in PR title helps).
 */

import { describe, expect, test } from 'bun:test'
import { primitive, semantic, css } from './_helpers/fixtures'

describe('Primitive snapshot', () => {
  test('neutral scale has 13 steps', () => {
    expect(primitive.neutrals.length).toBe(13)
  })

  test('opacity ladder has 29 stops', () => {
    expect(primitive.opacityStops.length).toBe(29)
  })

  test('N0 in light/normal is pure white', () => {
    const n0 = primitive.neutrals[0]
    expect(n0.values['light/normal'].L).toBeCloseTo(1.0, 3)
    expect(n0.values['light/normal'].C).toBeLessThanOrEqual(0.01)
  })

  test('N12 in light/normal approaches the darkest physical L', () => {
    const n12 = primitive.neutrals[12]
    // Calibrated endpoint is whichever value the neutral spine uses at
    // step 12 — `L_ladder.normal[12]` if present, otherwise
    // `endpoints_normal.L12`. Either way, N12 should be the darkest
    // rung in light/normal, not white.
    expect(n12.values['light/normal'].L).toBeLessThan(0.3)
    expect(n12.values['light/normal'].C).toBeLessThanOrEqual(0.02)
  })

  test('pivot mirror: N0 dark == N12 light (physical L), within comp shift', () => {
    const n0Dark = primitive.neutrals[0].values['dark/normal']
    const n12Light = primitive.neutrals[12].values['light/normal']
    // dark applies -0.02 HK shift → n0Dark.L ≈ n12Light.L - 0.02
    expect(Math.abs(n0Dark.L - (n12Light.L - 0.02))).toBeLessThan(0.01)
  })

  test('11 accents are present', () => {
    const names = primitive.accents.map((a) => a.name).sort()
    expect(names).toEqual(
      [
        'blue',
        'brand',
        'green',
        'indigo',
        'mint',
        'orange',
        'pink',
        'purple',
        'red',
        'teal',
        'yellow',
      ].sort(),
    )
  })
})

describe('CSS emit', () => {
  test(':root contains light/normal primitives', () => {
    expect(css).toContain(':root {')
    expect(css).toContain('--neutral-0:')
    expect(css).toContain('--brand:')
    expect(css).toContain('--label-brand-primary:')
  })

  test('dark mode selectors + prefers-color-scheme block emitted', () => {
    expect(css).toContain('[data-mode="dark"]')
    expect(css).toContain('@media (prefers-color-scheme: dark)')
  })

  test('IC selector emitted', () => {
    expect(css).toContain('[data-contrast="ic"]')
  })

  test('opacity ladder vars emitted', () => {
    expect(css).toContain('--neutral-0-a0:')
    expect(css).toContain('--neutral-0-a72:')
    expect(css).toContain('--brand-a12:')
  })

  test('progressive shadow var is multi-layer', () => {
    expect(css).toContain('--fx-shadow-xl:')
    const xlLine = css.split('\n').find((l) => l.includes('--fx-shadow-xl:'))!
    // XL has 4 layers separated by commas
    expect(xlLine.match(/,/g)?.length).toBeGreaterThanOrEqual(3)
  })
})
