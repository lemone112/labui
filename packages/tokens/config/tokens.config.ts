/**
 * Lab UI — master token config (phase 1.5 · colors v2).
 *
 * @governs implementation-plan-v2.md
 *
 * SINGLE SOURCE OF TRUTH for:
 *   - 13 neutral spine (pivot-mirror)
 *   - 11 accent spines (monotonic Hermite interp)
 *   - 2 statics (white / dark)
 *   - 29 opacity stops
 *   - perceptual compensation cells (Hunt/HK)
 *   - tier contrast targets (APCA Lc per tier × contrast)
 *   - semantic tree (backgrounds, labels, fills, borders, fx, misc)
 *   - progressive shadow presets (multi-layer)
 *
 * Architectural decisions locked in plan v2:
 *   1. Unified spine model — every accent tier is a solid spine-point,
 *      NO opacity-based tier derivation for labels/borders.
 *   2. Perceptual compensation between light/dark (accents subtly differ).
 *   3. Composition derivable — color + opacity stay independent; composed
 *      at resolution time, only for true-translucent semantics (glass,
 *      overlays, shadows, skeleton, focus, glow).
 *   4. Progressive shadows — XS..XL each = 1-4 drop-shadow layers.
 *   5. IC orthogonal to mode — 2 axes × 2 values = 4 outputs.
 *
 * When calibrating spines from Figma:
 *   - Primary accent anchor (L, C, H) at default brand hue maps to a
 *     spine point near the middle of the L range.
 *   - Dark-side and light-side control points extend the spine to cover
 *     all tier target L values. The spine is what tiers traverse.
 *
 * See plan §4.2 for per-accent spine calibration methodology.
 */

import type { TokensConfig } from '../src/types'

export const config: TokensConfig = {
  // Schema version — kept in lockstep with `package.json` major.minor.
  // Bump major on removed/renamed cells; bump minor on additive cells.
  // Guard G8 asserts (schema_major, schema_minor) == (pkg_major, pkg_minor).
  schema_version: '0.2.0',

  // Deprecation registry. Each entry keeps an old token path emitting
  // (with a CSS warning comment near the declaration) until `removed_in`
  // ships, at which point the G6 guard flips to asserting absence.
  // Empty today — lifecycle scaffolding for future renames.
  deprecated: {},

  colors: {
    gamut: 'p3',
    vibrancy: 1.0,

    // ─── Neutrals ─────────────────────────────────────────────────────
    // @governs plan §4.1. Base physical ladder generated once per contrast;
    // dark mode flips via pivot-mirror (step i → step 12-i).
    neutrals: {
      steps: 13,
      pivot_step: 6,
      hue: 247, // cool-blue bias
      endpoints_normal: { L0: 1.0, L12: 0.08 },
      endpoints_ic: { L0: 1.0, L12: 0.0 },
      chroma_curve: {
        peak: 0.008,
        peak_step: 6,
        falloff: 1.0,
        floor: 0.002,
      },
      hue_drift: {
        start_H: 247,
        end_H: 247,
        easing: 'linear',
      },
      lightness_curve: 'apple',
      // Calibrated against Figma Lab UI Color Guides (13 neutrals × 4
      // modes). Values are OKLCH L for the physical ladder in each
      // contrast; dark modes mirror automatically via `physIdx = steps-1-step`.
      // When this ladder is present the closed-form curve above is
      // ignored for L (chroma + hue still come from `chroma_curve` /
      // `hue_drift`). Drops PT2 max ΔE2000 from 16.3 (linear) to ~2.
      L_ladder: {
        normal: [
          1.0, 0.9789, 0.943, 0.851, 0.76, 0.6661, 0.5753, 0.4668, 0.3588,
          0.3107, 0.2611, 0.2273, 0.1739,
        ],
        ic: [
          1.0, 0.9762, 0.9564, 0.8899, 0.825, 0.636, 0.5548, 0.4488, 0.3317,
          0.287, 0.2405, 0.1966, 0.0,
        ],
      },
      // Chroma ladder — transcribed from Figma neutral anchors via OKLCH.
      // Normal mode holds ≈0.013 across mid-range (steps 2-8) then relaxes
      // toward the achromatic endpoints. IC mode peaks narrower at step 7.
      // See `tests/parity/fixtures/figma-anchors.json` for source.
      C_ladder: {
        normal: [
          0.0, 0.0029, 0.0134, 0.0124, 0.0127, 0.0132, 0.0121, 0.0128, 0.012,
          0.0071, 0.0037, 0.0038, 0.0041,
        ],
        ic: [
          0.0, 0.0041, 0.0094, 0.0109, 0.0111, 0.0118, 0.0122, 0.0129, 0.0122,
          0.009, 0.0057, 0.004, 0.0,
        ],
      },
      // Hue ladder — Figma neutrals sit at ≈286° purple-violet, not the
      // older 247° blue-violet the curve-based config carried. Step 0 (pure
      // white) and step 12 (pure black) have undefined hue when C≈0; we
      // pin them to 286° so the downstream OKLCH value is well-defined
      // even if chroma rounds to non-zero. IC mid-range drifts cooler
      // (≈280°) around steps 2-4 per Figma.
      H_ladder: {
        normal: [
          286.0, 264.54, 286.14, 286.13, 286.09, 286.04, 286.01, 285.89,
          285.78, 285.98, 286.14, 286.09, 285.97,
        ],
        ic: [
          286.0, 271.37, 279.69, 280.46, 280.44, 286.06, 285.99, 285.87,
          285.71, 285.82, 285.97, 286.03, 286.0,
        ],
      },
    },

    // ─── Accents (spines) ─────────────────────────────────────────────
    // @governs plan §4.2 + §15 (appendix A). Each accent has:
    //   - spine: 2-4 control points {L, H, C?} sorted by L
    //   - chroma_curve: how C shapes over L
    //   - chroma_boost_per_dL: compensation for gamut in dark region
    //
    // Spine: drives tier-aware semantic output (APCA-targeted labels,
    //   backgrounds, …). Kept from the first-draft calibration; touch
    //   only if tier contrast targets regress.
    // primitive_per_mode: pins the `--{accent}` primitive var directly
    //   against the Figma light/normal + dark/normal anchor HEX. IC
    //   sectors are NOT calibrated here — primitive is a mode-only
    //   axis (plan §4.2); IC lives on the semantic tier (§5.1).
    accents: {
      // `brand` shares blue's spine (so tier-aware semantics line up) but
      // pins its own primitive per mode against Figma. Figma shows
      // brand ≠ blue at the primitive layer (#007AFF vs #3E87FF), even
      // though they share a hue family.
      brand: {
        spine: [
          { L: 0.2, H: 265 },
          { L: 0.47, H: 252 },
          { L: 0.603, H: 257, C: 0.218 },
          { L: 0.85, H: 240 },
        ],
        chroma_curve: {
          peak: 0.25,
          peak_L: 0.55,
          falloff_low: 0.8,
          falloff_high: 1.0,
          floor: 0.06,
        },
        chroma_boost_per_dL: 0.1,
        primitive_per_mode: {
          light: { L: 0.6028, C: 0.2177, H: 257.42 }, // #007AFF
          dark: { L: 0.6612, C: 0.1806, H: 259.65 }, // #4A8FFF
        },
      },

      blue: {
        spine: [
          { L: 0.2, H: 265 },
          { L: 0.47, H: 252 },
          { L: 0.603, H: 257, C: 0.218 }, // Figma anchor (primary, light)
          { L: 0.85, H: 240 },
        ],
        chroma_curve: {
          peak: 0.25,
          peak_L: 0.55,
          falloff_low: 0.8,
          falloff_high: 1.0,
          floor: 0.06,
        },
        chroma_boost_per_dL: 0.1,
        primitive_per_mode: {
          light: { L: 0.6405, C: 0.1931, H: 259.89 }, // #3E87FF
          dark: { L: 0.6805, C: 0.169, H: 259.79 }, // #5696FF
        },
      },

      red: {
        spine: [
          { L: 0.2, H: 20 },
          { L: 0.608, H: 22, C: 0.214 },
          { L: 0.88, H: 25 },
        ],
        chroma_curve: {
          peak: 0.24,
          peak_L: 0.55,
          falloff_low: 0.7,
          falloff_high: 1.0,
          floor: 0.06,
        },
        chroma_boost_per_dL: 0.12,
        primitive_per_mode: {
          light: { L: 0.6542, C: 0.2321, H: 28.66 }, // #FF3B30
          dark: { L: 0.6544, C: 0.2317, H: 26.47 }, // #FF3A3A
        },
      },

      orange: {
        spine: [
          { L: 0.25, H: 40 },
          { L: 0.712, H: 56, C: 0.18 },
          { L: 0.92, H: 70 },
        ],
        chroma_curve: {
          peak: 0.2,
          peak_L: 0.7,
          falloff_low: 0.9,
          falloff_high: 1.1,
          floor: 0.05,
        },
        chroma_boost_per_dL: 0.15,
        primitive_per_mode: {
          light: { L: 0.7857, C: 0.1717, H: 68.61 }, // #FFA100
          dark: { L: 0.7571, C: 0.1764, H: 59.82 }, // #FF9008
        },
      },

      yellow: {
        // Yellow requires aggressive spine — without H-shift it becomes
        // olive at low L. Key insight (plan §4.2): low-L yellow = amber.
        spine: [
          { L: 0.2, H: 45 },
          { L: 0.5, H: 65 },
          { L: 0.855, H: 83, C: 0.177 }, // Figma anchor
          { L: 0.95, H: 100 },
        ],
        chroma_curve: {
          peak: 0.2,
          peak_L: 0.8,
          falloff_low: 1.2,
          falloff_high: 1.0,
          floor: 0.05,
        },
        chroma_boost_per_dL: 0.25,
        primitive_per_mode: {
          light: { L: 0.873, C: 0.1786, H: 92.23 }, // #FFD000
          dark: { L: 0.8849, C: 0.1805, H: 94.78 }, // #FFD60A
        },
      },

      green: {
        spine: [
          { L: 0.22, H: 150 },
          { L: 0.656, H: 144, C: 0.191 },
          { L: 0.9, H: 140 },
        ],
        chroma_curve: {
          peak: 0.22,
          peak_L: 0.6,
          falloff_low: 0.8,
          falloff_high: 1.0,
          floor: 0.05,
        },
        chroma_boost_per_dL: 0.12,
        primitive_per_mode: {
          light: { L: 0.7303, C: 0.1944, H: 147.44 }, // #34C759
          dark: { L: 0.7556, C: 0.2082, H: 146.98 }, // #30D158
        },
      },

      teal: {
        spine: [
          { L: 0.25, H: 195 },
          { L: 0.72, H: 190, C: 0.14 },
          { L: 0.92, H: 185 },
        ],
        chroma_curve: {
          peak: 0.18,
          peak_L: 0.68,
          falloff_low: 0.8,
          falloff_high: 1.0,
          floor: 0.04,
        },
        chroma_boost_per_dL: 0.12,
        primitive_per_mode: {
          // Figma labels this 'Teal' but the HEX is Apple's system-teal
          // which sits at H≈231 (sky-blue), not a traditional teal.
          light: { L: 0.7886, C: 0.1225, H: 230.83 }, // #5AC8FA
          dark: { L: 0.8166, C: 0.1185, H: 227.75 }, // #64D2FF
        },
      },

      mint: {
        spine: [
          { L: 0.3, H: 170 },
          { L: 0.85, H: 165, C: 0.105 },
          { L: 0.95, H: 160 },
        ],
        chroma_curve: {
          peak: 0.14,
          peak_L: 0.8,
          falloff_low: 1.0,
          falloff_high: 1.0,
          floor: 0.04,
        },
        chroma_boost_per_dL: 0.15,
        primitive_per_mode: {
          light: { L: 0.7481, C: 0.1296, H: 189.03 }, // #00C7BE
          dark: { L: 0.8514, C: 0.1149, H: 192.44 }, // #63E6E2
        },
      },

      indigo: {
        spine: [
          { L: 0.2, H: 290 },
          { L: 0.52, H: 280, C: 0.23 },
          { L: 0.88, H: 270 },
        ],
        chroma_curve: {
          peak: 0.25,
          peak_L: 0.5,
          falloff_low: 0.7,
          falloff_high: 1.0,
          floor: 0.06,
        },
        chroma_boost_per_dL: 0.1,
        primitive_per_mode: {
          light: { L: 0.5295, C: 0.191, H: 278.34 }, // #5856D6
          dark: { L: 0.5564, C: 0.2032, H: 278.15 }, // #5E5CE6
        },
      },

      purple: {
        spine: [
          { L: 0.2, H: 320 },
          { L: 0.555, H: 310, C: 0.23 },
          { L: 0.9, H: 305 },
        ],
        chroma_curve: {
          peak: 0.25,
          peak_L: 0.55,
          falloff_low: 0.7,
          falloff_high: 1.0,
          floor: 0.06,
        },
        chroma_boost_per_dL: 0.1,
        primitive_per_mode: {
          light: { L: 0.6149, C: 0.2129, H: 312.41 }, // #AF52DE
          dark: { L: 0.656, C: 0.2274, H: 312.42 }, // #BF5AF2
        },
      },

      pink: {
        spine: [
          { L: 0.25, H: 358 },
          { L: 0.64, H: 355, C: 0.23 },
          { L: 0.92, H: 350 },
        ],
        chroma_curve: {
          peak: 0.25,
          peak_L: 0.6,
          falloff_low: 0.7,
          falloff_high: 1.0,
          floor: 0.06,
        },
        chroma_boost_per_dL: 0.1,
        primitive_per_mode: {
          // Figma has pink identical in light/normal and dark/normal.
          light: { L: 0.6497, C: 0.2383, H: 17.9 }, // #FF2D55
          dark: { L: 0.6497, C: 0.2383, H: 17.9 }, // #FF2D55
        },
      },
    },

    statics: {
      white: { L: 1.0, C: 0, H: 0 },
      dark: { L: 0.08, C: 0, H: 0 }, // non-pure black for shadows
    },

    // ─── Opacity primitive (29 stops) ────────────────────────────────
    opacity: {
      stops: [
        0, 1, 2, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64,
        68, 72, 76, 80, 84, 88, 92, 96, 98, 99,
      ],
    },

    // ─── Perceptual compensation (Hunt / HK) ─────────────────────────
    // @governs plan §4.3. Applied AFTER spine-lookup, BEFORE gamut clamp.
    // Light mode = identity. Dark mode = reduce chroma (Hunt) and L (HK).
    perceptual_comp: {
      enable: true,
      light: {
        chroma_mult: 1.0,
        lightness_shift: 0,
        hue_shift: 0,
      },
      dark: {
        chroma_mult: 0.93, // -7% (Hunt)
        lightness_shift: -0.02, // HK: dark colors appear brighter
        hue_shift: 0,
      },
    },

    // ─── Tier targets (APCA Lc per tier × contrast) ──────────────────
    // @governs plan §5.1
    tier_targets: {
      primary: { normal: { apca: 60 }, ic: { apca: 75 } },
      secondary: { normal: { apca: 45 }, ic: { apca: 60 } },
      tertiary: { normal: { apca: 30 }, ic: { apca: 45 } },
      quaternary: { normal: { apca: 15 }, ic: { apca: 30 } },
      fill_primary: { normal: { apca: 30 }, ic: { apca: 45 } },
      fill_secondary: { normal: { apca: 20 }, ic: { apca: 30 } },
      fill_tertiary: { normal: { apca: 12 }, ic: { apca: 20 } },
      fill_quaternary: { normal: { apca: 6 }, ic: { apca: 12 } },
      border_strong: { normal: { apca: 45 }, ic: { apca: 60 } },
      border_base: { normal: { apca: 20 }, ic: { apca: 30 } },
      border_soft: { normal: { apca: 8 }, ic: { apca: 15 } },
    },

    // ─── Sentiment aliases ───────────────────────────────────────────
    // @governs plan §5.2. Semantic tree uses `Brand/Danger/Warning/...`
    // as purpose-level names; these map to concrete accent names.
    semantic_aliases: {
      Brand: 'brand',
      Danger: 'red',
      Warning: 'orange',
      Success: 'green',
      Info: 'blue',
    },
  },

  // ─── Semantic tree ──────────────────────────────────────────────────
  // @governs plan §5.2. For every semantic we specify:
  //   - kind: 'pipeline' | 'direct' | 'mode-branch'
  //   - primitive ref (accent/neutral/static)
  //   - tier (for pipeline) — drives target_L via apca_inverse
  //   - canonical_bg (for pipeline) — the bg context against which contrast
  //     is computed
  //
  // Canonical-bg pattern: most labels/fills/borders are designed on
  // `backgrounds.neutral.primary`. Inverted variants use fills.neutral.primary.
  semantics: {
    backgrounds: {
      neutral: {
        primary: {
          kind: 'direct',
          ref: { family: 'neutral', id: '0' },
        },
        secondary: {
          kind: 'direct',
          ref: { family: 'neutral', id: '1' },
        },
        tertiary: {
          kind: 'direct',
          ref: { family: 'neutral', id: '2' },
        },
      },
      overlay: {
        kind: 'direct',
        ref: { family: 'static', id: 'dark', opacity_stop: 40 },
      },
      static: {
        kind: 'direct',
        ref: { family: 'static', id: 'white' },
      },
    },

    labels: buildLabels(),
    fills: buildFills(),
    borders: buildBorders(),

    fx: {
      glow: {
        Brand: {
          kind: 'direct',
          ref: { family: 'accent', id: 'brand', opacity_stop: 40 },
        },
        Danger: {
          kind: 'direct',
          ref: { family: 'accent', id: 'red', opacity_stop: 40 },
        },
        Warning: {
          kind: 'direct',
          ref: { family: 'accent', id: 'orange', opacity_stop: 40 },
        },
        Success: {
          kind: 'direct',
          ref: { family: 'accent', id: 'green', opacity_stop: 40 },
        },
        Info: {
          kind: 'direct',
          ref: { family: 'accent', id: 'blue', opacity_stop: 40 },
        },
      },
      focus_ring: {
        kind: 'direct',
        ref: { family: 'accent', id: 'brand', opacity_stop: 40 },
      },
      skeleton: {
        kind: 'direct',
        ref: { family: 'neutral', id: '6', opacity_stop: 16 },
      },
      shadow_tints: {
        minor: { family: 'static', id: 'dark', opacity_stop: 1 },
        ambient: { family: 'static', id: 'dark', opacity_stop: 2 },
        penumbra: { family: 'static', id: 'dark', opacity_stop: 4 },
        major: { family: 'static', id: 'dark', opacity_stop: 12 },
      },
      shadow_presets: {
        xs: [{ y: 1, blur: 2, spread: 0, tint: 'minor' }],
        s: [
          { y: 1, blur: 3, spread: 0, tint: 'minor' },
          { y: 2, blur: 4, spread: 0, tint: 'ambient' },
        ],
        m: [
          { y: 2, blur: 6, spread: 0, tint: 'minor' },
          { y: 4, blur: 12, spread: 0, tint: 'ambient' },
          { y: 1, blur: 3, spread: 0, tint: 'major' },
        ],
        l: [
          { y: 4, blur: 12, spread: 0, tint: 'minor' },
          { y: 8, blur: 24, spread: 0, tint: 'ambient' },
          { y: 2, blur: 6, spread: 0, tint: 'penumbra' },
          { y: 1, blur: 3, spread: 0, tint: 'major' },
        ],
        xl: [
          { y: 48, blur: 96, spread: 0, tint: 'minor' },
          { y: 24, blur: 48, spread: 0, tint: 'ambient' },
          { y: 8, blur: 24, spread: 0, tint: 'penumbra' },
          { y: 2, blur: 8, spread: 0, tint: 'major' },
        ],
      },
    },

    misc: {
      badge: {
        label_contrast: {
          kind: 'direct',
          ref: { family: 'static', id: 'white' },
        },
        label_default: {
          kind: 'mode-branch',
          branches: {
            'light/normal': { family: 'static', id: 'white' },
            'light/ic': { family: 'static', id: 'white' },
            'dark/normal': { family: 'static', id: 'dark' },
            'dark/ic': { family: 'static', id: 'dark' },
          },
        },
      },
      control: {
        bg: {
          kind: 'mode-branch',
          branches: {
            'light/normal': { family: 'neutral', id: '0' },
            'light/ic': { family: 'neutral', id: '0' },
            'dark/normal': { family: 'neutral', id: '6', opacity_stop: 36 },
            'dark/ic': { family: 'neutral', id: '6', opacity_stop: 44 },
          },
        },
      },
    },
  },

  // ─── Units (L1) ──────────────────────────────────────────────────
  // @governs plan §2. base_px × scaling must be integer for unit-1 to
  // land on a whole pixel at root font-size 16 (Figma uses N·4px grid).
  // Emitted in `rem` — 4px corresponds to 0.25rem, scales with root
  // font-size for accessibility (browser zoom, user overrides).
  units: {
    base_px: 4,
    scaling: 1.0,
    range: { min: -7, max: 27 },
  },

  // ─── Dimensions (L2) ─────────────────────────────────────────────
  // @governs plan §3. Values are indices into the unit scale (L1);
  // airiness shifts the index multiplicatively. 'full' radius uses
  // 9999 sentinel (emitted as literal 9999px — pill, density-immune).
  dimensions: {
    airiness: 1.0,
    adaptives: {
      'breakpoint/desktop/width': 360,
      'breakpoint/mobile/width': 97,
      'layout-padding/default': 5,
      'w-sidebar-left': 16,
      'w-sidebar-right': 5,
    },
    spacing_padding: {
      none: 0,
      xxs: 1,
      xs: 2,
      s: 3,
      m: 4,
      l: 6,
      xl: 8,
      '2xl': 10,
      '3xl': 12,
      '4xl': 16,
      '5xl': 20,
      '6xl': 24,
      '7xl': 27,
    },
    spacing_margin: {
      'neg-l': -4,
      'neg-m': -3,
      'neg-s': -2,
      'neg-xs': -1,
      none: 0,
      xxs: 1,
      xs: 2,
      s: 3,
      m: 4,
      l: 6,
      xl: 8,
      '2xl': 10,
      '3xl': 12,
      '4xl': 16,
      '5xl': 20,
      '6xl': 24,
      '7xl': 27,
    },
    // R1 Hybrid · 5 anchors + clamp() pattern. See plan §3.2.
    // Intermediate values derived in-place via `clamp(min, outer-pad, max)`
    // (see innerOf/outerOf helpers in ESM, plan §3.4-3.5).
    radius: {
      none: 0,                      // sharp corners
      min: 1,                       // unit/1 = 4px  — floor for clamp()
      base: 3,                      // unit/3 = 12px — default for non-nested
      max: 8,                       // unit/8 = 32px — ceiling for clamp()
      full: Number.POSITIVE_INFINITY, // pill sentinel → calc(infinity * 1rem)
    },
    size: {
      xxs: 5,
      xs: 6,
      s: 7,
      m: 8,
      l: 10,
      xl: 12,
      '2xl': 14,
      '3xl': 16,
    },
    fx_blur: {
      none: 0,
      xxs: 1,
      xs: 2,
      s: 3,
      m: 4,
      l: 6,
      xl: 8,
      '2xl': 10,
      '3xl': 12,
      '4xl': 16,
      '5xl': 20,
      '6xl': 24,
      '7xl': 27,
    },
    fx_shift: {
      'neg-l': -4,
      'neg-m': -3,
      'neg-s': -2,
      'neg-xs': -1,
      none: 0,
      xxs: 1,
      xs: 2,
      s: 3,
      m: 4,
      l: 6,
      xl: 8,
      '2xl': 10,
      '3xl': 12,
      '4xl': 16,
    },
    fx_spread: {
      none: 0,
      xxs: 1,
      xs: 2,
      s: 3,
      m: 4,
    },
  },

  // ─── Typography (L5) ─────────────────────────────────────────────
  // @governs plan §6. base_size_step=4 → 16px at scaling=1.0.
  // scale_ratio 1.125 = major second. Sizes snap to base_px/2 grid
  // (§02 rule 1) which may flatten some ratio steps; monotonicity is
  // enforced.
  typography: {
    font_family: 'Geist',
    font_family_mono: 'Geist Mono',
    base_size_step: 4,
    scale_ratio: 1.125,
    lh_body_density: 1.5,
    lh_headline_density: 1.1,
    tracking: {
      body: 0,
      headline_per_log_size: -0.012,
      caps_boost: 0.08,
    },
    semantics: {
      'label-small': 'xxs',
      'label-default': 'xs',
      'body-small': 's',
      'body-default': 'm',
      'body-large': 'l',
      'title-m': 'xl',
      'title-l': '2xl',
      'headline-s': '3xl',
      'headline-m': '4xl',
      'headline-l': '5xl',
      'headline-xl': '6xl',
    },
  },

  // ─── Z-index (L6) ────────────────────────────────────────────────
  // @governs plan §7. Pure integer stacking context; no mode-dependence.
  z_index: {
    primary: 0,
    'skip-link': 50,
    secondary: 100,
    tertiary: 200,
    quaternary: 400,
    'grouped-primary': 400,
    'grouped-secondary': 500,
    'grouped-tertiary': 600,
    inverted: 700,
    dropdown: 800,
    sticky: 900,
    'modal-underlay': 1000,
    modal: 1100,
    toast: 1200,
    tooltip: 1300,
  },

  // ─── Materials (L7) ──────────────────────────────────────────────
  // @governs plan §8. material_mode is orthogonal to base mode and
  // contrast. Runtime-switched via [data-material-mode] on :root.
  // primitive refers to neutrals.id (0..12).
  materials: {
    default_mode: 'solid',
    levels: {
      elevated: {
        primitive: '0',
        glass_opacity: 80,
        glass_blur: 'xl',
        backdrop_blur: 's',
      },
      base: {
        primitive: '1',
        glass_opacity: 72,
        glass_blur: 'l',
        backdrop_blur: 's',
      },
      muted: {
        primitive: '2',
        glass_opacity: 64,
        glass_blur: 'l',
        backdrop_blur: 'xs',
      },
      soft: {
        primitive: '3',
        glass_opacity: 56,
        glass_blur: 'm',
        backdrop_blur: 'xs',
      },
      subtle: {
        primitive: '4',
        glass_opacity: 48,
        glass_blur: 'm',
        backdrop_blur: 'xxs',
      },
    },
  },
}

// ─── Helpers that build repetitive semantic branches ──────────────────

type SemDef = import('../src/types').SemanticDef

function pipelineAccent(
  accent: import('../src/types').AccentName,
  tier: import('../src/types').TierName,
): SemDef {
  return {
    kind: 'pipeline',
    primitive: { family: 'accent', id: accent },
    tier,
    canonical_bg: { kind: 'semantic', path: 'backgrounds.neutral.primary' },
    orientation: 'auto',
  }
}

function pipelineNeutral(
  tier: import('../src/types').TierName,
): SemDef {
  return {
    kind: 'pipeline',
    primitive: { family: 'neutral', id: '12' },
    tier,
    canonical_bg: { kind: 'semantic', path: 'backgrounds.neutral.primary' },
    orientation: 'auto',
  }
}

function buildLabels() {
  return {
    neutral: {
      primary: pipelineNeutral('primary'),
      secondary: pipelineNeutral('secondary'),
      tertiary: pipelineNeutral('tertiary'),
      quaternary: pipelineNeutral('quaternary'),
    },
    inverted: {
      kind: 'direct' as const,
      ref: { family: 'neutral' as const, id: '0' },
    },
    brand: {
      primary: pipelineAccent('brand', 'primary'),
      secondary: pipelineAccent('brand', 'secondary'),
      tertiary: pipelineAccent('brand', 'tertiary'),
      quaternary: pipelineAccent('brand', 'quaternary'),
    },
    danger: {
      primary: pipelineAccent('red', 'primary'),
      secondary: pipelineAccent('red', 'secondary'),
      tertiary: pipelineAccent('red', 'tertiary'),
      quaternary: pipelineAccent('red', 'quaternary'),
    },
    warning: {
      primary: pipelineAccent('orange', 'primary'),
      secondary: pipelineAccent('orange', 'secondary'),
      tertiary: pipelineAccent('orange', 'tertiary'),
      quaternary: pipelineAccent('orange', 'quaternary'),
    },
    success: {
      primary: pipelineAccent('green', 'primary'),
      secondary: pipelineAccent('green', 'secondary'),
      tertiary: pipelineAccent('green', 'tertiary'),
      quaternary: pipelineAccent('green', 'quaternary'),
    },
    info: {
      primary: pipelineAccent('blue', 'primary'),
      secondary: pipelineAccent('blue', 'secondary'),
      tertiary: pipelineAccent('blue', 'tertiary'),
      quaternary: pipelineAccent('blue', 'quaternary'),
    },
    static: {
      light: {
        kind: 'direct' as const,
        ref: { family: 'static' as const, id: 'white' },
      },
      dark: {
        kind: 'direct' as const,
        ref: { family: 'static' as const, id: 'dark' },
      },
    },
  }
}

function buildFills() {
  // Fills use opacity-derivation (translucent overlays of neutral/accent)
  // because fills aren't text — contrast is less critical. They're one of
  // the few places composition-with-opacity is legitimate.
  const fill = (accent: import('../src/types').AccentName, stops: [number, number, number, number]) => ({
    primary: {
      kind: 'direct' as const,
      ref: { family: 'accent' as const, id: accent, opacity_stop: stops[0] },
    },
    secondary: {
      kind: 'direct' as const,
      ref: { family: 'accent' as const, id: accent, opacity_stop: stops[1] },
    },
    tertiary: {
      kind: 'direct' as const,
      ref: { family: 'accent' as const, id: accent, opacity_stop: stops[2] },
    },
    quaternary: {
      kind: 'direct' as const,
      ref: { family: 'accent' as const, id: accent, opacity_stop: stops[3] },
    },
  })
  const fillN = (stops: [number, number, number, number]) => ({
    primary: {
      kind: 'direct' as const,
      ref: { family: 'neutral' as const, id: '6', opacity_stop: stops[0] },
    },
    secondary: {
      kind: 'direct' as const,
      ref: { family: 'neutral' as const, id: '6', opacity_stop: stops[1] },
    },
    tertiary: {
      kind: 'direct' as const,
      ref: { family: 'neutral' as const, id: '6', opacity_stop: stops[2] },
    },
    quaternary: {
      kind: 'direct' as const,
      ref: { family: 'neutral' as const, id: '6', opacity_stop: stops[3] },
    },
  })

  return {
    neutral: fillN([20, 16, 12, 8]),
    brand: fill('brand', [12, 8, 4, 2]),
    danger: fill('red', [12, 8, 4, 2]),
    warning: fill('orange', [12, 8, 4, 2]),
    success: fill('green', [12, 8, 4, 2]),
    info: fill('blue', [12, 8, 4, 2]),
    static: {
      light: {
        kind: 'direct' as const,
        ref: { family: 'static' as const, id: 'white', opacity_stop: 20 },
      },
      dark: {
        kind: 'direct' as const,
        ref: { family: 'static' as const, id: 'dark', opacity_stop: 20 },
      },
    },
  }
}

function buildBorders() {
  // Borders: strong uses pipeline (solid spine), base/soft/ghost use
  // opacity (translucent on bg). Strong border = visible, pipeline-based.
  const strongPipeline = (accent: import('../src/types').AccentName): SemDef => ({
    kind: 'pipeline',
    primitive: { family: 'accent', id: accent },
    tier: 'border_strong',
    canonical_bg: { kind: 'semantic', path: 'backgrounds.neutral.primary' },
    orientation: 'auto',
  })
  const soft = (accent: import('../src/types').AccentName, stop: number): SemDef => ({
    kind: 'direct',
    ref: { family: 'accent', id: accent, opacity_stop: stop },
  })

  const border = (accent: import('../src/types').AccentName) => ({
    strong: strongPipeline(accent),
    base: soft(accent, 20),
    soft: soft(accent, 12),
    ghost: soft(accent, 0),
  })

  const neutralBorder = (): {
    strong: SemDef
    base: SemDef
    soft: SemDef
    ghost: SemDef
  } => ({
    strong: {
      kind: 'pipeline',
      primitive: { family: 'neutral', id: '12' },
      tier: 'border_strong',
      canonical_bg: { kind: 'semantic', path: 'backgrounds.neutral.primary' },
      orientation: 'auto',
    },
    base: {
      kind: 'direct',
      ref: { family: 'neutral', id: '6', opacity_stop: 20 },
    },
    soft: {
      kind: 'direct',
      ref: { family: 'neutral', id: '6', opacity_stop: 12 },
    },
    ghost: {
      kind: 'direct',
      ref: { family: 'neutral', id: '6', opacity_stop: 0 },
    },
  })

  return {
    neutral: neutralBorder(),
    brand: border('brand'),
    danger: border('red'),
    warning: border('orange'),
    success: border('green'),
    info: border('blue'),
    static: {
      light: {
        kind: 'direct' as const,
        ref: { family: 'static' as const, id: 'white', opacity_stop: 40 },
      },
      dark: {
        kind: 'direct' as const,
        ref: { family: 'static' as const, id: 'dark', opacity_stop: 40 },
      },
    },
  }
}
