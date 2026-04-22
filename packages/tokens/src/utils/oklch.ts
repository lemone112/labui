/**
 * OKLCH helpers built on top of `culori`. Kept deliberately thin — the
 * pipeline never does colour math by hand; every conversion / gamut test
 * goes through culori.
 */

import { clampChroma, converter, displayable, formatHex } from 'culori'
import type { OklchValue } from '../types'

const toRgb = converter('rgb')
const toP3 = converter('p3')
const toOklch = converter('oklch')

/**
 * Construct a culori OKLCH object from our plain { L, C, H } record.
 * Hue `NaN` happens for achromatic colours; we pin it to 0 to avoid culori
 * propagating NaN through subsequent conversions.
 */
export function makeOklch({ L, C, H }: OklchValue) {
  return { mode: 'oklch' as const, l: L, c: C, h: Number.isFinite(H) ? H : 0 }
}

/** Round to a stable number of decimals so CSS output diffs cleanly. */
export function roundOklch(v: OklchValue): OklchValue {
  return {
    L: round(v.L, 3),
    C: round(v.C, 3),
    H: round(v.H, 1),
  }
}

function round(n: number, digits: number): number {
  const k = 10 ** digits
  return Math.round(n * k) / k
}

/**
 * Emit a CSS `oklch(...)` string.
 *
 * - Hue is omitted when chroma is 0 so the string round-trips through
 *   `color-parsing` libraries that reject `oklch(l 0 NaN)`.
 * - Alpha is rendered as `/ a` only when < 1.
 */
export function formatOklchCss(v: OklchValue, alpha = 1): string {
  const L = round(v.L, 4)
  const C = round(v.C, 4)
  const H = round(v.H, 2)
  const hue = C === 0 ? 0 : H
  const base = `oklch(${L} ${C} ${hue}`
  return alpha >= 1
    ? `${base})`
    : `${base} / ${round(alpha, 4)})`
}

/**
 * sRGB fallback as `#rrggbb`. Used for browsers without OKLCH support
 * (we emit it as a shadow declaration above the `oklch()` value).
 */
export function formatSrgbFallback(v: OklchValue, alpha = 1): string {
  const oklch = makeOklch(v)
  const rgb = toRgb(oklch)
  if (!rgb) return '#000000'
  if (alpha >= 1) return formatHex(rgb) ?? '#000000'
  const r = clamp01(rgb.r)
  const g = clamp01(rgb.g)
  const b = clamp01(rgb.b)
  return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${round(alpha, 4)})`
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n))
}

/**
 * Is the OKLCH value inside the Display-P3 gamut?
 *
 * culori's `displayable` works off of rgb-mode. We convert to `p3` first
 * so the check reflects the wider gamut we actually target.
 */
export function isInP3Gamut(v: OklchValue): boolean {
  const p3 = toP3(makeOklch(v))
  if (!p3) return false
  return (
    p3.r >= -1e-6 && p3.r <= 1 + 1e-6 &&
    p3.g >= -1e-6 && p3.g <= 1 + 1e-6 &&
    p3.b >= -1e-6 && p3.b <= 1 + 1e-6
  )
}

export function isInSrgbGamut(v: OklchValue): boolean {
  return displayable(makeOklch(v))
}

/**
 * Clamp chroma so the colour fits into a given gamut.
 *
 * We reserve a small safety margin so that post-rounding the value still
 * passes `isIn*Gamut`. `clampChroma` returns values right at the edge,
 * which flip back outside after we round to 3 decimals.
 */
export function clampToGamut(v: OklchValue, gamut: 'p3' | 'srgb'): OklchValue {
  const oklch = makeOklch(v)
  const clamped = clampChroma(oklch, 'oklch', gamut === 'p3' ? 'p3' : 'rgb')
  const roundTrip = toOklch(clamped)
  if (!roundTrip) return v
  const C = Math.max(0, (roundTrip.c ?? 0) - GAMUT_SAFETY)
  return {
    L: roundTrip.l ?? v.L,
    C,
    H: Number.isFinite(roundTrip.h) ? (roundTrip.h as number) : v.H,
  }
}

/** Small safety margin to prevent rounding from pushing values back outside
 * the target gamut. Chosen empirically; loses ~1% saturation at the edges. */
const GAMUT_SAFETY = 0.004
