/**
 * CSS snapshot lock (G1).
 *
 * @layer Guard
 * @governs plan/test-strategy.md §11 · G1 snapshot CSS stable
 * @invariant `dist/tokens.css` matches the committed snapshot
 *            byte-for-byte. Routine edits that touch the emit layer
 *            surface here as an obvious diff in CI.
 * @why Without a full-output lock, small writer tweaks (e.g. a stray
 *      space, a reordered family) slip through and break downstream
 *      consumers' own snapshot tests silently.
 * @on-fail (a) intentional change → rerun with `bun test -u` to update
 *          the snapshot, and note the user-visible change in the PR
 *          body; (b) unintended → bisect recent commits to the emit
 *          layer (writers/*, generators/*).
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

describe('G1 · dist/tokens.css byte-stable', () => {
  test('matches committed snapshot', () => {
    const css = readFileSync(resolve(pkgRoot, 'dist/tokens.css'), 'utf-8')
    expect(css).toMatchSnapshot()
  })
})
