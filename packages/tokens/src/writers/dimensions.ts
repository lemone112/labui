/**
 * CSS writer for L1 Units + L2 Dimensions.
 *
 * @governs plan-v2 §2 Units · §3 Dimensions · §6 Emit
 *
 * Emits a single mode-invariant :root block. Units and dimensions do not
 * participate in the 4 output keys; scaling/airiness are build-time cells.
 */

import type { ResolvedDimensions, ResolvedUnits } from '../types'

export function writeUnitsDimensionsCss(
  units: ResolvedUnits,
  dimensions: ResolvedDimensions,
): string {
  const lines: string[] = []
  lines.push(':root {')

  // Units: px scale
  for (const [name, value] of Object.entries(units.px)) {
    lines.push(`  --${slug(name)}: ${value}px;`)
  }
  // pt scale
  for (const [name, value] of Object.entries(units.pt)) {
    lines.push(`  --${slug(name)}: ${value}pt;`)
  }

  // Dimensions by family
  emitFamily(lines, 'adaptive', dimensions.adaptives, 'px')
  emitFamily(lines, 'padding', dimensions.spacing_padding, 'px')
  emitFamily(lines, 'margin', dimensions.spacing_margin, 'px')
  emitRadius(lines, dimensions.radius)
  emitFamily(lines, 'size', dimensions.size, 'px')
  emitFamily(lines, 'blur', dimensions.fx_blur, 'px')
  emitFamily(lines, 'shift', dimensions.fx_shift, 'px')
  emitFamily(lines, 'spread', dimensions.fx_spread, 'px')

  lines.push('}\n')
  return lines.join('\n')
}

function emitFamily(
  lines: string[],
  prefix: string,
  values: Record<string, number>,
  unit: string,
): void {
  for (const [name, v] of Object.entries(values)) {
    lines.push(`  --${prefix}-${slug(name)}: ${v}${unit};`)
  }
}

function emitRadius(
  lines: string[],
  values: Record<string, number>,
): void {
  for (const [name, v] of Object.entries(values)) {
    if (v === 9999) {
      lines.push(`  --radius-${slug(name)}: 9999px;`)
    } else {
      lines.push(`  --radius-${slug(name)}: ${v}px;`)
    }
  }
}

function slug(name: string): string {
  // Convert 'px/-7' → 'px--7', 'breakpoint/desktop/width' → 'breakpoint-desktop-width'
  return name.replace(/\//g, '-')
}
