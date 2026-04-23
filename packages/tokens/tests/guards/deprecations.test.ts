/**
 * Deprecated-tokens guard (G6).
 *
 * @layer Guard
 * @governs plan/test-strategy.md §11 · G6 no deprecated tokens in dist
 * @invariant For every entry in `config.deprecated` (keys are the
 *            literal `--` CSS var name, see `DeprecationEntry` doc):
 *            - If the current `schema_version` < `removed_in`, the old
 *              variable name is still emitted in `dist/tokens.css`
 *              (`--name:` declaration present) and a
 *              `/* DEPRECATED: <old> → <new> ... *\/` comment with
 *              the replacement sits in the banner at the top.
 *            - If `schema_version` >= `removed_in`, the old variable
 *              name is absent from `dist/tokens.css` entirely.
 *            - Every entry has shape `{ replacement, removed_in, reason }`
 *              with both the key and `replacement` starting with `--`
 *              and matching `^--[a-z][a-z0-9-]*$`, and `removed_in` is
 *              valid semver.
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
 *          `formatDeprecationBanner` in `writers/css.ts`.
 *          (d) if the key / replacement fails the `--` shape check →
 *          someone tried to use a dotted path instead of the emitted
 *          CSS var name; see `DeprecationEntry` doc for rationale.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { describe, expect, test } from 'bun:test'
import { config } from '../../config/tokens.config'

const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const css = readFileSync(resolve(pkgRoot, 'dist/tokens.css'), 'utf-8')

const SEMVER_RE = /^\d+\.\d+\.\d+$/
const CSS_VAR_RE = /^--[a-z][a-z0-9-]*$/

function semverLt(a: string, b: string): boolean {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if (pa[i] < pb[i]) return true
    if (pa[i] > pb[i]) return false
  }
  return false
}

describe('G6 · deprecated tokens lifecycle', () => {
  test('every deprecated key + replacement is a well-formed CSS var name', () => {
    for (const [oldVar, entry] of Object.entries(config.deprecated)) {
      // Keys must be the literal emitted CSS variable name, NOT a
      // dotted config path — the semantic tree uses hand-crafted
      // abbreviations that can't be derived mechanically (see
      // `DeprecationEntry` doc).
      expect(oldVar).toMatch(CSS_VAR_RE)
      expect(entry.replacement).toMatch(CSS_VAR_RE)
      expect(entry.reason.length).toBeGreaterThan(0)
      expect(entry.removed_in).toMatch(SEMVER_RE)
    }
  })

  test('entries before `removed_in` emit with a warning comment', () => {
    for (const [oldVar, entry] of Object.entries(config.deprecated)) {
      if (!semverLt(config.schema_version, entry.removed_in)) continue
      // Declaration exists somewhere in the file.
      expect(css).toContain(oldVar + ':')
      // Warning comment uses the exact same names, verbatim.
      const commentRe = new RegExp(
        `/\\* *DEPRECATED: *${oldVar.replace(/-/g, '\\-')} *→ *${entry.replacement.replace(
          /-/g,
          '\\-',
        )}`,
      )
      expect(css).toMatch(commentRe)
    }
  })

  test('entries at/after `removed_in` are absent from dist', () => {
    for (const [oldVar, entry] of Object.entries(config.deprecated)) {
      if (semverLt(config.schema_version, entry.removed_in)) continue
      // Must not appear as a declaration (`--name:`).
      expect(css).not.toContain(oldVar + ':')
    }
  })

  test('deprecation count is logged', () => {
    const n = Object.keys(config.deprecated).length
    console.log(
      `\nG6 · ${n} deprecation entr${n === 1 ? 'y' : 'ies'} registered ` +
        `(schema_version=${config.schema_version})`,
    )
    expect(n).toBeGreaterThanOrEqual(0)
  })
})
