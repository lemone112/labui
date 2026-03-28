/**
 * generate-labels.ts — WCAG-compliant Label Color Generator for Lab UI v3
 *
 * Generates accessible text (label) colors from accent colors using
 * a fixed tone-pair approach. Sets a target lightness based on background
 * brightness, gamut-clamps the candidate, and verifies contrast.
 *
 * @module generate-labels
 */

import {
  type OklchColor,
  gamutClampSrgb,
  contrastRatio,
} from "./color-utils.js";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface LabelContext {
  /** The accent color to derive a label from. */
  accent: OklchColor;
  /** The background color the label will sit on. */
  background: OklchColor;
  /** Minimum WCAG contrast ratio to achieve (e.g. 3.0, 4.5, 7.0). */
  contrastTarget: number;
}

export interface LabelResult {
  /** The corrected label color in OKLCH. */
  color: OklchColor;
  /** The actual contrast ratio achieved against the background. */
  contrastAchieved: number;
}

export interface LabelLadder {
  /** 100% opacity of the corrected color. */
  primary: { color: OklchColor; alpha: number };
  /** Same color at 72% opacity. */
  secondary: { color: OklchColor; alpha: number };
  /** Same color at 52% opacity. */
  tertiary: { color: OklchColor; alpha: number };
  /** Same color at 32% opacity. */
  quaternary: { color: OklchColor; alpha: number };
}

// ─── Constants ──────────────────────────────────────────────────────────────

/** High-contrast threshold — targets above this use deeper L offsets. */
const HIGH_CONTRAST_THRESHOLD = 4.5;

/** Maximum L-shift steps toward black/white before fallback. */
const MAX_SHIFT_STEPS = 3;

/** L-shift increment per step. */
const L_SHIFT_STEP = 0.05;

// ─── Core algorithm ─────────────────────────────────────────────────────────

/**
 * Correct an accent color's lightness to meet a WCAG contrast target
 * against a given background using a fixed tone-pair approach.
 *
 * Algorithm:
 * 1. Check if accent already meets contrast — return as-is.
 * 2. Set target L based on background brightness:
 *    - Light bg: darken to L=0.45 (or 0.35 for high contrast).
 *    - Dark bg:  lighten to L=0.75 (or 0.85 for high contrast).
 * 3. Gamut-clamp the candidate, preserving hue and chroma.
 * 4. Verify contrast. If it fails, shift L by 0.05 toward
 *    black/white (max 3 steps).
 * 5. Fallback to near-black/near-white if all steps fail.
 */
export function correctLabelColor(ctx: LabelContext): LabelResult {
  const { accent, background, contrastTarget } = ctx;
  const bgL = background.L;

  const highContrast = contrastTarget >= HIGH_CONTRAST_THRESHOLD;

  // Check if accent already meets contrast
  const accentClamped = gamutClampSrgb(accent);
  const accentContrast = contrastRatio(accentClamped, background);
  if (accentContrast >= contrastTarget) {
    return {
      color: accentClamped,
      contrastAchieved: accentContrast,

    };
  }

  // Try both light and dark candidates to pick the better one
  const darkTargetL = highContrast ? 0.35 : 0.45;
  const lightTargetL = highContrast ? 0.85 : 0.75;

  const darkCandidate = gamutClampSrgb({ L: darkTargetL, C: accent.C, H: accent.H });
  const lightCandidate = gamutClampSrgb({ L: lightTargetL, C: accent.C, H: accent.H });

  const darkCr = contrastRatio(darkCandidate, background);
  const lightCr = contrastRatio(lightCandidate, background);

  // Pick the candidate that meets the target (prefer expected polarity if both meet)
  const preferLight = bgL <= 0.5; // dark bg prefers light text

  if (darkCr >= contrastTarget && lightCr >= contrastTarget) {
    // Both meet target - prefer expected polarity
    const chosen = preferLight ? lightCandidate : darkCandidate;
    const chosenCr = preferLight ? lightCr : darkCr;
    return {
      color: chosen,
      contrastAchieved: chosenCr,

    };
  } else if (darkCr >= contrastTarget) {
    return {
      color: darkCandidate,
      contrastAchieved: darkCr,

    };
  } else if (lightCr >= contrastTarget) {
    return {
      color: lightCandidate,
      contrastAchieved: lightCr,

    };
  }

  // Neither meets target - try refinement steps for the better candidate
  const betterIsLight = lightCr > darkCr;
  const baseL = betterIsLight ? lightTargetL : darkTargetL;
  const shiftDirection = betterIsLight ? 1 : -1; // lighten or darken

  for (let step = 1; step <= MAX_SHIFT_STEPS; step++) {
    const shiftedL = baseL + step * L_SHIFT_STEP * shiftDirection;

    const shifted = gamutClampSrgb({ L: shiftedL, C: accent.C, H: accent.H });
    const shiftedCr = contrastRatio(shifted, background);

    if (shiftedCr >= contrastTarget) {
      return {
        color: shifted,
        contrastAchieved: shiftedCr,
  
      };
    }
  }

  // Fallback: try both near-black and near-white, pick better
  const darkFallback = gamutClampSrgb({ L: 0.1, C: 0, H: 0 });
  const lightFallback = gamutClampSrgb({ L: 0.95, C: 0, H: 0 });

  const darkFallbackCr = contrastRatio(darkFallback, background);
  const lightFallbackCr = contrastRatio(lightFallback, background);

  if (darkFallbackCr >= lightFallbackCr) {
    return {
      color: darkFallback,
      contrastAchieved: darkFallbackCr,

    };
  } else {
    return {
      color: lightFallback,
      contrastAchieved: lightFallbackCr,

    };
  }
}

// ─── Label ladder ───────────────────────────────────────────────────────────

/**
 * Generate a 4-level opacity ladder from a corrected label color.
 *
 * - primary:    100% (alpha = 1.0)
 * - secondary:  72%  (alpha = 0.72)
 * - tertiary:   52%  (alpha = 0.52)
 * - quaternary: 32%  (alpha = 0.32)
 */
export function generateLabelLadder(correctedColor: OklchColor): LabelLadder {
  return {
    primary: { color: correctedColor, alpha: 1.0 },
    secondary: { color: correctedColor, alpha: 0.72 },
    tertiary: { color: correctedColor, alpha: 0.52 },
    quaternary: { color: correctedColor, alpha: 0.32 },
  };
}

// ─── On-solid label ─────────────────────────────────────────────────────────

/**
 * Generate a label color for text on a solid accent background (e.g. buttons).
 *
 * - Light solid backgrounds (L > 0.6) get near-black text.
 * - Dark solid backgrounds (L <= 0.6) get near-white text.
 * - The result is verified to meet 4.5:1 contrast; adjusted if needed.
 */
export function generateOnSolidLabel(solidBg: OklchColor): OklchColor {
  // Try both near-black and near-white, pick the one with higher contrast
  const darkLabel: OklchColor = { L: 0, C: 0, H: 0 };
  const lightLabel: OklchColor = { L: 1, C: 0, H: 0 };

  const darkCr = contrastRatio(gamutClampSrgb(darkLabel), solidBg);
  const lightCr = contrastRatio(gamutClampSrgb(lightLabel), solidBg);

  // Prefer the expected direction based on bg lightness, but override
  // if it doesn't meet 4.5:1 and the other direction does
  const isLight = solidBg.L > 0.6;

  if (isLight) {
    // Prefer dark text on light bg
    const preferred: OklchColor = { L: 0.1, C: 0, H: 0 };
    const cr = contrastRatio(gamutClampSrgb(preferred), solidBg);
    if (cr >= 4.5) return gamutClampSrgb(preferred);
    // Fallback to pure black
    if (darkCr >= 4.5) return gamutClampSrgb(darkLabel);
    // Last resort: use whichever has higher contrast
    return gamutClampSrgb(darkCr >= lightCr ? darkLabel : lightLabel);
  } else {
    // Prefer light text on dark bg
    const preferred: OklchColor = { L: 0.98, C: 0, H: 0 };
    const cr = contrastRatio(gamutClampSrgb(preferred), solidBg);
    if (cr >= 4.5) return gamutClampSrgb(preferred);
    // Fallback to pure white
    if (lightCr >= 4.5) return gamutClampSrgb(lightLabel);
    // Last resort: use whichever has higher contrast
    return gamutClampSrgb(lightCr >= darkCr ? lightLabel : darkLabel);
  }
}