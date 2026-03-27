# Lab UI Color Architecture v3 — Design Spec

> Combined from: `lab-ui-color-architecture-v3.md` (approved plan) + reality check corrections.

**Status:** APPROVED — ready for implementation plan
**Created:** 2026-03-27

## Summary

Complete rewrite of Lab UI color system. Moves from static Figma-derived tokens to a computed pipeline with WCAG-aware label correction, hue shift, chroma harmonization, and 4-theme support.

## Key Decisions

1. **Build-time generation** with future browser preview engine (shared pure core)
2. **@texel/color** as OKLCH library (~3.5KB, fastest available)
3. **13-step neutral scale** (down from 19) — only 7 steps actually referenced
4. **9 opacity stops** (down from 19) — mapped to Figma reference
5. **4 themes**: light, dark, light-ic, dark-ic
6. **Hue shift zones**: labeled experimental, configurable (not hardcoded)
7. **15 binary search iterations** (not 50 — sufficient for sRGB precision)
8. **CSS naming**: `--lab-{layer}-{role}-{variant}` prefix
9. **Regression tests FIRST** before any changes

## Full Spec

See `~/Desktop/lab-ui-color-architecture-v3.md` for complete technical specification.

## Reality Check Corrections

- Pipeline portability ~30-35% pure (not 75-80%) — needs explicit refactoring
- Style Dictionary does reference resolution + transforms — must account for browser engine
- Relative color syntax requires single resolved color value (not decomposed vars)
- Hue shift zones are experimental custom technique (not Apple/Material/Radix)
- Performance on mobile: budget 300-500ms for preview engine
- Budget +40-60% time over optimistic estimate
