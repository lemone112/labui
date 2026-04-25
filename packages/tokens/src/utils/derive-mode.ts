/**
 * `deriveForMode` — pure mode-derivation per SPEC §6.2.
 *
 * Takes ONE base OKLCH triple per accent (the `light/normal` anchor)
 * and derives the OKLCH for any other (mode, contrast) output via a
 * deterministic pipeline. End-state for SPEC §10.D0: 11 base points,
 * formula derives all 836 (11 × 19 × 4) accent cells.
 *
 * Pipeline cases:
 *   light/normal → identity(base)
 *   dark/normal  → applyPerceptualComp(base, 'dark', knobs.dark) → fitGamut
 *   light/ic     → apcaSearch(base.H, base.C, target_apca, bg=neutral.0[light/normal])
 *   dark/ic      → apcaSearch(dark/normal point's H/C, target_apca, bg=neutral.0[dark/normal])
 *
 * **Nothing in this function branches on the accent family name** — that
 * would violate SPEC §2 C-9 (no-special-case-by-name). Yellow → amber
 * shift in IC modes arises from the gamut-clamp + APCA-bisection
 * geometry, not a hardcoded override.
 *
 * @governs SPEC §6.2 + §6.6
 * @invariant Pure function. Same (base, mode, knobs) → same output.
 */

import type { Contrast, BaseMode, OklchValue, OutputKey } from '../types'
import { applyPerceptualComp, fitGamut } from '../generators/resolver'
import { apcaInverse, type Orientation } from './apca-inverse'

/**
 * Knobs threaded through derivation. Subset of `ColorsConfig` so this
 * stays decoupled from the full config schema (calibration spike can
 * vary knobs without rebuilding the entire generator).
 */
export interface DeriveKnobs {
  perceptual_comp: {
    enable: boolean
    light: { chroma_mult: number; lightness_shift: number; hue_shift: number }
    dark: { chroma_mult: number; lightness_shift: number; hue_shift: number }
  }
  /** Target APCA |Lc| for primary-tier IC contrast (SPEC §6.6). */
  target_ic_apca: number
  /** Output gamut for clamping (SPEC C-3). */
  gamut: 'p3' | 'srgb'
}

/**
 * Per-mode canonical background used by `apcaSearch` for IC contrast.
 *
 * Per SPEC §6.6, IC primitives are derived against the **most-extreme**
 * neutral background of the same theme — i.e. neutral.0 in light theme
 * (white-ish) and neutral.0 in dark theme (black-ish, via mirror).
 * These are the canonical bgs all primary-tier labels in IC mode are
 * designed against.
 *
 * For the spike, hardcoded to the static white/dark endpoints — close
 * enough to the actual gray ladder endpoints (off by ~0.001 ΔL).
 */
const CANONICAL_BG: Record<BaseMode, OklchValue> = {
  light: { L: 1.0, C: 0, H: 0 },
  dark: { L: 0.08, C: 0, H: 0 },
}

export function deriveForMode(
  base: OklchValue,
  mode: BaseMode,
  contrast: Contrast,
  knobs: DeriveKnobs,
): { value: OklchValue; achieved_apca?: number; iterations?: number } {
  if (mode === 'light' && contrast === 'normal') {
    return { value: clampToConfiguredGamut(base, knobs.gamut) }
  }

  if (mode === 'dark' && contrast === 'normal') {
    const compd = applyPerceptualComp(base, 'dark', knobs.perceptual_comp)
    return { value: fitGamut(compd, knobs.gamut) }
  }

  // IC variants: APCA-bisect L on the bg, hue fixed at base.H, chroma
  // tracks gamut-max for that L (clamp shapes the result naturally).
  const bgMode: BaseMode = mode
  const bg = CANONICAL_BG[bgMode]
  // For dark/ic we pre-apply dark-mode perceptual comp to the base so
  // the search starts from a point already adjusted for dark viewing.
  const startPoint =
    mode === 'dark'
      ? applyPerceptualComp(base, 'dark', knobs.perceptual_comp)
      : base

  return apcaSearch(startPoint, bg, knobs.target_ic_apca, knobs.gamut, 'auto')
}

/**
 * `apcaSearch` — find OKLCH point with hue-fixed-at-base, chroma
 * gamut-clamped, lightness chosen to hit target APCA against bg.
 *
 * Per SPEC §6.6: this is APCA binary-search where chroma is NOT a free
 * parameter — at every L sample we use base.C as a target and let
 * `fitGamut` clamp to the P3 envelope. For Yellow (high-C, narrow
 * L-band of P3 gamut at H≈92°), low-L samples force aggressive chroma
 * reduction → hue stays at 92° but the rendered point pulls toward
 * brown/amber. This is the `Yellow IC = #b25000 NATURAL` claim of
 * SPEC §7.7.Y.
 */
export function apcaSearch(
  startPoint: OklchValue,
  bg: OklchValue,
  target_apca: number,
  gamut: 'p3' | 'srgb',
  orientation: Orientation = 'auto',
): { value: OklchValue; achieved_apca: number; iterations: number } {
  // build_candidate: at each L, sample (L, base.C, base.H), gamut-clamp
  // to keep in P3. Returns the rendered OKLCH for APCA evaluation.
  const build = (L: number): OklchValue => {
    const candidate: OklchValue = { L, C: startPoint.C, H: startPoint.H }
    return fitGamut(candidate, gamut)
  }

  const inv = apcaInverse(target_apca, bg, build, orientation)
  return {
    value: build(inv.L),
    achieved_apca: inv.achieved_apca,
    iterations: inv.iterations,
  }
}

function clampToConfiguredGamut(v: OklchValue, gamut: 'p3' | 'srgb'): OklchValue {
  return fitGamut(v, gamut)
}

/**
 * Convenience: derive all 4 outputs for a base point.
 */
export function deriveAllModes(
  base: OklchValue,
  knobs: DeriveKnobs,
): Record<OutputKey, OklchValue & { achieved_apca?: number }> {
  const ln = deriveForMode(base, 'light', 'normal', knobs)
  const li = deriveForMode(base, 'light', 'ic', knobs)
  const dn = deriveForMode(base, 'dark', 'normal', knobs)
  const di = deriveForMode(base, 'dark', 'ic', knobs)
  return {
    'light/normal': { ...ln.value, achieved_apca: ln.achieved_apca },
    'light/ic': { ...li.value, achieved_apca: li.achieved_apca },
    'dark/normal': { ...dn.value, achieved_apca: dn.achieved_apca },
    'dark/ic': { ...di.value, achieved_apca: di.achieved_apca },
  }
}
