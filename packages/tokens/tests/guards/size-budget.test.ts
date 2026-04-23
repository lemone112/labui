/**
 * Size budget guard.
 *
 * @layer Guard
 * @governs plan/test-strategy.md §11 · G5 dist size budget
 * @invariant `dist/tokens.css` gzipped stays under 30 KB. ESM bundle
 *            (`dist/index.js`) under 10 KB gzipped; type declarations
 *            (`dist/index.d.ts`) under 6 KB gzipped. Budgets are
 *            deliberately slightly above the current baseline so
 *            routine edits are free but runaway growth is caught.
 * @why If the emit layer balloons without anyone noticing, downstream
 *      consumers (Tailwind preset, app bundles) pay the cost silently.
 *      Guarding here forces intentional conversations.
 * @on-fail (a) new tokens pushed an output past budget → raise the
 *          budget here with a one-line rationale; (b) emit regressed
 *          (duplicated rules, verbose selectors, lost deduping) →
 *          investigate the writer that grew fastest.
 */

import { describe, expect, test } from 'bun:test'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const pkgRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
)

// KB budgets for gzipped output. If you raise these, leave a breadcrumb
// comment on the line so future readers can see why the budget grew.
const BUDGETS_GZ_KB: Record<string, number> = {
  'dist/tokens.css': 30,
  'dist/index.js': 10,
  'dist/index.d.ts': 6,
  'dist/tailwind-preset.css': 8,
}

function gzBytes(path: string): number {
  const raw = readFileSync(path)
  return Bun.gzipSync(raw).byteLength
}

describe('Size budget · gzipped dist outputs', () => {
  for (const [rel, budgetKB] of Object.entries(BUDGETS_GZ_KB)) {
    const abs = resolve(pkgRoot, rel)
    test(`${rel} ≤ ${budgetKB} KB gzipped`, () => {
      if (!existsSync(abs)) {
        throw new Error(
          `${rel} missing — run \`bun run build\` before \`bun test\`.`,
        )
      }
      const bytes = gzBytes(abs)
      const kb = bytes / 1024
      expect(kb).toBeLessThanOrEqual(budgetKB)
    })
  }
})
