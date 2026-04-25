/**
 * FX semantic contract — Figma Variables slot shape.
 *
 * @layer L4 (semantic)
 * @governs plan-v2 §5.5 · FX
 * @invariant FX emits the Figma slot skeleton: Glow has
 *            Neutral/Inverted/Brand/Danger/Warning only as canonical slots,
 *            Focus-ring is split by neutral/brand/danger/warning,
 *            Skeleton is split into base/highlight, and Shadow tint alpha is
 *            sector-aware.
 * @why Button halo, focus, loading, and shadow recipes are consumed directly
 *      by components; collapsed or invented cells break the public contract.
 * @on-fail inspect config.semantics.fx and collectEntries() emission order.
 */

import { describe, expect, test } from 'bun:test'
import { config, semantic, OUTPUTS } from '../_helpers/fixtures'

const CANONICAL_GLOW = [
  'fx-glow-neutral',
  'fx-glow-inverted',
  'fx-glow-brand',
  'fx-glow-danger',
  'fx-glow-warning',
] as const
const LEGACY_GLOW = ['fx-glow-success', 'fx-glow-info'] as const

const FOCUS_RING = [
  'fx-focus-ring-neutral',
  'fx-focus-ring-brand',
  'fx-focus-ring-danger',
  'fx-focus-ring-warning',
] as const

function token(name: string) {
  const found = semantic.tokens.find((t) => t.name === name)
  expect(found).toBeDefined()
  return found!
}

describe('FX contract · slot shape', () => {
  test('canonical glow set matches Figma and legacy sentiments are deprecated', () => {
    for (const name of CANONICAL_GLOW) {
      expect(token(name).path.startsWith('fx.glow.')).toBe(true)
    }
    for (const name of LEGACY_GLOW) {
      expect(token(name).path.startsWith('fx.legacy_glow.')).toBe(true)
      expect(config.deprecated[`--${name}`]).toBeDefined()
    }
  })

  test('focus-ring is split by Figma slots and legacy alias remains deprecated', () => {
    for (const name of FOCUS_RING) {
      expect(token(name).path.startsWith('fx.focus_ring.')).toBe(true)
    }
    expect(token('fx-focus-ring').path).toBe('fx.focus_ring_legacy')
    expect(config.deprecated['--fx-focus-ring']?.replacement).toBe(
      '--fx-focus-ring-brand',
    )
  })

  test('skeleton is split and legacy alias remains deprecated', () => {
    expect(token('fx-skeleton-base').path).toBe('fx.skeleton.base')
    expect(token('fx-skeleton-highlight').path).toBe('fx.skeleton.highlight')
    expect(token('fx-skeleton').path).toBe('fx.skeleton.legacy')
    expect(config.deprecated['--fx-skeleton']?.replacement).toBe(
      '--fx-skeleton-base',
    )
  })
})

describe('FX contract · values by semantic recipe', () => {
  test('glow opacity and solidity match Figma recipes', () => {
    expect(token('fx-glow-neutral').values['light/normal'].alpha).toBeCloseTo(
      0.52,
      6,
    )
    expect(token('fx-glow-brand').values['light/normal'].alpha).toBeCloseTo(
      0.52,
      6,
    )
    expect(token('fx-glow-danger').values['light/normal'].alpha).toBeCloseTo(
      0.52,
      6,
    )
    expect(token('fx-glow-warning').values['light/normal'].alpha).toBeCloseTo(
      0.52,
      6,
    )
    for (const output of OUTPUTS) {
      expect(token('fx-glow-inverted').values[output].alpha).toBe(1)
    }
  })

  test('neutral focus ring flips light/dark while sentiment rings stay solid', () => {
    const neutral = token('fx-focus-ring-neutral')
    expect(neutral.values['light/normal'].L).toBeCloseTo(0.08, 6)
    expect(neutral.values['light/ic'].L).toBeCloseTo(0.08, 6)
    expect(neutral.values['dark/normal'].L).toBeCloseTo(1, 6)
    expect(neutral.values['dark/ic'].L).toBeCloseTo(1, 6)

    for (const name of FOCUS_RING) {
      for (const output of OUTPUTS) {
        expect(token(name).values[output].alpha).toBe(1)
      }
    }
  })

  test('skeleton alpha follows the current Figma Variables sectors', () => {
    expect(token('fx-skeleton-base').values['light/normal'].alpha).toBeCloseTo(
      0.08,
      6,
    )
    expect(token('fx-skeleton-base').values['dark/normal'].alpha).toBeCloseTo(
      0.12,
      6,
    )
    expect(token('fx-skeleton-base').values['light/ic'].alpha).toBeCloseTo(
      0.12,
      6,
    )
    expect(token('fx-skeleton-base').values['dark/ic'].alpha).toBeCloseTo(
      0.16,
      6,
    )
    for (const output of OUTPUTS) {
      expect(token('fx-skeleton-highlight').values[output].alpha).toBeCloseTo(
        0.04,
        6,
      )
    }
  })

  test('shadow tint alpha follows the current Figma Variables sectors', () => {
    const expected = {
      'fx-shadow-minor': [0.01, 0.01, 0.02, 0.02],
      'fx-shadow-ambient': [0.02, 0.02, 0.04, 0.04],
      'fx-shadow-penumbra': [0.04, 0.04, 0.12, 0.12],
      'fx-shadow-major': [0.12, 0.12, 0.2, 0.2],
    } as const

    for (const [name, alphas] of Object.entries(expected)) {
      const t = token(name)
      expect(t.values['light/normal'].alpha).toBeCloseTo(alphas[0], 6)
      expect(t.values['light/ic'].alpha).toBeCloseTo(alphas[1], 6)
      expect(t.values['dark/normal'].alpha).toBeCloseTo(alphas[2], 6)
      expect(t.values['dark/ic'].alpha).toBeCloseTo(alphas[3], 6)
    }
  })
})
