/**
 * Aggregate validator — runs all individual checks.
 */

import type { PrimitiveColorSet, SemanticColorSet } from '../types'
import { validateApca } from './apca'
import { validateGamut } from './gamut'
import { validateReferences } from './references'

export interface ValidationResult {
  errors: string[]
  warnings: string[]
}

export function validateAll(
  primitive: PrimitiveColorSet,
  semantic: SemanticColorSet,
  gamut: 'p3' | 'srgb' = 'p3',
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  const ref = validateReferences(primitive, semantic)
  errors.push(...ref.errors)

  const g = validateGamut(primitive, gamut)
  errors.push(...g.errors)
  warnings.push(...g.warnings)

  const a = validateApca(primitive, semantic)
  errors.push(...a.errors)
  warnings.push(...a.warnings)

  return { errors, warnings }
}
