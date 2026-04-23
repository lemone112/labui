/**
 * Generate the APCA baseline used by the G7 regression guard.
 *
 * Usage:
 *   bun run scripts/generate-apca-baseline.ts
 *
 * Writes `tests/guards/__snapshots__/apca-baseline.json` with the full
 * list of (fg, bg_path, tier, output, measured) APCA pairs produced by
 * the current config. Each `measured` is rounded to 1 decimal Lc.
 *
 * Run this whenever an intentional color / tier change lowers an Lc
 * value. The guard test (`tests/guards/apca-regression.test.ts`)
 * fails if any pair regressed by more than
 * `APCA_REGRESSION_TOLERANCE` Lc vs the committed baseline.
 *
 * @governs plan/test-strategy.md §11 · G7 accessibility regression
 */

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

import { config } from '../config/tokens.config'
import { generatePrimitiveColors } from '../src/generators/primitive-colors'
import { generateSemanticColors } from '../src/generators/semantic-colors'
import { validateApca } from '../src/validators/apca'
import type { ApcaPair } from '../src/validators/apca'

const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outPath = resolve(
  pkgRoot,
  'tests/guards/__snapshots__/apca-baseline.json',
)

const primitive = generatePrimitiveColors(config.colors)
const semantic = generateSemanticColors(
  config.semantics,
  primitive,
  config.colors,
)
const { pairs } = validateApca(primitive, semantic)

// Deterministic ordering so diffs stay readable.
const sorted = [...pairs].sort((a, b) => {
  const byFg = a.fg.localeCompare(b.fg)
  if (byFg !== 0) return byFg
  const byBg = a.bg_path.localeCompare(b.bg_path)
  if (byBg !== 0) return byBg
  return a.output.localeCompare(b.output)
})

const trimmed = sorted.map((p: ApcaPair) => ({
  fg: p.fg,
  bg_path: p.bg_path,
  tier: p.tier,
  output: p.output,
  measured: Math.round(p.measured * 10) / 10,
  target: p.target,
}))

writeFileSync(outPath, JSON.stringify(trimmed, null, 2) + '\n', 'utf-8')

console.log(
  `✓ wrote ${outPath.replace(pkgRoot + '/', '')} (${trimmed.length} pairs)`,
)
