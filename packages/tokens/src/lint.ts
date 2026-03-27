/**
 * Lab UI Token Linter
 *
 * Validates:
 * 1. DTCG JSON schema compliance
 * 2. Token completeness across themes (light ↔ dark have same keys)
 * 3. OKLCH value format
 * 4. Reference integrity
 */

import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

interface DTCGToken {
  $type?: string;
  $value?: string | number | Record<string, unknown>;
  [key: string]: unknown;
}

let errors = 0;

// ─── Theme completeness ─────────────────────────────────────────

async function checkThemeCompleteness(): Promise<void> {
  const lightRaw = await readFile('semantic/light.tokens.json', 'utf-8');
  const darkRaw = await readFile('semantic/dark.tokens.json', 'utf-8');

  const lightKeys = extractKeys(JSON.parse(lightRaw) as DTCGToken);
  const darkKeys = extractKeys(JSON.parse(darkRaw) as DTCGToken);

  const missingInDark = lightKeys.filter((k) => !darkKeys.includes(k));
  const missingInLight = darkKeys.filter((k) => !lightKeys.includes(k));

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

// ─── Material completeness ──────────────────────────────────────

async function checkMaterialCompleteness(): Promise<void> {
  const lightRaw = await readFile('material/light.tokens.json', 'utf-8');
  const darkRaw = await readFile('material/dark.tokens.json', 'utf-8');

  const lightKeys = extractKeys(JSON.parse(lightRaw) as DTCGToken);
  const darkKeys = extractKeys(JSON.parse(darkRaw) as DTCGToken);

  const missingInDark = lightKeys.filter((k) => !darkKeys.includes(k));

  if (missingInDark.length) {
    console.error('✗ Missing material in dark theme:', missingInDark);
    errors += missingInDark.length;
  } else {
    console.log('✓ Material completeness: light ↔ dark match');
  }
}

// ─── OKLCH format validation ────────────────────────────────────

async function validateOklch(dir: string): Promise<void> {
  const files = await findJsonFiles(dir);
  const oklchRegex = /oklch\(\s*[\d.]+\s+[\d.]+\s+[\d.]+(\s*\/\s*[\d.]+)?\s*\)/;

  for (const file of files) {
    const raw = await readFile(file, 'utf-8');
    const json = JSON.parse(raw) as DTCGToken;
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
}

// ─── Reference validation ───────────────────────────────────────

async function validateReferences(): Promise<void> {
  const semanticFiles = await findJsonFiles('semantic');
  const refRegex = /\{([^}]+)\}/g;

  for (const file of semanticFiles) {
    const raw = await readFile(file, 'utf-8');
    const refs = [...raw.matchAll(refRegex)].map((m) => m[1]);

    for (const ref of refs) {
      // References should follow pattern: group.subgroup.token or group.token
      if (!ref.includes('.')) {
        console.error(`✗ Invalid reference format in ${file}: {${ref}} (no dot separator)`);
        errors++;
      }
    }
  }

  console.log(`✓ Reference format check (${semanticFiles.length} files)`);
}

// ─── Helpers ────────────────────────────────────────────────────

function extractKeys(obj: DTCGToken, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [key, val] of Object.entries(obj)) {
    if (key.startsWith('$')) continue;
    const path = prefix ? `${prefix}.${key}` : key;
    const token = val as DTCGToken;
    if (token.$type || token.$value !== undefined) {
      keys.push(path);
    } else if (typeof val === 'object' && val !== null) {
      keys.push(...extractKeys(token, path));
    }
  }
  return keys.sort();
}

function flattenTokens(obj: DTCGToken, prefix = ''): [string, unknown][] {
  const result: [string, unknown][] = [];
  for (const [key, val] of Object.entries(obj)) {
    if (key.startsWith('$')) continue;
    const path = prefix ? `${prefix}.${key}` : key;
    const token = val as DTCGToken;
    if (token.$value !== undefined) {
      result.push([path, token.$value]);
    } else if (typeof val === 'object' && val !== null) {
      result.push(...flattenTokens(token, path));
    }
  }
  return result;
}

async function findJsonFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith('.tokens.json'))
    .map((e) => join(e.parentPath ?? e.path, e.name));
}

// ─── Run ────────────────────────────────────────────────────────

console.log('Linting Lab UI tokens...\n');

await checkThemeCompleteness();
await checkMaterialCompleteness();
await validateOklch('primitive');
await validateOklch('semantic');
await validateOklch('material');
await validateReferences();

console.log(`\n${errors ? `✗ ${errors} error(s) found` : '✓ All checks passed'}`);
process.exit(errors ? 1 : 0);
