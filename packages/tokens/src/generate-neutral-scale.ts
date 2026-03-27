/**
 * 13-Step Neutral Color Scale Generator (OKLCH)
 *
 * Generates a perceptually uniform neutral scale from 3 parameters:
 *   hue     - cool tint angle in OKLCH (e.g. 280 = cool-purple)
 *   chroma  - peak colorfulness at midpoint (0 = pure gray, 0.01 = subtle tint)
 *
 * The scale uses FIXED lightness values (from the v3 spec) and a parabolic
 * chroma curve that peaks at the midpoint (step 6) and drops to zero at the
 * achromatic endpoints (steps 0 and 12).
 *
 * 13 steps: 0 (white) through 12 (near-black).
 *
 * @see https://bottosson.github.io/posts/oklab/ - Bjorn Ottosson's Oklab
 */

import { oklchToHex, oklchToCss, hexToOklch } from './color-utils.js';

// ---- Types -----------------------------------------------------------------

export interface NeutralScaleOptions {
  /** OKLCH hue angle (0-360). 283 = cool-purple, 230 = blue-gray, 30 = warm */
  hue: number;
  /** Peak chroma at midpoint (step 6). 0 = pure gray, 0.012 = subtle tint */
  chroma: number;
  /** Maximum lightness (default 1.0 = white) */
  maxLightness?: number;
  /** Minimum lightness (default 0.1 = near-black) */
  minLightness?: number;
}

export interface NeutralScaleStep {
  /** Step index (0 = lightest, 12 = darkest) */
  index: number;
  /** Token name: "0" through "12" */
  name: string;
  /** OKLCH lightness (0-1) */
  L: number;
  /** OKLCH chroma (0-~0.4) */
  C: number;
  /** OKLCH hue angle (degrees) */
  H: number;
  /** CSS oklch() string */
  oklch: string;
  /** sRGB hex string */
  hex: string;
}

// ---- Constants -------------------------------------------------------------

/** 13 step names: "0" through "12" */
const STEP_NAMES = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

/**
 * Fixed lightness values from the v3 spec.
 * 13 values: step 0 (white) to step 12 (near-black).
 */
const NEUTRAL_LIGHTNESS = [
  1.000, 0.970, 0.925, 0.860, 0.775, 0.680, 0.575,
  0.475, 0.380, 0.300, 0.230, 0.170, 0.100,
];

/** Midpoint index (step 6) where chroma peaks */
const MID_INDEX = 6;

// ---- Core Algorithm --------------------------------------------------------

/**
 * Generate a 13-step neutral color scale in OKLCH.
 *
 * @param options - Scale parameters
 * @returns Array of 13 scale steps from lightest (index 0) to darkest (index 12)
 */
export function generateNeutralScale(options: NeutralScaleOptions): NeutralScaleStep[] {
  const { hue, chroma } = options;

  const result: NeutralScaleStep[] = [];

  for (let i = 0; i < 13; i++) {
    const L = NEUTRAL_LIGHTNESS[i];

    // Parabolic chroma: peaks at midpoint, zero at extremes
    // C(i) = peakChroma * (1 - ((i - 6) / 6)^2)
    const distance = (i - MID_INDEX) / MID_INDEX;
    const C = chroma * (1 - distance * distance);

    // Achromatic steps (C ~ 0) get hue = 0
    const H = C > 0.0001 ? hue : 0;

    const color = { L, C, H };

    result.push({
      index: i,
      name: STEP_NAMES[i],
      L: round(L, 3),
      C: round(C, 3),
      H: round(H, 0),
      oklch: oklchToCss(color),
      hex: oklchToHex(color),
    });
  }

  return result;
}

// ---- DTCG Token Output -----------------------------------------------------

/**
 * Generate W3C DTCG-format tokens JSON for the neutral scale.
 * Integrates with the existing Style Dictionary pipeline.
 */
export async function generateNeutralTokens(
  options: NeutralScaleOptions,
): Promise<void> {
  const { writeFile } = await import('node:fs/promises');

  const scale = generateNeutralScale(options);

  const neutral: Record<string, unknown> = {};
  for (const step of scale) {
    neutral[step.name] = {
      $type: 'color',
      $value: step.oklch,
      $extensions: { 'lab-ui': { hex: step.hex } },
    };
  }

  const output = {
    $schema: 'https://tr.designtokens.org/format/',
    neutral: {
      $description: `13-step neutral scale. Hue=${options.hue}, chroma=${options.chroma}. GENERATED -- do not edit manually.`,
      ...neutral,
    },
  };

  await writeFile(
    'primitive/neutral.tokens.json',
    JSON.stringify(output, null, 2),
  );

  console.log(`  OK Generated ${scale.length}-step neutral scale (hue=${options.hue}, chroma=${options.chroma})`);
}

// ---- Helpers ---------------------------------------------------------------

function round(n: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(n * factor) / factor;
}

// ---- Validation ------------------------------------------------------------

/**
 * Validate a generated scale against a hex reference.
 * Returns per-step delta L for each of the 13 steps.
 */
export function validateAgainstReference(
  scale: NeutralScaleStep[],
  referenceHexes: string[],
): Array<{ step: number; generatedHex: string; referenceHex: string; deltaL: number }> {
  return scale.map((step, i) => {
    const ref = referenceHexes[i];
    if (!ref) return { step: i, generatedHex: step.hex, referenceHex: 'N/A', deltaL: 0 };

    const refOklch = hexToOklch(ref);
    return {
      step: i,
      generatedHex: step.hex,
      referenceHex: ref,
      deltaL: Math.abs(step.L - refOklch.L),
    };
  });
}
