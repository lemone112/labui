/**
 * Spine interpolation — monotonic Hermite spline through control points.
 *
 * @governs implementation-plan-v2.md §4.2 · Accent spines
 *
 * Accents declare 1-4 control points `{L, H, C?}` defining the path of the
 * "clean" color through lightness. We interpolate H (and optional C) as a
 * function of L using a monotonic Hermite spline — smooth but without
 * overshoot between points.
 *
 * @invariant H(L) is monotonic between control points (no oscillation)
 * @why Non-monotonic interpolation can cause perceived color to jump
 *      (e.g. yellow → green → yellow) as L traverses. Monotonic Hermite
 *      preserves the control order.
 *
 * Reference: Fritsch-Carlson 1980 (monotonic cubic interpolation).
 */

import type { SpineControl } from '../types'

/**
 * Interpolate H (and optional C) at a given target L along the spine.
 *
 * Behaviour:
 * - L below first control point: clamps to first.H / first.C
 * - L above last control point: clamps to last.H / last.C
 * - Single control point: always returns that point
 * - Between points: monotonic cubic Hermite
 *
 * @param spine - sorted by L ascending (enforced in validator)
 * @param target_L - lightness to sample at
 */
export function spineInterp(
  spine: SpineControl[],
  target_L: number,
): { H: number; C: number | null } {
  if (spine.length === 0) {
    throw new Error('spineInterp: empty spine')
  }
  if (spine.length === 1) {
    return { H: spine[0].H, C: spine[0].C ?? null }
  }

  // Clamp below range
  if (target_L <= spine[0].L) {
    return { H: spine[0].H, C: spine[0].C ?? null }
  }
  // Clamp above range
  if (target_L >= spine[spine.length - 1].L) {
    const last = spine[spine.length - 1]
    return { H: last.H, C: last.C ?? null }
  }

  // Find bracketing segment
  let i = 0
  for (; i < spine.length - 1; i++) {
    if (target_L >= spine[i].L && target_L <= spine[i + 1].L) break
  }

  const p0 = spine[i]
  const p1 = spine[i + 1]
  const t = (target_L - p0.L) / (p1.L - p0.L)

  const H = monotonicHermite(
    spine,
    i,
    t,
    (p) => p.H,
  )

  const C0 = p0.C
  const C1 = p1.C
  const C =
    C0 != null && C1 != null
      ? monotonicHermite(spine, i, t, (p) => p.C ?? 0)
      : C0 ?? C1 ?? null

  return { H, C }
}

/**
 * Monotonic Hermite interpolation within a segment [i, i+1].
 *
 * Uses Fritsch-Carlson tangent adjustment to prevent overshoot:
 *   1. Compute secant slopes between consecutive points
 *   2. Initial tangent at each point = average of adjacent secants
 *   3. If any tangent opposes secant direction, zero it
 *   4. If tangent magnitude would cause overshoot (> 3x secant), clip
 *   5. Evaluate Hermite basis at t
 */
function monotonicHermite(
  spine: SpineControl[],
  i: number,
  t: number,
  extract: (p: SpineControl) => number,
): number {
  const n = spine.length
  const Ls = spine.map((p) => p.L)
  const Ys = spine.map(extract)

  // Compute secant slopes
  const slopes: number[] = []
  for (let k = 0; k < n - 1; k++) {
    slopes.push((Ys[k + 1] - Ys[k]) / (Ls[k + 1] - Ls[k]))
  }

  // Compute tangents at each point
  const tangents: number[] = new Array(n)
  tangents[0] = slopes[0]
  tangents[n - 1] = slopes[n - 2]
  for (let k = 1; k < n - 1; k++) {
    if (slopes[k - 1] * slopes[k] <= 0) {
      tangents[k] = 0 // flat / extremum
    } else {
      tangents[k] = (slopes[k - 1] + slopes[k]) / 2
    }
  }

  // Clip tangents to avoid overshoot (Fritsch-Carlson condition)
  for (let k = 0; k < n - 1; k++) {
    if (slopes[k] === 0) {
      tangents[k] = 0
      tangents[k + 1] = 0
    } else {
      const a = tangents[k] / slopes[k]
      const b = tangents[k + 1] / slopes[k]
      const s = a * a + b * b
      if (s > 9) {
        const tau = 3 / Math.sqrt(s)
        tangents[k] = tau * a * slopes[k]
        tangents[k + 1] = tau * b * slopes[k]
      }
    }
  }

  const h = Ls[i + 1] - Ls[i]
  const y0 = Ys[i]
  const y1 = Ys[i + 1]
  const m0 = tangents[i] * h
  const m1 = tangents[i + 1] * h

  // Cubic Hermite basis
  const t2 = t * t
  const t3 = t2 * t
  const h00 = 2 * t3 - 3 * t2 + 1
  const h10 = t3 - 2 * t2 + t
  const h01 = -2 * t3 + 3 * t2
  const h11 = t3 - t2

  return h00 * y0 + h10 * m0 + h01 * y1 + h11 * m1
}

/**
 * Validate that a spine is well-formed.
 *
 * Checks:
 *   - At least 1 point
 *   - Sorted by L ascending, strictly
 *   - All L in (0, 1)
 *   - All H in [0, 360)
 *   - C (when present) ≥ 0
 *
 * Returns list of violations.
 */
export function validateSpine(spine: SpineControl[], accent_name = ''): string[] {
  const errors: string[] = []
  const prefix = accent_name ? `accent ${accent_name}: ` : ''

  if (spine.length < 1) {
    errors.push(`${prefix}spine has no control points`)
    return errors
  }
  if (spine.length > 4) {
    errors.push(
      `${prefix}spine has ${spine.length} points (max 4 — more points give diminishing returns and risk overshoot)`,
    )
  }

  for (let i = 0; i < spine.length; i++) {
    const p = spine[i]
    if (p.L <= 0 || p.L >= 1) {
      errors.push(`${prefix}spine[${i}].L=${p.L} out of (0,1) range`)
    }
    if (p.H < 0 || p.H >= 360) {
      errors.push(`${prefix}spine[${i}].H=${p.H} out of [0,360) range`)
    }
    if (p.C != null && p.C < 0) {
      errors.push(`${prefix}spine[${i}].C=${p.C} negative`)
    }
  }

  for (let i = 1; i < spine.length; i++) {
    if (spine[i].L <= spine[i - 1].L) {
      errors.push(
        `${prefix}spine not sorted: [${i - 1}].L=${spine[i - 1].L} ≥ [${i}].L=${spine[i].L}`,
      )
    }
  }

  return errors
}
