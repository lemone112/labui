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
  ShadowTintsConfig,
  TierName,
} from '../types'
import { BASE_MODES, CONTRASTS, outputKey } from '../types'
import { resolveSemantic, type ResolveContext } from './resolver'
import { oklchToApcaY } from '../utils/apca-inverse'
import { wcagContrast } from '../utils/wcag'
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

    // Diagnostic APCA (+ WCAG when tier declares a floor) for pipeline tokens
    if (
      entry.diagnostic_tier &&
      entry.diagnostic_bg_path &&
      semanticMap.has(entry.diagnostic_bg_path)
    ) {
      const bgVals = semanticMap.get(entry.diagnostic_bg_path)!
      const target: Record<OutputKey, number> = {} as Record<OutputKey, number>
      const measured: Record<OutputKey, number> = {} as Record<OutputKey, number>
      const target_wcag: Record<OutputKey, number> = {} as Record<OutputKey, number>
      const measured_wcag: Record<OutputKey, number> = {} as Record<OutputKey, number>
      let hasWcagTarget = false
      for (const mode of BASE_MODES) {
        for (const contrast of CONTRASTS) {
          const key = outputKey(mode, contrast)
          const targets = colors.tier_targets[entry.diagnostic_tier][contrast]
          target[key] = targets.apca
          const fgY = oklchToApcaY(final[key])
          const bgY = oklchToApcaY(bgVals[key])
          measured[key] = Math.abs(APCAcontrast(fgY, bgY) as number)
          if (targets.wcag != null) {
            hasWcagTarget = true
            target_wcag[key] = targets.wcag
            measured_wcag[key] = wcagContrast(final[key], bgVals[key])
          }
        }
      }
      token.diagnostic = {
        bg_path: entry.diagnostic_bg_path,
        tier: entry.diagnostic_tier,
        target_apca: target,
        measured_apca: measured,
        ...(hasWcagTarget
          ? { target_wcag, measured_wcag }
          : {}),
      }
    }

    tokens.push(token)
  }

  const shadow_presets = buildShadowPresets(
    semantics.fx.shadow_presets,
    semantics.fx.shadow_tints,
  )

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
  out.push({
    name: 'bg-overlay',
    path: 'backgrounds.overlay',
    def: semantics.backgrounds.overlay,
  })
  out.push({
    name: 'bg-static',
    path: 'backgrounds.static',
    def: semantics.backgrounds.static,
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

  // Borders
  const borders = semantics.borders
  pushBorder(out, 'border-neutral', 'borders.neutral', borders.neutral)
  pushBorder(out, 'border-brand', 'borders.brand', borders.brand)
  pushBorder(out, 'border-danger', 'borders.danger', borders.danger)
  pushBorder(out, 'border-warning', 'borders.warning', borders.warning)
  pushBorder(out, 'border-success', 'borders.success', borders.success)
  pushBorder(out, 'border-info', 'borders.info', borders.info)
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
  for (const [sent, def] of Object.entries(fx.glow)) {
    out.push({
      name: `fx-glow-${sent.toLowerCase()}`,
      path: `fx.glow.${sent}`,
      def,
    })
  }
  out.push({ name: 'fx-focus-ring', path: 'fx.focus_ring', def: fx.focus_ring })
  out.push({ name: 'fx-skeleton', path: 'fx.skeleton', def: fx.skeleton })

  // Shadow tints (flat primitive refs — emit as semantics so consumers can use them)
  out.push({
    name: 'fx-shadow-minor',
    path: 'fx.shadow_tints.minor',
    def: { kind: 'direct', ref: fx.shadow_tints.minor },
  })
  out.push({
    name: 'fx-shadow-ambient',
    path: 'fx.shadow_tints.ambient',
    def: { kind: 'direct', ref: fx.shadow_tints.ambient },
  })
  out.push({
    name: 'fx-shadow-penumbra',
    path: 'fx.shadow_tints.penumbra',
    def: { kind: 'direct', ref: fx.shadow_tints.penumbra },
  })
  out.push({
    name: 'fx-shadow-major',
    path: 'fx.shadow_tints.major',
    def: { kind: 'direct', ref: fx.shadow_tints.major },
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

function pushBorder(
  out: SemEntry[],
  prefix: string,
  pathPrefix: string,
  set: Record<string, SemanticDef>,
) {
  for (const tier of ['strong', 'base', 'soft', 'ghost']) {
    const def = set[tier]
    if (!def) continue
    out.push({
      name: `${prefix}-${tier}`,
      path: `${pathPrefix}.${tier}`,
      def,
    })
  }
}

// ─── Shadow presets ─────────────────────────────────────────────────────

function buildShadowPresets(
  presets: ShadowPresetsConfig,
  _tints: ShadowTintsConfig,
): ShadowPreset[] {
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
