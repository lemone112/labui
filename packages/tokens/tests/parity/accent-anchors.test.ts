/**
 * Figma parity · accent anchors (PT1).
 *
 * @layer Parity
 * @governs plan/test-strategy.md §10 Parity · PT1 (plan target ΔE ≤ 3)
 * @invariant 11 accent hues match the Figma Color Guides primary sectors
 *            (`light/normal`, `dark/normal`) within ΔE2000 ≤ 1.0 because
 *            `accents.<name>.primitive_per_mode` pins those sectors
 *            byte-for-byte against the fixture.
 *
 *            The IC sectors (`light/ic`, `dark/ic`) are intentionally
 *            NOT calibrated here: primitive accents are a `mode`-only
 *            axis (plan §4.2). IC variation lives on the semantic tier
 *            (`--label-brand-primary-ic` etc. in plan §5.1) where
 *            per-tier APCA targeting produces the darker / lighter IC
 *            shade from the same spine. Comparing the Figma IC sector
 *            HEX against our primitive `--{accent}` var would be a
 *            category error; we still log those rows for information
 *            and keep a loose sanity guard of ΔE ≤ 60 on them so the
 *            numbers are visible in CI output.
 *
 * @on-fail If a primary-sector row regressed, inspect the Figma HEX in
 *          the printed table and fix
 *          `config.colors.accents.<name>.primitive_per_mode` to
 *          re-pin the sector. If an IC-sector row crosses the sanity
 *          guard, something broke the primitive-mode orthogonality
 *          (e.g. perceptual-comp leaked in, or a writer collapsed
 *          scopes).
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

// Sectors we actively calibrate (primary parity target per plan §10 PT1).
const PRIMARY_SECTORS = new Set<Mode>(['light/normal', 'dark/normal'])
// Primary target — tight because `primitive_per_mode` pins these.
const PRIMARY_THRESHOLD = 1.0
// IC sector sanity guard — loose, because primitive accents are
// mode-only and the Figma IC sector lives at semantic tier.
const IC_SANITY_THRESHOLD = 60

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

test('PT1 · 11 accents — primary sectors match Figma within ΔE ≤ 1.0', () => {
  const rows: string[] = []
  const primaryMax = new Map<string, number>()
  const icMax = new Map<string, number>()
  const primaryFailures: string[] = []
  const icFailures: string[] = []

  for (const [label, hexList] of Object.entries(figma.accents) as Array<
    [string, readonly [string, string, string, string]]
  >) {
    const varBase = FIGMA_TO_VAR[label]
    if (!varBase) {
      primaryFailures.push(`no mapping for Figma accent "${label}"`)
      continue
    }
    FIGMA_MODE_ORDER.forEach((mode: Mode, i: number) => {
      const ours = hexForVar(varBase, mode)
      const theirs = hexList[i]!
      if (!ours) {
        primaryFailures.push(`--${varBase} missing in ${mode}`)
        return
      }
      const dE = deltaE2000(ours, theirs)
      rows.push(formatRow(label, mode, ours, theirs, dE))
      if (PRIMARY_SECTORS.has(mode)) {
        primaryMax.set(label, Math.max(primaryMax.get(label) ?? 0, dE))
        if (dE > PRIMARY_THRESHOLD) {
          primaryFailures.push(
            `${label} ${mode}: ours=${ours} figma=${theirs} ΔE=${dE.toFixed(2)} > ${PRIMARY_THRESHOLD}`,
          )
        }
      } else {
        icMax.set(label, Math.max(icMax.get(label) ?? 0, dE))
        if (dE > IC_SANITY_THRESHOLD) {
          icFailures.push(
            `${label} ${mode}: ours=${ours} figma=${theirs} ΔE=${dE.toFixed(2)} > ${IC_SANITY_THRESHOLD} (IC sanity)`,
          )
        }
      }
    })
  }

  console.log('\n--- PT1 primary parity (light/normal, dark/normal) ---')
  const sortedPrimary = [...primaryMax.entries()].sort((a, b) => b[1] - a[1])
  for (const [label, max] of sortedPrimary) {
    console.log(`  ${label.padEnd(10)} max ΔE = ${max.toFixed(2)}`)
  }

  console.log(
    '\n--- PT1 IC sectors (informational; primitive accents are mode-only) ---',
  )
  const sortedIc = [...icMax.entries()].sort((a, b) => b[1] - a[1])
  for (const [label, max] of sortedIc) {
    console.log(`  ${label.padEnd(10)} max ΔE = ${max.toFixed(2)}`)
  }

  console.log('\n--- full table ---')
  for (const r of rows) console.log(r)

  expect(primaryFailures).toEqual([])
  expect(icFailures).toEqual([])
})
