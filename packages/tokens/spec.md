# Lab UI — Design System Tokens Spec (v1)

> Status: **draft, ready for implementation**
> Source of truth: Figma file `LuaiBd4anRi4DMZayKAnY2` (🧪Lab UI v.1)
> Package: `@lab-ui/tokens`

---

## 0. Гайд для следующего агента (TL;DR)

**Что это**: спецификация tier-1 design tokens для labui. Алгоритм-driven, параметризуемо одним конфигом, OKLCH+P3, 4 режима (Light/Dark/Light-IC/Dark-IC).

**Состояние**:
- Колоры, шкалы, семантика, рантайм — все решения заморожены (см. ниже)
- Materials (Glass/Backdrop/Progressive blur+shadow) — **отложены**, см. §13
- Component-level tokens — **отложены**, см. §13
- Icons, Flags — вне scope tier-1

**Что делать (по фазам)**:
1. **Phase 1 · Colors** (одним PR): primitives + semantic + APCA validator + CSS/ESM/d.ts output
2. **Phase 2 · Scales** (отдельным PR): parametric cells для fontSize/lineHeight/tracking/radius/spacing/size/blur/shift/spread + unit variants
3. **Phase 3 · Integration** (отдельным PR): Tailwind v4 preset + docs для Next/Vue/Svelte
4. **Phase 4+ · отложено**: Materials, component-level, Icons/Flags

**Оба первых PR — блокеры перед component tokens (tier-2)**.

**Нельзя**:
- хардкодить числа (golden ratio/2, степени 2 и т.п.) — только параметры в конфиге
- делать tonal scales для акцентов (акценты — single anchor + opacity ladder)
- рассчитывать WCAG-контраст в рантайме (APCA — только CI валидатор)
- использовать WCAG 2.x (устаревший, см. §6.7)
- ломать stack-agnosticism (Bun build → CSS/ESM output, никакого фреймворка-specific кода)

**Подтверждено пользователем**:
- APCA (Lc60 для normal, Lc75 для IC режимов)
- Bun runtime, Next/Vue/Svelte стек-совместимо
- Discrete opacity ladders вместо WCAG-math
- Per-accent overrides для hue-shift (Yellow, возможно Mint/Teal)
- Control-bg — временный паттерн (заменяется в tier-2)
- Materials — отложить, есть GH issue
- Parametric cells (любая шкала меняется изменением 2-3 параметров в конфиге)

---

## 1. Принципы

1. **Algorithm-driven**: всё генерируется формулами из компактного конфига. Хардкод цветов/чисел — только в конфиге, остальное — deriv.
2. **Parametric cells**: любая шкала описывается 2-4 параметрами (base, ratio, steps, rounding). Меняешь один параметр → пересчитывается всё, что от него зависит.
3. **OKLCH + Display P3**: перцептивно равномерное цветовое пространство, расширенный gamut для современных экранов. Fallback — `color(display-p3 ...)` + sRGB.
4. **Mode derivation**: base mode = Light, остальные выводятся через формулы с per-accent overrides.
5. **Discrete opacity ladders**: семантика собирается из 29 фиксированных opacity-стопов, а не рассчитывается динамически.
6. **Framework-agnostic output**: CSS custom properties + ESM barrel + TypeScript d.ts. Фреймворк получает всё это как есть.
7. **Bun-first build**: быстрая компиляция (<200 мс для полного билда), Node-совместимый fallback через `tsx`.
8. **APCA validator, не generator**: контраст проверяется на CI, не вычисляется в рантайме.

---

## 2. Архитектура

```
┌──────────────────────────────────────────────────────────┐
│ config/tokens.config.ts          ← SINGLE SOURCE OF TRUTH │
│   ├── colors.{neutrals, accents, statics, opacity, modes} │
│   ├── scales.{fontSize, lineHeight, tracking,             │
│   │           radius, spacing, size, blur, shift, spread} │
│   ├── ladders.{label, fill, border, fx, misc}             │
│   └── runtime.{gamut, units, zIndex}                      │
└──────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────┐
│ build (Bun)                                               │
│   ├── generators/                                         │
│   │   ├── primitive-colors.ts                             │
│   │   ├── semantic-colors.ts                              │
│   │   ├── scales.ts                                       │
│   │   └── typography.ts                                   │
│   ├── writers/                                            │
│   │   ├── css.ts        → tokens.css (custom properties)  │
│   │   ├── esm.ts        → index.js (ESM barrel)           │
│   │   ├── dts.ts        → index.d.ts (type-safe)          │
│   │   └── tailwind.ts   → tailwind.preset.ts (phase 3)    │
│   └── validators/                                         │
│       ├── apca.ts       → CI contrast check               │
│       ├── gamut.ts      → P3 containment                  │
│       └── references.ts → resolve-check                   │
└──────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────┐
│ dist/                                                     │
│   ├── tokens.css         ← все фреймворки импортируют     │
│   ├── index.js           ← ESM (tree-shakable)            │
│   ├── index.d.ts         ← типы                           │
│   └── tailwind.preset.ts ← для Tailwind v4 (phase 3)      │
└──────────────────────────────────────────────────────────┘
```

### Stack matrix

| Framework | Import                                  | Зависимости                 |
|-----------|-----------------------------------------|------------------------------|
| Next.js 15 | `import '@lab-ui/tokens/css'` в layout | none                         |
| Vue / Nuxt | `css: ['@lab-ui/tokens/css']` в config | none                         |
| Svelte / SvelteKit | `import '@lab-ui/tokens/css'` в `app.html` | none             |
| Tailwind v4 | `@import '@lab-ui/tokens/tailwind'` (опционально) | Tailwind 4+         |

Рантайм — **чистые CSS custom properties**. Никакого JS-кода у клиента.

---

## 3. `tokens.config.ts` — master config

Единая точка параметризации. Формат TS для типобезопасности и IDE-подсветки опечаток.

```ts
// packages/tokens/config/tokens.config.ts
import type { TokensConfig } from '../src/types'

export const config: TokensConfig = {
  colors: {
    gamut: 'p3',                       // 'p3' | 'srgb'
    neutrals: {
      steps: 13,                       // 0..12
      hue: 283,                        // базовая H для neutral (cool-gray bias)
      chroma: { min: 0, max: 0.005 },  // почти нейтрально, крошечный cool-tint
      lightness: {
        light: { from: 1.00, to: 0.08 },      // светлая тема: 0 белый, 12 близко к черному
        dark:  { from: 0.08, to: 1.00 },      // темная: инверсия
      },
      lightness_ic_delta: -0.02,       // IC делает neutral'ы чуть темнее для контраста
      interp: 'linear',                // 'linear' | 'ease-in' | 'ease-out'
    },
    accents: {
      // Каждый акцент = single anchor (Light-mode), остальные моды выводятся формулой
      // + опционально per-mode override (для акцентов где формула даёт плохой результат)
      brand:  { light: { L: 0.603, C: 0.218, H: 257 } },
      red:    { light: { L: 0.608, C: 0.214, H: 22  } },
      orange: { light: { L: 0.712, C: 0.180, H: 56  } },
      yellow: { light: { L: 0.855, C: 0.177, H: 83  },
                overrides: {
                  light_ic: { L: 0.564, C: 0.145, H: 50 },   // hue-shift к amber для контраста
                }},
      green:  { light: { L: 0.656, C: 0.191, H: 144 } },
      teal:   { light: { L: 0.720, C: 0.140, H: 190 } },     // TODO: проверить overrides
      mint:   { light: { L: 0.850, C: 0.105, H: 165 },
                overrides: {
                  light_ic: { L: 0.620, C: 0.120, H: 155 },  // TODO: verify via Figma
                }},
      blue:   { light: { L: 0.603, C: 0.218, H: 257 } },     // alias brand
      indigo: { light: { L: 0.520, C: 0.230, H: 280 } },
      purple: { light: { L: 0.555, C: 0.230, H: 310 } },
      pink:   { light: { L: 0.640, C: 0.230, H: 355 } },
    },
    statics: {
      white: { L: 1.00, C: 0, H: 0 },
      dark:  { L: 0.08, C: 0, H: 0 },   // non-pure-black для градиентов/теней
    },
    modes: ['light', 'dark', 'light_ic', 'dark_ic'] as const,
    mode_derivation: {
      // формулы для вывода Dark/IC из Light
      dark:     { dL: +0.045, dC: 0,     dH: 0 },
      light_ic: { dL: -0.10,  dC: +0.01, dH: +5 },
      dark_ic:  { dL: +0.08,  dC: -0.02, dH: 0 },
    },
    opacity: {
      // 29 фиксированных стопов из Figma Opacity collection
      stops: [
        0, 1, 2, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48,
        52, 56, 60, 64, 68, 72, 76, 80, 84, 88, 92, 96, 98, 99,
      ],
    },
  },

  scales: {
    //
    // Любая численная шкала задаётся одной из двух моделей:
    // 1. `ratio`-based: { base, ratio, steps, rounding }
    // 2. `anchor`-based: { anchors: { stepName: value }, interp: 'linear' | 'exp' }
    //
    fontSize: {
      model: 'ratio',
      base: 16,
      ratio: 1.272,                    // golden ratio ^ (1/2) ≈ √φ
      rounding: 'binary',              // 'binary' | 'integer' | 'none'
      steps: [
        { name: 'caption/xxs',  offset: -4 },
        { name: 'caption/xs',   offset: -3 },
        { name: 'caption/s',    offset: -2 },
        { name: 'text/m',       offset:  0 },   // baseline
        { name: 'headline/l',   offset: +1 },
        { name: 'title/xl',     offset: +2 },
        { name: 'title/2xl',    offset: +3 },
        { name: 'title/3xl',    offset: +4 },
        { name: 'title/4xl',    offset: +5 },
        { name: 'display/5xl',  offset: +6 },
        { name: 'display/6xl',  offset: +7 },
      ],
    },
    lineHeight: {
      model: 'anchor',
      interp: 'exp',
      anchors: {
        'caption/xxs':  1.60,
        'text/m':       1.00,
        'display/6xl':  0.85,
      },
    },
    tracking: {
      model: 'anchor',
      interp: 'exp',
      unit: 'pt',
      anchors: {
        'caption/xxs':  -0.25,
        'text/m':       -0.25,
        'headline/l':    0.00,
        'display/6xl':  -5.00,
      },
    },
    radius: {
      model: 'ratio',
      base: 4,
      ratio: 1.5,
      rounding: 'integer',
      steps: [
        'none','xxs','xs','s','m','l','xl',
        '2xl','3xl','4xl','5xl','6xl','7xl','full',
      ],
    },
    spacing: {
      model: 'ratio',
      base: 4,
      ratio: 1.5,
      rounding: 'integer',
      steps: [
        'none','xxs','xs','s','m','l','xl',
        '2xl','3xl','4xl','5xl','6xl','7xl',
      ],
      // Paddings/Margins переиспользуют spacing; margins добавляют отрицательные
      variants: {
        margin: { includeNegative: ['xxs','xs','s','m','l','xl'] },
      },
    },
    size: {
      model: 'ratio',
      base: 16,
      ratio: 1.5,
      rounding: 'integer',
      steps: [
        'xxs','xs','s','m','l','xl',
        '2xl','3xl','4xl','5xl','6xl','7xl',
      ],
    },
    blur:   { model: 'ratio', base: 2, ratio: 1.5, rounding: 'integer', steps: 12 },
    shift:  { model: 'ratio', base: 1, ratio: 1.5, rounding: 'integer', steps: 12 },
    spread: { model: 'ratio', base: 1, ratio: 1.5, rounding: 'integer', steps: 12 },
  },

  ladders: {
    // декларативное описание семантических паттернов — см. §5
    label:  { /* см. §5.1 */ },
    fill:   { /* см. §5.2 */ },
    border: { /* см. §5.3 */ },
    fx:     { /* см. §5.4 */ },
    misc:   { /* см. §5.5 */ },
  },

  runtime: {
    units: {
      // 4 zoom-уровня: 75% compact, 100% default, 116.6% comfortable, 133.3% large
      variants: [
        { name: '75',    multiplier: 0.75  },
        { name: '100',   multiplier: 1.00  },
        { name: '116_6', multiplier: 1.166 },
        { name: '133_3', multiplier: 1.333 },
      ],
    },
    zIndex: {
      // 15 уровней (см. Figma Layers page)
      steps: [
        'base','raised','dropdown','sticky','banner','overlay',
        'modal','popover','tooltip','toast','notification',
        'dev-tools','global','max','escape-hatch',
      ],
    },
  },
}
```

**Логика cells**: хочешь перейти с golden ratio на major second — меняешь `scales.fontSize.ratio: 1.272` → `1.125`, всё пересчитывается. Хочешь другой цвет brand — меняешь `accents.brand.light.H`, все 4 мода + все семантические ссылки пересчитываются.

---

## 4. Colors — генерация primitives

### 4.1 Neutral algorithm

```
for step s in 0..12:
  t = s / 12                           // normalized 0..1
  L = lerp(config.lightness[mode].from, config.lightness[mode].to, t)
  if mode == 'light_ic' or 'dark_ic':
    L += config.lightness_ic_delta * (mode.startsWith('light') ? +1 : -1)
  C = 0   // neutrals — near-zero chroma
  H = config.hue
  emit: N/{step} = oklch(L C H)
```

**Derivable opacity variants**: для каждого N/{step} генерируем N/{step}@{stop} для всех 29 стопов (автоматически, без ручного перечисления).

### 4.2 Accent algorithm

```
for accent A in config.accents:
  for mode M in config.modes:
    if A.overrides[M] exists:
      { L, C, H } = A.overrides[M]
    else:
      baseAnchor = A.light
      delta = config.mode_derivation[M]
      L = clamp(baseAnchor.L + delta.dL, 0, 1)
      C = clamp(baseAnchor.C + delta.dC, 0, 0.4)
      H = (baseAnchor.H + delta.dH + 360) % 360
    // Проверяем что попали в P3 gamut
    if not in_p3_gamut(L, C, H):
      C = max_chroma_in_p3(L, H)
      log warning (CI может падать)
    emit: {accent}/{mode} = oklch(L C H)
```

**Derivable opacity variants**: для каждого `{accent}/{mode}` генерируем `{accent}/{mode}@{stop}` × 29 стопов.

### 4.3 Statics

```
white/light = oklch(1.00 0 0)      // чисто белый
dark/light  = oklch(0.08 0 0)      // non-pure-black
```

Plus opacity variants — аналогично.

### 4.4 Opacity ladder

29 стопов, общие для всех цветов:
`0, 1, 2, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 68, 72, 76, 80, 84, 88, 92, 96, 98, 99`.

Имена CSS variables: `--opacity-0`, `--opacity-1`, ..., `--opacity-99`.

В цветовых токенах opacity применяется как `oklch(L C H / A)` где A = stop/100.

---

## 5. Semantic ladders

Каждая семантическая группа описывается **декларативно** как «паттерн → opacity-стоп/solid-step». Генератор применяет паттерн к каждому (color × mode) и создаёт соответствующий semantic token.

### 5.1 Labels

```ts
label: {
  // Accent labels
  accent: {
    steps: {
      primary:    'solid',
      secondary:  { normal: '@72', ic: '@80' },
      tertiary:   { normal: '@52', ic: '@72' },
      quaternary: { normal: '@32', ic: '@52' },
    },
  },
  // Neutral labels — Secondary в IC переключается с opacity на solid step
  neutral: {
    steps: {
      primary:    { normal: 'N12@solid',   ic: 'N12@solid' },
      secondary:  { normal: 'N8@72',       ic: 'N8@solid'  },
      tertiary:   { normal: 'N8@52',       ic: 'N8@72'     },
      quaternary: { normal: 'N8@32',       ic: 'N8@52'     },
    },
  },
},
```

### 5.2 Fills

```ts
fill: {
  // Accent fills — mode-invariant! (одинаково на все 4 мода)
  accent: {
    steps: {
      primary:    '@12',
      secondary:  '@8',
      tertiary:   '@4',
      quaternary: '@2',
      none:       '@0',
    },
  },
  // Neutral fills — зависят от моды
  neutral: {
    steps: {
      primary:    { light: 'N6@20', dark: 'N6@36', light_ic: 'N6@32', dark_ic: 'N6@44' },
      secondary:  { light: 'N6@16', dark: 'N6@32', light_ic: 'N6@24', dark_ic: 'N6@40' },
      tertiary:   { light: 'N6@12', dark: 'N6@24', light_ic: 'N6@20', dark_ic: 'N6@32' },
      quaternary: { light: 'N6@8',  dark: 'N6@16', light_ic: 'N6@16', dark_ic: 'N6@24' },
    },
  },
},
```

### 5.3 Borders

```ts
border: {
  accent: {
    steps: {
      strong: 'solid',
      base:   { normal: '@20', ic: '@32' },
      soft:   { normal: '@12', ic: '@20' },
      ghost:  '@0',
    },
  },
  neutral: {
    steps: {
      strong: { light: 'N9@solid', dark: 'N7@solid', light_ic: 'N10@solid', dark_ic: 'N6@solid' },
      base:   { light: 'N6@20',    dark: 'N6@32',    light_ic: 'N6@28',    dark_ic: 'N6@40'    },
      soft:   { light: 'N6@12',    dark: 'N6@20',    light_ic: 'N6@16',    dark_ic: 'N6@28'    },
      ghost:  '@0',
    },
  },
},
```

### 5.4 FX / Shadows

```ts
fx: {
  shadow: {
    // Shadows работают на N/Dark (чистом «теневом» цвете)
    steps: {
      minor:    { light_like: 'Dark@1',  dark_like: 'Dark@2'  },
      ambient:  { light_like: 'Dark@2',  dark_like: 'Dark@4'  },
      penumbra: { light_like: 'Dark@4',  dark_like: 'Dark@12' },
      major:    { light_like: 'Dark@12', dark_like: 'Dark@20' },
    },
    // IC режимы используют *_like варианты своих non-IC аналогов
    mode_map: {
      light: 'light_like', dark: 'dark_like',
      light_ic: 'light_like', dark_ic: 'dark_like',
    },
  },
  blur: { /* см. phase 2 — параметрическая шкала */ },
},
```

### 5.5 Misc

```ts
misc: {
  // Badge label-contrast / label-default — переключают static/light ↔ static/dark по моде
  badge: {
    label_contrast: {
      light: 'Static/Dark@solid',     // тёмный текст на светлом акценте
      dark:  'Static/Light@solid',    // светлый текст на тёмном акценте
      light_ic: 'Static/Dark@solid',
      dark_ic: 'Static/Light@solid',
    },
    label_default: {
      light: 'Static/Light@solid',
      dark:  'Static/Dark@solid',
      light_ic: 'Static/Light@solid',
      dark_ic: 'Static/Dark@solid',
    },
  },
  // Control-bg — CROSS-SEMANTIC ссылка (временное решение, см. §13.2)
  control: {
    bg: {
      light:    { ref: 'backgrounds.neutral.primary' },
      dark:     { ref: 'fills.neutral.primary' },
      light_ic: { ref: 'backgrounds.neutral.primary' },
      dark_ic:  { ref: 'fills.neutral.primary' },
    },
  },
},
```

**Control-bg задокументирован как временный паттерн**: в tier-2 будет компонентный слой, где каждый segmented control / badge / switch получит свой токен, ссылающийся напрямую на primitives/semantic без cross-reference между semantic-группами.

---

## 6. Genesis examples

### 6.1 Файл `neutrals.light.css` (generated)

```css
/* generated — не редактируй */
:root {
  --neutral-0:  oklch(1.000 0 283);
  --neutral-1:  oklch(0.923 0 283);
  --neutral-2:  oklch(0.847 0 283);
  /* ... */
  --neutral-12: oklch(0.080 0 283);

  /* derivable opacity */
  --neutral-0-a0:  oklch(1.000 0 283 / 0);
  --neutral-0-a1:  oklch(1.000 0 283 / 0.01);
  /* ... */
}
```

### 6.2 Файл `accents.light.css` (generated)

```css
:root {
  --brand:   oklch(0.603 0.218 257);
  --red:     oklch(0.608 0.214 22);
  /* ... */

  /* derivable opacity */
  --brand-a0:  oklch(0.603 0.218 257 / 0);
  --brand-a72: oklch(0.603 0.218 257 / 0.72);
  /* ... */
}
```

### 6.3 Файл `semantic.css` (generated, all modes)

```css
:root {
  /* Light mode — default */
  --label-primary:         var(--neutral-12);
  --label-secondary:       var(--neutral-8-a72);
  --label-tertiary:        var(--neutral-8-a52);
  --label-quaternary:      var(--neutral-8-a32);

  --fill-brand-primary:    var(--brand-a12);
  --fill-brand-secondary:  var(--brand-a8);
  /* ... */
}

@media (prefers-color-scheme: dark) {
  :root:not([data-mode]) {
    --label-primary:    var(--neutral-0);     /* inverted for dark */
    /* ... */
  }
}

[data-mode="dark"]     { /* same as media query */ }
[data-mode="light-ic"] { /* IC overrides */ }
[data-mode="dark-ic"]  { /* IC overrides */ }
```

---

## 7. APCA validator (CI)

### 7.1 Зачем APCA, не WCAG 2.x

WCAG 2.x создавался для печати в 1990-х. Он:
- плохо коррелирует с реальной читаемостью на экранах (часто «проходит» нечитаемые пары);
- не учитывает направление контраста (light-on-dark vs dark-on-light);
- не учитывает вес и размер шрифта.

APCA (WCAG 3 draft, Apple HIG, Figma lint) — перцептивный алгоритм, разработанный специально для экранов.

### 7.2 Пороги

| Use case            | Порог (Lc) | Режимы применения         |
|---------------------|-----------|---------------------------|
| Body text (normal)  | ≥ 60      | Light, Dark               |
| UI label (small)    | ≥ 75      | Light-IC, Dark-IC         |
| Decorative          | ≥ 45      | Ghost borders, placeholders |
| Non-text graphics   | ≥ 45      | Icons, dividers           |

Знак Lc: положительный = светлый текст на тёмном фоне; отрицательный = тёмный на светлом. В валидаторе берём `|Lc|`.

### 7.3 Test matrix

Для каждой пары `(label, background)` × 4 модов:

```ts
test('label.primary on backgrounds.common.primary — all modes', () => {
  for (const mode of modes) {
    const fg = resolve('label.primary', mode)
    const bg = resolve('backgrounds.common.primary', mode)
    const Lc = Math.abs(apca(fg, bg))
    const threshold = mode.endsWith('_ic') ? 75 : 60
    expect(Lc).toBeGreaterThanOrEqual(threshold)
  }
})
```

Генерация тестов — автоматическая (проходим по всем значимым парам из ladders config).

### 7.4 Реализация

APCA доступен как small dependency [@color/apca](https://www.npmjs.com/package/apca-w3) (~3 KB). Либо инлайним ~50 строк из [W3 reference](https://github.com/Myndex/apca-w3/blob/master/src/apca-w3.js). Преобразование OKLCH → sRGB через уже установленный `culori`.

---

## 8. Scales — parametric generation

### 8.1 `ratio`-based generator

```ts
function generateRatioScale(cfg: RatioScale): Map<string, number> {
  const { base, ratio, rounding, steps } = cfg
  const out = new Map<string, number>()
  for (const step of steps) {
    const offset = typeof step === 'object' ? step.offset : steps.indexOf(step)
    const name = typeof step === 'object' ? step.name : step
    const raw = base * Math.pow(ratio, offset)
    out.set(name, applyRounding(raw, rounding))
  }
  return out
}

function applyRounding(v: number, strategy: 'binary' | 'integer' | 'none'): number {
  if (strategy === 'none') return v
  if (strategy === 'integer') return Math.round(v)
  if (strategy === 'binary') {
    // nearest power-of-2-friendly round (8, 12, 14, 16, 20, 24, 32, 48, 64, ...)
    const log2 = Math.log2(v)
    const candidates = [Math.floor(log2), Math.round(log2 * 2) / 2, Math.ceil(log2)]
    return Math.round(Math.pow(2, candidates.reduce((a, b) =>
      Math.abs(Math.pow(2, a) - v) < Math.abs(Math.pow(2, b) - v) ? a : b
    )))
  }
  return v
}
```

### 8.2 `anchor`-based generator (для line-height, tracking)

```ts
function generateAnchorScale(cfg: AnchorScale, stepOrder: string[]): Map<string, number> {
  const anchorKeys = Object.keys(cfg.anchors)
  const out = new Map<string, number>()
  for (const step of stepOrder) {
    const [a, b] = findNearestAnchors(step, anchorKeys, stepOrder)
    const tA = stepOrder.indexOf(a) / (stepOrder.length - 1)
    const tB = stepOrder.indexOf(b) / (stepOrder.length - 1)
    const tX = stepOrder.indexOf(step) / (stepOrder.length - 1)
    const t  = (tX - tA) / (tB - tA)
    const interpolated = cfg.interp === 'exp'
      ? expInterp(cfg.anchors[a], cfg.anchors[b], t)
      : linearInterp(cfg.anchors[a], cfg.anchors[b], t)
    out.set(step, interpolated)
  }
  return out
}
```

### 8.3 Unit variants

```ts
// 4 zoom-уровня применяются ко всем «physical» scales (spacing, size, radius, fontSize)
// НЕ применяются: lineHeight (unitless), tracking (already relative), opacity.

for (const variant of config.runtime.units.variants) {
  for (const [name, value] of generatedScale) {
    emit(`--${scaleName}-${name}-${variant.name}`, value * variant.multiplier)
  }
}
```

Использование: `data-density="116_6"` на `<html>` → все CSS custom properties перезагружаются из variant-слоя.

---

## 9. Package layout

```
packages/tokens/
├── config/
│   ├── tokens.config.ts          ← единственный файл для правки параметров
│   └── types.ts
├── src/
│   ├── build.ts                  ← Bun entry
│   ├── generators/
│   │   ├── primitive-colors.ts   ← neutrals, accents, statics
│   │   ├── semantic-colors.ts    ← labels, fills, borders, fx, misc
│   │   ├── scales.ts             ← ratio/anchor scales
│   │   └── typography.ts         ← fontSize × lineHeight × tracking matrix
│   ├── writers/
│   │   ├── css.ts
│   │   ├── esm.ts
│   │   ├── dts.ts
│   │   └── tailwind.ts           ← phase 3
│   ├── validators/
│   │   ├── apca.ts               ← CI contrast check
│   │   ├── gamut.ts              ← P3 containment check
│   │   └── references.ts         ← unresolved-ref check
│   ├── utils/
│   │   ├── oklch.ts              ← wrapper around culori
│   │   └── interp.ts             ← linear/exp/eases
│   └── types.ts
├── dist/                          ← generated, gitignored
│   ├── tokens.css
│   ├── index.js
│   ├── index.d.ts
│   └── tailwind.preset.ts
├── tests/
│   ├── contrast.test.ts          ← APCA test matrix
│   ├── gamut.test.ts
│   ├── references.test.ts
│   └── snapshot.test.ts          ← regression for generated CSS
├── spec.md                       ← этот файл
├── package.json
└── tsconfig.json
```

### 9.1 `package.json` exports

```json
{
  "name": "@lab-ui/tokens",
  "type": "module",
  "exports": {
    ".":        { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
    "./css":    "./dist/tokens.css",
    "./tailwind": { "types": "./dist/tailwind.preset.d.ts", "default": "./dist/tailwind.preset.ts" }
  },
  "scripts": {
    "build":    "bun run src/build.ts",
    "dev":      "bun run --watch src/build.ts",
    "test":     "bun test",
    "lint":     "bun run src/validators/all.ts"
  },
  "dependencies": {
    "culori": "^4.0.0",
    "apca-w3": "^0.1.9"
  }
}
```

### 9.2 Удаляется / очищается

- `primitive/neutral.tokens.json`, `primitive/hue.tokens.json`, `primitive/hue-ic.tokens.json` — генерируются из config
- `semantic/*.tokens.json` — генерируются из config + ladders
- `material/*.tokens.json` — переезжают в отдельный package `@lab-ui/materials` (phase 4+, см. §13.1)
- `phase2/` — удаляется (dead code)

Старые JSON оставляем в git history; новые — не коммитим (dist/).

---

## 10. Build pipeline (Bun)

### 10.1 `src/build.ts`

```ts
import { config } from '../config/tokens.config'
import { generatePrimitiveColors } from './generators/primitive-colors'
import { generateSemanticColors }  from './generators/semantic-colors'
import { generateScales }          from './generators/scales'
import { generateTypography }      from './generators/typography'
import { writeCSS, writeESM, writeDTS } from './writers'
import { validateAll } from './validators/all'

const t0 = performance.now()

const primitive = generatePrimitiveColors(config.colors)
const semantic  = generateSemanticColors(config.ladders, primitive, config.colors.modes)
const scales    = generateScales(config.scales, config.runtime.units)
const typography = generateTypography(config.scales, scales)

await Promise.all([
  writeCSS({ primitive, semantic, scales, typography }),
  writeESM({ primitive, semantic, scales, typography }),
  writeDTS({ primitive, semantic, scales, typography }),
])

const { errors, warnings } = validateAll({ primitive, semantic })
if (errors.length) { console.error(errors); process.exit(1) }
if (warnings.length) console.warn(warnings)

console.log(`built in ${(performance.now() - t0).toFixed(0)}ms`)
```

### 10.2 Performance targets

| Phase         | Target  |
|---------------|---------|
| colors only   | < 50ms  |
| full build    | < 200ms |
| watch rebuild | < 30ms  |
| CSS output    | 15–25 KB gzipped |
| ESM output    | 20–40 KB unminified, tree-shakable |
| runtime JS    | **0 bytes** |

### 10.3 Node compatibility

Bun API используются точечно, всегда с fallback:

```ts
const read = typeof Bun !== 'undefined'
  ? (p: string) => Bun.file(p).text()
  : (p: string) => import('node:fs/promises').then(fs => fs.readFile(p, 'utf8'))
```

CI: матрица `bun@1.1` × `node@22 + tsx`.

---

## 11. Framework integration

### 11.1 Next.js 15

```tsx
// app/layout.tsx
import '@lab-ui/tokens/css'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  )
}
```

Mode switching:
```tsx
// components/ThemeToggle.tsx
'use client'
export function ThemeToggle() {
  return <button onClick={() => {
    document.documentElement.setAttribute('data-mode', 'dark')
  }}>dark</button>
}
```

### 11.2 Vue / Nuxt 3

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  css: ['@lab-ui/tokens/css'],
})
```

### 11.3 Svelte / SvelteKit

```html
<!-- src/app.html -->
<!doctype html>
<html lang="en" data-mode="light">
  <head>
    <link rel="stylesheet" href="/_app/tokens.css" />
    %sveltekit.head%
  </head>
  <body>%sveltekit.body%</body>
</html>
```

```ts
// vite.config.ts
import { sveltekit } from '@sveltejs/kit/vite'
export default { plugins: [sveltekit()] }
```

Плюс `import '@lab-ui/tokens/css'` в `+layout.svelte`.

### 11.4 Tailwind v4 preset (phase 3)

```css
/* app.css */
@import '@lab-ui/tokens/css';
@import 'tailwindcss';
@import '@lab-ui/tokens/tailwind';
```

preset добавляет `@theme` мапинг: `--color-label-primary`, `--color-fill-brand-primary` и т.д., доступные как utilities (`text-label-primary`, `bg-fill-brand-primary`).

---

## 12. Фазы реализации

### 12.1 Phase 1 · Colors (PR #1)

**Scope**:
- `tokens.config.ts` (только секции `colors`)
- `generators/primitive-colors.ts` (neutrals, accents, statics, opacity)
- `generators/semantic-colors.ts` (все ladders)
- `writers/{css,esm,dts}.ts`
- `validators/{apca,gamut,references}.ts`
- Очистка `primitive/`, `semantic/`, `phase2/` JSON файлов
- Snapshot тесты сгенерированных CSS

**Acceptance criteria**:
- `bun run build` → `dist/tokens.css`, `dist/index.js`, `dist/index.d.ts` за < 50 мс
- `bun test` — все APCA пары проходят Lc60 (normal) / Lc75 (IC)
- Gamut validation — все OKLCH в P3
- CSS custom properties доступны во всех 4 модах через `:root[data-mode="..."]` + `prefers-color-scheme`
- Snapshot тесты стабильны
- Next.js demo app рендерится без layout shift
- README обновлен с примерами импорта в Next/Vue/Svelte

**Не включено**: typography, spacing, radius, size, blur, shift, spread, unit variants.

### 12.2 Phase 2 · Scales + Typography (PR #2)

**Scope**:
- `tokens.config.ts` (секция `scales` + `runtime.units`)
- `generators/scales.ts` (ratio/anchor generators)
- `generators/typography.ts` (fontSize × lineHeight × tracking matrix + weights)
- Unit variants (4 density levels)
- Writers пополняются новыми секциями
- Snapshot тесты

**Acceptance criteria**:
- Изменение `scales.fontSize.ratio` в конфиге → весь typography scale пересчитан
- Unit variants рендерятся как отдельные токен-layers (`data-density="75" | "100" | "116_6" | "133_3"`)
- Font-family: Geist, Geist Mono загружаются через `@font-face`
- Font weights: 400/500/600/700
- Z-index токены экспортированы (15 уровней из Figma Layers page)

### 12.3 Phase 3 · Integration (PR #3)

**Scope**:
- Tailwind v4 preset
- Demo apps: `apps/demo-next`, `apps/demo-vue`, `apps/demo-svelte`
- `docs/` с примерами использования
- Storybook или аналог (опционально)

### 12.4 Phase 4+ · Отложено (см. §13)

- Materials
- Component-level tokens
- Icons, Flags

---

## 13. Отложенные подсистемы

### 13.1 Materials (GH issue)

Progressive shadows, Progressive blur, Backdrop (Soft/Muted/Base/Strong), Glass (Soft/Muted/Base/Strong). Требует анализа:

- `backdrop-filter` browser support + fallbacks
- `mix-blend-mode` в OKLCH P3
- Multi-stop blur (SVG filter vs layered backdrop-filter)
- Переключение Solid ↔ Glass по моде (Solid в Light, Glass в Dark?)

**Блокер для tier-2 компонентов** (Bottom Sheet, Alert Dialog, Tooltip используют Glass).

Создать GH issue `materials-subsystem` после мёрджа phase 1.

### 13.2 Component-level tokens (tier-2)

Слой между semantic и компонентами. Цель:
- убрать Control-bg cross-reference (сейчас это hack)
- дать каждому компоненту свой namespace: `badge.bg.primary`, `button.bg.hover`, `input.border.focus`
- разрешить композицию: компонентный токен → semantic или primitive напрямую

Блокер — нужны результаты phase 1 + phase 2 (чтобы ссылаться из компонентных токенов на стабильные имена).

### 13.3 Icons (4045:632), Flags (6468:159531)

Вне scope tier-1. Создать отдельный package `@lab-ui/icons` (SVG-спрайт или React/Vue/Svelte components), export через `@lab-ui/icons/react`, `@lab-ui/icons/vue`, `@lab-ui/icons/svelte`.

---

## 14. Открытые вопросы (для следующего агента)

1. **`neutrals.hue=283`** — проверить по Figma HEX'ам, возможно `H` дрейфует по шагам (в старом JSON было 248/265/275/286). Если да — нужен `hueByStep` override или interpolation config.

2. **Accent overrides для Mint, Teal** — в спеке стоят `TODO`. Нужно взять HEX'ы из Figma Colors page для Light-IC / Dark-IC режимов, сконвертировать через `culori`, добавить в config если delta > ~0.02 от формулы.

3. **`lightness_ic_delta`** (сейчас `-0.02`) — возможно должно зависеть от шага. Проверить по Figma: N0 и N12 в IC могут сдвигаться сильнее/слабее чем middle steps.

4. **Shadow colors** — сейчас все shadows работают на `Dark` primitive. Проверить в Figma: некоторые shadow-токены могут использовать accent tint (brand-shadow для focus ring).

5. **Control-bg mapping** — подтвердить, что cross-reference именно такой (Light/LIC → backgrounds.neutral.primary, Dark/DIC → fills.neutral.primary). Возможно другое распределение.

6. **Z-index 15 шагов** — названия в config'e — placeholder. Взять точные имена из Figma Layers page.

Эти вопросы НЕ блокируют старт, но должны быть закрыты до финализации phase 1. Подход: открывать issue на каждый, обращаться в комментариях к пользователю.

---

## 15. Changelog

- **v1.0 (draft)** — эта версия. Заложены все основные решения. Готов к реализации phase 1.

---

## 16. Контакты

- Figma source: `LuaiBd4anRi4DMZayKAnY2`
- Package: `@lab-ui/tokens`
- Репозиторий: `lemone112/labui`
- Подтверждения пользователя по спецификации — см. §0 (TL;DR).
