/**
 * CSS custom-properties writer (v2).
 *
 * @governs implementation-plan-v2.md §6 · Emit layer
 *
 * Emits a single `tokens.css` containing:
 *   1. Opacity utility variables (mode-invariant)
 *   2. Static primitives + opacity ladder (mode-invariant)
 *   3. Four mode × contrast blocks (light/normal, light/ic, dark/normal, dark/ic)
 *      each containing all primitives and semantics
 *   4. `@media (prefers-color-scheme: dark)` auto-switch for normal contrast
 *
 * Selector scheme:
 *   :root                                                → light/normal (default)
 *   :root[data-contrast="ic"]                            → light/ic
 *   :root[data-mode="dark"]                              → dark/normal
 *   :root[data-mode="dark"][data-contrast="ic"]          → dark/ic
 *   @media (prefers-color-scheme: dark) :root:not([data-mode])  → dark/normal
 */

import type {
  BaseMode,
  Contrast,
  OklchValue,
  OklchWithAlpha,
  OutputKey,
  PrimitiveColorSet,
  ResolvedPrimitive,
  ResolvedSemantic,
  SemanticColorSet,
  ShadowPreset,
} from '../types'
import { BASE_MODES, CONTRASTS, outputKey } from '../types'
import { formatOklchCss } from '../utils/oklch'

const HEADER = '/* Lab UI — generated design tokens. DO NOT EDIT. */\n'

export function writeCSS(
  primitive: PrimitiveColorSet,
  semantic: SemanticColorSet,
): string {
  const lines: string[] = [HEADER]

  // 1. Opacity utility variables (mode-invariant)
  lines.push(':root {')
  for (const stop of primitive.opacityStops) {
    lines.push(`  --opacity-${stop}: ${(stop / 100).toFixed(2)};`)
  }
  lines.push('}\n')

  // 2. Statics (mode-invariant; use 'light/normal' since they're flat)
  lines.push(':root {')
  for (const s of primitive.statics) {
    const v = s.values[outputKey('light', 'normal')]
    writeSolid(lines, s.name, v)
    writeOpacityLadder(lines, s.name, v, primitive.opacityStops)
  }
  lines.push('}\n')

  // 3. Four mode × contrast blocks
  for (const mode of BASE_MODES) {
    for (const contrast of CONTRASTS) {
      const selector = selectorFor(mode, contrast)
      lines.push(`${selector} {`)
      writePrimitivesForOutput(lines, mode, contrast, primitive)
      writeSemanticsForOutput(lines, mode, contrast, semantic)
      writeShadowPresets(lines, semantic.shadow_presets)
      lines.push('}\n')
    }
  }

  // 4. Auto-switch via prefers-color-scheme for normal contrast
  lines.push('@media (prefers-color-scheme: dark) {')
  lines.push('  :root:not([data-mode]) {')
  writePrimitivesForOutput(lines, 'dark', 'normal', primitive, '    ')
  writeSemanticsForOutput(lines, 'dark', 'normal', semantic, '    ')
  writeShadowPresets(lines, semantic.shadow_presets, '    ')
  lines.push('  }')
  lines.push('}\n')

  return lines.join('\n')
}

// ─── Selector ──────────────────────────────────────────────────────────

function selectorFor(mode: BaseMode, contrast: Contrast): string {
  if (mode === 'light' && contrast === 'normal') return ':root'
  if (mode === 'light' && contrast === 'ic')
    return ':root[data-contrast="ic"]:not([data-mode="dark"])'
  if (mode === 'dark' && contrast === 'normal')
    return ':root[data-mode="dark"]:not([data-contrast="ic"])'
  return ':root[data-mode="dark"][data-contrast="ic"]'
}

// ─── Helpers ───────────────────────────────────────────────────────────

function writePrimitivesForOutput(
  lines: string[],
  mode: BaseMode,
  contrast: Contrast,
  primitive: PrimitiveColorSet,
  indent = '  ',
): void {
  const key = outputKey(mode, contrast)
  const groups: ResolvedPrimitive[][] = [primitive.neutrals, primitive.accents]
  for (const group of groups) {
    for (const solid of group) {
      const v = solid.values[key]
      writeSolid(lines, solid.name, v, indent)
      writeOpacityLadder(lines, solid.name, v, primitive.opacityStops, indent)
    }
  }
}

function writeSemanticsForOutput(
  lines: string[],
  mode: BaseMode,
  contrast: Contrast,
  semantic: SemanticColorSet,
  indent = '  ',
): void {
  const key = outputKey(mode, contrast)
  for (const token of semantic.tokens) {
    const value = token.values[key]
    lines.push(
      `${indent}--${token.name}: ${formatOklchAlphaCss(value)};`,
    )
  }
}

function writeSolid(
  lines: string[],
  name: string,
  v: OklchValue,
  indent = '  ',
): void {
  lines.push(`${indent}--${name}: ${formatOklchCss(v)};`)
}

function writeOpacityLadder(
  lines: string[],
  name: string,
  v: OklchValue,
  stops: readonly number[],
  indent = '  ',
): void {
  for (const stop of stops) {
    lines.push(
      `${indent}--${name}-a${stop}: ${formatOklchCss(v, stop / 100)};`,
    )
  }
}

function writeShadowPresets(
  lines: string[],
  presets: ShadowPreset[],
  indent = '  ',
): void {
  for (const preset of presets) {
    const layers = preset.layers
      .map(
        (l) =>
          `0px ${l.y}px ${l.blur}px ${l.spread}px var(${l.tint_var})`,
      )
      .join(', ')
    lines.push(`${indent}--fx-shadow-${preset.name}: ${layers};`)
  }
}

function formatOklchAlphaCss(v: OklchWithAlpha): string {
  if (v.alpha >= 1) {
    return formatOklchCss({ L: v.L, C: v.C, H: v.H })
  }
  return formatOklchCss({ L: v.L, C: v.C, H: v.H }, v.alpha)
}
