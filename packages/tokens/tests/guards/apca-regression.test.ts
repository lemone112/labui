/**
 * APCA regression guard (G7).
 *
 * @layer Guard
 * @governs plan/test-strategy.md §11 · G7 accessibility regression
 * @invariant For every (fg, bg, tier, output) pair tracked in the
 *            baseline, the current |Lc| may not drop by more than
 *            `APCA_REGRESSION_TOLERANCE` Lc. Intentional accessibility
 *            changes must regenerate the baseline via
 *            `bun run apca-baseline` and land in the same PR.
 * @why Spine tweaks, gamut changes, or pivot-mirror edits can
 *      unintentionally dim a tier just enough to slip under the APCA
 *      target while the tier-assertion test still passes (because the
 *      measured value is still within per-token `APCA_TOLERANCE=1.0`
 *      of the target). This guard catches *trend* regressions across
 *      the whole token surface, not just per-token compliance.
 * @on-fail Inspect the printed delta table to find which tiers dropped.
 *          If the drop was intentional (e.g. relaxing a tier target or
 *          recalibrating neutrals), rerun `bun run apca-baseline` and
 *          commit the new JSON alongside the code change. If
 *          unintentional, revert the regressing commit and re-plan.
 */

import { test, expect } from 'bun:test'
import baseline from './__snapshots__/apca-baseline.json' with {
  type: 'json',
}
import { primitive, semantic } from '../_helpers/fixtures'
import { validateApca } from '../../src/validators/apca'

// Tolerance per plan/test-strategy.md §11 G7. Tightening this is a
// separate PR driven off the logged delta table.
const APCA_REGRESSION_TOLERANCE = 3.0

type BaselineEntry = {
  fg: string
  bg_path: string
  tier: string
  output: string
  measured: number
  target: number
}

function keyOf(p: {
  fg: string
  bg_path: string
  tier: string
  output: string
}): string {
  return `${p.fg}|${p.bg_path}|${p.tier}|${p.output}`
}

test('G7 · APCA |Lc| has not regressed beyond tolerance vs baseline', () => {
  const { pairs } = validateApca(primitive, semantic)
  const current = new Map(
    pairs.map((p) => [
      keyOf(p),
      Math.round(p.measured * 10) / 10,
    ] as const),
  )

  const regressions: string[] = []
  const missing: string[] = []
  const rows: string[] = []

  for (const entry of baseline as BaselineEntry[]) {
    const key = keyOf(entry)
    const cur = current.get(key)
    if (cur === undefined) {
      missing.push(key)
      continue
    }
    const delta = cur - entry.measured // positive = improved
    rows.push(
      `${entry.fg.padEnd(36)} ${entry.bg_path.padEnd(30)} ${entry.output.padEnd(12)} baseline=${entry.measured
        .toFixed(1)
        .padStart(5)} current=${cur.toFixed(1).padStart(5)} Δ=${
        delta >= 0 ? '+' : ''
      }${delta.toFixed(1)}`,
    )
    if (delta < -APCA_REGRESSION_TOLERANCE) {
      regressions.push(
        `${entry.fg} on ${entry.bg_path} ${entry.output} (${entry.tier}): baseline=${entry.measured.toFixed(
          1,
        )} current=${cur.toFixed(1)} Δ=${delta.toFixed(1)}Lc < -${APCA_REGRESSION_TOLERANCE}`,
      )
    }
  }

  const worstFirst = [...rows]
    .sort((a, b) => {
      const getDelta = (s: string) => {
        const m = s.match(/Δ=([-+]?\d+\.\d+)/)
        return m ? parseFloat(m[1]) : 0
      }
      return getDelta(a) - getDelta(b)
    })
    .slice(0, 20)

  console.log('\n--- G7 worst 20 APCA Δ rows (negative = regression) ---')
  for (const r of worstFirst) console.log(r)

  if (missing.length) {
    console.log(
      `\n--- ${missing.length} baseline entries missing in current pipeline ---`,
    )
    for (const k of missing.slice(0, 20)) console.log('  ' + k)
  }

  expect(regressions).toEqual([])
  expect(missing).toEqual([])
})
