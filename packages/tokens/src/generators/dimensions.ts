/**
 * Layer 2 — Dimensions generator.
 *
 * @governs plan-v2 §3 · Layer 2 Dimensions
 *
 * Resolves semantic name → px value via step-maps + airiness shift.
 * Each family (spacing_padding, radius, …) maps semantic name to a
 * **unit-step index**. Airiness multiplies that index via log2 shift.
 */

import type {
  DimensionsConfig,
  ResolvedDimensions,
  StepMap,
  UnitsConfig,
} from '../types'

/**
 * Airiness shift — maps base step to adjusted step.
 * a=1.0 → shift=0 (identity). a=1.25 → shift≈+0.32·step.
 *
 * Larger semantic steps move more than compact ones — `log2` gives a
 * multiplicative feel so xs+1 and xl+1 aren't equally weighted.
 */
export function applyAiriness(baseStep: number, airiness: number): number {
  if (airiness <= 0) return baseStep
  const factor = Math.log2(airiness)
  return baseStep + factor * baseStep
}

/**
 * Resolve a single step-map to its px values via airiness + lookup.
 * Negative base_step may appear in spacing_margin.
 */
function resolveStepMap(
  map: StepMap,
  airiness: number,
  units: UnitsConfig,
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [name, baseStep] of Object.entries(map)) {
    if (baseStep === 9999) {
      out[name] = 9999 // full-radius sentinel
      continue
    }
    const shifted = applyAiriness(baseStep, airiness)
    // Compute px directly from (possibly fractional) step index so
    // radius.xxs=0.5 etc. work without requiring fractional pre-generation.
    const raw = shifted * units.base_px * units.scaling
    // Round to 1 decimal to avoid binary float noise (e.g. 0.5 + airiness).
    out[name] = Math.round(raw * 10) / 10
  }
  return out
}

export interface GenerateDimensionsResult {
  dimensions: ResolvedDimensions
  warnings: string[]
}

export function generateDimensions(
  cfg: DimensionsConfig,
  units: UnitsConfig,
): GenerateDimensionsResult {
  const warnings: string[] = []
  const a = cfg.airiness

  const dims: ResolvedDimensions = {
    adaptives: resolveStepMap(cfg.adaptives, a, units),
    spacing_padding: resolveStepMap(cfg.spacing_padding, a, units),
    spacing_margin: resolveStepMap(cfg.spacing_margin, a, units),
    radius: resolveStepMap(cfg.radius, a, units),
    size: resolveStepMap(cfg.size, a, units),
    fx_blur: resolveStepMap(cfg.fx_blur, a, units),
    fx_shift: resolveStepMap(cfg.fx_shift, a, units),
    fx_spread: resolveStepMap(cfg.fx_spread, a, units),
  }

  return { dimensions: dims, warnings }
}
