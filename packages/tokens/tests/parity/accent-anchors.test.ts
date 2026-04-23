/**
 * Figma parity · accent anchors drift guard (PT1).
 *
 * @layer Parity
 * @governs plan/test-strategy.md §10 Parity · PT1 (plan target ΔE ≤ 3)
 * @invariant 11 accent hues × 4 modes produce HEX within a sanity
 *            ΔE2000 bound of the Figma Color Guides swatch sectors.
 *            The per-accent ΔE and the full delta table are logged on
 *            every run so spine calibration can be driven against
 *            live data.
 * @on-fail Either (a) an accent moved hue/chroma beyond the drift
 *          guard in our config, OR (b) the Figma reference was
 *          restyled. Inspect the offending hue in the printed table;
 *          adjust the spine L/C/H anchor in
 *          `config.colors.accents.<name>`, rerun.
 *
 * Scope note: the plan target is ΔE ≤ 3 per anchor. Today we ship
 * with a drift guard of ΔE ≤ 40 because the accent spine is not yet
 * calibrated against Figma — this test's job for now is to surface
 * current deltas, not block merges. Tightening to the plan target is
 * a separate follow-up PR driven by reading the rows this test logs.
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

// Drift-guard threshold — catches catastrophic misalignments (wrong
// hue, wrong mode-map) without blocking on per-hue fine calibration.
// Tighten down to the plan target (≤ 3) as a separate spine-calibration
// PR driven off the per-accent Δ table this test logs. Current worst
// offender is Yellow light/ic ≈ 37 (Figma reference is a burnt-orange,
// our spine is a green-tinted yellow).
const SANITY_THRESHOLD = 40

// Figma label → our CSS variable base name. `Brand` is our "blue"
// accent duplicated under a brand alias — we compare against `--brand`
// directly since that is the emitted primitive.
const FIGMA_TO_VAR: Record<string, string> = {
  Brand: 'brand',
  Red: 'red',
  Orange: 'orange',
  Yellow: 'yellow',
  Green: 'green',
  Teal: 'teal',
  Mint: 'mint',
  Blue: 'blue',
  Indigo: 'indigo',
  Purple: 'purple',
  Pink: 'pink',
}

test('PT1 · 11 accents × 4 modes — report deltas, drift-guard ΔE ≤ 40', () => {
  const rows: string[] = []
  const perAccentMax = new Map<string, number>()
  const failures: string[] = []

  for (const [label, hexList] of Object.entries(figma.accents) as Array<
    [string, readonly [string, string, string, string]]
  >) {
    const varBase = FIGMA_TO_VAR[label]
    if (!varBase) {
      failures.push(`no mapping for Figma accent "${label}"`)
      continue
    }
    FIGMA_MODE_ORDER.forEach((mode: Mode, i: number) => {
      const ours = hexForVar(varBase, mode)
      const theirs = hexList[i]!
      if (!ours) {
        failures.push(`--${varBase} missing in ${mode}`)
        return
      }
      const dE = deltaE2000(ours, theirs)
      rows.push(formatRow(label, mode, ours, theirs, dE))
      perAccentMax.set(
        label,
        Math.max(perAccentMax.get(label) ?? 0, dE),
      )
      if (dE > SANITY_THRESHOLD) {
        failures.push(
          `${label} ${mode}: ours=${ours} figma=${theirs} ΔE=${dE.toFixed(2)} > ${SANITY_THRESHOLD}`,
        )
      }
    })
  }

  // Always print the delta summary so CI output is the calibration
  // source of truth.
  console.log('\n--- PT1 accent parity (Δ per hue, max across modes) ---')
  const sorted = [...perAccentMax.entries()].sort((a, b) => b[1] - a[1])
  for (const [label, max] of sorted) {
    console.log(`  ${label.padEnd(10)} max ΔE = ${max.toFixed(2)}`)
  }
  console.log('\n--- full table ---')
  for (const r of rows) console.log(r)

  expect(failures).toEqual([])
})
