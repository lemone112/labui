/**
 * TypeScript declaration writer — produces `dist/index.d.ts`.
 */

import type { PrimitiveColorSet, SemanticColorSet } from '../types'

export function writeDTS(
  primitive: PrimitiveColorSet,
  semantic: SemanticColorSet,
): string {
  const lines: string[] = ['// Lab UI — generated type declarations. DO NOT EDIT.\n']

  for (const stop of primitive.opacityStops) {
    lines.push(`export declare const ${camelCase(`opacity-${stop}`)}: string;`)
  }
  lines.push('')

  const all = [...primitive.statics, ...primitive.neutrals, ...primitive.accents]
  for (const solid of all) {
    lines.push(`export declare const ${camelCase(solid.name)}: string;`)
    for (const stop of primitive.opacityStops) {
      lines.push(`export declare const ${camelCase(`${solid.name}-a${stop}`)}: string;`)
    }
  }
  lines.push('')

  for (const token of semantic.tokens) {
    lines.push(`export declare const ${camelCase(token.name)}: string;`)
  }
  for (const preset of semantic.shadow_presets) {
    lines.push(`export declare const ${camelCase(`fx-shadow-${preset.name}`)}: string;`)
  }
  lines.push('')

  return lines.join('\n')
}

function camelCase(s: string): string {
  return s.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase())
}
