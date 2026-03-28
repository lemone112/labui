/**
 * tokens.config.ts — Central configuration for Lab UI v3 token pipeline
 *
 * Single source of truth for brand color, base sizing, Figma token paths,
 * and opacity scale. All generators and the build pipeline import from here.
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const config = {
  /** Primary brand color (HEX). Drives the entire accent palette. */
  brandColor: '#007AFF',

  /** Base font-size in px. Used by pxToRem conversion. */
  baseFontSize: 16,

  /**
   * Path to the Token Studio export directory (relative to tokens package root).
   * This is where Figma Token Studio dumps its JSON sets.
   */
  figmaTokensPath: join(__dirname, '..', 'figma-tokens'),

  /**
   * 9-stop opacity scale. Maps to alpha variant generation.
   * Each value represents a percentage (0-100) converted to 0-1 at build time.
   */
  opacityStops: [2, 4, 8, 12, 20, 32, 52, 72, 80] as const,

  /**
   * Neutral hue and chroma derived from brand. Can be overridden.
   * Default: cool-purple tint for neutrals.
   */
  neutralHue: 283,
  neutralChroma: 0.012,
};

export type TokensConfig = typeof config;
