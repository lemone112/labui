/**
 * Alpha Variant Generator
 *
 * Generates hue × opacity matrix at build time:
 * - 13 accent hues × 19 opacity stops = 247 alpha color tokens
 * - Neutral/Light (white × 19 opacity) = 19 tokens
 * - Neutral/Dark (near-black × 19 opacity) = 19 tokens
 * - Neutral/Gray-500 (midpoint × 19 opacity) = 19 tokens (for fills/borders)
 *
 * Total generated: ~300 tokens from base colors + 19 stops
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

  const hues = hueFile.hue as DTCGTokenGroup;
  for (const [name, token] of Object.entries(hues)) {
    if (name.startsWith('$')) continue;
    const colorToken = token as DTCGColorToken;
    if (!colorToken.$value) continue;

    const parsed = parseOklch(colorToken.$value);
    if (!parsed) continue;

    generated[name] = generateAlphaScale(...parsed, opacityStops);
  }

  // ─── Neutral/Light (white × opacity) ───

  generated['neutral-light'] = generateAlphaScale('1.000', '0', '0', opacityStops);

  // ─── Neutral/Dark (near-black × opacity) ───

  const neutral = neutralFile.neutral as DTCGTokenGroup;
  const darkBase = (neutral['1000'] as DTCGColorToken).$value;
  const darkParsed = parseOklch(darkBase) ?? ['0.086', '0.006', '285'];

  generated['neutral-dark'] = generateAlphaScale(...darkParsed, opacityStops);

  // ─── Neutral midpoint (500) × opacity — used by fills and borders ───

  const midBase = (neutral['500'] as DTCGColorToken).$value;
  const midParsed = parseOklch(midBase) ?? ['0.642', '0.007', '286'];

  generated['neutral-mid'] = generateAlphaScale(...midParsed, opacityStops);

  // ─── Write generated tokens ───

  const output: DTCGTokenGroup = {
    $schema: 'https://tr.designtokens.org/format/',
    $description: 'GENERATED — Do not edit. Alpha variants computed from base hues × 19 opacity stops.',
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
