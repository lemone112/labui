import { describe, it, expect } from 'vitest';
import { generateTypeScale } from '../generate-typography.js';
import { typographyConfig } from '../typography.config.js';

describe('generateTypeScale', () => {
  const scale = generateTypeScale();

  it('generates exactly 12 steps', () => {
    expect(scale).toHaveLength(12);
  });

  it('body is base size (16px = 1rem)', () => {
    const body = scale.find(s => s.name === 'body');
    expect(body?.sizePx).toBe(16);
    expect(body?.sizeRem).toBe(1);
  });

  it('sizes increase monotonically', () => {
    for (let i = 1; i < scale.length; i++) {
      expect(scale[i].sizePx).toBeGreaterThanOrEqual(scale[i - 1].sizePx);
    }
  });

  it('line-height decreases as size increases', () => {
    const body = scale.find(s => s.name === 'body')!;
    const hero = scale.find(s => s.name === 'hero')!;
    expect(hero.lineHeight).toBeLessThan(body.lineHeight);
  });

  it('line-height is between 1.0 and 1.75', () => {
    for (const step of scale) {
      expect(step.lineHeight).toBeGreaterThanOrEqual(1.0);
      expect(step.lineHeight).toBeLessThanOrEqual(1.75);
    }
  });

  it('tracking is 0 for small sizes, negative for large', () => {
    const label = scale.find(s => s.name === 'label')!;
    const hero = scale.find(s => s.name === 'hero')!;
    expect(label.letterSpacing).toBe('0em');
    expect(hero.letterSpacing).toMatch(/^-/); // negative
  });

  it('matches Figma reference sizes', () => {
    const figmaSizes = [8, 12, 14, 16, 20, 24, 32, 48, 64, 80, 112];
    const generatedSizes = scale.map(s => s.sizePx);
    for (const figma of figmaSizes) {
      expect(generatedSizes).toContain(figma);
    }
  });

  it('respects custom ratios', () => {
    const custom = generateTypeScale({ ...typographyConfig, uiRatio: 1.5 });
    const defaultScale = generateTypeScale();
    // Custom heading should be larger than default heading
    const customHeading = custom.find(s => s.name === 'heading')!;
    const defaultHeading = defaultScale.find(s => s.name === 'heading')!;
    expect(customHeading.sizePx).toBeGreaterThan(defaultHeading.sizePx);
  });
});
