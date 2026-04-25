/**
 * Calibration spike — `deriveForMode` for 11 accents × 4 modes.
 *
 * @layer Calibration
 * @governs SPEC §6.2 (deriveForMode), §6.6 (apcaSearch), §7.7.Y (Yellow IC),
 *          §10.D0 (single-base-point end-state)
 * @invariant For every accent the `light/normal` derivation is identity
 *            (ΔE < 0.5 vs the Figma anchor). The other three modes are
 *            reported as a diagnostic ΔE matrix only — this spike does
 *            NOT yet gate `dark/normal`, `light/ic`, `dark/ic` because
 *            the calibration knobs (perceptual_comp, chroma curve under
 *            gamut clamp, possibly Bezold-Brücke) are still being tuned.
 *            Once knobs converge a follow-up
 *            `derive-mode-calibration.test.ts` will tighten thresholds
 *            (target ΔE ≤ 1.5 per SPEC §7.3) for the remaining modes.
 *
 * @on-fail (a) `light/normal` ΔE > 0.5 → hex→OKLCH→hex round-trip is
 *          drifting. Inspect `culori` rounding in `src/utils/oklch.ts`
 *          (gamut safety constant) or culori version pin.
 *          (b) Test crash → check that
 *          `tests/parity/fixtures/figma-anchors.json` still has the
 *          11 expected accents (Brand…Pink) and the four-element hex
 *          tuple ordered as FIGMA_MODE_ORDER.
 *          (c) Spike logs a regression in IC ΔE → before tightening
 *          thresholds, confirm via `bun test tests/calibration` that
 *          the knob change in `tokens.config.ts:perceptual_comp` was
 *          intentional and update SPEC §10.D0 calibration log.
 */

import { test, expect } from 'bun:test'
import { converter, formatHex, parseHex } from 'culori'
import figma from '../parity/fixtures/figma-anchors.json' with { type: 'json' }
import { deltaE2000, FIGMA_MODE_ORDER, type Mode } from '../parity/utils'
import { deriveForMode, type DeriveKnobs } from '../../src/utils/derive-mode'
import type { OklchValue } from '../../src/types'

const toOklch = converter('oklch')
const toRgb = converter('rgb')

function hexToOklch(hex: string): OklchValue {
  const parsed = parseHex(hex)
  if (!parsed) throw new Error(`hex parse failed: ${hex}`)
  const ok = toOklch(parsed)
  if (!ok) throw new Error(`oklch conversion failed: ${hex}`)
  return {
    L: ok.l ?? 0,
    C: ok.c ?? 0,
    H: Number.isFinite(ok.h) ? (ok.h as number) : 0,
  }
}

function oklchToHex(v: OklchValue): string {
  const rgb = toRgb({ mode: 'oklch' as const, l: v.L, c: v.C, h: v.H })
  if (!rgb) return '#000000'
  return formatHex(rgb) ?? '#000000'
}

const KNOBS: DeriveKnobs = {
  perceptual_comp: {
    enable: true,
    light: { chroma_mult: 1.0, lightness_shift: 0, hue_shift: 0 },
    dark: { chroma_mult: 0.93, lightness_shift: -0.02, hue_shift: 0 },
  },
  target_ic_apca: 75, // primary tier IC, SPEC §6.6 + tokens.config.ts
  gamut: 'p3',
}

const MODE_TO_INDEX: Record<Mode, number> = {
  'light/normal': 0,
  'light/ic': 1,
  'dark/ic': 2,
  'dark/normal': 3,
}

/** Loose ΔE for the spike — diagnostic, not validation. */
const SPIKE_TOLERANCE_FAIL = 25

interface RowResult {
  accent: string
  mode: Mode
  base_hex: string
  expected_hex: string
  derived_hex: string
  delta_e: number
  achieved_apca?: number
}

test('SPIKE · deriveForMode produces ΔE table for 11 accents × 4 modes', () => {
  const rows: RowResult[] = []
  const grossFails: string[] = []

  for (const [family, hexList] of Object.entries(figma.accents) as Array<
    [string, readonly [string, string, string, string]]
  >) {
    const baseHex = hexList[MODE_TO_INDEX['light/normal']]!
    const base = hexToOklch(baseHex)

    for (const mode of FIGMA_MODE_ORDER) {
      const expectedHex = hexList[MODE_TO_INDEX[mode]]!
      const [theme, contrast] = mode.split('/') as ['light' | 'dark', 'normal' | 'ic']
      const result = deriveForMode(base, theme, contrast, KNOBS)
      const derivedHex = oklchToHex(result.value)
      const dE = deltaE2000(derivedHex, expectedHex)
      rows.push({
        accent: family,
        mode,
        base_hex: baseHex,
        expected_hex: expectedHex,
        derived_hex: derivedHex,
        delta_e: dE,
        achieved_apca: result.achieved_apca,
      })
      if (dE > SPIKE_TOLERANCE_FAIL) {
        grossFails.push(
          `${family} ${mode}: derived=${derivedHex} expected=${expectedHex} ΔE=${dE.toFixed(2)} > ${SPIKE_TOLERANCE_FAIL}`,
        )
      }
    }
  }

  // ─── Per-mode summary table ───────────────────────────────────────────
  console.log('\n=== Calibration Spike · deriveForMode → Figma anchors ===')
  console.log('(SPEC §10.D0 single-base-point end-state validation)')
  console.log('')
  for (const mode of FIGMA_MODE_ORDER) {
    const sub = rows.filter(r => r.mode === mode)
    const max = Math.max(...sub.map(r => r.delta_e))
    const avg = sub.reduce((s, r) => s + r.delta_e, 0) / sub.length
    const passes = sub.filter(r => r.delta_e <= 1.5).length
    console.log(
      `  ${mode.padEnd(13)} max ΔE=${max.toFixed(2).padStart(6)} ` +
        `avg ΔE=${avg.toFixed(2).padStart(6)} ` +
        `pass(≤1.5)=${passes}/${sub.length}`,
    )
  }

  // ─── Full table ───────────────────────────────────────────────────────
  console.log('\n--- full ΔE matrix ---')
  console.log(
    '  accent      mode          base       expected   derived    ΔE      apca',
  )
  for (const r of rows) {
    const apca = r.achieved_apca != null ? r.achieved_apca.toFixed(1) : '   —'
    console.log(
      `  ${r.accent.padEnd(10)} ${r.mode.padEnd(13)} ${r.base_hex} ${r.expected_hex} ${r.derived_hex} ${r.delta_e.toFixed(2).padStart(6)} ${apca}`,
    )
  }

  // ─── Yellow IC anti-hallucination check ───────────────────────────────
  // SPEC §7.7.Y: Yellow `light/ic` MUST NOT be a desaturated yellow; it
  // must shift toward amber/brown via gamut clamp during APCA-search.
  // Figma anchor is #d77a00 in this fixture (legacy fixture had #B25000;
  // tokens.json export shows #b25000). Either way, the rendered point
  // must be in the warm-amber neighborhood, NOT a pure yellow.
  const yellowIc = rows.find(r => r.accent === 'Yellow' && r.mode === 'light/ic')!
  console.log('\n--- Yellow IC anti-hallucination check ---')
  console.log(`  derived: ${yellowIc.derived_hex}`)
  console.log(`  Figma:   ${yellowIc.expected_hex}`)
  console.log(`  ΔE:      ${yellowIc.delta_e.toFixed(2)}`)
  console.log(
    yellowIc.delta_e <= 5
      ? '  → calibration close to Figma'
      : yellowIc.delta_e <= 15
        ? '  → calibration in warm-amber family (knob tuning needed)'
        : '  → calibration NOT in amber family (formula may need work)',
  )

  // ─── Spike assertions ────────────────────────────────────────────────
  // Soft assertions only — this is a diagnostic test, not a gate.
  expect(rows.length).toBe(44) // 11 accents × 4 modes
  if (grossFails.length > 0) {
    console.log('\n--- gross failures (ΔE > 25) ---')
    for (const f of grossFails) console.log(`  ${f}`)
  }
  // Soft: at least light/normal must be ≤ 0.5 (it's identity per spec)
  const lnRows = rows.filter(r => r.mode === 'light/normal')
  for (const r of lnRows) {
    expect(r.delta_e).toBeLessThan(0.5)
  }
})
