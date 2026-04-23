/**
 * Tailwind v4 preset writer — produces `dist/tailwind-preset.css`.
 *
 * The preset is a single `@theme` block mapping the Lab UI token
 * namespaces onto Tailwind v4's utility naming conventions:
 *
 *   `--brand`, `--red`, …                          → `--color-*`
 *   `--bg-primary`, `--label-*`, `--fill-*`, …     → `--color-*`
 *   `--fx-shadow-{xs,s,m,l,xl}`                    → `--shadow-{xs,sm,md,lg,xl}`
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
 * The block uses `@theme inline` so Tailwind v4 inlines the `var(--…)`
 * references directly into the generated utility rules rather than
 * emitting redeclared custom properties. This keeps the preset a pure
 * mapping layer — no values are duplicated, no self-referential
 * custom properties are produced (e.g. `--blur-m` in Lab UI and
 * `--blur-m` in Tailwind would otherwise produce `--blur-m: var(--blur-m)`
 * which is circular per CSS). When a token value changes the preset
 * automatically picks it up.
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
    '@theme inline {',
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

  lines.push('  /* Shadows — from multi-layer presets */')
  // Tailwind v4's `--shadow-*` utilities expect complete `box-shadow`
  // values (offsets + blur + spread + color). The Lab UI shadow presets
  // (`--fx-shadow-{xs,s,m,l,xl}`) are the full box-shadow strings; the
  // tint primitives (`--fx-shadow-{minor,ambient,penumbra,major}`) are
  // colors that live inside those strings, so they stay exposed as
  // `--color-fx-shadow-*` from the semantic roles section above, not
  // as `--shadow-*`.
  const presetToTw: Record<string, string> = {
    xs: 'xs',
    s: 'sm',
    m: 'md',
    l: 'lg',
    xl: 'xl',
  }
  for (const preset of semantic.shadow_presets) {
    const tw = presetToTw[preset.name] ?? preset.name
    lines.push(`  --shadow-${tw}: var(--fx-shadow-${preset.name});`)
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
