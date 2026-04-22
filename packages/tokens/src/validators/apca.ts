/**
 * APCA contrast validator — spec §7.
 *
 * Checks every (label, background) pair across all 4 modes. Pairs are
 * classified into APCA tiers (§7.2):
 *   - body        Lc60 normal / Lc75 IC — critical readability (errors)
 *   - decorative  Lc45 all modes         — informational gradients (warnings)
 *
 * The default page background (`bg-primary`) is considered opaque. Checks
 * against translucent fills are listed as `decorative`: APCA requires
 * opaque input, and proper composition belongs to component-level tokens
 * (§13.2), not tier-1 validation.
 */

import { alphaBlend, APCAcontrast, sRGBtoY } from 'apca-w3'
import { converter } from 'culori'
import type { Mode, OklchValue, PrimitiveColorSet, ResolvedTokenValue, SemanticColorSet } from '../types'
import { isIcMode, MODES } from '../types'
import { makeOklch } from '../utils/oklch'

const toRgb = converter('rgb')

export type ApcaTier = 'body' | 'decorative'

export interface ApcaPair {
  fg: string
  bg: string
  mode: Mode
  tier: ApcaTier
  lc: number
  threshold: number
  pass: boolean
}

export interface ApcaResult {
  errors: string[]
  warnings: string[]
  pairs: ApcaPair[]
}

interface CheckedPair {
  fg: RegExp
  bg: RegExp
  tier: ApcaTier
}

/**
 * Matrix of pairs to check. Treat this as the source of truth for which
 * combinations are safety-critical vs decorative.
 */
const CHECKED_PAIRS: CheckedPair[] = [
  // Body text — strict.
  { fg: /^label\.neutral\.primary$/, bg: /^background\.neutral\.primary$/, tier: 'body' },
  { fg: /^label\.neutral\.secondary$/, bg: /^background\.neutral\.primary$/, tier: 'body' },

  // Tertiary / quaternary neutral labels are intentionally faded gradients.
  { fg: /^label\.neutral\.(tertiary|quaternary)$/, bg: /^background\.neutral\.primary$/, tier: 'decorative' },

  // Accent labels — all tiers are decorative. When a strong-contrast accent
  // label is needed (e.g. a filled button), components reach for the
  // badge.label_contrast pair, not the accent colour as text.
  { fg: /^label\.accent\..+$/, bg: /^background\.neutral\.primary$/, tier: 'decorative' },

  // Neutral label on an opaque static — used by badges / chips.
  { fg: /^misc\.badge\.label_contrast$/, bg: /^background\.neutral\.primary$/, tier: 'decorative' },
]

export function validateApca(
  primitive: PrimitiveColorSet,
  semantic: SemanticColorSet,
): ApcaResult {
  const errors: string[] = []
  const warnings: string[] = []
  const pairs: ApcaPair[] = []

  const primMap = buildPrimitiveMap(primitive)

  for (const mode of MODES) {
    for (const spec of CHECKED_PAIRS) {
      const threshold = thresholdFor(spec.tier, mode)
      const fgTokens = semantic.tokens.filter((t) => spec.fg.test(t.group))
      const bgTokens = semantic.tokens.filter((t) => spec.bg.test(t.group))

      for (const fg of fgTokens) {
        for (const bg of bgTokens) {
          const fgColor = resolveToOklch(fg.values[mode], mode, primMap)
          const bgColor = resolveToOklch(bg.values[mode], mode, primMap)
          if (!fgColor || !bgColor) continue

          const lc = computeApcaLc(fgColor.value, fgColor.alpha, bgColor.value)
          const pass = Math.abs(lc) >= threshold

          const pair: ApcaPair = {
            fg: fg.name,
            bg: bg.name,
            mode,
            tier: spec.tier,
            lc: Math.round(lc * 10) / 10,
            threshold,
            pass,
          }
          pairs.push(pair)

          if (!pass) {
            const msg = `APCA ${spec.tier} FAIL: ${fg.name} on ${bg.name} (${mode}) — |Lc|=${Math.abs(lc).toFixed(1)} < ${threshold}`
            if (spec.tier === 'body') errors.push(msg)
            else warnings.push(msg)
          }
        }
      }
    }
  }

  return { errors, warnings, pairs }
}

function thresholdFor(tier: ApcaTier, mode: Mode): number {
  if (tier === 'decorative') return 45
  return isIcMode(mode) ? 75 : 60
}

// ─── Helpers ────────────────────────────────────────────────────────────

interface PrimResolvedColor {
  value: OklchValue
  alpha: number
}

type PrimMap = Map<string, Record<Mode, OklchValue>>

function buildPrimitiveMap(primitive: PrimitiveColorSet): PrimMap {
  const map = new Map<string, Record<Mode, OklchValue>>()
  for (const group of [primitive.neutrals, primitive.accents, primitive.statics]) {
    for (const solid of group) {
      map.set(solid.name, solid.values)
    }
  }
  return map
}

function resolveToOklch(
  value: ResolvedTokenValue,
  mode: Mode,
  primMap: PrimMap,
): PrimResolvedColor | null {
  if (value.kind === 'primitive') {
    const v = primMap.get(value.primitive)
    if (!v) return null
    return { value: v[mode], alpha: value.alpha ?? 1 }
  }
  // Cross-semantic refs aren't resolved transitively; skip.
  return null
}

function computeApcaLc(
  fg: OklchValue,
  fgAlpha: number,
  bg: OklchValue,
): number {
  const bgRgb = toSrgb255(bg)
  const fgRgb = toSrgb255(fg)

  const bg3: [number, number, number] = [bgRgb.r, bgRgb.g, bgRgb.b]

  const fgBlended =
    fgAlpha < 1
      ? (alphaBlend([fgRgb.r, fgRgb.g, fgRgb.b, fgAlpha], bg3, true) as [number, number, number])
      : ([fgRgb.r, fgRgb.g, fgRgb.b] as [number, number, number])

  const fgY = sRGBtoY(fgBlended)
  const bgY = sRGBtoY(bg3)

  return APCAcontrast(fgY, bgY) as number
}

function toSrgb255(v: OklchValue): { r: number; g: number; b: number } {
  const rgb = toRgb(makeOklch(v))
  if (!rgb) return { r: 0, g: 0, b: 0 }
  return {
    r: Math.round(clamp01(rgb.r) * 255),
    g: Math.round(clamp01(rgb.g) * 255),
    b: Math.round(clamp01(rgb.b) * 255),
  }
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n))
}
