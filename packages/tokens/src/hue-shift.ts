/**
 * Hue Shift Engine for Lab UI Color Architecture v3
 *
 * @experimental This module implements hue compensation to prevent color
 * muddiness when adjusting lightness. It counteracts the Bezold-Brucke
 * perceptual effect, where hues appear to shift toward yellow or blue
 * as luminance changes.
 *
 * The shift zones and magnitudes are empirically tuned and may change
 * in future versions.
 *
 * @module hue-shift
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Defines a hue region where perceptual shift compensation is applied. */
export interface HueShiftZone {
  /** Center of the zone (degrees, 0-360). */
  centerHue: number;
  /** Shift direction: -1 (decrease H) or +1 (increase H). */
  direction: number;
  /** Maximum shift in degrees at full strength. */
  maxShift: number;
  /** Zone width for Gaussian falloff (degrees). */
  width: number;
}

// ---------------------------------------------------------------------------
// Default zones
// ---------------------------------------------------------------------------

/**
 * Predefined hue shift zones targeting the most perceptually vulnerable
 * regions of the OKLCH hue wheel.
 *
 * @experimental Zone parameters are subject to tuning.
 */
export const DEFAULT_HUE_SHIFT_ZONES: HueShiftZone[] = [
  { centerHue: 90,  direction: -1, maxShift: 18, width: 30 }, // Yellow -> orange
  { centerHue: 195, direction:  1, maxShift: 15, width: 25 }, // Cyan -> blue
  { centerHue: 115, direction:  1, maxShift: 12, width: 25 }, // Lime -> green
  { centerHue: 65,  direction: -1, maxShift:  8, width: 20 }, // Orange -> red
  { centerHue: 25,  direction: -1, maxShift:  8, width: 20 }, // Red -> magenta
  { centerHue: 142, direction:  1, maxShift:  6, width: 20 }, // Green -> teal
  { centerHue: 264, direction:  1, maxShift:  5, width: 20 }, // Blue
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Circular distance between two hue angles (0-360), always non-negative.
 * Result is in the range [0, 180].
 */
function circularDistance(h1: number, h2: number): number {
  const d = Math.abs(h1 - h2) % 360;
  return d > 180 ? 360 - d : d;
}

/** Normalize a hue value to [0, 360). */
function normalizeHue(h: number): number {
  const n = h % 360;
  return n < 0 ? n + 360 : n;
}

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Compute the hue shift (in degrees) needed to compensate for a lightness
 * change.
 *
 * @experimental Algorithm and zone parameters may change.
 *
 * @param hue      Original hue in degrees (0-360).
 * @param deltaL   Lightness change: L_new - L_original (can be negative).
 * @param zones    Shift zones to evaluate (defaults to {@link DEFAULT_HUE_SHIFT_ZONES}).
 * @returns Hue shift in degrees (positive or negative). Returns 0 when
 *          no zone is close enough (weight below 0.01 threshold).
 */
export function computeHueShift(
  hue: number,
  deltaL: number,
  zones: HueShiftZone[] = DEFAULT_HUE_SHIFT_ZONES,
): number {
  if (deltaL === 0) return 0;

  let bestWeight = 0;
  let bestZone: HueShiftZone | null = null;

  for (const zone of zones) {
    const dist = circularDistance(hue, zone.centerHue);
    const w = Math.exp(-0.5 * (dist / zone.width) ** 2);
    if (w > bestWeight) {
      bestWeight = w;
      bestZone = zone;
    }
  }

  if (bestWeight <= 0.01 || bestZone === null) return 0;

  // Power curve (0.7) makes shift stronger in deep darks.
  const shift =
    bestZone.direction *
    bestZone.maxShift *
    bestWeight *
    Math.abs(deltaL) ** 0.7;

  return shift;
}

/**
 * Convenience wrapper: computes the shifted hue for a lightness change.
 *
 * @experimental Uses {@link computeHueShift} internally.
 *
 * @param hue        Original hue (degrees).
 * @param originalL  Original lightness (0-1 in OKLCH).
 * @param targetL    Target lightness (0-1 in OKLCH).
 * @param zones      Optional custom zones.
 * @returns Adjusted hue, normalized to [0, 360).
 */
export function applyHueShift(
  hue: number,
  originalL: number,
  targetL: number,
  zones?: HueShiftZone[],
): number {
  const deltaL = targetL - originalL;
  const shift = computeHueShift(hue, deltaL, zones);
  return normalizeHue(hue + shift);
}
