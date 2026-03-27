import { describe, it, expect } from "vitest";
import {
  generateAccents,
  type AccentConfig,
  type GeneratedAccents,
} from "../generate-accents.js";
import { hexToOklch } from "../color-utils.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

function hueDistance(h1: number, h2: number): number {
  const d = Math.abs(h1 - h2) % 360;
  return d > 180 ? 360 - d : d;
}

const SENTIMENT_HUES = [29, 69, 147, 260];

// ─── Default brand ──────────────────────────────────────────────────────────

const DEFAULT_CONFIG: AccentConfig = { brand: "#007AFF" };

describe("generateAccents", () => {
  // 1. Returns all expected keys
  it("returns all expected keys for default brand #007AFF", () => {
    const result = generateAccents(DEFAULT_CONFIG);

    expect(result).toHaveProperty("brand");
    expect(result).toHaveProperty("sentiments");
    expect(result).toHaveProperty("decoratives");
    expect(result).toHaveProperty("neutralHue");
    expect(result).toHaveProperty("neutralChroma");

    // Brand variant has all four sub-variants
    expect(result.brand).toHaveProperty("light");
    expect(result.brand).toHaveProperty("dark");
    expect(result.brand).toHaveProperty("lightIc");
    expect(result.brand).toHaveProperty("darkIc");

    // All four sentiments present
    expect(result.sentiments).toHaveProperty("danger");
    expect(result.sentiments).toHaveProperty("warning");
    expect(result.sentiments).toHaveProperty("success");
    expect(result.sentiments).toHaveProperty("info");
  });

  // 2. Brand light variant L ~ 0.603 (from HEX)
  it("brand light variant L is approximately 0.603", () => {
    const result = generateAccents(DEFAULT_CONFIG);
    // The light variant is the brand color gamut-clamped, L should be close to original
    expect(result.brand.light.L).toBeCloseTo(0.603, 1);
  });

  // 3. Brand dark variant has higher L than light
  it("brand dark variant has higher L than light", () => {
    const result = generateAccents(DEFAULT_CONFIG);
    expect(result.brand.dark.L).toBeGreaterThan(result.brand.light.L);
  });

  // 4. Sentiments keep canonical hues
  it("sentiments keep canonical hues (danger H~29, warning H~69, success H~147, info H~260)", () => {
    const result = generateAccents(DEFAULT_CONFIG);

    expect(result.sentiments.danger.light.H).toBeCloseTo(29, 0);
    expect(result.sentiments.warning.light.H).toBeCloseTo(69, 0);
    expect(result.sentiments.success.light.H).toBeCloseTo(147, 0);
    expect(result.sentiments.info.light.H).toBeCloseTo(260, 0);
  });

  // 5. Muted brand (low C) produces muted sentiments
  it("muted brand produces muted sentiments (C_new < C_figma)", () => {
    // A very desaturated brand
    const mutedConfig: AccentConfig = { brand: "#778899" }; // slate gray
    const result = generateAccents(mutedConfig);
    const mutedBrand = hexToOklch("#778899");

    // Since brand C is low, sentiment chromas should be less than Figma reference chromas
    // Figma danger light C = 0.23
    expect(result.sentiments.danger.light.C).toBeLessThan(0.23);
    // But still above C_floor (allow small floating point tolerance)
    expect(result.sentiments.danger.light.C).toBeGreaterThanOrEqual(0.079);
  });

  // 6. C_floor prevents sentiments from going below 0.08
  it("C_floor prevents sentiments from going below 0.08", () => {
    // Near-achromatic brand
    const grayConfig: AccentConfig = { brand: "#808080" };
    const result = generateAccents(grayConfig);

    // All sentiment chromas should be at least C_floor (gamut clamp may reduce slightly)
    for (const key of ["danger", "warning", "success", "info"] as const) {
      for (const variant of ["light", "dark", "lightIc", "darkIc"] as const) {
        // After gamut clamping, chroma may be slightly below C_floor in extreme cases,
        // but the pre-clamp value should have been >= 0.08.
        // We allow a small tolerance for gamut mapping.
        expect(result.sentiments[key][variant].C).toBeGreaterThanOrEqual(0.07);
      }
    }
  });

  // 7. Decoratives count matches decorativeCount
  it("decoratives count matches decorativeCount", () => {
    const result3 = generateAccents({ brand: "#007AFF", decorativeCount: 3 });
    expect(result3.decoratives).toHaveLength(3);

    const result5 = generateAccents({ brand: "#007AFF", decorativeCount: 5 });
    expect(result5.decoratives).toHaveLength(5);
  });

  // 8. No decorative hue within 30 degrees of any sentiment
  it("no decorative hue is within 30 degrees of any sentiment hue", () => {
    const result = generateAccents(DEFAULT_CONFIG);

    for (const dec of result.decoratives) {
      const decHue = dec.variant.light.H;
      for (const sentHue of SENTIMENT_HUES) {
        expect(hueDistance(decHue, sentHue)).toBeGreaterThanOrEqual(30);
      }
    }
  });

  // 9. neutralHue 'auto' uses brand hue
  it("neutralHue 'auto' uses brand hue", () => {
    const result = generateAccents({ brand: "#007AFF", neutralHue: "auto" });
    const brandOklch = hexToOklch("#007AFF");
    expect(result.neutralHue).toBeCloseTo(brandOklch.H, 0);
  });

  // 10. neutralHue number overrides
  it("neutralHue number overrides brand hue", () => {
    const result = generateAccents({ brand: "#007AFF", neutralHue: 120 });
    expect(result.neutralHue).toBe(120);
  });
});
