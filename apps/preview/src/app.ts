/**
 * Preview app — token matrix.
 *
 * Renders the full 4-sector token surface so a human (or a Playwright
 * run under tests/e2e/) can verify:
 *   R1 — every expected `--{token}` resolves to a non-empty computed
 *        value on :root in every sector.
 *   R2 — toggling `data-mode` between `light` and `dark` changes
 *        `--bg-primary` (and everything downstream).
 *   R3 — toggling `data-contrast` between `normal` and `ic` changes
 *        IC-specific values.
 *   R4 — a Tailwind utility class that maps onto one of our tokens
 *        (e.g. `bg-brand`) resolves to the same computed colour as
 *        `var(--brand)` at runtime.
 */

const ACCENTS = [
  'brand',
  'red',
  'orange',
  'yellow',
  'green',
  'teal',
  'mint',
  'blue',
  'indigo',
  'purple',
  'pink',
] as const

const NEUTRAL_STEPS = Array.from({ length: 13 }, (_, i) => i)

const BG_TIERS = ['primary', 'secondary', 'tertiary'] as const
const LABEL_TIERS = ['primary', 'secondary', 'tertiary', 'quaternary'] as const
const LABEL_FAMILIES = [
  'neutral',
  'brand',
  'danger',
  'warning',
  'success',
  'info',
] as const

interface AppState {
  mode: 'light' | 'dark'
  contrast: 'normal' | 'ic'
}

const state: AppState = { mode: 'light', contrast: 'normal' }

function applyState(): void {
  document.documentElement.dataset.mode = state.mode
  document.documentElement.dataset.contrast = state.contrast
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  opts: {
    class?: string
    text?: string
    attrs?: Record<string, string>
    children?: (HTMLElement | string)[]
  } = {},
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (opts.class) node.className = opts.class
  if (opts.text) node.textContent = opts.text
  if (opts.attrs) {
    for (const [k, v] of Object.entries(opts.attrs)) node.setAttribute(k, v)
  }
  if (opts.children) {
    for (const c of opts.children) node.append(c)
  }
  return node
}

function controls(onChange: () => void): HTMLElement {
  const wrap = el('div', {
    class:
      'sticky top-0 z-10 flex flex-wrap items-center gap-4 border-b px-6 py-4',
    attrs: {
      'data-testid': 'controls',
      style:
        'background: var(--bg-primary); border-color: var(--border-neutral-base);',
    },
  })

  const title = el('div', {
    class: 'text-sm font-semibold',
    text: 'Lab UI · Token Preview',
  })
  wrap.append(title)

  const mkToggle = (
    label: string,
    value: string,
    name: 'mode' | 'contrast',
    other: string,
  ): HTMLElement => {
    const btn = el('button', {
      class:
        'rounded-md px-3 py-1 text-sm font-medium transition-colors ' +
        'border',
      text: label,
      attrs: {
        'data-testid': `toggle-${name}-${value}`,
        style:
          'background: var(--bg-secondary); color: var(--label-neutral-primary); ' +
          'border-color: var(--border-neutral-base);',
      },
    })
    btn.addEventListener('click', () => {
      state[name] = state[name] === value ? (other as never) : (value as never)
      applyState()
      onChange()
    })
    return btn
  }

  const group = (legend: string, buttons: HTMLElement[]): HTMLElement =>
    el('div', {
      class: 'flex items-center gap-2',
      children: [
        el('span', {
          class: 'text-xs uppercase tracking-wider opacity-60',
          text: legend,
        }),
        ...buttons,
      ],
    })

  wrap.append(
    group('mode', [
      mkToggle('light', 'light', 'mode', 'dark'),
      mkToggle('dark', 'dark', 'mode', 'light'),
    ]),
    group('contrast', [
      mkToggle('normal', 'normal', 'contrast', 'ic'),
      mkToggle('ic', 'ic', 'contrast', 'normal'),
    ]),
  )
  return wrap
}

function section(title: string, child: HTMLElement): HTMLElement {
  return el('section', {
    class: 'px-6 py-6',
    children: [
      el('h2', {
        class: 'mb-4 text-lg font-semibold',
        text: title,
      }),
      child,
    ],
  })
}

function swatch(
  name: string,
  cssVar: string,
  opts: { bordered?: boolean } = {},
): HTMLElement {
  const tile = el('div', {
    class: 'flex flex-col gap-1',
    attrs: { 'data-testid': `swatch-${name}` },
  })
  const chip = el('div', {
    class:
      'h-12 w-full rounded-md' + (opts.bordered ? ' border' : ''),
    attrs: {
      'data-token': cssVar,
      style:
        `background: var(${cssVar});` +
        (opts.bordered
          ? ' border-color: var(--border-neutral-base);'
          : ''),
    },
  })
  const label = el('div', {
    class: 'truncate text-xs font-mono opacity-80',
    text: name,
    attrs: { style: 'color: var(--label-neutral-secondary);' },
  })
  tile.append(chip, label)
  return tile
}

function primitives(): HTMLElement {
  const grid = el('div', {
    class: 'grid grid-cols-6 gap-3 md:grid-cols-8 lg:grid-cols-13',
  })
  for (const i of NEUTRAL_STEPS) {
    grid.append(swatch(`--neutral-${i}`, `--neutral-${i}`, { bordered: true }))
  }
  const accentGrid = el('div', {
    class: 'mt-6 grid grid-cols-6 gap-3 md:grid-cols-11',
  })
  for (const a of ACCENTS) {
    accentGrid.append(swatch(`--${a}`, `--${a}`))
  }
  return el('div', { children: [grid, accentGrid] })
}

function backgrounds(): HTMLElement {
  const grid = el('div', {
    class: 'grid grid-cols-2 gap-3 md:grid-cols-3',
  })
  for (const t of BG_TIERS) {
    grid.append(swatch(`--bg-${t}`, `--bg-${t}`, { bordered: true }))
  }
  return grid
}

function labels(): HTMLElement {
  const wrap = el('div', { class: 'space-y-6' })
  for (const fam of LABEL_FAMILIES) {
    const row = el('div', {
      class: 'rounded-lg p-4',
      attrs: {
        'data-testid': `labels-${fam}`,
        style:
          'background: var(--bg-secondary); color: var(--label-neutral-primary);',
      },
    })
    row.append(
      el('div', {
        class: 'mb-2 text-xs uppercase opacity-60',
        text: `labels · ${fam}`,
      }),
    )
    const tiers = el('div', { class: 'grid grid-cols-2 gap-3 md:grid-cols-4' })
    for (const tier of LABEL_TIERS) {
      const cssVar = `--label-${fam}-${tier}`
      const sample = el('div', {
        class: 'text-sm',
        text: `${fam}/${tier} — The quick brown fox 0123`,
        attrs: {
          'data-testid': `label-${fam}-${tier}`,
          'data-token': cssVar,
          style: `color: var(${cssVar});`,
        },
      })
      tiers.append(sample)
    }
    row.append(tiers)
    wrap.append(row)
  }
  return wrap
}

function tailwindVsRaw(): HTMLElement {
  /** Side-by-side: Tailwind utility on left, raw var on right.
   *  R4 relies on the pair having equal getComputedStyle values. */
  const wrap = el('div', { class: 'grid grid-cols-2 gap-4' })
  for (const a of ACCENTS) {
    const pair = el('div', {
      class: 'grid grid-cols-2 gap-2 rounded-md p-2',
      attrs: {
        'data-testid': `tw-vs-raw-${a}`,
        style:
          'background: var(--bg-secondary); border: 1px solid var(--border-neutral-base);',
      },
    })
    const tw = el('div', {
      class: `bg-${a} h-10 rounded`,
      attrs: {
        'data-source': 'tailwind',
        'data-testid': `tw-${a}`,
      },
    })
    const raw = el('div', {
      class: 'h-10 rounded',
      attrs: {
        'data-source': 'raw',
        'data-testid': `raw-${a}`,
        style: `background: var(--${a});`,
      },
    })
    pair.append(tw, raw)
    wrap.append(pair)
  }
  return wrap
}

function legend(): HTMLElement {
  return el('p', {
    class: 'px-6 pt-4 text-xs',
    text:
      'Toggle mode/contrast above to exercise the 4-sector output. Each swatch ' +
      'reads its fill from the corresponding CSS variable, which is re-scoped ' +
      'by `data-mode` / `data-contrast` on :root.',
    attrs: { style: 'color: var(--label-neutral-tertiary);' },
  })
}

function build(): HTMLElement {
  return el('main', {
    class: 'min-h-screen',
    attrs: { 'data-testid': 'preview-root' },
    children: [
      controls(() => {
        /* the DOM re-reads CSS vars automatically, nothing to rerender */
      }),
      legend(),
      section(
        'Primitives · neutrals (13 steps) & accents (11 families)',
        primitives(),
      ),
      section('Backgrounds · 3 tiers', backgrounds()),
      section('Labels · 6 families × 4 tiers', labels()),
      section(
        'Tailwind utility vs raw var · should render identically',
        tailwindVsRaw(),
      ),
    ],
  })
}

export function render(root: HTMLElement): void {
  applyState()
  root.replaceChildren(build())
}
