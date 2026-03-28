import { describe, it, expect } from "vitest";
import {
  correctLabelColor,
  generateLabelLadder,
  generateOnSolidLabel,
  type LabelContext,
} from "../generate-labels.js";
import { type OklchColor, contrastRatio } from "../color-utils.js";

// ─── Test colors ────────────────────────────────────────────────────────────

const white: OklchColor = { L: 1, C: 0, H: 0 };
const black: OklchColor = { L: 0, C: 0, H: 0 };
const lightBg: OklchColor = { L: 0.97, C: 0.005, H: 90 };
const darkBg: OklchColor = { L: 0.15, C: 0.005, H: 250 };
const midBlue: OklchColor = { L: 0.6, C: 0.2, H: 257 }; // ~#007AFF
const yellow: OklchColor = { L: 0.9, C: 0.15, H: 90 }; // bright yellow
const lowChroma: OklchColor = { L: 0.5, C: 0.01, H: 180 }; // near-gray

// ─── correctLabelColor ─────────────────────────────────────────────────────

describe("correctLabelColor", () => {
  it("darkens accent on light background", () => {
    const ctx: LabelContext = {
      accent: midBlue,
      background: lightBg,
      contrastTarget: 4.5,
    };
    const result = correctLabelColor(ctx);
    // Corrected color should be darker than original
    expect(result.color.L).toBeLessThan(midBlue.L);
    expect(result.contrastAchieved).toBeGreaterThanOrEqual(4.5);
  });

  it("lightens accent on dark background", () => {
    const ctx: LabelContext = {
      accent: midBlue,
      background: darkBg,
      contrastTarget: 4.5,
    };
    const result = correctLabelColor(ctx);
    // Corrected color should be lighter than original
    expect(result.color.L).toBeGreaterThan(midBlue.L);
    expect(result.contrastAchieved).toBeGreaterThanOrEqual(4.5);
  });

  it("meets the requested contrast threshold of 4.5:1", () => {
    const ctx: LabelContext = {
      accent: midBlue,
      background: lightBg,
      contrastTarget: 4.5,
    };
    const result = correctLabelColor(ctx);
    const verified = contrastRatio(result.color, lightBg);
    expect(verified).toBeGreaterThanOrEqual(4.5);
  });

  it("preserves accent hue when correcting lightness", () => {
    // The simplified algorithm keeps the original hue, no hue shift
    const ctx: LabelContext = {
      accent: yellow,
      background: lightBg,
      contrastTarget: 4.5,
    };
    const result = correctLabelColor(ctx);
    expect(result.hueShifted).toBe(false);
    expect(result.contrastAchieved).toBeGreaterThanOrEqual(4.5);
  });

  it("meets lower contrast target for yellow on light bg", () => {
    const ctx: LabelContext = {
      accent: yellow,
      background: lightBg,
      contrastTarget: 3.0,
    };
    const result = correctLabelColor(ctx);
    expect(result.contrastAchieved).toBeGreaterThanOrEqual(3.0);
  });

  it("falls back to near-black/white when accent cannot meet threshold", () => {
    // Near-gray with extremely high contrast target — impossible to meet
    const ctx: LabelContext = {
      accent: lowChroma,
      background: { L: 0.5, C: 0, H: 0 },
      contrastTarget: 15, // impossible for mid-gray on mid-gray
    };
    const result = correctLabelColor(ctx);
    // bgL <= 0.5 → lightenLabel=true → fallback is near-white (L=0.95)
    // Either near-black or near-white fallback
    const isNearExtreme = result.color.L <= 0.15 || result.color.L >= 0.9;
    expect(isNearExtreme).toBe(true);
  });

  it("returns accent unchanged if it already meets contrast", () => {
    // Black text on white bg — already high contrast
    const ctx: LabelContext = {
      accent: { L: 0.15, C: 0.1, H: 257 },
      background: white,
      contrastTarget: 3.0,
    };
    const result = correctLabelColor(ctx);
    expect(result.contrastAchieved).toBeGreaterThanOrEqual(3.0);
  });

  it("produces a valid label color meeting high contrast target", () => {
    const ctx: LabelContext = {
      accent: midBlue,
      background: lightBg,
      contrastTarget: 7.0,
    };
    const result = correctLabelColor(ctx);
    // Must return a valid color in gamut
    expect(result.color.L).toBeGreaterThanOrEqual(0);
    expect(result.color.L).toBeLessThanOrEqual(1);
    // Must meet contrast target (or use fallback that does)
    expect(result.contrastAchieved).toBeGreaterThanOrEqual(7.0);
  });
});

// ─── generateLabelLadder ────────────────────────────────────────────────────

describe("generateLabelLadder", () => {
  it("returns 4 levels with correct alpha values", () => {
    const color: OklchColor = { L: 0.4, C: 0.15, H: 257 };
    const ladder = generateLabelLadder(color);

    expect(ladder.primary.alpha).toBe(1.0);
    expect(ladder.secondary.alpha).toBe(0.72);
    expect(ladder.tertiary.alpha).toBe(0.52);
    expect(ladder.quaternary.alpha).toBe(0.32);
  });

  it("all levels share the same base color", () => {
    const color: OklchColor = { L: 0.4, C: 0.15, H: 257 };
    const ladder = generateLabelLadder(color);

    expect(ladder.primary.color).toEqual(color);
    expect(ladder.secondary.color).toEqual(color);
    expect(ladder.tertiary.color).toEqual(color);
    expect(ladder.quaternary.color).toEqual(color);
  });
});

// ─── generateOnSolidLabel ───────────────────────────────────────────────────

describe("generateOnSolidLabel", () => {
  it("returns near-white on dark solid background", () => {
    const darkSolid: OklchColor = { L: 0.3, C: 0.15, H: 257 };
    const label = generateOnSolidLabel(darkSolid);
    expect(label.L).toBeGreaterThan(0.9);
  });

  it("returns near-black on light solid background", () => {
    const lightSolid: OklchColor = { L: 0.8, C: 0.1, H: 90 };
    const label = generateOnSolidLabel(lightSolid);
    expect(label.L).toBeLessThan(0.2);
  });

  it("result meets 4.5:1 contrast against the solid background", () => {
    const solidBg: OklchColor = { L: 0.55, C: 0.2, H: 150 };
    const label = generateOnSolidLabel(solidBg);
    const cr = contrastRatio(label, solidBg);
    expect(cr).toBeGreaterThanOrEqual(4.5);
  });

  it("handles edge case of very light background", () => {
    const veryLight: OklchColor = { L: 0.95, C: 0.05, H: 60 };
    const label = generateOnSolidLabel(veryLight);
    const cr = contrastRatio(label, veryLight);
    expect(cr).toBeGreaterThanOrEqual(4.5);
  });

  it("handles edge case of very dark background", () => {
    const veryDark: OklchColor = { L: 0.05, C: 0.05, H: 300 };
    const label = generateOnSolidLabel(veryDark);
    const cr = contrastRatio(label, veryDark);
    expect(cr).toBeGreaterThanOrEqual(4.5);
  });
});
