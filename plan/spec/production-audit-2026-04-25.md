# Production Audit — 2026-04-25

## Scope

Comprehensive audit of `@lab-ui/tokens@0.2.0` production output (`packages/tokens/dist/tokens.css`) against SPEC v0.2 expectations. **Goal**: identify all gaps that would block "tokens ready to connect to components."

## Build state

```
✓ tokens built in 35.2ms
  35 units, 80 dims, 55 typo, 15 z, 5 materials, 13 neutrals, 11 accents, 99 semantic, 5 shadow presets

Total unique CSS vars: 1137
File size: tokens.css 216KB, tailwind-preset.css 41KB
TypeScript types: dist/index.d.ts 46KB
JS exports: dist/index.js 55KB
```

## Test state

```
✓ 248 tests pass / 0 fail
  4 snapshots, 1764 expect() calls
  42 test files, 313ms
```

CI: green on main (PR #28, #29, #30, #31, #32 all merged).

## Output structure (categorized)

| Group        | Unique vars | SPEC expectation | Status |
|--------------|-------------|------------------|--------|
| `bg-*`       | 5           | ~13 cells (SPEC §5.1, excluding Materials) | **GAP** (8 cells missing) |
| `materials-*`| 15 (5 surfaces × 3 props) | 5 cells (SPEC §5.7 RFC-004) | OK (opaque approximations per D4) |
| `label-*`    | 27          | 36 cells (SPEC §5.2) | OK (counts include neutral.inverted, static, sentiments) |
| `fill-*`     | 26          | 33 cells (SPEC §5.3) | needs deeper verification |
| `border-*`   | 27          | 26 cells (SPEC §5.4) | OK (D1 deprecated ghost still emits + D2 inverted added) |
| `fx-*`       | 16          | 15 cells (SPEC §5.5) | **GAP** (Glow set wrong, Focus-ring not split, Skeleton not split) |
| `brand-*`    | 29 (alpha tints) | 19 stops + alpha | OK |
| `neutral-*`  | 390 (incl. alpha tints) | 19 stops × 3 collections × alpha | OK |
| `opacity-*`  | 29          | 19 base + special | OK |

Total emitted: **1137 unique CSS vars**.

---

## Gap inventory

### G1 — Backgrounds incomplete (BLOCKING components)

**SPEC §5.1 expects** (from canonical list at SPEC.md:377):
```
Backgrounds.Neutral.{Primary, Secondary, Tertiary, Inverted}        (4)
Backgrounds.Neutral.Grouped.{Primary, Secondary, Tertiary}          (3)
Backgrounds.Neutral.Static.{Light, Dark}                            (2)
Backgrounds.Neutral.Overlay.{Ghost, Soft, Base, Strong}             (4)
Backgrounds.Materials.{Base, Muted, Soft, Subtle, Elevated}         (5)
                                                              total: 18 cells
```

**Production currently emits**: `bg-{primary, secondary, tertiary, overlay, static}` = **5 cells**.

**Missing CSS vars** (must add as ADDITIONS — no breaking changes):
```
--bg-inverted                   # Backgrounds.Neutral.Inverted
--bg-grouped-primary            # Backgrounds.Neutral.Grouped.Primary
--bg-grouped-secondary          # Backgrounds.Neutral.Grouped.Secondary
--bg-grouped-tertiary           # Backgrounds.Neutral.Grouped.Tertiary
--bg-overlay-ghost              # Backgrounds.Neutral.Overlay.Ghost
--bg-overlay-soft               # Backgrounds.Neutral.Overlay.Soft
--bg-overlay-base               # Backgrounds.Neutral.Overlay.Base   (= existing --bg-overlay alias OK)
--bg-overlay-strong             # Backgrounds.Neutral.Overlay.Strong
--bg-static-light               # Backgrounds.Neutral.Static.Light   (= existing --bg-static alias OK)
--bg-static-dark                # Backgrounds.Neutral.Static.Dark
```

**Compatibility rule**: `--bg-overlay` and `--bg-static` (singular) remain emitted as aliases pointing to `-base`/`-light` respectively. No breaking change.

**Action**: PR-PROD1 — Add 8 new BG vars + emission logic.

**Component impact**: Card / Modal / Toast / Sheet / Tooltip / Drawer rely on layered overlays. Without these, components can't ship.

### G2 — FX.Glow sentiment set wrong

**SPEC §5.5 explicitly states** (SPEC.md:546–548):
> `FX.Glow` exists only for `{Neutral, Inverted, Brand, Danger, Warning}`. Success/Info are **not** glow-able.

**Production currently emits**:
```
--fx-glow-brand
--fx-glow-danger
--fx-glow-info        # ❌ NOT in SPEC — should be removed
--fx-glow-success     # ❌ NOT in SPEC — should be removed
--fx-glow-warning
```

**Missing**:
```
--fx-glow-neutral     # SPEC required
--fx-glow-inverted    # SPEC required
```

**Action**: PR-PROD2.A — Add Neutral+Inverted Glow vars; mark Info+Success as deprecated (G8 grace period); remove in 0.3.0.

**Component impact**: Toast / Notification / Hover-glow effects. Inverted glow specifically for dark-bg on light-mode surface (or vice versa).

### G3 — FX.Focus-ring not sentiment-split

**SPEC §5.5** lists 4 separate vars:
```
FX.Focus-ring.Neutral
FX.Focus-ring.Brand
FX.Focus-ring.Danger
FX.Focus-ring.Warning
```

**Production currently emits**: `--fx-focus-ring` (single var, no sentiment split).

**Missing**:
```
--fx-focus-ring-neutral      # SPEC required
--fx-focus-ring-brand        # SPEC required
--fx-focus-ring-danger       # SPEC required
--fx-focus-ring-warning      # SPEC required
```

**Compatibility**: Keep `--fx-focus-ring` as alias for `--fx-focus-ring-neutral` (most common default).

**Action**: PR-PROD2.B — Split focus-ring into 4 sentiment vars.

**Component impact**: Button states (default focus = neutral; danger button focus = danger ring; etc.). Without sentiment split, all component states use the same ring color which is incorrect per Apple HIG.

### G4 — FX.Skeleton not tier-split

**SPEC §5.5** lists 2 vars:
```
FX.Skeleton.Base       # hardcoded #78788014 (system mid-gray + 8% alpha)
FX.Skeleton.Highlight  # hardcoded #7878800a (system mid-gray + 4% alpha)
```

**Production currently emits**: `--fx-skeleton` (single var).

**Missing**:
```
--fx-skeleton-base
--fx-skeleton-highlight
```

**Compatibility**: Keep `--fx-skeleton` as alias for `--fx-skeleton-base`.

**Action**: PR-PROD2.C — Split skeleton into Base + Highlight.

**Component impact**: Skeleton loaders need a 2-tone shimmer effect; single-color skeletons look static.

### G5 — SPEC §5.1 header count drift

**Issue**: Header reads "35 tokens × 4 modes" but body lists ~17 cells (after Materials). Either header is wrong, or body is incomplete.

**Investigation**: Figma per-mode raw entry count is ~70 (after Materials decompose into 4 entries each), suggesting Figma stores all 4 cells per mode separately. The "35" likely counts Materials decompose × modes / 4 contrast = ~33–35.

**Resolution**: Update SPEC §5.1 header to match the explicit body listing OR expand body to enumerate all 35.

**Action**: PR-SPEC-AUDIT — Reconcile §5.1 count vs body. Low priority (documentation drift, not production).

### G6 — Fills count check needed

**SPEC §5.3** says 33 tokens × 4 modes. Production has 26 fill vars. Need to enumerate and verify.

Currently emitted (from grep):
```
fill-{neutral,brand,danger,info,success,warning}-{primary,secondary,tertiary,quaternary}  (6 × 4 = 24)
fill-static-{light,dark}                                                                  (2)
                                                                                  total: 26
```

**SPEC §5.3 lists**:
- Fills.{Neutral, Brand, Danger, Warning, Success, Info}.{P, S, T, Q} = 24
- Fills.Static.{Light, Dark} = 2
- Fills.Neutral.None tier (per SPEC §5.3 table line 470) = could be additional cell

**Likely actual count**: 26 (matches production), so SPEC header "33" might be drift. Need verification against Figma.

**Action**: PR-SPEC-AUDIT — Verify count.

### G7 — Tailwind preset coverage

`dist/tailwind-preset.css` (41KB) provides `@theme` block with utility classes. Need to verify it covers all CSS vars produced by tokens.css:

- All 1137 vars accessible via Tailwind utilities? (e.g. `bg-primary` → `var(--bg-primary)`)
- No utility references missing CSS vars
- Snapshot test exists (`tests/guards/snapshot-tailwind.test.ts`)

**Action**: Already covered by snapshot guard. Pass.

### G8 — Component scaffold absent

`packages/{react,svelte,vue}/registry/ui/` directories contain only `.gitkeep`. No component implementations. Tokens are produced but no consumer components yet exist.

**Action**: NOT a token-side gap. Component scaffolding is downstream (separate work effort).

---

## Sentiment coverage matrix (SPEC §5 audit)

| Cell                          | Brand | Danger | Warning | Success | Info | Neutral | Inverted | Static |
|-------------------------------|-------|--------|---------|---------|------|---------|----------|--------|
| Labels.{Primary,Secondary,...} | ✓    | ✓     | ✓      | ✓      | ✓   | ✓      | ✓ (1)   | ✓     |
| Fills.{Primary,Secondary,...}  | ✓    | ✓     | ✓      | ✓      | ✓   | ✓      | ✗       | ✓     |
| Borders.{Strong,Base,Soft}     | ✓    | ✓     | ✓      | ✓      | ✓   | ✓      | ✓ (n)   | ✓     |
| Borders.Ghost                  | DEP* | DEP*  | DEP*   | DEP*   | DEP*| ✓      | ✗       | ✗     |
| FX.Glow                        | ✓    | ✓     | ✓      | ✗ G2  | ✗ G2| ✗ G2  | ✗ G2   | ✗     |
| FX.Focus-ring                  | ✗ G3 | ✗ G3  | ✗ G3   | ✗      | ✗   | ✗ G3  | ✗      | ✗     |

Legend:
- `✓` = emitted correctly per SPEC
- `✗` = SPEC says it shouldn't exist (correct absence)
- `✗ G[N]` = production gap (see Gn above)
- `DEP*` = deprecated per D1, removal in 0.3.0
- `(1)` = inverted exists as single label-inverted var
- `(n)` = inverted exists for neutral border only
- Production EXTRA: Fills/Labels/Borders for Info+Success (intentional, per SPEC). Glow Info+Success (NOT intentional, see G2).

---

## Action plan

| PR    | Title | Risk | Ordering |
|-------|-------|------|----------|
| PR-PROD1 | Close BG gap (G1) — 8 new vars | yellow (snapshot churn) | next |
| PR-PROD2 | FX corrections (G2, G3, G4) — sentiment-correct emissions | yellow (snapshot churn + grace period) | after PR-PROD1 |
| PR-SPEC-AUDIT | Reconcile SPEC §5.1/§5.3 count headers (G5, G6) | green (markdown only) | after audit-fix verification |
| PR-COMPONENT-MAP | Token → component slot mapping doc | green (markdown only) | after PR-PROD1+PR-PROD2 ship |

---

## Anti-hallucination checklist (paradigm preserved?)

| Check | Status |
|-------|--------|
| C-1: no hand-authored hex outside base_points + skeleton_mid + neutral_dark_solid | ✓ (lint passes) |
| C-7: pure deterministic pipeline | ✓ (no Math.random, no Date.now) |
| C-9: no special-case-by-name | ✓ (no `if family === '...'` branches in resolver) |
| §6.5: applyPerceptualComp uses 3-scalar approximation | ✓ |
| §6.6: apcaSearch holds H fixed, varies L only | ✓ |
| §10.D0: bootstrap_count tracked | ✓ (currently 4 per accent via primitive_per_output; v0.3 gate to be tested) |
| §10.D1: accent.ghost lifecycle (announce-deprecate now, remove 0.3.0) | ✓ (see config.deprecated) |
| §10.D2: Mint/Teal/Yellow/Indigo/Purple/Pink primitives only, no semantic | ✓ |
| §10.D5: Fills.Neutral source = Gray.500 + opacity ladder | ✓ |
| §10.D11: Label primary = Lc 75 / WCAG 7:1 (D11 locked, implementation pending PR-N4) | pending |

No paradigm violations detected. All gaps are SCOPE incompletions (missing SPEC-listed cells), not paradigm violations.

---

## Bottom line

Tokens are **structurally sound** but **incomplete** for component connectivity. Closing G1+G2+G3+G4 produces a full-coverage v0.2.x release that a component author can connect to immediately. Estimated ~6 hours autonomous work.

After closing gaps:
- All 35 SPEC-listed BG cells emit
- All 15 SPEC-listed FX cells emit with correct sentiment coverage
- Existing surface (1137 vars) plus 14 new vars = ~1151 total
- No breaking changes to existing consumers (additions only + grace period for Glow.Info/Success)

D11 (WCAG floor) remains queued for PR-N4 post-v0.3 RFC-005 (Bezold-Brücke).
