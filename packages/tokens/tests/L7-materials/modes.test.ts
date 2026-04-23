/**
 * Materials · three-mode orthogonal axis + CSS emit.
 *
 * @layer L7 (materials)
 * @governs plan-v2 §8 · Layer 7 Materials
 * @invariant material_mode ∈ {solid, glass, backdrop}. Each level emits
 *            --materials-<name>-bg, --materials-<name>-filter,
 *            --materials-<name>-backdrop-filter. Default block uses
 *            default_mode; the two other modes live in
 *            [data-material-mode="…"] overrides.
 * @on-fail if glass_blur / backdrop_blur references a blur step that
 *          does not exist in dimensions.fx_blur, the generator emits a
 *          warning pointing at the offending level.
 */

import { describe, expect, test } from 'bun:test'
import { config } from '../../config/tokens.config'
import { generateMaterials } from '../../src/generators/materials'
import { generatePrimitiveColors } from '../../src/generators/primitive-colors'
import { writeMaterialsCss } from '../../src/writers/extras'

describe('Materials · validation', () => {
  const primitive = generatePrimitiveColors(config.colors, { warnings: [] })
  const { materials, warnings } = generateMaterials(
    config.materials,
    primitive,
    config.dimensions,
  )

  test('no warnings at default config', () => {
    expect(warnings).toEqual([])
  })

  test('canonical levels exist (elevated, base, muted, soft, subtle)', () => {
    const names = materials.levels.map((l) => l.name)
    expect(names).toEqual(['elevated', 'base', 'muted', 'soft', 'subtle'])
  })

  test('default_mode is set', () => {
    expect(['solid', 'glass', 'backdrop']).toContain(materials.default_mode)
  })

  test('unknown primitive id triggers warning', () => {
    const bad = generateMaterials(
      {
        default_mode: 'solid',
        levels: {
          bogus: {
            primitive: '99',
            glass_opacity: 50,
            glass_blur: 'm',
            backdrop_blur: 's',
          },
        },
      },
      primitive,
      config.dimensions,
    )
    expect(bad.warnings.some((w) => w.includes('primitive="99"'))).toBe(true)
  })

  test('unknown blur step triggers warning', () => {
    const bad = generateMaterials(
      {
        default_mode: 'solid',
        levels: {
          lvl: {
            primitive: '0',
            glass_opacity: 50,
            glass_blur: 'nope',
            backdrop_blur: 's',
          },
        },
      },
      primitive,
      config.dimensions,
    )
    expect(
      bad.warnings.some((w) => w.includes('glass_blur="nope"')),
    ).toBe(true)
  })

  test('glass_opacity not in opacity stops triggers warning', () => {
    const bad = generateMaterials(
      {
        default_mode: 'solid',
        levels: {
          lvl: {
            primitive: '0',
            // 55 is in [0,100] but not a declared stop in the ladder.
            glass_opacity: 55,
            glass_blur: 'm',
            backdrop_blur: 's',
          },
        },
      },
      primitive,
      config.dimensions,
    )
    expect(
      bad.warnings.some((w) => w.includes('not a defined opacity stop')),
    ).toBe(true)
  })

  test('out-of-range glass_opacity triggers warning', () => {
    const bad = generateMaterials(
      {
        default_mode: 'solid',
        levels: {
          lvl: {
            primitive: '0',
            glass_opacity: 150,
            glass_blur: 'm',
            backdrop_blur: 's',
          },
        },
      },
      primitive,
      config.dimensions,
    )
    expect(bad.warnings.some((w) => w.includes('glass_opacity=150'))).toBe(true)
  })
})

describe('Materials · CSS emit', () => {
  const primitive = generatePrimitiveColors(config.colors, { warnings: [] })
  const { materials } = generateMaterials(
    config.materials,
    primitive,
    config.dimensions,
  )
  const css = writeMaterialsCss(materials)

  test('emits default :root block', () => {
    expect(css).toMatch(/:root \{/)
  })

  test('emits override blocks for the two non-default modes', () => {
    const modes: Array<'solid' | 'glass' | 'backdrop'> = [
      'solid',
      'glass',
      'backdrop',
    ]
    for (const mode of modes) {
      if (mode === materials.default_mode) continue
      expect(css).toContain(`:root[data-material-mode="${mode}"]`)
    }
  })

  test('every level exposes bg + filter + backdrop-filter in every block', () => {
    for (const level of materials.levels) {
      expect(css).toContain(`--materials-${level.name}-bg:`)
      expect(css).toContain(`--materials-${level.name}-filter:`)
      expect(css).toContain(`--materials-${level.name}-backdrop-filter:`)
    }
  })

  test('glass mode uses opacity-ladder var (neutral-<id>-a<stop>)', () => {
    // Either in default block or override block.
    expect(css).toMatch(/var\(--neutral-\d+-a\d+\)/)
  })

  test('backdrop mode applies filter: blur(…) (not backdrop-filter)', () => {
    // Find the backdrop block (may be default or override).
    const backdropSection =
      materials.default_mode === 'backdrop'
        ? css.split(':root {')[1].split('}')[0]
        : css.split(':root[data-material-mode="backdrop"]')[1].split('}')[0]
    expect(backdropSection).toMatch(
      /--materials-[a-z]+-filter: blur\(var\(--blur-[a-z]+\)\);/,
    )
    expect(backdropSection).toMatch(
      /--materials-[a-z]+-backdrop-filter: none;/,
    )
  })

  test('solid mode emits filter:none + backdrop-filter:none', () => {
    const solidSection =
      materials.default_mode === 'solid'
        ? css.split(':root {')[1].split('}')[0]
        : css.split(':root[data-material-mode="solid"]')[1].split('}')[0]
    expect(solidSection).toMatch(/--materials-[a-z]+-filter: none;/)
    expect(solidSection).toMatch(/--materials-[a-z]+-backdrop-filter: none;/)
  })
})
