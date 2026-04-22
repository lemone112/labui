/**
 * Perf budget guard.
 *
 * @layer Guard
 * @governs plan-v2 §10 · Performance budgets
 * @invariant Colors generation + emit < 150ms on CI. Colors alone < 80ms.
 * @why If generation explodes, dev loop suffers and CI queues back up.
 * @on-fail profile with Bun.nanoseconds(); usual culprit = apca_inverse
 *          with too many iterations (max 24), or excessive spine sampling.
 */

import { describe, expect, test } from 'bun:test'
import { config } from '../../config/tokens.config'
import { generatePrimitiveColors } from '../../src/generators/primitive-colors'
import { generateSemanticColors } from '../../src/generators/semantic-colors'
import { writeCSS } from '../../src/writers/css'

describe('Perf budget', () => {
  test('primitives generation < 50ms', () => {
    const t0 = performance.now()
    generatePrimitiveColors(config.colors)
    const t1 = performance.now()
    expect(t1 - t0).toBeLessThan(50)
  })

  test('full colors pipeline + css emit < 150ms', () => {
    const t0 = performance.now()
    const p = generatePrimitiveColors(config.colors)
    const s = generateSemanticColors(config.semantics, p, config.colors)
    writeCSS(p, s)
    const t1 = performance.now()
    expect(t1 - t0).toBeLessThan(150)
  })
})
