/**
 * ESM + DTS snapshot lock (G2).
 *
 * @layer Guard
 * @governs plan/test-strategy.md §11 · G2 snapshot ESM stable
 * @invariant `dist/index.js` and `dist/index.d.ts` match their
 *            committed snapshots byte-for-byte.
 * @why The ESM + DTS pair is the JS/TS consumer API surface. Silent
 *      drift here breaks type inference in downstream apps and Tailwind
 *      presets that import token maps directly.
 * @on-fail (a) intentional change (new token, renamed export) → rerun
 *          with `bun test -u` and document the API change in the PR;
 *          (b) unintended → bisect writers/esm.ts or writers/dts.ts.
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

describe('G2 · dist ESM + DTS byte-stable', () => {
  test('dist/index.js matches committed snapshot', () => {
    const js = readFileSync(resolve(pkgRoot, 'dist/index.js'), 'utf-8')
    expect(js).toMatchSnapshot()
  })
  test('dist/index.d.ts matches committed snapshot', () => {
    const dts = readFileSync(resolve(pkgRoot, 'dist/index.d.ts'), 'utf-8')
    expect(dts).toMatchSnapshot()
  })
})
