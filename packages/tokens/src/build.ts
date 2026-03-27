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
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { generateAccentTokens } from './generate-accents.js';
import { generateAlphaTokens } from './generate-alpha.js';
import { generateNeutralTokens } from './generate-neutral-scale.js';
import { generateTailwindTheme } from './generate-tailwind.js';
import { generateOnSolidLabel, correctLabelColor } from './generate-labels.js';
import { oklchToCss, type OklchColor } from './color-utils.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const tokensRoot = join(__dirname, '..');
/** Normalize path to forward slashes for glob compatibility on Windows */
const tokensRootGlob = tokensRoot.replace(/\\/g, '/');

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

// ─── Label Computation ─────────────────────────────────────────────────────

const OKLCH_REGEX = /oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\)/;

function parseOklchFromCss(value: string): OklchColor | null {
  const match = value.match(OKLCH_REGEX);
  if (!match) return null;
  return { L: parseFloat(match[1]), C: parseFloat(match[2]), H: parseFloat(match[3]) };
}

const ACCENT_NAMES = ['brand', 'danger', 'warning', 'success', 'info'] as const;

/** Map theme name to the hue variant key in hue.tokens.json */
function hueVariant(themeName: string): string {
  if (themeName === 'light-ic') return 'light-ic';
  if (themeName === 'dark-ic') return 'dark-ic';
  return themeName;
}

/** Get the neutral background for a theme (white for light, near-black for dark) */
function themeBg(themeName: string): OklchColor {
  return themeName.startsWith('dark')
    ? { L: 0.1, C: 0, H: 0 }   // neutral.12
    : { L: 1.0, C: 0, H: 0 };  // neutral.0
}

/** Contrast threshold for on-tint labels: 3.0 for normal, 4.5 for IC */
function onTintThreshold(themeName: string): number {
  return themeName.includes('-ic') ? 4.5 : 3.0;
}

/**
 * Read hue tokens, compute on-solid and on-tint labels, and inject
 * computed values into each semantic file.
 */
async function computeAndInjectLabels(): Promise<void> {
  const hueFile = JSON.parse(
    await readFile(join(tokensRoot, 'primitive/hue.tokens.json'), 'utf-8'),
  ) as Record<string, unknown>;
  const hues = hueFile.hue as Record<string, Record<string, { $value?: string }>>;

  for (const theme of themes) {
    const semanticPath = join(tokensRoot, `semantic/${theme.name}.tokens.json`);
    const semantic = JSON.parse(await readFile(semanticPath, 'utf-8'));
    const variant = hueVariant(theme.name);
    const bg = themeBg(theme.name);
    const tintThreshold = onTintThreshold(theme.name);

    for (const accent of ACCENT_NAMES) {
      const hueGroup = hues[accent];
      if (!hueGroup) continue;

      const hueToken = hueGroup[variant];
      if (!hueToken?.$value) continue;

      const accentColor = parseOklchFromCss(hueToken.$value);
      if (!accentColor) continue;

      // ── On-solid label (white or dark text on solid accent bg) ──
      const onSolidColor = generateOnSolidLabel(accentColor);
      const onSolidCss = oklchToCss(onSolidColor);

      if (semantic.label?.on?.[accent]) {
        semantic.label.on[accent].$value = onSolidCss;
      }

      // ── On-tint label (L-corrected accent for tinted background) ──
      const onTintResult = correctLabelColor({
        accent: accentColor,
        background: bg,
        contrastTarget: tintThreshold,
      });
      const onTintCss = oklchToCss(onTintResult.color);

      if (semantic.label?.[accent]?.['on-tint']) {
        semantic.label[accent]['on-tint'].$value = onTintCss;
        semantic.label[accent]['on-tint'].$description =
          `COMPUTED: L-corrected ${accent} on tint bg (${tintThreshold}:1 target, ${onTintResult.contrastAchieved.toFixed(1)}:1 achieved)`;
      }
    }

    await writeFile(semanticPath, JSON.stringify(semantic, null, 2) + '\n');
    console.log(`  OK Injected labels for ${theme.name}`);
  }
}

async function generateIndex(): Promise<void> {
  const css = `/* Lab UI Tokens -- Entry Point
 * Imports all 4 theme layers: light (default) + dark + IC variants.
 */
@import "./css/light.css";
@import "./css/dark.css";
@import "./css/light-ic.css";
@import "./css/dark-ic.css";
`;
  await mkdir(join(tokensRoot, 'dist'), { recursive: true });
  await writeFile(join(tokensRoot, 'dist/index.css'), css);
}

// ─── Pipeline Execution ────────────────────────────────────────────────────

console.log('-> Phase 0: Generating accent tokens...');
await generateAccentTokens({ brand: '#007AFF' });

console.log('-> Phase 1: Generating neutral scale...');
await generateNeutralTokens({
  hue: 283,       // cool-purple tint (configurable)
  chroma: 0.012,  // subtle colorfulness (configurable)
});

console.log('-> Phase 2: Generating alpha variants...');
await generateAlphaTokens();

console.log('-> Phase 2b: Computing label tokens...');
await computeAndInjectLabels();

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
      `${tokensRootGlob}/primitive/**/*.tokens.json`,
      `${tokensRootGlob}/generated/**/*.tokens.json`,
      `${tokensRootGlob}/semantic/${theme.name}.tokens.json`,
      `${tokensRootGlob}/material/${materialBase(theme.name)}.tokens.json`,
    ],
    platforms: {
      css: {
        prefix: 'lab',
        transformGroup: 'css',
        buildPath: `${tokensRootGlob}/dist/css/`,
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

console.log('-> Phase 9a: Generating Tailwind v4 theme...');
await generateTailwindTheme();

console.log('-> Phase 9b: Generating index.css...');
await generateIndex();

console.log('OK Lab UI tokens built successfully');
