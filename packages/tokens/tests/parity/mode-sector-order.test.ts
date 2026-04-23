/**
 * Figma parity · mode-sector order lock (PTMODE).
 *
 * @layer Parity
 * @governs plan/test-strategy.md §10 Parity · PT1/PT2 mode-mapping prereq
 * @invariant Figma `Color wrap` ellipse order (4, 5, 6, 7) maps to our
 *            four CSS output scopes in this order:
 *              [light/normal, light/ic, dark/ic, dark/normal]
 * @on-fail Figma has re-rotated the pie sectors, or we reshuffled the
 *          `data-mode/data-contrast` scopes. Either the fixture or the
 *          CSS writer moved — do NOT blindly re-order tests, re-derive
 *          the mapping by inspecting neutral-0 across all 4 scopes.
 *
 * We assert this via neutrals (which are bit-stable between our emit
 * and Figma) rather than accents (where our spine is not yet calibrated
 * to Figma — that is PT1's job). Any neutral step with 4 distinct HEX
 * values across modes works as a lock; step 0 is the strongest because
 * it spans the full L range (white ↔ black).
 */

import { test, expect } from 'bun:test'
import figma from './fixtures/figma-anchors.json' with { type: 'json' }
import { FIGMA_MODE_ORDER, deltaE2000, hexForVar } from './utils'

const SANITY_DELTAE = 10

test('PTMODE · neutral-0 aligns per-mode within ΔE ≤ 10 (sanity lock)', () => {
  const figmaHex = figma.neutrals['0'] as readonly [
    string,
    string,
    string,
    string,
  ]
  const mismatches: string[] = []
  FIGMA_MODE_ORDER.forEach((mode, i) => {
    const ours = hexForVar('neutral-0', mode)
    if (!ours) {
      mismatches.push(`${mode}: --neutral-0 missing in CSS output`)
      return
    }
    const dE = deltaE2000(ours, figmaHex[i]!)
    if (dE > SANITY_DELTAE) {
      mismatches.push(
        `${mode}: ours=${ours} figma=${figmaHex[i]} ΔE=${dE.toFixed(2)}`,
      )
    }
  })
  expect(mismatches).toEqual([])
})
