/**
 * Semantic-diff tool · unit tests.
 *
 * @layer Tooling (not a parity or guard test — validates the diff
 *        script itself, which PT3 relies on).
 * @governs plan/test-strategy.md §10 Parity · PT3
 * @invariant `parseCss` extracts the four canonical `:root` blocks
 *            and ignores unrelated selectors. `diff` classifies every
 *            differing `(scope, --var)` cell, computes ΔE2000 on
 *            colours, skips sub-threshold colour drift, and leaves
 *            non-colour cells untouched.
 * @on-fail Investigate whether the CSS format of `dist/tokens.css`
 *          changed (new scope selectors, different declaration
 *          shape) or whether the diff semantics drifted. Both cases
 *          warrant updating `parseCss` / `diff` and keeping the
 *          tests green in the same PR.
 */

import { describe, expect, test } from 'bun:test'

import {
  diff,
  formatMarkdown,
  parseCss,
  summarize,
  type ParsedCss,
} from '../../scripts/semantic-diff'

const SAMPLE_BEFORE = `/* header */
:root {
  --brand: #007aff;
  --bg-primary: #ffffff;
  --radius-md: 12px;
}
:root[data-contrast="ic"]:not([data-mode="dark"]) {
  --brand: #0040dd;
  --bg-primary: #ffffff;
}
:root[data-mode="dark"]:not([data-contrast="ic"]) {
  --brand: #4a8fff;
}
:root[data-mode="dark"][data-contrast="ic"] {
  --brand: #409cff;
}
/* ignored */
@media (prefers-reduced-motion: reduce) { :root { --foo: bar; } }
`

const SAMPLE_AFTER = `:root {
  --brand: #0060ee;           /* changed colour */
  --bg-primary: #fafafa;      /* changed colour, tiny ΔE */
  --radius-md: 14px;          /* changed non-colour */
  --new-token: #123456;       /* added */
}
:root[data-contrast="ic"]:not([data-mode="dark"]) {
  --brand: #0040dd;
  --bg-primary: #ffffff;
}
:root[data-mode="dark"]:not([data-contrast="ic"]) {
  --brand: #4a8fff;
}
:root[data-mode="dark"][data-contrast="ic"] {
  --brand: #409cff;
}
`

describe('parseCss', () => {
  test('extracts all four scope blocks', () => {
    const p = parseCss(SAMPLE_BEFORE)
    expect(p['light/normal']['--brand']).toBe('#007aff')
    expect(p['light/ic']['--brand']).toBe('#0040dd')
    expect(p['dark/normal']['--brand']).toBe('#4a8fff')
    expect(p['dark/ic']['--brand']).toBe('#409cff')
  })

  test('ignores unrelated selectors (media queries, etc.)', () => {
    const p = parseCss(SAMPLE_BEFORE)
    for (const scope of Object.values(p) as Record<string, string>[]) {
      expect(scope['--foo']).toBeUndefined()
    }
  })

  test('strips trailing ";" and whitespace from values', () => {
    const p = parseCss(SAMPLE_BEFORE)
    expect(p['light/normal']['--radius-md']).toBe('12px')
  })
})

describe('diff', () => {
  const before = parseCss(SAMPLE_BEFORE)
  const after = parseCss(SAMPLE_AFTER)

  test('classifies added / removed / changed correctly', () => {
    const rows = diff(before, after)
    const byVar = Object.fromEntries(
      rows
        .filter(r => r.scope === 'light/normal')
        .map(r => [r.varName, r]),
    )
    expect(byVar['--new-token']!.kind).toBe('added')
    expect(byVar['--brand']!.kind).toBe('changed')
    expect(byVar['--radius-md']!.kind).toBe('changed')
  })

  test('computes ΔE2000 and ΔL for colour cells', () => {
    const rows = diff(before, after)
    const brandRow = rows.find(
      r => r.scope === 'light/normal' && r.varName === '--brand',
    )!
    expect(brandRow.deltaE).not.toBeNull()
    expect(brandRow.deltaE!).toBeGreaterThan(0)
    expect(brandRow.deltaL).not.toBeNull()
  })

  test('leaves non-colour cells without ΔE / ΔL', () => {
    const rows = diff(before, after)
    const radiusRow = rows.find(r => r.varName === '--radius-md')!
    expect(radiusRow.deltaE).toBeNull()
    expect(radiusRow.deltaL).toBeNull()
  })

  test('skips colour changes below --threshold', () => {
    // #ffffff → #fafafa gives ΔE ≈ 2; threshold 5 must drop it.
    const rows = diff(before, after, 5)
    const bgRow = rows.find(
      r => r.scope === 'light/normal' && r.varName === '--bg-primary',
    )
    expect(bgRow).toBeUndefined()
  })

  test('always reports non-colour changes regardless of threshold', () => {
    const rows = diff(before, after, 100)
    const radiusRow = rows.find(r => r.varName === '--radius-md')
    expect(radiusRow).toBeDefined()
  })

  test('returns empty array on byte-identical input', () => {
    const sameCss = parseCss(SAMPLE_BEFORE)
    const rows = diff(sameCss, sameCss)
    expect(rows).toEqual([])
  })

  test('rolls up alpha variants when base token shifts identically', () => {
    const bCss = `:root {
      --blue: oklch(0.641 0.193 259.9);
      --blue-a12: oklch(0.641 0.193 259.9 / 0.12);
      --blue-a40: oklch(0.641 0.193 259.9 / 0.4);
    }`
    const aCss = `:root {
      --blue: oklch(0.479 0.207 261);
      --blue-a12: oklch(0.479 0.207 261 / 0.12);
      --blue-a40: oklch(0.479 0.207 261 / 0.4);
    }`
    const rowsFolded = diff(parseCss(bCss), parseCss(aCss))
    const rowsExpanded = diff(parseCss(bCss), parseCss(aCss), 0, true)
    // Folded: just --blue.  Expanded: --blue + both -aN.
    expect(rowsFolded.map(r => r.varName).sort()).toEqual(['--blue'])
    expect(rowsExpanded.map(r => r.varName).sort()).toEqual(
      ['--blue', '--blue-a12', '--blue-a40'],
    )
  })

  test('keeps alpha variants when base token is unchanged', () => {
    const bCss = `:root {
      --blue: oklch(0.641 0.193 259.9);
      --blue-a12: oklch(0.641 0.193 259.9 / 0.12);
    }`
    const aCss = `:root {
      --blue: oklch(0.641 0.193 259.9);
      --blue-a12: oklch(0.5 0.2 250 / 0.12);
    }`
    const rows = diff(parseCss(bCss), parseCss(aCss))
    expect(rows.map(r => r.varName)).toContain('--blue-a12')
  })
})

describe('summarize + formatMarkdown', () => {
  test('markdown output labels empty diff plainly', () => {
    const empty: ParsedCss = {
      'light/normal': {},
      'light/ic': {},
      'dark/ic': {},
      'dark/normal': {},
    }
    const md = formatMarkdown([], summarize(diff(empty, empty)))
    expect(md).toContain('byte-identical')
  })

  test('markdown output has header + table for non-empty diff', () => {
    const before = parseCss(SAMPLE_BEFORE)
    const after = parseCss(SAMPLE_AFTER)
    const rows = diff(before, after)
    const md = formatMarkdown(rows, summarize(rows))
    expect(md).toContain('## PT3 semantic diff')
    expect(md).toContain('| scope | var | kind |')
    expect(md).toContain('`--brand`')
  })

  test('summary counts match row kinds', () => {
    const before = parseCss(SAMPLE_BEFORE)
    const after = parseCss(SAMPLE_AFTER)
    const rows = diff(before, after)
    const s = summarize(rows)
    expect(s.total).toBe(rows.length)
    expect(s.added + s.removed + s.changed).toBe(s.total)
  })
})
