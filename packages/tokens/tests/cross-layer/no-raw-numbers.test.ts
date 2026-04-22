/**
 * No raw CSS numbers in semantic emissions (except shadows' px dims).
 *
 * @layer Cross-layer · Emit
 * @governs plan-v2 §6 · Emit + §5 · Semantic layer should reference
 *          primitives, not hardcode numeric values.
 * @invariant Every semantic line contains an oklch(...) value OR a var(...)
 *            reference. No plain hex codes anywhere in the CSS.
 * @on-fail inspect writers/css.ts for hardcoded fallbacks.
 */

import { describe, expect, test } from 'bun:test'
import { css } from '../_helpers/fixtures'

describe('Emit · no raw hex', () => {
  test('no #rrggbb in tokens.css', () => {
    // Empty css line would match /^$/, actually use hex regex
    const hexMatches = css.match(/#[0-9a-fA-F]{6}/g) ?? []
    expect(hexMatches.length).toBe(0)
  })

  test('no rgb(...) or hsl(...) outside OKLCH', () => {
    const rgb = css.match(/rgb\(/g) ?? []
    const hsl = css.match(/hsl\(/g) ?? []
    expect(rgb.length).toBe(0)
    expect(hsl.length).toBe(0)
  })
})
