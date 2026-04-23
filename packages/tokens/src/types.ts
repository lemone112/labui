/**
 * Lab UI — Token type definitions (v2).
 *
 * @governs implementation-plan-v2.md §0 Executive summary · §2-8 Layers
 *
 * Phase 1.5 (this iteration) covers colors with:
 *   - Unified spine model for all accent tiers (no opacity-based tier derivation)
 *   - Perceptual compensation between light/dark (Hunt/HK)
 *   - Composition-derivable (color + opacity stay as independent primitives)
 *   - Progressive shadow presets (multi-layer box-shadow)
 *   - IC contrast mode orthogonal to light/dark base mode
 *
 * Layer 5+ (typography, z-index, materials) remain stubbed as `unknown`
 * until their respective PRs.
 */

// ─── Base mode × contrast (two orthogonal axes, 4 outputs) ──────────────

/**
 * Base rendering mode. Light / dark defines the background orientation
 * (light bg or dark bg). IC is a SEPARATE axis: {@link Contrast}.
 */
export const BASE_MODES = ['light', 'dark'] as const
export type BaseMode = (typeof BASE_MODES)[number]

/**
 * Contrast mode. `normal` = Figma anchors; `ic` = lift tier targets to
 * AAA-equivalent Lc (75 for body).
 */
export const CONTRASTS = ['normal', 'ic'] as const
export type Contrast = (typeof CONTRASTS)[number]

/**
 * Combined output key for emission. 4 outputs per token.
 */
export type OutputKey = `${BaseMode}/${Contrast}`
export const OUTPUT_KEYS: readonly OutputKey[] = [
  'light/normal',
  'light/ic',
  'dark/normal',
  'dark/ic',
] as const

export function outputKey(mode: BaseMode, contrast: Contrast): OutputKey {
  return `${mode}/${contrast}` as OutputKey
}

// ─── Primitive OKLCH colour value ───────────────────────────────────────

export interface OklchValue {
  L: number
  C: number
  H: number
}

export interface OklchWithAlpha extends OklchValue {
  alpha: number // 0..1
}

// ─── Config: units (L1) ────────────────────────────────────────────────

/**
 * Layer 1 — physical pixel scale.
 *
 * @governs plan-v2 §2 · Layer 1 Units
 */
export interface UnitsConfig {
  /** Base increment, typically 4 (px). Must produce integer px-1. */
  base_px: number
  /** Continuous float; recommended presets {0.75, 1.0, 1.166, 1.333}. */
  scaling: number
  /** px-N range — inclusive. Negative lower allowed. */
  px_range: { min: number; max: number }
  /** pt-N range. pt = half-pixel. */
  pt_range: { min: number; max: number }
}

export interface ResolvedUnits {
  px: Record<string, number> // 'px/-7' → -28 (raw number, unit added at emit)
  pt: Record<string, number> // 'pt/0' → 0
}

// ─── Config: dimensions (L2) ───────────────────────────────────────────

/**
 * Named step-map: semantic name → base index in px scale.
 * Airiness shifts final_step = base_step + log2(airiness) * step.
 *
 * @governs plan-v2 §3 · Layer 2 Dimensions
 */
export type StepMap = Record<string, number>

export interface DimensionsConfig {
  /** Multiplier for index shift (1.0 = identity, 1.25 ≈ +0.32 step). */
  airiness: number
  /** Layout/adaptive dimensions — px-step indices. */
  adaptives: StepMap
  spacing_padding: StepMap
  spacing_margin: StepMap
  radius: StepMap
  size: StepMap
  fx_blur: StepMap
  fx_shift: StepMap
  fx_spread: StepMap
}

export interface ResolvedDimensions {
  adaptives: Record<string, number>
  spacing_padding: Record<string, number>
  spacing_margin: Record<string, number>
  radius: Record<string, number>
  size: Record<string, number>
  fx_blur: Record<string, number>
  fx_shift: Record<string, number>
  fx_spread: Record<string, number>
}

// ─── Config: opacity stops (L2 primitive) ───────────────────────────────

export interface OpacityConfig {
  /**
   * Percentage stops, 0..100, sorted ascending, unique.
   * @governs plan §4.4 · Opacity primitive
   */
  stops: readonly number[]
}

// ─── Config: neutrals ───────────────────────────────────────────────────

export interface ChromaCurve {
  peak: number
  peak_step: number
  falloff: number
  floor: number
}

export interface HueDrift {
  start_H: number
  end_H: number
  easing: 'linear' | 'ease-in' | 'ease-out'
}

export interface NeutralsConfig {
  /**
   * Inclusive count, e.g. 13 → steps 0..12. Fixed at 13 for Lab UI.
   */
  steps: number
  /**
   * Pivot step index (usually middle). Physical scale generated once;
   * dark mode flips via index mirror (light[i] → dark[steps-1-i]).
   */
  pivot_step: number
  /**
   * Base hue for neutrals. 247 = cool-blue bias (Lab UI default).
   */
  hue: number
  /**
   * Endpoints for `normal` contrast. Symmetric around pivot.
   */
  endpoints_normal: { L0: number; L12: number }
  /**
   * Endpoints for `ic` contrast. L12=0.0 gives pure black in IC.
   */
  endpoints_ic: { L0: number; L12: number }
  /**
   * Chroma curve shape (peak at pivot_step, floor at endpoints).
   */
  chroma_curve: ChromaCurve
  /**
   * Hue drift across steps (courses mention slight warm drift).
   */
  hue_drift: HueDrift
  /**
   * Lightness curve between endpoints. 'linear' = simple, 'apple' = S-curve
   * biased so mid-values feel balanced perceptually.
   */
  lightness_curve: 'linear' | 'apple'
}

// ─── Config: accents (spines) ───────────────────────────────────────────

/**
 * A control point on an accent's chromatic spine.
 *
 * @governs plan §4.2 · Accent spines
 *
 * - `L`: OKLCH lightness (0..1)
 * - `H`: hue at this lightness
 * - `C`: optional chroma override; if omitted, comes from `chroma_curve`
 */
export interface SpineControl {
  L: number
  H: number
  C?: number
}

export interface AccentChromaCurve {
  peak: number
  peak_L: number
  falloff_low: number
  falloff_high: number
  floor: number
}

export interface AccentDef {
  /**
   * Control points sorted by L ascending (1-4 points).
   * @invariant: monotonic H between points (tolerance ±5°).
   */
  spine: SpineControl[]
  /**
   * Chroma curve over L.
   */
  chroma_curve: AccentChromaCurve
  /**
   * Chroma boost when L drops below peak_L (0.1–0.5 typical).
   * Compensates for gamut shrinkage in dark regions.
   */
  chroma_boost_per_dL: number
}

export type AccentName =
  | 'brand'
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'teal'
  | 'mint'
  | 'blue'
  | 'indigo'
  | 'purple'
  | 'pink'

/**
 * `brand` may be an alias to another accent name. When aliased,
 * the target accent's spine is reused and emitted under both names.
 */
export type AccentValue = AccentDef | { alias: Exclude<AccentName, 'brand'> }

export type AccentsConfig = Record<AccentName, AccentValue>

// ─── Config: statics ────────────────────────────────────────────────────

export interface StaticsConfig {
  white: OklchValue
  /**
   * Dark. If string, aliases a neutral step (`neutrals.N12`).
   * Otherwise an explicit OKLCH value.
   */
  dark: OklchValue | { alias: string }
}

// ─── Config: perceptual compensation ────────────────────────────────────

/**
 * Per-mode perceptual compensation cells.
 *
 * @governs plan §4.3 · Perceptual compensation
 * @why Hunt effect: dark surround makes colors appear MORE saturated,
 *      so physically reduce chroma in dark mode.
 *      HK effect: chromatic colors appear BRIGHTER than grey of same L,
 *      so physically reduce L slightly in dark mode.
 */
export interface PerceptualCompCell {
  chroma_mult: number
  lightness_shift: number
  hue_shift: number
}

export interface PerceptualCompConfig {
  enable: boolean
  light: PerceptualCompCell
  dark: PerceptualCompCell
}

// ─── Config: tier contrast targets ──────────────────────────────────────

export type TierName =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'quaternary'
  | 'fill_primary'
  | 'fill_secondary'
  | 'fill_tertiary'
  | 'fill_quaternary'
  | 'border_strong'
  | 'border_base'
  | 'border_soft'

export interface ContrastTarget {
  /** APCA Lc magnitude, primary criterion. */
  apca: number
  /** WCAG 2.x ratio (optional sanity check). */
  wcag?: number
}

export interface TierTargets {
  normal: ContrastTarget
  ic: ContrastTarget
}

export type TierTargetsConfig = Record<TierName, TierTargets>

// ─── Config: semantic aliases (sentiment → accent) ──────────────────────

export type SentimentName = 'Brand' | 'Danger' | 'Warning' | 'Success' | 'Info'

export type SemanticAliasesConfig = Record<SentimentName, AccentName>

// ─── Config: colors root ────────────────────────────────────────────────

export interface ColorsConfig {
  gamut: 'p3' | 'srgb'
  /**
   * Global chroma multiplier for all accents. 1.0 = default, <1 = muted,
   * >1 = vivid.
   */
  vibrancy: number
  neutrals: NeutralsConfig
  accents: AccentsConfig
  statics: StaticsConfig
  opacity: OpacityConfig
  perceptual_comp: PerceptualCompConfig
  tier_targets: TierTargetsConfig
  semantic_aliases: SemanticAliasesConfig
}

// ─── Semantic ladder definitions ────────────────────────────────────────

/**
 * Which primitive family the semantic ref points at.
 */
export type PrimitiveFamily = 'neutral' | 'accent' | 'static'

/**
 * Reference to a primitive, with optional alpha composition.
 * @governs plan §1.4 · Composition derivable
 */
export interface PrimitiveRef {
  /** 'neutral:0'..'neutral:12', 'accent:blue'..., 'static:white' / 'static:dark' */
  family: PrimitiveFamily
  id: string
  /** If set, alpha = opacity_stop_value(opacity_stop) / 100 */
  opacity_stop?: number
}

/**
 * Canonical background ref — what bg this semantic is DESIGNED for.
 * target_L computed from this bg's luminance.
 */
export type BgContextRef =
  | { kind: 'semantic'; path: string }
  | { kind: 'primitive'; ref: PrimitiveRef }

/**
 * A semantic token definition.
 *
 * Two resolution modes:
 *   1. **pipeline**: uses tier + primitive accent/neutral; resolves via
 *      `resolve()` pipeline (spine + apca_inverse + compensation + clamp).
 *   2. **direct**: static primitive ref with optional opacity_stop
 *      (for overlays, fills-as-alpha, shadows, badge labels, etc).
 */
export type SemanticDef =
  | SemanticDefPipeline
  | SemanticDefDirect
  | SemanticDefModeBranch

export interface SemanticDefPipeline {
  kind: 'pipeline'
  /** Which primitive carries the family (spine for accents, step for neutrals) */
  primitive: PrimitiveRef
  /** Tier whose contrast target drives target_L */
  tier: TierName
  /** Canonical bg this semantic is designed over. */
  canonical_bg: BgContextRef
  /**
   * Override orientation of ΔL:
   *   'auto' — decide based on bg luminance (dark bg → lighter fg, vice versa)
   *   'darker'/'lighter' — force direction
   */
  orientation?: 'auto' | 'darker' | 'lighter'
}

export interface SemanticDefDirect {
  kind: 'direct'
  ref: PrimitiveRef
}

/**
 * Per-output branching — used for tokens that depend on mode/contrast
 * specifically (e.g. `badge.label_default` = White in light, Dark in dark).
 */
export interface SemanticDefModeBranch {
  kind: 'mode-branch'
  branches: Partial<Record<OutputKey, PrimitiveRef | SemanticDef>>
  fallback?: PrimitiveRef | SemanticDef
}

// ─── Semantic tree (config.semantics) ───────────────────────────────────

export interface BackgroundsConfig {
  neutral: {
    primary: SemanticDef
    secondary: SemanticDef
    tertiary: SemanticDef
  }
  overlay: SemanticDef
  static: SemanticDef
}

export type TierSet4 = Record<'primary' | 'secondary' | 'tertiary' | 'quaternary', SemanticDef>
export type BorderTierSet = Record<'strong' | 'base' | 'soft' | 'ghost', SemanticDef>

export interface LabelsConfig {
  neutral: TierSet4
  inverted: SemanticDef
  brand: TierSet4
  danger: TierSet4
  warning: TierSet4
  success: TierSet4
  info: TierSet4
  static: { light: SemanticDef; dark: SemanticDef }
}

export interface FillsConfig {
  neutral: TierSet4
  brand: TierSet4
  danger: TierSet4
  warning: TierSet4
  success: TierSet4
  info: TierSet4
  static: { light: SemanticDef; dark: SemanticDef }
}

export interface BordersConfig {
  neutral: BorderTierSet
  brand: BorderTierSet
  danger: BorderTierSet
  warning: BorderTierSet
  success: BorderTierSet
  info: BorderTierSet
  static: { light: SemanticDef; dark: SemanticDef }
}

// ─── FX (glow, focus, skeleton, shadow) ─────────────────────────────────

export interface ShadowLayerDef {
  /** L1 reference, e.g. 'px/2'. For PR#4 we accept raw pixel numbers. */
  y: number
  blur: number
  spread: number
  /** Which shadow tint (minor/ambient/penumbra/major) */
  tint: 'minor' | 'ambient' | 'penumbra' | 'major'
}

export interface ShadowTintsConfig {
  minor: PrimitiveRef
  ambient: PrimitiveRef
  penumbra: PrimitiveRef
  major: PrimitiveRef
}

export interface ShadowPresetsConfig {
  xs: ShadowLayerDef[]
  s: ShadowLayerDef[]
  m: ShadowLayerDef[]
  l: ShadowLayerDef[]
  xl: ShadowLayerDef[]
}

export interface FxConfig {
  glow: Record<SentimentName, SemanticDef>
  focus_ring: SemanticDef
  skeleton: SemanticDef
  shadow_tints: ShadowTintsConfig
  shadow_presets: ShadowPresetsConfig
}

// ─── Misc ───────────────────────────────────────────────────────────────

export interface MiscConfig {
  badge: {
    label_contrast: SemanticDef
    label_default: SemanticDef
  }
  control: {
    bg: SemanticDef
  }
}

// ─── Semantics root ─────────────────────────────────────────────────────

export interface SemanticsConfig {
  backgrounds: BackgroundsConfig
  labels: LabelsConfig
  fills: FillsConfig
  borders: BordersConfig
  fx: FxConfig
  misc: MiscConfig
}

// ─── Top-level config ───────────────────────────────────────────────────

export interface TokensConfig {
  colors: ColorsConfig
  semantics: SemanticsConfig
  units: UnitsConfig
  dimensions: DimensionsConfig
  typography: TypographyConfig
  z_index?: unknown
  materials?: unknown
}

// ─── Config: typography (L5) ───────────────────────────────────────────

/**
 * @governs plan-v2 §6 · Layer 5 Typography
 *
 * Generated scale: xxs, xs, s, m, l, xl, 2xl, 3xl, 4xl, 5xl, 6xl.
 * 'm' is the base (exponent 0). Sizes are derived as
 *   base * scale_ratio^(index(key) - index('m'))
 * then snapped to multiples of base_px/2 for grid correctness
 * (course §02 rule 1).
 */
export interface TypographyConfig {
  font_family: string
  font_family_mono: string
  /** Index into units.px. base_size_step=4 → 16px at scaling=1.0. */
  base_size_step: number
  /** Multiplicative ratio per step. 1.125 ≈ major second. */
  scale_ratio: number
  /** Body line-height as fraction of size. 1.5 default. */
  lh_body_density: number
  /** Headline line-height, typically tighter than body. 0.95..1.1. */
  lh_headline_density: number
  /** Tracking (letter-spacing, em) controls. */
  tracking: {
    /** Base body tracking em. */
    body: number
    /** Em shift per log2(size/base). Negative tightens headlines. */
    headline_per_log_size: number
    /** Extra em boost for ALL CAPS contexts (documented, not applied). */
    caps_boost: number
  }
  /** Semantic aliases → scale key. */
  semantics: Record<string, TypographyKey>
}

export type TypographyKey =
  | 'xxs'
  | 'xs'
  | 's'
  | 'm'
  | 'l'
  | 'xl'
  | '2xl'
  | '3xl'
  | '4xl'
  | '5xl'
  | '6xl'

export interface ResolvedTypography {
  font_family: string
  font_family_mono: string
  /** size[key] in px (integer or half-pixel). */
  size: Record<TypographyKey, number>
  /** body line-height in px. */
  lh_body: Record<TypographyKey, number>
  /** headline line-height in px. */
  lh_headline: Record<TypographyKey, number>
  /** tracking in em (negative tightens). */
  tracking: Record<TypographyKey, number>
  /** semantic → key lookup. */
  semantics: Record<string, TypographyKey>
}

// ─── Generated IR ───────────────────────────────────────────────────────

/**
 * A resolved primitive: the base OKLCH for each output key. Primitives
 * are mode-aware (dark mirrors light; IC amplifies endpoints) but don't
 * carry alpha — alpha composition happens at the semantic layer.
 */
export interface ResolvedPrimitive {
  name: string
  group: PrimitiveFamily
  id: string
  /** One value per `OutputKey`. */
  values: Record<OutputKey, OklchValue>
}

export interface PrimitiveColorSet {
  neutrals: ResolvedPrimitive[]
  accents: ResolvedPrimitive[]
  statics: ResolvedPrimitive[]
  opacityStops: readonly number[]
}

/**
 * A resolved semantic: final OKLCH with optional alpha for each OutputKey.
 */
export interface ResolvedSemantic {
  /** CSS variable name without leading `--`. */
  name: string
  /** Logical path, e.g. `labels.brand.primary`. */
  path: string
  /** Resolved final values per output. */
  values: Record<OutputKey, OklchWithAlpha>
  /**
   * Optional diagnostic data — kept in-memory for validators + tests.
   */
  diagnostic?: {
    bg_path: string
    tier: TierName
    target_apca: Record<OutputKey, number>
    measured_apca: Record<OutputKey, number>
  }
}

export interface ShadowPreset {
  name: 'xs' | 's' | 'm' | 'l' | 'xl'
  layers: Array<{
    y: number
    blur: number
    spread: number
    tint_var: string
  }>
}

export interface SemanticColorSet {
  tokens: ResolvedSemantic[]
  shadow_presets: ShadowPreset[]
}
