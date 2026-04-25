/**
 * Semantic colour generation — labels, fills, borders, fx, misc.
 *
 * @governs implementation-plan-v2.md §5 (semantics) · §1.3 (pipeline)
 *
 * Turns the declarative `SemanticsConfig` into a flat list of
 * {@link ResolvedSemantic}s. Every semantic is resolved for all 4
 * output keys (light/normal, light/ic, dark/normal, dark/ic).
 *
 * Backgrounds are resolved FIRST so downstream pipeline semantics can
 * reference them in their `canonical_bg`.
 */

import type {
  BaseMode,
  ColorsConfig,
  Contrast,
  OklchWithAlpha,
  OutputKey,
  PrimitiveColorSet,
  ResolvedSemantic,
  SemanticColorSet,
  SemanticDef,
  SemanticsConfig,
  ShadowPreset,
  ShadowLayerDef,
  ShadowPresetsConfig,
  TierName,
} from '../types'
import { BASE_MODES, CONTRASTS, outputKey } from '../types'
import { resolveSemantic, type ResolveContext } from './resolver'
import { oklchToApcaY } from '../utils/apca-inverse'
import { APCAcontrast } from 'apca-w3'
import { roundOklch } from '../utils/oklch'

/**
 * Flat description of a semantic to emit. Produced by walking the config
 * tree. Order matters: backgrounds MUST appear before pipeline tokens
 * that reference them.
 */
interface SemEntry {
  name: string
  path: string
  def: SemanticDef
  /** Tier + bg for post-resolution diagnostic. */
  diagnostic_tier?: TierName
  diagnostic_bg_path?: string
}

export function generateSemanticColors(
  semantics: SemanticsConfig,
  primitives: PrimitiveColorSet,
  colors: ColorsConfig,
): SemanticColorSet {
  const entries = collectEntries(semantics)
  const tokens: ResolvedSemantic[] = []
  const semanticMap = new Map<string, Record<OutputKey, OklchWithAlpha>>()

  for (const entry of entries) {
    const values: Partial<Record<OutputKey, OklchWithAlpha>> = {}
    for (const mode of BASE_MODES) {
      for (const contrast of CONTRASTS) {
        const ctx: ResolveContext = {
          mode,
          contrast,
          colors,
          primitives,
          semanticMap,
        }
        const resolved = resolveSemantic(entry.def, ctx)
        values[outputKey(mode, contrast)] = {
          ...roundOklch({ L: resolved.L, C: resolved.C, H: resolved.H }),
          alpha: resolved.alpha,
        }
      }
    }
    const final = values as Record<OutputKey, OklchWithAlpha>
    semanticMap.set(entry.path, final)

    const token: ResolvedSemantic = {
      name: entry.name,
      path: entry.path,
      values: final,
    }

    // Diagnostic APCA for pipeline tokens
    if (
      entry.diagnostic_tier &&
      entry.diagnostic_bg_path &&
      semanticMap.has(entry.diagnostic_bg_path)
    ) {
      const bgVals = semanticMap.get(entry.diagnostic_bg_path)!
      const target: Record<OutputKey, number> = {} as Record<OutputKey, number>
      const measured: Record<OutputKey, number> = {} as Record<OutputKey, number>
      for (const mode of BASE_MODES) {
        for (const contrast of CONTRASTS) {
          const key = outputKey(mode, contrast)
          const targets = colors.tier_targets[entry.diagnostic_tier][contrast]
          target[key] = targets.apca
          const fgY = oklchToApcaY(final[key])
          const bgY = oklchToApcaY(bgVals[key])
          measured[key] = Math.abs(APCAcontrast(fgY, bgY) as number)
        }
      }
      token.diagnostic = {
        bg_path: entry.diagnostic_bg_path,
        tier: entry.diagnostic_tier,
        target_apca: target,
        measured_apca: measured,
      }
    }

    tokens.push(token)
  }

  const shadow_presets = buildShadowPresets(semantics.fx.shadow_presets)

  return { tokens, shadow_presets }
}

// ─── Walk config → flat entry list ──────────────────────────────────────

function collectEntries(semantics: SemanticsConfig): SemEntry[] {
  const out: SemEntry[] = []

  // Backgrounds first (canonical_bg targets)
  out.push({
    name: 'bg-primary',
    path: 'backgrounds.neutral.primary',
    def: semantics.backgrounds.neutral.primary,
  })
  out.push({
    name: 'bg-secondary',
    path: 'backgrounds.neutral.secondary',
    def: semantics.backgrounds.neutral.secondary,
  })
  out.push({
    name: 'bg-tertiary',
    path: 'backgrounds.neutral.tertiary',
    def: semantics.backgrounds.neutral.tertiary,
  })
  // SPEC §5.1: mode-flipping inverted background (always opposite of mode primary).
  out.push({
    name: 'bg-inverted',
    path: 'backgrounds.neutral.inverted',
    def: semantics.backgrounds.neutral.inverted,
  })
  // SPEC §5.1 / §10.D7: nested-card grouped hierarchy.
  out.push({
    name: 'bg-grouped-primary',
    path: 'backgrounds.neutral.grouped.primary',
    def: semantics.backgrounds.neutral.grouped.primary,
  })
  out.push({
    name: 'bg-grouped-secondary',
    path: 'backgrounds.neutral.grouped.secondary',
    def: semantics.backgrounds.neutral.grouped.secondary,
  })
  out.push({
    name: 'bg-grouped-tertiary',
    path: 'backgrounds.neutral.grouped.tertiary',
    def: semantics.backgrounds.neutral.grouped.tertiary,
  })
  // Legacy alias — kept for v0.2.x backward compat.
  out.push({
    name: 'bg-overlay',
    path: 'backgrounds.overlay',
    def: semantics.backgrounds.overlay,
  })
  // SPEC §5.1: 4-tier overlay scrims for modals, tooltips, sheets.
  out.push({
    name: 'bg-overlay-ghost',
    path: 'backgrounds.overlay_tiers.ghost',
    def: semantics.backgrounds.overlay_tiers.ghost,
  })
  out.push({
    name: 'bg-overlay-soft',
    path: 'backgrounds.overlay_tiers.soft',
    def: semantics.backgrounds.overlay_tiers.soft,
  })
  out.push({
    name: 'bg-overlay-base',
    path: 'backgrounds.overlay_tiers.base',
    def: semantics.backgrounds.overlay_tiers.base,
  })
  out.push({
    name: 'bg-overlay-strong',
    path: 'backgrounds.overlay_tiers.strong',
    def: semantics.backgrounds.overlay_tiers.strong,
  })
  // Legacy alias — kept for v0.2.x backward compat.
  out.push({
    name: 'bg-static',
    path: 'backgrounds.static',
    def: semantics.backgrounds.static,
  })
  // SPEC §5.1: mode-invariant statics (always white / always near-black).
  out.push({
    name: 'bg-static-light',
    path: 'backgrounds.static_tiers.light',
    def: semantics.backgrounds.static_tiers.light,
  })
  out.push({
    name: 'bg-static-dark',
    path: 'backgrounds.static_tiers.dark',
    def: semantics.backgrounds.static_tiers.dark,
  })

  // Labels
  const labels = semantics.labels
  pushTier4(out, 'label-neutral', 'labels.neutral', labels.neutral)
  out.push({
    name: 'label-inverted',
    path: 'labels.inverted',
    def: labels.inverted,
  })
  pushTier4(out, 'label-brand', 'labels.brand', labels.brand)
  pushTier4(out, 'label-danger', 'labels.danger', labels.danger)
  pushTier4(out, 'label-warning', 'labels.warning', labels.warning)
  pushTier4(out, 'label-success', 'labels.success', labels.success)
  pushTier4(out, 'label-info', 'labels.info', labels.info)
  out.push({
    name: 'label-static-light',
    path: 'labels.static.light',
    def: labels.static.light,
  })
  out.push({
    name: 'label-static-dark',
    path: 'labels.static.dark',
    def: labels.static.dark,
  })

  // Fills
  const fills = semantics.fills
  pushTier4(out, 'fill-neutral', 'fills.neutral', fills.neutral)
  pushTier4(out, 'fill-brand', 'fills.brand', fills.brand)
  pushTier4(out, 'fill-danger', 'fills.danger', fills.danger)
  pushTier4(out, 'fill-warning', 'fills.warning', fills.warning)
  pushTier4(out, 'fill-success', 'fills.success', fills.success)
  pushTier4(out, 'fill-info', 'fills.info', fills.info)
  out.push({
    name: 'fill-static-light',
    path: 'fills.static.light',
    def: fills.static.light,
  })
  out.push({
    name: 'fill-static-dark',
    path: 'fills.static.dark',
    def: fills.static.dark,
  })

  // Borders — per SPEC §5.4 / §10.D1+D2:
  //   neutral has strong/base/soft/ghost/inverted; accents have strong/base/soft only.
  const borders = semantics.borders
  pushBorder(out, 'border-neutral', 'borders.neutral', borders.neutral, BORDER_TIERS_NEUTRAL)
  pushBorder(out, 'border-brand', 'borders.brand', borders.brand, BORDER_TIERS_ACCENT)
  pushBorder(out, 'border-danger', 'borders.danger', borders.danger, BORDER_TIERS_ACCENT)
  pushBorder(out, 'border-warning', 'borders.warning', borders.warning, BORDER_TIERS_ACCENT)
  pushBorder(out, 'border-success', 'borders.success', borders.success, BORDER_TIERS_ACCENT)
  pushBorder(out, 'border-info', 'borders.info', borders.info, BORDER_TIERS_ACCENT)
  out.push({
    name: 'border-static-light',
    path: 'borders.static.light',
    def: borders.static.light,
  })
  out.push({
    name: 'border-static-dark',
    path: 'borders.static.dark',
    def: borders.static.dark,
  })

  // FX
  const fx = semantics.fx
  for (const name of ['Neutral', 'Inverted', 'Brand', 'Danger', 'Warning'] as const) {
    const def = fx.glow[name]
    out.push({
      name: `fx-glow-${name.toLowerCase()}`,
      path: `fx.glow.${name}`,
      def,
    })
  }
  for (const name of ['Success', 'Info'] as const) {
    const def = fx.legacy_glow[name]
    out.push({
      name: `fx-glow-${name.toLowerCase()}`,
      path: `fx.legacy_glow.${name}`,
      def,
    })
  }
  for (const name of ['Neutral', 'Brand', 'Danger', 'Warning'] as const) {
    const def = fx.focus_ring[name]
    out.push({
      name: `fx-focus-ring-${name.toLowerCase()}`,
      path: `fx.focus_ring.${name}`,
      def,
    })
  }
  out.push({
    name: 'fx-focus-ring',
    path: 'fx.focus_ring_legacy',
    def: fx.focus_ring_legacy,
  })
  out.push({
    name: 'fx-skeleton-base',
    path: 'fx.skeleton.base',
    def: fx.skeleton.base,
  })
  out.push({
    name: 'fx-skeleton-highlight',
    path: 'fx.skeleton.highlight',
    def: fx.skeleton.highlight,
  })
  out.push({
    name: 'fx-skeleton',
    path: 'fx.skeleton.legacy',
    def: fx.skeleton.legacy,
  })

  // Shadow tints (colors used inside progressive shadow preset strings).
  out.push({
    name: 'fx-shadow-minor',
    path: 'fx.shadow_tints.minor',
    def: fx.shadow_tints.minor,
  })
  out.push({
    name: 'fx-shadow-ambient',
    path: 'fx.shadow_tints.ambient',
    def: fx.shadow_tints.ambient,
  })
  out.push({
    name: 'fx-shadow-penumbra',
    path: 'fx.shadow_tints.penumbra',
    def: fx.shadow_tints.penumbra,
  })
  out.push({
    name: 'fx-shadow-major',
    path: 'fx.shadow_tints.major',
    def: fx.shadow_tints.major,
  })

  // Misc
  const misc = semantics.misc
  out.push({
    name: 'badge-label-contrast',
    path: 'misc.badge.label_contrast',
    def: misc.badge.label_contrast,
  })
  out.push({
    name: 'badge-label-default',
    path: 'misc.badge.label_default',
    def: misc.badge.label_default,
  })
  out.push({ name: 'control-bg', path: 'misc.control.bg', def: misc.control.bg })

  // Annotate pipeline entries with diagnostic refs
  for (const e of out) {
    if (e.def.kind === 'pipeline') {
      e.diagnostic_tier = e.def.tier
      e.diagnostic_bg_path =
        e.def.canonical_bg.kind === 'semantic'
          ? e.def.canonical_bg.path
          : undefined
    }
  }

  return out
}

function pushTier4(
  out: SemEntry[],
  prefix: string,
  pathPrefix: string,
  set: Record<string, SemanticDef>,
) {
  for (const tier of ['primary', 'secondary', 'tertiary', 'quaternary']) {
    const def = set[tier]
    if (!def) continue
    out.push({
      name: `${prefix}-${tier}`,
      path: `${pathPrefix}.${tier}`,
      def,
    })
  }
}

/**
 * Emit semantic entries for a border tier set.
 *
 * Per SPEC §5.4 / §10.D1+D2:
 *   - Accent borders (Brand/Danger/Warning/Success/Info): strong, base, soft.
 *   - Neutral border: strong, base, soft, ghost, inverted.
 *
 * Iteration order is fixed for snapshot stability. `tiers` parameter is
 * required (no defaulting to a superset) to ensure callers explicitly state
 * which contract the family follows.
 */
function pushBorder(
  out: SemEntry[],
  prefix: string,
  pathPrefix: string,
  set: Record<string, SemanticDef>,
  tiers: readonly string[],
) {
  for (const tier of tiers) {
    const def = set[tier]
    if (!def) continue
    out.push({
      name: `${prefix}-${tier}`,
      path: `${pathPrefix}.${tier}`,
      def,
    })
  }
}

const BORDER_TIERS_NEUTRAL = ['strong', 'base', 'soft', 'ghost', 'inverted'] as const
// `ghost` here is deprecated (SPEC §10.D1) and removed in 0.3.0; entries
// in `config.deprecated` add the warning banner. Until then we emit the
// var so consumers don't break.
const BORDER_TIERS_ACCENT = ['strong', 'base', 'soft', 'ghost'] as const

// ─── Shadow presets ─────────────────────────────────────────────────────

function buildShadowPresets(presets: ShadowPresetsConfig): ShadowPreset[] {
  const tintToVar: Record<ShadowLayerDef['tint'], string> = {
    minor: '--fx-shadow-minor',
    ambient: '--fx-shadow-ambient',
    penumbra: '--fx-shadow-penumbra',
    major: '--fx-shadow-major',
  }

  return (['xs', 's', 'm', 'l', 'xl'] as const).map((name) => ({
    name,
    layers: presets[name].map((layer) => ({
      y: layer.y,
      blur: layer.blur,
      spread: layer.spread,
      tint_var: tintToVar[layer.tint],
    })),
  }))
}
