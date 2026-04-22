/**
 * APCA contrast validator (v2) — tier-aware.
 *
 * @governs implementation-plan-v2.md §5.1 · Tier targets · §9 · Invariants
 *
 * For every semantic with a pipeline-based definition, we verify that
 * the diagnostic APCA value meets the tier target per output key.
 *
 * Pipeline tokens have `diagnostic.measured_apca` and `diagnostic.target_apca`
 * attached by the generator. This validator surfaces any delta < tolerance
 * as an error or warning.
 */

import type { OutputKey, PrimitiveColorSet, SemanticColorSet } from '../types'
import { OUTPUT_KEYS } from '../types'

export interface ApcaPair {
  fg: string
  bg_path: string
  tier: string
  output: OutputKey
  measured: number
  target: number
  pass: boolean
}

export interface ApcaResult {
  errors: string[]
  warnings: string[]
  pairs: ApcaPair[]
}

const APCA_TOLERANCE = 1.0

/**
 * Tiers that must pass strictly (errors). Other tiers produce warnings.
 */
const STRICT_TIERS = new Set([
  'primary',
  'secondary',
  'border_strong',
])

export function validateApca(
  _primitive: PrimitiveColorSet,
  semantic: SemanticColorSet,
): ApcaResult {
  const errors: string[] = []
  const warnings: string[] = []
  const pairs: ApcaPair[] = []

  for (const token of semantic.tokens) {
    if (!token.diagnostic) continue
    const d = token.diagnostic

    for (const output of OUTPUT_KEYS) {
      const measured = d.measured_apca[output]
      const target = d.target_apca[output]
      const pass = measured + APCA_TOLERANCE >= target

      const pair: ApcaPair = {
        fg: token.name,
        bg_path: d.bg_path,
        tier: d.tier,
        output,
        measured: Math.round(measured * 10) / 10,
        target,
        pass,
      }
      pairs.push(pair)

      if (!pass) {
        const msg = formatApcaFail(pair, token.path)
        if (STRICT_TIERS.has(d.tier)) errors.push(msg)
        else warnings.push(msg)
      }
    }
  }

  return { errors, warnings, pairs }
}

function formatApcaFail(pair: ApcaPair, path: string): string {
  return [
    `APCA ${pair.tier} FAIL: ${pair.fg} (${path}) on ${pair.bg_path}`,
    `  output: ${pair.output}`,
    `  measured |Lc|=${pair.measured.toFixed(1)} < target ${pair.target}`,
    `  plan refs: §5.1 tier_targets, §4.2 accent spines`,
    `  fix: adjust spine for primitive OR tier_targets.${pair.tier}.${pair.output.split('/')[1]}`,
  ].join('\n')
}
