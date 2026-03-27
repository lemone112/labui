/**
 * Lab UI Token Build Pipeline
 *
 * Source: W3C DTCG 2025.10 JSON (.tokens.json)
 * Tool:   Style Dictionary v4 (ESM)
 * Output: CSS custom properties + Tailwind v4 @theme
 */

import StyleDictionary from 'style-dictionary';
import { writeFile, mkdir } from 'node:fs/promises';
import { generateAlphaTokens } from './generate-alpha.js';
import { generateTailwindTheme } from './generate-tailwind.js';
import { generateNeutralTokens } from './generate-neutral-scale.js';

interface ThemeConfig {
  name: string;
  selector: string;
}

// ─── Phase 0: Generate neutral scale from parameters ────────────

console.log('→ Generating neutral scale...');
await generateNeutralTokens({
  hue: 283,       // cool-purple tint (configurable)
  chroma: 0.012,  // subtle colorfulness (configurable)
  // steps are FIXED at 19 — semantic tokens reference specific stops by name
  // (0, 10, 25, 50, 75, 100, 200, 300, 400, 500, 600, 700, 800, 900, 925, 950, 975, 990, 1000)
});

// ─── Phase 1: Generate alpha variants ───────────────────────────

console.log('→ Generating alpha variants...');
await generateAlphaTokens();

// ─── Phase 2: Build per-theme CSS ───────────────────────────────

const themes: ThemeConfig[] = [
  { name: 'light', selector: ':root, [data-theme="light"]' },
  { name: 'dark',  selector: '[data-theme="dark"]' },
];

for (const theme of themes) {
  console.log(`→ Building ${theme.name} theme...`);

  const sd = new StyleDictionary({
    source: [
      'primitive/**/*.tokens.json',
      'generated/**/*.tokens.json',
      `semantic/${theme.name}.tokens.json`,
      `material/${theme.name}.tokens.json`,
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

// ─── Phase 5: Generate index.css entry point ────────────────────

console.log('→ Generating index.css...');
await generateIndex();

console.log('✓ Lab UI tokens built successfully');

async function generateIndex(): Promise<void> {
  const css = `/* Lab UI Tokens — Entry Point
 * Imports brand config + light theme (default) + dark theme override.
 */
@import "./css/brand.css";
@import "./css/light.css";
@import "./css/dark.css";
`;
  await writeFile('dist/index.css', css);
}

// ─── Brand hue runtime CSS ──────────────────────────────────────

async function generateBrandHueLayer(): Promise<void> {
  const css = `/* Lab UI — Brand Hue Runtime Layer
 * Override --brand-hue to change the entire accent system.
 * Sentiments (danger, warning, success, info) have independent fixed hues.
 */

:root {
  /* ═══ BRAND — configurable ═══ */
  --brand-hue: 257;
  --brand-chroma: 0.218;
  --brand-lightness: 0.603;

  /* ═══ SENTIMENTS — independent fixed hues ═══ */
  --danger-hue: 29;
  --warning-hue: 69;
  --success-hue: 147;
  --info-hue: 260;

  /* ═══ NEUTRAL — configurable tint ═══ */
  --neutral-hue: 257;
  --neutral-chroma: 0.007;

  /* ═══ COMPUTED ACCENTS ═══ */
  --brand: oklch(var(--brand-lightness) var(--brand-chroma) var(--brand-hue));
  --danger: oklch(0.654 0.232 var(--danger-hue));
  --warning: oklch(0.786 0.172 var(--warning-hue));
  --success: oklch(0.730 0.194 var(--success-hue));
  --info: oklch(0.640 0.193 var(--info-hue));
}

/* ═══ Display P3 enhanced accents ═══ */
@supports (color: color(display-p3 1 1 1)) {
  :root {
    --brand: oklch(var(--brand-lightness) calc(var(--brand-chroma) * 1.15) var(--brand-hue));
  }
}
`;

  await mkdir('dist/css', { recursive: true });
  await writeFile('dist/css/brand.css', css);
}
