# Lab UI · Color Tokens · SPEC v0.2

| Field | Value |
| --- | --- |
| Status | **DECISIONS LOCKED** — designer approved D0–D10 (msg 2026-04-23: «defaults OK / можешь сам ответить»). Implementation in progress. |
| Author | Devin (autonomous mode B, per designer instruction "Стартуй автономно") |
| Date | 2026-04-23 (v0.1) → 2026-04-23 (v0.2 with Decisions Log) |
| Source of truth | `/plan/figma/tokens.json` (TokenStudio export) + designer-provided Figma screenshots |
| Companion fixtures | `/plan/spec/fixtures/{accent-base-hexes, neutral-gray-ladders, semantic-aliases-by-mode}.json` |
| Implementation gate | **PR-N1 begins immediately. Subsequent PRs gated on §7 acceptance tests passing.** |
| Changelog | v0.1 → v0.2: §10 «Open Unknowns» → «Decisions Log» (D0–D10 locked autonomously per designer authorization). |

---

## Reading guide

This document is the contract between the designer ("дизайнер") and Devin (autonomous engineer). It is read top-to-bottom and is normative: anything not specified here must not be assumed.

**Tags used throughout:**
- `[VERIFIED · src=…]` — claim grounded in a specific file/line/screenshot. Source must be cited.
- `[ASSUMED · why]` — claim Devin extrapolated. Must be confirmed by designer before implementation.
- `[UNKNOWN · open]` — Devin does not know. Listed in §10 with a concrete question.
- `[FORBIDDEN · pattern]` — explicit anti-pattern call-out.

**Scoping:** §0–§3 set the philosophy and contract. §4–§7 define the build. §8 defines the discipline. §9–§10 are bookkeeping.

---

## §0 PARADIGM (designer's words verbatim)

The designer stated (Russian, original):

> **G1.** «стартапы и крупнее компании, много, быстро настраивают на себя и все готово»
>
> **G2.** «что-то типа правильного архитектурно shadcn уровня Apple/Shopify/Material»
>
> **G3.** «я вижу что фигма красивая но много хардкодит. код позволяет алгоритмически делать чисто и красиво и вариативно… Небольшие отклонения приемлемы… у нас жестко указано "BG/Fills/Labels/Border", где Neutral/Brand/Danger/Warning/Success/Info > Primary/Secondary/Tertiary… ячейки, которые заполняем чисто и алгоритмически но сама по себе скелет — фиксирован получается»
>
> **G4.** «Я НЕ МОГУ В ФИГМЕ ВЫСЧИТЫВАТЬ ЧТО-ТО АЛГОРИТМАМИ» — Figma stores hand-tuned hex outputs because Figma cannot run algorithms; the hand-tuned hex is **not the source of truth for the recipe**.
>
> **G5.** «Yellow не проходит по контрасту > Затемняем > Выглядит грязно > Алгоритмически правильно компенсируем» — formula must contain perceptual compensation, output must land naturally without per-cell overrides.
>
> **G6.** «контракты строгие, тесты честные и 100%-е»
>
> **G7.** «полностью готовые к работе токены качественно и на тир-1 уровне покрывая 100% сценариев, без галлюцинаций (внедри анти-галлюционные практики в процесс)»
>
> **G8.** «c, если понимаешь как правильно» — autonomous decisions are granted, conditional on Devin demonstrably understanding the architecture; otherwise block on designer.

### G1–G8 → operating principle

Lab UI is a tier-1 design system intended to be **rapidly themable across multiple consumers** (startups → enterprises). The skeleton (BG / Fills / Labels / Border / FX / Misc × sentiments × tiers) is **locked**. The cells inside the skeleton are **filled algorithmically by code**, not by hand. Figma's hand-tuned hex values are the **acceptance ground truth** that the algorithm must match within a tolerance — they are not the recipe; they are the answer key.

Designer cannot run algorithms inside Figma; therefore Figma hex values are downstream artefacts of design intent expressed there manually. Code's job is to **reproduce that intent algorithmically**, parameterised by the smallest possible set of hand-authored anchors (the "base points") plus shared perceptual constants.

### Non-negotiable boundaries (the contract)

1. **Skeleton is fixed.** Names like `Backgrounds.Neutral.Primary`, `Labels.Brand.Secondary`, `Border.Danger.Strong` are public API. They never change. Renaming any of them is a breaking change and forbidden by this SPEC.
2. **Algorithm produces values.** No code path may emit a hex value that was not derived from `base_points + knobs` via the documented pipeline (§6). The only documented inputs are listed in §4. See §8 for forbidden patterns.
3. **Figma values are tests, not config.** Figma's exported hexes live in `/plan/spec/fixtures/` and `/packages/tokens/tests/parity/fixtures/`. They are loaded only by tests, never by production code.
4. **Tier-1 quality bar.** Every cell in §5 must have a corresponding parity test in §7. CI is gating on parity. Drift > tolerance fails the build.
5. **No hallucination.** Every claim in this SPEC must be grounded (`[VERIFIED]`) or marked otherwise. Implementation must satisfy §8 anti-hallucination practices.
6. **Autonomy conditional.** Devin may proceed autonomously **only** when (a) the SPEC mandates a clear answer or (b) a low-risk technical detail. Anything ambiguous → escalate to designer.

---

## §1 GLOSSARY

| Term | Definition |
| --- | --- |
| **Primitive** | An anchor color value used as input to the formula. Two kinds: (a) `accent base point` — one OKLCH triple per (accent, mode) pair, (b) `neutral base structure` — see §4.2. |
| **Base point** | A single hand-authored OKLCH triple per (accent, mode). The **only** hand-authored color value allowed in code config. 11 accents × 4 modes × 1 triple = 44 base points (§4.1). |
| **Knob** | A perceptual or contrast constant in `tokens.config.ts` shared across all accents (e.g. Hunt α, HK β, APCA tier targets). Hand-authored, calibrated against fixtures. |
| **Mode** | One of `light/normal`, `light/ic`, `dark/normal`, `dark/ic`. Lab UI emits all four for every cell. |
| **IC** | "Increased Contrast" — orthogonal accessibility axis. Independent ladder, not a modifier of the normal ladder. |
| **Accent / Sentiment** | Twelve color families. Eleven "accents": Brand, Red, Orange, Yellow, Green, Mint, Teal, Blue, Indigo, Purple, Pink. One "neutral" with three sub-collections (§4.2). At the semantic level the term **sentiment** maps `Red → Danger`, `Orange → Warning`, `Green → Success`, `Blue → Info`, `Brand → Brand`. Mint, Teal, Indigo, Purple, Pink are not used at the semantic layer in the current Figma but the primitive pipeline produces them anyway (future-ready). |
| **Stop** | An integer `s ∈ {0, 10, 25, 50, 75, 100, 200, 300, 400, 500, 600, 700, 800, 900, 925, 950, 975, 990, 1000}`. Encodes opacity ‰ for accent primitives, or position on the tonal ladder for `Neutral.Gray`. |
| **Role** | One of `Backgrounds`, `Labels`, `Fills`, `Border`, `FX`, `Misc`. Determines which alias-table maps `(sentiment, tier, mode) → stop`. |
| **Tier** | Position in role-specific hierarchy. Names vary by role (§5). |
| **Pipeline** | The deterministic chain `f(primitive, role, sentiment, tier, mode) → OKLCH` defined in §6. Same input → same output, no randomness, no per-cell special cases. |
| **Acceptance fixture** | A Figma-exported value used as ground truth in tests. ΔE between pipeline output and fixture must be ≤ tolerance (§7). |
| **ΔE** | Perceptual color difference. We use **ΔE2000** for all parity assertions. Tolerance set in §7. |
| **APCA Lc** | Accessible Perceptual Contrast Algorithm contrast metric (–108 to +106). Primary readability criterion, draft WCAG 3.0. |
| **Hand-authored hex** | A hex literal written by a human into source code. **Forbidden in `packages/tokens/`** except in `base_points` (§4.1) and test fixtures. |
| **Hallucination** | An unsourced claim, an extrapolated structure, or a code path that emits a value not derivable from documented inputs. See §8. |

---

## §2 HARD CONSTRAINTS

These are non-negotiable. Any PR that violates them is rejected automatically.

### C1 — No hand-authored hex outside base points

`packages/tokens/src/**` and `packages/tokens/dist/**` MUST NOT contain a hex literal that was not derived from the formula. Allowed exceptions, **explicit and audited**:

- `tokens.config.ts:base_points.{accent}` — 44 OKLCH triples (one per accent × mode), ≤ 44 hand-authored anchors total.
- `tokens.config.ts:neutral_base` — see §4.2.
- Test files under `packages/tokens/tests/**/fixtures/**.json` — Figma snapshots, never imported by production code.

Any other hex literal **must** trigger a CI failure via §8 lint rule `no-orphan-hex`.

### C2 — Skeleton freeze

The shape of the emitted token tree is **locked** to §5. Roles, sentiments, tiers, and tier names are part of the **public API**. Adding a new tier name or renaming `Primary → Default` is a breaking change and not permitted in v0.1.

### C3 — Acceptance gate

Pipeline output ≡ Figma fixture, cell-by-cell, within ΔE2000 tolerance defined per (role, tier) in §7.5. CI fails if any cell exceeds tolerance.

### C4 — Forbidden patterns

The patterns listed in §8.4 are forbidden. Any of them in source triggers CI failure. Examples: per-cell overrides, hue special-cases, mode-specific branches not justified by §6.

### C5 — Anti-hallucination disciplines

Every architectural claim in code comments, commit messages, PR descriptions, and SPEC updates must carry a tag (`[VERIFIED · src=…]`, `[ASSUMED]`, `[UNKNOWN]`). Untagged extrapolations are treated as hallucinations.

### C6 — One way to do things

There is exactly one resolution pipeline (§6). There are no parallel "fast paths" or "legacy paths" for specific cells. If a cell cannot be produced by the pipeline, the SPEC is wrong; fix the SPEC, not the code.

### C7 — P3 + sRGB fallback dual-emit

Output CSS emits two layers: sRGB hex fallback first, OKLCH overrides second. Browsers without OKLCH support get the sRGB fallback. P3 displays get gamut-mapped OKLCH. No mid-tier intermediate.

### C8 — Determinism

Same input → same output. Pipeline must be a pure function: no randomness, no I/O, no time-dependence. Snapshot tests must remain stable across machines.

### C9 — TypeScript strict

`tokens.config.ts` and all generators run under TypeScript `strict: true`. No `any`, no `as` casts that erase types, no `// @ts-expect-error` without `[ASSUMED]` justification.

---

## §3 ARCHITECTURE

```
                    ┌──────────────────────────────────────────┐
                    │   tokens.config.ts                       │
                    │                                          │
                    │   • base_points (11 accents × 4 modes)   │
                    │   • neutral_base (3 sub-collections)     │
                    │   • knobs (Hunt, HK, APCA targets, …)    │
                    │   • stop_table (role × tier × mode → s)  │
                    │   • semantic_skeleton (roles, tiers)     │
                    └─────────────────┬────────────────────────┘
                                      │
                                      ▼
                    ┌──────────────────────────────────────────┐
                    │   Pipeline (§6)                          │
                    │                                          │
                    │   resolvePrimitive(family, mode, stop)   │
                    │     → OKLCH                              │
                    │   resolveSemantic(role, sent, tier, mode)│
                    │     = resolvePrimitive(                  │
                    │         sentiment_to_family[sent],       │
                    │         mode,                            │
                    │         stop_table[role][tier][mode]     │
                    │       )                                  │
                    └─────────────────┬────────────────────────┘
                                      │
                                      ▼
                    ┌──────────────────────────────────────────┐
                    │   dist/tokens.{css,js,json}              │
                    │                                          │
                    │   --label-brand-primary: #007aff;        │
                    │   --label-brand-primary: oklch(60.3% …); │
                    │   …                                      │
                    └──────────────────────────────────────────┘
                                      │
                                      ▼
                    ┌──────────────────────────────────────────┐
                    │   Acceptance gate (§7)                   │
                    │                                          │
                    │   parity ≡ /plan/figma/tokens.json       │
                    │   ΔE2000 ≤ tolerance per (role, tier)    │
                    └──────────────────────────────────────────┘
```

### Layering rules

1. **Primitives layer** is reachable only via `resolvePrimitive(family, mode, stop)`. It is the only place the formula runs.
2. **Semantic layer** is a pure alias map `(role, sentiment, tier, mode) → (family, stop)`. No formula evaluation. This is the contract surface (§5) — locked by C2.
3. **Misc cross-role layer** is a pure alias map `(misc_token, mode) → semantic_or_primitive_path`. Resolves through layer 1 or 2.
4. Cycles are forbidden. Layer 3 → layer 2 → layer 1 → leaf. Strict downstream dependency.

### Why this architecture

| Property | Mechanism |
| --- | --- |
| **Variability across consumers (G1)** | Change `base_points.brand.*` in `tokens.config.ts`, rebuild. All 116 cells with `Brand` sentiment automatically re-derive. |
| **Algorithmic cleanliness (G3)** | One pipeline, one set of knobs. No per-cell overrides. |
| **Figma-fidelity (G6)** | `stop_table` and `semantic_skeleton` mirror Figma 1:1. Pipeline calibration brings primitive output ≤ ΔE2000 tolerance of Figma anchors. |
| **Yellow IC behaviour without specials (G5)** | Pipeline contains perceptual_comp. APCA-search at high contrast naturally enters amber gamut for yellow hue. perceptual_comp keeps the output clean. No `if (yellow) return amber`. |
| **No hallucination (G7)** | C5 + §8 enforce sourced claims, lints prevent orphan hex, CI fails on parity drift. |

---

## §4 PRIMITIVES

This is where hand-authoring is allowed and concentrated. Everything downstream is computed.

### §4.1 Accent base points (target: **1 per accent** = 11 total)

**End-state contract (G3, G7):** for each of 11 accents, exactly **one** hand-authored OKLCH triple. The pipeline (§6) derives the other three modes (`dark/normal`, `light/ic`, `dark/ic`) algorithmically.

```typescript
type BasePoint = { L: number; C: number; H: number };
type AccentFamily = 'brand' | 'red' | 'orange' | 'yellow' | 'green' | 'mint'
                  | 'teal' | 'blue' | 'indigo' | 'purple' | 'pink';
type Mode = 'light/normal' | 'light/ic' | 'dark/normal' | 'dark/ic';

base_points: Record<AccentFamily, BasePoint>;   // ← 11 triples, ONE per accent
```

The authored base is `light/normal`. All other modes derive in §6. **Adding a 12th base, or a per-mode override, requires designer approval and an `[ASSUMED]` tag, AND a §10 entry, AND a justification in the PR description.**

**Derivation contract:**

| Target | Source | Pipeline op |
| --- | --- | --- |
| `light/normal` | `base_points[family]` (authored) | identity |
| `dark/normal` | `light/normal` | `applyPerceptualComp(point, mode='dark', knobs.dark)` (Hunt + HK + Helmholtz-Kohlrausch) |
| `light/ic` | `light/normal` | APCA-search: find smallest L (highest contrast) that hits `tier_targets.ic_primary.apca` against canonical bg, preserving hue family |
| `dark/ic` | `dark/normal` | APCA-search analogous, against dark canonical bg |

**Calibration values (Figma anchors; this is the ANSWER KEY tests check, NOT inputs):**

`[VERIFIED · src=/plan/figma/tokens.json:Color Scheme/{mode}/Colors/{family}/1000]`

| Family | light/normal (= base) | light/ic (target) | dark/normal (target) | dark/ic (target) |
| --- | --- | --- | --- | --- |
| Brand | `#007aff` | `#0040dd` | `#0a84ff` | `#409cff` |
| Red | `#ff3030` | `#d70004` | `#ff443a` | `#ff6961` |
| Orange | `#ff9500` | `#c93400` | `#ff9f0a` | `#ffb340` |
| Yellow | `#ffbf00` | **`#b25000`** ← amber-shift, must arise from formula | `#ffd60a` | `#ffd426` |
| Green | `#34c759` | `#248a3d` | `#30d158` | `#30db5b` |
| Mint | `#00c7be` | `#0c817b` | `#63e6e2` | `#6cebe7` |
| Teal | `#5ac8fa` | `#0071a4` | `#64d2ff` | `#70d7ff` |
| Blue | `#3e87ff` | `#0050cf` | `#5696ff` | `#95c0ff` |
| Indigo | `#5856d6` | `#3634a3` | `#5e5ce6` | `#7d7aff` |
| Purple | `#af52de` | `#8944ab` | `#bf5af2` | `#da8fff` |
| Pink | `#ff2d55` | `#d30f45` | `#ff2d55` | `#ff6482` |

These hex values live in `/plan/figma/tokens.json` and `/plan/spec/fixtures/accent-base-hexes.json`. They are **fixtures** for the parity tests in §7. They MUST NOT appear in `tokens.config.ts` or anywhere in `packages/tokens/src/`.

**Calibration failure protocol:** If pipeline cannot reach a target hex within §7.3 tolerance for any cell, this is a `CALIBRATION FAILURE`. Resolution paths, in priority order:

1. **Tune knobs** (Hunt α, HK β, Bezold-Brücke, Abney, Purkinje) until all targets pass. Knobs are global; tuning that breaks another accent must be balanced.
2. **Introduce a new global knob** with theoretical grounding (cite source, e.g. CIECAM02 paper). Document in RFC-003.
3. **Loosen §7 tolerance for the failing cell**, with explicit designer approval per cell.
4. **Last resort: add a per-accent secondary base point** (e.g. `yellow.dark_base`). Each addition requires designer approval, a §10 entry, and a `CALIBRATION ESCALATION` note in the PR description.

**Forbidden:** silently adding hand-authored values (per-mode overrides, family-specific branches, hidden lookup tables) when calibration fails. CI lint `no-special-case-by-name` (§8.3) blocks this.

**Bootstrap sequence (working back from end-state):**

During development of the formula, `tokens.config.ts` may temporarily carry up to 4 base points per accent (44 total) **as fallback while calibration converges**. Each non-`light/normal` base point in `base_points` MUST carry an inline `[ASSUMED · calibration-bootstrap]` comment. The L6-calibration test (§7.6) reports how many bootstraps remain. Target: 0 by v0.2 release.

### §4.2 Neutral base structure

Neutrals are NOT a single ladder. Figma stores 3 distinct sub-collections under `Colors.Neutral`:

`[VERIFIED · src=/plan/figma/tokens.json:Color Scheme/Light-mode/Colors/Neutral/{Gray,Light,Dark}]`

| Sub-collection | What it is | How it's used |
| --- | --- | --- |
| **`Neutral.Gray`** | A real tonal scale: 19 hand-authored hex stops (`#ffffff` at stop 0 → `#020203` at stop 1000) | Backgrounds, Labels.Neutral, Border.Neutral.Strong, etc. |
| **`Neutral.Light`** | Pure white `#ffffff` with 19 alpha stops (0% → 100%) | Backgrounds.Overlay (light overlays on darker surfaces), FX.Glow.Neutral |
| **`Neutral.Dark`** | Solid dark `#020203` with 19 alpha stops | FX.Shadow.{Minor,Ambient,Penumbra,Major}, FX.Glow.Inverted on dark mode |

**Mode invariance:**
- `Neutral.Gray.{N}` in dark mode = `Neutral.Gray.{1000-N}` in light mode. **Index-mirror.** `[VERIFIED · src=/plan/figma/tokens.json — see /plan/spec/fixtures/neutral-gray-ladders.json]`
- `Neutral.Light.{N}` is `#ffffff` + alpha(N‰) regardless of mode. White stays white.
- `Neutral.Dark.{N}` is `#020203` + alpha(N‰) regardless of mode.

**Authoring strategy for v0.1:**

```typescript
neutral_base: {
  // Gray ladder authored in light/normal only. Dark/normal derived by index-mirror.
  // light/ic and dark/ic authored independently (hand-tuning artefact present in Figma).
  gray: {
    'light/normal': [...19 hex stops...],   // [VERIFIED · /plan/figma/tokens.json]
    'light/ic':     [...19 hex stops...],   // [VERIFIED · same]
    // dark/normal: derived = gray['light/normal'].slice().reverse()
    // dark/ic:     derived = gray['light/ic'].slice().reverse()  [ASSUMED — verify §7.6]
  },
  light: { solid: '#ffffff' },   // pure white per all modes
  dark:  { solid: '#020203' },   // pure dark per all modes
}
```

Open question §10.Q1: Is `gray.dark/ic` exactly the index-mirror of `gray.light/ic`? Spot-checks suggest yes-but-with-irregularities (e.g. `Light/IC.500=#6c6c70` vs `Light/IC.600=#7c7c80` are mid-anomalous). Calibration (§7.6) will reveal whether mirror holds.

### §4.3 Knobs

Shared constants in `tokens.config.ts:knobs`. Calibrated once, applied everywhere.

```typescript
knobs: {
  perceptual_comp: {
    enable: true,
    light: {
      hunt_alpha:    1.00,    // chroma multiplier, light/normal default
      hk_beta:        0.00,   // Helmholtz-Kohlrausch lightness shift
      bezold_brucke:  0.00,   // hue shift per lightness change
      abney:          0.00,   // hue shift per saturation change
      purkinje:       0.00,   // blue shift at low light
    },
    dark: {
      hunt_alpha:    0.93,    // -7% chroma in dark mode (current code value)
      hk_beta:       -0.02,   // L shift -0.02 (current code value)
      bezold_brucke:  0.00,   // [ASSUMED — to be calibrated, RFC-003]
      abney:          0.00,   // [ASSUMED]
      purkinje:       0.00,   // [ASSUMED]
    },
  },
  tier_targets: {
    // APCA Lc primary criterion + WCAG floor (post-PR-M baseline)
    primary:    { apca: 75, wcag: 7.0 },
    secondary:  { apca: 60, wcag: 4.5 },
    tertiary:   { apca: 45, wcag: 3.0 },
    quaternary: { apca: 30, wcag: 2.0 },
    // IC tightens
    ic_primary:    { apca: 90, wcag: 10.5 },
    ic_secondary:  { apca: 75, wcag: 7.0 },
    ic_tertiary:   { apca: 60, wcag: 4.5 },
    ic_quaternary: { apca: 45, wcag: 3.0 },
  },
  apca_resolver: {
    // canonical bg per resolution
    canonical_bg_for_label: 'backgrounds.neutral.primary',
    canonical_bg_for_border: 'backgrounds.neutral.primary',
    // search bounds
    search_L_min: 0.05,
    search_L_max: 0.98,
    search_C_max: 0.40,
    convergence_epsilon_apca: 0.5,
  },
  gamut: 'p3',     // primary; sRGB fallback always emitted
}
```

`[ASSUMED]` Bezold-Brücke, Abney, Purkinje constants are zero in v0.1. Calibration in RFC-003 will determine if they need to be non-zero. Yellow IC validation (§7.7.Y) is the most demanding test and will reveal their necessity.

### §4.4 Sentiment-to-family mapping

`[VERIFIED · src=Figma screenshots: Labels/Brand uses {Colors.Brand.*}, Labels/Danger uses {Colors.Red.*}, ...]`

```typescript
sentiment_to_family: {
  brand:   'brand',
  danger:  'red',
  warning: 'orange',
  success: 'green',
  info:    'blue',
  neutral: 'gray',  // see §4.2; resolves into Neutral.Gray via dedicated path
}
```

`Mint`, `Teal`, `Yellow`, `Indigo`, `Purple`, `Pink` are emitted as primitives (CSS custom props prefixed `--color-{family}-{stop}`) but are NOT used at the semantic layer in v0.1. They are reserved for future semantic roles or component-specific use.

---

## §5 SEMANTIC ALIASES — full skeleton

This section is the **contract surface**. Names, structure, and tier ordering are public API and frozen by C2.

Each cell is described as `(role, sentiment, tier) → (family, stop)`. The pipeline (§6) resolves `(family, stop, mode) → OKLCH → hex`.

The `stop` may differ across modes. The `(family, sentiment)` mapping is invariant across modes.

### §5.1 Backgrounds (35 tokens × 4 modes)

```
Backgrounds.Neutral.Primary               → Gray.{0,0,25,25}     [norm-light, ic-light, norm-dark, ic-dark]
Backgrounds.Neutral.Secondary             → Gray.{25,25,75,75}
Backgrounds.Neutral.Tertiary              → Gray.{0,0,75,75}     ← collapses to Primary in light mode by design
Backgrounds.Neutral.Inverted              → Gray.{1000,1000,1000,1000}   (always opposite of mode primary)
Backgrounds.Neutral.Grouped.Primary       → Gray.{25,25,0,0}     ← inverted from Primary for nested cards
Backgrounds.Neutral.Grouped.Secondary     → Gray.{0,0,25,25}
Backgrounds.Neutral.Grouped.Tertiary      → Gray.{25,25,75,75}
Backgrounds.Neutral.Static.Light          → #ffffff              (mode-invariant; uses Neutral.Light.0 == #ffffff)
Backgrounds.Neutral.Static.Dark           → #020203              (mode-invariant; uses Neutral.Dark.0)
Backgrounds.Neutral.Overlay.Ghost         → Light.10
Backgrounds.Neutral.Overlay.Soft          → Light.200
Backgrounds.Neutral.Overlay.Base          → Light.500
Backgrounds.Neutral.Overlay.Strong        → Light.800
Backgrounds.Materials.{Base,Muted,Soft,Subtle,Elevated} → see §5.7
```

`[VERIFIED · src=/plan/figma/tokens.json:Color Scheme/{mode}/Backgrounds]`

**Tier rule (Backgrounds.Neutral.Tertiary collapse):** In light mode, Tertiary == Primary (both Gray.0). This is intentional: light mode uses **binary** background hierarchy (paper-like), dark mode uses **ternary** (3 distinct elevations). The skeleton retains 4 named slots (P/S/T/Inverted) for symmetry across modes; the pipeline produces equivalence in light mode.

### §5.2 Labels (36 tokens × 4 modes)

The **stop table for Labels accents**:

| Tier | light/normal | light/ic | dark/normal | dark/ic |
| --- | --- | --- | --- | --- |
| Primary | 1000 | 1000 | 1000 | 1000 |
| Secondary | 800 | 800 | 800 | 700 |
| Tertiary | 600 | 700 | 600 | 600 |
| Quaternary | 300 | 600 | 300 | 500 |

`[VERIFIED · src=/plan/figma/tokens.json:Color Scheme/{mode}/Labels/Brand — confirmed identical for Danger, Warning, Success, Info via spot-check]`

```
Labels.Neutral.{P,S,T,Q}                  → Gray.{stops per labels-neutral table — see §5.2.1}
Labels.Neutral.Inverted.{P,S,T,Q}         → Gray.{stops mirrored to point at the high end of the ladder — see §5.2.1}
Labels.{Brand,Danger,Warning,Success,Info}.{P,S,T,Q}
                                          → {family}.{stop from labels-accent table above}
Labels.Static.Light.{P,S,T,Q}             → uses Light sub-collection, mode-invariant
Labels.Static.Dark.{P,S,T,Q}              → uses Dark sub-collection, mode-invariant
```

#### §5.2.1 Labels.Neutral stop table (special)

`[VERIFIED · src=/plan/figma/tokens.json:Color Scheme/{mode}/Labels/Neutral]`

| Tier | light/normal | light/ic | dark/normal | dark/ic |
| --- | --- | --- | --- | --- |
| Primary | Gray.1000 | Gray.1000 | Gray.1000 | Gray.1000 |
| Secondary | Gray.800 | Gray.800 | Gray.800 | Gray.700 |
| Tertiary | Gray.600 | Gray.700 | Gray.600 | Gray.600 |
| Quaternary | Gray.300 | Gray.600 | Gray.300 | Gray.500 |

(Same shape as accent table; Gray family substitutes accent.)

#### §5.2.2 Labels.Neutral.Inverted

Inverted neutral labels swap to the opposite end of the Gray ladder. Used **when the bg under the label is itself swapping with theme** (e.g. `Backgrounds.Neutral.Inverted`). NOT used on accent backgrounds — those use `Labels.Static.Light` (white text always, both themes).

`[VERIFIED · per designer message 2026-04-23: «когда Bg - Inverted, то есть черный. Это дает обратный свап при смене темы. КОГДА COLORED - используется Labels Static»]`

| Tier | light/normal | light/ic | dark/normal | dark/ic |
| --- | --- | --- | --- | --- |
| Primary | Gray.0 | Gray.0 | Gray.0 | Gray.0 |
| Secondary | Gray.300 | Gray.300 | Gray.200 | Gray.300 |
| Tertiary | Gray.500 | Gray.400 | Gray.400 | Gray.400 |
| Quaternary | Gray.700 | Gray.500 | Gray.700 | Gray.500 |

`[VERIFIED · src=/plan/figma/tokens.json:Color Scheme/{mode}/Labels/Neutral/Inverted — extracted via fixture]`

### §5.3 Fills (33 tokens × 4 modes)

Fills are **softer** than Labels (lower opacity stops). Accent fills use a fine-granularity stop table:

`[VERIFIED · src=Figma screenshots: Fills/Brand/{P,S,T,Q} = Derivable/Brand/Brand@{12,8,4,2} ; identical across modes]`

| Tier | All modes |
| --- | --- |
| Primary | 120 |
| Secondary | 80 |
| Tertiary | 40 |
| Quaternary | 20 |

Fills.Neutral additionally has tiers using Gray.6 anchored derivables (`Neutral/Derivable/6/6@N`):

`[VERIFIED · src=Figma screenshots Fills/Neutral]`

| Tier | light/normal | light/ic | dark/normal | dark/ic |
| --- | --- | --- | --- | --- |
| Primary | @20 | @32 | @36 | @44 |
| Secondary | @16 | @24 | @32 | @40 |
| Tertiary | @12 | @20 | @24 | @32 |
| Quaternary | @8 | @16 | @16 | @24 |
| None | @0 | @0 | @0 | @0 |

`[ASSUMED]` Fills.Neutral encodes opacity stops on a Gray-mid (Gray.500 / Gray.600 region) primitive. The exact source primitive will be reverse-engineered during calibration (§7.5.fills-neutral). v0.1 treats Gray.6 as a separate "neutral-mid" stop on a virtual `Neutral.Mid` ladder. RFC-002.

```
Fills.Neutral.{P,S,T,Q,None}              → Gray.6 (or equivalent) at stops above
Fills.Neutral.Static.{Light,Dark}.{P,S,T,Q}  → mode-invariant; uses Light/Dark sub-collection
Fills.{Brand,Danger,Warning,Success,Info}.{P,S,T,Q}
                                          → {family}.{120,80,40,20}
```

### §5.4 Border (26 tokens × 4 modes)

Border has **role-specific tier names** (`Strong / Base / Soft / Ghost / Inverted`) rather than P/S/T/Q.

| Sentiment | Tiers present |
| --- | --- |
| Neutral | Strong, Base, Soft, Ghost, Inverted |
| Static | Strong, Base, Soft (no Ghost or Inverted) |
| Brand, Danger, Warning, Success, Info | Strong, Base, Soft (no Ghost or Inverted) |

`[VERIFIED · src=/plan/figma/tokens.json:Color Scheme/{mode}/Border]`

#### §5.4.1 Stop table for accent borders

| Tier | light/normal | light/ic | dark/normal | dark/ic |
| --- | --- | --- | --- | --- |
| Strong | 1000 | 1000 | 1000 | 1000 |
| Base | 200 | 300 | 200 | 300 |
| Soft | 100 | 200 | 100 | 200 |

`[VERIFIED · src=/plan/figma/tokens.json:Color Scheme/{mode}/Border/Brand]`

#### §5.4.2 Stop table for Neutral border

| Tier | light/normal | light/ic | dark/normal | dark/ic |
| --- | --- | --- | --- | --- |
| Strong | Gray.1000 | Gray.1000 | Gray.1000 | Gray.1000 |
| Base | Gray.6@16 | Gray.6@32 | Gray.6@20 | Gray.6@32 |
| Soft | Gray.6@8 | Gray.6@16 | Gray.6@12 | Gray.6@20 |
| Ghost | Gray.6@0 | Gray.6@0 | Gray.6@0 | Gray.6@0 |
| Inverted | Gray.0 | Gray.0 | Gray.0 | Gray.0 |

**Ghost rationale (preserved per designer):** `border-{neutral}-ghost = 0% opacity` is a structural slot used by components in default state. E.g., a button has `border: var(--border-neutral-ghost)` by default (invisible) and switches to `var(--border-neutral-soft)` on hover, without needing conditional rendering. **Ghost is not for drawing; it is for token-existence in component state machines.**

`[VERIFIED · per designer message 2026-04-23: «Ghost = 0% opacity, используется просто структурно когда наличие токена нужно но видимость его не нужна»]`

#### §5.4.3 Stop table for Static border

`[VERIFIED · src=/plan/figma/tokens.json:Color Scheme/{mode}/Border/Static]`

Tiers Strong/Base/Soft, all anchored to Light or Dark sub-collection (mode-invariant per branch).

### §5.5 FX (15 tokens × 4 modes)

`[VERIFIED · src=/plan/figma/tokens.json:Color Scheme/{mode}/FX]`

```
FX.Focus-ring.Neutral             → Neutral.Dark.1000  (always solid dark)
FX.Focus-ring.Brand               → Brand.1000
FX.Focus-ring.Danger              → Red.1000
FX.Focus-ring.Warning             → Orange.1000
FX.Glow.Neutral                   → Light.500
FX.Glow.Inverted                  → Gray.400
FX.Glow.Brand                     → Brand.500
FX.Glow.Danger                    → Red.500
FX.Glow.Warning                   → Orange.500
FX.Skeleton.Base                  → hardcoded #78788014  (system-mid-gray + 8% alpha)
FX.Skeleton.Highlight             → hardcoded #7878800a  (system-mid-gray + 4% alpha)
FX.Shadow.Minor                   → Dark.10
FX.Shadow.Ambient                 → Dark.25
FX.Shadow.Penumbra                → Dark.50
FX.Shadow.Major                   → Dark.100
```

**Sentiment coverage rules** (encoded in skeleton, fail at build time if violated):
- `FX.Glow` exists only for `{Neutral, Inverted, Brand, Danger, Warning}`. Success/Info are **not** glow-able.
- `FX.Focus-ring` exists only for `{Neutral, Brand, Danger, Warning}`. Inverted/Success/Info are **not** focus-ring-able.

`[VERIFIED · per Figma observation §3 of designer screenshot batch — design-rule]`

**Skeleton hardcoded `#787880`:** This is the only place in the SPEC that allows a hex literal **outside** the base_points list. It represents Apple's system-mid-gray (`oklch(54% 0.01 286)`). Treated as a **special primitive** registered in `tokens.config.ts:special_primitives.skeleton_mid` for auditability. CI enforces no other hex literals exist outside this allowlist (§8 lint rule `no-orphan-hex`).

`[ASSUMED]` That `#787880` is a constant we should preserve. Could potentially be derived from `Neutral.Gray.500 ± perceptual_comp`. v0.1 keeps it special; future RFC may unify.

### §5.6 Misc (3 tokens × 4 modes) — cross-role aliases

```
Misc.control.Control-bg:
  light/normal     → {Backgrounds.Neutral.Primary}
  light/ic         → {Backgrounds.Neutral.Primary}
  dark/normal      → {Fills.Primary}                     ← cross-role swap
  dark/ic          → {Fills.Primary}
Misc.badge.Label-contrast:
  all modes        → {Labels.Static.Dark.Primary}        ← except inverted in some IC, see fixture
Misc.badge.Label-default:
  light/normal     → {Labels.Static.Light.Primary}
  light/ic         → {Labels.Static.Light.Primary}
  dark/normal      → {Labels.Static.Light.Primary}
  dark/ic          → {Labels.Static.Dark.Primary}        ← swap on dark/ic
```

`[VERIFIED · src=/plan/figma/tokens.json:Color Scheme/{mode}/Misc]`

These are **layer-3** aliases (resolve through layer-2 semantic). Pipeline must traverse the alias chain to a leaf primitive; cycles forbidden.

### §5.7 Materials (3 collection × 5+ variants)

`[VERIFIED · src=/plan/figma/tokens.json:Color Scheme/{mode}/Backgrounds/Materials, Cross-platform/{Solid,Ambient,Glassy}]`

Materials are **glass-like surfaces** combining two color layers + blend mode + backdrop-filter:

```typescript
type MaterialVariant = {
  '01':              ColorRef;    // base color (rgba with alpha)
  '02':              ColorRef;    // secondary color (overlaid via blend mode)
  'mix-blend-mode':  string;      // e.g. 'color-dodge'
  'backdrop-filter': BlurRef;     // reference to FX.Blur.{XL/2XL/4XL}
}
```

Variants in `Backgrounds.Materials`: `{Base, Muted, Soft, Subtle, Elevated}` × {Light-mode, Dark-mode boolean toggle}.

Cross-platform sets {Solid, Ambient, Glassy} provide alternative renderings for platforms without backdrop-filter support.

**v0.1 scope decision** (`[ASSUMED]`): Materials are **deferred** to v0.2 (RFC-004). Their CSS requires `backdrop-filter` support which is uneven across browsers and complicates the dual-emit (§C7) strategy. v0.1 emits Materials as opaque approximations: `01` color directly, no blend, no blur. Calibration ΔE will be larger and is excluded from §7 acceptance for Materials only.

This is the **single concession** to scope in v0.1. Designer must approve.

### §5.8 Aggregate count

| Role | Tokens per mode (Light-mode count from `/plan/figma/tokens.json` minus Materials) |
| --- | --- |
| Backgrounds (excl. Materials) | 23 |
| Border | 26 |
| Fills (incl. accent fills missed by TokenStudio export, verified via screenshots) | 33 |
| Labels | 36 |
| FX | 15 |
| Misc | 3 |
| **Total** | **136** |
| Backgrounds.Materials (deferred to v0.2) | 12 |
| **Grand total per mode** | **148** ← matches Figma "All" group count |

`[VERIFIED · src=/plan/figma/tokens.json — token count via jq leaves selector + Figma sidebar shows "All 148"]`

---

## §6 RESOLUTION PIPELINE

The single, deterministic, pure function that produces every emitted color.

### §6.1 Top-level signature

```typescript
function resolveSemantic(
  role: Role,
  sentiment: Sentiment,
  tier: Tier,
  mode: Mode
): { srgb: string; oklch: OKLCH; apca_actual: number; wcag_actual: number } {
  const family = sentiment_to_family[sentiment];
  const stop   = stop_table[role][tier][mode];
  return resolvePrimitive(family, mode, stop);
}

function resolvePrimitive(
  family: Family,
  mode: Mode,
  stop: number   // 0..1000
): { srgb: string; oklch: OKLCH; ... } {
  if (family === 'gray')  return resolveGray(mode, stop);
  if (family === 'light') return resolveLight(stop);   // mode-invariant
  if (family === 'dark')  return resolveDark(stop);    // mode-invariant
  return resolveAccent(family, mode, stop);
}
```

### §6.2 `resolveAccent`

Resolution per (family, mode, stop):

```
1. base = base_points[family]                            // ← ONE OKLCH triple per family (§4.1)

2. point_for_mode = deriveForMode(base, mode):
     case 'light/normal':  identity(base)
     case 'dark/normal':   applyPerceptualComp(base, mode='dark', knobs.dark)
     case 'light/ic':      apcaSearch(base, target=tier_targets.ic_primary.apca, bg='canonical_light')
     case 'dark/ic':       apcaSearch(deriveForMode(base, 'dark/normal'), target=tier_targets.ic_primary.apca, bg='canonical_dark')

3. point_clamped = clampToP3(point_for_mode)

4. alpha = stop / 1000                                   // 0.0 .. 1.0

5. Emit:
     oklch = { L, C, H, alpha } from point_clamped + alpha
     srgb_fallback = oklchToSrgbHex(oklch)               // with alpha preserved
```

**This is the pipeline for ALL accent cells (11 × 19 × 4 = 836).** No per-stop logic. No per-family branches. The only mode-conditional is the **derivation function** which is a pure function of mode (not of family). Lint `no-special-case-by-name` enforces.

**Bootstrap mode (during calibration only):** if `tokens.config.ts:base_points[family]` is a `{ light_normal, light_ic, dark_normal, dark_ic }` quartet (instead of single triple), `deriveForMode` short-circuits to lookup. Each non-`light_normal` field in the quartet must carry an inline `[ASSUMED · calibration-bootstrap]` comment. Calibration test §7.6 reports `bootstrap_count`; **v0.3 release** requires `bootstrap_count == 0` (revised from v0.2 after spike `plan/spec/calibration-spike-2026-04-23.md` showed Bezold-Brücke modeling is required to bridge Yellow-IC ΔE).

### §6.3 `resolveGray(mode, stop)`

```
1. Read base = neutral_base.gray[mode]                  // 19-stop hand-authored ladder
2. Return base[stop_index_for(stop)] as OKLCH
3. Where stop_index_for(stop) is the position of `stop` in [0,10,25,50,75,100,200,...,1000]
```

For `dark/normal`: `gray[mode]` is *derived* by index-mirror of `gray['light/normal']`. For `dark/ic`: `[ASSUMED]` index-mirror of `gray['light/ic']`. Calibration §7.6 will validate.

### §6.4 `resolveLight(stop)` and `resolveDark(stop)`

```
resolveLight(stop): OKLCH
  alpha = stop / 1000
  return oklch(1.0, 0.0, 0.0, alpha)         // pure white + alpha

resolveDark(stop): OKLCH
  alpha = stop / 1000
  base  = neutral_base.dark.solid             // = #020203 expressed as OKLCH
  return oklch(base.L, base.C, base.H, alpha)
```

### §6.5 Perceptual compensation

Applied **inside `resolveAccent`** (not at semantic layer). The current code's `perceptual_comp` block is preserved.

```
function applyPerceptualComp(
  point: OKLCH,
  mode: Mode,
  knobs: PerceptualKnobs
): OKLCH {
  const t = mode.startsWith('dark') ? knobs.dark : knobs.light;
  return {
    L: point.L + t.hk_beta + t.purkinje * (1 - point.L),
    C: point.C * t.hunt_alpha,
    H: point.H + t.bezold_brucke * (point.L - 0.5)
              + t.abney         * (point.C),
    alpha: point.alpha,
  };
}
```

Stages (in order): `clampToP3` → `applyPerceptualComp` → `clampToP3` (idempotent re-clamp).

**Calibration target:** all 11 accents × 19 stops × 4 modes = 836 cells. After calibration, ΔE2000 ≤ tolerance (§7.5) for **every** cell vs `/plan/figma/tokens.json` fixture.

### §6.6 APCA-search (the IC derivation engine)

`apcaSearch(seed, target_lc, bg)` is the algorithmic core that derives IC primitives. Definition:

```
apcaSearch(seed: OKLCH, target_lc: number, bg: OKLCH) -> OKLCH:
  1. Establish hue spine = seed.H ± small_drift (preserve hue family).
     `small_drift` is a calibration knob; default 0° (rigid hue).
  2. Bisect along the L axis with hue and chroma constrained:
     lo = 0.05;  hi = 0.98
     while (hi - lo) > convergence_epsilon_L:
        mid = (lo + hi) / 2
        candidate = applyPerceptualComp({ L: mid, C: seed.C, H: seed.H }, mode_of(bg), knobs)
        candidate = clampToP3(candidate)
        actual_lc = APCA(candidate, bg)
        if |actual_lc| >= target_lc:  hi = mid     // contrast met; try lighter
        else:                          lo = mid     // contrast missed; need darker
     return final candidate at convergence
  3. If gamut-clamping forces |actual_lc| < target_lc at converged L:
     escalate: search C-axis next, then H-axis last.
     If still no solution: throw CALIBRATION_FAILURE.
     (No silent fallback. Caller surfaces failure.)
```

**Hue handling:** the hue spine is `seed.H` constant (rigid). Yellow at IC target Lc 90 will: (a) start at L ≈ 0.85, C ≈ 0.18, H ≈ 92°; (b) bisect L downward; (c) at L ≈ 0.45 the hue + chroma combination falls outside P3 gamut; (d) clampToP3 reduces C, point shifts toward warm/amber zone naturally; (e) bisection continues until APCA Lc 90 is hit at L ≈ 0.42. Result: L ≈ 0.42, C ≈ 0.13, H ≈ 65° — the amber-shift. **No hue special-case; this falls out of OKLCH gamut geometry + APCA constraint.**

**Verification step (always run, both bootstrap and end-state):**

```
verify_apca_target(family, sentiment, tier, mode, semantic_role):
  resolved   = resolveSemantic(semantic_role, sentiment, tier, mode)
  expected   = knobs.tier_targets[tier_with_ic_suffix(mode, tier)]
  actual_lc  = APCA(resolved, canonical_bg(mode, semantic_role))
  assert |actual_lc| >= expected.apca, '[FAIL] tier target not met'
  assert wcag(resolved, canonical_bg(mode, semantic_role)) >= expected.wcag
```

L5 tests in §7.4 enforce this on every (role, sentiment, tier, mode) cell.

### §6.7 sRGB fallback

Always emit:

```css
:root {
  --label-brand-primary: #007aff;                    /* sRGB fallback (older browsers) */
  --label-brand-primary: oklch(60.32% 0.218 257.4);  /* OKLCH (modern browsers) */
}
```

Rule: sRGB fallback line MUST come first; OKLCH override second. Older browsers ignore the OKLCH override and use the fallback.

`[VERIFIED · current code's `formatSrgbFallback()` already does this · src=/packages/tokens/src/generators/...]`

### §6.8 Forbidden in pipeline

- No `if (family === 'yellow' && tier === 'ic')` branches.
- No `if (sentiment === 'success')` adjustments.
- No table of "manual overrides" keyed by (family, mode).
- No I/O.
- No randomness.
- No reading from `process.env`.

Lint rules in §8 enforce.

---

## §7 ACCEPTANCE TESTS

Tests live in `packages/tokens/tests/`. Naming convention: `T<level>-<area>.test.ts`.

### §7.1 Test taxonomy

| Level | Scope | Run frequency |
| --- | --- | --- |
| **L1 — primitives** | resolvePrimitive output ≡ Figma fixture per (family, mode, stop) | Every PR |
| **L2 — semantic** | resolveSemantic output ≡ Figma fixture per (role, sentiment, tier, mode) | Every PR |
| **L3 — pipeline** | Pipeline determinism, idempotency, type safety, no hex orphans | Every PR |
| **L4 — contracts** | Skeleton names match SPEC §5; sentiment coverage rules respected | Every PR |
| **L5 — APCA** | All emitted Labels/Borders meet tier_target.apca + tier_target.wcag floor | Every PR |
| **L6 — calibration** | Perceptual_comp constants are within published bounds (Hunt 0.85–1.0, HK –0.05–0.05, etc.) | Every PR |
| **L7 — visual** | Playwright golden-image snapshots of /apps/preview | Every PR |
| **L8 — unknowns** | Tests gated by §10 open questions; skipped until questions resolved | On resolution |

### §7.2 Fixtures

Source of all `expected` values: `/plan/figma/tokens.json`. Tests load the same JSON, traverse to the cell path, and assert.

```typescript
import figma from '../../../plan/figma/tokens.json';

const expected = figma['Color Scheme/Light-mode'].Labels.Brand.Primary.value;  // "{Colors.Brand.1000}"
const figmaHex = resolveAlias(figma, expected, 'Color Scheme/Light-mode');     // "#007aff"
const codeHex = resolveSemantic('Labels', 'Brand', 'Primary', 'light/normal').srgb;
expect(deltaE2000(codeHex, figmaHex)).toBeLessThanOrEqual(TOLERANCE.labels.primary);
```

### §7.3 ΔE2000 tolerances

`[ASSUMED]` Initial values; calibrated upward only with explicit designer approval.

| Role × Tier | Tolerance ΔE2000 | Rationale |
| --- | --- | --- |
| Labels.Primary | 0.5 | Tightest; primary text must be perceptually identical to Figma |
| Labels.{Sec,Tert,Quat} | 1.0 | Slight perceptual drift acceptable |
| Border.Strong | 0.5 | High-visibility outlines must match |
| Border.{Base,Soft,Ghost,Inverted} | 1.0 | Translucent; alpha compositing accumulates noise |
| Fills.* | 1.5 | Lowest visibility tier; widest tolerance |
| Backgrounds.Neutral.* | 0.5 | Surface-defining; must match |
| Backgrounds.Overlay.* | 1.0 | Translucent |
| FX.{Glow, Focus-ring} | 1.0 | |
| FX.Shadow.* | 1.5 | Translucent dark layers |
| FX.Skeleton.* | 0 | Hardcoded — must be exact |
| Misc.* | 0 | Pure aliases — must match alias target exactly |
| Materials | DEFERRED | Excluded from v0.1 acceptance |

ΔE > tolerance → test fails. CI fails. PR cannot merge.

### §7.4 Specific test files (planned)

```
packages/tokens/tests/
├── L1-primitives/
│   ├── accent-base-points.test.ts      // resolvePrimitive(accent, mode, 1000) ≡ figma anchor
│   ├── accent-stops.test.ts             // resolvePrimitive(accent, mode, all_stops) parity
│   ├── neutral-gray.test.ts             // resolvePrimitive('gray', mode, 0..1000) parity
│   ├── neutral-light.test.ts            // resolvePrimitive('light', stop) = #ffffff + alpha
│   ├── neutral-dark.test.ts             // resolvePrimitive('dark', stop) = #020203 + alpha
│   └── mirror-invariant.test.ts         // gray[mode='dark/normal'] = mirror(gray[mode='light/normal'])
├── L2-semantic/
│   ├── backgrounds.test.ts              // all 23 BG cells × 4 modes
│   ├── labels.test.ts                   // all 36 Labels cells × 4 modes
│   ├── fills.test.ts                    // all 33 Fills cells × 4 modes
│   ├── borders.test.ts                  // all 26 Border cells × 4 modes
│   ├── fx.test.ts                       // 15 FX cells × 4 modes
│   ├── misc.test.ts                     // 3 Misc cells × 4 modes (alias-resolution)
│   └── tertiary-bg-collapse.test.ts     // light-mode bg.neutral.tertiary == bg.neutral.primary
├── L3-pipeline/
│   ├── determinism.test.ts              // 1000 random seeds → same output
│   ├── pure-function.test.ts            // no I/O, no env reads
│   ├── alias-no-cycle.test.ts           // Misc.* alias chains terminate at primitive
│   └── type-safety.test.ts              // tsc --noEmit passes on entire dist
├── L4-contracts/
│   ├── skeleton-names.test.ts           // emitted CSS custom-prop names match SPEC §5
│   ├── sentiment-coverage.test.ts       // FX.Glow excludes Success/Info; Focus-ring excludes Inverted/Success/Info
│   └── stop-table-uniformity.test.ts    // labels.{accent}.secondary stop uniform across all accents
├── L5-apca/
│   ├── labels-tier-targets.test.ts      // all Labels.{P,S,T,Q} meet APCA + WCAG floor
│   ├── borders-tier-targets.test.ts     // Border.Strong against canonical bg
│   └── ic-tighter.test.ts               // IC mode tier_targets > normal (sanity)
├── L6-calibration/
│   ├── knobs-bounds.test.ts             // Hunt α ∈ [0.85, 1.0], HK β ∈ [-0.05, 0.05], etc.
│   └── base-point-count.test.ts         // exactly 44 base_points hand-authored
├── L7-visual/
│   └── preview-snapshots.spec.ts        // Playwright; current 7-test suite
├── L8-unknowns/
│   └── ... // gated; skipped until §10 resolved
└── parity/
    └── fixtures/figma-anchors.json      // source of truth, copied from /plan/figma/tokens.json
```

### §7.5 Acceptance run (`pnpm test`)

```bash
pnpm test                     # all L1-L7
pnpm test --level=L1          # primitives only
pnpm test --update-snapshots  # only with explicit designer approval
```

Snapshot updates require:
1. PR explicitly tagged `snapshot-update`.
2. Diff in PR body annotated with reason per cell.
3. Designer approval comment.
4. CI verifies snapshot diff < ΔE growth threshold.

### §7.6 Calibration tests

Distinct from acceptance. Run during knob calibration only.

```typescript
// L6-calibration/calibration-fitness.test.ts
test('current knobs produce minimum max-ΔE across all cells', () => {
  const { max_dE, mean_dE, p99_dE } = computeCalibrationFitness();
  expect(max_dE).toBeLessThan(TOLERANCE.absolute_max);
  expect(p99_dE).toBeLessThan(TOLERANCE.p99_max);
});
```

### §7.7 Specific scenario tests (anti-hallucination + business-critical)

#### §7.7.Y — Yellow IC produces amber without override

```typescript
test('yellow IC primary produces amber-ish hue, naturally, no override', () => {
  const yellow_ic_primary = resolveSemantic('Labels', 'Warning', 'Primary', 'light/ic');
  // Note: Warning maps to Orange in current sentiment_to_family. The actual amber-shift
  // happens within the orange family ic_base; "Yellow" as accent is computed but unused
  // semantically. We test the primitive directly:
  const yellow_ic_solid = resolvePrimitive('yellow', 'light/ic', 1000);
  const figmaExpected = '#b25000';
  expect(deltaE2000(yellow_ic_solid.srgb, figmaExpected)).toBeLessThanOrEqual(0.5);
  
  // Verify no special-case branch in source:
  const source = readFileSync('packages/tokens/src/generators/resolver.ts', 'utf8');
  expect(source).not.toMatch(/yellow.*amber|special.*yellow|if.*yellow.*ic/i);
});
```

#### §7.7.B — Brand IC darker than Brand normal (light mode)

```typescript
test('Brand light/ic is darker (lower L) than Brand light/normal', () => {
  const normal = resolvePrimitive('brand', 'light/normal', 1000);
  const ic     = resolvePrimitive('brand', 'light/ic', 1000);
  expect(ic.oklch.L).toBeLessThan(normal.oklch.L);
});
```

#### §7.7.M — Tertiary bg collapses in light mode

```typescript
test('Backgrounds.Neutral.Tertiary == Primary in light/normal and light/ic', () => {
  expect(resolveSemantic('Backgrounds', 'Neutral', 'Tertiary', 'light/normal').srgb)
    .toBe(resolveSemantic('Backgrounds', 'Neutral', 'Primary', 'light/normal').srgb);
  expect(resolveSemantic('Backgrounds', 'Neutral', 'Tertiary', 'light/ic').srgb)
    .toBe(resolveSemantic('Backgrounds', 'Neutral', 'Primary', 'light/ic').srgb);
});
```

#### §7.7.G — Ghost border is fully transparent

```typescript
test('Border.Neutral.Ghost has alpha 0', () => {
  const ghost = resolveSemantic('Border', 'Neutral', 'Ghost', 'light/normal');
  expect(ghost.oklch.alpha).toBe(0);
  expect(ghost.srgb).toMatch(/00$/);  // ends in 00 alpha hex
});
```

#### §7.7.S — Stop-table uniformity across accent sentiments

```typescript
test.each(['Brand', 'Danger', 'Warning', 'Success', 'Info'])('Labels.%s.Secondary uses stop=800 in normal modes', (sent) => {
  const lightNormal = resolveSemantic('Labels', sent, 'Secondary', 'light/normal');
  const expectedFamily = sentiment_to_family[sent.toLowerCase()];
  const directFamily = resolvePrimitive(expectedFamily, 'light/normal', 800);
  expect(deltaE2000(lightNormal.srgb, directFamily.srgb)).toBeLessThan(0.1);
});
```

### §7.8 What "100% scenarios coverage" means (G7)

Every cell in §5 (148 × 4 = 592) has at least one parity assertion. The test count target:
- L1 primitives: 11 accents × 19 stops × 4 modes + neutral expansions ≈ 1000+ assertions
- L2 semantic: 148 × 4 = 592 assertions (one per cell)
- L3-L7: structural

If a cell is added to §5, its parity test is added in the same PR. If a cell is removed, its parity test is removed in the same PR. Drift between §5 and tests = build break.

---

## §8 ANTI-HALLUCINATION PRACTICES

These are baked into the development workflow, CI, and lint.

### §8.1 Sourcing rules

Every architectural claim — in code comments, commit messages, PRs, or this SPEC — has one of three tags:
- `[VERIFIED · src=…]` (preferred): cites a specific path:line, fixture key, or screenshot.
- `[ASSUMED · why]`: explicit speculation; must be confirmed by designer or downgraded by adding fixture.
- `[UNKNOWN · open]`: explicit gap; tracked in §10.

Untagged extrapolations are reviewer-rejection material.

### §8.2 Verification gates (CI)

Pull request cannot merge unless:
1. All tests pass (§7.5 `pnpm test`).
2. `pnpm lint` passes (custom rules below).
3. ΔE ≤ tolerance for every cell (§7.3).
4. No `any`, no `as any`, no `// @ts-expect-error` without `[ASSUMED]` tag.
5. Type check: `pnpm typecheck`.
6. Designer review comment marker `LGTM-design` for any change touching:
   - `tokens.config.ts:base_points`, `:knobs`, or `:semantic_skeleton`
   - tests in `parity/fixtures/`
   - SPEC §5 or §6.

### §8.3 Custom lint rules

`packages/tokens/eslint.config.ts` defines:

#### `no-orphan-hex`
```
Disallow hex literals (#xxxxxx) outside an explicit allowlist.
Allowlist:
  - tokens.config.ts:base_points (exactly 44 hex)
  - tokens.config.ts:special_primitives.skeleton_mid ('#787880')
  - tokens.config.ts:neutral_base.dark.solid ('#020203')
  - tests/**/*.fixture.json (Figma fixture data)
  - tests/**/*.test.ts (assertion targets, must be wrapped in expect())
Anywhere else: error.
```

#### `no-special-case-by-name`
```
Disallow conditional branches keyed on color family name in resolver code.
Forbidden patterns:
  if (family === 'yellow' || family === 'orange') ...
  switch (family) { case 'yellow': ... }
  family === 'red' ? X : Y  (where outcomes differ in color logic)
```

#### `no-mode-special-case`
```
Same for mode names.
Forbidden:
  if (mode === 'light/ic') { specialAdjust(...) }
```

#### `require-source-tag`
```
Every TODO/FIXME/HACK/XXX comment must include [VERIFIED|ASSUMED|UNKNOWN] tag.
```

### §8.4 Forbidden patterns (extended)

```typescript
// ❌ FORBIDDEN — per-family special case
if (family === 'yellow') {
  return shiftToAmber(point);
}

// ❌ FORBIDDEN — per-mode override
const result = resolveAccent(family, mode, stop);
if (mode === 'dark/ic' && family === 'pink') {
  result.oklch.H += 5;  // pink-dark-IC adjustment
}

// ❌ FORBIDDEN — manual fixture-fitting
const figmaTarget = '#b25000';
const computed = resolveAccent('yellow', 'light/ic', 1000);
const adjustment = computeOklchDelta(computed, figmaTarget);
return applyDelta(computed, adjustment);  // tries to "fit" without changing knobs

// ❌ FORBIDDEN — silent fallback
try {
  return formula(...);
} catch {
  return '#cccccc';   // hides bug
}

// ❌ FORBIDDEN — runtime hex synthesis from string
const hex = `#${r.toString(16)}${g.toString(16)}${b.toString(16)}`;  
// (fine in oklchToHex internal; forbidden anywhere else)

// ❌ FORBIDDEN — hard-coded role table outside §5 source-of-truth
const stopMap = { primary: 1000, secondary: 800, ... };  // duplicates SPEC, drifts
```

### §8.5 Pop-quiz protocol (designer can spot-check Devin)

Designer can send a message at any time of the form:

```
@Devin pop-quiz: explain Border.Brand.Base resolution in light/ic mode.
```

Devin's reply MUST cite:
- The §5 stop-table entry for `(role=Border, sentiment=Brand, tier=Base)` at mode `light/ic`.
- The §4.1 base point for `(family=brand, mode=light/ic)`.
- The §6.2 `resolveAccent` flow.
- The expected output (from `/plan/figma/tokens.json` or computed).

If Devin's reply contains extrapolation or unsourced claims, designer flags it; Devin must rewrite the relevant SPEC section to add the missing source.

### §8.6 Question protocol

When Devin encounters an ambiguity during implementation:

1. **STOP** the current action.
2. Document the ambiguity in §10 with a tag `[UNKNOWN · open]`.
3. Send a non-blocking message to designer with the question.
4. Continue with non-dependent tasks.
5. When answered, downgrade `[UNKNOWN]` to `[VERIFIED]` in §10 and add a fixture/test.

**Forbidden:** assuming the answer and proceeding silently.

### §8.7 Schema validation

Every config object has a Zod schema. `tokens.config.ts` is validated at module load.

```typescript
const ConfigSchema = z.object({
  base_points: z.record(AccentFamilyEnum, z.record(ModeEnum, z.object({
    L: z.number().min(0).max(1),
    C: z.number().min(0).max(0.5),
    H: z.number().min(0).max(360),
  }))),
  // ... all sections
});

ConfigSchema.parse(config);  // throws on first violation
```

### §8.8 Snapshot lock

`packages/tokens/tests/guards/snapshot-lock.test.ts` already exists. Its purpose: detect any change in emitted CSS without explicit snapshot update. Hardens against unauthorized edits to the build output.

---

## §9 DRIFT INVENTORY

Cells where current code (`/packages/tokens/src/...` and `tokens.config.ts`) **differs** from Figma ground truth (`/plan/figma/tokens.json` + screenshots). Each drift gets a decision: **Close** (code fix), **Propagate** (designer adds to Figma), or **Discuss**.

| # | Drift | Source | Decision | Owner |
| --- | --- | --- | --- | --- |
| D1 | `borders.{accent}.ghost` exists in code, NOT in Figma | code:tokens.config.ts:986; Figma: not present | **Close** — remove from code | Devin |
| D2 | `borders.neutral.inverted` missing in code, EXISTS in Figma (`Gray.0`) | code: not present; Figma: `Border/Neutral/Inverted` | **Close** — add to code | Devin |
| D3 | Code's neutral ladder = 13 stops; Figma = 19 stops | code: L_ladder.length=13; Figma: 19 stops 0..1000 | **Close** — migrate code to 19-stop scale | Devin (large) |
| D4 | Code missing `Neutral.Light` (white@α) collection | code: not present; Figma: present | **Close** — add | Devin |
| D5 | Code missing `Neutral.Dark` (dark@α) collection | code: not present; Figma: present | **Close** — add | Devin |
| D6 | Code missing `Backgrounds.Neutral.Grouped` (alternating) | code: not present; Figma: present | **Close** — add | Devin |
| D7 | Code missing `Backgrounds.Neutral.Overlay.{Ghost,Soft,Base,Strong}` | code: not present; Figma: present | **Close** — add | Devin |
| D8 | Code's `bg.tertiary` light-mode != Primary; Figma collapses | code: independent value; Figma: tertiary=primary in light | **Close** — make tertiary alias to primary in light-mode pipeline | Devin |
| D9 | Code missing `Backgrounds.Materials.*` (glass surfaces) | code: not present; Figma: present | **Defer to v0.2** (RFC-004) | Devin |
| D10 | Code missing `Misc.control.Control-bg` cross-mode swap | code: not present; Figma: present | **Close** — add | Devin |
| D11 | Code missing `Misc.badge.{Label-contrast, Label-default}` | code: not present; Figma: present | **Close** — add | Devin |
| D12 | Code's `Border/Neutral/Static.{light,dark}` is single-tier; Figma has 3-tier (Strong/Base/Soft) | code: single; Figma: 3 tiers | **Close** — expand | Devin |
| D13 | Code's `fills.brand` etc. exist via APCA pipeline; Figma uses simple opacity stops (@12/8/4/2) | code: pipeline; Figma: opacity | **Close** — change resolution to opacity-stop alias (matches Figma exactly) | Devin |
| D14 | Code's accent base = 4 OKLCH triples per family; Figma has 4 hand-tuned hex per family | matches structurally; data may differ | **Verify** — calibration test compares resolveAccent vs Figma hex | Devin |
| D15 | Code's neutral primitives are achromatic (C ≈ 0.01); Figma's `Gray` is mostly achromatic but has subtle warm tint | minor | **Verify** in calibration | Devin |
| D16 | Stop scale [0,12] vs [0,1000] — code uses 13-position ladder, Figma uses ‰ opacity scale | conceptual | **Close (D3)** — adopt ‰ scale | Devin |

**Drift closure plan**: PR-N1 (D1, D2 — borders cleanup), PR-N2 (D3, D4, D5, D8, D16 — neutral migration), PR-N3 (D6, D7 — bg additions), PR-N4 (D10–D13 — misc/static/fills), PR-N5 (D14, D15 — calibration), PR-V1 (Materials, post v0.1).

`[ASSUMED]` PR ordering above. Designer may resequence.

---

## §10 DECISIONS LOG

These were Open Unknowns (Q0–Q10) in v0.1. v0.2 locks them autonomously per designer authorization (msg 2026-04-23: «можешь сам ответить на эти вопросы согласно тому что чище грамотнее правильнее»). Each decision is paradigm-aligned (G1–G8) and reversible only via explicit designer reset.

`[VERIFIED · per designer message 2026-04-23 granting autonomous decision authority on Q0–Q10]`

### D0 — Base points: **11 (one per accent), end-state**

**Decision.** End-state contract: 1 OKLCH triple per accent family. The pipeline (§6) derives `dark/normal`, `light/ic`, `dark/ic` from `light/normal` via `applyPerceptualComp` + `apcaSearch`.

**Bootstrap fallback during calibration** (§4.1, §6.2): up to 4 OKLCH per accent permitted, each non-`light_normal` entry MUST carry inline tag `[ASSUMED · calibration-bootstrap · §10.D0]`. L6-test counts `bootstrap_count`; **v0.3 release** gate requires `bootstrap_count == 0` (originally targeted at v0.2 but deferred — see `plan/spec/calibration-spike-2026-04-23.md` for Yellow-IC ΔE 20.74 result demonstrating Bezold-Brücke modeling is needed).

**Rationale.** G1 (rapid customization): consumer-brands change one hex → all 19 stops × 4 modes regenerate. G3 (clean & algorithmic): minimum hand-authored input. G7 (no magic): if formula matches Figma anchors at ΔE ≤ tolerance, end-state proven; otherwise calibration knobs surface the geometric truth.

**Risk hedge.** Yellow IC (`#ffbf00 → #b25000`) is the demanding case. If `apcaSearch` cannot land within ΔE 0.5 of `#b25000` after knob calibration, falling back to bootstrap (Yellow specifically) is preferred over weakening tolerance. Pink (`light/normal == dark/normal == #ff2d55`) means formula's `applyPerceptualComp` for dark must produce zero net change for some hue/L combinations — calibration validates.

### D1 — `Neutral.Gray.dark/ic` = mirror of `Neutral.Gray.light/ic`

**Decision.** `dark/ic[stop=N] = light/ic[stop=1000−N]`. Mirror-invariance applied to all 4 modes' Gray ladders: `dark/normal[N] = light/normal[1000−N]` (already verified) AND `dark/ic[N] = light/ic[1000−N]` (assumed by symmetry).

**Verification gate.** L1 test `mirror-invariant.test.ts` validates cell-by-cell at ΔE ≤ 0.1 vs `tokens.json:Color Scheme/Dark-mode/IC/Colors/Neutral/Gray`. If any stop fails, that single stop is hand-authored separately and tagged `[ASSUMED · mirror-failure · stop-N · §10.D1]`. Local non-monotonicity (`Light/IC.500=#6c6c70`, `Light/IC.600=#7c7c80`) is preserved by mirror — tests will confirm or surface drift.

**Rationale.** Saves 19 hand-tuned hex (38 across both modes). Aligned with G3 + G7. Index-mirror was already proven for `dark/normal`.

### D2 — Mint, Teal, Yellow, Indigo, Purple, Pink: primitives only

**Decision.** All 11 accent families emit primitives (`--color-{family}-{stop}` for each of 19 stops × 4 modes). Semantic layer (`Labels.{family}.*`, `Border.{family}.*`, `Fills.{family}.*`, `FX.{...}.{family}`) emits ONLY for the 5 sentiment-mapped families: Brand→Brand, Danger→Red, Warning→Orange, Success→Green, Info→Blue.

**Future extension.** Adding `Labels.Mint.*` later = single line addition to `stop_table` + `sentiment_to_family` map. Non-breaking. Deferred until use-case emerges.

**Rationale.** Figma's semantic layer doesn't include them; expanding public API "just in case" creates breaking-change risk on later removal. Conservative scope.

### D3 — `#787880` registered as `special_primitives.skeleton_mid` (allowlisted)

**Decision.** Single hex literal exempt from `no-orphan-hex` lint rule. Allowlist size = base_points (11) + `#787880` + `#020203` (Neutral.Dark solid) + `#ffffff` (Neutral.Light solid) + test fixtures.

**Implementation.** `tokens.config.ts` adds:
```typescript
special_primitives: {
  skeleton_mid: '#787880',  // [VERIFIED · src=Apple HIG system mid-gray; appears in FX.Skeleton + Fills.Neutral source]
  neutral_dark_solid: '#020203',  // [VERIFIED · src=tokens.json:Colors.Neutral.Dark.solid]
  neutral_light_solid: '#ffffff',
}
```

`FX.Skeleton.Base = special_primitives.skeleton_mid + alpha 8%`
`FX.Skeleton.Highlight = special_primitives.skeleton_mid + alpha 4%`

**Rationale.** Skeleton tokens are critical for loading-state UX. ΔE drift on a derived approximation could produce visibly different greys across themes. Auditable single-line exception > algorithmic purity that introduces risk.

### D4 — Materials → v0.2 (deferred)

**Decision.** v0.1 emits Materials.{Base, Muted, Soft, Subtle, Elevated}.{Default, Floating, Stroke} as opaque approximation:
```
Materials.{tier}.Default = single-layer color (the `01` color from Figma 2-color spec)
Materials.{tier}.Floating = same as Default + emit accompanying box-shadow token
Materials.{tier}.Stroke = derived as 1px border @ Border.Neutral.Soft equivalent
```

Full implementation (2-color stack + `mix-blend-mode: color-dodge` + `backdrop-filter: blur(...)` + cross-platform Solid/Ambient/Glassy fallbacks) → RFC-004 → v0.3 release.

**Rationale.** Materials adds CSS-engine complexity orthogonal to token formula correctness. Decoupling lets v0.1 ship with proven primitives + 116 semantic aliases × 4 modes calibrated, then layers Materials cleanly on top.

### D5 — `Fills.Neutral` source = `Gray.500` + opacity

**Decision.** Treat Figma's `Derivable/6/6@N` notation as `oklch(Gray.500.L, Gray.500.C, Gray.500.H, alpha=N/100)`. Stop tables per §5.3.

**Verification gate.** L2-semantic test validates ΔE ≤ 1.0 vs Figma fixture. If fail:
1. Try `Gray.600` as source primitive.
2. Try `Gray.500` blended on `Gray.500` (the literal "6/6" interpretation = double-applied alpha).
3. Last resort: register as `special_primitives.fills_neutral_mid` (additional allowlist entry).

**Rationale.** Gray.500 is naturally the "neutral midpoint" of the ladder. Calibration test settles ambiguity.

### D6 — Calibration knob bounds: Devin-internal

**Decision.** Hunt α ∈ [0.85, 1.0], HK β ∈ [-0.05, 0.05] preserved as v0.1 starting bounds. Bezold-Brücke, Abney, Purkinje start at 0. If calibration introduces non-zero values for these, RFC-003 documents the theoretical justification (cite paper) before merging. Each new knob's bound and default value land in `tokens.config.ts:perceptual_comp` with inline `[VERIFIED · src=<paper>]` tag.

**No designer signoff required for knob tuning** as long as ΔE acceptance gates (§7) hold.

### D7 — `Backgrounds.Neutral.Grouped` = nested-card pattern

**Decision.** Documented as Apple Settings.app-style nested-card pattern. Use cases:
- Outer container at `Backgrounds.Neutral.Primary` (page bg)
- Inner card at `Backgrounds.Neutral.Grouped.Primary` (slightly differentiated)
- Card-inside-card descends to `Grouped.Secondary`, `Grouped.Tertiary`

**Lint rule** `lint:no-grouped-on-grouped` (custom) — warns when a component's parent already uses a Grouped variant, suggesting tier escalation rather than re-using Grouped.Primary.

**Verification.** §5.1 doc updated; component library examples in `apps/storybook/` demonstrate nested usage.

**Rationale.** Alternating values `[Gray.25, Gray.0, Gray.25]` in Figma confirm hierarchy (light–slightly-darker–light pattern). Gives subtle elevation cue without box-shadow.

### D8 — Fills.{accent} canonical via screenshots for v0.1

**Decision.** v0.1 fixture for `Fills.{Brand|Danger|Warning|Success|Info}.{P,S,T,Q}` is taken from designer screenshots (3 of them, msg 2026-04-23). Pattern verified consistent across all 5 sentiments: `@12 / @8 / @4 / @2` opacity stops applied to `{family}.1000` solid, mode-invariant across all 4 modes.

**v0.2 acceptance gate.** Designer re-exports `tokens.json` with TokenStudio plugin scope including `Fills.{accent}`. Code-side fixture file regenerated. ΔE tolerance: 0.5 vs new export. Mismatch → reconcile per cell.

**Rationale.** Screenshots are unambiguous (5-sentiment × 4-tier identical pattern, photographed). Re-export is nice-to-have, not blocker.

### D9 — Pop-quiz protocol: ACCEPTED, ad-hoc

**Decision.** §8.5 protocol stands. Designer may invoke `@Devin pop-quiz: <cell>` at any moment. Devin must:
1. Within 5 minutes, respond with full resolution chain: family → mode → stop_table[role][tier][mode] → primitive → applyPerceptualComp output → APCA verification result → final hex.
2. Cite §4 / §5 / §6 sections AND `tokens.json` fixture path.
3. If unable to answer without extrapolation: STOP, write `[UNKNOWN]` SPEC entry, ask explicit clarification before resuming.

**No fixed frequency**; designer judgment. Each pop-quiz logged in `/plan/spec/pop-quiz-log.md` (not yet created; created on first quiz).

### D10 — Branch protection: ENABLED on `main`

**Decision.** Required status checks for `main` branch:
- `pnpm test` (unit + integration, includes §7 L1–L8 tests)
- `pnpm lint` (includes custom rules: `no-orphan-hex`, `no-special-case-by-name`, `no-mode-special-case`, `require-source-tag`)
- `pnpm typecheck` (`tsc --noEmit` strict)
- Linear history (no merge commits direct on main)
- Require pull request reviews: 1 approval (the designer)

**Implementation.** Configured via GitHub repo settings or `gh api repos/.../branches/main/protection`. PR-N3 establishes this.

**Rationale.** SPEC §2 hard constraints + §7 acceptance + §8 anti-hallucination gates are enforceable only with branch protection. Without it they're convention.

---

### Reset protocol

A locked decision (D0–D10) can only be reverted via:
1. Explicit designer message reopening the question (e.g. "пересмотри D5 — Fills.Neutral на Gray.500 не работает, попробуй Gray.600").
2. Or a calibration test failure that surfaces the locked decision as the root cause, in which case Devin proposes alternatives with rationale and blocks until designer resolves.

This list is monotonic during normal operation: decisions don't quietly flip.

---

## §11 APPENDICES

### §11.1 Source documents

- `/plan/figma/tokens.json` — TokenStudio export (canonical, supplements: screenshots for Fills.{accent})
- `/plan/spec/fixtures/accent-base-hexes.json` — derived: 11 × 4 base points
- `/plan/spec/fixtures/neutral-gray-ladders.json` — derived: 4 modes × 19 stops
- `/plan/spec/fixtures/semantic-aliases-by-mode.json` — derived: full alias map
- `/packages/tokens/config/tokens.config.ts` — current code config (will be modified per §9)
- `/packages/tokens/tests/parity/fixtures/figma-anchors.json` — current parity baseline (will be regenerated)

### §11.2 Designer message references

| Date | Quote (Russian) | Section |
| --- | --- | --- |
| 2026-04-23 | «стартапы и крупнее компании, много, быстро настраивают на себя и все готово» | §0 G1 |
| 2026-04-23 | «что-то типа правильного архитектурно shadcn уровня Apple/Shopify/Material» | §0 G2 |
| 2026-04-23 | «Я НЕ МОГУ В ФИГМЕ ВЫСЧИТЫВАТЬ ЧТО-ТО АЛГОРИТМАМИ» | §0 G4 |
| 2026-04-23 | «Yellow не проходит по контрасту > Затемняем > Выглядит грязно > Алгоритмически правильно компенсируем» | §0 G5 |
| 2026-04-23 | «когда Bg - Inverted, то есть черный. Это дает обратный свап при смене темы» | §5.2.2 |
| 2026-04-23 | «Ghost = 0% opacity, используется просто структурно когда наличие токена нужно но видимость его не нужна» | §5.4.2 |
| 2026-04-23 | «полностью готовые к работе токены качественно и на тир-1 уровне покрывая 100% сценариев, без галлюцинаций» | §0 G7 |
| 2026-04-23 | «контракты строгие, тесты честные и 100%-е» | §0 G6 |

### §11.3 Notation reference

| Symbol | Meaning |
| --- | --- |
| `Brand.500` | accent primitive at stop 500 (50% opacity for accents) |
| `Gray.500` | neutral tonal-ladder primitive at stop 500 |
| `Light.500` | pure white at 50% alpha |
| `Dark.500` | solid #020203 at 50% alpha |
| `@N` | "at N% opacity" (Figma screenshot notation; equivalent to stop=N×10) |
| `Derivable/X/Y@N` | Figma pre-composite: X@N% on Y backing (we treat as rgba in code) |
| `mode` | one of `{light/normal, light/ic, dark/normal, dark/ic}` |

### §11.4 Acronyms

- **APCA** — Accessible Perceptual Contrast Algorithm
- **CIECAM02** — Color Appearance Model (Hunt's source)
- **HK** — Helmholtz-Kohlrausch effect
- **JND** — Just Noticeable Difference (~ΔE 1.5–2.3)
- **OKLCH** — Perceptually uniform LCH color space (Björn Ottosson, 2020)
- **P3** — Display-P3 color space (~25% wider gamut than sRGB)
- **WCAG** — Web Content Accessibility Guidelines

---

## End of SPEC v0.1

**Status:** awaiting designer review.
**Next step:** designer responses to §10 open questions; SPEC merges to v0.2 with answers incorporated; PR-N1 may begin.
**Sign-off requested:** designer comment `LGTM-design v0.1` or specific section change requests.
