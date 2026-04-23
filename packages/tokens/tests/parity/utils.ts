/**
 * Shared utilities for Figma parity tests (plan §9.3).
 *
 * Parses the built `dist/tokens.css` into four mode-scoped maps,
 * converts OKLCH values to sRGB HEX via culori, and exposes a
 * ΔE2000 helper. All comparisons live in the CSS output plane so
 * we assert what actually ships, not what the generator computed.
 *
 * @invariant The four output keys are sourced strictly from the
 *   `:root`, `[data-contrast="ic"]:not([data-mode="dark"])`,
 *   `[data-mode="dark"][data-contrast="ic"]`, and
 *   `[data-mode="dark"]:not([data-contrast="ic"])` blocks in this
 *   order — which matches Figma sector ordering Ellipse 4/5/6/7.
 */

import { readFileSync } from 'node:fs'
import { differenceCiede2000, converter, formatHex } from 'culori'

export const FIGMA_MODE_ORDER = [
  'light/normal',
  'light/ic',
  'dark/ic',
  'dark/normal',
] as const

export type Mode = (typeof FIGMA_MODE_ORDER)[number]

const SCOPE_FOR_MODE: Record<Mode, RegExp> = {
  'light/normal': /^:root\s*$/,
  'light/ic': /^:root\[data-contrast="ic"\]:not\(\[data-mode="dark"\]\)\s*$/,
  'dark/ic': /^:root\[data-mode="dark"\]\[data-contrast="ic"\]\s*$/,
  'dark/normal':
    /^:root\[data-mode="dark"\]:not\(\[data-contrast="ic"\]\)\s*$/,
}

const cssPath = new URL('../../dist/tokens.css', import.meta.url).pathname

let cachedVars: Record<Mode, Record<string, string>> | null = null

function loadVars(): Record<Mode, Record<string, string>> {
  if (cachedVars) return cachedVars
  const css = readFileSync(cssPath, 'utf8')
  const blocks = Array.from(
    css.matchAll(/(:root[^{]*)\{([^}]+)\}/g),
    m => [m[1]!.trim(), m[2]!] as const,
  )
  const out = Object.fromEntries(
    FIGMA_MODE_ORDER.map(m => [m, {} as Record<string, string>]),
  ) as Record<Mode, Record<string, string>>
  for (const [sel, body] of blocks) {
    const mode = FIGMA_MODE_ORDER.find(m => SCOPE_FOR_MODE[m].test(sel))
    if (!mode) continue
    for (const match of body.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
      out[mode][match[1]!] = match[2]!.trim()
    }
  }
  cachedVars = out
  return out
}

/**
 * Return the resolved HEX for a given CSS variable name in a given mode.
 * Returns `null` if the variable is not present in that scope.
 */
export function hexForVar(varName: string, mode: Mode): string | null {
  const byMode = loadVars()[mode]
  const raw = byMode[varName]
  if (!raw) return null
  // OKLCH string → HEX via culori.
  const rgb = converter('rgb')(raw)
  if (!rgb) return null
  return formatHex(rgb)
}

const oklabConverter = converter('oklab')

/**
 * ΔE2000 between two sRGB HEX strings. Returns a non-negative number;
 * smaller is more perceptually identical. Thresholds from plan §9.3:
 *   ≤ 2  — imperceptible (neutrals must hit this)
 *   ≤ 3  — very close (accents target)
 *   ≤ 5  — visibly different but acceptable
 *   > 10 — sanity alarm (likely wrong mapping / typo)
 */
export function deltaE2000(a: string, b: string): number {
  const la = oklabConverter(a)
  const lb = oklabConverter(b)
  if (!la || !lb) return Number.POSITIVE_INFINITY
  return differenceCiede2000()(la, lb)
}

/** Compact table row for `console.log` diff dumps. */
export function formatRow(
  label: string,
  mode: Mode,
  ours: string | null,
  theirs: string,
  dE: number,
): string {
  return `${label.padEnd(18)} ${mode.padEnd(12)} ours=${(ours ?? '—').padEnd(8)} figma=${theirs.padEnd(8)} ΔE=${dE.toFixed(2)}`
}
