/**
 * PT3 semantic-diff tool.
 *
 * @governs plan/test-strategy.md §10 Parity · PT3 (semantic diff)
 *
 * For two git refs, builds `dist/tokens.css` at each and emits a
 * structured diff of every `(scope, --var)` cell: added, removed, or
 * changed (with ΔE2000 and — for color vars — the APCA-relevant Lc
 * shift of the underlying OKLCH lightness). Designed to be cheap to
 * run locally (`bun run semantic-diff`) and to be CI-posted as a PR
 * comment when config or generator code changes.
 *
 * Usage:
 *   bun run semantic-diff                          # origin/main vs HEAD
 *   bun run semantic-diff --base <ref>             # <ref> vs HEAD
 *   bun run semantic-diff --base <a> --head <b>    # <a> vs <b>
 *   bun run semantic-diff --format json            # emit JSON for CI
 *   bun run semantic-diff --format markdown        # default
 *   bun run semantic-diff --threshold 0.1          # skip |ΔE| < N
 *
 * Architectural notes:
 *   - Uses `git worktree` in `/tmp` to build each side without
 *     touching the caller's working tree.
 *   - The diff parses `dist/tokens.css` — same byte plane that PT1/PT2
 *     assert parity against — so "what shipped" is what's compared.
 *   - Non-color vars (sizes, radii, z-index, opacity stops) are diffed
 *     textually without ΔE / ΔLc columns.
 */

import { execSync, spawnSync } from 'node:child_process'
import { readFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

import { converter, differenceCiede2000 } from 'culori'

// ─── Types ──────────────────────────────────────────────────────────────

export type Scope =
  | 'light/normal'
  | 'light/ic'
  | 'dark/ic'
  | 'dark/normal'

export const SCOPE_ORDER: readonly Scope[] = [
  'light/normal',
  'light/ic',
  'dark/ic',
  'dark/normal',
] as const

/** Map<scope, Map<--var-name, raw-css-value>>. */
export type ParsedCss = Record<Scope, Record<string, string>>

export type DiffKind = 'added' | 'removed' | 'changed'

export interface DiffRow {
  scope: Scope
  varName: string
  kind: DiffKind
  before: string | null
  after: string | null
  /** ΔE2000 in sRGB if both values parse as colors; null otherwise. */
  deltaE: number | null
  /** OKLCH L shift × 100 as an Lc-ish magnitude; null for non-color. */
  deltaL: number | null
}

// ─── Parser ─────────────────────────────────────────────────────────────

const SCOPE_SELECTORS: Record<Scope, RegExp> = {
  'light/normal': /^:root\s*$/,
  'light/ic': /^:root\[data-contrast="ic"\]:not\(\[data-mode="dark"\]\)\s*$/,
  'dark/ic': /^:root\[data-mode="dark"\]\[data-contrast="ic"\]\s*$/,
  'dark/normal':
    /^:root\[data-mode="dark"\]:not\(\[data-contrast="ic"\]\)\s*$/,
}

/**
 * Parse `dist/tokens.css` into `{ scope → { --var → raw-value } }`.
 * Only the four canonical `:root`-scoped blocks are consumed; any
 * other selectors (e.g. media queries, deprecation banner comments)
 * are ignored by design. Trailing `;` and surrounding whitespace are
 * stripped from the value.
 */
export function parseCss(css: string): ParsedCss {
  const out: ParsedCss = {
    'light/normal': {},
    'light/ic': {},
    'dark/ic': {},
    'dark/normal': {},
  }
  // Strip /* … */ comments so they don't leak into selectors or values.
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '')
  // Walk the string brace-aware; only consume top-level rules so that
  // `:root { … }` nested inside `@media` or other at-rules is ignored.
  let i = 0
  const n = stripped.length
  while (i < n) {
    while (i < n && /\s/.test(stripped[i]!)) i++
    if (i >= n) break
    // If this is an at-rule with a block, skip its entire body.
    if (stripped[i] === '@') {
      const braceStart = stripped.indexOf('{', i)
      const semi = stripped.indexOf(';', i)
      if (braceStart === -1 || (semi !== -1 && semi < braceStart)) {
        // statement at-rule like `@import …;`
        i = (semi === -1 ? n : semi + 1)
        continue
      }
      let depth = 1
      let j = braceStart + 1
      while (j < n && depth > 0) {
        if (stripped[j] === '{') depth++
        else if (stripped[j] === '}') depth--
        j++
      }
      i = j
      continue
    }
    // Regular rule: selector up to next `{`.
    const braceStart = stripped.indexOf('{', i)
    if (braceStart === -1) break
    const sel = stripped.slice(i, braceStart).trim()
    let depth = 1
    let j = braceStart + 1
    const bodyStart = j
    while (j < n && depth > 0) {
      if (stripped[j] === '{') depth++
      else if (stripped[j] === '}') depth--
      if (depth > 0) j++
    }
    const body = stripped.slice(bodyStart, j)
    i = j + 1
    const scope = SCOPE_ORDER.find(s => SCOPE_SELECTORS[s].test(sel))
    if (!scope) continue
    for (const decl of body.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
      out[scope][`--${decl[1]!}`] = decl[2]!.trim()
    }
  }
  return out
}

// ─── Color math ─────────────────────────────────────────────────────────

const toRgb = converter('rgb')
const toOklch = converter('oklch')
const dE2000 = differenceCiede2000()

function tryColor(raw: string): { hex: string; L: number } | null {
  try {
    const rgb = toRgb(raw)
    if (!rgb) return null
    const r = Math.round(Math.max(0, Math.min(1, rgb.r)) * 255)
      .toString(16)
      .padStart(2, '0')
    const g = Math.round(Math.max(0, Math.min(1, rgb.g)) * 255)
      .toString(16)
      .padStart(2, '0')
    const b = Math.round(Math.max(0, Math.min(1, rgb.b)) * 255)
      .toString(16)
      .padStart(2, '0')
    const hex = `#${r}${g}${b}`
    const ok = toOklch(raw)
    return { hex, L: ok?.l ?? NaN }
  } catch {
    return null
  }
}

// ─── Diff ───────────────────────────────────────────────────────────────

/**
 * Alpha-variant suffix: `--foo-a0`, `--foo-a12`, … `--foo-a99`. These
 * are mechanically derived from their base token and always shift
 * by exactly the same amount as the base, so by default we roll them
 * up into a single row representing the base token. Pass
 * `includeAlpha=true` to list each alpha stop separately.
 */
const ALPHA_SUFFIX = /-a\d+$/

function isAlphaVariant(name: string): boolean {
  return ALPHA_SUFFIX.test(name)
}

/**
 * Compute the diff between two parsed CSS objects.
 *
 * A row is emitted when:
 *   - the var exists in one side only (`added` / `removed`), OR
 *   - the raw value differs AND — for colors — ΔE2000 > `threshold`.
 *     Non-color textual diffs always emit regardless of threshold.
 *
 * When `includeAlpha` is false (default), alpha-variant tokens
 * (`--foo-a0` … `--foo-a99`) are dropped from the result when their
 * base token (`--foo`) already has a diff row in the same scope with
 * ΔE within 0.1 of the variant — cutting typical output by ~30×.
 */
export function diff(
  before: ParsedCss,
  after: ParsedCss,
  threshold = 0,
  includeAlpha = false,
): DiffRow[] {
  const rows: DiffRow[] = []
  for (const scope of SCOPE_ORDER) {
    const b = before[scope]
    const a = after[scope]
    const names = new Set([...Object.keys(b), ...Object.keys(a)])
    const sorted = [...names].sort()
    for (const varName of sorted) {
      const bv = b[varName] ?? null
      const av = a[varName] ?? null
      if (bv === av) continue
      const kind: DiffKind =
        bv === null ? 'added' : av === null ? 'removed' : 'changed'
      const bc = bv != null ? tryColor(bv) : null
      const ac = av != null ? tryColor(av) : null
      let deltaE: number | null = null
      let deltaL: number | null = null
      if (bc && ac) {
        deltaE = dE2000(bc.hex, ac.hex)
        deltaL = (ac.L - bc.L) * 100
      }
      if (kind === 'changed' && deltaE !== null && deltaE < threshold) {
        continue
      }
      rows.push({ scope, varName, kind, before: bv, after: av, deltaE, deltaL })
    }
  }
  if (includeAlpha) return rows
  // Roll up alpha variants: drop `--foo-a12` rows when a `--foo` row
  // in the same scope carries ~identical ΔE. Keep when the base row
  // is absent (so added/removed alpha-only changes still surface).
  const baseByScope = new Map<string, DiffRow>()
  for (const r of rows) {
    if (!isAlphaVariant(r.varName)) {
      baseByScope.set(`${r.scope}::${r.varName}`, r)
    }
  }
  return rows.filter(r => {
    if (!isAlphaVariant(r.varName)) return true
    const base = r.varName.replace(ALPHA_SUFFIX, '')
    const baseRow = baseByScope.get(`${r.scope}::${base}`)
    if (!baseRow) return true
    if (r.deltaE == null || baseRow.deltaE == null) return true
    return Math.abs(r.deltaE - baseRow.deltaE) > 0.1
  })
}

// ─── Formatting ─────────────────────────────────────────────────────────

export interface DiffSummary {
  total: number
  added: number
  removed: number
  changed: number
  /** Max absolute ΔE observed (among color rows). 0 when none. */
  maxDeltaE: number
  /** Max absolute ΔL×100 observed (among color rows). 0 when none. */
  maxDeltaL: number
}

export function summarize(rows: DiffRow[]): DiffSummary {
  let added = 0
  let removed = 0
  let changed = 0
  let maxDeltaE = 0
  let maxDeltaL = 0
  for (const r of rows) {
    if (r.kind === 'added') added++
    else if (r.kind === 'removed') removed++
    else changed++
    if (r.deltaE != null) maxDeltaE = Math.max(maxDeltaE, Math.abs(r.deltaE))
    if (r.deltaL != null) maxDeltaL = Math.max(maxDeltaL, Math.abs(r.deltaL))
  }
  return { total: rows.length, added, removed, changed, maxDeltaE, maxDeltaL }
}

export function formatMarkdown(rows: DiffRow[], summary: DiffSummary): string {
  if (rows.length === 0) {
    return 'No semantic diff detected — `dist/tokens.css` is byte-identical.\n'
  }
  const lines: string[] = []
  lines.push(
    `## PT3 semantic diff · ${summary.total} cells ` +
      `(${summary.added} added, ${summary.removed} removed, ${summary.changed} changed)`,
  )
  lines.push('')
  lines.push(`- **Max ΔE2000:** ${summary.maxDeltaE.toFixed(2)}`)
  lines.push(
    `- **Max ΔL (× 100, ~Lc-ish):** ${summary.maxDeltaL.toFixed(2)}`,
  )
  lines.push('')
  lines.push('| scope | var | kind | before | after | ΔE | ΔL |')
  lines.push('|---|---|---|---|---|---:|---:|')
  for (const r of rows) {
    const dE = r.deltaE != null ? r.deltaE.toFixed(2) : '—'
    const dL = r.deltaL != null ? r.deltaL.toFixed(2) : '—'
    lines.push(
      `| ${r.scope} | \`${r.varName}\` | ${r.kind} | ` +
        `${r.before != null ? `\`${r.before}\`` : '—'} | ` +
        `${r.after != null ? `\`${r.after}\`` : '—'} | ${dE} | ${dL} |`,
    )
  }
  lines.push('')
  return lines.join('\n')
}

export function formatJson(rows: DiffRow[], summary: DiffSummary): string {
  return JSON.stringify({ summary, rows }, null, 2) + '\n'
}

// ─── Git worktree orchestration ─────────────────────────────────────────

interface BuildResult {
  css: string
  ref: string
  sha: string
}

function resolveRef(ref: string): string {
  const r = spawnSync('git', ['rev-parse', '--verify', ref], {
    encoding: 'utf8',
  })
  if (r.status !== 0) {
    throw new Error(
      `semantic-diff: cannot resolve ref "${ref}": ${r.stderr.trim()}`,
    )
  }
  return r.stdout.trim()
}

function buildAtRef(ref: string, repoRoot: string): BuildResult {
  const sha = resolveRef(ref)
  const tmp = mkdtempSync(join(tmpdir(), 'sem-diff-'))
  try {
    execSync(`git worktree add --detach "${tmp}" ${sha}`, {
      cwd: repoRoot,
      stdio: 'pipe',
    })
    const pkgDir = join(tmp, 'packages', 'tokens')
    if (!existsSync(join(pkgDir, 'package.json'))) {
      throw new Error(
        `semantic-diff: expected packages/tokens in worktree at ${pkgDir}`,
      )
    }
    // Share node_modules from the caller's checkout to avoid a full
    // install in the worktree (the only runtime dep the build needs
    // is culori, which is hoisted at the repo root / pkg-tokens).
    execSync(
      'ln -s ' +
        `"${join(repoRoot, 'packages', 'tokens', 'node_modules')}" ` +
        `"${join(pkgDir, 'node_modules')}"`,
      { stdio: 'pipe' },
    )
    execSync('bun run build', { cwd: pkgDir, stdio: 'pipe' })
    const css = readFileSync(join(pkgDir, 'dist', 'tokens.css'), 'utf8')
    return { css, ref, sha }
  } finally {
    // Always clean up the worktree registration + temp dir.
    try {
      execSync(`git worktree remove --force "${tmp}"`, {
        cwd: repoRoot,
        stdio: 'pipe',
      })
    } catch {
      /* fall through to rm */
    }
    rmSync(tmp, { recursive: true, force: true })
  }
}

// ─── CLI ────────────────────────────────────────────────────────────────

interface CliArgs {
  base: string
  head: string
  format: 'markdown' | 'json'
  threshold: number
  includeAlpha: boolean
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    base: 'origin/main',
    head: 'HEAD',
    format: 'markdown',
    threshold: 0,
    includeAlpha: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = argv[i + 1]
    switch (a) {
      case '--base':
        if (!next) throw new Error('--base requires a value')
        args.base = next
        i++
        break
      case '--head':
        if (!next) throw new Error('--head requires a value')
        args.head = next
        i++
        break
      case '--format':
        if (next !== 'markdown' && next !== 'json') {
          throw new Error('--format must be markdown or json')
        }
        args.format = next
        i++
        break
      case '--threshold':
        if (!next) throw new Error('--threshold requires a value')
        args.threshold = Number(next)
        if (!Number.isFinite(args.threshold) || args.threshold < 0) {
          throw new Error('--threshold must be a non-negative number')
        }
        i++
        break
      case '--include-alpha':
        args.includeAlpha = true
        break
      default:
        throw new Error(`semantic-diff: unknown arg "${a}"`)
    }
  }
  return args
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const here = dirname(fileURLToPath(import.meta.url))
  const repoRoot = execSync('git rev-parse --show-toplevel', {
    cwd: here,
    encoding: 'utf8',
  }).trim()

  const baseBuild = buildAtRef(args.base, repoRoot)
  const headBuild = buildAtRef(args.head, repoRoot)

  const beforeCss = parseCss(baseBuild.css)
  const afterCss = parseCss(headBuild.css)
  const rows = diff(beforeCss, afterCss, args.threshold, args.includeAlpha)
  const summary = summarize(rows)

  const out =
    args.format === 'json'
      ? formatJson(rows, summary)
      : `_Comparing_ \`${args.base}\` (${baseBuild.sha.slice(0, 7)}) → ` +
        `\`${args.head}\` (${headBuild.sha.slice(0, 7)})\n\n` +
        formatMarkdown(rows, summary)

  process.stdout.write(out)
}

// Run only when invoked directly (not when imported for tests).
if (
  import.meta.url.startsWith('file:') &&
  process.argv[1] &&
  resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])
) {
  main().catch(e => {
    process.stderr.write(`semantic-diff: ${(e as Error).message}\n`)
    process.exit(1)
  })
}
