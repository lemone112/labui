/**
 * Lab UI — Token type definitions.
 * Source of truth: packages/tokens/spec.md (v1).
 *
 * Phase 1 covers only the colors subset. Scales / runtime types are
 * stubbed as `unknown` so that the config shape is stable across phases
 * without preempting phase-2 decisions.
 */

// ─── Modes ──────────────────────────────────────────────────────────────

export const MODES = ['light', 'dark', 'light_ic', 'dark_ic'] as const
export type Mode = (typeof MODES)[number]

export const NORMAL_MODES: readonly Mode[] = ['light', 'dark']
export const IC_MODES: readonly Mode[] = ['light_ic', 'dark_ic']

export function isIcMode(mode: Mode): boolean {
  return mode === 'light_ic' || mode === 'dark_ic'
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

// ─── Config: neutrals ───────────────────────────────────────────────────

export interface NeutralsConfig {
  steps: number // inclusive count, e.g. 13 → steps 0..12
  hue: number
  chroma: { min: number; max: number }
  lightness: {
    light: { from: number; to: number }
    dark: { from: number; to: number }
  }
  /**
   * Additional lightness delta applied to neutrals when in IC modes.
   * Sign is flipped depending on whether the mode is light-like or dark-like.
   */
  lightness_ic_delta: number
  interp: 'linear' | 'ease-in' | 'ease-out'
}

// ─── Config: accents ────────────────────────────────────────────────────

export type AccentOverrides = Partial<Record<Mode, OklchValue>>

export interface AccentDef {
  /** Anchor defined in light mode — the "canonical" colour. */
  light: OklchValue
  /** Optional per-mode overrides when the formula produces poor results. */
  overrides?: AccentOverrides
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

export type AccentsConfig = Record<AccentName, AccentDef>

// ─── Config: static anchors ─────────────────────────────────────────────

export interface StaticsConfig {
  white: OklchValue
  dark: OklchValue
}

// ─── Config: mode derivation ────────────────────────────────────────────

export interface ModeDelta {
  dL: number
  dC: number
  dH: number
}

export type ModeDerivationConfig = Record<Exclude<Mode, 'light'>, ModeDelta>

// ─── Config: opacity ────────────────────────────────────────────────────

export interface OpacityConfig {
  /** Percentage stops, 0..100. Values are duplicated as CSS variables. */
  stops: readonly number[]
}

// ─── Config: colors root ────────────────────────────────────────────────

export interface ColorsConfig {
  gamut: 'p3' | 'srgb'
  neutrals: NeutralsConfig
  accents: AccentsConfig
  statics: StaticsConfig
  modes: readonly Mode[]
  mode_derivation: ModeDerivationConfig
  opacity: OpacityConfig
}

// ─── Semantic ladder reference grammar ──────────────────────────────────

/**
 * A ladder step resolves to a reference string or a record keyed by
 * {@link LadderVariant} (normal/ic) or {@link Mode}. During generation the
 * reference is parsed into { color, step?, opacity } and turned into a
 * concrete `var(--…)` expression.
 *
 * Grammar:
 *   'solid'                      → the accent's solid value (for accent ladders)
 *   '@<stop>'                    → opacity variant on the same accent
 *   '<color>@solid'              → solid of a different primitive (e.g. 'N12@solid')
 *   '<color>@<stop>'             → opacity variant of a different primitive (e.g. 'N6@20')
 *   '{ ref: <path> }'            → cross-semantic reference (temporary, phase-1 only)
 *
 * Colour tokens in the grammar:
 *   N0..N{steps-1}   — neutrals
 *   Dark / White     — statics
 */
export type LadderRef =
  | 'solid'
  | `@${number}`
  | `${string}@solid`
  | `${string}@${number}`

export type LadderVariant = 'normal' | 'ic'

export type LadderStepValue =
  | LadderRef
  /** Per-variant (normal vs IC) */
  | { normal: LadderRef; ic: LadderRef }
  /** Per-mode, for step definitions that can't be folded into variants. */
  | { [K in Mode]?: LadderRef }
  /** Cross-semantic reference — escape hatch, documented in §13.2. */
  | { ref: string }

// ─── Config: semantic ladders ───────────────────────────────────────────

export interface AccentLabelLadder {
  steps: {
    primary: LadderStepValue
    secondary: LadderStepValue
    tertiary: LadderStepValue
    quaternary: LadderStepValue
  }
}

export interface NeutralLabelLadder {
  steps: {
    primary: LadderStepValue
    secondary: LadderStepValue
    tertiary: LadderStepValue
    quaternary: LadderStepValue
  }
}

export interface AccentFillLadder {
  steps: {
    primary: LadderStepValue
    secondary: LadderStepValue
    tertiary: LadderStepValue
    quaternary: LadderStepValue
    none: LadderStepValue
  }
}

export interface NeutralFillLadder {
  steps: {
    primary: LadderStepValue
    secondary: LadderStepValue
    tertiary: LadderStepValue
    quaternary: LadderStepValue
  }
}

export interface AccentBorderLadder {
  steps: {
    strong: LadderStepValue
    base: LadderStepValue
    soft: LadderStepValue
    ghost: LadderStepValue
  }
}

export interface NeutralBorderLadder {
  steps: {
    strong: LadderStepValue
    base: LadderStepValue
    soft: LadderStepValue
    ghost: LadderStepValue
  }
}

export type ShadowStepName = 'minor' | 'ambient' | 'penumbra' | 'major'

export interface ShadowLadder {
  steps: Record<
    ShadowStepName,
    { light_like: LadderRef; dark_like: LadderRef }
  >
  mode_map: Record<Mode, 'light_like' | 'dark_like'>
}

export interface BackgroundLadder {
  /**
   * Common page backgrounds. Values are references to primitives and are
   * emitted once per mode; spec §5.5 (control.bg) references these.
   */
  neutral: {
    primary: LadderStepValue
    secondary: LadderStepValue
    tertiary: LadderStepValue
  }
}

export interface BadgeMiscLadder {
  label_contrast: Record<Mode, LadderRef>
  label_default: Record<Mode, LadderRef>
}

export interface ControlMiscLadder {
  bg: Record<Mode, { ref: string }>
}

export interface LaddersConfig {
  background: BackgroundLadder
  label: {
    accent: AccentLabelLadder
    neutral: NeutralLabelLadder
  }
  fill: {
    accent: AccentFillLadder
    neutral: NeutralFillLadder
  }
  border: {
    accent: AccentBorderLadder
    neutral: NeutralBorderLadder
  }
  fx: {
    shadow: ShadowLadder
  }
  misc: {
    badge: BadgeMiscLadder
    control: ControlMiscLadder
  }
}

// ─── Config: root ───────────────────────────────────────────────────────

/**
 * Top-level `tokens.config.ts` shape. Phase-1 populates `colors` and
 * `ladders`. `scales` and `runtime` are stubs until phase-2.
 */
export interface TokensConfig {
  colors: ColorsConfig
  ladders: LaddersConfig
  scales?: unknown
  runtime?: unknown
}

// ─── Generated-token IR ─────────────────────────────────────────────────

/**
 * A "solid" primitive is one colour anchor per mode (neutral step, accent
 * anchor, or static). Its opacity variants are derived at write time from
 * {@link ColorsConfig.opacity}.
 */
export interface PrimitiveSolid {
  /** CSS variable name without leading `--`, e.g. `neutral-0`, `brand`. */
  name: string
  /** Human-readable category, used by validators & references. */
  group: 'neutral' | 'accent' | 'static'
  /** Specific id within the group (e.g. 0..12, 'brand', 'white'). */
  id: string
  /** Per-mode OKLCH values. Mode-invariant primitives repeat the same value. */
  values: Record<Mode, OklchValue>
}

export interface PrimitiveColorSet {
  neutrals: PrimitiveSolid[]
  accents: PrimitiveSolid[]
  statics: PrimitiveSolid[]
  opacityStops: readonly number[]
}

/**
 * A semantic token maps to either a primitive-backed reference (accent solid,
 * accent-with-opacity, neutral step, static with opacity) or a cross-semantic
 * reference (`{ ref: 'path.to.other' }`).
 */
export type ResolvedTokenValue =
  | { kind: 'primitive'; primitive: string; alpha?: number }
  | { kind: 'semantic-ref'; target: string }

export interface SemanticToken {
  /** CSS variable name without leading `--`, e.g. `label-brand-primary`. */
  name: string
  /** Logical group used by APCA tests, e.g. `label.accent.primary`. */
  group: string
  /** Per-mode resolved value. */
  values: Record<Mode, ResolvedTokenValue>
}

export interface SemanticColorSet {
  tokens: SemanticToken[]
}
