/**
 * Tailwind v4 preset writer · structural sanity.
 *
 * @layer L4 Semantics · emission surface
 * @governs plan/implementation-plan-v2.md §16 · Tailwind v4 preset
 * @invariant The generated `dist/tailwind-preset.css` wraps all Lab UI
 *            primitive + semantic color tokens into Tailwind's
 *            `--color-*` namespace, exposes `--spacing` as the base
 *            increment, and maps radius / shadow / blur / font rungs
 *            onto Tailwind's own `--radius-*` / `--shadow-*` /
 *            `--blur-*` / `--text-*` / `--font-*` namespaces.
 * @why The preset is the mapping contract between Lab UI's token
 *      namespace and Tailwind v4's utility namespace. If it drifts the
 *      downstream `bg-brand`, `p-4`, `rounded-md`, `shadow-sm`, … etc.
 *      utilities stop resolving and apps silently render defaults.
 * @on-fail A missing mapping here usually means a writer branch was
 *          skipped. A duplicated or mistyped mapping collides Tailwind
 *          utility classes — inspect `src/writers/tailwind-preset.ts`.
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

const css = readFileSync(
  resolve(pkgRoot, 'dist/tailwind-preset.css'),
  'utf-8',
)

describe('Tailwind preset · structure', () => {
  test('is a single @theme block', () => {
    const themes = css.match(/@theme\s*{/g) ?? []
    expect(themes.length).toBe(1)
    expect(css.trimEnd().endsWith('}')).toBe(true)
  })

  test('maps every color primitive into --color-*', () => {
    for (const name of [
      'static-white',
      'static-dark',
      'neutral-0',
      'neutral-12',
      'brand',
      'red',
      'blue',
      'pink',
    ]) {
      expect(css).toContain(`--color-${name}: var(--${name});`)
    }
  })

  test('maps color alpha stops (a0..a99) into --color-*-aN', () => {
    expect(css).toContain('--color-brand-a0: var(--brand-a0);')
    expect(css).toContain('--color-brand-a99: var(--brand-a99);')
    expect(css).toContain('--color-neutral-6-a48: var(--neutral-6-a48);')
  })

  test('maps every semantic color role into --color-*', () => {
    for (const name of [
      'bg-primary',
      'bg-overlay',
      'label-neutral-primary',
      'label-brand-primary',
      'fill-brand-primary',
      'border-neutral-strong',
    ]) {
      expect(css).toContain(`--color-${name}: var(--${name});`)
    }
  })

  test('exposes --spacing as the dynamic base (Tailwind v4 convention)', () => {
    expect(css).toContain('--spacing: var(--unit-1);')
  })

  test('maps radius rungs onto Tailwind radius scale', () => {
    expect(css).toContain('--radius-sm: var(--radius-min);')
    expect(css).toContain('--radius-md: var(--radius-base);')
    expect(css).toContain('--radius-lg: var(--radius-max);')
    expect(css).toContain('--radius-full: var(--radius-full);')
  })

  test('maps multi-layer shadow presets onto Tailwind shadow scale', () => {
    // Tailwind `--shadow-*` must carry full box-shadow strings, which
    // only the multi-layer presets provide. Tint primitives stay in the
    // `--color-*` namespace (via the semantic roles loop).
    expect(css).toContain('--shadow-xs: var(--fx-shadow-xs);')
    expect(css).toContain('--shadow-sm: var(--fx-shadow-s);')
    expect(css).toContain('--shadow-md: var(--fx-shadow-m);')
    expect(css).toContain('--shadow-lg: var(--fx-shadow-l);')
    expect(css).toContain('--shadow-xl: var(--fx-shadow-xl);')
    expect(css).not.toContain('--shadow-xs: var(--fx-shadow-minor)')
    expect(css).not.toContain('--shadow-preset-')
  })

  test('maps blur rungs onto --blur-* namespace', () => {
    for (const name of ['none', 'xxs', 'xs', 's', 'm', 'l', 'xl']) {
      expect(css).toContain(`--blur-${name}: var(--blur-${name});`)
    }
  })

  test('maps typography onto --font-{sans,mono} + --text-*', () => {
    expect(css).toContain('--font-sans: var(--font-family);')
    expect(css).toContain('--font-mono: var(--font-family-mono);')
    for (const size of ['xxs', 'xs', 's', 'm', 'l', 'xl', '2xl']) {
      expect(css).toContain(`--text-${size}: var(--font-size-${size});`)
    }
  })
})
