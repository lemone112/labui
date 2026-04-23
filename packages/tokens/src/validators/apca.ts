/**
 * APCA + WCAG contrast validator (v2) — tier-aware.
 *
 * @governs implementation-plan-v2.md §5.1 / §5.3.2 · Tier targets · §9 · Invariants
 * @governs test-strategy.md §L4.4 (APCA) · §L4.5 (WCAG floor)
 *
 * For every semantic with a pipeline-based definition we verify two
 * things per output key:
 *   1. APCA |Lc| meets `tier_targets[tier][contrast].apca`
 *   2. WCAG 2.x ratio meets `tier_targets[tier][contrast].wcag` (when
 *      declared — only label tiers carry a WCAG floor)
 *
 * Pipeline tokens have `diagnostic.measured_apca` and
 * `diagnostic.measured_wcag` attached by the generator. Failures on
 * strict tiers (primary, secondary, border_strong) are errors; all
 * others are warnings.
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

export interface WcagPair {
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
  wcag_pairs: WcagPair[]
}

const APCA_TOLERANCE = 1.0
/** WCAG ratios are dimensionless (1..21). 0.05 is below our search
 *  tolerance (0.01) plus gamut rounding error headroom. */
const WCAG_TOLERANCE = 0.05

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
  const wcag_pairs: WcagPair[] = []

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

      if (d.target_wcag && d.measured_wcag) {
        const w_measured = d.measured_wcag[output]
        const w_target = d.target_wcag[output]
        const w_pass = w_measured + WCAG_TOLERANCE >= w_target

        const w_pair: WcagPair = {
          fg: token.name,
          bg_path: d.bg_path,
          tier: d.tier,
          output,
          measured: Math.round(w_measured * 100) / 100,
          target: w_target,
          pass: w_pass,
        }
        wcag_pairs.push(w_pair)

        if (!w_pass) {
          const msg = formatWcagFail(w_pair, token.path)
          if (STRICT_TIERS.has(d.tier)) errors.push(msg)
          else warnings.push(msg)
        }
      }
    }
  }

  return { errors, warnings, pairs, wcag_pairs }
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

function formatWcagFail(pair: WcagPair, path: string): string {
  return [
    `WCAG ${pair.tier} FAIL: ${pair.fg} (${path}) on ${pair.bg_path}`,
    `  output: ${pair.output}`,
    `  measured ratio=${pair.measured.toFixed(2)}:1 < target ${pair.target.toFixed(2)}:1`,
    `  plan refs: §5.3.2 tier_targets.wcag, §L4.5 WCAG ratio`,
    `  fix: adjust spine OR tier_targets.${pair.tier}.${pair.output.split('/')[1]}.wcag`,
  ].join('\n')
}
