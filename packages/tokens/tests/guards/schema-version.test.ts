/**
 * Schema backward-compat guard (G8).
 *
 * @layer Guard
 * @governs plan/test-strategy.md §11 · G8 config schema backward compat
 * @invariant `config.schema_version` tracks `package.json.version` at
 *            (major, minor) granularity. Patch drift is allowed (pure
 *            bugfix releases don't have to touch the config shape), but
 *            a minor or major bump in the package MUST correspond to
 *            either (a) a matching schema bump + migration note, OR
 *            (b) an additive-only change that doesn't rename / remove
 *            cells.
 *
 *            Breaking changes (removed / renamed cells) additionally
 *            require a `config.deprecated` entry announcing the removal
 *            at least one minor release before it lands (see G6).
 * @why Without this pin, a consumer upgrading `@lab-ui/tokens` from
 *      0.2.x → 0.3.x can't tell from the version alone whether the
 *      config shape changed under them. The schema_version is the
 *      contract.
 * @on-fail Either bump `config.schema_version` to match the package
 *          version, or roll the package version back until a
 *          CHANGELOG entry + schema bump lands together.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { describe, expect, test } from 'bun:test'
import { config } from '../../config/tokens.config'

const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const pkg = JSON.parse(
  readFileSync(resolve(pkgRoot, 'package.json'), 'utf-8'),
) as { version: string }

const SEMVER_RE = /^\d+\.\d+\.\d+$/

function parseSemver(v: string): [number, number, number] {
  const parts = v.split('.').map(Number)
  return [parts[0], parts[1], parts[2]]
}

describe('G8 · config schema backward compat', () => {
  test('schema_version is a well-formed semver', () => {
    expect(config.schema_version).toMatch(SEMVER_RE)
  })

  test('package.json version is a well-formed semver', () => {
    expect(pkg.version).toMatch(SEMVER_RE)
  })

  test('schema_version (major, minor) equals package.json (major, minor)', () => {
    const [sMaj, sMin] = parseSemver(config.schema_version)
    const [pMaj, pMin] = parseSemver(pkg.version)
    expect([sMaj, sMin]).toEqual([pMaj, pMin])
  })

  test('every deprecated.removed_in is > current schema_version', () => {
    // All listed deprecations must still be in-flight; entries past
    // `removed_in` should have been cleaned from the registry together
    // with the removal PR that bumped schema_version.
    for (const [path, entry] of Object.entries(config.deprecated)) {
      const [sMaj, sMin, sPat] = parseSemver(config.schema_version)
      const [rMaj, rMin, rPat] = parseSemver(entry.removed_in)
      const schemaGte =
        rMaj < sMaj ||
        (rMaj === sMaj && rMin < sMin) ||
        (rMaj === sMaj && rMin === sMin && rPat <= sPat)
      expect(schemaGte).toBe(false)
      // If this assertion fires, either delete `${path}` or bump
      // `removed_in` past schema_version.
      if (schemaGte) {
        console.error(
          `Stale deprecation: "${path}" should have been removed ` +
            `at schema ${entry.removed_in} but schema is ${config.schema_version}.`,
        )
      }
    }
  })
})
