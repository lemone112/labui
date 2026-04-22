/**
 * Reference integrity validator (v2).
 *
 * In the v2 model, semantics don't carry ref strings — they carry resolved
 * OKLCH values directly. This validator verifies:
 *   - Every semantic has a value for every OutputKey
 *   - No NaN / Infinity values
 *   - L ∈ [0, 1]; C ≥ 0; H ∈ [0, 360); alpha ∈ [0, 1]
 */

import type { PrimitiveColorSet, SemanticColorSet } from '../types'
import { OUTPUT_KEYS } from '../types'

export interface RefResult {
  errors: string[]
}

export function validateReferences(
  _primitive: PrimitiveColorSet,
  semantic: SemanticColorSet,
): RefResult {
  const errors: string[] = []

  for (const token of semantic.tokens) {
    for (const output of OUTPUT_KEYS) {
      const v = token.values[output]
      if (!v) {
        errors.push(`${token.name}: missing value for output '${output}'`)
        continue
      }
      if (!Number.isFinite(v.L) || v.L < 0 || v.L > 1) {
        errors.push(`${token.name} (${output}): invalid L=${v.L}`)
      }
      if (!Number.isFinite(v.C) || v.C < 0) {
        errors.push(`${token.name} (${output}): invalid C=${v.C}`)
      }
      if (!Number.isFinite(v.H) || v.H < 0 || v.H >= 360) {
        errors.push(`${token.name} (${output}): invalid H=${v.H}`)
      }
      if (!Number.isFinite(v.alpha) || v.alpha < 0 || v.alpha > 1) {
        errors.push(`${token.name} (${output}): invalid alpha=${v.alpha}`)
      }
    }
  }

  return { errors }
}
