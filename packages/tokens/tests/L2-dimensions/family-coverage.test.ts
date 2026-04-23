/**
 * Dimensions · family coverage & sanity.
 *
 * @layer L2 (dimensions)
 * @governs plan-v2 §3.2 · Families
 * @invariant Every family has the names required by the course-§05 design
 *            system (none, xxs..7xl where applicable).
 * @on-fail add missing names to config.dimensions.*; verify writer emits
 *          them via tokens.css snapshot.
 */

import { describe, expect, test } from 'bun:test'
import { config } from '../../config/tokens.config'
import { generateDimensions } from '../../src/generators/dimensions'

const SPACING_REQUIRED = ['none', 'xxs', 'xs', 's', 'm', 'l', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl']
// R1 Hybrid · plan §3.2. Intermediate stops derived via clamp(), not emitted.
const RADIUS_REQUIRED = ['none', 'min', 'base', 'max', 'full']
const SIZE_REQUIRED = ['xxs', 'xs', 's', 'm', 'l', 'xl', '2xl', '3xl']

describe('Family · required names', () => {
  const { dimensions } = generateDimensions(config.dimensions, config.units)

  test('spacing_padding has 13 canonical names', () => {
    for (const name of SPACING_REQUIRED) {
      expect(dimensions.spacing_padding).toHaveProperty(name)
    }
  })

  test('spacing_margin has all padding names + negatives', () => {
    for (const name of SPACING_REQUIRED) {
      expect(dimensions.spacing_margin).toHaveProperty(name)
    }
    for (const name of ['neg-xs', 'neg-s', 'neg-m', 'neg-l']) {
      expect(dimensions.spacing_margin).toHaveProperty(name)
    }
  })

  test('radius family matches R1 Hybrid anchors (none, min, base, max, full)', () => {
    expect(Object.keys(dimensions.radius).sort()).toEqual(
      [...RADIUS_REQUIRED].sort(),
    )
  })

  test('size family has 8 entries from xxs..3xl', () => {
    for (const name of SIZE_REQUIRED) {
      expect(dimensions.size).toHaveProperty(name)
    }
  })

  test('all emitted values are finite except radius-full (pill sentinel)', () => {
    for (const [familyName, family] of Object.entries(dimensions)) {
      for (const [name, v] of Object.entries(family as Record<string, number>)) {
        // radius.full is intentionally Infinity — emitted as
        // `calc(infinity * 1rem)` via writers/dimensions.ts (plan §3.5).
        if (familyName === 'radius' && name === 'full') {
          expect(v).toBe(Number.POSITIVE_INFINITY)
        } else {
          expect(Number.isFinite(v)).toBe(true)
        }
      }
    }
  })
})

describe('Family · monotonic ascending within family (where expected)', () => {
  const { dimensions } = generateDimensions(config.dimensions, config.units)

  test('spacing_padding: xxs < xs < s < m < l < xl < 2xl < 7xl', () => {
    const order = ['xxs', 'xs', 's', 'm', 'l', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl']
    for (let i = 1; i < order.length; i++) {
      expect(dimensions.spacing_padding[order[i]]).toBeGreaterThan(
        dimensions.spacing_padding[order[i - 1]],
      )
    }
  })

  test('size: xxs < xs < s < m < l < xl < 2xl < 3xl', () => {
    const order = ['xxs', 'xs', 's', 'm', 'l', 'xl', '2xl', '3xl']
    for (let i = 1; i < order.length; i++) {
      expect(dimensions.size[order[i]]).toBeGreaterThan(
        dimensions.size[order[i - 1]],
      )
    }
  })

  test('spacing_margin negatives are < 0', () => {
    expect(dimensions.spacing_margin['neg-xs']).toBeLessThan(0)
    expect(dimensions.spacing_margin['neg-l']).toBeLessThan(
      dimensions.spacing_margin['neg-xs'],
    )
  })
})
