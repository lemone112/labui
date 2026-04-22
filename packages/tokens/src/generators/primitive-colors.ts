/**
 * Primitive colour generation — neutrals, accents, statics.
 * See spec.md §4.
 *
 * Output is a {@link PrimitiveColorSet} IR consumed by both the semantic
 * generator and the writers. This function is deterministic and side-effect
 * free.
 */

import type {
  ColorsConfig,
  Mode,
  OklchValue,
  PrimitiveColorSet,
  PrimitiveSolid,
} from '../types'
import { MODES, isIcMode } from '../types'
import { clampToGamut, isInP3Gamut, roundOklch } from '../utils/oklch'
import { interpAt, tSequence } from '../utils/interp'

export interface GenerateOptions {
  /**
   * Collected warnings (e.g. chroma clamped to fit P3). Callers pass in an
   * array; this function appends to it instead of throwing so CI surfaces
   * all issues at once.
   */
  warnings?: string[]
}

export function generatePrimitiveColors(
  colors: ColorsConfig,
  options: GenerateOptions = {},
): PrimitiveColorSet {
  const warnings = options.warnings ?? []

  return {
    neutrals: generateNeutrals(colors, warnings),
    accents: generateAccents(colors, warnings),
    statics: generateStatics(colors),
    opacityStops: colors.opacity.stops,
  }
}

// ─── Neutrals ───────────────────────────────────────────────────────────

function generateNeutrals(colors: ColorsConfig, warnings: string[]): PrimitiveSolid[] {
  const cfg = colors.neutrals
  const ts = tSequence(cfg.steps)
  const chromaLerp = (t: number) => interpAt(cfg.chroma.min, cfg.chroma.max, t, cfg.interp)

  const out: PrimitiveSolid[] = []

  for (let step = 0; step < cfg.steps; step++) {
    const t = ts[step]
    const values: Partial<Record<Mode, OklchValue>> = {}

    for (const mode of colors.modes) {
      const baseFromTo =
        mode === 'dark' || mode === 'dark_ic' ? cfg.lightness.dark : cfg.lightness.light
      let L = interpAt(baseFromTo.from, baseFromTo.to, t, cfg.interp)

      if (isIcMode(mode)) {
        const sign = mode === 'light_ic' ? 1 : -1
        L += cfg.lightness_ic_delta * sign
      }

      L = clamp01(L)
      const C = chromaLerp(t)
      const H = cfg.hue

      const raw: OklchValue = { L, C, H }
      values[mode] = fitToGamut(raw, colors.gamut, `neutral-${step}/${mode}`, warnings)
    }

    out.push({
      name: `neutral-${step}`,
      group: 'neutral',
      id: String(step),
      values: values as Record<Mode, OklchValue>,
    })
  }

  return out
}

// ─── Accents ────────────────────────────────────────────────────────────

function generateAccents(colors: ColorsConfig, warnings: string[]): PrimitiveSolid[] {
  const out: PrimitiveSolid[] = []

  for (const [name, def] of Object.entries(colors.accents)) {
    const values: Partial<Record<Mode, OklchValue>> = {}

    for (const mode of colors.modes) {
      const override = def.overrides?.[mode]
      let raw: OklchValue

      if (override) {
        raw = override
      } else if (mode === 'light') {
        raw = def.light
      } else {
        const delta = colors.mode_derivation[mode]
        raw = {
          L: clamp01(def.light.L + delta.dL),
          C: Math.max(0, Math.min(0.4, def.light.C + delta.dC)),
          H: ((def.light.H + delta.dH) % 360 + 360) % 360,
        }
      }

      values[mode] = fitToGamut(raw, colors.gamut, `${name}/${mode}`, warnings)
    }

    out.push({
      name,
      group: 'accent',
      id: name,
      values: values as Record<Mode, OklchValue>,
    })
  }

  return out
}

// ─── Statics ────────────────────────────────────────────────────────────

function generateStatics(colors: ColorsConfig): PrimitiveSolid[] {
  // Static anchors are mode-invariant by design; we repeat the same value
  // across all modes so downstream code doesn't have to special-case them.
  const fill = (v: OklchValue): Record<Mode, OklchValue> =>
    MODES.reduce<Record<Mode, OklchValue>>(
      (acc, mode) => ((acc[mode] = v), acc),
      {} as Record<Mode, OklchValue>,
    )

  return [
    {
      name: 'static-white',
      group: 'static',
      id: 'white',
      values: fill(colors.statics.white),
    },
    {
      name: 'static-dark',
      group: 'static',
      id: 'dark',
      values: fill(colors.statics.dark),
    },
  ]
}

// ─── Helpers ────────────────────────────────────────────────────────────

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}

function fitToGamut(
  raw: OklchValue,
  gamut: 'p3' | 'srgb',
  label: string,
  warnings: string[],
): OklchValue {
  const check = gamut === 'p3' ? isInP3Gamut : undefined
  if (!check || check(raw)) return roundOklch(raw)
  const clamped = clampToGamut(raw, gamut)
  warnings.push(
    `${label}: OKLCH out of ${gamut} gamut (C=${raw.C.toFixed(3)} @ L=${raw.L.toFixed(3)}, H=${raw.H.toFixed(1)}). Clamped to C=${clamped.C.toFixed(3)}.`,
  )
  return roundOklch(clamped)
}
