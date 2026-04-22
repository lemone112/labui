/**
 * Gamut validator — spec §4.2 / §12.1.
 *
 * Checks that every generated OKLCH primitive fits inside the target gamut
 * (Display-P3 by default). If not, the validator reports an error. The
 * generator already clamps, so errors here should never happen — they
 * indicate a regression in the clamping logic.
 */

import type { PrimitiveColorSet, Mode } from '../types'
import { MODES } from '../types'
import { isInP3Gamut, isInSrgbGamut } from '../utils/oklch'

export interface GamutResult {
  errors: string[]
  warnings: string[]
}

export function validateGamut(
  primitive: PrimitiveColorSet,
  gamut: 'p3' | 'srgb',
): GamutResult {
  const errors: string[] = []
  const warnings: string[] = []
  const check = gamut === 'p3' ? isInP3Gamut : isInSrgbGamut

  for (const group of [primitive.neutrals, primitive.accents, primitive.statics]) {
    for (const solid of group) {
      for (const mode of MODES) {
        const v = solid.values[mode]
        if (!check(v)) {
          errors.push(
            `${solid.name} (${mode}): OKLCH(${v.L}, ${v.C}, ${v.H}) outside ${gamut} gamut`,
          )
        }
      }
    }
  }

  return { errors, warnings }
}
