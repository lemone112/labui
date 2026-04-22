/**
 * Spine monotonic-H invariant.
 *
 * @layer L3 (primitive)
 * @governs plan-v2 §4.2 · Accent spines
 * @invariant For every accent, H(L) sampled densely along the spine is
 *            monotonic (or near-monotonic with Hermite-induced overshoot
 *            ≤ 5°). Hue must not oscillate.
 * @why Non-monotonic H causes perceived color jumps (yellow → olive →
 *      yellow) as tier L moves — destroys the "same accent family" feel.
 * @on-fail add a control point at the offending L, or simplify the spine
 *          (remove a point causing overshoot).
 */

import { describe, expect, test } from 'bun:test'
import { config } from '../_helpers/fixtures'
import { spineInterp } from '../../src/utils/spine'
import type { AccentDef, AccentName } from '../../src/types'

function samples(accent: AccentDef): Array<{ L: number; H: number }> {
  const out: Array<{ L: number; H: number }> = []
  for (let i = 0; i <= 100; i++) {
    const L = i / 100
    const { H } = spineInterp(accent.spine, L)
    out.push({ L, H })
  }
  return out
}

describe('Spine · monotonic H', () => {
  for (const [name, def] of Object.entries(config.colors.accents)) {
    if ('alias' in def) continue
    const accentName = name as AccentName

    test(`${accentName}: no overshoot > 5°`, () => {
      const pts = samples(def)
      // Overall direction = sign of (last.H - first.H)
      const first = pts[0].H
      const last = pts[pts.length - 1].H
      const dir = Math.sign(last - first)
      // If spine is nearly flat (|last-first| < 3°), any small jitter is fine
      if (Math.abs(last - first) < 3) return

      let maxBacktrack = 0
      for (let i = 1; i < pts.length; i++) {
        const step = pts[i].H - pts[i - 1].H
        if (Math.sign(step) === -dir) {
          maxBacktrack = Math.max(maxBacktrack, Math.abs(step))
        }
      }
      expect(maxBacktrack).toBeLessThan(5)
    })

    test(`${accentName}: control points lie on sampled curve`, () => {
      for (const p of def.spine) {
        const { H } = spineInterp(def.spine, p.L)
        expect(Math.abs(H - p.H)).toBeLessThan(0.1)
      }
    })
  }
})
