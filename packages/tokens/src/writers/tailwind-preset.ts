/**
 * Tailwind v4 preset writer — produces `dist/tailwind-preset.css`.
 *
 * The preset is a single `@theme` block mapping the Lab UI token
 * namespaces onto Tailwind v4's utility naming conventions:
 *
 *   `--brand`, `--red`, …                          → `--color-*`
 *   `--bg-primary`, `--label-*`, `--fill-*`, …     → `--color-*`
 *   `--fx-shadow-{minor,ambient,…}`                → `--shadow-*`
 *   `--unit-1` (as the dynamic base)               → `--spacing`
 *   `--radius-{min,base,max,full}`                 → `--radius-{sm,md,lg,full}`
 *   `--font-size-*`                                → `--text-*`
 *   `--font-family`, `--font-family-mono`          → `--font-{sans,mono}`
 *   `--blur-*`                                     → `--blur-*`
 *
 * Consumers use it like:
 *
 *   @import "tailwindcss";
 *   @import "@lab-ui/tokens/tailwind";
 *   @import "@lab-ui/tokens/css";   // the actual variable values
 *
 * Everything is `var(--…)` pass-through — no values are duplicated.
 * When a token value changes the preset automatically picks it up.
 */

import type {
  PrimitiveColorSet,
  ResolvedDimensions,
  ResolvedTypography,
  SemanticColorSet,
} from '../types'

export function writeTailwindPreset(
  primitive: PrimitiveColorSet,
  semantic: SemanticColorSet,
  dimensions: ResolvedDimensions,
  typography: ResolvedTypography,
): string {
  const lines: string[] = [
    '/* Lab UI — generated Tailwind v4 preset. DO NOT EDIT. */',
    '',
    '@theme {',
  ]

  lines.push('  /* Colors — primitive hues */')
  const solids = [...primitive.statics, ...primitive.neutrals, ...primitive.accents]
  for (const solid of solids) {
    lines.push(`  --color-${solid.name}: var(--${solid.name});`)
    for (const stop of primitive.opacityStops) {
      lines.push(`  --color-${solid.name}-a${stop}: var(--${solid.name}-a${stop});`)
    }
  }
  lines.push('')

  lines.push('  /* Colors — semantic roles */')
  for (const token of semantic.tokens) {
    lines.push(`  --color-${token.name}: var(--${token.name});`)
  }
  lines.push('')

  lines.push('  /* Spacing — base increment (p-1, m-2, gap-3, …) */')
  lines.push('  --spacing: var(--unit-1);')
  lines.push('')

  lines.push('  /* Radius — named rungs */')
  const radiusKeys = Object.keys(dimensions.radius)
  const hasRadius = (key: string): boolean => radiusKeys.includes(key)
  if (hasRadius('none')) lines.push('  --radius-none: var(--radius-none);')
  if (hasRadius('min')) lines.push('  --radius-sm: var(--radius-min);')
  if (hasRadius('base')) lines.push('  --radius-md: var(--radius-base);')
  if (hasRadius('max')) lines.push('  --radius-lg: var(--radius-max);')
  if (hasRadius('full')) lines.push('  --radius-full: var(--radius-full);')
  lines.push('')

  lines.push('  /* Shadows — from semantic shadow primitives */')
  const shadowMap: ReadonlyArray<readonly [string, string]> = [
    ['minor', 'xs'],
    ['ambient', 'sm'],
    ['penumbra', 'md'],
    ['major', 'lg'],
  ]
  const shadowSource = new Set(
    semantic.tokens.map((t) => t.name).filter((n) => n.startsWith('fx-shadow-')),
  )
  for (const [role, tw] of shadowMap) {
    if (shadowSource.has(`fx-shadow-${role}`)) {
      lines.push(`  --shadow-${tw}: var(--fx-shadow-${role});`)
    }
  }
  for (const preset of semantic.shadow_presets) {
    lines.push(`  --shadow-preset-${preset.name}: var(--fx-shadow-${preset.name});`)
  }
  lines.push('')

  lines.push('  /* Blur — named rungs */')
  for (const name of Object.keys(dimensions.fx_blur)) {
    lines.push(`  --blur-${name}: var(--blur-${name});`)
  }
  lines.push('')

  lines.push('  /* Typography — family + size */')
  lines.push('  --font-sans: var(--font-family);')
  lines.push('  --font-mono: var(--font-family-mono);')
  for (const key of Object.keys(typography.size)) {
    lines.push(`  --text-${key}: var(--font-size-${key});`)
  }
  lines.push('')

  lines.push('}')
  lines.push('')

  return lines.join('\n')
}
