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

/**
 * Concentric radius helpers (plan §3.4). Both are pure string formatters
 * producing CSS expressions for nested geometries. Reused in the ESM
 * barrel via `.toString()` so there is a single source of truth.
 *
 * Floor is always `--radius-min` (never 0) so nested elements can't go
 * sharp in a soft system. Ceiling is always `--radius-max` (never
 * `--radius-full`) so the pill sentinel is only ever opt-in.
 */
export function innerOf(outer: string, padding: string): string {
  return `clamp(var(--radius-min), calc(${outer} - ${padding}), var(--radius-max))`
}
export function outerOf(inner: string, padding: string): string {
  return `min(var(--radius-max), calc(${inner} + ${padding}))`
}

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
    for (const name of Object.keys(units.values)) {
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

    // Concentric-radius helpers (plan §3.4 / §3.5). Emitted via
    // `.toString()` from the real exported functions above so the ESM
    // barrel and the test-facing module share a single source of truth.
    lines.push(`export ${innerOf.toString()}`)
    lines.push(`export ${outerOf.toString()}`)
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
  // A `--N` run in the slug is always a negative unit index (CSS var
  // `--unit--N` → slug `unit--N`). Rewrite as `-negN` so the JS
  // identifier stays unique and valid (otherwise `unit/-7` and
  // `unit/7` both camelCase to `unit7` and the export statement
  // becomes `export const unit-7 = …`, which is invalid JS).
  return s
    .replace(/--(\d)/g, '-neg$1')
    .replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase())
}
