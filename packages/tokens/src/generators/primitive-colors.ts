/**
 * Primitive colour generation — neutrals, accents, statics.
 *
 * @governs implementation-plan-v2.md §4.1 (neutrals) · §4.2 (accents) · §4.3 (comp)
 *
 * Output: a {@link PrimitiveColorSet} with one OKLCH value per
 * {@link OutputKey} (light/normal, light/ic, dark/normal, dark/ic) for
 * every primitive. Opacity composition happens at the semantic layer.
 */

import type {
  AccentDef,
  AccentName,
  ColorsConfig,
  Contrast,
  BaseMode,
  OklchValue,
  OutputKey,
  PrimitiveColorSet,
  ResolvedPrimitive,
  SpineControl,
} from '../types'
import { BASE_MODES, CONTRASTS, outputKey } from '../types'
import { accentChromaAt, driftedHue, neutralChromaAt } from '../utils/chroma-curve'
import { spineInterp, validateSpine } from '../utils/spine'
import { applyPerceptualComp, fitGamut, resolveAccentDef } from './resolver'
import { roundOklch } from '../utils/oklch'

export interface GenerateOptions {
  warnings?: string[]
}

export function generatePrimitiveColors(
  colors: ColorsConfig,
  options: GenerateOptions = {},
): PrimitiveColorSet {
  const warnings = options.warnings ?? []

  // Validate spines upfront (fail-fast)
  for (const [name, def] of Object.entries(colors.accents)) {
    if ('alias' in def) continue
    const errs = validateSpine(def.spine, name)
    if (errs.length > 0) {
      throw new Error(`spine validation failed:\n  ${errs.join('\n  ')}`)
    }
  }

  return {
    neutrals: generateNeutrals(colors, warnings),
    accents: generateAccents(colors, warnings),
    statics: generateStatics(colors),
    opacityStops: colors.opacity.stops,
  }
}

// ─── Neutrals ───────────────────────────────────────────────────────────
// Pivot-mirror: we generate the physical ladder from step 0 (lightest) to
// step 12 (darkest) in light mode; dark mode flips the index so step 0 in
// dark mode == step 12 in light mode (same physical L).

function generateNeutrals(
  colors: ColorsConfig,
  _warnings: string[],
): ResolvedPrimitive[] {
  const n = colors.neutrals
  const out: ResolvedPrimitive[] = []

  // For each contrast, compute physical L ladder once.
  const physical: Record<Contrast, OklchValue[]> = { normal: [], ic: [] }

  for (const contrast of CONTRASTS) {
    const endpoints =
      contrast === 'ic' ? n.endpoints_ic : n.endpoints_normal
    const lLadder = n.L_ladder?.[contrast]
    const cLadder = n.C_ladder?.[contrast]
    const hLadder = n.H_ladder?.[contrast]
    for (const [name, ladder] of [
      ['L_ladder', lLadder],
      ['C_ladder', cLadder],
      ['H_ladder', hLadder],
    ] as const) {
      if (ladder && ladder.length !== n.steps) {
        throw new Error(
          `neutrals.${name}.${contrast} has ${ladder.length} entries, expected ${n.steps}`,
        )
      }
    }
    for (let step = 0; step < n.steps; step++) {
      const t = n.steps > 1 ? step / (n.steps - 1) : 0
      let L: number
      if (lLadder) {
        L = lLadder[step]
      } else if (n.lightness_curve === 'linear') {
        L = endpoints.L0 + (endpoints.L12 - endpoints.L0) * t
      } else {
        // 'apple' — S-curve tuned to the Apple / Figma system-gray
        // palette. IC uses the full quintic smootherstep so mid-range
        // steps are pushed further away from 0.5 toward the nearer
        // endpoint (this is what gives IC mode its extra label-vs-bg
        // contrast). Normal mode uses a 50 / 50 blend with linear so
        // it isn't as aggressive at the edges — the step-10/11 rungs
        // in a 13-step scale would otherwise crush to the endpoint.
        const k = contrast === 'ic' ? quinticSmootherstep(t) : smootherstep(t)
        L = endpoints.L0 + (endpoints.L12 - endpoints.L0) * k
      }
      const C = cLadder
        ? cLadder[step]
        : neutralChromaAt(n.chroma_curve, step, n.steps)
      const H = hLadder
        ? hLadder[step]
        : driftedHue(
            n.hue_drift.start_H,
            n.hue_drift.end_H,
            step,
            n.steps,
            n.hue_drift.easing,
          )
      physical[contrast].push({ L, C, H })
    }
  }

  // When explicit ladders are configured the neutrals are already
  // calibrated per mode (via pivot-mirror of the physical ladder), so
  // layering perceptual compensation on top would double-adjust and
  // drift away from the reference palette. Keep comp for the curve-
  // driven fallback path where it still helps uniformity between
  // neutrals and accents.
  const skipComp = Boolean(n.L_ladder || n.C_ladder || n.H_ladder)
  for (let step = 0; step < n.steps; step++) {
    const values: Partial<Record<OutputKey, OklchValue>> = {}
    for (const mode of BASE_MODES) {
      for (const contrast of CONTRASTS) {
        const key = outputKey(mode, contrast)
        const physIdx = mode === 'dark' ? n.steps - 1 - step : step
        let v = physical[contrast][physIdx]
        if (!skipComp) {
          v = applyPerceptualComp(v, mode, colors.perceptual_comp)
        }
        v = fitGamut(v, colors.gamut)
        values[key] = roundOklch(v)
      }
    }

    out.push({
      name: `neutral-${step}`,
      group: 'neutral',
      id: String(step),
      values: values as Record<OutputKey, OklchValue>,
    })
  }

  return out
}

// ─── Accents ────────────────────────────────────────────────────────────
// Accent primitives = the canonical spine anchor (middle control point
// if 2+ points, or the sole point). This gives `--blue` etc. for direct
// consumption; tier-aware labels go through the resolver pipeline instead.
// For each mode we apply perceptual comp.

function generateAccents(
  colors: ColorsConfig,
  _warnings: string[],
): ResolvedPrimitive[] {
  const out: ResolvedPrimitive[] = []

  for (const name of Object.keys(colors.accents) as AccentName[]) {
    const def = resolveAccentDef(name, colors)
    const anchor = pickAnchor(def.spine)
    const anchorC =
      anchor.C ??
      accentChromaAt(
        def.chroma_curve,
        anchor.L,
        null,
        def.chroma_boost_per_dL,
        colors.vibrancy,
      )

    const values: Partial<Record<OutputKey, OklchValue>> = {}
    for (const mode of BASE_MODES) {
      for (const contrast of CONTRASTS) {
        const key = outputKey(mode, contrast)
        let v: OklchValue = { L: anchor.L, C: anchorC, H: anchor.H }
        v = applyPerceptualComp(v, mode, colors.perceptual_comp)
        v = fitGamut(v, colors.gamut)
        values[key] = roundOklch(v)
      }
    }

    out.push({
      name,
      group: 'accent',
      id: name,
      values: values as Record<OutputKey, OklchValue>,
    })
  }

  return out
}

/**
 * Pick the anchor control point for emitting the canonical `--{accent}` var.
 * Prefer the middle point with explicit C (Figma-anchored); fallback to
 * spine midpoint by interp.
 */
function pickAnchor(spine: SpineControl[]): SpineControl {
  const withC = spine.find((p) => p.C != null)
  if (withC) return withC
  if (spine.length === 1) return spine[0]
  // sample at midpoint
  const midL = (spine[0].L + spine[spine.length - 1].L) / 2
  const { H, C } = spineInterp(spine, midL)
  return { L: midL, H, C: C ?? undefined }
}

// ─── Statics ────────────────────────────────────────────────────────────

function generateStatics(colors: ColorsConfig): ResolvedPrimitive[] {
  const white = colors.statics.white
  const darkDef = colors.statics.dark
  const dark: OklchValue =
    'alias' in darkDef
      ? { L: 0.08, C: 0, H: 0 } // TODO: resolve alias to neutral step
      : darkDef

  const fill = (v: OklchValue): Record<OutputKey, OklchValue> => {
    const out: Partial<Record<OutputKey, OklchValue>> = {}
    for (const mode of BASE_MODES) {
      for (const contrast of CONTRASTS) {
        out[outputKey(mode, contrast)] = roundOklch(v)
      }
    }
    return out as Record<OutputKey, OklchValue>
  }

  return [
    { name: 'static-white', group: 'static', id: 'white', values: fill(white) },
    { name: 'static-dark', group: 'static', id: 'dark', values: fill(dark) },
  ]
}

// ─── Helpers ────────────────────────────────────────────────────────────

/**
 * Quintic smootherstep — `6t⁵ − 15t⁴ + 10t³`. Textbook S-curve used by
 * IC mode where a strong mid-range bias toward the endpoints is what
 * gives the higher label-vs-background contrast.
 */
function quinticSmootherstep(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10)
}

/**
 * Normal-mode lightness curve: 50 / 50 blend of the quintic smootherstep
 * with a straight line. Pure smootherstep bunches the endpoints
 * (k(1/12)=0.005, k(11/12)=0.995) which over-darkens the step-10/11
 * rungs on a 13-step scale and collapses step-1/2 to near-white. Pure
 * linear over-spreads the middle and ignores human L-sensitivity
 * peaking at ~50 %. The hybrid matches the reference Figma / Apple
 * system-gray palette within ΔE2000 ≤ 6 across both light and dark
 * normal modes.
 */
function smootherstep(t: number): number {
  return 0.5 * t + 0.5 * quinticSmootherstep(t)
}
