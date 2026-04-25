# Verification Questionnaire — SPEC v0.2 anti-hallucination spot-checks

> **Purpose.** 10 verification questions per SPEC section (§0–§11 = 120 total).
>
> Each question has a **single correct answer** that must be derivable from
> the SPEC (`plan/spec/SPEC.md`), the Figma fixture
> (`plan/figma/tokens.json`), the test fixtures
> (`packages/tokens/tests/parity/fixtures/`), or the code under
> `packages/tokens/src/`. **No extrapolation, no guessing.** If the answer
> requires reasoning beyond what is written somewhere, that exposes a
> hallucination — re-anchor the SPEC instead of inventing.
>
> **Format per question.**
> - **Q.** the question
> - **A.** the canonical answer with a citation (file:line OR fixture path OR code path)
> - **Catches.** what hallucination class this question would surface if Devin got it wrong
>
> **Designer-side use.** Pick any question at random ("pop-quiz", §10.D9).
> If the answer doesn't match A. exactly, demand a SPEC re-anchor before
> resuming work.

---

## §0 — Paradigm

**Q0.1.** What does G1 stand for, verbatim?
**A.** "Стартапы быстро настраивают токен под себя." → §0 line 31. **Catches.** generic-paraphrase drift; G1 is the source of D0's single-base-point hypothesis.

**Q0.2.** Which goal makes Yellow IC = `#b25000` non-negotiable as an acceptance fixture?
**A.** G2 ("кратно эталону Apple HIG · Tier-1 quality") + G7 ("без галлюцинаций"). §0 lines 32 + 37. **Catches.** confusing G7 (no-hallucination) with G3 (clean & algorithmic) — the former bans overrides, the latter mandates derivation.

**Q0.3.** Is "no orphan hex outside base_points" a G-rule, a C-rule, or a lint?
**A.** It's lint `no-orphan-hex` (§8.3) ENFORCING C-1 hard constraint (§2). G-rules don't ban code patterns; they specify outcomes. **Catches.** confusing layered enforcement (paradigm → constraint → lint).

**Q0.4.** Which G-goal forces Materials into v0.2 RFC-004 instead of v0.1?
**A.** None — Materials defer is operational (D4), not paradigm-driven. The deferral preserves G3 (clean) and G7 (no magic) by NOT shipping half-modeled `mix-blend-mode` + `backdrop-filter` in v0.1. **Catches.** treating G as the immediate justification when the actual gate is a D-decision.

**Q0.5.** What does the "Operating principle" line at §0 commit Devin to do BEFORE generating any token?
**A.** "Доказать что формула выводит Figma fixture в пределах ΔE ≤ tolerance ИЛИ записать что НЕ выводит как `[UNKNOWN]`." §0 line 53. **Catches.** silent extrapolation when calibration fails (must explicitly tag).

**Q0.6.** How many designer-quote citations appear in §0? (count)
**A.** Exactly the 8 G-goals + the operating principle = 9 verbatim quotes. **Catches.** if Devin paraphrased rather than quoted, count would mismatch.

**Q0.7.** Per G6 ("plan-driven, not vibes"), which document's instruction supersedes the SPEC if they conflict?
**A.** Trick question: **none** — G6 specifically establishes the SPEC as the planning document. Conflicts with `plan/implementation-plan-v2.md` resolve to SPEC. §0 G6 + §11 references. **Catches.** legacy-plan supremacy hallucination (legacy plan was bootstrap, SPEC superseded).

**Q0.8.** What's the difference between G3 ("clean & algorithmic") and G7 ("no hallucinations") in practical code review?
**A.** G3 bans messy code (e.g., manually writing 19 stops × 4 modes); G7 bans wrong code (e.g., a `if family === 'yellow' return amber` override). G3 is structural, G7 is semantic. §0 lines 33 + 37. **Catches.** conflating the two — they have different lints (`no-hand-authored-stops` vs `no-special-case-by-name`).

**Q0.9.** Where is the user's exact phrase "никаких hand-authored hex'ов кроме base points" canonicalized in the SPEC?
**A.** Two places: §0 paradigm quote AND §2 C-1 hard constraint (which lints enforce). §0 line 53 + §2 line 90. **Catches.** if it's ONLY in §0, the constraint isn't enforceable.

**Q0.10.** Per G8 ("backwards-compat or version-bump"), removing `--border-brand-ghost` requires what?
**A.** Either ≥1 minor version grace period (announce-deprecate now, remove in 0.3.0 — what PR-N1/PR-N1b actually do) OR a major version bump. §0 G8 + §10.D1. **Catches.** assuming we can yank a public CSS var without ceremony — the lifecycle is the test.

---

## §1 — Glossary

**Q1.1.** What is the SPEC's exact definition of "primitive"?
**A.** "An OKLCH triple emitted from `tokens.config.ts` for a (family × stop × mode × contrast) cell. NOT a CSS var alias." §1. **Catches.** confusing primitive with CSS-var name (e.g. `--color-brand-500`); primitive is the OKLCH value, the var is its rendering.

**Q1.2.** Define "semantic alias".
**A.** "A static name → primitive mapping at the role-tier level (e.g. `Labels.Brand.Primary` → `Brand.500@light/normal`)." §1. **Catches.** treating semantic as a computed function rather than a static lookup table.

**Q1.3.** What's the difference between "anchor" and "base point"?
**A.** **Base point** = OKLCH stored in `tokens.config.ts` (1 per accent, end-state). **Anchor** = hex from Figma fixture used as TEST acceptance value. Anchors are fixtures; base points are inputs. §1. **Catches.** confusing input (base point) with verification (anchor); a Devin who treats Figma anchors as inputs is hallucinating the architecture.

**Q1.4.** Define "knob". Are knobs per-accent or global?
**A.** "Tunable global parameter in the `applyPerceptualComp` and `apcaSearch` pipeline. Per SPEC C-9: NEVER per-accent." §1 + §6.5 + §2 C-9. **Catches.** the temptation to add `accents.yellow.bezold_strength`; that violates C-9 and only goes through D-decision dispute.

**Q1.5.** What does ΔE2000 measure?
**A.** Perceptual color difference in CIELAB (delta-E by the 2000 formula). Used to compare formula output vs Figma fixture. NOT delta-E76 or CMC. §1 + §7.3. **Catches.** if Devin uses the wrong delta-E variant (76 is more common but less perceptual; we explicitly use 2000).

**Q1.6.** Define "mode" and "contrast" — are they orthogonal?
**A.** Mode = `light | dark` (theme). Contrast = `normal | ic` (increased contrast). They are **orthogonal**: 4 outputs = 2×2. §1. **Catches.** common hallucination: treating mode as 4-way (`light`, `dark`, `light-ic`, `dark-ic`) instead of 2D product.

**Q1.7.** What's the fixture path for the canonical accent anchor table?
**A.** `packages/tokens/tests/parity/fixtures/figma-anchors.json`. §1 + §7.2. **Catches.** confusing it with `plan/figma/tokens.json` (the full TokenStudio export — 10210 lines). The condensed `figma-anchors.json` is the actual TEST fixture.

**Q1.8.** What does "spine" refer to in the codebase?
**A.** The OKLCH lightness ladder L0..L1000 used to render any accent's 19 stops at any (mode, contrast). One ladder per (mode, contrast). §6.2 + `src/generators/spine.ts`. **Catches.** confusing spine with knobs (spine is the ladder shape; knobs are the perceptual adjustments).

**Q1.9.** Define "bootstrap fallback" (D0 context).
**A.** During calibration, allowing up to 4 OKLCH triples per accent in `tokens.config.ts:base_points` (one per output mode/contrast combo) instead of 1. Each non-`light_normal` entry MUST carry inline tag `[ASSUMED · calibration-bootstrap · §10.D0]`. §1 + §10.D0. **Catches.** quietly using >4 base points or omitting the tag.

**Q1.10.** What's "skeleton mid"?
**A.** The single allowlisted special primitive `#787880` (Apple system mid-gray) used for `FX.Skeleton.Base`. Allowlisted by `no-orphan-hex` lint. §1 + §10.D3. **Catches.** treating any Apple-system color as a free hex — only `#787880` is allowlisted, nothing else.

---

## §2 — Hard Constraints

**Q2.1.** What does C-1 forbid?
**A.** "No hand-authored hex outside the 11 base_points + special_primitives.skeleton_mid + special_primitives.neutral_dark_solid (#020203) + test fixtures." §2 C-1. **Catches.** allowing one-off hex in semantic resolver (e.g. inline `'#ffffff'` in a Border generator) — that violates C-1 and lint catches it.

**Q2.2.** What's the canonical neutral_dark_solid hex and why is it allowlisted (not derived)?
**A.** `#020203`. Allowlisted because perfect-black (`#000000`) is **not** the design intent (designers explicitly chose `#020203`, slightly chromatic). Deriving it from a black ladder would round-trip through `#000000`, losing the chromatic shift. §2 C-1 + §10.D3. **Catches.** Devin that decides to derive it from `Gray.1000@dark/normal` and gets `#000000`.

**Q2.3.** C-3 specifies output gamut. Is that sRGB or P3?
**A.** **P3** is the primary output gamut (configured via `gamut: 'p3'` in tier_targets). sRGB fallback is dual-emitted but secondary. §2 C-3 + tokens.config.ts. **Catches.** sRGB-first thinking (legacy default).

**Q2.4.** What does C-4 say about ΔE tolerance?
**A.** ΔE2000 ≤ 1.5 for primary-tier semantic tokens; ≤ 0.5 for primitive anchors; ≤ 1.0 for accent_anchors parity test. §2 C-4 + §7.3. **Catches.** uniform tolerance hallucination — different roles have different tolerance.

**Q2.5.** Per C-5, can a primitive be deprecated without a major version bump?
**A.** No. Primitives are public API (`--color-brand-500`); deprecation requires the announce → grace → remove lifecycle (G8). C-5 enforces this. **Catches.** treating primitives as internal-only (they are not — Tailwind preset exposes them).

**Q2.6.** What does C-6 require for every test file?
**A.** Header tags: `@layer`, `@governs`, `@invariant`, `@on-fail`. Enforced by `tests/guards/test-file-headers.test.ts`. §2 C-6 + the guard. **Catches.** new test file without `@on-fail` — guard fails CI immediately.

**Q2.7.** C-7 talks about Resolution determinism. What does it ban?
**A.** Random/time-dependent inputs in the pipeline. `deriveForMode(base, mode, contrast, knobs)` must be a pure function. No `Math.random()`, no `Date.now()`. §2 C-7. **Catches.** any temptation to add jitter for dithering or test variance.

**Q2.8.** C-8 talks about schema stability. Bumping `tokens.config.ts:schema_version` requires what?
**A.** Backward-compat path or major-version bump. Schema-version mismatch is detected by `tests/guards/schema-version.test.ts`. §2 C-8. **Catches.** silent schema bumps without lifecycle.

**Q2.9.** C-9 is the most paradigm-defining constraint. State it verbatim.
**A.** "No special-case by name." Concretely: no code path may branch on `family === 'yellow'` or any accent-name string. §2 C-9 + lint `no-special-case-by-name`. **Catches.** the single most common hallucination — adding a `if` for "the hard accent."

**Q2.10.** Are constraint violations runtime errors or build-time?
**A.** **Build-time** — all C-rules are enforced by lints + tests in CI. Runtime never sees a violation because the build would fail first. §2 + §8.3. **Catches.** lazy-checking (defer-to-runtime) hallucination.

---

## §3 — Architecture

**Q3.1.** How many architectural layers does the SPEC define?
**A.** **3 layers** (§3): primitives (L1), semantic aliases (L2), CSS-var emission (L3). Plus a "fixture" tier outside the runtime layers. **Catches.** counting the test layers (L1–L8 in §7) as architectural layers — those are TESTING strata, not data flow.

**Q3.2.** Can L2 (semantic) reference an L1 primitive that isn't emitted to L3 CSS?
**A.** **No** — every primitive referenced by a semantic alias must be emitted as a CSS var (otherwise the alias resolves to undefined). §3 layering rules. **Catches.** decoupling semantic config from CSS-var emission (a real risk in tree-shaking).

**Q3.3.** Where do "knobs" live in the architecture?
**A.** **Outside layers** — they are `tokens.config.ts` settings, threaded into pure functions. They are not L1/L2/L3 entities; they are configuration for the formula that GENERATES L1. §3 + §4.3. **Catches.** treating a knob as a primitive (it's not; primitives are OUTPUT of the formula, knobs are INPUT).

**Q3.4.** Does the `dist/tokens.css` file represent L1, L2, L3, or all three?
**A.** **Only L3** — the CSS file is the rendered output of L3 (CSS var emission). L1 and L2 are upstream data structures, not file contents. §3. **Catches.** assuming `tokens.css` = the entire system.

**Q3.5.** What's the role of `tokens.json` (the Figma export)?
**A.** **Test fixture only** — never consumed at build time. It's the Figma ground truth used for parity tests. §3 + §1 + D0. **Catches.** Devin who decides to import `tokens.json` directly into the build (bypassing the formula) — that's the central paradigm violation.

**Q3.6.** Per §3, can the Tailwind preset (`dist/tailwind-preset.css`) reference a CSS var that doesn't exist in `dist/tokens.css`?
**A.** **No** — every Tailwind utility class maps to a CSS var; missing a var would surface as broken utility. The G2 (Tailwind preset byte-stable) snapshot test catches this. §3. **Catches.** decoupling Tailwind preset from primary CSS emission.

**Q3.7.** What about CSS shadow DOM / scoping? Are tokens scoped to `:root` only?
**A.** Yes — `:root` only. Mode-switching (light ↔ dark) is via a top-level CSS class or media query, not via shadow-DOM scoping. §3 + §6.7. **Catches.** advanced scoping hallucination (e.g., `[data-mode="dark"]` deeply nested), which would break consumers.

**Q3.8.** Where does APCA validation sit in the architecture?
**A.** **Cross-cutting** — runs as a guard test against L3 output (CSS var values). NOT a runtime check, NOT in L2 generation. §3 + §6.6. **Catches.** treating APCA as a derivation parameter (it's a validator); confusing it with apcaSearch (which IS a derivation algorithm — DIFFERENT thing).

**Q3.9.** Does the architecture support per-app theming (e.g., one app uses Brand=blue, another uses Brand=red)?
**A.** **Yes** — by changing `tokens.config.ts:base_points.brand` and rebuilding. NO runtime theming (would violate C-3 gamut clamp determinism). §3 + G1. **Catches.** runtime-theme hallucination (e.g., loading themes via fetch); themes are build-time only.

**Q3.10.** What's the dependency direction between L1, L2, L3?
**A.** L3 ← L2 ← L1 (CSS depends on aliases depends on primitives). Reverse flow is **forbidden**. §3 layering rules. **Catches.** circular dependency; a primitive must not look up a semantic alias.

---

## §4 — Primitives

**Q4.1.** How many accent base points does the SPEC's end-state contract?
**A.** **11**, one per accent: Brand, Red, Orange, Yellow, Green, Mint, Teal, Blue, Indigo, Purple, Pink. §4.1 + §10.D0. **Catches.** the most common hallucination — confusing 11 (END-STATE) with 44 (BOOTSTRAP) which is allowed during calibration.

**Q4.2.** Does the spec list 12 primitives or 11? (Including or excluding Brand?)
**A.** **11** — Brand IS one of the 11; not a separate primitive on top. §4.1. **Catches.** double-counting Brand (a quick way to sniff out a Devin who lost track of the family list).

**Q4.3.** Which of the 11 primitives have NO semantic-alias layer?
**A.** **6**: Mint, Teal, Yellow, Indigo, Purple, Pink. They emit only as `--color-{family}-{stop}` primitives, no `Labels.{family}.*` etc. §4.1 + §10.D2. **Catches.** assuming all 11 have semantic mapping (only Brand/Red/Orange/Green/Blue do).

**Q4.4.** How many neutral primitive sub-collections exist?
**A.** **3**: Gray (4 modes), Light (4 modes — alpha-on-light), Dark (4 modes — alpha-on-dark). §4.2. **Catches.** treating all neutrals as one collection — they're three distinct ladders with different alpha-blend semantics.

**Q4.5.** What's the `Neutral.Gray.dark/ic` derivation rule?
**A.** Index-mirror of `Neutral.Gray.light/ic` with ΔE ≤ 0.1 tolerance. §10.D1. **Catches.** assuming dark/ic gray is hand-authored (it's mirror-derived; if mirroring breaks, isolated hand-author per stop is the fallback, but that's PER-STOP, not whole ladder).

**Q4.6.** Per §4.3, how many global knobs does the system declare?
**A.** **3 knob families**: `perceptual_comp` (light + dark), `tier_targets` (apca per tier), `apca_resolver` (gamut, target_ic_apca). §4.3. **Catches.** treating each numeric value as a knob (there are MANY more numbers; the FAMILIES are 3).

**Q4.7.** What's the `Sentiment` mapping for `Brand`, `Danger`, `Warning`, `Success`, `Info`?
**A.** Brand→Brand, Danger→Red, Warning→Orange, Success→Green, Info→Blue. §4.4. **Catches.** confusing Warning with Yellow (it's Orange — Yellow has no semantic role, see Q4.3).

**Q4.8.** Why does `Special_primitives.skeleton_mid` exist as an allowlisted hex instead of being derived?
**A.** Apple's system mid-gray (`#787880`) is critical for loading-state UX; deriving from `Gray.500` introduces ΔE drift. Single allowlisted exception preferred over algorithmic-purity at cost of accuracy. §10.D3. **Catches.** Devin proposing to derive it (the call was made in D3; reversing requires designer message).

**Q4.9.** What's the relationship between `accents.{name}.spine` and `accents.{name}.base_point`?
**A.** spine = OKLCH lightness ladder L0..L1000 (19 stops, identical shape across accents). base_point = the SINGLE OKLCH triple defining the accent's hue+chroma. The two are combined via formula to produce the 19 stops. §4.1 + §6.2. **Catches.** confusing spine (per-mode, shared) with base_point (per-accent, unique).

**Q4.10.** Are primitives stored as OKLCH, hex, or both?
**A.** **OKLCH** in `tokens.config.ts`. Hex is computed at build time for CSS emission. Tests sometimes assert against hex (after gamut clamp). §4.1 + §6.7. **Catches.** assuming primitives are stored as hex (they're not — that would lose precision and gamut info).

---

## §5 — Semantic Aliases

**Q5.1.** How many semantic-alias cells does the SPEC define (excluding Materials, deferred)?
**A.** **148** logical cells × 4 modes = 592 emissions. §5 header. **Catches.** the most common counting error — confusing 148 (CELLS) with 592 (EMISSIONS) or with 116 (the lower count from before "Inverted" was added in PR-N1).

**Q5.2.** Which semantic role family has the LARGEST cell count?
**A.** Backgrounds (35 cells), beating Labels (36 - 1 special inverted = 35 too, tied), Fills (33), Border (26), FX (15), Misc (3). Strictly: Labels = 36 cells. §5.1–§5.6. **Catches.** counting ad-hoc; the SPEC has explicit headers per role (35/36/33/26/15/3).

**Q5.3.** What's `Labels.Neutral.Inverted`? Why is it special?
**A.** A label that flips between black-on-light-bg and white-on-dark-bg. Special because it's the ONLY label tier that requires per-mode color flip rather than monotonic transition. §5.2.2. **Catches.** treating it as a regular tier (it's the structural exception).

**Q5.4.** Are `Labels.Mint.Primary` or `Labels.Pink.Primary` valid semantic aliases?
**A.** **No** — Mint, Pink, Yellow, Indigo, Purple, Teal have no semantic Label tier (D2). Only Brand/Red/Orange/Green/Blue do. §5.2 + §10.D2. **Catches.** assuming all primitives have semantic aliases (50% of accents don't).

**Q5.5.** Border tiers — how many per accent vs per neutral? List them.
**A.** **Neutral**: 5 tiers — `strong`, `base`, `soft`, `ghost`, `inverted`. **Accent**: 4 tiers — `strong`, `base`, `soft`, `ghost`. (`inverted` is neutral-only, `ghost` deprecates per D1 in 0.3.0.) §5.4. **Catches.** assuming uniform 4-or-5 per family — they differ.

**Q5.6.** What's `Border.{accent}.Ghost` doing in v0.2 since D1 deprecates it?
**A.** Emitted with deprecation banner; replacement `--border-neutral-ghost`; removed in 0.3.0 schema bump. PR-N1 implemented this lifecycle (G8 grace period). §5.4 + §10.D1 + tokens.config.ts:deprecated. **Catches.** assuming D1 immediately removes it (it's announce-deprecate now, remove-in-0.3.0 — that's the correct lifecycle).

**Q5.7.** Where do `Backgrounds.Neutral.Materials.{Base|Muted|Soft|Subtle|Elevated}` live in v0.2?
**A.** Emitted as **opaque approximations** (single color, no `mix-blend-mode` / `backdrop-filter`). Full glassmorphism deferred to v0.2 RFC-004 / D4. §5.1 + §10.D4. **Catches.** assuming full Materials are implemented (only stubs; check `dist/tokens.css` for absence of blur).

**Q5.8.** What's `FX.Glow` and how does it differ from `FX.Focus-Ring`?
**A.** Glow = ambient halo (purely decorative); Focus-Ring = accessibility a11y indicator. Both per-sentiment (5 sentiments). §5.5. **Catches.** confusing them — Focus-Ring has APCA contrast requirements, Glow does not.

**Q5.9.** `Fills.Neutral.{P,S,T,Q,None}` — what's the source primitive and opacity ladder?
**A.** Source = `Gray.500`. Opacity stops per mode: light/normal {20,16,12,8,0}, light/ic {32,24,20,16,0}, dark/normal {36,32,24,16,0}, dark/ic {44,40,32,24,0}. §10.D5. **Catches.** assuming a single uniform opacity ladder (they differ per mode).

**Q5.10.** Per §5, can a semantic alias reference a primitive that doesn't exist in the registered family list?
**A.** **No** — schema validation (Zod) blocks at build time. §5 schema constraints + tests/L4-semantic/skeleton-shape.test.ts. **Catches.** typos like `Labels.Yelloow.Primary → Yellow.500` going through silently (Zod catches it).

---

## §6 — Resolution Pipeline

**Q6.1.** Does `deriveForMode` run on ALL primitives (11 × 19 × 4 = 836) or only on the base point?
**A.** Currently the production pipeline uses `spine + primitive_per_output` (lookup, not derivation) for all 19 stops. `deriveForMode` is the v0.3 spike target — when all base points + knobs converge, it'll generate all 836 cells from 11 OKLCH inputs. §6.2 + §10.D0. **Catches.** confusing v0.2 production (lookup) with v0.3 target (derivation).

**Q6.2.** What's the canonical pipeline for `light/normal` derivation?
**A.** `deriveForMode(base, 'light', 'normal') = fitGamut(base, 'p3')` — identity with gamut clamp. §6.2. **Catches.** assuming light/normal goes through `applyPerceptualComp` (it doesn't; light is identity).

**Q6.3.** What's the canonical pipeline for `dark/ic`?
**A.** `apcaSearch(applyPerceptualComp(base, 'dark', knobs), bg=neutral.0[dark], target=knobs.target_ic_apca, gamut, 'auto')`. §6.2. **Catches.** running `apcaSearch(base, ...)` directly without the perceptual_comp pre-step (would miss the dark-mode chroma reduction).

**Q6.4.** What does `fitGamut(v, 'p3')` do?
**A.** Clamps OKLCH to fit P3 gamut envelope. Hue stays fixed; chroma reduces if out-of-gamut at given lightness; lightness stays at given L. NOT a recoloring algorithm. §6.5 + `src/generators/resolver.ts`. **Catches.** assuming gamut clamp can shift hue (it cannot — that would violate C-9 paradigm).

**Q6.5.** How does `apcaSearch` decide L?
**A.** Binary-search over L (mid-bisect) at fixed `H = base.H`, `C = startPoint.C` (gamut-clamped per L), to find APCA `Lc(fg, bg) == target_apca` ± tolerance. §6.6 + `src/utils/apca-inverse.ts`. **Catches.** assuming apcaSearch lets chroma vary as a free param (it doesn't — chroma is fixed at base, gamut clamp only reduces it).

**Q6.6.** Does `applyPerceptualComp` use Hunt's formulation, CIECAM02, or something else?
**A.** Approximation derived from Hunt 1991 (chroma reduction) + Hunt-Kreysig (HK) lightness shift. Not full CIECAM02 (that's overkill for token-derivation; we use ~3 scalar knobs). §6.5. **Catches.** Devin claiming "CIECAM02-grade" perceptual modeling (it's a 3-scalar approximation, not the full appearance model).

**Q6.7.** What's `applyPerceptualComp` for `light` mode?
**A.** **Identity** — `{ chroma_mult: 1.0, lightness_shift: 0, hue_shift: 0 }`. Light mode doesn't need perceptual compensation (Hunt's effect happens in dim viewing, not bright). §6.5 + tokens.config.ts. **Catches.** assuming light mode also has perceptual_comp (it doesn't; this is by design).

**Q6.8.** Does `apcaSearch` ever fall back to sRGB if P3 fails?
**A.** **No** — gamut is fixed at config time (typically P3). If apcaSearch can't converge in P3, it returns the closest achievable point (might miss APCA target). §6.6 + §6.7. **Catches.** assuming dynamic gamut fallback (would add non-determinism, violating C-7).

**Q6.9.** What's `resolveGray` and why does it differ from `resolveAccent`?
**A.** `resolveGray` is monotonic-by-construction (no perceptual_comp; the spine ladder IS the output). Pure mathematical interpolation between Gray.0 and Gray.1000 with mode-specific endpoints. §6.3. **Catches.** assuming Gray runs through perceptual_comp (it doesn't — Gray is achromatic, no chroma to compensate).

**Q6.10.** Per §6.8, what is FORBIDDEN inside `deriveForMode`?
**A.** Branching on accent name string (`if family === 'yellow'` etc.); reading from `Math.random` or `Date.now`; logging (must be pure); fetching at build time. §6.8 + C-7 + C-9. **Catches.** any of those — that's the line in the sand.

---

## §7 — Acceptance Tests

**Q7.1.** What's the L4-semantic test layer for?
**A.** Validates semantic alias shape + values against the SPEC §5 catalog (148 cells × 4 modes). Tests in `tests/L4-semantic/`. §7.1 + §7.4. **Catches.** confusing it with L3-pipeline (which tests derive functions) or L2-semantic (similar but different fixture).

**Q7.2.** What fixture does the parity test (`tests/parity/`) compare against?
**A.** `packages/tokens/tests/parity/fixtures/figma-anchors.json` — the condensed 11-accent × 4-mode hex table. §7.2. **Catches.** confusing with the full TokenStudio export.

**Q7.3.** What's the ΔE2000 tolerance for the Yellow IC parity check?
**A.** **1.0** (PT1 accent-anchor test uses uniform 1.0 across all 4 sectors, all 11 accents). The bootstrap path lets Yellow IC pin to `#b25000` directly — passing within 1.0. §7.3 + tests/parity/accent-anchors.test.ts:39. **Catches.** assuming a per-accent loose threshold (there isn't — 1.0 is uniform; the spike used 25 because spike is diagnostic-only).

**Q7.4.** What does L1-primitives test layer cover?
**A.** Spine monotonicity, gamut clamping, mirror-invariance for neutral grays, ic-amplification (IC tier delivers more chroma at fixed L than normal). `tests/L3-primitives/` in repo (legacy naming). §7.1 + §7.4. **Catches.** confusing layers — spec uses L1, repo uses L3 (rename pending).

**Q7.5.** Does the test suite assert the `bootstrap_count == 0` rule?
**A.** **Not yet** — that's the v0.3 release gate (per amended D0). v0.2 only LOGS the count; does not fail. §10.D0. **Catches.** confusing v0.2 (allows ≤4) with v0.3 (requires == 0).

**Q7.6.** What's the L7-visual test for?
**A.** Playwright preview-app screenshots of components rendered with the tokens. Verifies tokens look right in actual UI. §7.4 + GitHub Actions "Preview · R1-R4 (Playwright)". **Catches.** assuming all tests are computational (visual regression is a real test layer).

**Q7.7.** What's the §7.7.Y test (the Yellow IC anti-hallucination test)?
**A.** Asserts Yellow `light/ic` falls within ΔE 1.0 of `#b25000` (Figma anchor) WITHOUT a hardcoded `if family === 'yellow'` override. §7.7.Y. **Catches.** Devin who satisfies the test by adding the override (would fail lint `no-special-case-by-name` first).

**Q7.8.** What does §7.7.G assert about ghost borders?
**A.** Ghost border alpha is exactly 0 in v0.2.x (transparent = no visual border, per Figma). After D1 deprecation (0.3.0), the var is removed entirely. §7.7.G. **Catches.** assuming ghost is "subtle visible" (it's invisible-but-present-for-layout).

**Q7.9.** Where's the snapshot lock test?
**A.** `tests/guards/snapshot-css.test.ts` (G1) + `tests/guards/snapshot-tailwind.test.ts` (Tailwind preset) + `tests/guards/snapshot-esm.test.ts` (G2). §7.4 + §8.8. **Catches.** assuming one global snapshot file (there are several, per artifact).

**Q7.10.** What's the rule for adding a new test?
**A.** Must include `@layer / @governs / @invariant / @on-fail` header (C-6). Must reference a §-number from SPEC OR `plan/implementation-plan-v2.md` (verifier checks). §7 + §2 C-6 + scripts/verify-plan-coverage.ts. **Catches.** lazy test additions without proper anchoring.

---

## §8 — Anti-Hallucination Practices

**Q8.1.** What are the 4 source-tags per §8.1?
**A.** `[VERIFIED via …]`, `[ASSUMED]`, `[UNKNOWN]`, `[FORBIDDEN]`. §8.1. **Catches.** confusing source-tags (which annotate claims) with code-tags (which annotate implementation status).

**Q8.2.** What's the `no-orphan-hex` lint?
**A.** Bans hex literals outside the 11 base_points + 2 special_primitives + test fixtures. §8.3. **Catches.** Devin adding a hex in semantic-colors.ts as a "quick fix" — lint blocks immediately.

**Q8.3.** What's `no-special-case-by-name`?
**A.** Bans `if accent === '<family>'`-style branches in resolution code. §8.3 + C-9. **Catches.** the central paradigm violation (override for the hard accent).

**Q8.4.** What's `no-mode-special-case`?
**A.** Bans per-mode special-case logic (e.g., `if mode === 'dark/ic' ...`) in derivation. Modes branch via the `deriveForMode` switch, but ONLY there — not scattered. §8.3. **Catches.** mode-handling drift across the codebase.

**Q8.5.** What's `require-source-tag`?
**A.** Requires every `[VERIFIED]` / `[ASSUMED]` / `[UNKNOWN]` to be followed by a citation. §8.3. **Catches.** lazy tagging without provenance.

**Q8.6.** How does the pop-quiz protocol (§8.5) work?
**A.** Designer asks "@Devin pop-quiz: explain X." Devin must respond within 5 minutes with full resolution chain (citing SPEC + fixtures). If unable without extrapolation, must STOP and write `[UNKNOWN]` SPEC entry. §10.D9. **Catches.** Devin guessing under pop-quiz pressure (paradigm violation).

**Q8.7.** What's the question protocol (§8.6)?
**A.** Devin must STOP and ask explicit clarification when ambiguity arises. Cannot resolve via guessing. §8.6. **Catches.** silently extrapolating when SPEC is silent (the most insidious hallucination).

**Q8.8.** Per §8.7, what's the schema validation tool?
**A.** **Zod** + `tsc --noEmit` strict. Zod for `tokens.config.ts` runtime shape; tsc for TypeScript types. §8.7. **Catches.** assuming TypeScript alone is enough (Zod adds runtime guards).

**Q8.9.** Per §8.8, what triggers a snapshot lock failure?
**A.** Any change to `dist/tokens.css`, `dist/index.js`, `dist/index.d.ts`, or `dist/tailwind-preset.css` that wasn't intentionally regenerated. Each guard test compares against committed snapshot. §8.8. **Catches.** unintended dist drift (a common regression vector).

**Q8.10.** What's the relationship between §8 (practices) and §2 (constraints)?
**A.** §2 = WHAT must be true (C-rules). §8 = HOW we ensure it (lints, snapshots, schema, pop-quiz). §8 enforces §2; without §8 the C-rules are aspirational. **Catches.** treating one as the other (constraints are not practices, and vice versa).

---

## §9 — Drift Inventory

**Q9.1.** How many drift items did §9 originally list (D1–D16)?
**A.** **16 items** (D1–D16) across `tokens.config.ts`, snapshot files, Figma fixture, and SPEC text. §9 head. **Catches.** counting only the resolved ones (D1, D2 are resolved by PR-N1).

**Q9.2.** What's D1?
**A.** "Border.{accent}.Ghost should not exist (Figma never had it). Deprecation lifecycle." Resolved by PR-N1 (announced) → PR-N1b (removal in 0.3.0). §9.D1. **Catches.** confusing D1 with the §10 D-decisions (different namespace; D1 in §9 = drift, D1 in §10 = decision — both happen to be 1).

**Q9.3.** What's D2?
**A.** "Border.Neutral.Inverted is in Figma but missing from code." Resolved by PR-N1 (added). §9.D2. **Catches.** treating §9.D2 as the same as §10.D2 (different — §10.D2 is about Mint/Teal/etc. having no semantic).

**Q9.4.** What's D5?
**A.** "Fills.Neutral source unclear (Gray.500 vs Gray.600)." Resolved by §10.D5 (Gray.500 + opacity ladder). §9.D5. **Catches.** treating drift items as static — D5 was an unknown that got resolved into a decision.

**Q9.5.** Has D8 been resolved? What's its status?
**A.** D8 (TokenStudio export missing Fills.{accent}) — not fully resolved. Decision §10.D8 says "trust screenshots for v0.1, re-export → v0.2 acceptance." Pending designer Figma re-export. **Catches.** assuming all drifts are closed (some require designer action).

**Q9.6.** Are §9 items tracked in a separate file?
**A.** **No** — they live inline in §9 of SPEC.md. PR-by-PR, items get marked RESOLVED / DEFERRED / WONT-FIX. §9. **Catches.** looking for an external drift-tracker (there isn't one; SPEC IS the tracker).

**Q9.7.** What's the difference between a drift item and a constraint violation?
**A.** Drift = code/Figma mismatch we discovered post-hoc. Constraint violation = code violates a hard C-rule. Drift gets a D-number; violation fails CI immediately. §9 vs §2. **Catches.** confusing the two (they're at different urgency levels).

**Q9.8.** Can a single PR resolve multiple drift items?
**A.** **Yes** — PR-N1 closed D1 (announce) + D2 (add inverted) in one PR. §9 + PR-N1 description. **Catches.** assuming 1:1 PR-to-drift mapping (it's many-to-many).

**Q9.9.** How does a drift item become a decision?
**A.** Drift = unresolved question. When designer + Devin agree on resolution, it gets a §10 D-number, becomes locked, and §9 entry marks RESOLVED. §9 → §10 lifecycle. **Catches.** treating both as equivalent (drift can be open; decision is locked).

**Q9.10.** Is §9 frozen?
**A.** **No** — new drift items can be added if discovered. Each gets a new D-number and goes through the same drift → decision lifecycle. §9 is append-only during normal operation. **Catches.** treating SPEC sections as immutable (most are; §9 + §10 are append-only).

---

## §10 — Decisions Log (D0–D11)

**Q10.1.** What does D0 lock?
**A.** "11 base points end-state. Bootstrap fallback ≤4 per accent during calibration. v0.3 release requires bootstrap_count == 0." §10.D0. **Catches.** confusing v0.2 (allows bootstrap) with v0.3 (requires zero — gated by Bezold-Brücke RFC-005).

**Q10.2.** Why was the v0.2 → v0.3 deferral added?
**A.** Calibration spike (`plan/spec/calibration-spike-2026-04-23.md`) measured Yellow IC ΔE 20.74 with current pipeline. Reaching ΔE ≤ 1.5 needs Bezold-Brücke modeling — not feasible to ship in v0.2. §10.D0 + spike report. **Catches.** assuming the deferral is arbitrary (it's empirically driven).

**Q10.3.** D1 — what's the deprecation path for accent.ghost?
**A.** v0.2.x: announce-deprecate (var emits with warning + replacement → `--border-neutral-ghost`). 0.3.0: schema bump removes the var entirely. §10.D1 + tokens.config.ts:deprecated. **Catches.** assuming immediate removal (G8 grace period requires lifecycle).

**Q10.4.** D2 — why don't Mint, Teal, Yellow, Indigo, Purple, Pink have semantic aliases?
**A.** Figma doesn't have them. Per paradigm "follow Figma 1:1, no extrapolation," we don't add what isn't there. v0.x can add later if demand surfaces. §10.D2 + Figma fixture. **Catches.** assuming "all primitives must have semantic" (only sentiment-mapped ones do).

**Q10.5.** D3 — what's allowlisted as `special_primitives.skeleton_mid` and what's NOT?
**A.** Allowlisted: `#787880`. NOT allowlisted: any other Apple system color (gray, blue, etc.). §10.D3. **Catches.** treating the allowlist as expandable (it's tightly scoped to skeleton's loading-state UX).

**Q10.6.** D4 — when does Materials get full implementation?
**A.** v0.2 RFC-004. v0.1 has opaque approximations only (single color, no `mix-blend-mode`). §10.D4. **Catches.** assuming Materials are implemented (only stubbed).

**Q10.7.** D7 — what design pattern does `Backgrounds.Neutral.Grouped` represent?
**A.** Apple Settings.app-style nested-card. Outer card on `Backgrounds.Neutral.Primary`, inner card on `Grouped.Primary` (slightly different tone for hierarchy). §10.D7. **Catches.** confusing Grouped with column-dividers (different role).

**Q10.8.** D9 — what happens if Devin can't answer a pop-quiz without extrapolation?
**A.** STOP, write `[UNKNOWN]` SPEC entry, ask designer for explicit clarification, do NOT resume work until resolved. §10.D9. **Catches.** silently guessing through a pop-quiz (paradigm violation).

**Q10.9.** D10 — what's the branch protection rule for main?
**A.** Required status checks: `Build + test (Bun)`, `Build (Node + tsx fallback)`, `Preview · R1-R4 (Playwright)`. Linear history required, force pushes/deletions blocked. §10.D10 + GitHub repo settings. **Catches.** assuming weaker rules (e.g., only build checks).

**Q10.10.** D11 — what tier targets does it lock?
**A.** Primary: APCA Lc 75 + WCAG 7:1. Secondary: Lc 60 + 4.5:1. Tertiary: Lc 45 + 3:1. Quaternary: Lc 30 + 2:1. With dual-criterion (stricter-of-both APCA/WCAG) for label tiers. Implementation deferred to PR-N4. §10.D11. **Catches.** confusing Lc 75 (Apple HIG body) with Lc 60 (APCA "incidentally read" min — old default).

---

## §11 — Appendices

**Q11.1.** What's the `tokens.json` Figma export source?
**A.** TokenStudio plugin output from the lemone112 Figma file (Lab UI v.1). Located at `plan/figma/tokens.json` (10210 lines). §11. **Catches.** assuming it's hand-crafted (it's a plugin export — but we treat it as fixture, not as input).

**Q11.2.** Where does the SPEC reference Apple HIG by URL?
**A.** §11 references list. Primary: https://developer.apple.com/design/human-interface-guidelines (specific section per topic — labels, materials, colors). **Catches.** vague "Apple HIG" — must cite specific section/URL for each claim.

**Q11.3.** Where is APCA documented?
**A.** §11 + APCA spec at https://github.com/Myndex/SAPC-APCA. The contrast formula is specified there. **Catches.** assuming WCAG 2.x ratio is APCA (different formulae).

**Q11.4.** What's CIECAM02 in this context?
**A.** The full color appearance model that Hunt's chroma reduction APPROXIMATES. We don't implement CIECAM02 directly (overkill for build-time formula). §11. **Catches.** claiming we implement CIECAM02 (we use 3 scalar knobs as approximation).

**Q11.5.** Where do Bezold-Brücke references live?
**A.** §11 + Hunt 1991 papers + Vienot/Bornstein papers on hue rotation at low lightness. Specific implementations vary; v0.3 RFC-005 picks a pragmatic formula. §11. **Catches.** assuming a single canonical Bezold-Brücke formula (there are several; we choose).

**Q11.6.** What's the plan doc that supersedes implementation-plan-v2.md?
**A.** `plan/spec/SPEC.md` (this file). v2 is now legacy bootstrap; SPEC is canonical for v0.2 onwards. §11 + §0 G6. **Catches.** following implementation-plan-v2.md when it conflicts with SPEC.

**Q11.7.** Where do drift inventory items get tracked alongside the SPEC?
**A.** **Inline in §9.** No separate file. §11. **Catches.** looking for `plan/drift.md` or similar (doesn't exist).

**Q11.8.** What's the `pop-quiz-log.md` referenced in §10.D9?
**A.** Not yet created — created on first pop-quiz. Will live at `plan/spec/pop-quiz-log.md`. §10.D9. **Catches.** assuming the log exists (it's a planned artifact, not yet instantiated).

**Q11.9.** Where do the verification questions (this doc) link from the SPEC?
**A.** **Currently nowhere** — this is a new artifact (`plan/spec/verification-questions.md`) committed in PR-VERIFY. The SPEC will reference it once committed. §11. **Catches.** circular references (SPEC referencing this doc before commit).

**Q11.10.** What's the canonical citation format the SPEC uses?
**A.** `§N.M` (section number) for SPEC anchors. `file_path:line_number` for code. Fixture paths like `plan/figma/tokens.json`. URLs for external. §11 notation. **Catches.** mixing styles (e.g., `Section 4.2` vs `§4.2`) — only `§N.M` is canonical for SPEC.

---

## End of questionnaire

**Total: 120 questions (12 sections × 10).**

If any answer above doesn't match the citation, that's a hallucination — re-anchor the SPEC at that section before resuming.

This document itself is verifiable: every "A." citation should resolve when followed. If any resolves to a non-existent path or a different content, that's a meta-hallucination in this very file — fix here first.
