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
const RADIUS_REQUIRED = ['none', 'xxs', 'xs', 's', 'm', 'l', 'xl', '2xl', '3xl', '4xl', '5xl', 'full']
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

  test('radius family has 12 entries including full', () => {
    for (const name of RADIUS_REQUIRED) {
      expect(dimensions.radius).toHaveProperty(name)
    }
  })

  test('size family has 8 entries from xxs..3xl', () => {
    for (const name of SIZE_REQUIRED) {
      expect(dimensions.size).toHaveProperty(name)
    }
  })

  test('all emitted values are finite (no NaN/∞)', () => {
    for (const family of Object.values(dimensions)) {
      for (const v of Object.values(family as Record<string, number>)) {
        expect(Number.isFinite(v)).toBe(true)
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
