/**
 * Chroma curves — shape C(L) for both neutrals and accents.
 *
 * @governs implementation-plan-v2.md §4.1 (neutrals) · §4.2 (accents)
 *
 * Neutrals: symmetric curve around `peak_step`, tapers to `floor` at
 * endpoints. Keeps chroma non-zero (achromatic dirt, course §03 rule 2).
 *
 * Accents: curve over L, with falloff rates different on either side
 * of `peak_L`. When L drops below peak_L, C typically decreases (gamut
 * shrinks in dark region); when L rises above peak_L, C also decreases
 * (gamut shrinks in light region but less steeply).
 */

import type { AccentChromaCurve, ChromaCurve } from '../types'

/**
 * Evaluate neutral chroma at a step index.
 *
 * Symmetric falloff from `peak` at `peak_step` to `floor` at endpoints.
 * The curve is Gaussian-like with width controlled by `falloff`.
 */
export function neutralChromaAt(
  curve: ChromaCurve,
  step: number,
  total_steps: number,
): number {
  const distance = Math.abs(step - curve.peak_step)
  // Normalise distance to [0,1] where 1 = farthest endpoint
  const max_distance = Math.max(
    curve.peak_step,
    total_steps - 1 - curve.peak_step,
  )
  const t = max_distance > 0 ? distance / max_distance : 0
  // falloff=1 → quadratic, higher = sharper
  const attenuation = Math.pow(t, curve.falloff * 2)
  return curve.peak * (1 - attenuation) + curve.floor * attenuation
}

/**
 * Evaluate accent chroma at a given L, with optional spine-provided C
 * override.
 *
 * If spine supplies C for this L, spineC wins (control point intent).
 * Otherwise, synthesise from curve:
 *   C(L) = peak * falloff_factor
 * where falloff_factor decreases as |L - peak_L| grows.
 *
 * `chroma_boost_per_dL` adds chroma compensation when L < peak_L
 * (dark region); this opposes gamut shrinkage for darker accents.
 */
export function accentChromaAt(
  curve: AccentChromaCurve,
  L: number,
  spineC: number | null,
  chroma_boost_per_dL: number,
  vibrancy: number,
): number {
  if (spineC != null) {
    return Math.max(curve.floor, spineC * vibrancy)
  }

  const dL = L - curve.peak_L
  let falloff: number
  if (dL < 0) {
    // darker than peak — use falloff_low
    falloff = curve.falloff_low
  } else {
    falloff = curve.falloff_high
  }

  const attenuation = Math.pow(Math.abs(dL) / 0.5, falloff * 2)
  let C = curve.peak * (1 - attenuation) + curve.floor * attenuation

  // Boost in dark region
  if (dL < 0 && chroma_boost_per_dL > 0) {
    C *= 1 + chroma_boost_per_dL * Math.abs(dL)
  }

  return Math.max(curve.floor, C * vibrancy)
}

/**
 * Hue drift for neutrals — slight hue change across the scale.
 * By default Lab UI uses cool neutrals with ~0° drift.
 */
export function driftedHue(
  start_H: number,
  end_H: number,
  step: number,
  total_steps: number,
  easing: 'linear' | 'ease-in' | 'ease-out',
): number {
  const t = total_steps > 1 ? step / (total_steps - 1) : 0
  const eased =
    easing === 'linear'
      ? t
      : easing === 'ease-in'
      ? t * t
      : 1 - (1 - t) * (1 - t)
  return start_H + (end_H - start_H) * eased
}
