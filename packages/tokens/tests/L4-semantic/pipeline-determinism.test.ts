/**
 * Pipeline determinism — repeated generation returns identical output.
 *
 * @layer L4 × Guard
 * @governs plan-v2 §1.3 · Resolution pipeline
 * @invariant generatePrimitiveColors + generateSemanticColors is a pure
 *            function. No randomness, no IO, deterministic output.
 * @why If generation drifted, CI snapshot would constantly fail.
 * @on-fail find non-pure operations (Date.now, Math.random, env-dependent).
 */

import { describe, expect, test } from 'bun:test'
import { config } from '../../config/tokens.config'
import { generatePrimitiveColors } from '../../src/generators/primitive-colors'
import { generateSemanticColors } from '../../src/generators/semantic-colors'

describe('Pipeline · determinism', () => {
  test('two runs produce byte-identical token set', () => {
    const run = () => {
      const p = generatePrimitiveColors(config.colors)
      const s = generateSemanticColors(config.semantics, p, config.colors)
      return JSON.stringify({ p, s })
    }
    const a = run()
    const b = run()
    expect(a).toBe(b)
  })
})
