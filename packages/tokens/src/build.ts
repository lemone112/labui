/**
 * Lab UI · token build entry point (v2).
 *
 * Reads `config/tokens.config.ts`, generates primitives + semantic tokens,
 * writes CSS / ESM / d.ts into `dist/`, and runs validators.
 * Exits 1 on validator error.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from '../config/tokens.config'
import { generateDimensions } from './generators/dimensions'
import { generatePrimitiveColors } from './generators/primitive-colors'
import { generateSemanticColors } from './generators/semantic-colors'
import { generateTypography } from './generators/typography'
import { generateUnits } from './generators/units'
import { validateAll } from './validators/all'
import {
  writeCSS,
  writeDTS,
  writeESM,
  writeTypographyCss,
  writeUnitsDimensionsCss,
} from './writers'

const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const distDir = resolve(pkgRoot, 'dist')

const t0 = performance.now()

const warnings: string[] = []

const unitsResult = generateUnits(config.units)
warnings.push(...unitsResult.warnings)

const dimsResult = generateDimensions(config.dimensions, config.units)
warnings.push(...dimsResult.warnings)

const typoResult = generateTypography(config.typography, config.units)
warnings.push(...typoResult.warnings)

const primitive = generatePrimitiveColors(config.colors, { warnings })
const semantic = generateSemanticColors(config.semantics, primitive, config.colors)

const colorsCss = writeCSS(primitive, semantic)
const unitsDimsCss = writeUnitsDimensionsCss(unitsResult.units, dimsResult.dimensions)
const typoCss = writeTypographyCss(typoResult.typography)
const css = `${unitsDimsCss}\n${typoCss}\n${colorsCss}`
const esm = writeESM(
  primitive,
  semantic,
  unitsResult.units,
  dimsResult.dimensions,
  typoResult.typography,
)
const dts = writeDTS(
  primitive,
  semantic,
  unitsResult.units,
  dimsResult.dimensions,
  typoResult.typography,
)

await mkdir(distDir, { recursive: true })
await Promise.all([
  writeFile(resolve(distDir, 'tokens.css'), css),
  writeFile(resolve(distDir, 'index.js'), esm),
  writeFile(resolve(distDir, 'index.d.ts'), dts),
])

const t1 = performance.now()

const validation = validateAll(primitive, semantic, config.colors.gamut)
const allWarnings = [...warnings, ...validation.warnings]

if (allWarnings.length) {
  for (const w of allWarnings) console.warn(`⚠  ${w}`)
}

if (validation.errors.length) {
  for (const e of validation.errors) console.error(`✗ ${e}`)
  console.error(`\n✗ ${validation.errors.length} validation error(s); build failed`)
  process.exit(1)
}

const pxCount = Object.keys(unitsResult.units.px).length
const ptCount = Object.keys(unitsResult.units.pt).length
const dimsCount = Object.values(dimsResult.dimensions).reduce(
  (sum, m) => sum + Object.keys(m).length,
  0,
)

const typoCount =
  Object.keys(typoResult.typography.size).length * 4 +
  Object.keys(typoResult.typography.semantics).length

console.log(
  `✓ tokens built in ${(t1 - t0).toFixed(1)}ms (` +
    `${pxCount} px + ${ptCount} pt, ` +
    `${dimsCount} dims, ` +
    `${typoCount} typo, ` +
    `${primitive.neutrals.length} neutrals, ` +
    `${primitive.accents.length} accents, ` +
    `${semantic.tokens.length} semantic, ` +
    `${semantic.shadow_presets.length} shadow presets)`,
)
