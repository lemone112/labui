/**
 * ESM barrel writer — produces `dist/index.js`.
 *
 * Every token is exported as its CSS variable name (camelCased) pointing
 * to the `var(--…)` string. Tree-shakable via named exports.
 */

import type { PrimitiveColorSet, SemanticColorSet } from '../types'

export function writeESM(
  primitive: PrimitiveColorSet,
  semantic: SemanticColorSet,
): string {
  const lines: string[] = ['// Lab UI — generated ESM token barrel. DO NOT EDIT.\n']

  for (const stop of primitive.opacityStops) {
    lines.push(`export const ${camelCase(`opacity-${stop}`)} = 'var(--opacity-${stop})';`)
  }
  lines.push('')

  const all = [...primitive.statics, ...primitive.neutrals, ...primitive.accents]
  for (const solid of all) {
    lines.push(`export const ${camelCase(solid.name)} = 'var(--${solid.name})';`)
    for (const stop of primitive.opacityStops) {
      const n = `${solid.name}-a${stop}`
      lines.push(`export const ${camelCase(n)} = 'var(--${n})';`)
    }
  }
  lines.push('')

  for (const token of semantic.tokens) {
    lines.push(`export const ${camelCase(token.name)} = 'var(--${token.name})';`)
  }
  for (const preset of semantic.shadow_presets) {
    const name = `fx-shadow-${preset.name}`
    lines.push(`export const ${camelCase(name)} = 'var(--${name})';`)
  }
  lines.push('')

  return lines.join('\n')
}

function camelCase(s: string): string {
  return s.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase())
}
