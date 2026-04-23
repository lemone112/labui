/**
 * Layer 6 — Z-index generator.
 *
 * @governs plan-v2 §7 · Layer 6 Z-index
 *
 * Pure passthrough with validation: integers only, strictly ascending
 * per the declaration order is NOT required (grouped_* and dropdown etc.
 * may interleave), but each name must be a finite integer.
 */

import type { ResolvedZIndex, ZIndexConfig } from '../types'

export interface GenerateZIndexResult {
  z_index: ResolvedZIndex
  warnings: string[]
}

export function generateZIndex(cfg: ZIndexConfig): GenerateZIndexResult {
  const warnings: string[] = []
  const out: ResolvedZIndex = {}

  for (const [name, value] of Object.entries(cfg)) {
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      warnings.push(
        `z_index.${name}=${value} is not a finite integer. ` +
          `Browsers implementation-define non-integer z-index — keep values integer.`,
      )
      continue
    }
    out[name] = value
  }

  return { z_index: out, warnings }
}
