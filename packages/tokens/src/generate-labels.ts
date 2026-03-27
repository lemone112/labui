/**
 * generate-labels.ts — WCAG-compliant Label Color Generator for Lab UI v3
 *
 * Generates accessible text (label) colors from accent colors using
 * L-correction with hue shift. The core algorithm performs binary search
 * on OKLCH lightness to find the closest color to the accent that still
 * meets a WCAG contrast threshold against the given background.
 *
 * @module generate-labels
 */

import {
  type OklchColor,
  gamutClampSrgb,
  contrastRatio,
} from "./color-utils.js";
import { applyHueShift } from "./hue-shift.js";

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
  /** Whether the hue was shifted during L-correction. */
  hueShifted: boolean;
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

/** Maximum binary search iterations to prevent infinite loops. */
const MAX_ITERATIONS = 15;

/** Epsilon for floating-point hue comparison. */
const HUE_SHIFT_EPSILON = 0.01;

// ─── Core algorithm ─────────────────────────────────────────────────────────

/**
 * Correct an accent color's lightness to meet a WCAG contrast target
 * against a given background. Uses binary search on L with hue shift
 * compensation and proportional chroma reduction.
 *
 * Algorithm:
 * 1. Determine search direction based on background lightness.
 * 2. Binary search on L (max 15 iterations).
 * 3. At each step, apply hue shift and reduce chroma proportionally.
 * 4. Gamut-clamp the candidate to sRGB.
 * 5. If threshold is met, narrow toward the accent (preserve color).
 *    Otherwise narrow away (increase contrast).
 * 6. Fallback to near-black/white if convergence fails.
 */
export function correctLabelColor(ctx: LabelContext): LabelResult {
  const { accent, background, contrastTarget } = ctx;
  const bgL = background.L;
  const originalL = accent.L;
  const originalH = accent.H;

  // Determine direction: light bg → darken, dark bg → lighten
  const lightenLabel = bgL <= 0.5;

  // Check if accent already meets contrast
  const accentClamped = gamutClampSrgb(accent);
  const accentContrast = contrastRatio(accentClamped, background);
  if (accentContrast >= contrastTarget) {
    return {
      color: accentClamped,
      contrastAchieved: accentContrast,
      hueShifted: false,
    };
  }

  // Binary search bounds
  let low: number;
  let high: number;

  if (lightenLabel) {
    // Dark background → search upward from accent L toward 1
    low = originalL;
    high = 1;
  } else {
    // Light background → search downward from accent L toward 0
    low = 0;
    high = originalL;
  }

  let bestColor: OklchColor = accentClamped;
  let bestContrast = accentContrast;
  let hueShifted = false;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const midL = (low + high) / 2;

    // Apply hue shift for lightness change
    const newH = applyHueShift(originalH, originalL, midL);

    // Track whether hue actually shifted
    if (Math.abs(newH - originalH) > HUE_SHIFT_EPSILON) {
      hueShifted = true;
    }

    // Proportional chroma reduction as L moves away from original
    const chromaScale = 1 - Math.abs(midL - originalL) * 0.3;
    const newC = accent.C * Math.max(0, chromaScale);

    // Gamut clamp the candidate
    const candidate = gamutClampSrgb({ L: midL, C: newC, H: newH });

    const cr = contrastRatio(candidate, background);

    if (cr >= contrastTarget) {
      // Meets threshold — record and narrow toward accent (preserve color)
      bestColor = candidate;
      bestContrast = cr;

      if (lightenLabel) {
        // We want to find the lowest L that still meets contrast (closest to accent)
        high = midL;
      } else {
        // We want the highest L that still meets contrast (closest to accent)
        low = midL;
      }
    } else {
      // Doesn't meet threshold — narrow away from accent (increase contrast)
      if (lightenLabel) {
        low = midL;
      } else {
        high = midL;
      }
    }
  }

  // If binary search found a valid color, return it
  if (bestContrast >= contrastTarget) {
    return {
      color: bestColor,
      contrastAchieved: bestContrast,
      hueShifted,
    };
  }

  // Fallback: near-black for light bg, near-white for dark bg
  const fallback: OklchColor = lightenLabel
    ? { L: 0.95, C: 0, H: 0 }
    : { L: 0.1, C: 0, H: 0 };

  const fallbackClamped = gamutClampSrgb(fallback);
  const fallbackContrast = contrastRatio(fallbackClamped, background);

  return {
    color: fallbackClamped,
    contrastAchieved: fallbackContrast,
    hueShifted: false,
  };
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
