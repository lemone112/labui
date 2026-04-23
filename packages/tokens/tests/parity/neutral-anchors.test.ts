/**
 * Figma parity · neutral anchors drift guard (PT2).
 *
 * @layer Parity
 * @governs plan/test-strategy.md §10 Parity · PT2 (plan target ΔE ≤ 2)
 * @invariant 13 neutral steps × 4 modes match Figma within ΔE2000 ≤ 1.
 *            Threshold is tighter than the plan target because the
 *            L/C/H ladders in `neutrals` are pinned directly against
 *            the Figma fixture — any non-zero ΔE signals either a
 *            rounding regression, a gamut-clamp change, or a Figma
 *            fixture update.
 * @on-fail Either a rounding / perceptual-comp / gamut path re-entered
 *          the neutrals pipeline, or the fixture was updated. Inspect
 *          the printed delta table to identify which step/mode regressed
 *          and adjust either the generator or the ladder in
 *          `config.colors.neutrals.{L,C,H}_ladder`.
 */

import { test, expect } from 'bun:test'
import figma from './fixtures/figma-anchors.json' with { type: 'json' }
import {
  FIGMA_MODE_ORDER,
  deltaE2000,
  formatRow,
  hexForVar,
  type Mode,
} from './utils'

// Plan target is ΔE ≤ 2; we're at 0.00 because L/C/H ladders are Figma-
// sourced and perceptual comp is bypassed for ladder-driven neutrals.
// Keep a tiny headroom so sub-LSB rounding in culori doesn't flake CI.
const THRESHOLD = 1.0

test('PT2 · 13 neutrals × 4 modes within Figma parity target ΔE ≤ 1', () => {
  const rows: string[] = []
  const failures: string[] = []
  for (const [step, hexList] of Object.entries(figma.neutrals) as Array<
    [string, readonly [string, string, string, string]]
  >) {
    FIGMA_MODE_ORDER.forEach((mode: Mode, i: number) => {
      const ours = hexForVar(`neutral-${step}`, mode)
      const theirs = hexList[i]!
      if (!ours) {
        failures.push(`neutral-${step} missing in CSS output for ${mode}`)
        return
      }
      const dE = deltaE2000(ours, theirs)
      rows.push(formatRow(`neutral-${step}`, mode, ours, theirs, dE))
      if (dE > THRESHOLD) {
        failures.push(
          `neutral-${step} ${mode}: ours=${ours} figma=${theirs} ΔE=${dE.toFixed(2)}`,
        )
      }
    })
  }
  // Always log the full delta table — this test's output is the
  // calibration source of truth for the neutral spine.
  console.log('\n--- PT2 neutral parity (all rows) ---')
  for (const r of rows) console.log(r)
  if (failures.length > 0) {
    console.log('--- drift-guard failures ---')
    for (const f of failures) console.log(f)
  }
  expect(failures).toEqual([])
})
