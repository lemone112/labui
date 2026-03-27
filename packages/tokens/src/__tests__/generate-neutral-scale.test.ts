import { describe, it, expect } from 'vitest';
import { generateNeutralScale, type NeutralScaleStep } from '../generate-neutral-scale.js';

const DEFAULT_OPTIONS = { hue: 283, chroma: 0.012 };

describe('generateNeutralScale', () => {
  let scale: NeutralScaleStep[];

  // Generate once for all tests
  scale = generateNeutralScale(DEFAULT_OPTIONS);

  it('returns exactly 13 steps', () => {
    expect(scale).toHaveLength(13);
  });

  it('step 0 has L=1.0 and C=0 (white)', () => {
    expect(scale[0].L).toBe(1.0);
    expect(scale[0].C).toBe(0);
  });

  it('step 12 has L=0.1 and C=0 (near-black)', () => {
    expect(scale[12].L).toBe(0.1);
    expect(scale[12].C).toBe(0);
  });

  it('step 6 (midpoint) has maximum chroma', () => {
    const maxC = Math.max(...scale.map((s) => s.C));
    expect(scale[6].C).toBe(maxC);
    expect(scale[6].C).toBeGreaterThan(0);
  });

  it('chroma is symmetric: step[i].C === step[12-i].C', () => {
    for (let i = 0; i <= 6; i++) {
      expect(scale[i].C).toBeCloseTo(scale[12 - i].C, 6);
    }
  });

  it('all steps have correct name ("0" through "12")', () => {
    for (let i = 0; i <= 12; i++) {
      expect(scale[i].name).toBe(String(i));
      expect(scale[i].index).toBe(i);
    }
  });

  it('hue is constant across all chromatic steps', () => {
    const chromaticSteps = scale.filter((s) => s.C > 0);
    expect(chromaticSteps.length).toBeGreaterThan(0);
    const expectedHue = DEFAULT_OPTIONS.hue;
    for (const step of chromaticSteps) {
      expect(step.H).toBe(expectedHue);
    }
  });

  it('steps with C=0 have H=0 (achromatic)', () => {
    const achromaticSteps = scale.filter((s) => s.C === 0);
    expect(achromaticSteps.length).toBeGreaterThanOrEqual(2); // at least steps 0 and 12
    for (const step of achromaticSteps) {
      expect(step.H).toBe(0);
    }
  });
});
