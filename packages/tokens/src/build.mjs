/**
 * Lab UI Token Build Pipeline
 *
 * Source: W3C DTCG 2025.10 JSON (.tokens.json)
 * Tool:   Style Dictionary v4 (ESM)
 * Output: CSS custom properties + Tailwind v4 @theme
 *
 * Key features:
 * - OKLCH color space throughout
 * - Alpha variants GENERATED from base hue × 19 opacity stops
 * - Neutral Light/Dark scales GENERATED from white/near-black × opacity
 * - Brand hue configurable at runtime via --brand-hue
 * - 4 themes: light, dark (MVP), light-ic, dark-ic (phase 2)
 * - 3 surface modes: glass, solid, ambient (via data-surface)
 */

import StyleDictionary from 'style-dictionary';

// TODO: Implement full build pipeline
// Phase 1: Primitives → CSS vars
// Phase 2: Semantic per-theme → CSS vars under [data-theme]
// Phase 3: Tailwind @theme inline output
// Phase 4: Alpha variant generation (hue × opacity matrix)

const themes = [
  { name: 'light', selector: ':root, [data-theme="light"]' },
  { name: 'dark',  selector: '[data-theme="dark"]' },
];

for (const theme of themes) {
  const sd = new StyleDictionary({
    source: [
      'tokens/primitive/**/*.tokens.json',
      `tokens/semantic/${theme.name}.tokens.json`,
      'tokens/material/**/*.tokens.json',
    ],
    platforms: {
      css: {
        transformGroup: 'css',
        buildPath: 'dist/css/',
        files: [
          {
            destination: `${theme.name}.css`,
            format: 'css/variables',
            options: {
              selector: theme.selector,
              outputReferences: true,
            },
          },
        ],
      },
    },
  });

  await sd.buildAllPlatforms();
}

console.log('✓ Lab UI tokens built successfully');
