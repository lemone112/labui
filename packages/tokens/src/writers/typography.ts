/**
 * CSS writer for L5 Typography.
 *
 * @governs plan-v2 §6 · Layer 5 Typography · §6.4 Output
 *
 * Mode-invariant :root block. Emits --font-family, --font-size-*,
 * --lh-body-*, --lh-headline-*, --tracking-*, plus semantic aliases
 * (--text-body-default points at --font-size-m etc.).
 */

import type { ResolvedTypography } from '../types'
import { TYPOGRAPHY_KEYS } from '../generators/typography'

export function writeTypographyCss(typo: ResolvedTypography): string {
  const lines: string[] = [':root {']

  lines.push(
    `  --font-family: "${typo.font_family}", system-ui, -apple-system, sans-serif;`,
  )
  lines.push(
    `  --font-family-mono: "${typo.font_family_mono}", ui-monospace, SFMono-Regular, monospace;`,
  )

  for (const key of TYPOGRAPHY_KEYS) {
    lines.push(`  --font-size-${key}: ${typo.size[key]}px;`)
  }
  for (const key of TYPOGRAPHY_KEYS) {
    lines.push(`  --lh-body-${key}: ${typo.lh_body[key]}px;`)
  }
  for (const key of TYPOGRAPHY_KEYS) {
    lines.push(`  --lh-headline-${key}: ${typo.lh_headline[key]}px;`)
  }
  for (const key of TYPOGRAPHY_KEYS) {
    const t = typo.tracking[key]
    lines.push(`  --tracking-${key}: ${t === 0 ? '0' : `${t}em`};`)
  }

  // Semantic aliases — reference the scale vars.
  //
  // Line-height tier is inferred from the alias prefix:
  //   - headline-*, title-* → tight headline line-height (density ~1.1)
  //   - label-*, body-*, everything else → roomy body line-height (~1.5)
  //
  // Mixing them was the original bug: every alias used --lh-body-*,
  // which gave headlines ~36% too much vertical space (14px excess at 3xl).
  for (const [name, key] of Object.entries(typo.semantics)) {
    const isHeadlineTier = name.startsWith('headline-') || name.startsWith('title-')
    const lhVar = isHeadlineTier ? `--lh-headline-${key}` : `--lh-body-${key}`
    lines.push(`  --text-${name}: var(--font-size-${key});`)
    lines.push(`  --text-${name}-lh: var(${lhVar});`)
    lines.push(`  --text-${name}-tracking: var(--tracking-${key});`)
  }

  lines.push('}\n')
  return lines.join('\n')
}
