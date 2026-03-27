/**
 * Tailwind v4 Theme Generator
 *
 * Generates @theme inline CSS that maps Lab UI tokens
 * to Tailwind utility classes.
 *
 * Output: dist/tailwind/theme.css
 *
 * Usage in consumer:
 *   @import "@lab-ui/tokens/tailwind";
 *   @import "tailwindcss";
 */

import { writeFile, mkdir } from 'node:fs/promises';

export async function generateTailwindTheme() {
  const css = `/* Lab UI — Tailwind v4 Theme
 * Auto-generated. Do not edit.
 *
 * Usage:
 *   @import "@lab-ui/tokens/tailwind";
 *   @import "tailwindcss";
 *
 * Then use: bg-surface, text-label, border-soft, rounded-card, etc.
 */

@import "./brand.css";
@import "./light.css";

@theme inline {
  /* ═══ Semantic Colors → Tailwind utilities ═══ */

  /* Backgrounds: bg-primary, bg-secondary, bg-tertiary, bg-inverted */
  --color-bg-primary: var(--bg-neutral-primary);
  --color-bg-secondary: var(--bg-neutral-secondary);
  --color-bg-tertiary: var(--bg-neutral-tertiary);
  --color-bg-inverted: var(--bg-neutral-inverted);
  --color-bg-grouped-primary: var(--bg-grouped-primary);
  --color-bg-grouped-secondary: var(--bg-grouped-secondary);
  --color-bg-grouped-tertiary: var(--bg-grouped-tertiary);

  /* Overlays: bg-overlay-soft, bg-overlay-base, bg-overlay-strong */
  --color-overlay-ghost: var(--bg-overlay-ghost);
  --color-overlay-soft: var(--bg-overlay-soft);
  --color-overlay-base: var(--bg-overlay-base);
  --color-overlay-strong: var(--bg-overlay-strong);

  /* Fills: bg-fill, bg-fill-secondary, etc. */
  --color-fill: var(--fill-primary);
  --color-fill-secondary: var(--fill-secondary);
  --color-fill-tertiary: var(--fill-tertiary);
  --color-fill-quaternary: var(--fill-quaternary);

  /* Labels: text-primary, text-secondary, text-tertiary, text-quaternary */
  --color-label: var(--label-neutral-primary);
  --color-label-secondary: var(--label-neutral-secondary);
  --color-label-tertiary: var(--label-neutral-tertiary);
  --color-label-quaternary: var(--label-neutral-quaternary);

  /* Accents: bg-brand, text-brand, border-brand, etc. */
  --color-brand: var(--brand);
  --color-danger: var(--danger);
  --color-warning: var(--warning);
  --color-success: var(--success);
  --color-info: var(--info);

  /* Accent labels: text-brand-primary, text-danger-secondary, etc. */
  --color-brand-label: var(--label-brand-primary);
  --color-danger-label: var(--label-danger-primary);
  --color-warning-label: var(--label-warning-primary);
  --color-success-label: var(--label-success-primary);

  /* Borders: border-strong, border-base, border-soft, border-ghost */
  --color-border-strong: var(--border-neutral-strong);
  --color-border: var(--border-neutral-base);
  --color-border-soft: var(--border-neutral-soft);
  --color-border-ghost: var(--border-neutral-ghost);

  /* Accent borders: border-brand-strong, border-danger-base, etc. */
  --color-border-brand: var(--border-brand-base);
  --color-border-danger: var(--border-danger-base);
  --color-border-warning: var(--border-warning-base);
  --color-border-success: var(--border-success-base);

  /* Focus ring */
  --color-focus-brand: var(--fx-focus-ring-brand);
  --color-focus-danger: var(--fx-focus-ring-danger);
  --color-focus-neutral: var(--fx-focus-ring-neutral);

  /* Shadows */
  --shadow-xs: 0 0 1px 0 var(--fx-shadow-major), 0 1px 1px 0 var(--fx-shadow-minor);
  --shadow-sm: 0 1px 2px 0 var(--fx-shadow-major), 0 2px 2px 0 var(--fx-shadow-penumbra), 0 4px 2px 0 var(--fx-shadow-ambient), 0 12px 8px 0 var(--fx-shadow-minor);
  --shadow-md: 0 1px 2px 0 var(--fx-shadow-major), 0 4px 4px 0 var(--fx-shadow-penumbra), 0 12px 8px 0 var(--fx-shadow-ambient), 0 24px 12px 0 var(--fx-shadow-minor);
  --shadow-lg: 0 4px 8px 0 var(--fx-shadow-major), 0 12px 12px 0 var(--fx-shadow-penumbra), 0 24px 16px 0 var(--fx-shadow-ambient), 0 48px 24px 0 var(--fx-shadow-minor);
  --shadow-xl: 0 16px 36px 0 var(--fx-shadow-major), 0 24px 48px 0 var(--fx-shadow-penumbra), 0 36px 64px 0 var(--fx-shadow-ambient), 0 48px 96px 0 var(--fx-shadow-minor);

  /* Glow */
  --color-glow-brand: var(--fx-glow-brand);
  --color-glow-danger: var(--fx-glow-danger);

  /* Skeleton */
  --color-skeleton: var(--fx-skeleton-base);
  --color-skeleton-highlight: var(--fx-skeleton-highlight);
}

/* ═══ Dark theme override ═══ */
@import "./dark.css";
`;

  await mkdir('dist/tailwind', { recursive: true });
  await writeFile('dist/tailwind/theme.css', css);
  console.log('  ✓ Tailwind v4 theme generated');
}
