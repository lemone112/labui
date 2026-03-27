/**
 * Alpha Variant Generator
 *
 * Generates hue × opacity matrix at build time:
 * - 13 accent hues × 19 opacity stops = 247 alpha color tokens
 * - Neutral/Light (white × 19 opacity) = 19 tokens
 * - Neutral/Dark (near-black × 19 opacity) = 19 tokens
 *
 * Total generated: ~285 tokens from 13 base hues + 19 stops
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';

// 19-stop opacity scale (matching Figma)
const OPACITY_STOPS = {
  '0':    0,
  '10':   0.01,
  '25':   0.03,
  '50':   0.05,
  '75':   0.08,
  '100':  0.10,
  '200':  0.20,
  '300':  0.30,
  '400':  0.40,
  '500':  0.50,
  '600':  0.60,
  '700':  0.70,
  '800':  0.80,
  '900':  0.90,
  '925':  0.93,
  '950':  0.95,
  '975':  0.98,
  '990':  0.99,
  '1000': 1.00,
};

export async function generateAlphaTokens() {
  // Read base hues
  const hueFile = JSON.parse(
    await readFile('tokens/primitive/hue.tokens.json', 'utf-8')
  );

  const neutralFile = JSON.parse(
    await readFile('tokens/primitive/neutral.tokens.json', 'utf-8')
  );

  const generated = {};

  // ─── Generate alpha variants for each accent hue ───

  for (const [name, token] of Object.entries(hueFile.hue)) {
    if (name.startsWith('$')) continue;
    if (!token.$value) continue;

    // Extract OKLCH components from "$value": "oklch(L C H)"
    const match = token.$value.match(/oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\)/);
    if (!match) continue;

    const [, L, C, H] = match;

    generated[name] = {};
    for (const [stop, alpha] of Object.entries(OPACITY_STOPS)) {
      generated[name][stop] = {
        $type: 'color',
        $value: alpha === 1
          ? `oklch(${L} ${C} ${H})`
          : `oklch(${L} ${C} ${H} / ${alpha})`,
      };
    }
  }

  // ─── Generate Neutral/Light (white × opacity) ───

  generated['neutral-light'] = {};
  for (const [stop, alpha] of Object.entries(OPACITY_STOPS)) {
    generated['neutral-light'][stop] = {
      $type: 'color',
      $value: alpha === 1
        ? 'oklch(1.000 0 0)'
        : `oklch(1.000 0 0 / ${alpha})`,
    };
  }

  // ─── Generate Neutral/Dark (near-black × opacity) ───

  // Use Gray.1000 as dark base
  const darkBase = neutralFile.neutral.gray['1000'].$value;
  const darkMatch = darkBase.match(/oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\)/);
  const [, dL, dC, dH] = darkMatch || ['', '0.070', '0.006', '257'];

  generated['neutral-dark'] = {};
  for (const [stop, alpha] of Object.entries(OPACITY_STOPS)) {
    generated['neutral-dark'][stop] = {
      $type: 'color',
      $value: alpha === 1
        ? `oklch(${dL} ${dC} ${dH})`
        : `oklch(${dL} ${dC} ${dH} / ${alpha})`,
    };
  }

  // ─── Write generated tokens ───

  const output = {
    $schema: 'https://tr.designtokens.org/format/',
    $description: 'GENERATED — Do not edit. Alpha variants computed from base hues × 19 opacity stops.',
    ...generated,
  };

  await mkdir('tokens/generated', { recursive: true });
  await writeFile(
    'tokens/generated/alpha.tokens.json',
    JSON.stringify(output, null, 2)
  );

  const count = Object.values(generated).reduce(
    (sum, group) => sum + Object.keys(group).length,
    0
  );
  console.log(`  ✓ Generated ${count} alpha variant tokens`);
}
