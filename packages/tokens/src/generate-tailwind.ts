/**
 * Tailwind v4 Theme Generator
 *
 * Generates @theme inline CSS mapping Lab UI tokens to Tailwind utilities.
 * Uses CSS variables from Style Dictionary output (no namespace prefix).
 * Output: dist/tailwind/theme.css
 */

import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const tokensRoot = join(__dirname, '..');

export async function generateTailwindTheme(): Promise<void> {
  // Read generated typography tokens for dynamic emission
  const typoJson = JSON.parse(
    await readFile(join(tokensRoot, 'primitive/typography.tokens.json'), 'utf-8'),
  ) as Record<string, any>;
  const typo = typoJson.typography;

  // Build --text-* and --leading-* and --tracking-* lines from tokens
  const textLines: string[] = [];
  const leadingLines: string[] = [];
  const trackingLines: string[] = [];

  for (const [name, token] of Object.entries(typo.size) as [string, any][]) {
    textLines.push(`  --text-${name}: ${token.$value};`);
  }
  for (const [name, token] of Object.entries(typo.lineHeight) as [string, any][]) {
    leadingLines.push(`  --leading-${name}: ${token.$value};`);
  }
  for (const [name, token] of Object.entries(typo.letterSpacing) as [string, any][]) {
    trackingLines.push(`  --tracking-${name}: ${token.$value};`);
  }

  const fontSans = typo.family.sans.$value;
  const fontMono = typo.family.mono.$value;

  const css = `/* Lab UI — Tailwind v4 Theme
 * Auto-generated. Do not edit.
 *
 * Usage:
 *   @import "@lab-ui/tokens/tailwind";
 *   @import "tailwindcss";
 */

@import "../css/light.css";

/* ─── Density ─────────────────────────────────────────────────────────────── */
:root {
  --density: 1;
}
@media (max-width: 768px) {
  :root { --density: 0.875; }
}
[data-density="compact"] { --density: 0.875; }
[data-density="comfortable"] { --density: 1.125; }

@theme inline {
  /* Spacing base — Tailwind multiplies this */
  --spacing: calc(0.25rem * var(--density, 1));

  /* Radius base — Tailwind generates rounded-* via multipliers */
  --radius: 0.5rem;

  /* Font families */
  --font-sans: ${fontSans};
  --font-mono: ${fontMono};

  /* Type scale — generated from typography.config.ts */
${textLines.join('\n')}

  /* Line heights */
${leadingLines.join('\n')}

  /* Letter spacing */
${trackingLines.join('\n')}

  /* Font weights */
  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;

  /* Shadows — semantic elevation */
  --shadow-inset: inset 0 1px 2px 0 rgba(0,0,0,0.05);
  --shadow-surface: 0 1px 2px 0 rgba(0,0,0,0.06), 0 2px 4px 0 rgba(0,0,0,0.04), 0 0 1px 0 rgba(0,0,0,0.04);
  --shadow-raised: 0 4px 8px 0 rgba(0,0,0,0.08), 0 2px 4px 0 rgba(0,0,0,0.04), 0 0 1px 0 rgba(0,0,0,0.04);
  --shadow-overlay: 0 16px 36px 0 rgba(0,0,0,0.12), 0 6px 12px 0 rgba(0,0,0,0.06), 0 0 1px 0 rgba(0,0,0,0.04);

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

  /* Fills — neutral */
  --color-fill: var(--fill-primary);
  --color-fill-secondary: var(--fill-secondary);
  --color-fill-tertiary: var(--fill-tertiary);
  --color-fill-quaternary: var(--fill-quaternary);

  /* Fills — accent solid */
  --color-fill-brand: var(--fill-brand-solid);
  --color-fill-danger: var(--fill-danger-solid);
  --color-fill-warning: var(--fill-warning-solid);
  --color-fill-success: var(--fill-success-solid);
  --color-fill-info: var(--fill-info-solid);

  /* Fills — accent tint */
  --color-fill-brand-tint: var(--fill-brand);
  --color-fill-danger-tint: var(--fill-danger);
  --color-fill-warning-tint: var(--fill-warning);
  --color-fill-success-tint: var(--fill-success);
  --color-fill-info-tint: var(--fill-info);

  /* Labels — neutral */
  --color-label: var(--label-neutral-primary);
  --color-label-secondary: var(--label-neutral-secondary);
  --color-label-tertiary: var(--label-neutral-tertiary);
  --color-label-quaternary: var(--label-neutral-quaternary);

  /* Labels — accent */
  --color-brand-label: var(--label-brand-primary);
  --color-danger-label: var(--label-danger-primary);
  --color-warning-label: var(--label-warning-primary);
  --color-success-label: var(--label-success-primary);
  --color-info-label: var(--label-info-primary);

  /* Labels — on solid accent */
  --color-on-brand: var(--label-on-brand);
  --color-on-danger: var(--label-on-danger);
  --color-on-warning: var(--label-on-warning);
  --color-on-success: var(--label-on-success);
  --color-on-info: var(--label-on-info);

  /* Accents — raw */
  --color-brand: var(--fill-brand-solid);
  --color-danger: var(--fill-danger-solid);
  --color-warning: var(--fill-warning-solid);
  --color-success: var(--fill-success-solid);
  --color-info: var(--fill-info-solid);

  /* Borders — neutral */
  --color-border-strong: var(--border-neutral-strong);
  --color-border: var(--border-neutral-base);
  --color-border-soft: var(--border-neutral-soft);
  --color-border-ghost: var(--border-neutral-ghost);

  /* Borders — accent */
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

  /* Skeleton */
  --color-skeleton: var(--fx-skeleton-base);
  --color-skeleton-highlight: var(--fx-skeleton-highlight);
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
