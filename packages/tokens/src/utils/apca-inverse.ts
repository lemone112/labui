/**
 * APCA inverse — find the OKLCH lightness L that achieves a target |Lc|
 * against a given background luminance.
 *
 * @governs implementation-plan-v2.md §5.1 · Resolution pipeline
 *
 * APCA's `Lc` is a non-trivial function of luminance; there is no closed
 * form inverse. We use monotonic binary search on L — APCA increases
 * monotonically with fg/bg luminance delta, so the root is unique.
 *
 * @param target_apca - desired |Lc| magnitude (e.g. 60 for body text)
 * @param bg_oklch - background in OKLCH
 * @param candidate_H_C - hue & chroma at the candidate L (spine result)
 * @param orientation - whether fg should be darker or lighter than bg
 *                      'auto' decides based on bg.L (> 0.5 → darker fg)
 */

import { APCAcontrast, sRGBtoY } from 'apca-w3'
import { converter } from 'culori'
import type { OklchValue } from '../types'
import { makeOklch } from './oklch'

const toRgb = converter('rgb')

export type Orientation = 'auto' | 'darker' | 'lighter'

export interface InverseResult {
  L: number
  /** Number of binary-search iterations used (diagnostic). */
  iterations: number
  /** Final measured |Lc|, for verification. */
  achieved_apca: number
  /** If true, search ran out of range and returned best-effort. */
  saturated: boolean
}

/**
 * Core function: binary search L for target APCA on the given bg.
 *
 * Provide a H,C function (if spine varies chroma with L, sample inside
 * the loop). For a flat H/C input, pass a constant.
 */
export function apcaInverse(
  target_apca: number,
  bg_oklch: OklchValue,
  build_candidate: (L: number) => OklchValue,
  orientation: Orientation = 'auto',
  max_iterations = 24,
  tolerance = 0.2,
): InverseResult {
  const bgY = oklchToApcaY(bg_oklch)
  const dir = resolveOrientation(orientation, bg_oklch.L)

  // Search range: if fg should be darker, L ∈ (0, bg.L); else (bg.L, 1)
  let lo = dir === 'darker' ? 0.0 : bg_oklch.L
  let hi = dir === 'darker' ? bg_oklch.L : 1.0

  let best_L = (lo + hi) / 2
  let best_apca = 0
  let iter = 0

  for (; iter < max_iterations; iter++) {
    const mid = (lo + hi) / 2
    const fg = build_candidate(mid)
    const fgY = oklchToApcaY(fg)
    const lc = Math.abs(APCAcontrast(fgY, bgY) as number)

    best_L = mid
    best_apca = lc

    if (Math.abs(lc - target_apca) < tolerance) break

    // Apca grows as fg luminance moves away from bg.
    // If we want darker fg: lower L = higher |Lc|
    // If we want lighter fg: higher L = higher |Lc|
    if (dir === 'darker') {
      if (lc < target_apca) hi = mid
      else lo = mid
    } else {
      if (lc < target_apca) lo = mid
      else hi = mid
    }
  }

  const saturated = iter >= max_iterations && Math.abs(best_apca - target_apca) > tolerance

  return {
    L: best_L,
    iterations: iter + 1,
    achieved_apca: best_apca,
    saturated,
  }
}

/**
 * Decide orientation when 'auto': fg should be opposite luminance of bg.
 */
export function resolveOrientation(
  orientation: Orientation,
  bg_L: number,
): 'darker' | 'lighter' {
  if (orientation === 'darker') return 'darker'
  if (orientation === 'lighter') return 'lighter'
  return bg_L > 0.5 ? 'darker' : 'lighter'
}

/**
 * Convert OKLCH → APCA-y (luminance for APCA). APCA expects sRGB-encoded
 * luminance via `sRGBtoY`. We clamp to sRGB gamut first — this is an
 * approximation for out-of-sRGB P3 colors, but APCA doesn't define
 * itself for P3 so this is the best available model.
 */
export function oklchToApcaY(v: OklchValue): number {
  const rgb = toRgb(makeOklch(v))
  if (!rgb) return 0
  const r = Math.round(clamp01(rgb.r) * 255)
  const g = Math.round(clamp01(rgb.g) * 255)
  const b = Math.round(clamp01(rgb.b) * 255)
  return sRGBtoY([r, g, b]) as number
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

/**
 * Direct |Lc| measurement, for tests/validators.
 */
export function apcaLc(fg: OklchValue, bg: OklchValue, fg_alpha = 1): number {
  const fgY = oklchToApcaY(fg)
  const bgY = oklchToApcaY(bg)
  if (fg_alpha < 1) {
    // Approximate alpha blending in luminance space (rough but monotonic)
    const yBlended = fg_alpha * fgY + (1 - fg_alpha) * bgY
    return Math.abs(APCAcontrast(yBlended, bgY) as number)
  }
  return Math.abs(APCAcontrast(fgY, bgY) as number)
}
