export const typographyConfig = {
  base: 16,
  fontFamily: 'Geist',
  monoFamily: 'Geist Mono',

  // Ratios -- change these -> whole scale recalculates
  uiRatio: 1.25,        // Major Third -- for sizes <= 32px
  displayRatio: 1.5,     // Perfect Fifth -- for sizes > 32px

  // Line height: lineHeight = clamp(1.0, round(1 + k/size, 0.05), 1.75)
  lineHeightK: 8,

  // Tracking: tracking = -rate * max(0, (size - threshold)) / (size * 100)
  trackingRate: 0.8,
  trackingThreshold: 14,

  // Binary rounding
  roundTo: 2,
};
