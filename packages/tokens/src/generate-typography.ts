import { typographyConfig } from './typography.config.js';
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const tokensRoot = join(__dirname, '..');

interface TypeStep {
  name: string;
  sizePx: number;
  sizeRem: number;
  lineHeight: number;
  letterSpacing: string; // em
}

export function generateTypeScale(config = typographyConfig): TypeStep[] {
  const { base, uiRatio, displayRatio, lineHeightK, trackingRate, trackingThreshold, roundTo } = config;

  // UI zone: base x ratio^n — steps tuned to hit Figma reference sizes
  // [8, 10, 12, 14, 16, 20, 24, 32] after binary rounding
  const uiSteps = [-3, -2, -1.5, -0.6, 0, 1, 1.85, 3];
  const uiSizes = uiSteps.map(n => {
    const raw = base * Math.pow(uiRatio, n);
    return Math.round(raw / roundTo) * roundTo;
  });

  // Display zone: from heading (step 3) upward with displayRatio
  // Steps tuned to hit Figma reference sizes [48, 64, 80, 112] after rounding
  const headingSize = uiSizes[uiSizes.length - 1]; // 32px
  const displaySteps = [1, 1.7, 2.27, 3.1];
  const displaySizes = displaySteps.map(m => {
    const raw = headingSize * Math.pow(displayRatio, m);
    return Math.round(raw / roundTo) * roundTo;
  });

  const names = ['micro', 'caption', 'label', 'body-sm', 'body', 'body-lg', 'subheading', 'heading', 'display-sm', 'display', 'hero', 'mega'];
  const allSizes = [...uiSizes, ...displaySizes];

  return names.map((name, i) => {
    const sizePx = allSizes[i];
    const sizeRem = sizePx / 16;

    // Line height: 1 + k/size, clamped [1.0, 1.75], rounded to 0.05
    const rawLH = 1 + lineHeightK / sizePx;
    const clampedLH = Math.min(1.75, Math.max(1.0, rawLH));
    const lineHeight = Math.round(clampedLH * 20) / 20; // round to 0.05

    // Tracking: negative above threshold, proportional to size
    const trackingEm = sizePx <= trackingThreshold
      ? 0
      : -(trackingRate * (sizePx - trackingThreshold)) / (sizePx * 100);
    const letterSpacing = trackingEm === 0 ? '0em' : `${trackingEm.toFixed(3)}em`;

    return { name, sizePx, sizeRem, lineHeight, letterSpacing };
  });
}

export async function generateTypographyTokens(config = typographyConfig): Promise<void> {
  const scale = generateTypeScale(config);

  const tokens: Record<string, unknown> = {
    $schema: 'https://tr.designtokens.org/format/',
    typography: {
      $description: `Type scale. UI ratio: ${config.uiRatio}, Display ratio: ${config.displayRatio}. Base: ${config.base}px. Generated.`,
      family: {
        sans: { $type: 'fontFamily', $value: `${config.fontFamily}, ui-sans-serif, system-ui, sans-serif` },
        mono: { $type: 'fontFamily', $value: `${config.monoFamily}, ui-monospace, monospace` },
      },
      size: {} as Record<string, unknown>,
      lineHeight: {} as Record<string, unknown>,
      letterSpacing: {} as Record<string, unknown>,
      weight: {
        regular: { $type: 'number', $value: 400 },
        medium: { $type: 'number', $value: 500 },
        semibold: { $type: 'number', $value: 600 },
        bold: { $type: 'number', $value: 700 },
      },
    },
  };

  const typo = tokens.typography as Record<string, Record<string, unknown>>;
  const sizeGroup = typo.size;
  const lhGroup = typo.lineHeight;
  const lsGroup = typo.letterSpacing;

  for (const step of scale) {
    sizeGroup[step.name] = { $type: 'dimension', $value: `${step.sizeRem}rem` };
    lhGroup[step.name] = { $type: 'number', $value: step.lineHeight };
    lsGroup[step.name] = { $type: 'dimension', $value: step.letterSpacing };
  }

  await writeFile(
    join(tokensRoot, 'primitive/typography.tokens.json'),
    JSON.stringify(tokens, null, 2) + '\n',
  );

  console.log(`  OK Generated ${scale.length}-step type scale (UI: ${config.uiRatio}, Display: ${config.displayRatio})`);
}
