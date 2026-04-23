/**
 * Header lint — every test file must carry the required documentation
 * headers so the test catalog + plan-coverage scripts have something to
 * index.
 *
 * @layer Guard
 * @governs plan/test-strategy.md §14 · Self-documenting tests
 * @invariant Each `tests/**\/*.test.ts` file has a top-of-file JSDoc block
 *            containing @layer, @governs, @invariant, and @on-fail.
 * @why Agents working in the future need bidirectional traceability
 *      between the plan and the tests. Missing headers cause orphan
 *      tests or uncovered plan claims.
 * @on-fail add the missing tag to the file's top JSDoc block. Example:
 *          @layer L3 · Primitives · @governs plan-v2 §4 · @invariant …
 *          · @on-fail …
 */

import { describe, expect, test } from 'bun:test'
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const testsRoot = join(pkgRoot, 'tests')

async function collect(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) files.push(...(await collect(full)))
    else if (entry.name.endsWith('.test.ts')) files.push(full)
  }
  return files
}

const REQUIRED_TAGS = ['@layer', '@governs', '@invariant', '@on-fail']

describe('Guard · test-file headers', () => {
  test('every test file has @layer/@governs/@invariant/@on-fail', async () => {
    const files = await collect(testsRoot)
    const offenders: Array<{ file: string; missing: string[] }> = []

    for (const file of files) {
      const src = await readFile(file, 'utf-8')
      const header = src.slice(0, 2000)
      const missing = REQUIRED_TAGS.filter((tag) => !header.includes(tag))
      if (missing.length) {
        offenders.push({
          file: file.replace(pkgRoot + '/', ''),
          missing,
        })
      }
    }

    if (offenders.length) {
      const msg = offenders
        .map((o) => `  ${o.file} missing ${o.missing.join(', ')}`)
        .join('\n')
      throw new Error(
        `${offenders.length} test file(s) lack required headers:\n${msg}\n` +
          `Add the missing tag(s) to the file's top JSDoc block. See ` +
          `plan/test-strategy.md §14.1 for the required shape.`,
      )
    }
    expect(offenders.length).toBe(0)
  })
})
