/**
 * Lab UI v3 Token Build Pipeline
 *
 * 9-step pipeline:
 *   1. HEX -> OKLCH
 *   2. Neutrals: brand H + chroma -> 13 steps
 *   3. Sentiments: Figma base -> chroma harmonize with brand -> gamut clamp
 *   4. Decoratives: rotate brand H -> gamut clamp -> collision check
 *   5. Brand variants: dark/IC with hue shift + gamut clamp
 *   6. Alpha matrix: all accents x 9 opacity stops
 *   7. Label correction: for each accent x context x theme
 *   8. Semantic assembly: BG / Fill / Label / Border / FX
 *   9. Output: DTCG JSON -> Style Dictionary v5 -> CSS + Tailwind
 *
 * 4 themes: light, dark, light-ic, dark-ic
 * CSS prefix: --lab-
 */

import StyleDictionary from 'style-dictionary';
import { writeFile, mkdir } from 'node:fs/promises';
import { generateAccentTokens } from './generate-accents.js';
import { generateAlphaTokens } from './generate-alpha.js';
import { generateNeutralTokens } from './generate-neutral-scale.js';
import { generateTailwindTheme } from './generate-tailwind.js';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ThemeConfig {
  name: string;
  selector: string;
}

// ─── Theme Configuration ────────────────────────────────────────────────────

const themes: ThemeConfig[] = [
  { name: 'light',    selector: ':root, [data-theme="light"]' },
  { name: 'dark',     selector: '[data-theme="dark"]' },
  { name: 'light-ic', selector: '[data-theme="light-ic"]' },
  { name: 'dark-ic',  selector: '[data-theme="dark-ic"]' },
];

/**
 * Map theme name to the base theme for material tokens.
 * IC themes reuse their base theme's material layer since
 * material tokens only exist for light/dark.
 */
function materialBase(themeName: string): string {
  if (themeName === 'light-ic') return 'light';
  if (themeName === 'dark-ic') return 'dark';
  return themeName;
}

// ─── Phase 0: Generate accents (brand + sentiments + decoratives) ───────────

console.log('-> Phase 0: Generating accent tokens...');
await generateAccentTokens({ brand: '#007AFF' });

// ─── Phase 1: Generate neutral scale ────────────────────────────────────────

console.log('-> Phase 1: Generating neutral scale...');
await generateNeutralTokens({
  hue: 283,       // cool-purple tint (configurable)
  chroma: 0.012,  // subtle colorfulness (configurable)
});

// ─── Phase 2: Generate alpha variants ───────────────────────────────────────

console.log('-> Phase 2: Generating alpha variants...');
await generateAlphaTokens();

// ─── Phase 3-8: Build CSS per theme via Style Dictionary v5 ─────────────────

for (const theme of themes) {
  console.log(`-> Building ${theme.name} theme...`);

  const sd = new StyleDictionary({
    log: {
      warnings: 'warn',
      verbosity: 'verbose',
      errors: {
        brokenReferences: 'console',
      },
    },
    source: [
      'primitive/**/*.tokens.json',
      'generated/**/*.tokens.json',
      `semantic/${theme.name}.tokens.json`,
      `material/${materialBase(theme.name)}.tokens.json`,
    ],
    platforms: {
      css: {
        prefix: 'lab',
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

// ─── Phase 9a: Generate Tailwind v4 theme ───────────────────────────────────

console.log('-> Phase 9a: Generating Tailwind v4 theme...');
await generateTailwindTheme();

// ─── Phase 9b: Generate index.css entry point ───────────────────────────────

console.log('-> Phase 9b: Generating index.css...');
await generateIndex();

console.log('OK Lab UI tokens built successfully');

// ─── Index Generator ────────────────────────────────────────────────────────

async function generateIndex(): Promise<void> {
  const css = `/* Lab UI Tokens -- Entry Point
 * Imports all 4 theme layers: light (default) + dark + IC variants.
 */
@import "./css/light.css";
@import "./css/dark.css";
@import "./css/light-ic.css";
@import "./css/dark-ic.css";
`;
  await mkdir('dist', { recursive: true });
  await writeFile('dist/index.css', css);
}
