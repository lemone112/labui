import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const semanticDir = join(__dirname, '..', '..', 'semantic');

function flattenKeys(obj: Record<string, any>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (k.startsWith('$')) continue;
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !('$value' in v)) {
      keys.push(...flattenKeys(v, path));
    } else {
      keys.push(path);
    }
  }
  return keys.sort();
}

describe("cross-theme consistency", () => {
  const themes = ['light', 'dark', 'light-ic', 'dark-ic'];

  it("all 4 themes have identical token key sets", async () => {
    const keySets: Record<string, string[]> = {};
    for (const theme of themes) {
      const raw = await readFile(join(semanticDir, `${theme}.tokens.json`), 'utf-8');
      keySets[theme] = flattenKeys(JSON.parse(raw));
    }

    const reference = keySets['light'];
    for (const theme of ['dark', 'light-ic', 'dark-ic']) {
      const missing = reference.filter(k => !keySets[theme].includes(k));
      const extra = keySets[theme].filter(k => !reference.includes(k));
      expect(missing).toEqual([]);
      expect(extra).toEqual([]);
    }
  });
});
