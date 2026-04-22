/**
 * CSS custom-properties writer.
 *
 * Emits a single `tokens.css` containing:
 * 1. Opacity utility variables (mode-invariant)
 * 2. Static primitives (mode-invariant)
 * 3. Per-mode blocks for neutral + accent primitives AND semantic tokens
 * 4. `@media (prefers-color-scheme: dark)` auto-switch
 *
 * Structure per §6 of the spec. :root → light (default), selectors for
 * dark / light-ic / dark-ic.
 */

import type { Mode, OklchValue, PrimitiveColorSet, PrimitiveSolid, SemanticColorSet, ResolvedTokenValue } from '../types'
import { formatOklchCss } from '../utils/oklch'

const HEADER = '/* Lab UI — generated design tokens. DO NOT EDIT. */\n'

export function writeCSS(
  primitive: PrimitiveColorSet,
  semantic: SemanticColorSet,
): string {
  const lines: string[] = [HEADER]

  // Build group → CSS name lookup for cross-semantic refs.
  const groupToName = new Map<string, string>()
  for (const t of semantic.tokens) groupToName.set(t.group, t.name)

  // ─── 1. Opacity utility variables ─────────────────────────────────
  lines.push(':root {')
  for (const stop of primitive.opacityStops) {
    lines.push(`  --opacity-${stop}: ${(stop / 100).toFixed(2)};`)
  }
  lines.push('}\n')

  // ─── 2. Static primitives (mode-invariant) ────────────────────────
  lines.push(':root {')
  for (const s of primitive.statics) {
    const v = s.values.light // same across all modes
    writeSolid(lines, s.name, v)
    writeOpacityLadder(lines, s.name, v, primitive.opacityStops)
  }
  lines.push('}\n')

  // ─── 3. Light mode (default) ──────────────────────────────────────
  lines.push(':root {')
  writePrimitivesForMode(lines, 'light', primitive)
  writeSemanticsForMode(lines, 'light', semantic, '  ', groupToName)
  lines.push('}\n')

  // ─── 4. Dark mode — media query auto-switch ──────────────────────
  lines.push('@media (prefers-color-scheme: dark) {')
  lines.push('  :root:not([data-mode]) {')
  writePrimitivesForMode(lines, 'dark', primitive, '    ')
  writeSemanticsForMode(lines, 'dark', semantic, '    ', groupToName)
  lines.push('  }')
  lines.push('}\n')

  // ─── 5. Explicit data-mode selectors ──────────────────────────────
  for (const mode of ['dark', 'light_ic', 'dark_ic'] as const) {
    const selector = `[data-mode="${mode.replace(/_/g, '-')}"]`
    lines.push(`${selector} {`)
    writePrimitivesForMode(lines, mode, primitive)
    writeSemanticsForMode(lines, mode, semantic, '  ', groupToName)
    lines.push('}\n')
  }

  return lines.join('\n')
}

// ─── Internals ──────────────────────────────────────────────────────────

function writePrimitivesForMode(
  lines: string[],
  mode: Mode,
  primitive: PrimitiveColorSet,
  indent = '  ',
): void {
  const groups = [primitive.neutrals, primitive.accents]
  for (const group of groups) {
    for (const solid of group) {
      const v = solid.values[mode]
      writeSolid(lines, solid.name, v, indent)
      writeOpacityLadder(lines, solid.name, v, primitive.opacityStops, indent)
    }
  }
}

function writeSemanticsForMode(
  lines: string[],
  mode: Mode,
  semantic: SemanticColorSet,
  indent = '  ',
  groupToName?: Map<string, string>,
): void {
  for (const token of semantic.tokens) {
    const value = token.values[mode]
    lines.push(`${indent}--${token.name}: ${renderResolvedValue(value, groupToName)};`)
  }
}

function writeSolid(lines: string[], name: string, v: OklchValue, indent = '  '): void {
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
    lines.push(`${indent}--${name}-a${stop}: ${formatOklchCss(v, stop / 100)};`)
  }
}

function renderResolvedValue(
  value: ResolvedTokenValue,
  groupToName?: Map<string, string>,
): string {
  if (value.kind === 'semantic-ref') {
    const mapped = groupToName?.get(value.target)
    if (!mapped) {
      throw new Error(`css: unresolved semantic-ref target '${value.target}'`)
    }
    return `var(--${mapped})`
  }
  if (value.alpha !== undefined && value.alpha < 1) {
    return `var(--${value.primitive}-a${Math.round(value.alpha * 100)})`
  }
  return `var(--${value.primitive})`
}
