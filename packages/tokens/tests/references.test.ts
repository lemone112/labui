import { describe, expect, test } from 'bun:test'
import { config } from '../config/tokens.config'
import { generatePrimitiveColors } from '../src/generators/primitive-colors'
import { generateSemanticColors } from '../src/generators/semantic-colors'
import { validateReferences } from '../src/validators/references'

const primitive = generatePrimitiveColors(config.colors)
const semantic = generateSemanticColors(config.ladders, primitive, config.colors)

describe('References', () => {
  test('every semantic token resolves to a real primitive or semantic target', () => {
    const result = validateReferences(primitive, semantic)
    if (result.errors.length) {
      throw new Error(`Reference errors:\n${result.errors.join('\n')}`)
    }
    expect(result.errors.length).toBe(0)
  })

  test('control-bg is a cross-semantic reference', () => {
    const control = semantic.tokens.find((t) => t.name === 'control-bg')
    expect(control).toBeDefined()
    for (const mode of config.colors.modes) {
      expect(control!.values[mode].kind).toBe('semantic-ref')
    }
  })
})
