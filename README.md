# Lab UI

Universal design system with OKLCH colors, computed token dependencies, and multi-framework support.

## Architecture

```
packages/
  tokens/     @lab-ui/tokens — DTCG tokens → CSS vars + Tailwind v4
  svelte/     @lab-ui/svelte — Svelte 5 components (registry)
  react/      @lab-ui/react  — React components (registry)
  vue/        @lab-ui/vue    — Vue 3 components (registry)
  cli/        @lab-ui/cli    — Component installer
  icons/      @lab-ui/icons  — SVG icon pipeline
apps/
  preview/    Token reference + theme matrix
```

## Design Principles

- **OKLCH everywhere** — perceptually uniform, Display P3 ready
- **Computed dependencies** — radius, typography, colors derive from base variables
- **4 semantic layers** — BG → Fill → Label → Border
- **Configurable brand** — single `--brand-hue` controls the accent system
- **19-stop opacity scale** — symmetric: dense at edges, linear in middle

## Token Pipeline

```
DTCG JSON → Style Dictionary v4 → CSS custom properties
                                 → Tailwind v4 @theme
                                 → (future) Swift / Kotlin
```

## Quick Start

```bash
# 1. Clone and build
git clone <repo-url> && cd labui
pnpm install && pnpm build
```

### With Tailwind CSS v4

```css
@import "@lab-ui/tokens/tailwind";
@import "tailwindcss";
```

### Without Tailwind (plain CSS variables)

```css
@import "@lab-ui/tokens";
/* or pick individual layers: */
@import "@lab-ui/tokens/css/light";
@import "@lab-ui/tokens/css/dark";
@import "@lab-ui/tokens/css/brand";
```

## Monorepo

- **pnpm** workspaces + **Turborepo**
- **Changesets** for versioning
- Trunk-based development

## License

MIT
