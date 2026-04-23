# Test Catalog

Auto-generated from `@layer` / `@governs` / `@invariant` headers in every 
`tests/**/*.test.ts` file. Run `bun run catalog` to regenerate.

**Total:** 40 test files

## Cross-layer

### `tests/cross-layer/ic-orthogonal.test.ts`

- **Governs:** plan-v2 §1.5 · Two-axis rendering; plan-v2 §9.2 · Integration tests
- **Invariant:** IC mode amplifies contrast in BOTH light and dark; it does not require a particular base mode. The 4 outputs are real.
- **Why:** A user can opt-in to IC in either light or dark; they should both produce stricter-contrast output.
- **On fail:** check tier_targets.X.ic > tier_targets.X.normal; verify resolveSemantic uses contrast axis.

## Cross-layer · Emit

### `tests/cross-layer/no-raw-numbers.test.ts`

- **Governs:** plan-v2 §6 · Emit + §5 · Semantic layer should reference primitives, not hardcode numeric values.
- **Invariant:** Every semantic line contains an oklch(...) value OR a var(...) reference. No plain hex codes anywhere in the CSS.
- **On fail:** inspect writers/css.ts for hardcoded fallbacks.

## Guard

### `tests/guards/apca-regression.test.ts`

- **Governs:** plan/test-strategy.md §11 · G7 accessibility regression
- **Invariant:** For every (fg, bg, tier, output) pair tracked in the baseline, the current |Lc| may not drop by more than `APCA_REGRESSION_TOLERANCE` Lc. Intentional accessibility changes must regenerate the baseline via `bun run apca-baseline` and land in the same PR.
- **Why:** Spine tweaks, gamut changes, or pivot-mirror edits can unintentionally dim a tier just enough to slip under the APCA target while the tier-assertion test still passes (because the measured value is still within per-token `APCA_TOLERANCE=1.0` of the target). This guard catches *trend* regressions across the whole token surface, not just per-token compliance.
- **On fail:** Inspect the printed delta table to find which tiers dropped. If the drop was intentional (e.g. relaxing a tier target or recalibrating neutrals), rerun `bun run apca-baseline` and commit the new JSON alongside the code change. If unintentional, revert the regressing commit and re-plan.

### `tests/guards/deprecations.test.ts`

- **Governs:** plan/test-strategy.md §11 · G6 no deprecated tokens in dist · §15.3 Deprecation lifecycle
- **Invariant:** For every entry in `config.deprecated`: - If the current `schema_version` < `removed_in`, the old token path is still emitted in `dist/tokens.css` and a CSS warning comment referencing the replacement sits within 3 lines of it. - If `schema_version` >= `removed_in`, the old token path is absent from `dist/tokens.css` entirely. - Every entry has shape `{ replacement, removed_in, reason }` with `removed_in` as valid semver.
- **Why:** Structured deprecation lets downstream consumers migrate without silent breakage: they see the warning comment in their CSS build output during the grace period, then the token disappears after the announced major.
- **On fail:** (a) if a listed deprecation is missing → the emit pipeline dropped it before `removed_in`; restore the token in the writer or bump `removed_in`. (b) if a token past `removed_in` still emits → delete the token from the semantic tree or writer. (c) if the warning comment is missing → check `writeDeprecationComment` hook in `writers/css.ts`.

### `tests/guards/header-lint.test.ts`

- **Governs:** plan/test-strategy.md §14 · Self-documenting tests
- **Invariant:** Each `tests/**\/*.test.ts` file has a top-of-file JSDoc block containing @layer, @governs, @invariant, and @on-fail.
- **Why:** Agents working in the future need bidirectional traceability between the plan and the tests. Missing headers cause orphan tests or uncovered plan claims.
- **On fail:** add the missing tag to the file's top JSDoc block. Example: @layer L3 · Primitives · @governs plan-v2 §4 · @invariant … · @on-fail …

### `tests/guards/perf-budget.test.ts`

- **Governs:** plan-v2 §10 · Performance budgets
- **Invariant:** Colors generation + emit < 150ms on CI. Colors alone < 80ms.
- **Why:** If generation explodes, dev loop suffers and CI queues back up.
- **On fail:** profile with Bun.nanoseconds(); usual culprit = apca_inverse with too many iterations (max 24), or excessive spine sampling.

### `tests/guards/schema-version.test.ts`

- **Governs:** plan/test-strategy.md §11 · G8 config schema backward compat
- **Invariant:** `config.schema_version` tracks `package.json.version` at (major, minor) granularity. Patch drift is allowed (pure bugfix releases don't have to touch the config shape), but a minor or major bump in the package MUST correspond to either (a) a matching schema bump + migration note, OR (b) an additive-only change that doesn't rename / remove cells. * Breaking changes (removed / renamed cells) additionally require a `config.deprecated` entry announcing the removal at least one minor release before it lands (see G6).
- **Why:** Without this pin, a consumer upgrading `@lab-ui/tokens` from 0.2.x → 0.3.x can't tell from the version alone whether the config shape changed under them. The schema_version is the contract.
- **On fail:** Either bump `config.schema_version` to match the package version, or roll the package version back until a CHANGELOG entry + schema bump lands together.

### `tests/guards/size-budget.test.ts`

- **Governs:** plan/test-strategy.md §11 · G5 dist size budget
- **Invariant:** `dist/tokens.css` gzipped stays under 30 KB. ESM bundle (`dist/index.js`) under 10 KB gzipped; type declarations (`dist/index.d.ts`) under 6 KB gzipped. Budgets are deliberately slightly above the current baseline so routine edits are free but runaway growth is caught.
- **Why:** If the emit layer balloons without anyone noticing, downstream consumers (Tailwind preset, app bundles) pay the cost silently. Guarding here forces intentional conversations.
- **On fail:** (a) new tokens pushed an output past budget → raise the budget here with a one-line rationale; (b) emit regressed (duplicated rules, verbose selectors, lost deduping) → investigate the writer that grew fastest.

### `tests/guards/snapshot-css.test.ts`

- **Governs:** plan/test-strategy.md §11 · G1 snapshot CSS stable
- **Invariant:** `dist/tokens.css` matches the committed snapshot byte-for-byte. Routine edits that touch the emit layer surface here as an obvious diff in CI.
- **Why:** Without a full-output lock, small writer tweaks (e.g. a stray space, a reordered family) slip through and break downstream consumers' own snapshot tests silently.
- **On fail:** (a) intentional change → rerun with `bun test -u` to update the snapshot, and note the user-visible change in the PR body; (b) unintended → bisect recent commits to the emit layer (writers/*, generators/*).

### `tests/guards/snapshot-esm.test.ts`

- **Governs:** plan/test-strategy.md §11 · G2 snapshot ESM stable
- **Invariant:** `dist/index.js` and `dist/index.d.ts` match their committed snapshots byte-for-byte.
- **Why:** The ESM + DTS pair is the JS/TS consumer API surface. Silent drift here breaks type inference in downstream apps and Tailwind presets that import token maps directly.
- **On fail:** (a) intentional change (new token, renamed export) → rerun with `bun test -u` and document the API change in the PR; (b) unintended → bisect writers/esm.ts or writers/dts.ts.

### `tests/guards/snapshot-lock.test.ts`

- **Governs:** plan-v2 §9 · Invariants
- **Invariant:** A handful of canonical anchor values stay stable across routine edits. Intentional changes require updating this file.
- **On fail:** (a) intentional calibration change → update here; (b) unintended drift → track down recent commit touching generators/resolver.

### `tests/guards/snapshot-tailwind.test.ts`

- **Governs:** plan/implementation-plan-v2.md §16 · Tailwind v4 preset
- **Invariant:** `dist/tailwind-preset.css` matches the committed snapshot byte-for-byte. Protects the public `@lab-ui/tokens/tailwind` surface that downstream Tailwind consumers import.
- **Why:** The preset is a thin mapping layer over the primitive / semantic namespaces. Silent changes to its shape break utility class resolution in consumer apps without surfacing in CSS-level tests.
- **On fail:** (a) intentional shape change → rerun with `bun test -u`, note the new/removed mappings in the PR body; (b) unintended → inspect `src/writers/tailwind-preset.ts` and the data it receives from the build.

## L1 (units)

### `tests/L1-units/integer-px.test.ts`

- **Governs:** plan-v2 §2.3 · Constraint
- **Invariant:** Every internal `units.values.unit-N` is an integer pixel at root font-size 16 across the plan's four recommended scaling presets {0.75, 1.0, 1.166, 1.333}. Non-integer unit-1 would break subpixel rendering after `rem` → px resolution.
- **On fail:** pick a scaling factor from plan §2.3 presets {0.75, 1.0, 1.166, 1.333}. If you need stricter grid alignment (base_px*scaling integer), use {0.75, 1.0, 1.25}.

## L1/L2 × Emit

### `tests/L1-units/emit.test.ts`

- **Governs:** plan-v2 §2.4 · Units output · §3 · Dimensions
- **Invariant:** Emitted tokens.css contains --unit-*, --padding-*, --radius-*, --size-* in a mode-invariant :root block. Values are in `rem` (except --radius-full, which uses calc(infinity * 1rem)).
- **On fail:** check writers/dimensions.ts slugs and iteration.

## L2 (dimensions · radius)

### `tests/L2-dimensions/radius-anchors.test.ts`

- **Governs:** plan-v2 §3.2 Radius · §3.5 Output · §3.6 Invariants
- **Invariant:** Radius family emits exactly 5 anchors (none/min/base/max/full); `--radius-full` emits as `calc(infinity * 1rem)`; monotonic ordering `0 = none < min < base < max < full`.
- **On fail:** check generators/dimensions.ts radius resolution and writers/dimensions.ts emitRadius — anchor set must match plan §3.2 R1 Hybrid exactly; no legacy t-shirt steps.

### `tests/L2-dimensions/radius-concentric.test.ts`

- **Governs:** plan-v2 §3.4 Concentric radius pattern · §3.5 ESM helpers
- **Invariant:** `innerOf(outer, pad)` returns `clamp(var(--radius-min), calc(outer - pad), var(--radius-max))`; `outerOf(inner, pad)` returns `min(var(--radius-max), calc(inner + pad))`; floor = radius-min (never 0), ceiling = radius-max (never radius-full/infinity).
- **On fail:** update writers/esm.ts helpers to emit the exact clamp/min string shape from plan §3.4; confirm neither helper leaks the pill sentinel (radius-full) into auto-computed nesting.

## L2 (dimensions)

### `tests/L2-dimensions/airiness-shift.test.ts`

- **Governs:** plan-v2 §3.3 · Airiness application
- **Invariant:** airiness=1.0 is identity. airiness>1.0 shifts larger steps more than smaller ones (log2 factor × step).
- **Why:** Compact semantic names (xxs, xs) stay compact; big names (xl, 2xl) scale more with airiness — matches perceived looseness.
- **On fail:** inspect applyAiriness in generators/dimensions.ts.

### `tests/L2-dimensions/family-coverage.test.ts`

- **Governs:** plan-v2 §3.2 · Families
- **Invariant:** Every family has the names required by the course-§05 design system (none, xxs..7xl where applicable).
- **On fail:** add missing names to config.dimensions.*; verify writer emits them via tokens.css snapshot.

## L3 (primitive)

### `tests/L3-primitives/ic-amplify.test.ts`

- **Governs:** plan-v2 §4.1 · Neutrals (endpoints_ic)
- **Invariant:** IC contrast stretches the neutral endpoints (L12 in IC = 0.0 pure black vs 0.08 in normal). Ensures higher contrast ratios are mathematically achievable.
- **Why:** IC mode must reach AAA Lc targets; that requires broader L range.
- **On fail:** check config.colors.neutrals.endpoints_ic; verify primitive generator branches on contrast.

### `tests/L3-primitives/neutral-mirror.test.ts`

- **Governs:** plan-v2 §4.1 · Neutrals
- **Invariant:** Neutral scale is generated once; dark mode is a pivot-mirror (index reverse) of light mode physical L values. When the neutrals are fully ladder-driven (`L/C/H_ladder` set) the mirror is exact because perceptual-comp is bypassed — see `generatePrimitiveColors`. Otherwise the `-0.02` dark HK shift applies and is subtracted before comparison.
- **Why:** Pivot-mirror gives consistent perceptual stepping on both modes without a second ladder to maintain.
- **On fail:** inspect generatePrimitiveColors neutral loop. Check whether ladder skip-comp path and curve-path still produce the same physical L reference.

### `tests/L3-primitives/opacity-primitive.test.ts`

- **Governs:** plan-v2 §4.4 · Opacity primitive
- **Invariant:** Stops are sorted, unique, include 0, include boundary values (1, 99), and span 0..99.
- **Why:** Opacity is a primitive axis; semantic tokens compose with it.
- **On fail:** check config.colors.opacity.stops.

### `tests/L3-primitives/perceptual-comp.test.ts`

- **Governs:** plan-v2 §4.3 · Perceptual compensation
- **Invariant:** `applyPerceptualComp` with the `dark` cell reduces chroma by `chroma_mult` (≈0.93) and lightness by `|lightness_shift|` (≈0.02) relative to the input. Accents that do NOT carry an explicit `primitive_per_mode` flow through this transform in `generatePrimitiveColors`.
- **Why:** Accents on dark surrounds appear MORE saturated (Hunt) and BRIGHTER (HK); physically reducing C and L compensates.
- **On fail:** verify config.colors.perceptual_comp.dark values; check applyPerceptualComp order in pipeline (must be AFTER spine+chroma_curve, BEFORE gamut_clamp). * Post primitive-per-mode calibration: every accent now pins its light + dark primitive value directly against the Figma anchor, so `generateAccents` bypasses the comp transform. We still validate the transform itself as a pure function so the fallback path (any accent without `primitive_per_mode`) keeps working.

### `tests/L3-primitives/spine-clamping.test.ts`

- **Governs:** plan-v2 §4.2 · Accent spines
- **Invariant:** Sampling below spine[0].L returns spine[0]; above spine[-1].L returns spine[-1]. Never extrapolate.
- **Why:** Extrapolation off the ends produces wild H values that violate the monotonic invariant and break gamut-clamp.
- **On fail:** check spineInterp clamp logic; confirm caller is not passing negative or >1 L.

### `tests/L3-primitives/spine-monotonic.test.ts`

- **Governs:** plan-v2 §4.2 · Accent spines
- **Invariant:** For every accent, H(L) sampled densely along the spine is monotonic (or near-monotonic with Hermite-induced overshoot ≤ 5°). Hue must not oscillate.
- **Why:** Non-monotonic H causes perceived color jumps (yellow → olive → yellow) as tier L moves — destroys the "same accent family" feel.
- **On fail:** add a control point at the offending L, or simplify the spine (remove a point causing overshoot).

### `tests/gamut.test.ts`

- **Governs:** plan-v2 §9 · Gamut safety invariant
- **Invariant:** Every primitive OKLCH in every output key fits the configured gamut.
- **Why:** Out-of-gamut values get silently clipped by the browser, producing per-display color drift. We clamp upstream with a safety margin.
- **On fail:** adjust accent.chroma_curve.peak or accent.chroma_boost_per_dL; verify config.colors.gamut matches target displays.

## L3/L4 · Guard

### `tests/snapshot.test.ts`

- **Governs:** plan-v2 §6 · Emit layer · §9 · Invariants
- **Invariant:** Canonical anchors (13 neutrals, 29 opacity stops, Figma brand anchor L, tier Lc targets) stay stable across routine edits; a change here means parameters moved.
- **On fail:** if intentional, update the snapshot; otherwise investigate what upstream changed (commit SHA in PR title helps).

## L4 (semantic)

### `tests/L4-semantic/composition-derivable.test.ts`

- **Governs:** plan-v2 §1.3 · Composition derivable · §5.2 · Semantic tree
- **Invariant:** All label tiers (primary..quaternary) have alpha=1. They are solid spine-points, not opacity-composed. Opacity is reserved for overlays, fills, borders-soft, fx.
- **Why:** Unified spine model — tiers are solid colors at distinct L targets, not opacity-washes of a single anchor.
- **On fail:** inspect SemanticsConfig — labels must use kind=pipeline without opacity_stop.

### `tests/references.test.ts`

- **Governs:** plan-v2 §5 · Semantic tree
- **Invariant:** Every semantic has a value per OutputKey with L∈[0,1], C≥0, H∈[0,360), alpha∈[0,1], all finite.
- **On fail:** inspect generator emitting NaN/∞; most common cause is spine validation bypass or chroma_curve with negative peak.

## L4 (semantic) × Emit

### `tests/L4-semantic/shadow-presets.test.ts`

- **Governs:** plan-v2 §6 · Emit · §5.2 · fx.shadow_presets
- **Invariant:** 5 presets (xs/s/m/l/xl), 1-4 layers each, xs=1, xl=4 layers. Each layer carries tint_var referencing a shadow-tint var.
- **On fail:** adjust config.semantics.fx.shadow_presets.

## L4 (semantic) × Resolution

### `tests/L4-semantic/tier-hierarchy.test.ts`

- **Governs:** plan-v2 §5.1 · Tier targets
- **Invariant:** For any accent family, measured APCA Lc decreases along primary > secondary > tertiary > quaternary on each output.
- **Why:** Tier naming encodes visual prominence; inversions break that.
- **On fail:** tier_targets ordering broken, or spine extrapolation produced identical L for adjacent tiers (too-short spine).

### `tests/contrast.test.ts`

- **Governs:** plan-v2 §5.1 · Tier targets
- **Invariant:** primary/secondary/border_strong tiers meet their APCA target (±2 tolerance) on their canonical_bg across all 4 OutputKeys.
- **Why:** Labels must be readable; strict tiers are the body-text / strong- border cases where failure breaks accessibility.
- **On fail:** adjust the accent spine — usually by pulling the dark control point lower in L, or raising chroma_boost_per_dL. If structural, revisit tier_targets in config.

## L4 Semantics · emission surface

### `tests/L4-semantics/tailwind-preset.test.ts`

- **Governs:** plan/implementation-plan-v2.md §16 · Tailwind v4 preset
- **Invariant:** The generated `dist/tailwind-preset.css` wraps all Lab UI primitive + semantic color tokens into Tailwind's `--color-*` namespace, exposes `--spacing` as the base increment, and maps radius / shadow / blur / font rungs onto Tailwind's own `--radius-*` / `--shadow-*` / `--blur-*` / `--text-*` / `--font-*` namespaces.
- **Why:** The preset is the mapping contract between Lab UI's token namespace and Tailwind v4's utility namespace. If it drifts the downstream `bg-brand`, `p-4`, `rounded-md`, `shadow-sm`, … etc. utilities stop resolving and apps silently render defaults.
- **On fail:** A missing mapping here usually means a writer branch was skipped. A duplicated or mistyped mapping collides Tailwind utility classes — inspect `src/writers/tailwind-preset.ts`.

## L4 × Guard

### `tests/L4-semantic/pipeline-determinism.test.ts`

- **Governs:** plan-v2 §1.3 · Resolution pipeline
- **Invariant:** generatePrimitiveColors + generateSemanticColors is a pure function. No randomness, no IO, deterministic output.
- **Why:** If generation drifted, CI snapshot would constantly fail.
- **On fail:** find non-pure operations (Date.now, Math.random, env-dependent).

## L5 (typography)

### `tests/L5-typography/scale.test.ts`

- **Governs:** plan-v2 §6.2 · Генерация · §6.3 · Constraint
- **Invariant:** Sizes ascend monotonically and sit on a base_px/2 grid (§02 rule 1). 'm' equals base_size_step × base_px × scaling.
- **On fail:** if a step collapses onto its predecessor, either raise scale_ratio or lower base_size_step; generator enforces strict monotonic by bumping +1 grid unit when needed.

## L5 (typography) × Emit

### `tests/L5-typography/semantics.test.ts`

- **Governs:** plan-v2 §6.5 · Semantic aliases
- **Invariant:** Every declared alias maps to a real scale key, and the emitted CSS references --font-size-<key> (not raw px).
- **On fail:** check config.typography.semantics for typos; check writers/typography.ts alias emit.

## L6 (z-index)

### `tests/L6-z-index/values.test.ts`

- **Governs:** plan-v2 §7 · Layer 6 Z-index
- **Invariant:** Every --z-* value is a finite integer. Layer is mode-invariant (single :root block).
- **On fail:** non-integer → browsers implementation-define behavior; adjust config to integer values or check for typos.

## L7 (materials)

### `tests/L7-materials/modes.test.ts`

- **Governs:** plan-v2 §8 · Layer 7 Materials
- **Invariant:** material_mode ∈ {solid, glass, backdrop}. Each level emits --materials-<name>-bg, --materials-<name>-filter, --materials-<name>-backdrop-filter. Default block uses default_mode; the two other modes live in [data-material-mode="…"] overrides.
- **On fail:** if glass_blur / backdrop_blur references a blur step that does not exist in dimensions.fx_blur, the generator emits a warning pointing at the offending level.

## Parity

### `tests/parity/accent-anchors.test.ts`

- **Governs:** plan/test-strategy.md §10 Parity · PT1 (plan target ΔE ≤ 3)
- **Invariant:** 11 accent hues match the Figma Color Guides primary sectors (`light/normal`, `dark/normal`) within ΔE2000 ≤ 1.0 because `accents.<name>.primitive_per_mode` pins those sectors byte-for-byte against the fixture. * The IC sectors (`light/ic`, `dark/ic`) are intentionally NOT calibrated here: primitive accents are a `mode`-only axis (plan §4.2). IC variation lives on the semantic tier (`--label-brand-primary-ic` etc. in plan §5.1) where per-tier APCA targeting produces the darker / lighter IC shade from the same spine. Comparing the Figma IC sector HEX against our primitive `--{accent}` var would be a category error; we still log those rows for information and keep a loose sanity guard of ΔE ≤ 60 on them so the numbers are visible in CI output. * @on-fail If a primary-sector row regressed, inspect the Figma HEX in the printed table and fix `config.colors.accents.<name>.primitive_per_mode` to re-pin the sector. If an IC-sector row crosses the sanity guard, something broke the primitive-mode orthogonality (e.g. perceptual-comp leaked in, or a writer collapsed scopes).
- **On fail:** If a primary-sector row regressed, inspect the Figma HEX in the printed table and fix `config.colors.accents.<name>.primitive_per_mode` to re-pin the sector. If an IC-sector row crosses the sanity guard, something broke the primitive-mode orthogonality (e.g. perceptual-comp leaked in, or a writer collapsed scopes).

### `tests/parity/mode-sector-order.test.ts`

- **Governs:** plan/test-strategy.md §10 Parity · PT1/PT2 mode-mapping prereq
- **Invariant:** Figma `Color wrap` ellipse order (4, 5, 6, 7) maps to our four CSS output scopes in this order: [light/normal, light/ic, dark/ic, dark/normal]
- **On fail:** Figma has re-rotated the pie sectors, or we reshuffled the `data-mode/data-contrast` scopes. Either the fixture or the CSS writer moved — do NOT blindly re-order tests, re-derive the mapping by inspecting neutral-0 across all 4 scopes. * We assert this via neutrals (which are bit-stable between our emit and Figma) rather than accents (where our spine is not yet calibrated to Figma — that is PT1's job). Any neutral step with 4 distinct HEX values across modes works as a lock; step 0 is the strongest because it spans the full L range (white ↔ black).

### `tests/parity/neutral-anchors.test.ts`

- **Governs:** plan/test-strategy.md §10 Parity · PT2 (plan target ΔE ≤ 2)
- **Invariant:** 13 neutral steps × 4 modes match Figma within ΔE2000 ≤ 1. Threshold is tighter than the plan target because the L/C/H ladders in `neutrals` are pinned directly against the Figma fixture — any non-zero ΔE signals either a rounding regression, a gamut-clamp change, or a Figma fixture update.
- **On fail:** Either a rounding / perceptual-comp / gamut path re-entered the neutrals pipeline, or the fixture was updated. Inspect the printed delta table to identify which step/mode regressed and adjust either the generator or the ladder in `config.colors.neutrals.{L,C,H}_ladder`.
