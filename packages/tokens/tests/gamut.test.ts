/**
 * Gamut invariants.
 *
 * @layer L3 (primitive)
 * @governs plan-v2 §9 · Gamut safety invariant
 * @invariant Every primitive OKLCH in every output key fits the configured gamut.
 * @why Out-of-gamut values get silently clipped by the browser, producing
 *      per-display color drift. We clamp upstream with a safety margin.
 * @on-fail adjust accent.chroma_curve.peak or accent.chroma_boost_per_dL;
 *          verify config.colors.gamut matches target displays.
 */

import { describe, expect, test } from 'bun:test'
import { primitive, semantic, config } from './_helpers/fixtures'
import { validateGamut } from '../src/validators/gamut'

describe('Gamut · primitives inside P3', () => {
  const r = validateGamut(primitive, semantic, config.colors.gamut)

  test('no primitive reports a gamut error', () => {
    if (r.errors.length) throw new Error(`Gamut errors:\n${r.errors.join('\n')}`)
    expect(r.errors.length).toBe(0)
  })

  test('no semantic reports a gamut error (warnings allowed)', () => {
    // Semantics may warn if a composed alpha puts them out, but no hard error.
    const semErrs = r.errors.filter((e) => !e.startsWith('neutral-') && !e.startsWith('accent-'))
    expect(semErrs.length).toBe(0)
  })
})
