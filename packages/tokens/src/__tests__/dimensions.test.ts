import { describe, it, expect } from 'vitest';
import { readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { globSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const tokensRoot = join(__dirname, '..', '..');

async function readJson(relativePath: string) {
  const raw = await readFile(join(tokensRoot, relativePath), 'utf-8');
  return JSON.parse(raw);
}

describe('spacing tokens', () => {
  it('has exactly 21 entries', async () => {
    const json = await readJson('primitive/spacing.tokens.json');
    const entries = Object.keys(json.spacing).filter(k => !k.startsWith('$'));
    expect(entries).toHaveLength(21);
  });

  it('all values are valid CSS dimensions (rem or px or 0)', async () => {
    const json = await readJson('primitive/spacing.tokens.json');
    const entries = Object.entries(json.spacing).filter(([k]) => !k.startsWith('$'));
    for (const [key, token] of entries) {
      const val = (token as { $value: string }).$value;
      expect(val, `spacing.${key}`).toMatch(/^(0|[\d.]+px|[\d.]+rem)$/);
    }
  });
});

describe('radius tokens', () => {
  it('has base value', async () => {
    const json = await readJson('primitive/radius.tokens.json');
    expect(json.radius.base).toBeDefined();
    expect(json.radius.base.$type).toBe('dimension');
    expect(json.radius.base.$value).toBe('0.5rem');
  });
});

describe('elevation tokens', () => {
  it('has exactly 4 levels', async () => {
    const json = await readJson('primitive/elevation.tokens.json');
    const levels = Object.keys(json.elevation).filter(k => !k.startsWith('$'));
    expect(levels).toHaveLength(4);
    expect(levels).toEqual(expect.arrayContaining(['inset', 'surface', 'raised', 'overlay']));
  });
});

describe('blur tokens', () => {
  it('has 7 entries', async () => {
    const json = await readJson('primitive/blur.tokens.json');
    const entries = Object.keys(json.blur).filter(k => !k.startsWith('$'));
    expect(entries).toHaveLength(7);
  });
});

describe('size tokens', () => {
  it('has 8 entries', async () => {
    const json = await readJson('primitive/size.tokens.json');
    const entries = Object.keys(json.size).filter(k => !k.startsWith('$'));
    expect(entries).toHaveLength(8);
  });
});

describe('no --lab- prefix in generated CSS', () => {
  it('theme.css does not contain --lab- prefix', async () => {
    const themePath = join(tokensRoot, 'dist/tailwind/theme.css');
    // Skip explicitly if build hasn't been run
    const exists = await access(themePath).then(() => true).catch(() => false);
    if (!exists) {
      console.warn('SKIPPED: dist/ not found. Run `npm run build` first.');
      return;
    }
    const css = await readFile(themePath, 'utf-8');
    expect(css).not.toMatch(/--lab-/);
  });
});
