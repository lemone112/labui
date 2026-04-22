/**
 * Gamut validator — verifies all generated OKLCH primitives + semantics
 * fit inside the target gamut.
 *
 * @governs implementation-plan-v2.md §9 · Invariants
 */

import type { OutputKey, PrimitiveColorSet, SemanticColorSet } from '../types'
import { OUTPUT_KEYS } from '../types'
import { isInP3Gamut, isInSrgbGamut } from '../utils/oklch'

export interface GamutResult {
  errors: string[]
  warnings: string[]
}

export function validateGamut(
  primitive: PrimitiveColorSet,
  semantic: SemanticColorSet,
  gamut: 'p3' | 'srgb',
): GamutResult {
  const errors: string[] = []
  const warnings: string[] = []
  const check = gamut === 'p3' ? isInP3Gamut : isInSrgbGamut

  for (const group of [primitive.neutrals, primitive.accents, primitive.statics]) {
    for (const solid of group) {
      for (const output of OUTPUT_KEYS) {
        const v = solid.values[output]
        if (!check(v)) {
          errors.push(
            `${solid.name} (${output}): OKLCH(${v.L}, ${v.C}, ${v.H}) outside ${gamut} gamut`,
          )
        }
      }
    }
  }

  for (const token of semantic.tokens) {
    for (const output of OUTPUT_KEYS) {
      const v = token.values[output]
      if (!check({ L: v.L, C: v.C, H: v.H })) {
        warnings.push(
          `${token.name} (${output}): OKLCH(${v.L}, ${v.C}, ${v.H}) outside ${gamut} gamut`,
        )
      }
    }
  }

  return { errors, warnings }
}
