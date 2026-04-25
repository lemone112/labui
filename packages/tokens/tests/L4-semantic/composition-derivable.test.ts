/**
 * Composition derivability — opacity is NOT applied to pipeline labels.
 *
 * @layer L4 (semantic)
 * @governs plan-v2 §1.3 · Composition derivable · §5.2 · Semantic tree
 * @invariant All label tiers (primary..quaternary) have alpha=1. They are
 *            solid spine-points, not opacity-composed. Opacity is reserved
 *            for overlays, fills, borders-soft, fx.
 * @why Unified spine model — tiers are solid colors at distinct L targets,
 *      not opacity-washes of a single anchor.
 * @on-fail inspect SemanticsConfig — labels must use kind=pipeline without
 *          opacity_stop.
 */

import { describe, expect, test } from 'bun:test'
import { semantic, OUTPUTS } from '../_helpers/fixtures'

const LABEL_PREFIXES = [
  'label-neutral',
  'label-brand',
  'label-danger',
  'label-warning',
  'label-success',
  'label-info',
]
const TIERS = ['primary', 'secondary', 'tertiary', 'quaternary']

describe('Composition derivability · labels are solid', () => {
  for (const prefix of LABEL_PREFIXES) {
    for (const tier of TIERS) {
      const name = `${prefix}-${tier}`
      test(`${name}: alpha=1 in all outputs`, () => {
        const token = semantic.tokens.find((t) => t.name === name)
        expect(token).toBeDefined()
        for (const output of OUTPUTS) {
          expect(token!.values[output].alpha).toBe(1)
        }
      })
    }
  }
})

describe('Composition derivability · fills use opacity', () => {
  test('fill-brand-primary has alpha < 1 (opacity-composed)', () => {
    const token = semantic.tokens.find((t) => t.name === 'fill-brand-primary')!
    for (const output of OUTPUTS) {
      expect(token.values[output].alpha).toBeLessThan(1)
    }
  })

  test('fx-skeleton-base and highlight have alpha < 1', () => {
    const tokens = ['fx-skeleton-base', 'fx-skeleton-highlight'].map((name) =>
      semantic.tokens.find((t) => t.name === name),
    )
    for (const token of tokens) {
      expect(token).toBeDefined()
      for (const output of OUTPUTS) {
        expect(token!.values[output].alpha).toBeLessThan(1)
      }
    }
  })

  test('legacy fx-skeleton alias has alpha < 1', () => {
    const token = semantic.tokens.find((t) => t.name === 'fx-skeleton')!
    for (const output of OUTPUTS) {
      expect(token.values[output].alpha).toBeLessThan(1)
    }
  })
})
