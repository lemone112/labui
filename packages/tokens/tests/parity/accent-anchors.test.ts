/**
 * Figma parity · accent anchors (PT1).
 *
 * @layer Parity
 * @governs plan/test-strategy.md §10 Parity · PT1 (plan target ΔE ≤ 3)
 * @invariant All 11 accents match the Figma Color Guides on **all four
 *            sectors** (`light/normal`, `light/ic`, `dark/ic`,
 *            `dark/normal`) within ΔE2000 ≤ 1.0 because
 *            `accents.<name>.primitive_per_output` pins each sector
 *            byte-for-byte against the fixture.
 *
 *            Previously only the two primary sectors were tight;
 *            IC sectors carried a loose ≤ 60 sanity guard because
 *            primitive accents were a `mode`-only axis. PR-G opens
 *            the contrast axis on the primitive layer so Figma's
 *            intentional IC-sector colour shifts (e.g. Yellow light/ic
 *            `#B25000` — a *brown*, not a desaturated yellow) are
 *            honoured verbatim. See `plan/handoff.md §2` invariant #1
 *            for the architectural rationale.
 *
 * @on-fail Inspect the Figma HEX in the printed table and fix the
 *          matching key in
 *          `config.colors.accents.<name>.primitive_per_output.<sector>`.
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

// Uniform target across all 4 sectors — primitive is now a full
// (mode × contrast) axis via `primitive_per_output`. Tight threshold
// is feasible because every sector is Figma-pinned.
const THRESHOLD = 1.0

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

test('PT1 · 11 accents — all 4 sectors match Figma within ΔE ≤ 1.0', () => {
  const rows: string[] = []
  const maxByAccent = new Map<string, number>()
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
      maxByAccent.set(label, Math.max(maxByAccent.get(label) ?? 0, dE))
      if (dE > THRESHOLD) {
        failures.push(
          `${label} ${mode}: ours=${ours} figma=${theirs} ΔE=${dE.toFixed(2)} > ${THRESHOLD}`,
        )
      }
    })
  }

  console.log('\n--- PT1 accent parity (all 4 sectors, ΔE ≤ 1.0) ---')
  const sorted = [...maxByAccent.entries()].sort((a, b) => b[1] - a[1])
  for (const [label, max] of sorted) {
    console.log(`  ${label.padEnd(10)} max ΔE = ${max.toFixed(2)}`)
  }

  console.log('\n--- full table ---')
  for (const r of rows) console.log(r)

  expect(failures).toEqual([])
})
