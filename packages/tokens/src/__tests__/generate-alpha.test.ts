import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const tokensRoot = join(__dirname, '..', '..');

describe('generate-alpha (integration)', () => {
  // These tests read the generated output — run pnpm build first

  it('generated/alpha.tokens.json exists and is valid JSON', async () => {
    const raw = await readFile(join(tokensRoot, 'generated/alpha.tokens.json'), 'utf-8');
    const data = JSON.parse(raw);
    expect(data).toBeDefined();
    expect(data.$schema).toBe('https://tr.designtokens.org/format/');
  });

  it('has all expected accent groups', async () => {
    const raw = await readFile(join(tokensRoot, 'generated/alpha.tokens.json'), 'utf-8');
    const data = JSON.parse(raw);
    const expectedGroups = ['neutral-light', 'neutral-dark', 'neutral-mid'];
    for (const group of expectedGroups) {
      expect(data[group]).toBeDefined();
    }
  });

  it('each accent group has 9 opacity stops', async () => {
    const raw = await readFile(join(tokensRoot, 'generated/alpha.tokens.json'), 'utf-8');
    const data = JSON.parse(raw);
    const neutralDark = data['neutral-dark'];
    // Filter out $-prefixed metadata keys
    const stops = Object.keys(neutralDark).filter(k => !k.startsWith('$'));
    expect(stops.length).toBe(9);
  });

  it('alpha values contain oklch with / alpha syntax', async () => {
    const raw = await readFile(join(tokensRoot, 'generated/alpha.tokens.json'), 'utf-8');
    const data = JSON.parse(raw);
    const firstStop = data['neutral-dark']['2'];
    expect(firstStop.$value).toMatch(/oklch\(.+\/.+\)/);
  });
});
