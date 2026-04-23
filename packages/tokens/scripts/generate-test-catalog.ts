/**
 * Generate docs/test-catalog.md from @layer / @governs / @invariant headers
 * in every test file.
 *
 * @see plan/test-strategy.md §14.3
 *
 * Intended use:
 *   bun run scripts/generate-test-catalog.ts
 * or via package.json script:
 *   bun run catalog
 */

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const testsRoot = join(pkgRoot, 'tests')
const docsDir = join(pkgRoot, 'docs')
const outFile = join(docsDir, 'test-catalog.md')

interface TestFileMeta {
  path: string
  layer: string | null
  governs: string | null
  invariant: string | null
  why: string | null
  onFail: string | null
}

async function collect(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await collect(full)))
    } else if (entry.name.endsWith('.test.ts')) {
      files.push(full)
    }
  }
  return files
}

function pluck(source: string, tag: string): string | null {
  // Matches `@tag <content>` up to newline or next `@`.
  const re = new RegExp(`@${tag}\\s+([^\\n]*(?:\\n\\s*\\*\\s+[^@\\n][^\\n]*)*)`)
  const m = source.match(re)
  if (!m) return null
  return m[1]
    .replace(/\n\s*\*\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function parse(file: string): Promise<TestFileMeta> {
  const src = await readFile(file, 'utf-8')
  const header = src.slice(0, 2000) // header is at top
  return {
    path: relative(pkgRoot, file),
    layer: pluck(header, 'layer'),
    governs: pluck(header, 'governs'),
    invariant: pluck(header, 'invariant'),
    why: pluck(header, 'why'),
    onFail: pluck(header, 'on-fail'),
  }
}

async function main(): Promise<void> {
  const files = (await collect(testsRoot)).sort()
  const metas = await Promise.all(files.map(parse))

  const byLayer = new Map<string, TestFileMeta[]>()
  for (const m of metas) {
    const layer = m.layer ?? '(no header)'
    if (!byLayer.has(layer)) byLayer.set(layer, [])
    byLayer.get(layer)!.push(m)
  }

  const lines: string[] = []
  lines.push('# Test Catalog')
  lines.push('')
  lines.push(
    `Auto-generated from \`@layer\` / \`@governs\` / \`@invariant\` headers in every `,
  )
  lines.push(`\`tests/**/*.test.ts\` file. Run \`bun run catalog\` to regenerate.`)
  lines.push('')
  lines.push(`**Total:** ${metas.length} test files`)
  lines.push('')

  const layerOrder = [...byLayer.keys()].sort()
  for (const layer of layerOrder) {
    lines.push(`## ${layer}`)
    lines.push('')
    const rows = byLayer.get(layer)!
    for (const m of rows) {
      lines.push(`### \`${m.path}\``)
      lines.push('')
      if (m.governs) lines.push(`- **Governs:** ${m.governs}`)
      if (m.invariant) lines.push(`- **Invariant:** ${m.invariant}`)
      if (m.why) lines.push(`- **Why:** ${m.why}`)
      if (m.onFail) lines.push(`- **On fail:** ${m.onFail}`)
      if (!m.governs && !m.invariant && !m.why && !m.onFail) {
        lines.push(`- _(no documented header)_`)
      }
      lines.push('')
    }
  }

  await mkdir(docsDir, { recursive: true })
  await writeFile(outFile, lines.join('\n'))
  console.log(`✓ wrote ${relative(pkgRoot, outFile)} (${metas.length} test files)`)
}

await main()
