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
import { generatePrimitiveColors } from './generators/primitive-colors'
import { generateSemanticColors } from './generators/semantic-colors'
import { validateAll } from './validators/all'
import { writeCSS, writeDTS, writeESM } from './writers'

const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const distDir = resolve(pkgRoot, 'dist')

const t0 = performance.now()

const warnings: string[] = []
const primitive = generatePrimitiveColors(config.colors, { warnings })
const semantic = generateSemanticColors(config.semantics, primitive, config.colors)

const css = writeCSS(primitive, semantic)
const esm = writeESM(primitive, semantic)
const dts = writeDTS(primitive, semantic)

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

console.log(
  `✓ tokens built in ${(t1 - t0).toFixed(1)}ms (` +
    `${primitive.neutrals.length} neutrals, ` +
    `${primitive.accents.length} accents, ` +
    `${semantic.tokens.length} semantic, ` +
    `${semantic.shadow_presets.length} shadow presets)`,
)
