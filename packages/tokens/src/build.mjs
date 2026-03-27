/**
 * Lab UI Token Build Pipeline
 *
 * Source: W3C DTCG 2025.10 JSON (.tokens.json)
 * Tool:   Style Dictionary v4 (ESM)
 * Output: CSS custom properties + Tailwind v4 @theme
 *
 * Features:
 * - OKLCH color space throughout
 * - Alpha variants GENERATED from base hue × 19 opacity stops
 * - Neutral Light/Dark scales GENERATED from white/near-black × opacity
 * - Brand hue configurable at runtime via --brand-hue
 * - Materials with per-theme blend modes (color-dodge / overlay)
 * - Tailwind v4 @theme inline integration
 */

import StyleDictionary from 'style-dictionary';
import { generateAlphaTokens } from './generate-alpha.mjs';
import { generateTailwindTheme } from './generate-tailwind.mjs';

// ─── Phase 1: Generate computed tokens ──────────────────────────

console.log('→ Generating alpha variants...');
await generateAlphaTokens();

// ─── Phase 2: Build per-theme CSS ───────────────────────────────

const themes = [
  { name: 'light', selector: ':root, [data-theme="light"]' },
  { name: 'dark',  selector: '[data-theme="dark"]' },
];

for (const theme of themes) {
  console.log(`→ Building ${theme.name} theme...`);

  const sd = new StyleDictionary({
    source: [
      'tokens/primitive/**/*.tokens.json',
      'tokens/generated/**/*.tokens.json',
      `tokens/semantic/${theme.name}.tokens.json`,
      `tokens/material/${theme.name}.tokens.json`,
    ],
    platforms: {
      css: {
        transformGroup: 'css',
        buildPath: 'dist/css/',
        files: [
          {
            destination: `${theme.name}.css`,
            format: 'css/variables',
            options: {
              selector: theme.selector,
              outputReferences: true,
            },
          },
        ],
      },
    },
  });

  await sd.buildAllPlatforms();
}

// ─── Phase 3: Generate Tailwind v4 theme ────────────────────────

console.log('→ Generating Tailwind v4 theme...');
await generateTailwindTheme();

// ─── Phase 4: Brand hue runtime layer ───────────────────────────

console.log('→ Generating brand hue runtime layer...');
await generateBrandHueLayer();

console.log('✓ Lab UI tokens built successfully');

// ─── Brand hue runtime CSS ──────────────────────────────────────

async function generateBrandHueLayer() {
  const css = `/* Lab UI — Brand Hue Runtime Layer
 * Override --brand-hue to change the entire accent system.
 * Sentiment hues (danger, warning, success) are FIXED.
 */

:root {
  /* ═══ THE SINGLE SLIDER ═══ */
  --brand-hue: 259;
  --brand-chroma: 0.220;
  --brand-lightness: 0.588;

  /* ═══ FIXED SENTIMENT HUES ═══ */
  --danger-hue: 25;
  --warning-hue: 75;
  --success-hue: 152;
  --info-hue: var(--brand-hue);

  /* ═══ CONFIGURABLE NEUTRAL ═══ */
  --neutral-hue: 257;
  --neutral-chroma: 0.007;

  /* ═══ COMPUTED BRAND ACCENT ═══ */
  --brand: oklch(var(--brand-lightness) var(--brand-chroma) var(--brand-hue));
  --danger: oklch(0.634 0.232 var(--danger-hue));
  --warning: oklch(0.750 0.160 var(--warning-hue));
  --success: oklch(0.700 0.190 var(--success-hue));
  --info: oklch(0.630 0.195 var(--info-hue));
}

/* ═══ Display P3 enhanced accents ═══ */
@supports (color: color(display-p3 1 1 1)) {
  :root {
    --brand: oklch(var(--brand-lightness) calc(var(--brand-chroma) * 1.15) var(--brand-hue));
  }
}
`;

  const { writeFile, mkdir } = await import('node:fs/promises');
  await mkdir('dist/css', { recursive: true });
  await writeFile('dist/css/brand.css', css);
}
