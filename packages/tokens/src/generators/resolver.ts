/**
 * Unified resolution pipeline — one function for every semantic.
 *
 * @governs implementation-plan-v2.md §1.3 · Resolution pipeline
 *
 * Pipeline steps (in order):
 *
 *   1. apca_inverse(target_Lc, bg_L)  → target_L
 *   2. spine_interp(accent.spine, L)  → raw H (and optional C)
 *   3. apply_chroma_curve(accent, L)  → raw C
 *   4. apply_perceptual_comp(mode)    → physical OKLCH
 *   5. gamut_clamp(p3)                → final OKLCH
 *   6. optional: compose(alpha)       → OklchWithAlpha
 *
 * All semantics funnel through this pipeline. No per-tier branching,
 * no per-mode special cases — the cells decide behavior.
 */

import type {
  AccentDef,
  AccentName,
  BgContextRef,
  ColorsConfig,
  Contrast,
  BaseMode,
  OklchValue,
  OklchWithAlpha,
  OutputKey,
  PerceptualCompCell,
  PrimitiveColorSet,
  PrimitiveRef,
  ResolvedPrimitive,
  SemanticDef,
  TierName,
} from '../types'
import { outputKey } from '../types'
import { apcaInverse, oklchToApcaY, resolveOrientation } from '../utils/apca-inverse'
import { wcagInverse } from '../utils/wcag'
import { accentChromaAt, driftedHue, neutralChromaAt } from '../utils/chroma-curve'
import { spineInterp } from '../utils/spine'
import { clampToGamut, isInP3Gamut, isInSrgbGamut } from '../utils/oklch'

export interface ResolveContext {
  mode: BaseMode
  contrast: Contrast
  colors: ColorsConfig
  primitives: PrimitiveColorSet
  /** Semantic tree with resolved canonical bgs (for cross-ref) */
  semanticMap: Map<string, Record<OutputKey, OklchWithAlpha>>
}

/**
 * Resolve a semantic def to a final OKLCH + alpha.
 */
export function resolveSemantic(
  def: SemanticDef,
  ctx: ResolveContext,
): OklchWithAlpha {
  switch (def.kind) {
    case 'direct':
      return resolveDirect(def.ref, ctx)
    case 'pipeline':
      return resolvePipeline(def, ctx)
    case 'mode-branch': {
      const key = outputKey(ctx.mode, ctx.contrast)
      const branch = def.branches[key] ?? def.fallback
      if (!branch) {
        throw new Error(
          `resolver: mode-branch has no branch for '${key}' and no fallback`,
        )
      }
      if ('family' in branch) {
        return resolveDirect(branch, ctx)
      }
      return resolveSemantic(branch, ctx)
    }
  }
}

// ─── Direct resolution (primitive + optional opacity) ──────────────────

function resolveDirect(
  ref: PrimitiveRef,
  ctx: ResolveContext,
): OklchWithAlpha {
  const base = lookupPrimitive(ref, ctx)
  const alpha = ref.opacity_stop != null ? ref.opacity_stop / 100 : 1
  return { ...base, alpha }
}

function lookupPrimitive(
  ref: PrimitiveRef,
  ctx: ResolveContext,
): OklchValue {
  const key = outputKey(ctx.mode, ctx.contrast)
  let group: ResolvedPrimitive[]
  switch (ref.family) {
    case 'neutral':
      group = ctx.primitives.neutrals
      break
    case 'accent':
      group = ctx.primitives.accents
      break
    case 'static':
      group = ctx.primitives.statics
      break
  }
  const found = group.find((p) => p.id === ref.id)
  if (!found) {
    throw new Error(
      `resolver: primitive '${ref.family}:${ref.id}' not found in resolved primitives`,
    )
  }
  return found.values[key]
}

// ─── Pipeline resolution (spine + contrast) ────────────────────────────

function resolvePipeline(
  def: Extract<SemanticDef, { kind: 'pipeline' }>,
  ctx: ResolveContext,
): OklchWithAlpha {
  const targets = ctx.colors.tier_targets[def.tier]
  const target_apca = targets[ctx.contrast].apca
  const target_wcag = targets[ctx.contrast].wcag

  // 1. Find bg luminance
  const bg = resolveBgContext(def.canonical_bg, ctx)
  const orientation = resolveOrientation(def.orientation ?? 'auto', bg.L)

  // 2. Primitive-family-specific resolution
  let raw: OklchValue
  if (def.primitive.family === 'accent') {
    raw = resolveAccentPipeline(
      def.primitive.id as AccentName,
      target_apca,
      target_wcag,
      bg,
      orientation,
      ctx,
    )
  } else if (def.primitive.family === 'neutral') {
    raw = resolveNeutralPipeline(
      target_apca,
      target_wcag,
      bg,
      orientation,
      ctx,
    )
  } else {
    // static — just look up
    raw = lookupPrimitive(def.primitive, ctx)
  }

  return { ...raw, alpha: 1 }
}

/**
 * Pick the L that satisfies BOTH the APCA and WCAG targets. Since both
 * binary searches operate on the same monotonic axis (APCA and WCAG
 * both increase with |fg.L − bg.L|), the stricter target is simply the
 * one further from `bg.L` — i.e. smaller when `dir === 'darker'`,
 * larger when `dir === 'lighter'`. When no WCAG target is declared,
 * this degrades to the APCA-only behaviour.
 */
function pickStricterL(
  apca_L: number,
  wcag_L: number | null,
  dir: 'darker' | 'lighter',
): number {
  if (wcag_L == null) return apca_L
  return dir === 'darker' ? Math.min(apca_L, wcag_L) : Math.max(apca_L, wcag_L)
}

function resolveAccentPipeline(
  accentName: AccentName,
  target_apca: number,
  target_wcag: number | undefined,
  bg: OklchValue,
  orientation: 'darker' | 'lighter',
  ctx: ResolveContext,
): OklchValue {
  const accentDef = resolveAccentDef(accentName, ctx.colors)

  // build_candidate simulates the full post-processing chain so
  // binary-search operates in the same space as final output:
  //   spine_interp → chroma_curve → perceptual_comp → gamut_clamp
  const build = (L: number): OklchValue => {
    const { H, C: spineC } = spineInterp(accentDef.spine, L)
    const C = accentChromaAt(
      accentDef.chroma_curve,
      L,
      spineC,
      accentDef.chroma_boost_per_dL,
      ctx.colors.vibrancy,
    )
    let v: OklchValue = { L, C, H }
    v = applyPerceptualComp(v, ctx.mode, ctx.colors.perceptual_comp)
    v = fitGamut(v, ctx.colors.gamut)
    return v
  }

  const apcaL = apcaInverse(target_apca, bg, build, orientation).L
  const wcagL =
    target_wcag != null
      ? wcagInverse(target_wcag, bg, build, orientation).L
      : null
  return build(pickStricterL(apcaL, wcagL, orientation))
}

function resolveNeutralPipeline(
  target_apca: number,
  target_wcag: number | undefined,
  bg: OklchValue,
  orientation: 'darker' | 'lighter',
  ctx: ResolveContext,
): OklchValue {
  const n = ctx.colors.neutrals
  const hue_at = (L: number) => {
    // Approximate step index from L across endpoint range
    const lo =
      ctx.contrast === 'ic' ? n.endpoints_ic.L12 : n.endpoints_normal.L12
    const hi =
      ctx.contrast === 'ic' ? n.endpoints_ic.L0 : n.endpoints_normal.L0
    const t = (hi - L) / (hi - lo)
    const step = Math.max(0, Math.min(n.steps - 1, t * (n.steps - 1)))
    return driftedHue(n.hue_drift.start_H, n.hue_drift.end_H, step, n.steps, n.hue_drift.easing)
  }
  const chroma_at = (L: number) => {
    const lo =
      ctx.contrast === 'ic' ? n.endpoints_ic.L12 : n.endpoints_normal.L12
    const hi =
      ctx.contrast === 'ic' ? n.endpoints_ic.L0 : n.endpoints_normal.L0
    const t = (hi - L) / (hi - lo)
    const step = Math.max(0, Math.min(n.steps - 1, t * (n.steps - 1)))
    return neutralChromaAt(n.chroma_curve, step, n.steps)
  }

  const build = (L: number): OklchValue => {
    let v: OklchValue = { L, C: chroma_at(L), H: hue_at(L) }
    v = applyPerceptualComp(v, ctx.mode, ctx.colors.perceptual_comp)
    v = fitGamut(v, ctx.colors.gamut)
    return v
  }
  const apcaL = apcaInverse(target_apca, bg, build, orientation).L
  const wcagL =
    target_wcag != null
      ? wcagInverse(target_wcag, bg, build, orientation).L
      : null
  return build(pickStricterL(apcaL, wcagL, orientation))
}

// ─── Supporting ops ────────────────────────────────────────────────────

export function resolveAccentDef(
  name: AccentName,
  colors: ColorsConfig,
): AccentDef {
  const raw = colors.accents[name]
  if ('alias' in raw) {
    return resolveAccentDef(raw.alias, colors)
  }
  return raw
}

export function applyPerceptualComp(
  v: OklchValue,
  mode: BaseMode,
  cfg: ColorsConfig['perceptual_comp'],
): OklchValue {
  if (!cfg.enable) return v
  const cell: PerceptualCompCell = mode === 'dark' ? cfg.dark : cfg.light
  return {
    L: clamp01(v.L + cell.lightness_shift),
    C: Math.max(0, v.C * cell.chroma_mult),
    H: (v.H + cell.hue_shift + 360) % 360,
  }
}

export function fitGamut(
  v: OklchValue,
  gamut: 'p3' | 'srgb',
): OklchValue {
  const check = gamut === 'p3' ? isInP3Gamut : isInSrgbGamut
  if (check(v)) return v
  return clampToGamut(v, gamut)
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

// ─── Bg context resolution ─────────────────────────────────────────────

function resolveBgContext(
  bg: BgContextRef,
  ctx: ResolveContext,
): OklchValue {
  const key = outputKey(ctx.mode, ctx.contrast)
  if (bg.kind === 'primitive') {
    return lookupPrimitive(bg.ref, ctx)
  }
  const resolved = ctx.semanticMap.get(bg.path)
  if (!resolved) {
    throw new Error(
      `resolver: bg context '${bg.path}' not resolved yet — ensure backgrounds are emitted first`,
    )
  }
  const v = resolved[key]
  return { L: v.L, C: v.C, H: v.H }
}

export { oklchToApcaY }
