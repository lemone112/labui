/**
 * Tailwind v4 Theme Generator
 *
 * Generates @theme inline CSS mapping Lab UI tokens to Tailwind utilities.
 * Output: dist/tailwind/theme.css
 */

import { writeFile, mkdir } from 'node:fs/promises';

export async function generateTailwindTheme(): Promise<void> {
  const css = `/* Lab UI — Tailwind v4 Theme
 * Auto-generated. Do not edit.
 *
 * Usage:
 *   @import "@lab-ui/tokens/tailwind";
 *   @import "tailwindcss";
 */

@import "../css/brand.css";
@import "../css/light.css";

@theme inline {
  /* Backgrounds */
  --color-bg-primary: var(--bg-neutral-primary);
  --color-bg-secondary: var(--bg-neutral-secondary);
  --color-bg-tertiary: var(--bg-neutral-tertiary);
  --color-bg-inverted: var(--bg-neutral-inverted);
  --color-bg-grouped-primary: var(--bg-grouped-primary);
  --color-bg-grouped-secondary: var(--bg-grouped-secondary);
  --color-bg-grouped-tertiary: var(--bg-grouped-tertiary);

  /* Overlays */
  --color-overlay-ghost: var(--bg-overlay-ghost);
  --color-overlay-soft: var(--bg-overlay-soft);
  --color-overlay-base: var(--bg-overlay-base);
  --color-overlay-strong: var(--bg-overlay-strong);

  /* Fills */
  --color-fill: var(--fill-primary);
  --color-fill-secondary: var(--fill-secondary);
  --color-fill-tertiary: var(--fill-tertiary);
  --color-fill-quaternary: var(--fill-quaternary);

  /* Labels */
  --color-label: var(--label-neutral-primary);
  --color-label-secondary: var(--label-neutral-secondary);
  --color-label-tertiary: var(--label-neutral-tertiary);
  --color-label-quaternary: var(--label-neutral-quaternary);

  /* Accent labels */
  --color-brand-label: var(--label-brand-primary);
  --color-danger-label: var(--label-danger-primary);
  --color-warning-label: var(--label-warning-primary);
  --color-success-label: var(--label-success-primary);
  --color-info-label: var(--label-info-primary);

  /* Accents */
  --color-brand: var(--brand);
  --color-danger: var(--danger);
  --color-warning: var(--warning);
  --color-success: var(--success);
  --color-info: var(--info);

  /* Borders */
  --color-border-strong: var(--border-neutral-strong);
  --color-border: var(--border-neutral-base);
  --color-border-soft: var(--border-neutral-soft);
  --color-border-ghost: var(--border-neutral-ghost);
  --color-border-brand: var(--border-brand-base);
  --color-border-danger: var(--border-danger-base);
  --color-border-warning: var(--border-warning-base);
  --color-border-success: var(--border-success-base);
  --color-border-info: var(--border-info-base);

  /* Focus */
  --color-focus-brand: var(--fx-focus-ring-brand);
  --color-focus-danger: var(--fx-focus-ring-danger);
  --color-focus-neutral: var(--fx-focus-ring-neutral);
  --color-focus-warning: var(--fx-focus-ring-warning);
  --color-focus-success: var(--fx-focus-ring-success);
  --color-focus-info: var(--fx-focus-ring-info);

  /* Shadows */
  --shadow-xs: 0 0 1px 0 var(--fx-shadow-major), 0 1px 1px 0 var(--fx-shadow-minor);
  --shadow-sm: 0 1px 2px 0 var(--fx-shadow-major), 0 2px 2px 0 var(--fx-shadow-penumbra), 0 4px 2px 0 var(--fx-shadow-ambient), 0 12px 8px 0 var(--fx-shadow-minor);
  --shadow-md: 0 1px 2px 0 var(--fx-shadow-major), 0 4px 4px 0 var(--fx-shadow-penumbra), 0 12px 8px 0 var(--fx-shadow-ambient), 0 24px 12px 0 var(--fx-shadow-minor);
  --shadow-lg: 0 4px 8px 0 var(--fx-shadow-major), 0 12px 12px 0 var(--fx-shadow-penumbra), 0 24px 16px 0 var(--fx-shadow-ambient), 0 48px 24px 0 var(--fx-shadow-minor);
  --shadow-xl: 0 16px 36px 0 var(--fx-shadow-major), 0 24px 48px 0 var(--fx-shadow-penumbra), 0 36px 64px 0 var(--fx-shadow-ambient), 0 48px 96px 0 var(--fx-shadow-minor);

  /* Skeleton */
  --color-skeleton: var(--fx-skeleton-base);
  --color-skeleton-highlight: var(--fx-skeleton-highlight);
}

/* Dark theme */
@import "../css/dark.css";
`;

  await mkdir('dist/tailwind', { recursive: true });
  await writeFile('dist/tailwind/theme.css', css);
  console.log('  ✓ Tailwind v4 theme generated');
}
