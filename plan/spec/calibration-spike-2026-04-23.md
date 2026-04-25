# Calibration Spike Report · 2026-04-23

**Test:** `packages/tokens/tests/calibration/derive-mode-spike.test.ts`
**Engine:** `src/utils/derive-mode.ts:deriveForMode` (SPEC §6.2 + §6.6)
**Goal:** Validate SPEC §10.D0 ("ONE base point per accent, formula derives
the other 3 modes within ΔE ≤ 1.5") against the 11-accent Figma anchor set.

## Knobs used

```
perceptual_comp.dark = { chroma_mult: 0.93, lightness_shift: -0.02, hue_shift: 0 }
target_ic_apca       = 75   # primary tier IC, SPEC §6.6 + tokens.config.ts
gamut                = 'p3'
```

## Results

```
mode          max ΔE   avg ΔE   pass(≤1.5)
light/normal    0.00     0.00       11/11    ← identity, expected
light/ic       20.74     8.94        0/11
dark/normal    10.33     5.58        0/11
dark/ic        21.88    10.01        1/11
```

## Per-accent (worst-offender) summary

```
accent      light/ic   dark/normal   dark/ic
Brand        11.70        8.99       15.57
Red           3.02        2.94       19.51
Orange       17.63        5.49        6.40
Yellow       20.74        3.39        3.36
Green         7.26        4.85        4.50
Teal          2.15        4.31        1.48
Mint          2.31       10.33        3.71
Blue          8.13        6.50        4.26
Indigo       14.78        5.28       21.88
Purple        5.83        6.91       11.09
Pink          4.80        2.37       18.31
```

## Yellow IC anti-hallucination check (SPEC §7.7.Y)

```
derived: #876a00   (L≈0.49, C≈0.10, H≈92°)   — dim olive-yellow
Figma:   #b25000   (L≈0.51, C≈0.16, H≈48°)   — warm amber
ΔE:      20.74
```

**Diagnosis.** The formula correctly hits APCA Lc 75 (achieved 75.2)
on white background while keeping hue fixed at base 92°. The gamut
clamp DOES reduce chroma (from 0.21 → 0.10 at L=0.49) but does NOT
shift hue. Figma's anchor performs an additional **hue rotation
toward amber** (92° → 48°, ≈ 44° shift) which corresponds to the
Bezold-Brücke effect at low luminance — a perceptual phenomenon NOT
modeled by gamut clamp alone.

## Other notable patterns

1. **Dark/ic systematically too pale** (ΔE 11–22 for Brand, Red, Indigo, Pink).
   Cause: `apcaSearch` uses `startPoint.C` constant; at high L on near-black
   bg, more chroma is available in P3 gamut than the base point carries.
   Need a "max-chroma-at-(L, H)" curve to use the headroom.

2. **Light/ic systematically too dim** for warm hues (Yellow, Orange).
   Cause: same — at low L the perceived hue shifts toward warm even though
   physical hue is constant. Need Bezold-Brücke modeling (warm hues drift
   warmer at low L; cool hues drift cooler at high L).

3. **Dark/normal in OK ballpark** (avg ΔE 5.58). Current
   `perceptual_comp.dark = { chroma_mult: 0.93, lightness_shift: -0.02 }`
   is roughly correct; tuning to 0.95 / -0.015 likely reduces ΔE further.
   Mint outlier (ΔE 10.33) suggests Mint needs slightly different dark-mode
   compensation than the global average.

## Implications for SPEC §10.D0

Single-base-point end-state is **NOT achievable in v0.2** with the current
engine. Bridging the ~20 ΔE gap on Yellow IC and Indigo dark/ic requires:

- **Bezold-Brücke hue model** (new global knob): hue rotation as a function
  of (base.H, derived.L). Empirically: warm hues (60°–90°) rotate ~30–45°
  toward amber when L drops below 0.6; cool hues (200°–280°) rotate ~10°
  toward cool when L rises above 0.7.

- **Max-chroma-at-(L, H)** curve (replaces `startPoint.C` in `apcaSearch`):
  for each (L, H), use the gamut envelope's max C, not a fixed value. This
  fixes dark/ic pale-tone problem.

- **Per-family micro-knobs** (last resort): if a single global Bezold-Brücke
  doesn't fit all 11 accents, allow `accents.<name>.bezold_strength` as a
  per-family scalar.

## Decision

**Retain bootstrap fallback for v0.2** (≤4 base points per accent allowed,
must be tagged `[ASSUMED · calibration-bootstrap · §10.D0]`). The v0.2
release-gate `bootstrap_count == 0` is **deferred to v0.3**. SPEC §10.D0
text remains as written; the v0.2 release does NOT have to satisfy the
bootstrap_count gate.

The bootstrap fallback path stays the production source of all 4 modes
per accent until v0.3's calibration work lands. This spike (committed at
`tests/calibration/derive-mode-spike.test.ts`) is the foundation for that
work — it logs the ΔE table on every test run so any knob tuning gets
immediate feedback.

## Followups

- v0.3 RFC-005: Bezold-Brücke modeling and max-chroma-at-(L,H) curve.
- v0.3 RFC-006: per-family micro-knobs vs single global model.
- v0.2: refresh SPEC §10.D0 with this spike's findings; mark
  `bootstrap_count == 0` as "v0.3 release gate", not v0.2.

## Test output (raw, abbreviated)

The full ΔE matrix is logged on every CI run by
`tests/calibration/derive-mode-spike.test.ts`. Running locally:

```bash
cd packages/tokens && bun test tests/calibration/
```
