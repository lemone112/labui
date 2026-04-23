/**
 * Layer 1 — Units generator.
 *
 * @governs plan-v2 §2 · Layer 1 Units
 *
 * Produces px-N (integer pixel grid) and pt-N (half-pixel) value maps.
 * Values are raw numbers — CSS unit suffix is appended at emit time.
 */

import type { ResolvedUnits, UnitsConfig } from '../types'

/**
 * Compute px(n) = round(n * base_px * scaling).
 * For integer-safe output at any recommended scaling, base_px * scaling
 * should itself be integer (enforced by validator).
 */
export function px(n: number, cfg: UnitsConfig): number {
  const raw = n * cfg.base_px * cfg.scaling
  return Math.round(raw)
}

/**
 * Compute pt(n) = n * base_px * scaling / 2, kept to 0.5 precision.
 */
export function pt(n: number, cfg: UnitsConfig): number {
  const raw = (n * cfg.base_px * cfg.scaling) / 2
  // Snap to 0.5 precision to keep subpixel rendering predictable.
  return Math.round(raw * 2) / 2
}

export interface GenerateUnitsResult {
  units: ResolvedUnits
  warnings: string[]
}

export function generateUnits(cfg: UnitsConfig): GenerateUnitsResult {
  const warnings: string[] = []

  // Integer-safety check at base_px * scaling
  const product = cfg.base_px * cfg.scaling
  if (!Number.isFinite(product)) {
    throw new Error(
      `units: base_px * scaling is not finite (${cfg.base_px} × ${cfg.scaling}).`,
    )
  }
  if (Math.abs(product - Math.round(product)) > 1e-6) {
    warnings.push(
      `units: base_px (${cfg.base_px}) × scaling (${cfg.scaling}) = ${product.toFixed(4)} ` +
        `— not integer. px values are still rounded to integers, but the grid ` +
        `drifts from a regular N·base_px step. Plan §2.3 presets: ` +
        `{0.75, 1.0, 1.166, 1.333} (rounded-grid) or {0.75, 1.0, 1.25} (strict-grid).`,
    )
  }

  const pxMap: Record<string, number> = {}
  const ptMap: Record<string, number> = {}

  for (let n = cfg.px_range.min; n <= cfg.px_range.max; n++) {
    pxMap[`px/${n}`] = px(n, cfg)
  }

  // Fractional pt support (pt/0.5 etc.) — iterate half-integers too
  for (let n2 = cfg.pt_range.min * 2; n2 <= cfg.pt_range.max * 2; n2++) {
    const n = n2 / 2
    ptMap[`pt/${n}`] = pt(n, cfg)
  }

  return { units: { px: pxMap, pt: ptMap }, warnings }
}
