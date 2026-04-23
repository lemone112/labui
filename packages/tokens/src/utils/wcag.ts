/**
 * WCAG 2.x relative-luminance contrast — used as a readability floor for
 * label tiers alongside APCA.
 *
 * @governs plan/implementation-plan-v2.md §5.3.2 · plan/test-strategy.md §L4.5
 *
 * Background: APCA `Lc` is the primary contrast criterion in this system
 * (see `apca-inverse.ts`). For label tiers the config additionally
 * declares a WCAG 2.x `wcag` floor. The resolver hits
 * `max(apca_target, wcag_target)`, so text never drops below the
 * WCAG readability envelope even when the tier's APCA target is lax
 * (e.g. `quaternary` Lc 15 ≈ 1.5:1).
 *
 * The helpers here mirror `apca-inverse.ts` exactly: a forward
 * `wcagContrast()` measurement and a monotonic binary search
 * `wcagInverse()` for `L` that hits a target ratio.
 *
 * sRGB is the reference gamut for WCAG 2.x — out-of-sRGB P3 colours are
 * clamped to [0, 1] per channel before the relative-luminance formula.
 */

import { converter } from 'culori'
import type { OklchValue } from '../types'
import { makeOklch } from './oklch'
import type { Orientation } from './apca-inverse'
import { resolveOrientation } from './apca-inverse'

const toRgb = converter('rgb')

/**
 * WCAG 2.x relative luminance `L` of a colour (0..1).
 *
 * @see https://www.w3.org/TR/WCAG22/#dfn-relative-luminance
 */
export function oklchToWcagY(v: OklchValue): number {
  const rgb = toRgb(makeOklch(v))
  if (!rgb) return 0
  return relativeLuminance(clamp01(rgb.r), clamp01(rgb.g), clamp01(rgb.b))
}

/**
 * WCAG 2.x contrast ratio between `fg` and `bg` (always ≥ 1).
 */
export function wcagContrast(fg: OklchValue, bg: OklchValue): number {
  const yf = oklchToWcagY(fg)
  const yb = oklchToWcagY(bg)
  const lighter = Math.max(yf, yb)
  const darker = Math.min(yf, yb)
  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * Binary search L that achieves `target_ratio` against `bg`.
 *
 * WCAG ratio is monotonic in the luminance delta between fg and bg, so
 * the root is unique within the half-range on the correct side of
 * `bg.L`. We reuse `apca-inverse`'s orientation resolution for
 * consistency: "auto" means pick the side that gives the larger ratio
 * (darker fg when bg is light, lighter fg when bg is dark).
 */
export interface WcagInverseResult {
  L: number
  iterations: number
  achieved_ratio: number
  saturated: boolean
}

export function wcagInverse(
  target_ratio: number,
  bg_oklch: OklchValue,
  build_candidate: (L: number) => OklchValue,
  orientation: Orientation = 'auto',
  max_iterations = 24,
  tolerance = 0.01,
): WcagInverseResult {
  const dir = resolveOrientation(orientation, bg_oklch.L)
  let lo = dir === 'darker' ? 0.0 : bg_oklch.L
  let hi = dir === 'darker' ? bg_oklch.L : 1.0

  let best_L = (lo + hi) / 2
  let best_ratio = 1
  let iter = 0

  for (; iter < max_iterations; iter++) {
    const mid = (lo + hi) / 2
    const fg = build_candidate(mid)
    const r = wcagContrast(fg, bg_oklch)

    best_L = mid
    best_ratio = r

    if (Math.abs(r - target_ratio) < tolerance) break

    if (dir === 'darker') {
      if (r < target_ratio) hi = mid
      else lo = mid
    } else {
      if (r < target_ratio) lo = mid
      else hi = mid
    }
  }

  const saturated =
    iter >= max_iterations && Math.abs(best_ratio - target_ratio) > tolerance

  return {
    L: best_L,
    iterations: iter + 1,
    achieved_ratio: best_ratio,
    saturated,
  }
}

function channelLin(c: number): number {
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

function relativeLuminance(r: number, g: number, b: number): number {
  return (
    0.2126 * channelLin(r) +
    0.7152 * channelLin(g) +
    0.0722 * channelLin(b)
  )
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}
