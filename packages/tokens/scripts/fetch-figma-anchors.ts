#!/usr/bin/env bun
/**
 * Fetch Figma color anchors from the Lab UI design file and write a
 * JSON snapshot for parity tests (see plan §9.3 Figma parity).
 *
 * Usage:
 *   FIGMA_PAT=<personal_access_token> \
 *   FIGMA_FILE_KEY=<file_key_from_url> \
 *   bun run fetch-figma-anchors
 *
 * The script walks the `Color Guides` frame on the `🔵Colors` page,
 * extracts every `Color wrap` sub-frame, and records (for each swatch)
 * the label text plus four pie-sector HEX values. The sector order is
 * `Ellipse 4 / 5 / 6 / 7` which corresponds to our four output keys in
 * this order: `[light/normal, light/ic, dark/ic, dark/normal]`.
 *
 * Ground truth note: swatch labels like `Brand@2` are display-only
 * opacity variants — the underlying HEX values are identical to the
 * bare `Brand` swatch. We deduplicate by bare label (before the `@`).
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const FIGMA_API = 'https://api.figma.com/v1'

type FigmaNode = {
  id?: string
  name?: string
  type?: string
  characters?: string
  children?: FigmaNode[]
  fills?: Array<{ type?: string; color?: { r: number; g: number; b: number; a?: number } }>
}

type FigmaResponse = {
  nodes: Record<string, { document: FigmaNode }>
}

async function figmaGet<T>(path: string, pat: string): Promise<T> {
  const res = await fetch(`${FIGMA_API}${path}`, {
    headers: { 'X-Figma-Token': pat },
  })
  if (!res.ok) {
    throw new Error(
      `Figma API ${res.status} ${res.statusText} for ${path}\n${await res.text()}`,
    )
  }
  return (await res.json()) as T
}

function rgbToHex({
  r,
  g,
  b,
}: { r: number; g: number; b: number; a?: number }): string {
  const to255 = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)))
  return `#${[r, g, b].map(to255).map(n => n.toString(16).padStart(2, '0')).join('')}`
}

function textIn(n: FigmaNode): string {
  if (n.type === 'TEXT' && n.characters) return n.characters
  for (const c of n.children ?? []) {
    const r = textIn(c)
    if (r) return r
  }
  return ''
}

function ellipseHexes(n: FigmaNode): string[] {
  // Collect ellipse fill HEX values in document order. The "Color wrap"
  // pie pattern always has exactly four ellipses named Ellipse 4/5/6/7.
  const acc: Array<[string, string]> = []
  function walk(node: FigmaNode) {
    if (node.type === 'ELLIPSE') {
      const fill = node.fills?.[0]
      if (fill?.type === 'SOLID' && fill.color) {
        acc.push([node.name ?? '', rgbToHex(fill.color)])
      }
    }
    for (const c of node.children ?? []) walk(c)
  }
  walk(n)
  // Sort by "Ellipse N" suffix so 4,5,6,7 is stable.
  acc.sort(([a], [b]) => {
    const na = parseInt(a.match(/(\d+)$/)?.[1] ?? '0', 10)
    const nb = parseInt(b.match(/(\d+)$/)?.[1] ?? '0', 10)
    return na - nb
  })
  return acc.map(([, h]) => h)
}

type Swatch = {
  section: string
  label: string // de-@'d bare label
  raw_label: string // original with @N opacity suffix if present
  hex: [string, string, string, string] // light/normal, light/ic, dark/ic, dark/normal
}

function collectSwatches(root: FigmaNode): Swatch[] {
  const out: Swatch[] = []
  function walk(n: FigmaNode, section: string) {
    let current = section
    for (const c of n.children ?? []) {
      if (c.type === 'TEXT') {
        const t = (c.characters ?? '').trim()
        // Section headings look like: "Neutral colors /Neutral"
        if (/\s\/[A-Z]/.test(t) && t.length < 80) current = t
      } else if (c.type === 'FRAME' && c.name === 'Color wrap') {
        const raw = textIn(c).trim()
        const bare = raw.split('@')[0]!.trim()
        const hex = ellipseHexes(c)
        if (bare && hex.length >= 4) {
          out.push({
            section: current,
            label: bare,
            raw_label: raw,
            hex: [hex[0]!, hex[1]!, hex[2]!, hex[3]!],
          })
        }
      } else {
        walk(c, current)
      }
    }
  }
  walk(root, '?')
  return out
}

async function main(): Promise<void> {
  const pat = process.env.FIGMA_PAT
  const fileKey = process.env.FIGMA_FILE_KEY
  const colorGuidesNodeId = process.env.FIGMA_COLOR_GUIDES_NODE_ID ?? '2059:1734'
  if (!pat) throw new Error('FIGMA_PAT env var is required')
  if (!fileKey) throw new Error('FIGMA_FILE_KEY env var is required')

  // Fetch the Color Guides frame subtree.
  const data = await figmaGet<FigmaResponse>(
    `/files/${fileKey}/nodes?ids=${encodeURIComponent(colorGuidesNodeId)}`,
    pat,
  )
  const frame = data.nodes[colorGuidesNodeId]
  if (!frame) {
    throw new Error(
      `Color Guides node ${colorGuidesNodeId} not found; override with FIGMA_COLOR_GUIDES_NODE_ID`,
    )
  }

  const all = collectSwatches(frame.document)

  // Dedupe by bare label, keeping the first occurrence per section.
  const bySection: Record<string, Record<string, Swatch>> = {}
  for (const s of all) {
    bySection[s.section] ??= {}
    bySection[s.section]![s.label] ??= s
  }

  // Build typed anchor groups.
  // The Figma Accent section also contains the seal colors (Dark/White)
  // used as foreground/background labels — split them out so `accents`
  // contains only the 11 hue anchors expected by PT1.
  const SEAL_NAMES = new Set(['Dark', 'White'])
  const neutrals: Record<string, [string, string, string, string]> = {}
  const accents: Record<string, [string, string, string, string]> = {}
  const seals: Record<string, [string, string, string, string]> = {}
  const misc: Record<string, [string, string, string, string]> = {}
  for (const [section, labels] of Object.entries(bySection)) {
    const inNeutral = section.toLowerCase().includes('neutral')
    const inAccent = section.toLowerCase().includes('accent')
    for (const [label, s] of Object.entries(labels)) {
      if (inNeutral) {
        if (/^[0-9]+$/.test(label)) neutrals[label] = s.hex
      } else if (inAccent) {
        if (SEAL_NAMES.has(label)) seals[label] = s.hex
        else if (/^[A-Z][a-zA-Z]+$/.test(label)) accents[label] = s.hex
        // Skip numeric-only labels (cross-section references like `0`, `4`).
      } else {
        misc[label] = s.hex
      }
    }
  }

  const snapshot = {
    _meta: {
      source: `figma://${fileKey}/${colorGuidesNodeId}`,
      fetched_at: new Date().toISOString(),
      modes: ['light/normal', 'light/ic', 'dark/ic', 'dark/normal'] as const,
      ellipse_order: 'Ellipse 4, 5, 6, 7 == modes in order above',
      counts: {
        neutrals: Object.keys(neutrals).length,
        accents: Object.keys(accents).length,
        seals: Object.keys(seals).length,
        misc: Object.keys(misc).length,
      },
    },
    neutrals,
    accents,
    seals,
    misc,
  }

  const outPath = `${import.meta.dir}/../tests/parity/fixtures/figma-anchors.json`
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, JSON.stringify(snapshot, null, 2) + '\n')
  console.log(
    `wrote ${outPath}\n  neutrals=${snapshot._meta.counts.neutrals}` +
      `  accents=${snapshot._meta.counts.accents}` +
      `  misc=${snapshot._meta.counts.misc}`,
  )
}

await main()
