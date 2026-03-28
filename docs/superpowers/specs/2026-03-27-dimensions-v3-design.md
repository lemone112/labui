# Lab UI Dimensions v3 — Design Spec

**Status:** APPROVED (updated with no-prefix decision)
**Created:** 2026-03-27
**Updated:** 2026-03-27
**Depends on:** Color Architecture v3 (PR #1)

## Principles (STRICT)

1. **Tailwind is the sole styling layer.** No parallel CSS variable namespace.
2. **No prefix.** No `--lab-` or any namespace prefix. Clean variable names.
3. **DTCG JSON is source of truth.** All tokens defined in DTCG format, consumed by Style Dictionary.
4. **Minimal custom CSS variables.** Only where Tailwind doesn't cover (density, radius base).
5. **Role-based radius.** Components get radius by role (control, card, dialog), not by nesting depth.
6. **Top-down nesting.** When needed: `inner = max(0, outer - padding)`. Applied locally in CSS, not as tokens.
7. **Single density multiplier.** `density` scales spacing + size. Does NOT scale radius, blur, shadows, typography.

---

## 1. Spacing

### Primitive scale (21 tokens, linear 4px grid)

All values in rem. Base unit: 0.25rem (4px at 16px root).

| Token | rem | px@1x |
|-------|-----|-------|
| space-0 | 0 | 0 |
| space-px | 1px (fixed) | 1 |
| space-0.5 | 0.125rem | 2 |
| space-1 | 0.25rem | 4 |
| space-1.5 | 0.375rem | 6 |
| space-2 | 0.5rem | 8 |
| space-3 | 0.75rem | 12 |
| space-4 | 1rem | 16 |
| space-5 | 1.25rem | 20 |
| space-6 | 1.5rem | 24 |
| space-7 | 1.75rem | 28 |
| space-8 | 2rem | 32 |
| space-9 | 2.25rem | 36 |
| space-10 | 2.5rem | 40 |
| space-12 | 3rem | 48 |
| space-14 | 3.5rem | 56 |
| space-16 | 4rem | 64 |
| space-20 | 5rem | 80 |
| space-24 | 6rem | 96 |
| space-28 | 7rem | 112 |
| space-32 | 8rem | 128 |

### Density multiplier

Single CSS variable scales all spacing:

```css
:root { --density: 1; }
@media (max-width: 768px) { :root { --density: 0.875; } }
[data-density="compact"]     { --density: 0.875; }
[data-density="comfortable"] { --density: 1.125; }
```

Formula: `computed = rem_value * density`. Tailwind consumes via `--spacing: calc(0.25rem * var(--density))`.

space-px is density-immune (always 1px).

### Semantic spacing aliases (optional, for cross-platform)

```css
--gap-tight:   space-1  (4px)
--gap-default: space-2  (8px)
--gap-loose:   space-4  (16px)
```

---

## 2. Radius

### Primitive scale (9 tokens, 4px grid, density-immune)

| Token | px |
|-------|-----|
| radius-0 | 0 |
| radius-4 | 4 |
| radius-8 | 8 |
| radius-12 | 12 |
| radius-16 | 16 |
| radius-20 | 20 |
| radius-24 | 24 |
| radius-32 | 32 |
| radius-full | 9999 |

Radius does NOT scale with density (it's shape, not size).

### Semantic radius (7 tokens)

| Token | Value | Usage |
|-------|-------|-------|
| --radius-surface | 24px | Cards, modals, sheets |
| --radius-container | 16px | Sections, content areas |
| --radius-control | 12px | Buttons, inputs, selects |
| --radius-element | 8px | Tags, badges, chips |
| --radius-indicator | 4px | Checkboxes, dots |
| --radius-pill | 9999px | Pill buttons, avatars |
| --radius-none | 0 | Tables, code blocks |

### Nesting formula

CSS: `inner = max(0, outer - padding)` via calc().
Figma: Pre-computed lookup table from build pipeline.

```css
.outer { border-radius: var(--radius-control); }
.inner { border-radius: max(0, calc(var(--radius-control) - var(--padding))); }
```

Floor: radius below 4px snaps to 0 via max(0, ...) or clamp(0, ..., max).

### Nesting ladder (generated at build time)

Default preset (outer=32px, padding=4px uniform):
```text
Layer 1: 32px, Layer 2: 28px, Layer 3: 24px,
Layer 4: 20px, Layer 5: 16px, Layer 6: 12px
```

---

## 3. Elevation

### 4 semantic levels

| Token | Usage | Light | Dark |
|-------|-------|-------|------|
| --elevation-inset | Inputs, wells | Subtle inner shadow | Transparent |
| --elevation-surface | Cards, sections | 3-layer soft shadow | Luminance border |
| --elevation-raised | Dropdown, tooltip | 3-layer medium shadow | Luminance border |
| --elevation-overlay | Modals, sheets | 3-layer deep shadow | Luminance border |

Shadow colors derived from neutral.12 (theme-aware).
Dark mode: shadows replaced by `rgba(255,255,255, 0.06)` border.
Glassmorphism materials are primary depth cue, shadows secondary.

---

## 4. General Dimensions

### Size tokens (8, from spacing scale)

| Token | px |
|-------|-----|
| size-4 | 16 |
| size-5 | 20 |
| size-6 | 24 |
| size-8 | 32 |
| size-10 | 40 |
| size-12 | 48 |
| size-16 | 64 |
| size-20 | 80 |

### Blur tokens (7, for glassmorphism materials)

| Token | px | Material level |
|-------|-----|----------------|
| blur-1 | 6 | Subtle |
| blur-2 | 12 | Soft |
| blur-3 | 24 | Muted, Base |
| blur-4 | 36 | — |
| blur-5 | 48 | — |
| blur-6 | 64 | Elevated |
| blur-7 | 96 | — |

Shift and Spread are internal to elevation composites (not public tokens).

---

## 5. Output Pipeline

```text
DTCG JSON (source of truth)
  -> Style Dictionary v5
    -> CSS custom properties (rem, no prefix)
    -> Tailwind @theme (--spacing integration)
    -> Figma variables (pre-computed px per density mode)
    -> React Native constants (dp)
```

## 6. Migration

| Old Figma | New | Change |
|-----------|-----|--------|
| 28-step px scale | 21-step spacing | Linear, -25% |
| 12 radius tokens | 9 primitive + 7 semantic | Drop 2px, 6px, 28px |
| 5 shadow levels | 4 semantic | Clearer names |
| 13 blur tokens | 7 | -46% |
| 20 shift/spread | Internal | Hidden |
| 4 density files | 1 CSS var | Radical simplification |
| **~128 tokens** | **~57 tokens** | **-55%** |