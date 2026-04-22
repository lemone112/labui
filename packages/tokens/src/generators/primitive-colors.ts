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
    for (let step = 0; step < n.steps; step++) {
      const t = n.steps > 1 ? step / (n.steps - 1) : 0
      let L: number
      if (n.lightness_curve === 'linear') {
        L = endpoints.L0 + (endpoints.L12 - endpoints.L0) * t
      } else {
        // 'apple' — subtle S-curve, emphasizes mid-range
        const k = smootherstep(t)
        L = endpoints.L0 + (endpoints.L12 - endpoints.L0) * k
      }
      const C = neutralChromaAt(n.chroma_curve, step, n.steps)
      const H = driftedHue(
        n.hue_drift.start_H,
        n.hue_drift.end_H,
        step,
        n.steps,
        n.hue_drift.easing,
      )
      physical[contrast].push({ L, C, H })
    }
  }

  for (let step = 0; step < n.steps; step++) {
    const values: Partial<Record<OutputKey, OklchValue>> = {}
    for (const mode of BASE_MODES) {
      for (const contrast of CONTRASTS) {
        const key = outputKey(mode, contrast)
        const physIdx = mode === 'dark' ? n.steps - 1 - step : step
        let v = physical[contrast][physIdx]
        // Neutrals are achromatic-ish — perceptual comp effect is minimal,
        // but we apply it uniformly so label-on-neutral and label-on-accent
        // participate in the same pipeline.
        v = applyPerceptualComp(v, mode, colors.perceptual_comp)
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

function smootherstep(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10)
}
