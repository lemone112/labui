/**
 * CSS writer for L6 Z-index + L7 Materials.
 *
 * @governs plan-v2 §7 · Z-index · §8 · Materials
 *
 * Z-index: mode-invariant :root block.
 * Materials: default block + two [data-material-mode] override blocks.
 *   The default is determined by materials.default_mode.
 */

import type { ResolvedMaterials, ResolvedZIndex } from '../types'

export function writeZIndexCss(z: ResolvedZIndex): string {
  const lines: string[] = [':root {']
  for (const [name, value] of Object.entries(z)) {
    lines.push(`  --z-${name}: ${value};`)
  }
  lines.push('}\n')
  return lines.join('\n')
}

export function writeMaterialsCss(m: ResolvedMaterials): string {
  const lines: string[] = []

  // Default block — uses whichever mode the config declared as default.
  lines.push(':root {')
  for (const level of m.levels) {
    emitLevel(lines, level.name, m.default_mode, level)
  }
  lines.push('}\n')

  // Override blocks for the two non-default modes.
  const modes: Array<'solid' | 'glass' | 'backdrop'> = [
    'solid',
    'glass',
    'backdrop',
  ]
  for (const mode of modes) {
    if (mode === m.default_mode) continue
    lines.push(`:root[data-material-mode="${mode}"] {`)
    for (const level of m.levels) {
      emitLevel(lines, level.name, mode, level)
    }
    lines.push('}\n')
  }

  return lines.join('\n')
}

function emitLevel(
  lines: string[],
  name: string,
  mode: 'solid' | 'glass' | 'backdrop',
  level: ResolvedMaterials['levels'][number],
): void {
  const primVar = `var(--neutral-${level.primitive})`
  if (mode === 'solid') {
    lines.push(`  --materials-${name}-bg: ${primVar};`)
    lines.push(`  --materials-${name}-filter: none;`)
    lines.push(`  --materials-${name}-backdrop-filter: none;`)
  } else if (mode === 'glass') {
    // The glass fill uses the opacity-ladder var (neutral-<id>-a<stop>).
    lines.push(
      `  --materials-${name}-bg: var(--neutral-${level.primitive}-a${level.glass_opacity});`,
    )
    lines.push(`  --materials-${name}-filter: none;`)
    lines.push(
      `  --materials-${name}-backdrop-filter: blur(var(--blur-${level.glass_blur}));`,
    )
  } else {
    // backdrop: opaque fill, but the layer beneath gets blurred.
    lines.push(`  --materials-${name}-bg: ${primVar};`)
    lines.push(
      `  --materials-${name}-filter: blur(var(--blur-${level.backdrop_blur}));`,
    )
    lines.push(`  --materials-${name}-backdrop-filter: none;`)
  }
}
