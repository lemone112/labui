/**
 * Semantic colour generation — labels, fills, borders, FX, misc.
 * See spec.md §5. Turns the declarative `LaddersConfig` into a flat list
 * of {@link SemanticToken}s with per-mode resolved values.
 */

import type {
  AccentName,
  ColorsConfig,
  LadderRef,
  LadderStepValue,
  LaddersConfig,
  Mode,
  PrimitiveColorSet,
  ResolvedTokenValue,
  SemanticColorSet,
  SemanticToken,
} from '../types'
import { isIcMode } from '../types'

interface Ctx {
  modes: readonly Mode[]
  /** Accent name when inside accent-scoped ladder (labels.accent etc). */
  accent?: AccentName
}

export function generateSemanticColors(
  ladders: LaddersConfig,
  primitive: PrimitiveColorSet,
  colors: ColorsConfig,
): SemanticColorSet {
  const accentNames = primitive.accents.map((a) => a.name as AccentName)
  const tokens: SemanticToken[] = []

  // ─── Backgrounds ─────────────────────────────────────────────────────
  for (const [step, value] of Object.entries(ladders.background.neutral)) {
    tokens.push(
      makeToken(`bg-${step}`, `background.neutral.${step}`, value, { modes: colors.modes }),
    )
  }

  // ─── Labels · accent ────────────────────────────────────────────────
  for (const accent of accentNames) {
    for (const [step, value] of Object.entries(ladders.label.accent.steps)) {
      tokens.push(
        makeToken(`label-${accent}-${step}`, `label.accent.${accent}.${step}`, value, {
          modes: colors.modes,
          accent,
        }),
      )
    }
  }

  // ─── Labels · neutral ───────────────────────────────────────────────
  for (const [step, value] of Object.entries(ladders.label.neutral.steps)) {
    tokens.push(
      makeToken(`label-neutral-${step}`, `label.neutral.${step}`, value, { modes: colors.modes }),
    )
  }

  // ─── Fills · accent ─────────────────────────────────────────────────
  for (const accent of accentNames) {
    for (const [step, value] of Object.entries(ladders.fill.accent.steps)) {
      tokens.push(
        makeToken(`fill-${accent}-${step}`, `fill.accent.${accent}.${step}`, value, {
          modes: colors.modes,
          accent,
        }),
      )
    }
  }

  // ─── Fills · neutral ────────────────────────────────────────────────
  for (const [step, value] of Object.entries(ladders.fill.neutral.steps)) {
    tokens.push(
      makeToken(`fill-neutral-${step}`, `fill.neutral.${step}`, value, { modes: colors.modes }),
    )
  }

  // ─── Borders · accent ───────────────────────────────────────────────
  for (const accent of accentNames) {
    for (const [step, value] of Object.entries(ladders.border.accent.steps)) {
      tokens.push(
        makeToken(`border-${accent}-${step}`, `border.accent.${accent}.${step}`, value, {
          modes: colors.modes,
          accent,
        }),
      )
    }
  }

  // ─── Borders · neutral ──────────────────────────────────────────────
  for (const [step, value] of Object.entries(ladders.border.neutral.steps)) {
    tokens.push(
      makeToken(`border-neutral-${step}`, `border.neutral.${step}`, value, { modes: colors.modes }),
    )
  }

  // ─── FX · shadows ───────────────────────────────────────────────────
  const shadow = ladders.fx.shadow
  for (const [step, pair] of Object.entries(shadow.steps)) {
    const perMode: Record<Mode, ResolvedTokenValue> = {} as Record<Mode, ResolvedTokenValue>
    for (const mode of colors.modes) {
      const side = shadow.mode_map[mode]
      const ref = pair[side]
      perMode[mode] = resolveRef(ref, { modes: colors.modes })
    }
    tokens.push({ name: `shadow-${step}`, group: `fx.shadow.${step}`, values: perMode })
  }

  // ─── Misc · badges ──────────────────────────────────────────────────
  const badge = ladders.misc.badge
  tokens.push(
    makeTokenFromPerMode(`badge-label-contrast`, `misc.badge.label_contrast`, badge.label_contrast, colors.modes),
  )
  tokens.push(
    makeTokenFromPerMode(`badge-label-default`, `misc.badge.label_default`, badge.label_default, colors.modes),
  )

  // ─── Misc · control-bg (cross-semantic ref) ─────────────────────────
  // control.bg is the one spot where a semantic token references another
  // semantic token — documented temporary pattern (spec §5.5, §13.2).
  const control = ladders.misc.control
  const controlValues: Record<Mode, ResolvedTokenValue> = {} as Record<Mode, ResolvedTokenValue>
  for (const mode of colors.modes) {
    controlValues[mode] = { kind: 'semantic-ref', target: control.bg[mode].ref }
  }
  tokens.push({ name: 'control-bg', group: 'misc.control.bg', values: controlValues })

  return { tokens }
}

// ─── Core resolver ──────────────────────────────────────────────────────

function makeToken(
  name: string,
  group: string,
  value: LadderStepValue,
  ctx: Ctx,
): SemanticToken {
  const values: Record<Mode, ResolvedTokenValue> = {} as Record<Mode, ResolvedTokenValue>
  for (const mode of ctx.modes) {
    values[mode] = resolveStep(value, mode, ctx)
  }
  return { name, group, values }
}

function makeTokenFromPerMode(
  name: string,
  group: string,
  perMode: Record<Mode, LadderRef>,
  modes: readonly Mode[],
): SemanticToken {
  const values: Record<Mode, ResolvedTokenValue> = {} as Record<Mode, ResolvedTokenValue>
  for (const mode of modes) {
    values[mode] = resolveRef(perMode[mode], { modes })
  }
  return { name, group, values }
}

function resolveStep(value: LadderStepValue, mode: Mode, ctx: Ctx): ResolvedTokenValue {
  if (typeof value === 'string') return resolveRef(value, ctx)

  if ('ref' in value) {
    return { kind: 'semantic-ref', target: value.ref }
  }

  if ('normal' in value || 'ic' in value) {
    const variant = isIcMode(mode) ? 'ic' : 'normal'
    const picked = (value as { normal?: LadderRef; ic?: LadderRef })[variant]
    if (!picked) {
      throw new Error(
        `semantic: variant '${variant}' missing for mode '${mode}' on value ${JSON.stringify(value)}`,
      )
    }
    return resolveRef(picked, ctx)
  }

  const perMode = value as Partial<Record<Mode, LadderRef>>
  const picked = perMode[mode]
  if (!picked) {
    throw new Error(
      `semantic: mode '${mode}' missing on per-mode value ${JSON.stringify(value)}`,
    )
  }
  return resolveRef(picked, ctx)
}

/**
 * Parse a single {@link LadderRef} string in the grammar of spec §5.
 */
function resolveRef(ref: LadderRef, ctx: Pick<Ctx, 'accent'>): ResolvedTokenValue {
  // 'solid' → primitive of the contextual accent at full opacity.
  if (ref === 'solid') {
    if (!ctx.accent) {
      throw new Error(`semantic: bare 'solid' outside accent context`)
    }
    return { kind: 'primitive', primitive: ctx.accent, alpha: 1 }
  }

  // '@<stop>' → contextual accent with opacity.
  if (/^@\d+$/.test(ref)) {
    if (!ctx.accent) {
      throw new Error(`semantic: bare '${ref}' outside accent context`)
    }
    const stop = Number(ref.slice(1))
    return { kind: 'primitive', primitive: ctx.accent, alpha: stop / 100 }
  }

  // '<color>@(solid|<stop>)' → explicit primitive.
  const explicit = /^([A-Za-z][A-Za-z0-9_-]*)@(solid|\d+)$/.exec(ref)
  if (explicit) {
    const [, color, stop] = explicit
    const primitive = mapColorTokenToPrimitive(color)
    if (stop === 'solid') {
      return { kind: 'primitive', primitive, alpha: 1 }
    }
    return { kind: 'primitive', primitive, alpha: Number(stop) / 100 }
  }

  throw new Error(`semantic: invalid reference '${ref}'`)
}

/** Map short colour tokens (N6, Dark, White) to primitive variable names. */
function mapColorTokenToPrimitive(color: string): string {
  if (/^N\d+$/.test(color)) return `neutral-${color.slice(1)}`
  if (color === 'Dark') return 'static-dark'
  if (color === 'White') return 'static-white'
  if (/^[A-Za-z][A-Za-z0-9_-]*$/.test(color)) return color.toLowerCase()
  throw new Error(`semantic: unknown colour token '${color}'`)
}
