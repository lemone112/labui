/**
 * import-figma.ts — Figma-First Token Import Pipeline
 *
 * Reads Token Studio JSON exports from the figma-tokens/ directory and
 * converts them into DTCG-formatted primitive token files that are
 * identical in structure to what the existing generators produce.
 *
 * This enables a Figma-first workflow: designers maintain tokens in
 * Token Studio, export JSON, and the build pipeline picks it up
 * automatically — no manual sync needed.
 *
 * Mapping strategy:
 *   Token Studio format  →  DTCG (Design Tokens Community Group) format
 *   { "value": "#hex", "type": "color" }  →  { "$value": "oklch(...)", "$type": "color", "$extensions": { "hex": "#hex" } }
 *
 * @module import-figma
 */

import { readFile, writeFile, readdir, access } from 'node:fs/promises';
import { join } from 'node:path';
import { config } from './tokens.config.js';
import { hexToOklch, oklchToCss, oklchToHex } from './color-utils.js';
import { pxToRem } from './convert-units.js';

// ─── Types ──────────────────────────────────────────────────────────────────

interface TokenStudioToken {
  value: unknown;
  type: string;
  description?: string;
}

interface DtcgColorToken {
  $value: string;
  $type: 'color';
  $description?: string;
  $extensions: {
    hex: string;
    oklch?: { L: number; C: number; H: number };
  };
}

interface DtcgDimensionToken {
  $value: string;
  $type: 'dimension';
  $description?: string;
}

interface DtcgNumberToken {
  $value: number;
  $type: 'number';
  $description?: string;
}

// ─── Figma Scale Steps ──────────────────────────────────────────────────────

/**
 * Token Studio uses a 19-step opacity/shade scale for color palettes:
 * 0, 10, 25, 50, 75, 100, 200, 300, 400, 500, 600, 700, 800, 900, 925, 950, 975, 990, 1000
 */
const FIGMA_SCALE_STEPS = [
  '0', '10', '25', '50', '75', '100',
  '200', '300', '400', '500', '600', '700', '800', '900',
  '925', '950', '975', '990', '1000',
] as const;

// ─── px scale lookup ─────────────────────────────────────────────────────────

/** Resolve {px.N} references using the Unit/100%.json px table */
let pxLookup: Record<string, number> | null = null;

async function loadPxLookup(): Promise<Record<string, number>> {
  if (pxLookup) return pxLookup;
  const unitPath = join(config.figmaTokensPath, 'Unit', '100%.json');
  const raw = JSON.parse(await readFile(unitPath, 'utf-8'));
  pxLookup = {};
  if (raw.px) {
    for (const [key, token] of Object.entries(raw.px)) {
      const t = token as TokenStudioToken;
      if (typeof t.value === 'number') {
        pxLookup[key] = t.value;
      }
    }
  }
  return pxLookup;
}

/**
 * Resolve a Figma reference like "{px.5}" to a numeric px value.
 * Returns null if the reference cannot be resolved.
 */
function resolveRef(ref: unknown, lookup: Record<string, number>): number | null {
  if (typeof ref === 'number') return ref;
  if (typeof ref !== 'string') return null;

  const match = ref.match(/^\{px\.(-?[\d,]+)\}$/);
  if (match) {
    // Handle Figma's comma-as-decimal notation (e.g., "6,5" → "6.5")
    const key = match[1].replace(',', '.');
    // First try exact key, then normalized
    if (key in lookup) return lookup[key];
    const origKey = match[1];
    if (origKey in lookup) return lookup[origKey];
  }

  // Try direct number
  const num = parseFloat(String(ref));
  if (!isFinite(num)) return null;
  return num;
}

// ─── Color conversion ────────────────────────────────────────────────────────

/**
 * Convert a hex color (with or without alpha) to a DTCG color token.
 * Strips alpha channel for the OKLCH conversion, preserves original hex
 * in $extensions for fallback CSS output.
 */
function hexToDtcgColor(hexRaw: string, description?: string): DtcgColorToken | null {
  if (!hexRaw || typeof hexRaw !== 'string') return null;

  let hex = hexRaw.trim();
  if (!hex.startsWith('#')) return null;

  // Extract alpha if present (8-char hex: #RRGGBBAA)
  let alphaHex = '';
  const hasAlpha = hex.length === 9; // #RRGGBBAA
  if (hasAlpha) {
    alphaHex = hex.slice(7, 9);
    hex = hex.slice(0, 7); // Strip alpha for OKLCH conversion
  }

  // Convert opaque hex to OKLCH
  const oklch = hexToOklch(hex);
  let cssValue: string;

  if (hasAlpha) {
    // Convert alpha hex pair to decimal (0-1)
    const alphaDecimal = parseInt(alphaHex, 16) / 255;
    if (alphaDecimal === 0) {
      cssValue = `oklch(${oklch.L.toFixed(3)} ${oklch.C.toFixed(3)} ${Math.round(oklch.H)} / 0)`;
    } else {
      const alphaRounded = Math.round(alphaDecimal * 1000) / 1000;
      cssValue = `oklch(${oklch.L.toFixed(3)} ${oklch.C.toFixed(3)} ${Math.round(oklch.H)} / ${alphaRounded})`;
    }
  } else {
    cssValue = oklchToCss(oklch);
  }

  const token: DtcgColorToken = {
    $value: cssValue,
    $type: 'color',
    $extensions: {
      hex: hexRaw.toLowerCase(),
      oklch: { L: oklch.L, C: oklch.C, H: oklch.H },
    },
  };
  if (description) {
    token.$description = description;
  }
  return token;
}

// ─── Import functions ────────────────────────────────────────────────────────

/**
 * Import color tokens from Token Studio's Light-mode.json.
 * Extracts Colors.Neutral.Gray, Colors.Brand, Colors.Red, etc.
 * Produces DTCG tokens matching the hue.tokens.json structure.
 */
async function importColorTokens(): Promise<Record<string, unknown>> {
  const lightPath = join(config.figmaTokensPath, 'Color Scheme', 'Light-mode.json');
  const raw = JSON.parse(await readFile(lightPath, 'utf-8'));
  const colors = raw.Colors as Record<string, Record<string, TokenStudioToken>>;

  if (!colors) {
    throw new Error('import-figma: Colors key not found in Light-mode.json');
  }

  // Use 'figma-palette' as top-level namespace to avoid colliding with
  // existing 'neutral', 'hue' etc. in primitive/*.tokens.json
  const palettes: Record<string, unknown> = {};
  const result: Record<string, unknown> = {
    $schema: 'https://tr.designtokens.org/format/',
    'figma-palette': palettes,
  };

  // ── Color palettes (Brand, Red, Orange, etc.) ──
  const paletteNames = Object.keys(colors).filter(k => k !== 'Neutral');

  for (const paletteName of paletteNames) {
    const palette = colors[paletteName];
    if (typeof palette !== 'object' || palette === null) continue;

    const group: Record<string, unknown> = {
      $description: `${paletteName} palette imported from Figma Token Studio`,
    };

    for (const step of FIGMA_SCALE_STEPS) {
      const token = palette[step];
      if (!token || typeof token.value !== 'string') continue;

      const dtcg = hexToDtcgColor(token.value, `${paletteName} ${step}`);
      if (dtcg) {
        group[step] = dtcg;
      }
    }

    // kebab-case the palette name for output
    const outputName = paletteName.toLowerCase();
    palettes[outputName] = group;
  }

  // ── Neutral Gray ──
  const neutral = colors.Neutral;
  if (neutral && typeof neutral === 'object') {
    const neutralGroup: Record<string, unknown> = {};

    const graySource = (neutral as Record<string, unknown>).Gray as
      | Record<string, TokenStudioToken>
      | undefined;

    if (graySource) {
      const grayGroup: Record<string, unknown> = {
        $description: 'Neutral gray palette imported from Figma Token Studio',
      };

      for (const step of FIGMA_SCALE_STEPS) {
        const token = graySource[step];
        if (!token || typeof token.value !== 'string') continue;

        const dtcg = hexToDtcgColor(token.value, `Gray ${step}`);
        if (dtcg) {
          grayGroup[step] = dtcg;
        }
      }

      neutralGroup.gray = grayGroup;
    }

    // Neutral.Light and Neutral.Dark opacity ramps
    for (const variant of ['Light', 'Dark'] as const) {
      const variantSource = (neutral as Record<string, unknown>)[variant] as
        | Record<string, TokenStudioToken>
        | undefined;

      if (variantSource) {
        const variantGroup: Record<string, unknown> = {
          $description: `Neutral ${variant.toLowerCase()} opacity ramp from Figma`,
        };

        for (const step of FIGMA_SCALE_STEPS) {
          const token = variantSource[step];
          if (!token || typeof token.value !== 'string') continue;

          const dtcg = hexToDtcgColor(token.value, `Neutral.${variant} ${step}`);
          if (dtcg) {
            variantGroup[step] = dtcg;
          }
        }

        neutralGroup[variant.toLowerCase()] = variantGroup;
      }
    }

    palettes.neutral = neutralGroup;
  }

  return result;
}

/**
 * Import dimension tokens from Dimention/Desktop.json.
 * Produces DTCG dimension tokens for spacing, sizing, and radius.
 */
async function importDimensionTokens(): Promise<{
  spacing: Record<string, unknown>;
  size: Record<string, unknown>;
  radius: Record<string, unknown>;
}> {
  const desktopPath = join(config.figmaTokensPath, 'Dimention', 'Desktop.json');
  const raw = JSON.parse(await readFile(desktopPath, 'utf-8'));
  const lookup = await loadPxLookup();

  // ── Spacing from Figma Spacing.Padding ──
  const spacing: Record<string, unknown> = {
    $schema: 'https://tr.designtokens.org/format/',
    $description: 'Spacing tokens imported from Figma (Dimention/Desktop)',
  };

  const figmaSpacing = raw.Spacing as Record<string, Record<string, TokenStudioToken>> | undefined;
  if (figmaSpacing) {
    // Merge Padding and Margin into a single spacing scale
    // Use Padding as primary (it is the positive-only set)
    const paddingTokens = figmaSpacing.Padding || {};
    for (const [name, token] of Object.entries(paddingTokens)) {
      const px = resolveRef(token.value, lookup);
      if (px !== null && px >= 0) {
        const cssName = name.toLowerCase().replace(/^none$/, '0');
        spacing[cssName] = {
          $type: 'dimension',
          $value: pxToRem(px),
          $description: `${px}px`,
        } satisfies DtcgDimensionToken;
      }
    }
  }

  // ── Sizing from Figma Size ──
  const size: Record<string, unknown> = {
    $schema: 'https://tr.designtokens.org/format/',
    $description: 'Size tokens imported from Figma (Dimention/Desktop)',
  };

  const figmaSize = raw.Size as Record<string, TokenStudioToken> | undefined;
  if (figmaSize) {
    for (const [name, token] of Object.entries(figmaSize)) {
      const px = resolveRef(token.value, lookup);
      if (px !== null && px > 0) {
        size[name.toLowerCase()] = {
          $type: 'dimension',
          $value: pxToRem(px),
          $description: `${px}px`,
        } satisfies DtcgDimensionToken;
      }
    }
  }

  // ── Radius from Figma Radius ──
  const radius: Record<string, unknown> = {
    $schema: 'https://tr.designtokens.org/format/',
    $description: 'Border radius tokens imported from Figma (Dimention/Desktop)',
  };

  const figmaRadius = raw.Radius as Record<string, TokenStudioToken> | undefined;
  if (figmaRadius) {
    for (const [name, token] of Object.entries(figmaRadius)) {
      const px = resolveRef(token.value, lookup);
      if (px !== null) {
        const cssName = name.toLowerCase().replace(/^none$/, '0').replace(/^full$/, 'full');
        if (cssName === 'full') {
          radius[cssName] = {
            $type: 'dimension',
            $value: '9999px',
            $description: 'Pill / circular',
          } satisfies DtcgDimensionToken;
        } else {
          radius[cssName] = {
            $type: 'dimension',
            $value: pxToRem(px),
            $description: `${px}px`,
          } satisfies DtcgDimensionToken;
        }
      }
    }
  }

  return { spacing, size, radius };
}

/**
 * Import the base px scale from Unit/100%.json.
 * This is used as the fundamental reference for all dimension tokens.
 */
async function importPxScale(): Promise<Record<string, unknown>> {
  const lookup = await loadPxLookup();

  const pxScale: Record<string, unknown> = {
    $schema: 'https://tr.designtokens.org/format/',
    $description: 'Base px scale from Figma Unit/100%. Reference only — consumed by dimension tokens.',
  };

  for (const [key, val] of Object.entries(lookup)) {
    // Skip negative values for the base scale output
    if (val < 0) continue;
    pxScale[key] = {
      $type: 'dimension',
      $value: `${val}px`,
    };
  }

  return pxScale;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Check if Figma tokens directory exists and has the expected structure.
 */
export async function figmaTokensExist(): Promise<boolean> {
  try {
    await access(config.figmaTokensPath);
    // Verify at least the Light-mode color scheme exists
    await access(join(config.figmaTokensPath, 'Color Scheme', 'Light-mode.json'));
    return true;
  } catch {
    return false;
  }
}

/**
 * Run the full Figma import pipeline.
 *
 * Reads Token Studio JSON exports and writes DTCG-formatted files into
 * the figma-import/ directory. These files have the same structure as
 * the generator output in primitive/, so Style Dictionary can consume
 * them without changes.
 *
 * @param outputDir - Directory to write imported tokens (default: generated/)
 */
export async function importFigmaTokens(
  outputDir: string,
): Promise<{ colorCount: number; dimensionCount: number }> {
  console.log('  Reading Token Studio exports from figma-tokens/...');

  let colorCount = 0;
  let dimensionCount = 0;

  // ── Phase 0a: Import colors ──
  try {
    const colorTokens = await importColorTokens();
    const colorPath = join(outputDir, 'figma-colors.tokens.json');
    await writeFile(colorPath, JSON.stringify(colorTokens, null, 2) + '\n');

    // Count imported colors
    const countTokens = (obj: Record<string, unknown>): number => {
      let count = 0;
      for (const [key, val] of Object.entries(obj)) {
        if (key.startsWith('$')) continue;
        if (typeof val === 'object' && val !== null && '$type' in val) {
          count++;
        } else if (typeof val === 'object' && val !== null) {
          count += countTokens(val as Record<string, unknown>);
        }
      }
      return count;
    };
    colorCount = countTokens(colorTokens);
    console.log(`  OK Imported ${colorCount} color tokens`);
  } catch (err) {
    console.warn(`  WARN Could not import color tokens: ${err}`);
  }

  // ── Phase 0b: Import dimensions ──
  try {
    const { spacing, size, radius } = await importDimensionTokens();

    const spacingPath = join(outputDir, 'figma-spacing.tokens.json');
    await writeFile(
      spacingPath,
      JSON.stringify({ $schema: 'https://tr.designtokens.org/format/', 'figma-spacing': spacing }, null, 2) + '\n',
    );

    const sizePath = join(outputDir, 'figma-size.tokens.json');
    await writeFile(
      sizePath,
      JSON.stringify({ $schema: 'https://tr.designtokens.org/format/', 'figma-size': size }, null, 2) + '\n',
    );

    const radiusPath = join(outputDir, 'figma-radius.tokens.json');
    await writeFile(
      radiusPath,
      JSON.stringify({ $schema: 'https://tr.designtokens.org/format/', 'figma-radius': radius }, null, 2) + '\n',
    );

    dimensionCount =
      Object.keys(spacing).filter(k => !k.startsWith('$')).length +
      Object.keys(size).filter(k => !k.startsWith('$')).length +
      Object.keys(radius).filter(k => !k.startsWith('$')).length;
    console.log(`  OK Imported ${dimensionCount} dimension tokens (spacing + size + radius)`);
  } catch (err) {
    console.warn(`  WARN Could not import dimension tokens: ${err}`);
  }

  // ── Phase 0c: Import px scale (reference) ──
  try {
    const pxScale = await importPxScale();
    const pxPath = join(outputDir, 'figma-px-scale.tokens.json');
    await writeFile(
      pxPath,
      JSON.stringify({ $schema: 'https://tr.designtokens.org/format/', 'figma-px': pxScale }, null, 2) + '\n',
    );
    console.log(`  OK Imported px base scale`);
  } catch (err) {
    console.warn(`  WARN Could not import px scale: ${err}`);
  }

  return { colorCount, dimensionCount };
}
