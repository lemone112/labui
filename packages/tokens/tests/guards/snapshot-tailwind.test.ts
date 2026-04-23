/**
 * Tailwind v4 preset snapshot lock.
 *
 * @layer Guard
 * @governs plan/implementation-plan-v2.md §16 · Tailwind v4 preset
 * @invariant `dist/tailwind-preset.css` matches the committed snapshot
 *            byte-for-byte. Protects the public `@lab-ui/tokens/tailwind`
 *            surface that downstream Tailwind consumers import.
 * @why The preset is a thin mapping layer over the primitive / semantic
 *      namespaces. Silent changes to its shape break utility class
 *      resolution in consumer apps without surfacing in CSS-level tests.
 * @on-fail (a) intentional shape change → rerun with `bun test -u`,
 *          note the new/removed mappings in the PR body; (b) unintended
 *          → inspect `src/writers/tailwind-preset.ts` and the data it
 *          receives from the build.
 */

import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const pkgRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
)

describe('Tailwind preset · dist/tailwind-preset.css byte-stable', () => {
  test('matches committed snapshot', () => {
    const css = readFileSync(
      resolve(pkgRoot, 'dist/tailwind-preset.css'),
      'utf-8',
    )
    expect(css).toMatchSnapshot()
  })
})
