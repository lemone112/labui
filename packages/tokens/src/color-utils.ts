/**
 * color-utils.ts — Pure Color Engine for Lab UI v3
 *
 * Foundational color utility module providing all OKLCH color space operations.
 * Uses @texel/color internally for accurate conversions and gamut mapping.
 */

import {
  convert,
  parse,
  OKLCH,
  sRGB,
  sRGBLinear,
  sRGBGamut,
  DisplayP3Linear,
  DisplayP3Gamut,
  gamutMapOKLCH,
  isRGBInGamut,
  vec3,
  RGBToHex,
  MapToL,
} from "@texel/color";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface OklchColor {
  /** Lightness: 0–1 */
  L: number;
  /** Chroma: 0–~0.4 */
  C: number;
  /** Hue: 0–360 degrees */
  H: number;
}

// ─── Internal helpers ───────────────────────────────────────────────────────

/** Convert our OklchColor struct to @texel/color's [L, C, H] vector */
function toVec(color: OklchColor): number[] {
  return [color.L, color.C, color.H];
}

/** Convert @texel/color's [L, C, H] vector to our OklchColor struct */
function fromVec(vec: number[]): OklchColor {
  return { L: vec[0], C: vec[1], H: vec[2] };
}

// ─── Conversion functions ───────────────────────────────────────────────────

/**
 * Convert a hex color (#RRGGBB) to OKLCH.
 */
export function hexToOklch(hex: string): OklchColor {
  const oklch = parse(hex, OKLCH);
  return fromVec(oklch);
}

/**
 * Convert an OKLCH color to hex (#rrggbb), with sRGB gamut clamping.
 */
export function oklchToHex(color: OklchColor): string {
  // Use gamut mapping to clamp to sRGB, output in sRGB space
  const rgb = gamutMapOKLCH(toVec(color), sRGBGamut, sRGB);
  return RGBToHex(rgb);
}

// ─── CSS formatting ─────────────────────────────────────────────────────────

/**
 * Format an OKLCH color as a CSS `oklch(L C H)` string.
 * L and C are rounded to 3 decimal places, H to integer.
 */
export function oklchToCss(color: OklchColor): string {
  const L = color.L.toFixed(3);
  const C = color.C.toFixed(3);
  const H = Math.round(color.H);
  return `oklch(${L} ${C} ${H})`;
}

/**
 * Format an OKLCH color as a CSS `oklch(L C H / alpha)` string.
 */
export function oklchToCssAlpha(color: OklchColor, alpha: number): string {
  const L = color.L.toFixed(3);
  const C = color.C.toFixed(3);
  const H = Math.round(color.H);
  return `oklch(${L} ${C} ${H} / ${alpha})`;
}

// ─── Gamut mapping ──────────────────────────────────────────────────────────

/**
 * Clamp an OKLCH color to the sRGB gamut using @texel/color's
 * Ottosson cusp-based gamut mapping. Reduces chroma while preserving
 * hue and lightness.
 */
export function gamutClampSrgb(color: OklchColor): OklchColor {
  // gamutMapOKLCH with MapToL preserves lightness, reduces chroma
  const mapped = gamutMapOKLCH(toVec(color), sRGBGamut, OKLCH, vec3(), MapToL);
  return fromVec(mapped);
}

/**
 * Clamp an OKLCH color to the Display P3 gamut.
 */
export function gamutClampP3(color: OklchColor): OklchColor {
  const mapped = gamutMapOKLCH(
    toVec(color),
    DisplayP3Gamut,
    OKLCH,
    vec3(),
    MapToL,
  );
  return fromVec(mapped);
}

/**
 * Check if an OKLCH color is within the specified gamut.
 */
export function isInGamut(color: OklchColor, gamut: "srgb" | "p3"): boolean {
  const linearSpace = gamut === "srgb" ? sRGBLinear : DisplayP3Linear;
  const linearRgb = convert(toVec(color), OKLCH, linearSpace);
  // Use a small epsilon to handle floating-point precision at gamut boundaries
  return isRGBInGamut(linearRgb, 1e-6);
}

// ─── Luminance & contrast ───────────────────────────────────────────────────

/**
 * Compute relative luminance (Y) per WCAG spec.
 * Converts OKLCH -> linear sRGB -> Y using standard coefficients.
 */
export function relativeLuminance(color: OklchColor): number {
  // Convert to linear sRGB (values are already linear, no gamma)
  const linear = convert(toVec(color), OKLCH, sRGBLinear);
  // Clamp to 0-1 to handle minor floating point issues
  const r = Math.max(0, Math.min(1, linear[0]));
  const g = Math.max(0, Math.min(1, linear[1]));
  const b = Math.max(0, Math.min(1, linear[2]));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * WCAG 2.x contrast ratio between two OKLCH colors.
 * Returns (L_lighter + 0.05) / (L_darker + 0.05).
 */
export function contrastRatio(fg: OklchColor, bg: OklchColor): number {
  const lumFg = relativeLuminance(fg);
  const lumBg = relativeLuminance(bg);
  const lighter = Math.max(lumFg, lumBg);
  const darker = Math.min(lumFg, lumBg);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Convenience: check if contrast ratio meets the given threshold.
 */
export function meetsContrast(
  fg: OklchColor,
  bg: OklchColor,
  threshold: number,
): boolean {
  return contrastRatio(fg, bg) >= threshold;
}
