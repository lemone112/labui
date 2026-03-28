/**
 * Lab UI Token Linter
 *
 * Validates:
 * 1. DTCG JSON schema compliance
 * 2. Token completeness across all 4 themes (light <-> dark <-> light-ic <-> dark-ic)
 * 3. OKLCH value format
 * 4. Reference integrity (13-step neutral, 9-stop alpha, accent refs)
 */

import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import path from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const tokensRoot = path.resolve(__dirname, '..');

interface DTCGToken {
  $type?: string;
  $value?: string | number | Record<string, unknown>;
  [key: string]: unknown;
}

type ThemeName = 'light' | 'dark' | 'light-ic' | 'dark-ic';

const THEME_FILES: Record<ThemeName, string> = {
  light: path.resolve(tokensRoot, 'semantic/light.tokens.json'),
  dark: path.resolve(tokensRoot, 'semantic/dark.tokens.json'),
  'light-ic': path.resolve(tokensRoot, 'semantic/light-ic.tokens.json'),
  'dark-ic': path.resolve(tokensRoot, 'semantic/dark-ic.tokens.json'),
};

let errors = 0;

// --- Theme completeness (all 4 themes) --------------------------------

async function checkThemeCompleteness(): Promise<void> {
  const themeKeys: Record<ThemeName, string[]> = {} as Record<ThemeName, string[]>;

  for (const [name, path] of Object.entries(THEME_FILES) as [ThemeName, string][]) {
    const raw = await readFile(path, 'utf-8');
    themeKeys[name] = extractKeys(JSON.parse(raw) as DTCGToken);
  }

  // Build a superset of all keys
  const allKeys = [...new Set(Object.values(themeKeys).flat())].sort();
  const names = Object.keys(themeKeys) as ThemeName[];

  let themeMismatch = false;
  for (const key of allKeys) {
    const missing = names.filter((n) => !themeKeys[n].includes(key));
    if (missing.length) {
      console.error(`\u2717 Token "${key}" missing in: ${missing.join(', ')}`);
      errors += missing.length;
      themeMismatch = true;
    }
  }

  if (!themeMismatch) {
    console.log('\u2713 Theme completeness: light \u2194 dark \u2194 light-ic \u2194 dark-ic match');
  }
}

// --- Material completeness --------------------------------------------

async function checkMaterialCompleteness(): Promise<void> {
  const lightRaw = await readFile(path.resolve(tokensRoot, 'material/light.tokens.json'), 'utf-8');
  const darkRaw = await readFile(path.resolve(tokensRoot, 'material/dark.tokens.json'), 'utf-8');

  const lightKeys = extractKeys(JSON.parse(lightRaw) as DTCGToken);
  const darkKeys = extractKeys(JSON.parse(darkRaw) as DTCGToken);

  const missingInDark = lightKeys.filter((k) => !darkKeys.includes(k));
  const missingInLight = darkKeys.filter((k) => !lightKeys.includes(k));

  if (missingInDark.length) {
    console.error('\u2717 Missing material in dark theme:', missingInDark);
    errors += missingInDark.length;
  }
  if (missingInLight.length) {
    console.error('\u2717 Missing material in light theme:', missingInLight);
    errors += missingInLight.length;
  }

  if (!missingInDark.length && !missingInLight.length) {
    console.log('\u2713 Material completeness: light \u2194 dark match');
  }
}

// --- OKLCH format validation ------------------------------------------

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
          console.error(`\u2717 Invalid OKLCH in ${file}: ${path} = ${value}`);
          errors++;
        }
      }
    }
  }
}

// --- Reference validation (v3 token names) ----------------------------

async function validateReferences(): Promise<void> {
  const semanticFiles = await findJsonFiles(path.resolve(tokensRoot, 'semantic'));
  const refRegex = /\{([^}]+)\}/g;

  // Valid reference patterns for v3:
  // - 13-step neutral: {neutral.0} .. {neutral.12}
  // - neutral-dark variants: {neutral-dark.0} .. {neutral-dark.12}
  // - 9-stop alpha accent: {brand.12}, {danger.52}, etc.
  // - hue refs: {hue.brand}, {hue.danger}, etc.
  // - opacity refs: {opacity.thin}, {opacity.soft}, etc.
  // - General dotted path: group.subgroup.token
  const validPatterns = [
    /^neutral\.\d{1,2}$/,
    /^(neutral-dark|neutral-light|neutral-mid)\.\d{1,2}$/,
    /^(brand|danger|warning|success|info)\.\d{1,2}$/,
    /^hue\.(brand|danger|warning|success|info)\.(light|dark|light-ic|dark-ic)$/,
    /^opacity\.(2|4|8|12|20|32|52|72|80)$/,
    // Semantic token references
    /^(bg|fill|label|border|fx)\.[a-z][a-z-]+(\.[\w-]+)*$/,
    /^(size|spacing|radius|typography|elevation|blur)\.[\w-]+$/,
  ];

  let refCount = 0;
  let invalidCount = 0;

  for (const file of semanticFiles) {
    const raw = await readFile(file, 'utf-8');
    const json = JSON.parse(raw) as DTCGToken;
    const tokens = flattenTokens(json);

    for (const [path, value] of tokens) {
      if (typeof value !== 'string') continue;
      const refs = [...value.matchAll(refRegex)].map((m) => m[1]);

      for (const ref of refs) {
        refCount++;
        const isValid = validPatterns.some((pattern) => pattern.test(ref));
        if (!isValid) {
          console.error(`\u2717 Invalid reference format in ${file}: ${path} -> {${ref}}`);
          errors++;
          invalidCount++;
        }
      }
    }
  }

  if (invalidCount === 0) {
    console.log(`\u2713 Reference format check (${refCount} refs in ${semanticFiles.length} files)`);
  }
}

// --- Helpers ----------------------------------------------------------

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

// --- Run --------------------------------------------------------------

console.log('Linting Lab UI tokens...\n');

await checkThemeCompleteness();
await checkMaterialCompleteness();
await validateOklch(path.resolve(tokensRoot, 'primitive'));
await validateOklch(path.resolve(tokensRoot, 'semantic'));
await validateOklch(path.resolve(tokensRoot, 'material'));
await validateReferences();

console.log(`\n${errors ? `\u2717 ${errors} error(s) found` : '\u2713 All checks passed'}`);
process.exit(errors ? 1 : 0);
