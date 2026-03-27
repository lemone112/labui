/**
 * Alpha Variant Generator
 *
 * Generates hue × opacity matrix at build time:
 * - 11 accent hues × 9 opacity stops = 99 alpha color tokens
 * - Neutral/Light (white × 9 opacity) = 9 tokens
 * - Neutral/Dark (near-black × 9 opacity) = 9 tokens
 * - Neutral/Mid (gray-500 × 9 opacity) = 9 tokens (for fills/borders)
 *
 * Total generated: ~126 tokens from base colors + 9 stops (2,4,8,12,20,32,52,72,80)
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';

interface DTCGColorToken {
  $type: 'color';
  $value: string;
  $description?: string;
  $extensions?: Record<string, unknown>;
}

interface DTCGTokenGroup {
  [key: string]: DTCGColorToken | DTCGTokenGroup | string;
}

interface OpacityScale {
  [stop: string]: number;
}

interface OpacityTokenFile {
  opacity: Record<string, { $type: string; $value: number; $description?: string } | string>;
}

/**
 * Read opacity stops from the single source of truth: primitive/opacity.tokens.json
 */
async function loadOpacityStops(): Promise<OpacityScale> {
  const raw = JSON.parse(
    await readFile('primitive/opacity.tokens.json', 'utf-8'),
  ) as OpacityTokenFile;

  const stops: OpacityScale = {};
  for (const [key, token] of Object.entries(raw.opacity)) {
    if (key.startsWith('$')) continue;
    if (typeof token === 'object' && '$value' in token) {
      stops[key] = token.$value;
    }
  }
  return stops;
}

const OKLCH_REGEX = /oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\)/;

function parseOklch(value: string): [string, string, string] | null {
  const match = value.match(OKLCH_REGEX);
  if (!match) return null;
  return [match[1], match[2], match[3]];
}

function generateAlphaScale(
  L: string,
  C: string,
  H: string,
  opacityStops: OpacityScale,
): Record<string, DTCGColorToken> {
  const scale: Record<string, DTCGColorToken> = {};

  for (const [stop, alpha] of Object.entries(opacityStops)) {
    scale[stop] = {
      $type: 'color',
      $value: alpha === 1
        ? `oklch(${L} ${C} ${H})`
        : `oklch(${L} ${C} ${H} / ${alpha})`,
    };
  }

  return scale;
}

export async function generateAlphaTokens(): Promise<void> {
  const opacityStops = await loadOpacityStops();

  const hueFile = JSON.parse(
    await readFile('primitive/hue.tokens.json', 'utf-8'),
  ) as DTCGTokenGroup;

  const neutralFile = JSON.parse(
    await readFile('primitive/neutral.tokens.json', 'utf-8'),
  ) as DTCGTokenGroup;

  const generated: Record<string, Record<string, DTCGColorToken>> = {};

  // ─── Accent hues × opacity stops ───
  // v3: each accent has per-theme variants (light/dark/light-ic/dark-ic).
  // Use the 'light' variant as base for alpha generation.

  const hues = hueFile.hue as DTCGTokenGroup;
  for (const [name, token] of Object.entries(hues)) {
    if (name.startsWith('$')) continue;

    // Try flat token first (backward compat), then nested 'light' variant
    const group = token as DTCGTokenGroup;
    const colorToken = (group.$value
      ? group
      : group.light) as DTCGColorToken | undefined;
    if (!colorToken?.$value) continue;

    const parsed = parseOklch(colorToken.$value);
    if (!parsed) continue;

    generated[name] = generateAlphaScale(...parsed, opacityStops);
  }

  // ─── Neutral/Light (white × opacity) ───

  generated['neutral-light'] = generateAlphaScale('1.000', '0', '0', opacityStops);

  // ─── Neutral/Dark (near-black × opacity) ───
  // v3 scale: step 12 = darkest (was 1000 in old naming)

  const neutral = neutralFile.neutral as DTCGTokenGroup;
  const darkBase = (neutral['12'] as DTCGColorToken)?.$value;
  const darkParsed = parseOklch(darkBase ?? '') ?? ['0.086', '0.006', '285'];

  generated['neutral-dark'] = generateAlphaScale(...darkParsed, opacityStops);

  // ─── Neutral midpoint (step 6) × opacity — used by fills and borders ───
  // v3 scale: step 6 = midpoint (was 500 in old naming)

  const midBase = (neutral['6'] as DTCGColorToken)?.$value;
  const midParsed = parseOklch(midBase ?? '') ?? ['0.642', '0.007', '286'];

  generated['neutral-mid'] = generateAlphaScale(...midParsed, opacityStops);

  // ─── Write generated tokens ───

  const output: DTCGTokenGroup = {
    $schema: 'https://tr.designtokens.org/format/',
    $description: 'GENERATED — Do not edit. Alpha variants computed from base hues × 9 opacity stops.',
    ...generated,
  };

  await mkdir('generated', { recursive: true });
  await writeFile(
    'generated/alpha.tokens.json',
    JSON.stringify(output, null, 2),
  );

  const count = Object.values(generated).reduce(
    (sum, group) => sum + Object.keys(group).length,
    0,
  );
  console.log(`  ✓ Generated ${count} alpha variant tokens`);
}
