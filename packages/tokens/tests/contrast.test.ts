/**
 * APCA contrast test matrix (spec §7.3).
 *
 * Walks every (label, background) pair across all 4 modes and asserts
 * that |Lc| clears the appropriate threshold (60 normal / 75 IC).
 */

import { describe, expect, test } from 'bun:test'
import { config } from '../config/tokens.config'
import { generatePrimitiveColors } from '../src/generators/primitive-colors'
import { generateSemanticColors } from '../src/generators/semantic-colors'
import { validateApca } from '../src/validators/apca'

const primitive = generatePrimitiveColors(config.colors)
const semantic = generateSemanticColors(config.ladders, primitive, config.colors)

describe('APCA contrast', () => {
  const result = validateApca(primitive, semantic)

  test('every body-tier pair clears Lc60 (normal) / Lc75 (IC)', () => {
    const failed = result.pairs.filter((p) => p.tier === 'body' && !p.pass)
    if (failed.length > 0) {
      const report = failed
        .map((p) => `  ${p.fg} on ${p.bg} (${p.mode}): |Lc|=${Math.abs(p.lc).toFixed(1)} < ${p.threshold}`)
        .join('\n')
      throw new Error(`APCA body failures:\n${report}`)
    }
    expect(failed.length).toBe(0)
  })

  test('no body-tier failures are reported as errors', () => {
    expect(result.errors.length).toBe(0)
  })

  test('label.neutral.primary passes Lc60 on background in normal modes', () => {
    const pair = result.pairs.find(
      (p) => p.fg === 'label-neutral-primary' && p.bg === 'bg-primary' && p.mode === 'light',
    )
    expect(pair).toBeDefined()
    expect(Math.abs(pair!.lc)).toBeGreaterThanOrEqual(60)
  })

  test('label.neutral.primary passes Lc75 on background in IC modes', () => {
    for (const mode of ['light_ic', 'dark_ic'] as const) {
      const pair = result.pairs.find(
        (p) => p.fg === 'label-neutral-primary' && p.bg === 'bg-primary' && p.mode === mode,
      )
      expect(pair).toBeDefined()
      expect(Math.abs(pair!.lc)).toBeGreaterThanOrEqual(75)
    }
  })
})
