/**
 * ESM barrel writer — produces `dist/index.js`.
 *
 * Every token is exported as its CSS variable name (camelCased) pointing
 * to the `var(--…)` string. This is framework-agnostic and allows:
 *
 * ```ts
 * import { labelBrandPrimary } from '@lab-ui/tokens'
 * el.style.color = labelBrandPrimary // 'var(--label-brand-primary)'
 * ```
 *
 * Tree-shakable thanks to named exports.
 */

import type { PrimitiveColorSet, SemanticColorSet } from '../types'

export function writeESM(
  primitive: PrimitiveColorSet,
  semantic: SemanticColorSet,
): string {
  const lines: string[] = [
    '// Lab UI — generated ESM token barrel. DO NOT EDIT.\n',
  ]

  // Opacity variables
  for (const stop of primitive.opacityStops) {
    const name = camelCase(`opacity-${stop}`)
    lines.push(`export const ${name} = 'var(--opacity-${stop})';`)
  }
  lines.push('')

  // Primitives (always reference the CSS var, not a literal — that way
  // they pick up the right mode at runtime via CSS custom properties).
  const allPrimitives = [
    ...primitive.statics,
    ...primitive.neutrals,
    ...primitive.accents,
  ]
  for (const solid of allPrimitives) {
    const name = camelCase(solid.name)
    lines.push(`export const ${name} = 'var(--${solid.name})';`)
    for (const stop of primitive.opacityStops) {
      const alphaName = camelCase(`${solid.name}-a${stop}`)
      lines.push(`export const ${alphaName} = 'var(--${solid.name}-a${stop})';`)
    }
  }
  lines.push('')

  // Semantic tokens
  for (const token of semantic.tokens) {
    const name = camelCase(token.name)
    lines.push(`export const ${name} = 'var(--${token.name})';`)
  }
  lines.push('')

  return lines.join('\n')
}

function camelCase(s: string): string {
  return s.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase())
}
