# Lab UI tokens — live handoff

> Living document. **Anyone continuing this work should read §1–§3 first.**
> Update this file in the same PR as any significant change. The goal is
> that a fresh agent (or a human) can pick up mid-stream without losing
> context.

Last PR opened against this doc: **PR-I · preview app + R1-R4 Playwright** (`devin/1776939031-preview-app`).

Any new agent: your `bun test` output (under `packages/tokens`) should show
**247 pass, 0 fail**; your `pnpm --filter @lab-ui/preview exec playwright test`
should show **7 pass** across R1-R4.
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

The headless generator lives at `packages/tokens`; verification there is
Bun unit tests (`bun test`). As of PR-I there is **also a browser
application** at `apps/preview/` — a Vite app that imports the generator's
Tailwind v4 preset and raw CSS vars, lets a human toggle the four
sectors, and is driven by Playwright R1-R4 specs. That's the only
visible code in the repo.

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
| #24 | `primitive_per_output` · 4-sector Figma pinning | PT1 all sectors: 27.90 → **0.11** ΔE |
| #25 | PT3 semantic-diff tooling · `bun run semantic-diff` | — |

### In flight

**PR-I** (`devin/1776939031-preview-app`) — this PR:

- Adds `apps/preview/` as a Vite + Tailwind v4 + TS workspace app.
  Depends on `@lab-ui/tokens` via `workspace:*`.
- Imports in `apps/preview/src/styles.css`:
  1. `@import "tailwindcss"` — core utilities
  2. `@import "@lab-ui/tokens/tailwind"` — Lab UI preset (theme mapping)
  3. `@import "@lab-ui/tokens/css"` — the actual variable values
  4. `@source inline("{bg,text,border}-{brand,red,...,pink}")` —
     safelist for dynamically composed accent utilities (Tailwind v4's
     content scanner only reads statically-written class names; the
     preview's `bg-${accent}` needs a safelist).
- UI: sticky mode/contrast toggles + 4 sections — primitives
  (13 neutrals, 11 accents), backgrounds (3 tiers), labels
  (6 families × 4 tiers), Tailwind-utility-vs-raw-var pairs.
- Playwright config at `apps/preview/playwright.config.ts`. Chromium
  only, retains traces on failure, auto-launches `vite dev` unless
  `PW_BASE_URL` is set (used in CI against `vite preview`).
- Specs at `apps/preview/tests/e2e/tokens.spec.ts`:
  - **R1** — every expected token resolves in every sector
    (light/normal, light/ic, dark/normal, dark/ic). 4 tests.
  - **R2** — `data-mode` light↔dark flips `--bg-primary` and
    `--label-neutral-primary`. 1 test.
  - **R3** — `data-contrast` normal↔ic shifts primitives; yellow
    and orange specifically must change (IC brown/earth-tone
    replacement, per Figma). 1 test.
  - **R4** — `bg-{accent}` Tailwind utility `getComputedStyle` equals
    raw `var(--{accent})` verbatim. 1 test × 11 accents.
- CI: `.github/workflows/preview-ci.yml`. Runs on `apps/preview/**`,
  `packages/tokens/**`, or the workflow itself. Uses pnpm + Node 22 +
  Bun 1.1.38; builds tokens, builds preview, installs Playwright
  chromium, runs the suite. Uploads the HTML report on failure.
- No change to `packages/tokens/**` or the snapshot guards.

**PR-H** (`devin/1776936429-semantic-diff`) — merged as #25:

- Added `packages/tokens/scripts/semantic-diff.ts` — CLI that builds
  `dist/tokens.css` at two git refs (via `git worktree` into
  `/tmp`), parses the four `:root` blocks brace-aware, and emits a
  structured diff per `(scope, --var)` cell.
- Color-aware: each changed cell reports `ΔE2000` (sRGB) and
  `ΔL × 100` (OKLCH L shift, a rough Lc proxy). Non-color cells
  (radii, sizes, typography) are flagged without color math.
- Alpha variants (`--foo-aN`) are folded by default when their
  base token already carries the same ΔE — reduces a 742-cell
  diff to 104 meaningful rows for the PR-G (#24) case. Use
  `--include-alpha` to disable.
- Output formats: `markdown` (default, PR-comment-ready) and
  `json` (CI consumption).
- Flags: `--base <ref>` (default `origin/main`), `--head <ref>`
  (default `HEAD`), `--threshold <ΔE>` (suppress sub-N colour drift),
  `--format markdown|json`, `--include-alpha`.
- New npm script `bun run semantic-diff`.
- Tests: `tests/scripts/semantic-diff.test.ts` (14 cases) covering
  parser, diff classification, alpha-fold heuristic, threshold
  behaviour, and markdown rendering.
- No `dist/` churn, no snapshot updates.
- Not wired to CI yet — see PR-K below.

### Queued after PR-I

| PR | scope | rationale |
|---|---|---|
| **PR-J** | Prettier + ESLint + EditorConfig | Lock the informal style (kebab-case files, single-quote, no semicolons, PascalCase types) with tooling. Add `pnpm lint` + CI step. Do _after_ PR-I to avoid mass-rewriting new code. |
| **PR-K** *(optional)* | `semantic-diff` CI workflow | Wire PR-H's script into GitHub Actions to post a PR comment automatically when `packages/tokens/config/**` or `packages/tokens/src/**` changes. |
| **PR-L** *(roadmap)* | breakpoints / z-index / materials wiring in preset | Now that there's a live preview, these previously-abstract concerns have a place to be verified. Extend the Tailwind writer + preview page. |

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
# tokens package (cd packages/tokens)
bun run build                              # emits dist/*
bun test                                   # all guards + parity + generators

# preview app (cd apps/preview)
pnpm dev                                   # http://localhost:5173
pnpm build                                 # dist/ bundle
pnpm exec playwright test                  # R1-R4 (7 cases)
pnpm exec playwright install --with-deps chromium   # one-time setup

# regen (use sparingly, always commit result)
bun test -u                                # snapshot refresh
bun run apca-baseline                      # G7 baseline refresh
bun run catalog                            # test-catalog.md refresh
bun run fetch-figma                        # re-scrape Figma anchors (if token present)

# diagnostics
bun run semantic-diff                                    # origin/main vs HEAD
bun run semantic-diff --base <a> --head <b>              # arbitrary refs
bun run semantic-diff --threshold 0.5                    # drop tiny drift
bun run semantic-diff --format json > diff.json          # for CI
bun run semantic-diff --include-alpha                    # don't fold alpha stops
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

### PR-J · Prettier + ESLint + EditorConfig

Exit criteria:

- `.prettierrc` with `singleQuote: true`, `semi: false`, `printWidth: 100`,
  `arrowParens: 'avoid'`, `trailingComma: 'all'`.
- `.editorconfig` with `end_of_line = lf`, `insert_final_newline = true`,
  `indent_style = space`, `indent_size = 2`.
- `eslint.config.ts` with TypeScript + import rules, no formatting rules
  (Prettier owns formatting).
- `pnpm lint` runs across the workspace (turbo repo-wide). Fails CI on
  any violation.
- Autofix run once against the whole tree so CI starts clean.

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

As of this PR (PR-I):
- `packages/tokens`: **41 test files, 247 pass, 0 fail.** See
  `packages/tokens/docs/test-catalog.md` for the auto-generated index.
- `apps/preview`: **7 Playwright tests pass** across R1 (4 sectors),
  R2 (mode toggle), R3 (contrast toggle), R4 (Tailwind utility == raw).

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
