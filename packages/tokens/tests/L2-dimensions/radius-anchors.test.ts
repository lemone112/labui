/**
 * L2 Radius · anchor-set invariant (PR-N, TDD skeleton).
 *
 * @layer L2 (dimensions · radius)
 * @governs plan-v2 §3.2 Radius · §3.5 Output · §3.6 Invariants
 * @invariant Radius family emits exactly 5 anchors (none/min/base/max/full);
 *            `--radius-full` emits as `calc(infinity * 1rem)`; monotonic
 *            ordering `0 = none < min < base < max < full`.
 * @on-fail check generators/dimensions.ts radius resolution and
 *          writers/dimensions.ts emitRadius — anchor set must match
 *          plan §3.2 R1 Hybrid exactly; no legacy t-shirt steps.
 *
 * PR-N target: replace the 12-step t-shirt radius scale
 *   (none/xxs/xs/s/m/l/xl/2xl/3xl/4xl/5xl/full)
 * with a 5-anchor parametric set
 *   (none / min / base / max / full)
 * where intermediate values are derived in place via `clamp()`
 * (see radius-concentric.test.ts).
 *
 * Tests are currently `test.skip` because PR-N implementation
 * (config/generator/writer changes) is not yet landed. They describe
 * the target state — flip `skip` → `test` once PR-N code is in place.
 */

import { describe, expect, test } from 'bun:test'
import { config } from '../../config/tokens.config'
import { generateDimensions } from '../../src/generators/dimensions'
import { generateUnits } from '../../src/generators/units'
import { writeUnitsDimensionsCss } from '../../src/writers/dimensions'

describe('L2 Radius · R1 Hybrid anchor set (plan §3.2)', () => {
  const { units } = generateUnits(config.units)
  const { dimensions } = generateDimensions(config.dimensions, config.units)

  test.skip('radius family has exactly 5 anchors: none, min, base, max, full', () => {
    // Post-PR-N: `config.dimensions.radius` shrinks from 12 entries to 5.
    // Generator preserves the same keys in `dimensions.radius`.
    const keys = Object.keys(dimensions.radius).sort()
    expect(keys).toEqual(['base', 'full', 'max', 'min', 'none'])
  })

  test.skip('radius-none = 0 px (sharp corners)', () => {
    expect(dimensions.radius.none).toBe(0)
  })

  test.skip('radius-min < radius-base < radius-max (monotonic anchors)', () => {
    expect(dimensions.radius.min).toBeGreaterThan(0)
    expect(dimensions.radius.min).toBeLessThan(dimensions.radius.base)
    expect(dimensions.radius.base).toBeLessThan(dimensions.radius.max)
  })

  test.skip('radius-min default = 4px (unit/1), radius-base = 12px (unit/3), radius-max = 32px (unit/8)', () => {
    expect(dimensions.radius.min).toBe(4)
    expect(dimensions.radius.base).toBe(12)
    expect(dimensions.radius.max).toBe(32)
  })

  test.skip('radius-full is the pill sentinel (Infinity marker)', () => {
    // Representation in the resolved map: we use the sentinel Number.POSITIVE_INFINITY
    // (or a dedicated marker agreed in impl) so the CSS writer knows to emit
    // `calc(infinity * 1px)` instead of a rem value.
    expect(dimensions.radius.full).toBe(Number.POSITIVE_INFINITY)
  })
})

describe('L2 Radius · CSS emit — R1 Hybrid (plan §3.5)', () => {
  const { units } = generateUnits(config.units)
  const { dimensions } = generateDimensions(config.dimensions, config.units)
  const css = writeUnitsDimensionsCss(units, dimensions)

  test.skip('emits exactly 5 --radius-* vars (no t-shirt scale remains)', () => {
    const matches = css.match(/--radius-[a-z]+:/g) ?? []
    expect(matches.sort()).toEqual([
      '--radius-base:',
      '--radius-full:',
      '--radius-max:',
      '--radius-min:',
      '--radius-none:',
    ])
  })

  test.skip('no legacy radius t-shirt steps (xxs, xs, s, m, l, xl, 2xl, 3xl, 4xl, 5xl) in CSS', () => {
    expect(css).not.toMatch(/--radius-(xxs|xs|s|m|l|xl|2xl|3xl|4xl|5xl):/)
  })

  test.skip('radius-none emitted as 0 (bare zero)', () => {
    expect(css).toContain('--radius-none: 0;')
  })

  test.skip('radius-min / base / max emitted in rem', () => {
    expect(css).toContain('--radius-min: 0.25rem;')
    expect(css).toContain('--radius-base: 0.75rem;')
    expect(css).toContain('--radius-max: 2rem;')
  })

  test.skip('radius-full emitted as calc(infinity * 1rem)', () => {
    // Stylistic consistency with the rest of the system (everything in rem).
    // Numeric value is infinity regardless of the multiplier unit; rem is
    // chosen so the CSS-inspector view stays uniform.
    expect(css).toContain('--radius-full: calc(infinity * 1rem);')
  })
})
