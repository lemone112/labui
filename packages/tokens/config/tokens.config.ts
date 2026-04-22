/**
 * Lab UI — master token config (phase 1 · colors).
 *
 * SINGLE SOURCE OF TRUTH. Change a value here → full regeneration of
 * primitives + semantic + CSS/ESM/d.ts on `bun run build`.
 *
 * See packages/tokens/spec.md §3 for the full grammar and §4–5 for
 * the generation algorithms.
 */

import type { TokensConfig } from '../src/types'

export const config: TokensConfig = {
  colors: {
    gamut: 'p3',

    neutrals: {
      steps: 13, // 0..12
      hue: 283, // cool-gray bias
      chroma: { min: 0, max: 0.005 },
      lightness: {
        light: { from: 1.0, to: 0.08 },
        dark: { from: 0.08, to: 1.0 },
      },
      lightness_ic_delta: -0.02,
      interp: 'linear',
    },

    accents: {
      brand: { light: { L: 0.603, C: 0.218, H: 257 } },
      red: { light: { L: 0.608, C: 0.214, H: 22 } },
      orange: { light: { L: 0.712, C: 0.18, H: 56 } },
      yellow: {
        light: { L: 0.855, C: 0.177, H: 83 },
        overrides: {
          // Hue shift toward amber gives usable contrast in IC mode.
          light_ic: { L: 0.564, C: 0.145, H: 50 },
        },
      },
      green: { light: { L: 0.656, C: 0.191, H: 144 } },
      teal: { light: { L: 0.72, C: 0.14, H: 190 } },
      mint: {
        light: { L: 0.85, C: 0.105, H: 165 },
        overrides: {
          // TODO(spec §14.2): verify real Figma HEX for Mint IC.
          light_ic: { L: 0.62, C: 0.12, H: 155 },
        },
      },
      blue: { light: { L: 0.603, C: 0.218, H: 257 } }, // alias brand
      indigo: { light: { L: 0.52, C: 0.23, H: 280 } },
      purple: { light: { L: 0.555, C: 0.23, H: 310 } },
      pink: { light: { L: 0.64, C: 0.23, H: 355 } },
    },

    statics: {
      white: { L: 1.0, C: 0, H: 0 },
      dark: { L: 0.08, C: 0, H: 0 }, // non-pure-black for shadows/gradients
    },

    modes: ['light', 'dark', 'light_ic', 'dark_ic'] as const,

    mode_derivation: {
      dark: { dL: 0.045, dC: 0, dH: 0 },
      light_ic: { dL: -0.1, dC: 0.01, dH: 5 },
      dark_ic: { dL: 0.08, dC: -0.02, dH: 0 },
    },

    opacity: {
      stops: [
        0, 1, 2, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64,
        68, 72, 76, 80, 84, 88, 92, 96, 98, 99,
      ],
    },
  },

  ladders: {
    // Backgrounds (common page surfaces). Referenced by control.bg and APCA
    // tests. Neutral steps 0..2 map to the page → secondary → tertiary surfaces.
    background: {
      neutral: {
        primary: 'N0@solid',
        secondary: 'N1@solid',
        tertiary: 'N2@solid',
      },
    },

    label: {
      accent: {
        steps: {
          primary: 'solid',
          secondary: { normal: '@72', ic: '@80' },
          tertiary: { normal: '@52', ic: '@72' },
          quaternary: { normal: '@32', ic: '@52' },
        },
      },
      neutral: {
        // Split per-mode so dark backgrounds pick up lighter neutral steps
        // (the scale is inverted but the Figma ladder references light-mode
        // step names). Without this split, `N8@72` is too dim in dark modes.
        steps: {
          primary: {
            light: 'N12@solid',
            dark: 'N12@solid',
            light_ic: 'N12@solid',
            dark_ic: 'N12@solid',
          },
          secondary: {
            light: 'N8@72',
            dark: 'N11@80',
            light_ic: 'N10@solid',
            dark_ic: 'N11@solid',
          },
          tertiary: {
            light: 'N8@52',
            dark: 'N11@52',
            light_ic: 'N9@72',
            dark_ic: 'N10@72',
          },
          quaternary: {
            light: 'N8@32',
            dark: 'N11@32',
            light_ic: 'N9@52',
            dark_ic: 'N10@52',
          },
        },
      },
    },

    fill: {
      accent: {
        // Accent fills are mode-invariant (§5.2).
        steps: {
          primary: '@12',
          secondary: '@8',
          tertiary: '@4',
          quaternary: '@2',
          none: '@0',
        },
      },
      neutral: {
        steps: {
          primary: {
            light: 'N6@20',
            dark: 'N6@36',
            light_ic: 'N6@32',
            dark_ic: 'N6@44',
          },
          secondary: {
            light: 'N6@16',
            dark: 'N6@32',
            light_ic: 'N6@24',
            dark_ic: 'N6@40',
          },
          tertiary: {
            light: 'N6@12',
            dark: 'N6@24',
            light_ic: 'N6@20',
            dark_ic: 'N6@32',
          },
          quaternary: {
            light: 'N6@8',
            dark: 'N6@16',
            light_ic: 'N6@16',
            dark_ic: 'N6@24',
          },
        },
      },
    },

    border: {
      accent: {
        steps: {
          strong: 'solid',
          base: { normal: '@20', ic: '@32' },
          soft: { normal: '@12', ic: '@20' },
          ghost: '@0',
        },
      },
      neutral: {
        steps: {
          strong: {
            light: 'N9@solid',
            dark: 'N7@solid',
            light_ic: 'N10@solid',
            dark_ic: 'N6@solid',
          },
          base: {
            light: 'N6@20',
            dark: 'N6@32',
            light_ic: 'N6@28',
            dark_ic: 'N6@40',
          },
          soft: {
            light: 'N6@12',
            dark: 'N6@20',
            light_ic: 'N6@16',
            dark_ic: 'N6@28',
          },
          ghost: 'N6@0',
        },
      },
    },

    fx: {
      shadow: {
        steps: {
          minor: { light_like: 'Dark@1', dark_like: 'Dark@2' },
          ambient: { light_like: 'Dark@2', dark_like: 'Dark@4' },
          penumbra: { light_like: 'Dark@4', dark_like: 'Dark@12' },
          major: { light_like: 'Dark@12', dark_like: 'Dark@20' },
        },
        mode_map: {
          light: 'light_like',
          dark: 'dark_like',
          light_ic: 'light_like',
          dark_ic: 'dark_like',
        },
      },
    },

    misc: {
      badge: {
        label_contrast: {
          light: 'White@solid',
          dark: 'White@solid',
          light_ic: 'White@solid',
          dark_ic: 'White@solid',
        },
        label_default: {
          light: 'White@solid',
          dark: 'Dark@solid',
          light_ic: 'White@solid',
          dark_ic: 'Dark@solid',
        },
      },
      control: {
        // Control-bg is a documented TEMPORARY cross-semantic ref (§5.5, §13.2).
        // Will be replaced by component-level tokens in tier-2.
        bg: {
          light: { ref: 'background.neutral.primary' },
          dark: { ref: 'fill.neutral.primary' },
          light_ic: { ref: 'background.neutral.primary' },
          dark_ic: { ref: 'fill.neutral.primary' },
        },
      },
    },
  },
}
