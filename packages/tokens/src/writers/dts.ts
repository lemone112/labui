/**
 * TypeScript declaration writer — produces `dist/index.d.ts`.
 *
 * Emits `export declare const <name>: string` for every token so that
 * consumers get autocomplete + compile-time checking.
 */

import type { PrimitiveColorSet, SemanticColorSet } from '../types'

export function writeDTS(
  primitive: PrimitiveColorSet,
  semantic: SemanticColorSet,
): string {
  const lines: string[] = [
    '// Lab UI — generated type declarations. DO NOT EDIT.\n',
  ]

  // Opacity
  for (const stop of primitive.opacityStops) {
    lines.push(`export declare const ${camelCase(`opacity-${stop}`)}: string;`)
  }
  lines.push('')

  // Primitives + opacity ladder
  const allPrimitives = [
    ...primitive.statics,
    ...primitive.neutrals,
    ...primitive.accents,
  ]
  for (const solid of allPrimitives) {
    lines.push(`export declare const ${camelCase(solid.name)}: string;`)
    for (const stop of primitive.opacityStops) {
      lines.push(`export declare const ${camelCase(`${solid.name}-a${stop}`)}: string;`)
    }
  }
  lines.push('')

  // Semantic tokens
  for (const token of semantic.tokens) {
    lines.push(`export declare const ${camelCase(token.name)}: string;`)
  }
  lines.push('')

  return lines.join('\n')
}

function camelCase(s: string): string {
  return s.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase())
}
