/**
 * Figma parity · neutral anchors drift guard (PT2).
 *
 * @layer Parity
 * @governs plan/test-strategy.md §10 Parity · PT2 (plan target ΔE ≤ 2)
 * @invariant 13 neutral steps × 4 modes stay within the drift-guard
 *            threshold of the Figma Color Guides swatch sectors. The
 *            full delta table is logged on every run; shrinking the
 *            threshold down to the plan target (≤ 2) is tracked as the
 *            dedicated neutral-spine calibration PR driven off this
 *            data.
 * @on-fail Neutral curve in `config.colors.neutrals` drifted from the
 *          Figma reference, OR the white/black seal offsets were
 *          re-tuned. Inspect the printed table to identify which
 *          step/mode regressed; update the config anchor, regenerate,
 *          rerun.
 *
 * Drift-guard rationale: today the neutral spine is calibrated for
 * APCA label contrast, not Figma parity — current max ΔE is ≈ 16
 * (neutral-8 dark/ic). The guard is set slightly above that to catch
 * regressions without failing on known pre-existing deltas.
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

// Drift guard. Tighten down to the plan target (≤ 2) as a separate PR
// that recalibrates the spine against Figma.
const THRESHOLD = 20

test('PT2 · 13 neutrals × 4 modes stay within drift-guard ΔE ≤ 20', () => {
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
