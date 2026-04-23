# Lab UI tokens — live handoff

> Living document. **Anyone continuing this work should read §1–§3 first.**
> Update this file in the same PR as any significant change. The goal is
> that a fresh agent (or a human) can pick up mid-stream without losing
> context.

Last PR opened against this doc: **PR-G · PT1 IC via `primitive_per_output`** (`devin/1776935674-pt1-ic-per-output`).

Any new agent: your `bun test` output should show **233 pass, 0 fail**.
If PT1 max ΔE prints anything above 1.0, something regressed — start
with `tests/parity/accent-anchors.test.ts`.

---

## 1. What is this repo

`packages/tokens` is a headless TypeScript library that compiles one
source-of-truth config (`config/tokens.config.ts`) into three build
artifacts (`dist/tokens.css`, `dist/tokens.esm.js`, `dist/tokens.d.ts`)
plus a Tailwind v4 preset (`dist/tailwind-preset.css`).

The output covers four orthogonal axes:

- **Base mode** — `light` | `dark`
- **Contrast** — `normal` | `ic` (IC = Increased Contrast, AAA-adjacent)
- **Tier** — `primary`, `secondary`, `tertiary`, `quaternary`, `border_strong`
  (APCA-targeted within each semantic family)
- **Family** — backgrounds / labels / fills / borders / fx / misc

There is **no application code.** No UI, no browser runtime here. All
verification is Bun unit tests (`bun test`). Do not try to enter
test-mode for UI testing on this repo — there is nothing to click.

Governing documents:

- `plan/implementation-plan-v2.md` — the architectural spec
- `plan/test-strategy.md` — §10 parity (PT1/PT2/PT3), §11 guards (G1..G8)
- `plan/handoff.md` (this file) — where we are right now

---

## 2. Architectural invariants that must NOT be broken

These are the hard-won rules. Most were established via PRs; each has a
test guarding it.

1. **Primitive accents support a full `(mode × contrast)` axis via
   `primitive_per_output`.** `--{accent}` can differ per sector
   (`light/normal`, `light/ic`, `dark/ic`, `dark/normal`) — e.g.
   Yellow light/ic `#B25000` is brown, intentionally distinct from
   `#FFD000` light/normal. When `primitive_per_output` is set for an
   accent, the pipeline emits the sector value verbatim and
   bypasses spine + comp for that sector.
   - Legacy `primitive_per_mode` (2-sector `{light, dark}`) is still
     honoured when `_per_output` is absent — useful for accents
     where IC should collapse onto mode.
   - Spine-sampled + comp-adjusted is the fallback when neither pin
     is set (no production accent currently uses this path).
   Tests: `tests/parity/accent-anchors.test.ts` (all 4 sectors
   ≤ 1.0 ΔE), `tests/L3-primitives/perceptual-comp.test.ts`.

2. **Ladder-driven neutrals bypass perceptual-comp.** When
   `neutrals.L_ladder`, `C_ladder`, or `H_ladder` is set, the pipeline
   emits the ladder values directly and skips `applyPerceptualComp` —
   otherwise comp would double-adjust an already-calibrated reference.
   Tests: `tests/L3-primitives/neutral-mirror.test.ts`,
   `tests/snapshot.test.ts` (both detect `LADDER_DRIVEN`),
   `tests/parity/neutral-anchors.test.ts`.

3. **Pin-per-output / pin-per-mode bypass spine + comp.** When
   `accents.<name>.primitive_per_output[sector]` or
   `.primitive_per_mode[mode]` is set, `generatePrimitiveColors`
   emits the pinned OKLCH directly and bypasses anchor +
   `applyPerceptualComp`. `_per_output` takes precedence over
   `_per_mode` when both are present. Same bypass pattern as neutral
   ladders. Tests: `tests/parity/accent-anchors.test.ts`,
   `tests/L3-primitives/perceptual-comp.test.ts`.

4. **Spine calibration is a semantic-tier concern.** Don't touch
   `accents.<name>.spine` to fix a primitive-layer delta — that would
   re-shape the tier-aware APCA resolution. Pin via
   `primitive_per_output` instead (or `primitive_per_mode` if the
   accent genuinely collapses IC onto mode).

5. **Brand ≠ Blue at the primitive layer.** Figma's brand HEX is
   `#007AFF` while blue is `#3E87FF`. `brand` is its own `AccentDef`
   with blue's spine (so tier semantics align) but a distinct
   `primitive_per_output`.

6. **Writers are snapshot-locked.** `G1` (CSS), `G2` (ESM), and
   `G5` (size budget) pin `dist/*` byte-for-byte. Any writer change
   must regenerate snapshots via `bun test -u` in the same commit.

7. **Tier APCA has per-token compliance (1.0 Lc) AND trend guard
   (3.0 Lc).** The per-token validator lives in
   `src/validators/apca.ts`; the trend guard is
   `tests/guards/apca-regression.test.ts` (G7) against
   `__snapshots__/apca-baseline.json`.

8. **Schema version tracks `package.json` (major, minor).** Patch
   drift is allowed. Bumping minor/major requires a schema bump AND
   matching `deprecated` lifecycle entries for any removed cells.
   Tests: `tests/guards/schema-version.test.ts` (G8),
   `tests/guards/deprecations.test.ts` (G6).

9. **`config.deprecated` keys are emitted CSS var names, not config
   paths.** The semantic tree uses hand-crafted abbreviations (`bg-*`
   vs `backgrounds.*`, `badge-label-contrast` vs
   `misc.badge.label_contrast`, underscores → hyphens, mixed-case →
   lowercase — see `generators/semantic-colors.ts::collectEntries`)
   that cannot be derived mechanically from the config path. The
   registry intentionally uses the literal `--var-name` string so the
   writer + guard don't need a mapping function that would drift out
   of sync with `collectEntries`. See `DeprecationEntry` doc in
   `src/types.ts` for the full rationale.

---

## 3. Where we are right now (as of PR-F)

### In `main`

| PR | what landed | parity impact |
|---|---|---:|
| #13 | Figma parity infra + PT1/PT2/PTMODE tests + fixture | baseline |
| #14 | Guards G1/G2/G5 (CSS/ESM snapshot + size budget) | — |
| #17 | Tailwind v4 preset + snapshot guard | — |
| #18 | neutral L_ladder calibration | PT2: 16.31 → 4.66 ΔE |
| #19 | neutral C/H ladders (bypass comp) | PT2: 4.66 → **0.00** ΔE |
| #20 | accent `primitive_per_mode` per-mode pinning | PT1 primary: 36.89 → **0.11** ΔE |
| #22 | G6 + G8 guards + living handoff | — |
| #23 | `TokensConfig.deprecated` JSDoc fix (PR-F follow-up) | — |

### In flight

**PR-G** (`devin/1776935674-pt1-ic-per-output`) — this PR:

- Opens the contrast axis on the primitive accent layer. New type
  `PrimitivePerOutput = Partial<Record<OutputKey, OklchValue>>` and
  new field `AccentDef.primitive_per_output`.
- `generatePrimitiveColors` now prefers `_per_output[sector]` over
  `_per_mode[mode]`; both bypass spine + comp.
- All 11 accents migrated from `primitive_per_mode` to
  `primitive_per_output`, pinned to Figma's 4-sector HEX anchors
  (fixture `tests/parity/fixtures/figma-anchors.json`).
- `tests/parity/accent-anchors.test.ts` rewritten with a uniform
  `≤ 1.0 ΔE` threshold across all 4 sectors. No more `IC_SANITY`
  bifurcation.
- G1 CSS snapshot regenerated (IC accent values shifted across all
  11 accents). G2 ESM + G5 size byte-identical (ESM is a `var(--...)`
  barrel, no HEX). G7 APCA baseline byte-identical (tier Lc targets
  depend on tier_targets, not on primitive HEX).
- Updated invariants §2.1, §2.3, §2.5 to reflect the per-output axis.

### Queued after PR-G

| PR | scope | rationale |
|---|---|---|
| **PR-H** | PT3 semantic-diff tooling | Now that PT1 + PT2 are pinned byte-tight, it's useful to see per-PR what semantic output shifts. Script takes two git refs, rebuilds both, emits a matrix of `(semantic × output) → ΔLc / ΔHEX`. CI posts as a PR comment. |
| **PR-I** | `apps/preview/` + R4 Tailwind integration | The biggest. Vite app that imports `@lab-ui/tokens/tailwind`, Playwright R1-R4 checks (CSS var resolution, mode/contrast toggling, real Tailwind compilation). Unblocks breakpoints/z-index/materials wiring in the preset. |

---

## 4. Operating rules for the next agent

### 4.1. Branch hygiene — mandatory

**After every merge of your own PR, before starting the next one:**

```bash
git fetch origin main
git checkout main
git reset --hard origin/main       # only on own agent-owned branches!
git checkout -b devin/$(date +%s)-<slug> main
```

**If you create a branch before a previous PR merges**, you MUST
rebase before pushing:

```bash
git fetch origin main
git rebase origin/main
# resolve conflicts (typically G1 snapshot + test-catalog)
bun run build && bun test -u && bun run catalog
git push --force-with-lease
```

The failure mode this prevents: PR-N2 based on stale `main` silently
conflicts with the just-merged PR-N1 on the G1 snapshot. Happened on
#20 vs #19 — caught by the merge-bot, but cost a rebase.

### 4.2. Snapshots are signal, not noise

Guards G1 / G2 / G5 (`tests/guards/snapshot-*.test.ts`) intentionally
fail on any `dist/*` diff. When a guard fails:

1. Read the diff — is the change semantically what you expected?
2. If yes: `bun test -u` to regenerate, commit in the same PR, and
   note the user-visible change in the PR body.
3. If no: bisect recent generator / writer edits. Don't blindly `-u`.

### 4.3. Parity thresholds — tightening policy

| test | current max | threshold | guard |
|---|---:|---:|---|
| PT2 neutrals | 0.00 | 1.0 | `tests/parity/neutral-anchors.test.ts` |
| PT1 (all 4 sectors) | 0.11 | 1.0 | `tests/parity/accent-anchors.test.ts` |
| G7 APCA | 0 | 3.0 Lc regression | `tests/guards/apca-regression.test.ts` |

Tightening thresholds is always a separate PR driven off the delta
table printed by the test. Never tighten in the same PR as a
calibration change — the reviewer can't tell which part of the PR is
the calibration vs the tightening.

### 4.4. Commands reference

```bash
# everyday loop
bun run build                              # emits dist/*
bun test                                   # all guards + parity + generators

# regen (use sparingly, always commit result)
bun test -u                                # snapshot refresh
bun run apca-baseline                      # G7 baseline refresh
bun run catalog                            # test-catalog.md refresh
bun run fetch-figma                        # re-scrape Figma anchors (if token present)
```

### 4.5. Known sharp edges

- **`generatePrimitiveColors` branching.** If a neutral ladder is
  set, or an accent has `primitive_per_output` / `primitive_per_mode`
  set, `applyPerceptualComp` is skipped for that entry.
  `tests/L3-primitives/perceptual-comp.test.ts` validates
  `applyPerceptualComp` as a pure function because every production
  accent now uses `primitive_per_output` — the comp path isn't
  exercised in the happy build.

- **Teal is actually sky-blue.** Figma labels `#5AC8FA` "Teal" but its
  OKLCH hue sits at H ≈ 231°. We honour Figma as-is (user approved).
  Don't "fix" this — it's intentional fidelity.

- **Brand is a first-class accent.** It has its own spine and its own
  `primitive_per_output`. The spine is deliberately the same as blue's
  so tier-semantic resolution stays in lockstep, but the primitive is
  pinned to `#007AFF` (blue's is `#3E87FF`).

- **`NeutralsConfig.L_ladder.ic[12]` is `0.0`**, not `0.08`. Figma's IC
  dark endpoint is literal pure black. The L_ladder pin makes
  `endpoints_ic.L12` effectively dead config in IC mode (still valid
  for the curve-driven fallback path).

---

## 5. What "done" looks like for the queued PRs

### PR-H · PT3 semantic-diff tooling

Exit criteria:

- `bun run semantic-diff <from-ref> <to-ref>` produces a table of
  `(semantic × output)` rows whose Lc or HEX changed between two git
  refs.
- CI posts this as a PR comment on any `config/tokens.config.ts` or
  `config/semantics/**` change.
- Guard enforces that significant Lc shifts (>3 Lc per G7) are called
  out in the PR body.

Files almost certainly added:

```
packages/tokens/scripts/semantic-diff.ts
packages/tokens/scripts/post-semantic-diff-comment.ts
.github/workflows/semantic-diff.yml
plan/handoff.md
```

### PR-I · `apps/preview/` + R4

Exit criteria:

- Vite app at `apps/preview/` that imports
  `@lab-ui/tokens/tailwind` and renders every semantic + primitive.
- Playwright test `tests/runtime/r4.spec.ts` verifies (a) CSS vars
  resolve, (b) mode toggle works, (c) Tailwind compiled classes
  actually apply the correct color (`getComputedStyle` check).
- Added to CI as a separate job (not blocking by default until
  stable).

Files almost certainly added:

```
apps/preview/**
packages/tokens/tests/runtime/r4.spec.ts
.github/workflows/runtime.yml
plan/handoff.md
```

---

## 6. Test catalog snapshot

As of this PR (PR-G): **40 test files, 233 pass, 0 fail.** See
`packages/tokens/docs/test-catalog.md` for the auto-generated index.

---

## 7. Handoff discipline

When you pick this up:

1. Read §1 and §2 in full.
2. Skim §3 for the current state and what's in flight.
3. Read §4 for operating rules.
4. When you finish your PR, update §3 (move the in-flight entry to
   "in main", add the next in-flight entry) and any invariants in §2
   that your PR introduced.
5. Append new sharp edges to §4.5 as you find them.
