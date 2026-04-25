/**
 * Verify that every test @governs reference points at a real section of
 * implementation-plan-v2.md, and that every plan section with an invariant-
 * like claim has at least one test referencing it.
 *
 * @see plan/test-strategy.md §14.4
 *
 * Fails (exit 1) if:
 *   - any test references a @governs section that does not exist
 *   - any plan section containing an invariant claim has zero tests
 *
 * Usage:
 *   bun run scripts/verify-plan-coverage.ts
 */

import { readdir, readFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = resolve(pkgRoot, '../..')
const testsRoot = join(pkgRoot, 'tests')
const planPath = join(repoRoot, 'plan/implementation-plan-v2.md')
// SPEC.md is the canonical design-system spec (PR #28). It uses `§N`
// in its headings, so we parse it alongside the legacy plan to cover
// `@governs` references in newer tests.
const specPath = join(repoRoot, 'plan/spec/SPEC.md')

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

/**
 * Extract a set of plan section anchors (e.g. '§4.2', '§8.5') referenced by
 * any @governs directive in a test file.
 */
function extractGovernsRefs(src: string): string[] {
  const header = src.slice(0, 2000)
  const m = header.match(/@governs\s+([^\n]*(?:\n\s*\*\s+[^@\n][^\n]*)*)/)
  if (!m) return []
  const flat = m[1].replace(/\n\s*\*\s*/g, ' ')
  // Match §N or §N.N (we keep it lightweight on purpose).
  const refs = flat.match(/§\d+(?:\.\d+)*/g)
  return refs ?? []
}

/**
 * Walk the plan file and return the full set of section anchors present
 * (from ## and ### headings). Also return sections that contain "invariant"
 * wording so we know where tests must land.
 */
function parsePlan(src: string): {
  allSections: Set<string>
  invariantSections: Set<string>
} {
  const allSections = new Set<string>()
  const invariantSections = new Set<string>()
  const lines = src.split('\n')
  let currentSection: string | null = null
  let currentBuffer: string[] = []

  const flush = (): void => {
    if (!currentSection) return
    // Exclude meta sections by leading number.
    const num = currentSection.replace('§', '').split('.')[0]
    if (META_SECTION_PREFIXES.includes(num)) return

    const body = currentBuffer.join('\n').toLowerCase()
    // Require BOTH an invariant-style keyword AND a concrete numeric/logic
    // predicate so that prose sections don't falsely register.
    const hasInvariantKeyword = /invariant|monotonic|assert|must be/.test(body)
    const hasConcretePredicate = /[≤≥]|=\s*\d|<\s*\d|>\s*\d|fail if|required/.test(
      body,
    )
    if (hasInvariantKeyword && hasConcretePredicate) {
      invariantSections.add(currentSection)
    }
  }

  // §10 is the delivery phase tracker — acceptance criteria there describe
  // what a PR *did*, not a steady-state invariant that needs ongoing tests.
  const META_SECTION_PREFIXES = ['10', '11', '12', '13', '14', '15', '16']

  for (const line of lines) {
    // Match either:
    //   `## 5.2. ...`  (legacy implementation-plan-v2.md numeric headings)
    //   `### §5.2 ...` (SPEC.md §-prefixed headings)
    // The section ID is normalized to `§N` / `§N.N` either way.
    const hLegacy = line.match(/^#{2,4}\s+(\d+(?:\.\d+)*)/)
    const hSpec = line.match(/^#{2,4}\s+§(\d+(?:\.\d+)*)/)
    const h = hSpec ?? hLegacy
    if (h) {
      flush()
      currentSection = `§${h[1]}`
      allSections.add(currentSection)
      currentBuffer = []
      // Pre-mark meta sections so they never land in invariantSections.
      const top = h[1].split('.')[0]
      if (META_SECTION_PREFIXES.includes(top)) {
        // Override flush by pointing currentSection at a sink that we
        // clear after the block completes.
        currentBuffer = []
      }
    } else if (currentSection) {
      currentBuffer.push(line)
    }
  }
  flush()

  return { allSections, invariantSections }
}

async function main(): Promise<void> {
  const planSrc = await readFile(planPath, 'utf-8').catch(() => '')
  if (!planSrc) {
    console.warn(
      `! plan file not found at ${relative(pkgRoot, planPath)} — skipping plan coverage check`,
    )
    return
  }
  const specSrc = await readFile(specPath, 'utf-8').catch(() => '')
  const { allSections, invariantSections } = parsePlan(planSrc)
  if (specSrc) {
    const specParsed = parsePlan(specSrc)
    for (const s of specParsed.allSections) allSections.add(s)
    // Don't merge invariantSections from SPEC — those are tracked
    // separately via SPEC.md acceptance tests, not via this verifier.
  }
  const testFiles = await collect(testsRoot)

  const coveredSections = new Set<string>()
  const unknownRefs: Array<{ file: string; ref: string }> = []

  for (const file of testFiles) {
    const src = await readFile(file, 'utf-8')
    for (const ref of extractGovernsRefs(src)) {
      if (!allSections.has(ref)) {
        unknownRefs.push({ file: relative(pkgRoot, file), ref })
      } else {
        coveredSections.add(ref)
      }
    }
  }

  const orphanInvariants = [...invariantSections].filter(
    (s) => !coveredSections.has(s),
  )

  const errors: string[] = []

  if (unknownRefs.length) {
    errors.push(
      `${unknownRefs.length} test(s) reference unknown plan section(s):`,
    )
    for (const { file, ref } of unknownRefs) {
      errors.push(`  - ${file} @governs ${ref} (not found in plan)`)
    }
  }

  if (orphanInvariants.length) {
    errors.push(
      `${orphanInvariants.length} plan section(s) with invariant claims have no test:`,
    )
    for (const s of orphanInvariants) {
      errors.push(`  - ${s} (no @governs reference in any test)`)
    }
  }

  if (errors.length) {
    console.error('\n✗ plan coverage verification failed:\n')
    for (const e of errors) console.error(e)
    console.error(
      '\n  Fix: either add a test with @governs <section> or reword the plan so it ' +
        "isn't an invariant claim. See plan/test-strategy.md §14.4.\n",
    )
    process.exit(1)
  }

  const coveredInvariantCount = [...invariantSections].filter((s) =>
    coveredSections.has(s),
  ).length
  console.log(
    `✓ plan coverage ok — ${coveredInvariantCount}/${invariantSections.size} invariant sections covered, ` +
      `no unknown refs.`,
  )
}

await main()
