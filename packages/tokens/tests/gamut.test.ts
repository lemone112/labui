import { describe, expect, test } from 'bun:test'
import { config } from '../config/tokens.config'
import { generatePrimitiveColors } from '../src/generators/primitive-colors'
import { validateGamut } from '../src/validators/gamut'

const primitive = generatePrimitiveColors(config.colors)

describe('Gamut', () => {
  test('every primitive is inside Display-P3 across all modes', () => {
    const result = validateGamut(primitive, 'p3')
    if (result.errors.length) {
      throw new Error(`Gamut errors:\n${result.errors.join('\n')}`)
    }
    expect(result.errors.length).toBe(0)
  })
})
