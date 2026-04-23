/**
 * ESM barrel writer — produces `dist/index.js`.
 *
 * Every token is exported as its CSS variable name (camelCased) pointing
 * to the `var(--…)` string. Tree-shakable via named exports.
 */

import type {
  PrimitiveColorSet,
  ResolvedDimensions,
  ResolvedMaterials,
  ResolvedTypography,
  ResolvedUnits,
  ResolvedZIndex,
  SemanticColorSet,
} from '../types'
import { TYPOGRAPHY_KEYS } from '../generators/typography'

export function writeESM(
  primitive: PrimitiveColorSet,
  semantic: SemanticColorSet,
  units?: ResolvedUnits,
  dimensions?: ResolvedDimensions,
  typography?: ResolvedTypography,
  zIndex?: ResolvedZIndex,
  materials?: ResolvedMaterials,
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

  if (units) {
    for (const name of Object.keys(units.px)) {
      const slug = name.replace(/\//g, '-')
      lines.push(`export const ${camelCase(slug)} = 'var(--${slug})';`)
    }
    for (const name of Object.keys(units.pt)) {
      const slug = name.replace(/\//g, '-')
      lines.push(`export const ${camelCase(slug)} = 'var(--${slug})';`)
    }
    lines.push('')
  }

  if (dimensions) {
    const families: Array<[string, Record<string, number>]> = [
      ['adaptive', dimensions.adaptives],
      ['padding', dimensions.spacing_padding],
      ['margin', dimensions.spacing_margin],
      ['radius', dimensions.radius],
      ['size', dimensions.size],
      ['blur', dimensions.fx_blur],
      ['shift', dimensions.fx_shift],
      ['spread', dimensions.fx_spread],
    ]
    for (const [prefix, map] of families) {
      for (const name of Object.keys(map)) {
        const slug = `${prefix}-${name.replace(/\//g, '-')}`
        lines.push(`export const ${camelCase(slug)} = 'var(--${slug})';`)
      }
    }
    lines.push('')
  }

  if (typography) {
    lines.push(`export const fontFamily = 'var(--font-family)';`)
    lines.push(`export const fontFamilyMono = 'var(--font-family-mono)';`)
    for (const key of TYPOGRAPHY_KEYS) {
      lines.push(`export const ${camelCase(`font-size-${key}`)} = 'var(--font-size-${key})';`)
      lines.push(`export const ${camelCase(`lh-body-${key}`)} = 'var(--lh-body-${key})';`)
      lines.push(`export const ${camelCase(`lh-headline-${key}`)} = 'var(--lh-headline-${key})';`)
      lines.push(`export const ${camelCase(`tracking-${key}`)} = 'var(--tracking-${key})';`)
    }
    for (const name of Object.keys(typography.semantics)) {
      lines.push(`export const ${camelCase(`text-${name}`)} = 'var(--text-${name})';`)
    }
    lines.push('')
  }

  if (zIndex) {
    for (const name of Object.keys(zIndex)) {
      lines.push(`export const ${camelCase(`z-${name}`)} = 'var(--z-${name})';`)
    }
    lines.push('')
  }

  if (materials) {
    for (const level of materials.levels) {
      lines.push(
        `export const ${camelCase(`materials-${level.name}-bg`)} = 'var(--materials-${level.name}-bg)';`,
      )
      lines.push(
        `export const ${camelCase(`materials-${level.name}-filter`)} = 'var(--materials-${level.name}-filter)';`,
      )
      lines.push(
        `export const ${camelCase(`materials-${level.name}-backdrop-filter`)} = 'var(--materials-${level.name}-backdrop-filter)';`,
      )
    }
    lines.push('')
  }

  return lines.join('\n')
}

function camelCase(s: string): string {
  return s.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase())
}
