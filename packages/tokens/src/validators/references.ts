/**
 * Reference integrity validator.
 *
 * Checks that every semantic token's resolved value points at a primitive
 * that actually exists, and that cross-semantic refs have a matching target.
 */

import type { Mode, PrimitiveColorSet, SemanticColorSet } from '../types'
import { MODES } from '../types'

export interface RefResult {
  errors: string[]
}

export function validateReferences(
  primitive: PrimitiveColorSet,
  semantic: SemanticColorSet,
): RefResult {
  const errors: string[] = []

  // Build set of all primitive names
  const primNames = new Set<string>()
  for (const group of [primitive.neutrals, primitive.accents, primitive.statics]) {
    for (const solid of group) {
      primNames.add(solid.name)
    }
  }

  // Build group → token-name map for cross-semantic ref resolution.
  // Cross-refs in the config use dot-paths (e.g. `background.neutral.primary`)
  // that correspond to a token's `group` field, not its CSS variable name.
  const byGroup = new Map<string, string>()
  for (const token of semantic.tokens) {
    byGroup.set(token.group, token.name)
  }

  for (const token of semantic.tokens) {
    for (const mode of MODES) {
      const value = token.values[mode]

      if (value.kind === 'primitive') {
        if (!primNames.has(value.primitive)) {
          errors.push(
            `${token.name} (${mode}): references unknown primitive '${value.primitive}'`,
          )
        }
      }

      if (value.kind === 'semantic-ref') {
        if (!byGroup.has(value.target)) {
          errors.push(
            `${token.name} (${mode}): cross-semantic ref '${value.target}' does not match any semantic token group`,
          )
        }
      }
    }
  }

  return { errors }
}
