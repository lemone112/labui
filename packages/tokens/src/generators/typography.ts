/**
 * Layer 5 — Typography generator.
 *
 * @governs plan-v2 §6 · Layer 5 Typography
 *
 * Builds 11-step scale (xxs..6xl) from base_size × scale_ratio^exponent.
 * Sizes are snapped to multiples of base_px/2 to satisfy the
 * 4-px grid constraint (course §02 rule 1) without losing the
 * ratio feel entirely.
 */

import type {
  ResolvedTypography,
  TypographyConfig,
  TypographyKey,
  UnitsConfig,
} from '../types'

const KEYS: readonly TypographyKey[] = [
  'xxs',
  'xs',
  's',
  'm',
  'l',
  'xl',
  '2xl',
  '3xl',
  '4xl',
  '5xl',
  '6xl',
]

const BASE_KEY: TypographyKey = 'm'

/**
 * Snap a raw px size to the nearest multiple of `grid` (typically
 * base_px/2). Ensures --font-size-* sits on the sub-pixel grid to
 * avoid half-pixel text rendering (course §02 rule 1).
 */
export function snapToGrid(raw: number, grid: number): number {
  if (grid <= 0) return raw
  return Math.round(raw / grid) * grid
}

/**
 * Monotonic guarantee: if scale_ratio produces two adjacent sizes
 * that snap to the same grid multiple (possible at small sizes where
 * the ratio step < grid), bump the larger one up by one grid unit.
 * This preserves strict ascending order without breaking the ratio
 * by more than one grid step.
 */
function enforceMonotonic(
  sizes: Record<TypographyKey, number>,
  grid: number,
): void {
  const baseIdx = KEYS.indexOf(BASE_KEY)

  // Walk upward from base: bump later entries up if they collide.
  for (let i = baseIdx + 1; i < KEYS.length; i++) {
    const prev = sizes[KEYS[i - 1]]
    if (sizes[KEYS[i]] <= prev) sizes[KEYS[i]] = prev + grid
  }

  // Walk downward from base: push earlier entries down if they collide.
  for (let i = baseIdx - 1; i >= 0; i--) {
    const next = sizes[KEYS[i + 1]]
    if (sizes[KEYS[i]] >= next) sizes[KEYS[i]] = next - grid
  }
}

export interface GenerateTypographyResult {
  typography: ResolvedTypography
  warnings: string[]
}

export function generateTypography(
  cfg: TypographyConfig,
  units: UnitsConfig,
): GenerateTypographyResult {
  const warnings: string[] = []
  const base_px_unit = units.base_px * units.scaling
  const base_size = cfg.base_size_step * base_px_unit
  const grid = base_px_unit / 2 // half-pixel grid per §6.3

  const baseIdx = KEYS.indexOf(BASE_KEY)

  const size: Record<TypographyKey, number> = {} as Record<
    TypographyKey,
    number
  >
  const lh_body: Record<TypographyKey, number> = {} as Record<
    TypographyKey,
    number
  >
  const lh_headline: Record<TypographyKey, number> = {} as Record<
    TypographyKey,
    number
  >
  const tracking: Record<TypographyKey, number> = {} as Record<
    TypographyKey,
    number
  >

  for (const key of KEYS) {
    const exponent = KEYS.indexOf(key) - baseIdx
    const raw = base_size * Math.pow(cfg.scale_ratio, exponent)
    size[key] = snapToGrid(raw, grid)
  }

  enforceMonotonic(size, grid)

  for (const key of KEYS) {
    const s = size[key]
    // Line-heights round to whole px (course §02 rule 4 — line-height
    // must stay on the vertical rhythm grid).
    lh_body[key] = Math.round(s * cfg.lh_body_density)
    lh_headline[key] = Math.round(s * cfg.lh_headline_density)

    // Tracking: body keeps base tracking; headlines tighten
    // proportionally to log2(size/base).
    if (s < 18) {
      tracking[key] = cfg.tracking.body
    } else {
      const logRatio = Math.log2(s / base_size)
      tracking[key] = +(
        cfg.tracking.body +
        cfg.tracking.headline_per_log_size * logRatio
      ).toFixed(4)
    }
  }

  // Sanity: every size must be positive and on grid.
  for (const key of KEYS) {
    if (size[key] <= 0) {
      warnings.push(
        `typography.size.${key} ≤ 0 (got ${size[key]}). ` +
          `Raise base_size_step or lower scale_ratio.`,
      )
    }
    if (Math.abs(size[key] % grid) > 1e-6) {
      warnings.push(
        `typography.size.${key}=${size[key]} is not a multiple of ${grid}px grid.`,
      )
    }
  }

  // Validate semantic aliases reference real keys.
  for (const [name, key] of Object.entries(cfg.semantics)) {
    if (!KEYS.includes(key)) {
      warnings.push(
        `typography.semantics.${name} → "${key}" is not a valid scale key.`,
      )
    }
  }

  return {
    typography: {
      font_family: cfg.font_family,
      font_family_mono: cfg.font_family_mono,
      size,
      lh_body,
      lh_headline,
      tracking,
      semantics: { ...cfg.semantics },
    },
    warnings,
  }
}

export const TYPOGRAPHY_KEYS = KEYS
