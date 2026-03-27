/**
 * Tailwind v4 Theme Generator
 *
 * Generates @theme inline CSS mapping Lab UI tokens to Tailwind utilities.
 * Uses --lab- prefixed CSS variables from Style Dictionary output.
 * Output: dist/tailwind/theme.css
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const tokensRoot = join(__dirname, '..');

export async function generateTailwindTheme(): Promise<void> {
  const css = `/* Lab UI — Tailwind v4 Theme
 * Auto-generated. Do not edit.
 *
 * Usage:
 *   @import "@lab-ui/tokens/tailwind";
 *   @import "tailwindcss";
 */

@import "../css/light.css";

@theme inline {
  /* Backgrounds */
  --color-bg-primary: var(--lab-bg-neutral-primary);
  --color-bg-secondary: var(--lab-bg-neutral-secondary);
  --color-bg-tertiary: var(--lab-bg-neutral-tertiary);
  --color-bg-inverted: var(--lab-bg-neutral-inverted);
  --color-bg-grouped-primary: var(--lab-bg-grouped-primary);
  --color-bg-grouped-secondary: var(--lab-bg-grouped-secondary);
  --color-bg-grouped-tertiary: var(--lab-bg-grouped-tertiary);

  /* Overlays */
  --color-overlay-ghost: var(--lab-bg-overlay-ghost);
  --color-overlay-soft: var(--lab-bg-overlay-soft);
  --color-overlay-base: var(--lab-bg-overlay-base);
  --color-overlay-strong: var(--lab-bg-overlay-strong);

  /* Fills — neutral */
  --color-fill: var(--lab-fill-primary);
  --color-fill-secondary: var(--lab-fill-secondary);
  --color-fill-tertiary: var(--lab-fill-tertiary);
  --color-fill-quaternary: var(--lab-fill-quaternary);

  /* Fills — accent solid */
  --color-fill-brand: var(--lab-fill-brand-solid);
  --color-fill-danger: var(--lab-fill-danger-solid);
  --color-fill-warning: var(--lab-fill-warning-solid);
  --color-fill-success: var(--lab-fill-success-solid);
  --color-fill-info: var(--lab-fill-info-solid);

  /* Fills — accent tint */
  --color-fill-brand-tint: var(--lab-fill-brand);
  --color-fill-danger-tint: var(--lab-fill-danger);
  --color-fill-warning-tint: var(--lab-fill-warning);
  --color-fill-success-tint: var(--lab-fill-success);
  --color-fill-info-tint: var(--lab-fill-info);

  /* Labels — neutral */
  --color-label: var(--lab-label-neutral-primary);
  --color-label-secondary: var(--lab-label-neutral-secondary);
  --color-label-tertiary: var(--lab-label-neutral-tertiary);
  --color-label-quaternary: var(--lab-label-neutral-quaternary);

  /* Labels — accent */
  --color-brand-label: var(--lab-label-brand-primary);
  --color-danger-label: var(--lab-label-danger-primary);
  --color-warning-label: var(--lab-label-warning-primary);
  --color-success-label: var(--lab-label-success-primary);
  --color-info-label: var(--lab-label-info-primary);

  /* Labels — on solid accent */
  --color-on-brand: var(--lab-label-on-brand);
  --color-on-danger: var(--lab-label-on-danger);
  --color-on-warning: var(--lab-label-on-warning);
  --color-on-success: var(--lab-label-on-success);
  --color-on-info: var(--lab-label-on-info);

  /* Accents — raw */
  --color-brand: var(--lab-fill-brand-solid);
  --color-danger: var(--lab-fill-danger-solid);
  --color-warning: var(--lab-fill-warning-solid);
  --color-success: var(--lab-fill-success-solid);
  --color-info: var(--lab-fill-info-solid);

  /* Borders — neutral */
  --color-border-strong: var(--lab-border-neutral-strong);
  --color-border: var(--lab-border-neutral-base);
  --color-border-soft: var(--lab-border-neutral-soft);
  --color-border-ghost: var(--lab-border-neutral-ghost);

  /* Borders — accent */
  --color-border-brand: var(--lab-border-brand-base);
  --color-border-danger: var(--lab-border-danger-base);
  --color-border-warning: var(--lab-border-warning-base);
  --color-border-success: var(--lab-border-success-base);
  --color-border-info: var(--lab-border-info-base);

  /* Focus */
  --color-focus-brand: var(--lab-fx-focus-ring-brand);
  --color-focus-danger: var(--lab-fx-focus-ring-danger);
  --color-focus-neutral: var(--lab-fx-focus-ring-neutral);
  --color-focus-warning: var(--lab-fx-focus-ring-warning);
  --color-focus-success: var(--lab-fx-focus-ring-success);
  --color-focus-info: var(--lab-fx-focus-ring-info);

  /* Shadows */
  --shadow-xs: 0 0 1px 0 var(--lab-fx-shadow-major), 0 1px 1px 0 var(--lab-fx-shadow-minor);
  --shadow-sm: 0 1px 2px 0 var(--lab-fx-shadow-major), 0 2px 2px 0 var(--lab-fx-shadow-penumbra), 0 4px 2px 0 var(--lab-fx-shadow-ambient), 0 12px 8px 0 var(--lab-fx-shadow-minor);
  --shadow-md: 0 1px 2px 0 var(--lab-fx-shadow-major), 0 4px 4px 0 var(--lab-fx-shadow-penumbra), 0 12px 8px 0 var(--lab-fx-shadow-ambient), 0 24px 12px 0 var(--lab-fx-shadow-minor);
  --shadow-lg: 0 4px 8px 0 var(--lab-fx-shadow-major), 0 12px 12px 0 var(--lab-fx-shadow-penumbra), 0 24px 16px 0 var(--lab-fx-shadow-ambient), 0 48px 24px 0 var(--lab-fx-shadow-minor);
  --shadow-xl: 0 16px 36px 0 var(--lab-fx-shadow-major), 0 24px 48px 0 var(--lab-fx-shadow-penumbra), 0 36px 64px 0 var(--lab-fx-shadow-ambient), 0 48px 96px 0 var(--lab-fx-shadow-minor);

  /* Skeleton */
  --color-skeleton: var(--lab-fx-skeleton-base);
  --color-skeleton-highlight: var(--lab-fx-skeleton-highlight);
}

/* Dark theme */
@import "../css/dark.css";
/* IC themes */
@import "../css/light-ic.css";
@import "../css/dark-ic.css";
`;

  await mkdir(join(tokensRoot, 'dist/tailwind'), { recursive: true });
  await writeFile(join(tokensRoot, 'dist/tailwind/theme.css'), css);
  console.log('  \u2713 Tailwind v4 theme generated');
}
