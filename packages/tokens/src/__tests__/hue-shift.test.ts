import { describe, it, expect } from 'vitest';
import {
  computeHueShift,
  applyHueShift,
  DEFAULT_HUE_SHIFT_ZONES,
  type HueShiftZone,
} from '../hue-shift.js';

describe('computeHueShift', () => {
  it('yellow (H=90) darkened shifts toward orange (H decreases)', () => {
    const shift = computeHueShift(90, -0.3);
    expect(shift).toBeLessThan(0); // direction = -1 for yellow zone
  });

  it('cyan (H=195) darkened shifts toward blue (H increases)', () => {
    const shift = computeHueShift(195, -0.3);
    expect(shift).toBeGreaterThan(0); // direction = +1 for cyan zone
  });

  it('H=0 (red edge) produces minimal or no shift', () => {
    const shift = computeHueShift(0, -0.3);
    // H=0 is far from most zone centers; the closest is Red at 25
    // but with width=20 the Gaussian weight is small
    expect(Math.abs(shift)).toBeLessThan(3);
  });

  it('H=180 (between zones) produces smaller shift than zone center', () => {
    const shiftAtCenter = Math.abs(computeHueShift(195, -0.3));
    const shiftAt180 = Math.abs(computeHueShift(180, -0.3));
    // H=180 is 15 degrees from Cyan center (195, width=25) so it gets
    // partial Gaussian weight, but always less than the zone center.
    expect(shiftAt180).toBeLessThan(shiftAtCenter);
    expect(shiftAt180).toBeGreaterThan(0);
  });

  it('deltaL=0 produces no shift regardless of hue', () => {
    expect(computeHueShift(90, 0)).toBe(0);
    expect(computeHueShift(195, 0)).toBe(0);
    expect(computeHueShift(0, 0)).toBe(0);
    expect(computeHueShift(264, 0)).toBe(0);
  });

  it('larger |deltaL| produces larger shift (monotonic)', () => {
    const s1 = Math.abs(computeHueShift(90, -0.1));
    const s2 = Math.abs(computeHueShift(90, -0.3));
    const s3 = Math.abs(computeHueShift(90, -0.6));
    expect(s2).toBeGreaterThan(s1);
    expect(s3).toBeGreaterThan(s2);
  });

  it('yellow zone at full strength: H=90, deltaL=-0.5 gives shift around -11', () => {
    // shift = -1 * 18 * 1.0 * 0.5^0.7
    // 0.5^0.7 = exp(0.7 * ln(0.5)) ≈ 0.6156
    // expected ≈ -18 * 0.6156 ≈ -11.08
    const shift = computeHueShift(90, -0.5);
    expect(shift).toBeCloseTo(-11.08, 0);
  });

  it('custom zones override defaults', () => {
    const custom: HueShiftZone[] = [
      { centerHue: 50, direction: 1, maxShift: 20, width: 40 },
    ];
    const shift = computeHueShift(50, -0.5, custom);
    // direction=+1, maxShift=20, weight=1.0, |deltaL|^0.7 = 0.5^0.7 ≈ 0.6156
    expect(shift).toBeCloseTo(20 * 0.6156, 0);
  });
});

describe('applyHueShift', () => {
  it('normalizes result to 0-360', () => {
    // Use a custom zone that produces a large negative shift
    const custom: HueShiftZone[] = [
      { centerHue: 10, direction: -1, maxShift: 30, width: 40 },
    ];
    const result = applyHueShift(10, 0.7, 0.0, custom);
    // deltaL = -0.7, shift = -1 * 30 * 1.0 * 0.7^0.7 ≈ -22.7
    // hue = 10 + (-22.7) = -12.7 -> normalized to ~347.3
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThan(360);
  });

  it('returns original hue when deltaL is 0', () => {
    expect(applyHueShift(90, 0.5, 0.5)).toBe(90);
    expect(applyHueShift(200, 0.3, 0.3)).toBe(200);
  });

  it('yellow darkened produces hue less than original', () => {
    const result = applyHueShift(90, 0.7, 0.4);
    expect(result).toBeLessThan(90);
  });
});
