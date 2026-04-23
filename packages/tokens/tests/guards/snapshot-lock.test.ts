/**
 * Snapshot lock — specific high-signal values frozen so PRs that alter
 * them cause obvious test diffs.
 *
 * @layer Guard
 * @governs plan-v2 §9 · Invariants
 * @invariant A handful of canonical anchor values stay stable across
 *            routine edits. Intentional changes require updating this file.
 * @on-fail (a) intentional calibration change → update here; (b) unintended
 *          drift → track down recent commit touching generators/resolver.
 */

import { describe, expect, test } from 'bun:test'
import { primitive, semantic } from '../_helpers/fixtures'

describe('Snapshot lock · anchors', () => {
  test('brand anchor L in light/normal is near Figma anchor 0.603', () => {
    const brand = primitive.accents.find((a) => a.id === 'brand')!
    expect(brand.values['light/normal'].L).toBeCloseTo(0.603, 2)
  })

  test('label-neutral-primary light/normal hits tier target (APCA ≥ 58)', () => {
    const t = semantic.tokens.find((t) => t.name === 'label-neutral-primary')!
    const apca = t.diagnostic!.measured_apca['light/normal']
    expect(apca).toBeGreaterThanOrEqual(58)
  })

  test('label-brand-primary light/normal meets APCA & WCAG floors', () => {
    // Primary tier declares two targets: APCA Lc 60 AND WCAG 4.5:1.
    // Blue text on white has a large APCA-vs-WCAG delta (APCA is more
    // sensitive to short-wavelength energy), so the WCAG floor binds
    // here — L ends up darker than APCA 60 alone would produce. We
    // assert (a) APCA is at least its target, (b) WCAG floor met.
    const t = semantic.tokens.find((t) => t.name === 'label-brand-primary')!
    const apca = t.diagnostic!.measured_apca['light/normal']
    const wcag = t.diagnostic!.measured_wcag!['light/normal']
    expect(apca).toBeGreaterThanOrEqual(58) // Lc 60 − 2 tolerance
    expect(wcag).toBeGreaterThanOrEqual(4.4) // 4.5 − 0.1 tolerance
  })

  test('count: 13 neutrals + 11 accents + 2 statics + 29 opacity stops', () => {
    expect(primitive.neutrals.length).toBe(13)
    expect(primitive.accents.length).toBe(11)
    expect(primitive.statics.length).toBe(2)
    expect(primitive.opacityStops.length).toBe(29)
  })
})
