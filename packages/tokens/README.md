# @lab-ui/tokens

Tier-1 design tokens for Lab UI — **OKLCH + Display-P3** colour, **APCA** contrast, **parametric cells**, **4 modes** (`light`, `dark`, `light_ic`, `dark_ic`) × **3 material modes** (`solid`, `glass`, `backdrop`).

- Single source of truth: [`config/tokens.config.ts`](./config/tokens.config.ts)
- Architectural spec: [`../../plan/implementation-plan-v2.md`](../../plan/implementation-plan-v2.md) (v2, active)
- Test strategy: [`../../plan/test-strategy.md`](../../plan/test-strategy.md)
- Auto-generated test catalog: [`docs/test-catalog.md`](./docs/test-catalog.md)
- Framework-agnostic output: CSS custom properties + tree-shakable ESM + `.d.ts`
- No runtime JS. No client-side theme engine. Mode switching = a single `data-mode` / `data-material-mode` attribute flip.

## Layers shipped

| Layer | Scope | Location |
|---|---|---|
| L1 | Units (`px/*`, `pt/*`) | §2 |
| L2 | Dimensions (spacing, radius, size, fx) | §3 |
| L3 | Primitive colors (13 neutrals + 11 accent spines + 2 statics + 29 opacity stops) | §4 |
| L4 | Semantic colors + progressive shadows | §5 |
| L5 | Typography (11-step scale + aliases) | §6 |
| L6 | Z-index | §7 |
| L7 | Materials (3-mode axis) | §8 |

See [`../../plan/implementation-plan-v2.md`](../../plan/implementation-plan-v2.md) for the full architecture.

## Install

```bash
bun add @lab-ui/tokens       # or pnpm / npm / yarn
```

Peer requirements: a toolchain that understands ES modules and `oklch(...)` in CSS (every evergreen browser since 2023).

## Build output

Running `bun run build` produces:

```
dist/
  tokens.css      # L1/L2 + typography + z-index + colors (4 modes) + materials (3 modes)
  index.js        # tree-shakable ESM barrel of token names
  index.d.ts      # typed autocomplete for every var
```

## Scripts

```bash
bun run build      # regenerate dist/
bun test           # 174 tests across 27 files (< 200 ms)
bun run coverage   # verify every plan invariant has a @governs test
bun run catalog    # regenerate docs/test-catalog.md
```

Every test file carries a `@layer / @governs / @invariant / @on-fail` JSDoc header. CI fails if a file is missing any of those tags or references an unknown plan section, keeping the plan and the tests bidirectionally linked.

Import CSS once, globally:

```ts
import '@lab-ui/tokens/css'
```

Then pick tokens by name from the ESM barrel (or type the CSS var directly if you prefer):

```ts
import { labelNeutralPrimary, bgPrimary, fillBrandPrimary } from '@lab-ui/tokens'
```

Every export is a `string` of the form `var(--label-neutral-primary)` — it resolves at runtime against whichever mode is active on `:root`.

## Mode switching

The CSS emits, in order:

1. `:root { ... }`               — `light` mode (default)
2. `@media (prefers-color-scheme: dark)` — `dark` when system prefers dark and no override is set
3. `[data-mode="dark"] { ... }`  — explicit opt-in / out
4. `[data-mode="light-ic"] { ... }`  — increased-contrast variants (WCAG-adjacent, APCA Lc≥75)
5. `[data-mode="dark-ic"] { ... }`

To switch mode, set `data-mode` on `<html>` (or any ancestor of the scope you want to theme):

```html
<html data-mode="dark-ic">
```

No JS library required. A one-liner to honour an OS preference + user override:

```ts
document.documentElement.dataset.mode = localStorage.getItem('mode') ?? ''
```

## Framework examples

### Next.js (App Router)

```tsx
// app/layout.tsx
import '@lab-ui/tokens/css'
import { labelNeutralPrimary, bgPrimary } from '@lab-ui/tokens'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-mode="">
      <body style={{ background: bgPrimary, color: labelNeutralPrimary }}>
        {children}
      </body>
    </html>
  )
}
```

Mode toggle (client component):

```tsx
'use client'
export function ModeToggle() {
  return (
    <select
      defaultValue=""
      onChange={(e) => {
        document.documentElement.dataset.mode = e.target.value
      }}
    >
      <option value="">Auto</option>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
      <option value="light-ic">Light · Increased Contrast</option>
      <option value="dark-ic">Dark · Increased Contrast</option>
    </select>
  )
}
```

### Vue 3

```ts
// main.ts
import '@lab-ui/tokens/css'
import { createApp } from 'vue'
import App from './App.vue'
createApp(App).mount('#app')
```

```vue
<script setup lang="ts">
import { labelNeutralPrimary, bgPrimary } from '@lab-ui/tokens'
</script>

<template>
  <main :style="{ background: bgPrimary, color: labelNeutralPrimary }">
    Hello
  </main>
</template>
```

### SvelteKit

```ts
// src/routes/+layout.ts
import '@lab-ui/tokens/css'
```

```svelte
<script lang="ts">
  import { labelNeutralPrimary, bgPrimary } from '@lab-ui/tokens'
</script>

<main style:background={bgPrimary} style:color={labelNeutralPrimary}>
  Hello
</main>
```

## Architecture

Two layers, one config:

```
config/tokens.config.ts
  └─ colors
       ├─ neutrals: { steps, lightness, chroma, hue, ic_delta }
       ├─ accents:  { brand, red, orange, yellow, green, teal, mint, blue, indigo, purple, pink }
       ├─ statics:  { white, dark }
       ├─ modes:    light | dark | light_ic | dark_ic
       └─ mode_derivation: { light_ic.dL, dark.dL, … }
  └─ ladders
       ├─ background.neutral
       ├─ label.{accent, neutral}
       ├─ fill.{accent, neutral}
       ├─ border.{accent, neutral}
       ├─ fx.shadow
       └─ misc.{badge, control}
```

Build pipeline (all in `packages/tokens/src/`):

```
config  →  generators  →  writers  →  dist/
           ├─ primitive-colors.ts      ├─ css.ts
           └─ semantic-colors.ts       ├─ esm.ts
                                       └─ dts.ts
                        +  validators/ {apca, gamut, references}
```

- **Primitives** are parametric: change `neutrals.steps` or `accents.brand.L` and the entire scale regenerates. No hard-coded colour tables.
- **Semantics** are declarative ladders. A ladder's value is a grammar-driven reference (`solid`, `@32`, `N8@72`, `{ ref: 'background.neutral.primary' }`) that resolves per mode.
- **Validators** run on every build: APCA tiered pairs (body Lc60/Lc75, decorative Lc45), P3 gamut containment, reference integrity. Body-tier failures fail the build.

See [`spec.md`](./spec.md) for the full contract, invariants, and open questions.

## Scripts

```bash
bun run build     # colour-only build, writes dist/, runs validators (<50ms)
bun run dev       # watch mode
bun test          # APCA matrix + gamut + reference + snapshot checks
bun run lint      # validators only (no writes)
bun run clean     # rm -rf dist
```

Bun is the primary runtime. Node ≥22 + `tsx` works as a fallback via `bun run build:node`.

## License

MIT
