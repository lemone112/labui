/**
 * CSS writer for L1 Units + L2 Dimensions.
 *
 * @governs plan-v2 §2 Units · §3 Dimensions · §6 Emit
 *
 * Emits a single mode-invariant :root block. Units and dimensions do not
 * participate in the 4 output keys; scaling/airiness are build-time cells.
 *
 * Everything is emitted in `rem`. The `radius-full` pill anchor is the sole
 * exception — it uses the CSS Values 4 `calc(infinity * 1rem)` sentinel so
 * the pill shape survives container widths > 9999px and stays stylistically
 * consistent with the rest of the rem-based system.
 */

import type { ResolvedDimensions, ResolvedUnits } from '../types'

const ROOT_FONT_SIZE_PX = 16

/** Convert a px-magnitude number to rem at root=16. `0` → `0` (bare). */
function toRem(px: number): string {
  if (px === 0) return '0'
  return `${px / ROOT_FONT_SIZE_PX}rem`
}

export function writeUnitsDimensionsCss(
  units: ResolvedUnits,
  dimensions: ResolvedDimensions,
): string {
  const lines: string[] = []
  lines.push(':root {')

  // L1 — unit scale
  for (const [name, value] of Object.entries(units.values)) {
    lines.push(`  --${slug(name)}: ${toRem(value)};`)
  }

  // L2 — dimensions by family
  emitFamily(lines, 'adaptive', dimensions.adaptives)
  emitFamily(lines, 'padding', dimensions.spacing_padding)
  emitFamily(lines, 'margin', dimensions.spacing_margin)
  emitRadius(lines, dimensions.radius)
  emitFamily(lines, 'size', dimensions.size)
  emitFamily(lines, 'blur', dimensions.fx_blur)
  emitFamily(lines, 'shift', dimensions.fx_shift)
  emitFamily(lines, 'spread', dimensions.fx_spread)

  lines.push('}\n')
  return lines.join('\n')
}

function emitFamily(
  lines: string[],
  prefix: string,
  values: Record<string, number>,
): void {
  for (const [name, v] of Object.entries(values)) {
    lines.push(`  --${prefix}-${slug(name)}: ${toRem(v)};`)
  }
}

function emitRadius(
  lines: string[],
  values: Record<string, number>,
): void {
  for (const [name, v] of Object.entries(values)) {
    if (!Number.isFinite(v)) {
      // Pill sentinel — `calc(infinity * 1rem)` is the CSS Values 4 way to
      // express an unbounded length. `border-radius` clamps to half-side at
      // render time; the sentinel just means "always round to capsule".
      lines.push(`  --radius-${slug(name)}: calc(infinity * 1rem);`)
    } else {
      lines.push(`  --radius-${slug(name)}: ${toRem(v)};`)
    }
  }
}

function slug(name: string): string {
  // Convert 'unit/-7' → 'unit--7', 'breakpoint/desktop/width' → 'breakpoint-desktop-width'
  return name.replace(/\//g, '-')
}
