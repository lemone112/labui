/**
 * Typography · semantic aliases + CSS emit.
 *
 * @layer L5 (typography) × Emit
 * @governs plan-v2 §6.5 · Semantic aliases
 * @invariant Every declared alias maps to a real scale key, and the
 *            emitted CSS references --font-size-<key> (not raw px).
 * @on-fail check config.typography.semantics for typos; check
 *          writers/typography.ts alias emit.
 */

import { describe, expect, test } from 'bun:test'
import { config } from '../../config/tokens.config'
import {
  generateTypography,
  TYPOGRAPHY_KEYS,
} from '../../src/generators/typography'
import { writeTypographyCss } from '../../src/writers/typography'

describe('Semantics · validity', () => {
  const { typography } = generateTypography(config.typography, config.units)

  test('every alias references a valid scale key', () => {
    for (const [name, key] of Object.entries(typography.semantics)) {
      expect(TYPOGRAPHY_KEYS).toContain(key)
    }
  })

  test('canonical aliases exist', () => {
    const required = [
      'label-small',
      'label-default',
      'body-default',
      'body-large',
      'title-m',
      'title-l',
      'headline-s',
      'headline-m',
      'headline-xl',
    ]
    for (const name of required) {
      expect(typography.semantics).toHaveProperty(name)
    }
  })
})

describe('Emit · CSS', () => {
  const { typography } = generateTypography(config.typography, config.units)
  const css = writeTypographyCss(typography)

  test(':root block emitted', () => {
    expect(css).toMatch(/:root \{/)
  })

  test('font-family vars present with fallback stack', () => {
    expect(css).toContain('--font-family:')
    expect(css).toContain('system-ui')
    expect(css).toContain('--font-family-mono:')
    expect(css).toContain('ui-monospace')
  })

  test('every scale key has size/lh-body/lh-headline/tracking', () => {
    for (const key of TYPOGRAPHY_KEYS) {
      expect(css).toContain(`--font-size-${key}:`)
      expect(css).toContain(`--lh-body-${key}:`)
      expect(css).toContain(`--lh-headline-${key}:`)
      expect(css).toContain(`--tracking-${key}:`)
    }
  })

  test('aliases point at var(--font-size-<key>), not raw px', () => {
    for (const [name, key] of Object.entries(typography.semantics)) {
      expect(css).toContain(`--text-${name}: var(--font-size-${key});`)
    }
  })

  test('headline-*/title-* aliases use headline line-height', () => {
    for (const [name, key] of Object.entries(typography.semantics)) {
      if (name.startsWith('headline-') || name.startsWith('title-')) {
        expect(css).toContain(`--text-${name}-lh: var(--lh-headline-${key});`)
      }
    }
  })

  test('label-*/body-* aliases use body line-height', () => {
    for (const [name, key] of Object.entries(typography.semantics)) {
      if (name.startsWith('label-') || name.startsWith('body-')) {
        expect(css).toContain(`--text-${name}-lh: var(--lh-body-${key});`)
      }
    }
  })

  test('no alias uses the wrong line-height tier', () => {
    // Sanity: if the tier inference is ever reversed, the lh values
    // diverge by ~36% at default density (1.5 vs 1.1).
    for (const [name, key] of Object.entries(typography.semantics)) {
      const isHeadlineTier =
        name.startsWith('headline-') || name.startsWith('title-')
      const wrongTier = isHeadlineTier ? 'body' : 'headline'
      expect(css).not.toContain(`--text-${name}-lh: var(--lh-${wrongTier}-${key});`)
    }
  })

  test('tracking of 0 renders as bare 0 (no em)', () => {
    // 'xs' and smaller are body-sized at default config → tracking=0
    expect(css).toMatch(/--tracking-xs: 0;/)
  })
})
