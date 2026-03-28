/**
 * convert-units.ts — Dimension unit conversion for Lab UI v3
 *
 * Converts px-based dimension tokens from Figma to rem for the web output.
 * Preserves px for values that must stay absolute (border-width, shadow offsets/blur).
 *
 * @module convert-units
 */

import { config } from './tokens.config.js';

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Convert a pixel value to rem.
 *
 * @param px   - Value in pixels
 * @param base - Base font-size (defaults to config.baseFontSize = 16)
 * @returns CSS rem string, e.g. "1.5rem". Returns "0" for zero.
 */
export function pxToRem(px: number, base: number = config.baseFontSize): string {
  if (px === 0) return '0';
  const rem = px / base;
  // Round to 4 decimal places to avoid floating-point noise
  const rounded = Math.round(rem * 10000) / 10000;
  return `${rounded}rem`;
}

/**
 * Categories of dimension tokens that SHOULD be converted to rem.
 * Everything else stays in px (border-width, shadow blur/offset, etc.).
 */
const REM_CATEGORIES = new Set([
  'spacing',
  'size',
  'sizing',
  'radius',
  'font-size',
  'line-height',
  'padding',
  'margin',
  'gap',
]);

/**
 * Categories that must NEVER be converted — stay in px.
 */
const PX_ONLY_CATEGORIES = new Set([
  'border-width',
  'border',
  'shadow',
  'blur',
  'offset',
  'spread',
  'box-shadow',
]);

// ─── Token tree walker ───────────────────────────────────────────────────────

interface DtcgToken {
  $value: string;
  $type: string;
  [key: string]: unknown;
}

function isDtcgToken(obj: unknown): obj is DtcgToken {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    '$value' in obj &&
    '$type' in obj
  );
}

/**
 * Parse a px value from a DTCG token $value string.
 * Returns null if the value is not a simple px value.
 */
function parsePxValue(value: string): number | null {
  const match = value.match(/^(-?[\d.]+)px$/);
  if (!match) return null;
  return parseFloat(match[1]);
}

/**
 * Determine if a token at a given path should be converted to rem.
 * Uses the path segments to infer the category.
 */
function shouldConvertToRem(pathSegments: string[]): boolean {
  const lowerPath = pathSegments.map(s => s.toLowerCase());

  // Explicit exclusion check first
  for (const segment of lowerPath) {
    if (PX_ONLY_CATEGORIES.has(segment)) return false;
  }

  // Inclusion check
  for (const segment of lowerPath) {
    if (REM_CATEGORIES.has(segment)) return true;
  }

  // Default: convert dimension tokens to rem unless excluded
  return true;
}

/**
 * Walk a DTCG token tree and convert $type: "dimension" values from px to rem.
 *
 * Applies to: spacing, sizing, radius, font-size, line-height
 * Does NOT apply to: border-width, box-shadow blur/offset (stay in px)
 *
 * @param tokens - DTCG token tree (nested object)
 * @param base   - Base font-size for rem calculation
 * @returns New token tree with converted values (does not mutate input)
 */
export function convertDimensionTokens(
  tokens: Record<string, unknown>,
  base: number = config.baseFontSize,
): Record<string, unknown> {
  return walkAndConvert(tokens, [], base);
}

function walkAndConvert(
  obj: Record<string, unknown>,
  path: string[],
  base: number,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    // Skip DTCG meta keys at the group level
    if (key.startsWith('$') && !isDtcgToken(obj)) {
      result[key] = value;
      continue;
    }

    if (isDtcgToken(value)) {
      // It is a leaf token
      if (value.$type === 'dimension' && typeof value.$value === 'string') {
        const px = parsePxValue(value.$value);
        if (px !== null && shouldConvertToRem([...path, key])) {
          result[key] = {
            ...value,
            $value: pxToRem(px, base),
          };
          continue;
        }
      }
      // Not a dimension or not px — pass through unchanged
      result[key] = { ...value };
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Recurse into nested groups
      result[key] = walkAndConvert(
        value as Record<string, unknown>,
        [...path, key],
        base,
      );
    } else {
      // Primitive value — pass through
      result[key] = value;
    }
  }

  return result;
}
