/**
 * Shared test fixtures. Builds the full token set once and exposes it as
 * module-level constants. Every test file can import these without paying
 * the generation cost again.
 *
 * @governs test-strategy.md §P0 · Test infra
 */

import { config } from '../../config/tokens.config'
import { generatePrimitiveColors } from '../../src/generators/primitive-colors'
import { generateSemanticColors } from '../../src/generators/semantic-colors'
import { writeCSS } from '../../src/writers/css'
import { writeESM } from '../../src/writers/esm'
import { writeDTS } from '../../src/writers/dts'
import type { OutputKey } from '../../src/types'

export const primitive = generatePrimitiveColors(config.colors)
export const semantic = generateSemanticColors(
  config.semantics,
  primitive,
  config.colors,
)
export const css = writeCSS(primitive, semantic, config.deprecated)
export const esm = writeESM(primitive, semantic)
export const dts = writeDTS(primitive, semantic)

export { config }

export const OUTPUTS: OutputKey[] = [
  'light/normal',
  'light/ic',
  'dark/normal',
  'dark/ic',
]
