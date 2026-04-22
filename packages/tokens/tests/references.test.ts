/**
 * Reference integrity — all semantic tokens resolve to finite, valid OKLCH.
 *
 * @layer L4 (semantic)
 * @governs plan-v2 §5 · Semantic tree
 * @invariant Every semantic has a value per OutputKey with L∈[0,1], C≥0,
 *            H∈[0,360), alpha∈[0,1], all finite.
 * @on-fail inspect generator emitting NaN/∞; most common cause is spine
 *          validation bypass or chroma_curve with negative peak.
 */

import { describe, expect, test } from 'bun:test'
import { primitive, semantic } from './_helpers/fixtures'
import { validateReferences } from '../src/validators/references'

describe('References · semantic integrity', () => {
  const r = validateReferences(primitive, semantic)

  test('no integrity errors across all OutputKeys', () => {
    if (r.errors.length) throw new Error(r.errors.join('\n'))
    expect(r.errors.length).toBe(0)
  })

  test('every semantic has 4 output values', () => {
    for (const token of semantic.tokens) {
      expect(Object.keys(token.values).sort()).toEqual(
        ['dark/ic', 'dark/normal', 'light/ic', 'light/normal'],
      )
    }
  })
})
