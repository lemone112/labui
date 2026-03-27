import { describe, it, expect } from "vitest";
import {
  hexToOklch,
  oklchToHex,
  oklchToCss,
  oklchToCssAlpha,
  gamutClampSrgb,
  gamutClampP3,
  isInGamut,
  relativeLuminance,
  contrastRatio,
  meetsContrast,
  type OklchColor,
} from "../color-utils.js";

// ─── hexToOklch ─────────────────────────────────────────────────────────────

describe("hexToOklch", () => {
  it("converts #007AFF to approximately { L: 0.603, C: 0.218, H: 257 }", () => {
    const result = hexToOklch("#007AFF");
    expect(result.L).toBeCloseTo(0.603, 1);
    expect(result.C).toBeCloseTo(0.218, 1);
    expect(result.H).toBeCloseTo(257, 0);
  });

  it("converts black #000000", () => {
    const result = hexToOklch("#000000");
    expect(result.L).toBeCloseTo(0, 3);
    expect(result.C).toBeCloseTo(0, 3);
  });

  it("converts white #FFFFFF", () => {
    const result = hexToOklch("#FFFFFF");
    expect(result.L).toBeCloseTo(1, 2);
    expect(result.C).toBeCloseTo(0, 3);
  });
});

// ─── oklchToHex ─────────────────────────────────────────────────────────────

describe("oklchToHex", () => {
  it("converts { L: 0.603, C: 0.218, H: 257 } back to approximately #007AFF", () => {
    const hex = oklchToHex({ L: 0.603, C: 0.218, H: 257 });
    // Should be close to #007AFF (within a few digits)
    expect(hex).toMatch(/^#[0-9a-f]{6}$/);
    // Parse the hex to check each channel is close
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    expect(r).toBeLessThanOrEqual(5); // ~0
    expect(Math.abs(g - 0x7a)).toBeLessThanOrEqual(3); // ~122
    expect(Math.abs(b - 0xff)).toBeLessThanOrEqual(3); // ~255
  });
});

// ─── Round-trip stability ───────────────────────────────────────────────────

describe("round-trip hex -> oklch -> hex", () => {
  const testColors = ["#007AFF", "#FF3B30", "#34C759", "#FFD60A", "#8E8E93"];

  for (const hex of testColors) {
    it(`round-trips ${hex} within +/- 1 per RGB channel`, () => {
      const oklch = hexToOklch(hex);
      const roundTripped = oklchToHex(oklch);

      const origR = parseInt(hex.slice(1, 3), 16);
      const origG = parseInt(hex.slice(3, 5), 16);
      const origB = parseInt(hex.slice(5, 7), 16);
      const rtR = parseInt(roundTripped.slice(1, 3), 16);
      const rtG = parseInt(roundTripped.slice(3, 5), 16);
      const rtB = parseInt(roundTripped.slice(5, 7), 16);

      expect(Math.abs(origR - rtR)).toBeLessThanOrEqual(1);
      expect(Math.abs(origG - rtG)).toBeLessThanOrEqual(1);
      expect(Math.abs(origB - rtB)).toBeLessThanOrEqual(1);
    });
  }
});

// ─── gamutClampSrgb ─────────────────────────────────────────────────────────

describe("gamutClampSrgb", () => {
  it("reduces C on an out-of-gamut color while keeping L and H", () => {
    // Very high chroma that is definitely out of sRGB gamut
    const outOfGamut: OklchColor = { L: 0.7, C: 0.4, H: 150 };
    const clamped = gamutClampSrgb(outOfGamut);

    expect(clamped.C).toBeLessThan(outOfGamut.C);
    expect(clamped.L).toBeCloseTo(outOfGamut.L, 1);
    // Hue should be preserved (modulo float precision)
    expect(clamped.H).toBeCloseTo(outOfGamut.H, 0);
  });

  it("does not change an already in-gamut color significantly", () => {
    const inGamut: OklchColor = { L: 0.5, C: 0.05, H: 200 };
    const clamped = gamutClampSrgb(inGamut);

    expect(clamped.L).toBeCloseTo(inGamut.L, 2);
    expect(clamped.C).toBeCloseTo(inGamut.C, 2);
  });
});

// ─── gamutClampP3 ───────────────────────────────────────────────────────────

describe("gamutClampP3", () => {
  it("P3 gamut allows higher chroma than sRGB", () => {
    const color: OklchColor = { L: 0.7, C: 0.25, H: 150 };
    const srgbClamped = gamutClampSrgb(color);
    const p3Clamped = gamutClampP3(color);

    // P3 should allow equal or higher chroma than sRGB
    expect(p3Clamped.C).toBeGreaterThanOrEqual(srgbClamped.C - 0.001);
  });
});

// ─── isInGamut ──────────────────────────────────────────────────────────────

describe("isInGamut", () => {
  it("white is in sRGB gamut", () => {
    expect(isInGamut({ L: 1, C: 0, H: 0 }, "srgb")).toBe(true);
  });

  it("very high chroma is out of sRGB gamut", () => {
    expect(isInGamut({ L: 0.7, C: 0.4, H: 150 }, "srgb")).toBe(false);
  });
});

// ─── contrastRatio ──────────────────────────────────────────────────────────

describe("contrastRatio", () => {
  const white: OklchColor = { L: 1, C: 0, H: 0 };
  const black: OklchColor = { L: 0, C: 0, H: 0 };

  it("white vs black = 21:1", () => {
    const ratio = contrastRatio(white, black);
    expect(ratio).toBeCloseTo(21, 0);
  });

  it("white vs white = 1:1", () => {
    const ratio = contrastRatio(white, white);
    expect(ratio).toBeCloseTo(1, 2);
  });

  it("is symmetric (fg/bg order does not matter)", () => {
    const blue = hexToOklch("#007AFF");
    const ratio1 = contrastRatio(white, blue);
    const ratio2 = contrastRatio(blue, white);
    expect(ratio1).toBeCloseTo(ratio2, 5);
  });
});

// ─── meetsContrast ──────────────────────────────────────────────────────────

describe("meetsContrast", () => {
  const white: OklchColor = { L: 1, C: 0, H: 0 };
  const black: OklchColor = { L: 0, C: 0, H: 0 };

  it("white/black meets 4.5:1 AA threshold", () => {
    expect(meetsContrast(white, black, 4.5)).toBe(true);
  });

  it("white/black meets 7:1 AAA threshold", () => {
    expect(meetsContrast(white, black, 7)).toBe(true);
  });

  it("similar grays fail 4.5:1 threshold", () => {
    const gray1: OklchColor = { L: 0.6, C: 0, H: 0 };
    const gray2: OklchColor = { L: 0.65, C: 0, H: 0 };
    expect(meetsContrast(gray1, gray2, 4.5)).toBe(false);
  });
});

// ─── oklchToCss ─────────────────────────────────────────────────────────────

describe("oklchToCss", () => {
  it("formats with 3 decimal places for L/C and integer H", () => {
    const css = oklchToCss({ L: 0.6034, C: 0.2183, H: 257.4 });
    expect(css).toBe("oklch(0.603 0.218 257)");
  });

  it("handles zero values", () => {
    const css = oklchToCss({ L: 0, C: 0, H: 0 });
    expect(css).toBe("oklch(0.000 0.000 0)");
  });
});

// ─── oklchToCssAlpha ────────────────────────────────────────────────────────

describe("oklchToCssAlpha", () => {
  it("formats with alpha", () => {
    const css = oklchToCssAlpha({ L: 0.603, C: 0.218, H: 257 }, 0.5);
    expect(css).toBe("oklch(0.603 0.218 257 / 0.5)");
  });
});

// ─── relativeLuminance ──────────────────────────────────────────────────────

describe("relativeLuminance", () => {
  it("white has luminance ~1.0", () => {
    const lum = relativeLuminance({ L: 1, C: 0, H: 0 });
    expect(lum).toBeCloseTo(1.0, 1);
  });

  it("black has luminance ~0.0", () => {
    const lum = relativeLuminance({ L: 0, C: 0, H: 0 });
    expect(lum).toBeCloseTo(0.0, 3);
  });

  it("mid-gray has luminance between 0 and 1", () => {
    const gray = hexToOklch("#808080");
    const lum = relativeLuminance(gray);
    expect(lum).toBeGreaterThan(0.1);
    expect(lum).toBeLessThan(0.5);
  });
});
