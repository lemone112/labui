/**
 * Layer 1 — Units generator.
 *
 * @governs plan-v2 §2 · Layer 1 Units
 *
 * Produces the integer-index unit scale. Values are stored as raw px
 * numbers; the CSS writer converts to rem at emit time (see
 * writers/dimensions.ts — `toRem`).
 *
 * Previous revisions also emitted a half-pixel `pt` family. Dropped —
 * `rem` natively supports sub-pixel precision without a parallel scale.
 */

import type { ResolvedUnits, UnitsConfig } from '../types'

/**
 * Compute unit(n) = round(n * base_px * scaling).
 * For integer-safe output at any recommended scaling, `base_px * scaling`
 * must itself be integer (enforced by validator — see plan §2.3).
 */
export function unit(n: number, cfg: UnitsConfig): number {
  const raw = n * cfg.base_px * cfg.scaling
  return Math.round(raw)
}

export interface GenerateUnitsResult {
  units: ResolvedUnits
  warnings: string[]
}

export function generateUnits(cfg: UnitsConfig): GenerateUnitsResult {
  const warnings: string[] = []

  const product = cfg.base_px * cfg.scaling
  if (!Number.isFinite(product)) {
    throw new Error(
      `units: base_px * scaling is not finite (${cfg.base_px} × ${cfg.scaling}).`,
    )
  }
  if (Math.abs(product - Math.round(product)) > 1e-6) {
    warnings.push(
      `units: base_px (${cfg.base_px}) × scaling (${cfg.scaling}) = ${product.toFixed(4)} ` +
        `— not integer. Sub-pixel rendering may drift. Consider scaling ∈ {0.75, 1.0, 1.25}.`,
    )
  }

  const values: Record<string, number> = {}
  for (let n = cfg.range.min; n <= cfg.range.max; n++) {
    values[`unit/${n}`] = unit(n, cfg)
  }

  return { units: { values }, warnings }
}
