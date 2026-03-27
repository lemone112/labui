/**
 * generate-accents.ts — Accent Generator for Lab UI v3
 *
 * Generates brand variants, harmonizes sentiment chromas with brand,
 * and creates decorative colors. All operations in OKLCH color space.
 *
 * @module generate-accents
 */

import {
  hexToOklch,
  oklchToCss,
  oklchToHex,
  gamutClampSrgb,
  contrastRatio,
  type OklchColor,
} from "./color-utils.js";
import { applyHueShift } from "./hue-shift.js";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AccentConfig {
  /** HEX input e.g. '#007AFF' */
  brand: string;
  /** 'auto' = derive from brand hue, or manual 0-360 */
  neutralHue?: "auto" | number;
  /** Default 0.012 */
  neutralChroma?: number;
  /** Number of decorative colors to generate. Default 5 */
  decorativeCount?: number;
}

export interface AccentVariant {
  light: OklchColor;
  dark: OklchColor;
  lightIc: OklchColor;
  darkIc: OklchColor;
}

export interface GeneratedAccents {
  brand: AccentVariant;
  sentiments: Record<
    "danger" | "warning" | "success" | "info",
    AccentVariant
  >;
  decoratives: Array<{ name: string; variant: AccentVariant }>;
  neutralHue: number;
  neutralChroma: number;
}

// ─── Constants ──────────────────────────────────────────────────────────────

/** White and black reference for contrast checks */
const WHITE: OklchColor = { L: 1, C: 0, H: 0 };
const BLACK: OklchColor = { L: 0, C: 0, H: 0 };

/** Chroma floor — sentiments never go below this */
const C_FLOOR = 0.08;

/** Reference chroma from Figma spec (brand #007AFF) used for harmonization ratio */
const C_REFERENCE = 0.218;

/** Figma reference bases for sentiments */
const SENTIMENT_BASES = {
  danger: {
    light: { L: 0.63, C: 0.23, H: 29 },
    dark: { L: 0.63, C: 0.23, H: 29 },
    lightIc: { L: 0.52, C: 0.24, H: 29 },
    darkIc: { L: 0.72, C: 0.20, H: 29 },
  },
  warning: {
    light: { L: 0.78, C: 0.17, H: 69 },
    dark: { L: 0.75, C: 0.18, H: 60 },
    lightIc: { L: 0.62, C: 0.18, H: 55 },
    darkIc: { L: 0.78, C: 0.17, H: 60 },
  },
  success: {
    light: { L: 0.73, C: 0.19, H: 147 },
    dark: { L: 0.72, C: 0.19, H: 150 },
    lightIc: { L: 0.58, C: 0.17, H: 147 },
    darkIc: { L: 0.74, C: 0.18, H: 150 },
  },
  info: {
    light: { L: 0.64, C: 0.19, H: 260 },
    dark: { L: 0.70, C: 0.16, H: 257 },
    lightIc: { L: 0.47, C: 0.22, H: 263 },
    darkIc: { L: 0.76, C: 0.14, H: 253 },
  },
} as const;

/** Canonical sentiment hues for collision checking */
const SENTIMENT_HUES = [29, 69, 147, 260];

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Normalize hue to [0, 360) */
function normalizeHue(h: number): number {
  const n = h % 360;
  return n < 0 ? n + 360 : n;
}

/** Circular distance between two hues, result in [0, 180] */
function hueDistance(h1: number, h2: number): number {
  const d = Math.abs(h1 - h2) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * Adjust lightness to meet a minimum contrast ratio against a background.
 * Moves L in the specified direction until contrast is met or L is clamped.
 */
function ensureContrast(
  color: OklchColor,
  bg: OklchColor,
  minRatio: number,
  direction: "lighter" | "darker",
): OklchColor {
  let current = { ...color };
  const step = direction === "lighter" ? 0.01 : -0.01;
  const limit = direction === "lighter" ? 1 : 0;

  for (let i = 0; i < 100; i++) {
    if (contrastRatio(current, bg) >= minRatio) {
      return current;
    }
    const newL = current.L + step;
    if ((direction === "lighter" && newL > limit) || (direction === "darker" && newL < limit)) {
      break;
    }
    current = { ...current, L: Math.max(0, Math.min(1, newL)) };
  }
  return current;
}

/**
 * Generate all four variants (light, dark, lightIc, darkIc) for a given base color.
 */
function generateVariants(base: OklchColor): AccentVariant {
  // light: as-is, gamut clamped
  const light = gamutClampSrgb(base);

  // dark: L + 0.15, hue shifted, gamut clamped
  const darkL = Math.min(1, base.L + 0.15);
  const darkH = applyHueShift(base.H, base.L, darkL);
  const dark = gamutClampSrgb({ L: darkL, C: base.C, H: darkH });

  // lightIc: L - 0.15, hue shifted, contrast >= 7:1 vs white, gamut clamped
  const lightIcL = Math.max(0, base.L - 0.15);
  const lightIcH = applyHueShift(base.H, base.L, lightIcL);
  let lightIcColor: OklchColor = { L: lightIcL, C: base.C, H: lightIcH };
  lightIcColor = ensureContrast(lightIcColor, WHITE, 7, "darker");
  const lightIc = gamutClampSrgb(lightIcColor);

  // darkIc: L + 0.25, hue shifted, contrast >= 7:1 vs black, gamut clamped
  const darkIcL = Math.min(1, base.L + 0.25);
  const darkIcH = applyHueShift(base.H, base.L, darkIcL);
  let darkIcColor: OklchColor = { L: darkIcL, C: base.C, H: darkIcH };
  darkIcColor = ensureContrast(darkIcColor, BLACK, 7, "lighter");
  const darkIc = gamutClampSrgb(darkIcColor);

  return { light, dark, lightIc, darkIc };
}

/**
 * Harmonize a sentiment chroma value with the brand chroma.
 * C_new = max(C_brand * (C_figma / C_REFERENCE), C_FLOOR)
 */
function harmonizeChroma(brandC: number, figmaC: number): number {
  return Math.max(brandC * (figmaC / C_REFERENCE), C_FLOOR);
}

/**
 * Check if a hue collides with any sentiment hue (within 30 degrees).
 */
function collidesWithSentiment(hue: number): boolean {
  return SENTIMENT_HUES.some((sh) => hueDistance(hue, sh) < 30);
}

// ─── Main generator ─────────────────────────────────────────────────────────

/**
 * Generate accent colors from a brand hex color.
 *
 * Pipeline:
 * 1. Convert brand HEX to OKLCH
 * 2. Generate brand variants (light/dark/lightIc/darkIc)
 * 3. Harmonize sentiment chromas with brand chroma
 * 4. Generate decorative colors by hue rotation
 * 5. Compute neutral parameters
 */
export function generateAccents(config: AccentConfig): GeneratedAccents {
  const brandOklch = hexToOklch(config.brand);
  const decorativeCount = config.decorativeCount ?? 5;

  // ── Brand variants ──
  const brand = generateVariants(brandOklch);

  // ── Sentiment variants ──
  const sentimentKeys = ["danger", "warning", "success", "info"] as const;
  const sentiments = {} as Record<
    "danger" | "warning" | "success" | "info",
    AccentVariant
  >;

  for (const key of sentimentKeys) {
    const bases = SENTIMENT_BASES[key];
    const variants: Record<string, OklchColor> = {};

    for (const variant of ["light", "dark", "lightIc", "darkIc"] as const) {
      const figmaBase = bases[variant];
      const newC = harmonizeChroma(brandOklch.C, figmaBase.C);
      // Hue stays canonical (from Figma reference), only chroma adapts
      variants[variant] = gamutClampSrgb({
        L: figmaBase.L,
        C: newC,
        H: figmaBase.H,
      });
    }

    sentiments[key] = {
      light: variants.light,
      dark: variants.dark,
      lightIc: variants.lightIc,
      darkIc: variants.darkIc,
    };
  }

  // ── Decorative colors ──
  const decoratives: Array<{ name: string; variant: AccentVariant }> = [];
  let decorativeIndex = 1;

  // Use golden angle (~137.508) for optimal hue distribution.
  // This ensures even spacing regardless of starting hue and sentiment collisions.
  const GOLDEN_ANGLE = 137.508;
  let candidateNum = 0;
  const maxAttempts = decorativeCount * 10;

  while (decoratives.length < decorativeCount && candidateNum < maxAttempts) {
    candidateNum++;
    const candidateHue = normalizeHue(brandOklch.H + GOLDEN_ANGLE * candidateNum);

    // Skip if too close to brand hue
    if (hueDistance(candidateHue, brandOklch.H) < 20) {
      continue;
    }

    // Skip if too close to any sentiment hue
    if (collidesWithSentiment(candidateHue)) {
      continue;
    }

    // Skip if too close to an already-selected decorative hue
    const tooCloseToExisting = decoratives.some(
      (d) => hueDistance(d.variant.light.H, candidateHue) < 20,
    );
    if (tooCloseToExisting) {
      continue;
    }

    const decorativeBase: OklchColor = {
      L: brandOklch.L,
      C: brandOklch.C,
      H: candidateHue,
    };

    decoratives.push({
      name: `decorative-${decorativeIndex}`,
      variant: generateVariants(decorativeBase),
    });
    decorativeIndex++;
  }

  // ── Neutral params ──
  const neutralHue =
    config.neutralHue === "auto" || config.neutralHue === undefined
      ? brandOklch.H
      : config.neutralHue;
  const neutralChroma = config.neutralChroma ?? 0.012;

  return {
    brand,
    sentiments,
    decoratives,
    neutralHue,
    neutralChroma,
  };
}

// ─── Token writer (placeholder) ─────────────────────────────────────────────

/**
 * Generate accent tokens and write DTCG JSON to primitive/hue.tokens.json.
 *
 * Calls generateAccents() internally and formats the output as
 * Design Token Community Group (DTCG) JSON.
 */
export async function generateAccentTokens(
  config: AccentConfig,
): Promise<void> {
  const accents = generateAccents(config);

  const formatVariant = (variant: AccentVariant) => ({
    light: {
      $type: "color",
      $value: oklchToCss(variant.light),
      $extensions: { oklch: variant.light, hex: oklchToHex(variant.light) },
    },
    dark: {
      $type: "color",
      $value: oklchToCss(variant.dark),
      $extensions: { oklch: variant.dark, hex: oklchToHex(variant.dark) },
    },
    "light-ic": {
      $type: "color",
      $value: oklchToCss(variant.lightIc),
      $extensions: { oklch: variant.lightIc, hex: oklchToHex(variant.lightIc) },
    },
    "dark-ic": {
      $type: "color",
      $value: oklchToCss(variant.darkIc),
      $extensions: { oklch: variant.darkIc, hex: oklchToHex(variant.darkIc) },
    },
  });

  const tokens: Record<string, unknown> = {
    hue: {
      brand: formatVariant(accents.brand),
      ...Object.fromEntries(
        Object.entries(accents.sentiments).map(([key, variant]) => [
          key,
          formatVariant(variant),
        ]),
      ),
      ...Object.fromEntries(
        accents.decoratives.map(({ name, variant }) => [
          name,
          formatVariant(variant),
        ]),
      ),
      $extensions: {
        neutralHue: accents.neutralHue,
        neutralChroma: accents.neutralChroma,
      },
    },
  };

  const { writeFile, mkdir } = await import("node:fs/promises");
  const { join, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const outDir = join(__dirname, "..", "primitive");
  await mkdir(outDir, { recursive: true });
  const outPath = join(outDir, "hue.tokens.json");

  await writeFile(outPath, JSON.stringify(tokens, null, 2) + "\n", "utf-8");
}
