/**
 * TypeScript declaration writer — produces `dist/index.d.ts`.
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

export function writeDTS(
  primitive: PrimitiveColorSet,
  semantic: SemanticColorSet,
  units?: ResolvedUnits,
  dimensions?: ResolvedDimensions,
  typography?: ResolvedTypography,
  zIndex?: ResolvedZIndex,
  materials?: ResolvedMaterials,
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

  if (units) {
    for (const name of Object.keys(units.values)) {
      lines.push(`export declare const ${camelCase(name.replace(/\//g, '-'))}: string;`)
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
        lines.push(`export declare const ${camelCase(slug)}: string;`)
      }
    }
    lines.push('')

    // Concentric-radius helpers (see plan §3.4 / §3.5, writers/esm.ts).
    lines.push('export declare function innerOf(outer: string, padding: string): string;')
    lines.push('export declare function outerOf(inner: string, padding: string): string;')
    lines.push('')
  }

  if (typography) {
    lines.push(`export declare const fontFamily: string;`)
    lines.push(`export declare const fontFamilyMono: string;`)
    for (const key of TYPOGRAPHY_KEYS) {
      lines.push(`export declare const ${camelCase(`font-size-${key}`)}: string;`)
      lines.push(`export declare const ${camelCase(`lh-body-${key}`)}: string;`)
      lines.push(`export declare const ${camelCase(`lh-headline-${key}`)}: string;`)
      lines.push(`export declare const ${camelCase(`tracking-${key}`)}: string;`)
    }
    for (const name of Object.keys(typography.semantics)) {
      lines.push(`export declare const ${camelCase(`text-${name}`)}: string;`)
    }
    lines.push('')
  }

  if (zIndex) {
    for (const name of Object.keys(zIndex)) {
      lines.push(`export declare const ${camelCase(`z-${name}`)}: string;`)
    }
    lines.push('')
  }

  if (materials) {
    for (const level of materials.levels) {
      lines.push(`export declare const ${camelCase(`materials-${level.name}-bg`)}: string;`)
      lines.push(`export declare const ${camelCase(`materials-${level.name}-filter`)}: string;`)
      lines.push(`export declare const ${camelCase(`materials-${level.name}-backdrop-filter`)}: string;`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

function camelCase(s: string): string {
  return s.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase())
}
