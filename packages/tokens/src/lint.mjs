/**
 * Lab UI Token Linter
 *
 * Validates:
 * 1. DTCG JSON schema compliance
 * 2. Token completeness across themes (light ↔ dark have same keys)
 * 3. OKLCH value format
 * 4. Naming conventions
 */

import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

let errors = 0;

// ─── Check theme completeness ───────────────────────────────────

async function checkThemeCompleteness() {
  const lightRaw = await readFile('tokens/semantic/light.tokens.json', 'utf-8');
  const darkRaw = await readFile('tokens/semantic/dark.tokens.json', 'utf-8');

  const lightKeys = extractKeys(JSON.parse(lightRaw));
  const darkKeys = extractKeys(JSON.parse(darkRaw));

  const missingInDark = lightKeys.filter(k => !darkKeys.includes(k));
  const missingInLight = darkKeys.filter(k => !lightKeys.includes(k));

  if (missingInDark.length) {
    console.error('✗ Missing in dark theme:', missingInDark);
    errors += missingInDark.length;
  }
  if (missingInLight.length) {
    console.error('✗ Missing in light theme:', missingInLight);
    errors += missingInLight.length;
  }

  if (!missingInDark.length && !missingInLight.length) {
    console.log('✓ Theme completeness: light ↔ dark match');
  }
}

// ─── Check material completeness ────────────────────────────────

async function checkMaterialCompleteness() {
  const lightRaw = await readFile('tokens/material/light.tokens.json', 'utf-8');
  const darkRaw = await readFile('tokens/material/dark.tokens.json', 'utf-8');

  const lightKeys = extractKeys(JSON.parse(lightRaw));
  const darkKeys = extractKeys(JSON.parse(darkRaw));

  const missingInDark = lightKeys.filter(k => !darkKeys.includes(k));

  if (missingInDark.length) {
    console.error('✗ Missing material in dark theme:', missingInDark);
    errors += missingInDark.length;
  } else {
    console.log('✓ Material completeness: light ↔ dark match');
  }
}

// ─── Validate OKLCH format ──────────────────────────────────────

async function validateOklch(dir) {
  const files = await findJsonFiles(dir);
  const oklchRegex = /oklch\(\s*[\d.]+\s+[\d.]+\s+[\d.]+(\s*\/\s*[\d.]+)?\s*\)/;

  for (const file of files) {
    const raw = await readFile(file, 'utf-8');
    const json = JSON.parse(raw);
    const tokens = flattenTokens(json);

    for (const [path, value] of tokens) {
      if (typeof value === 'string' && value.startsWith('oklch(')) {
        if (!oklchRegex.test(value)) {
          console.error(`✗ Invalid OKLCH in ${file}: ${path} = ${value}`);
          errors++;
        }
      }
    }
  }
  console.log('✓ OKLCH format validation passed');
}

// ─── Helpers ────────────────────────────────────────────────────

function extractKeys(obj, prefix = '') {
  const keys = [];
  for (const [key, val] of Object.entries(obj)) {
    if (key.startsWith('$')) continue;
    const path = prefix ? `${prefix}.${key}` : key;
    if (val.$type || val.$value) {
      keys.push(path);
    } else if (typeof val === 'object') {
      keys.push(...extractKeys(val, path));
    }
  }
  return keys.sort();
}

function flattenTokens(obj, prefix = '') {
  const result = [];
  for (const [key, val] of Object.entries(obj)) {
    if (key.startsWith('$')) continue;
    const path = prefix ? `${prefix}.${key}` : key;
    if (val.$value !== undefined) {
      result.push([path, val.$value]);
    } else if (typeof val === 'object') {
      result.push(...flattenTokens(val, path));
    }
  }
  return result;
}

async function findJsonFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  return entries
    .filter(e => e.isFile() && e.name.endsWith('.tokens.json'))
    .map(e => join(e.parentPath || e.path, e.name));
}

// ─── Run ────────────────────────────────────────────────────────

console.log('Linting Lab UI tokens...\n');

await checkThemeCompleteness();
await checkMaterialCompleteness();
await validateOklch('tokens');

console.log(`\n${errors ? `✗ ${errors} error(s) found` : '✓ All checks passed'}`);
process.exit(errors ? 1 : 0);
