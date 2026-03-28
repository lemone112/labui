/**
 * Lab UI v3 Token Build Pipeline
 *
 * 10-step pipeline:
 *   0. (NEW) Figma import: Token Studio JSON -> DTCG primitives (if figma-tokens/ exists)
 *   1. HEX -> OKLCH
 *   2. Neutrals: brand H + chroma -> 13 steps
 *   3. Sentiments: Figma base -> chroma harmonize with brand -> gamut clamp
 *   4. Decoratives: rotate brand H -> gamut clamp -> collision check
 *   5. Brand variants: dark/IC with hue shift + gamut clamp
 *   6. Alpha matrix: all accents x 9 opacity stops
 *   7. Label correction: for each accent x context x theme
 *   8. Semantic assembly: BG / Fill / Label / Border / FX
 *   9. Output: DTCG JSON -> Style Dictionary v5 -> CSS (with hex fallback) + Tailwind
 *
 * 4 themes: light, dark, light-ic, dark-ic
 * CSS output: clean variable names (no namespace prefix)
 */

import StyleDictionary from 'style-dictionary';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { generateAccentTokens } from './generate-accents.js';
import { generateNeutralTokens } from './generate-neutral-scale.js';
import { generateTailwindTheme } from './generate-tailwind.js';
import { generateTypographyTokens } from './generate-typography.js';
import { generateOnSolidLabel, correctLabelColor } from './generate-labels.js';
import { oklchToCss, oklchToHex, type OklchColor } from './color-utils.js';
import { config } from './tokens.config.js';
import { figmaTokensExist, importFigmaTokens } from './import-figma.js';

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

// ─── Custom CSS Format: oklch with hex fallback ─────────────────────────────

/**
 * Register a custom Style Dictionary format that emits hex fallback
 * before the oklch value for every color token:
 *
 *   --fill-brand-solid: #007aff;
 *   --fill-brand-solid: oklch(0.603 0.218 257);
 *
 * Non-color tokens are emitted normally.
 */
function registerOklchHexFallbackFormat(sd: StyleDictionary): void {
  sd.registerFormat({
    name: 'css/oklch-hex-fallback',
    format: ({ dictionary, options }) => {
      const selector = (options as Record<string, unknown>)?.selector ?? ':root';
      const lines: string[] = [];

      lines.push(`${selector} {`);

      for (const token of dictionary.allTokens) {
        const name = `--${token.name}`;
        const value = token.value ?? token.$value;

        if (typeof value === 'string' && value.startsWith('oklch(')) {
          // Check if we have a hex extension stored during token generation
          const hex = token.$extensions?.hex ?? token.extensions?.hex;
          if (hex && typeof hex === 'string') {
            lines.push(`  ${name}: ${hex};`);
          } else {
            // Try to derive hex from the oklch value
            const parsed = parseOklchFromCss(value);
            if (parsed) {
              const derivedHex = oklchToHex(parsed);
              lines.push(`  ${name}: ${derivedHex};`);
            }
          }
          lines.push(`  ${name}: ${value};`);
        } else {
          lines.push(`  ${name}: ${value};`);
        }
      }

      lines.push('}');
      return lines.join('\n') + '\n';
    },
  });
}

// ─── Pipeline Execution ────────────────────────────────────────────────────

// Phase 0: Figma import (if figma-tokens/ directory exists)
const hasFigma = await figmaTokensExist();
if (hasFigma) {
  console.log('-> Phase 0: Importing tokens from Figma Token Studio...');
  const generatedDir = join(tokensRoot, 'generated');
  await mkdir(generatedDir, { recursive: true });
  const { colorCount, dimensionCount } = await importFigmaTokens(generatedDir);
  console.log(`  OK Figma import complete (${colorCount} colors, ${dimensionCount} dimensions)`);
} else {
  console.log('-> Phase 0: No figma-tokens/ directory found — using generators (backward compat)');
}

console.log('-> Phase 1: Generating accent tokens...');
await generateAccentTokens({ brand: config.brandColor });

console.log('-> Phase 2: Generating neutral scale...');
await generateNeutralTokens({
  hue: config.neutralHue,
  chroma: config.neutralChroma,
});

console.log('-> Phase 3: Generating typography scale...');
await generateTypographyTokens();


console.log('-> Phase 5: Computing label tokens...');
await computeAndInjectLabels();

let themePhase = 6;
for (const theme of themes) {
  console.log(`-> Phase ${themePhase++}: Building ${theme.name} theme...`);

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

  // Register the oklch hex fallback format for this SD instance
  registerOklchHexFallbackFormat(sd);

  await sd.buildAllPlatforms();
}

console.log('-> Phase 10: Generating Tailwind v4 theme + index.css...');
await generateTailwindTheme();
await generateIndex();

console.log('OK Lab UI tokens built successfully');
