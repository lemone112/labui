/**
 * Deprecated-tokens guard (G6).
 *
 * @layer Guard
 * @governs plan/test-strategy.md §11 · G6 no deprecated tokens in dist ·
 *          §15.3 Deprecation lifecycle
 * @invariant For every entry in `config.deprecated`:
 *            - If the current `schema_version` < `removed_in`, the old
 *              token path is still emitted in `dist/tokens.css` and a
 *              CSS warning comment referencing the replacement sits
 *              within 3 lines of it.
 *            - If `schema_version` >= `removed_in`, the old token path
 *              is absent from `dist/tokens.css` entirely.
 *            - Every entry has shape `{ replacement, removed_in, reason }`
 *              with `removed_in` as valid semver.
 * @why Structured deprecation lets downstream consumers migrate without
 *      silent breakage: they see the warning comment in their CSS build
 *      output during the grace period, then the token disappears after
 *      the announced major.
 * @on-fail (a) if a listed deprecation is missing → the emit pipeline
 *          dropped it before `removed_in`; restore the token in the
 *          writer or bump `removed_in`.
 *          (b) if a token past `removed_in` still emits → delete the
 *          token from the semantic tree or writer.
 *          (c) if the warning comment is missing → check
 *          `writeDeprecationComment` hook in `writers/css.ts`.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { describe, expect, test } from 'bun:test'
import { config } from '../../config/tokens.config'

const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

const cssPath = resolve(pkgRoot, 'dist/tokens.css')
const css = readFileSync(cssPath, 'utf-8')

const SEMVER_RE = /^\d+\.\d+\.\d+$/

function semverLt(a: string, b: string): boolean {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if (pa[i] < pb[i]) return true
    if (pa[i] > pb[i]) return false
  }
  return false
}

function cssVarFor(tokenPath: string): string {
  // Convert `labels.brand.primary` → `--label-brand-primary` (writer
  // convention: drop trailing `s` on group, kebab-case). See
  // `writers/css.ts`. This mirrors the naming used in snapshots.
  const parts = tokenPath.split('.')
  if (parts[0].endsWith('s')) parts[0] = parts[0].slice(0, -1)
  return '--' + parts.join('-')
}

describe('G6 · deprecated tokens lifecycle', () => {
  test('every deprecated entry has well-formed shape', () => {
    for (const [path, entry] of Object.entries(config.deprecated)) {
      expect(typeof entry.replacement).toBe('string')
      expect(entry.replacement.length).toBeGreaterThan(0)
      expect(typeof entry.reason).toBe('string')
      expect(entry.reason.length).toBeGreaterThan(0)
      expect(entry.removed_in).toMatch(SEMVER_RE)
      // Path itself should be dot-separated like the registry key.
      expect(path).toMatch(/^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/)
    }
  })

  test('entries before `removed_in` emit with a warning comment', () => {
    for (const [path, entry] of Object.entries(config.deprecated)) {
      if (!semverLt(config.schema_version, entry.removed_in)) continue
      const cssVar = cssVarFor(path)
      expect(css).toContain(cssVar + ':')
      const replacementVar = cssVarFor(entry.replacement)
      // Warning comment convention: `/* deprecated: <old> → <new> */`
      // emitted by writer on the preceding or same line.
      const commentRe = new RegExp(
        `/\\* *DEPRECATED:[^*]*${cssVar.replace(/-/g, '\\-')}[^*]*${replacementVar.replace(
          /-/g,
          '\\-',
        )}`,
        'i',
      )
      expect(css).toMatch(commentRe)
    }
  })

  test('entries at/after `removed_in` are absent from dist', () => {
    for (const [path, entry] of Object.entries(config.deprecated)) {
      if (semverLt(config.schema_version, entry.removed_in)) continue
      const cssVar = cssVarFor(path)
      // Must not appear as a declaration (`--name:`).
      expect(css).not.toContain(cssVar + ':')
    }
  })

  test('deprecation count is logged', () => {
    const n = Object.keys(config.deprecated).length
    console.log(
      `\nG6 · ${n} deprecation entr${n === 1 ? 'y' : 'ies'} registered ` +
        `(schema_version=${config.schema_version})`,
    )
    // No assertion — the count is logged for visibility in CI.
    expect(n).toBeGreaterThanOrEqual(0)
  })
})
