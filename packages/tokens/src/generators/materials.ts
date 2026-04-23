/**
 * Layer 7 — Materials generator.
 *
 * @governs plan-v2 §8 · Layer 7 Materials
 *
 * Materials are a "third axis" — orthogonal to base mode and contrast.
 * material_mode switches between {solid, glass, backdrop} at runtime
 * via [data-material-mode] attribute on :root.
 *
 * This generator validates config references (primitive ids exist,
 * blur step names exist) and produces a resolved level list for
 * the writer to emit per-mode CSS blocks.
 */

import type {
  DimensionsConfig,
  MaterialsConfig,
  PrimitiveColorSet,
  ResolvedMaterials,
} from '../types'

export interface GenerateMaterialsResult {
  materials: ResolvedMaterials
  warnings: string[]
}

export function generateMaterials(
  cfg: MaterialsConfig,
  primitive: PrimitiveColorSet,
  dimensions: DimensionsConfig,
): GenerateMaterialsResult {
  const warnings: string[] = []
  const validBlur = new Set(Object.keys(dimensions.fx_blur))
  const validNeutralIds = new Set(primitive.neutrals.map((n) => n.id))

  const levels = Object.entries(cfg.levels).map(([name, cell]) => {
    if (!validNeutralIds.has(cell.primitive)) {
      warnings.push(
        `materials.${name}: primitive="${cell.primitive}" not found in neutrals. ` +
          `Valid ids: ${[...validNeutralIds].join(', ')}.`,
      )
    }
    if (!validBlur.has(cell.glass_blur)) {
      warnings.push(
        `materials.${name}: glass_blur="${cell.glass_blur}" not in dimensions.fx_blur.`,
      )
    }
    if (!validBlur.has(cell.backdrop_blur)) {
      warnings.push(
        `materials.${name}: backdrop_blur="${cell.backdrop_blur}" not in dimensions.fx_blur.`,
      )
    }
    if (cell.glass_opacity < 0 || cell.glass_opacity > 100) {
      warnings.push(
        `materials.${name}: glass_opacity=${cell.glass_opacity} is outside [0,100].`,
      )
    }

    return {
      name,
      primitive: cell.primitive,
      glass_opacity: cell.glass_opacity,
      glass_blur: cell.glass_blur,
      backdrop_blur: cell.backdrop_blur,
    }
  })

  return {
    materials: {
      default_mode: cfg.default_mode,
      levels,
    },
    warnings,
  }
}
