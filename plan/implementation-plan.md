# Lab UI · Tier-1 Design Tokens · Implementation Plan

Status: **Proposal**, awaiting approval before any code change.
Author: Devin (session [e18f7764](https://app.devin.ai/sessions/e18f7764aa80498281928e11068ad60c)), 2026-04-22
Target repo: [lemone112/labui](https://github.com/lemone112/labui) — current main has Phase 1 colors (PR [#3](https://github.com/lemone112/labui/pull/3)).

---

## 0. Executive summary

Вся tier-1 дизайн-система строится как **DAG из 7 слоёв**, где каждый верхний слой — это только references к нижнему. Все числа появляются строго в Layer 1 (Units); выше — никогда raw numbers, только ссылки. Такой подход даёт:

1. **Параметричность** — 8 глобальных cell-ручек определяют ВСЁ. Меняешь одну — пересчитывается всё корректно.
2. **Физическую корректность** — OKLCH + P3 + APCA + Bezold-Brücke hue shift закрывают все известные цветовосприятие-подводные.
3. **Figma-parity как sanity-check, не как источник правды** — автогенерация попадает в Figma-значения в пределах ΔE ≤ 2, расхождения документируем.
4. **Тестируемость** — на каждом слое есть формальные инварианты, их проверяем в CI.

### Граф зависимостей

```
Layer 1 · Units         (raw pixels + densities)
    ↓
Layer 2 · Dimensions    (spacing / radius / size / fx / opacity — refs to px/pt)
    ↓
Layer 3 · Colors · Primitives    (neutrals / accents / statics / derivable)
    ↓
Layer 4 · Colors · Semantic      (bg / label / fill / border / fx / misc — refs to L3)
    ↓                              ↓                    ↓
Layer 5 · Typography      Layer 6 · Z-index    Layer 7 · Materials
(refs to L1+L2+L3)        (raw ints)          (refs to L3+L4)
```

### Восемь cells

| # | cell | диапазон | эффект | слой |
|---|---|---|---|---|
| 1 | `base_px` | целое, default 4 | базовый инкремент пиксельной шкалы | L1 |
| 2 | `density` | 75% / 100% / 116.6% / 133.3% | масштаб всей сетки | L1 |
| 3 | `airiness` | 0.75 … 1.5 | множитель spacing/radius поверх density | L2 |
| 4 | `type_scale_ratio` | 1.067 … 1.333 (mus 2nd … maj 3rd) | шаг кегля | L5 |
| 5 | `type_density` | 0.9 … 1.25 | множитель line-height по кеглю | L5 |
| 6 | `neutral_hue` | 0 … 360, default 247 | базовый H нейтралов | L3 |
| 7 | `vibrancy` | 0.85 … 1.15 | множитель chroma по всем акцентам | L3 |
| 8 | `contrast` | `normal` / `ic` | выбирает endpoint-ы нейтралов и bost для hue-shift акцентов | L3 |

Плюс derived context-switches (не ручки, а маркеры режима):

| # | switch | значения |
|---|---|---|
| 9 | `mode` | `light` / `dark` / `light_ic` / `dark_ic` |
| 10 | `gamut` | `srgb` / `p3` |
| 11 | `material_mode` | `solid` / `glass` / `backdrop` |

---

## 1. Общие принципы

### 1.1. Один источник правды

Всё — через `packages/tokens/config/tokens.config.ts`. Figma-макет — опора для калибровки, не точка истины. Когда формула и Figma расходятся > ΔE 2, документируем и выбираем один вариант (см. §11).

### 1.2. Все числа — только в L1

- В L2 (dimensions) НЕ должно быть строк типа `"8px"` или `8`. Только `'px/2'`, `'pt/1'`.
- В L3 (colors) числа L/C/H только у anchor'ов акцентов и у endpoint'ов нейтралов.
- В L4 (semantic) только references вида `N8@72`, `Brand@20`, `Dark@solid`.
- В L5 (typography) только refs вида `font-size: px/4` и коэффициенты (`type_scale_ratio ^ 3`).

Проверяется линтером в CI: regex на raw pixel literals вне L1.

### 1.3. Derivable-токены как first-class

**Нет отдельных осей «color» и «opacity»** на уровне семантики. `N6@16`, `Brand@72`, `Dark@12` — это **готовые primitive-токены**, каждый эмитится как отдельная CSS custom property / ESM export:

```css
--neutral-6-at-16: oklch(0.602 0.005 283 / 0.16);
--brand-at-72:     oklch(0.603 0.218 257 / 0.72);
--dark-at-12:      oklch(0.08  0     0   / 0.12);
```

Семантика ссылается напрямую: `--bg-fill-neutral-primary: var(--neutral-6-at-16)`. Никакой ран-тайм-композиции, никакого `color-mix()` в итоговом CSS. Это:

- матчится с тем, как токены устроены в Figma (переменная = готовый solid с alpha)
- даёт простую диагностику в DevTools (видно ровно один var)
- снимает вопрос «а как Tailwind/Svelte получит доступ» — просто `var()` в любом движке

Opacity-лестница задаётся в конфиге как множество стопов; для каждого нейтрал-шага и акцент-анкора **генерим только реально используемые** комбинации (нашли в семантике → сгенерили primitive). Это отличается от наивного cartesian product: 13 нейтралов × 29 стопов + 11 акцентов × 29 стопов = 696 tokens слишком много и большинство не нужно. По факту в Figma < 80 derivable-токенов — генерим just-in-time по фактическим ссылкам в ladder-конфигах.

### 1.4. Dark-mode ≠ инверсия

Физически dark-mode — это не `1 - L`. Это **зеркальная неутральная шкала** (симметрия вокруг pivot) + **мягкий hue-shift акцентов** по формуле Bezold-Brücke (см. §3.3). Без hue-shift:

- жёлтый в light_ic идёт в грязно-оливковый вместо янтарного (тянется к инварианту 571 nm)
- синий в dark-mode теряет «electric» и становится сумрачно-индиго

Это закладывается один раз в примитивы и работает автоматически.

### 1.5. Invariants we enforce

На каждом слое — формальные свойства, которые проверяем в тестах:

| слой | invariant |
|---|---|
| L1 | все `px/N` и `pt/N` целочисленны или с фиксированной десятой (для density 116.6%) |
| L2 | каждая dimension-token — ref, raw чисел нет |
| L3 neutrals | `N6` identical across `light` и `dark` (pivot) в normal-режиме; `dark(N_i) = mirror(light(N_{12-i}))` |
| L3 accents | anchor L/C/H match Figma в пределах ΔL ≤ 0.015, ΔC ≤ 0.01, ΔH ≤ 2° |
| L3 derivable | `{step}@{opacity}` = same OKLCH L/C/H, alpha = opacity/100 |
| L4 | все refs резольвятся; циклов нет; для каждой семантики APCA ≥ required tier |
| L5 | все sizes кратны `base_px` (или `base_px / 2` для мелких размеров) |
| L6 | все z-index значения в canonical scale |
| L7 | material_mode корректно переключает рендер bg без ломки контраста labels |

---

## 2. Layer-by-layer contract

### 2.1. Layer 1 — Units

**Источник правды для всех чисел в системе.**

**Cell inputs:**
- `base_px: number` (default `4`) — базовый инкремент
- `density: 'cozy' | 'default' | 'comfortable' | 'compact'`

**Density mapping:**
```
compact:     75%   multiplier 0.75
cozy:        default/small fonts
default:     100%
comfortable: 116.6%
spacious:    133.3%
```

Из Figma: `px-density` variables имеют 4 режима. У нас — одна cell, 4 пресета.

**Генерация `px/N` и `pt/N`:**
```
px(n) = round(n * base_px * density)       // целые пиксели после округления
pt(n) = round2(n * base_px * density / 2)  // pt = половина px, 2 знака
```

Range: `N ∈ {-7, -6, ..., 27}` для `px/`, `N ∈ {-1, 0, ..., 8}` для `pt/` (матчит Figma variables).

**Output:**
```css
--px-0: 0px;
--px-1: 4px;   /* default density, base_px=4 */
--px-2: 8px;
...
--px--1: -4px;  /* для шифтов теней, негативных margins */
...
--pt-0: 0pt;
--pt-1: 2pt;
```

**Инвариант:** для любой density и base_px все `px-N` целые. Для base_px=4 это выполняется всегда; для base_px=5 проверяем, что density не ломает целочисленность.

### 2.2. Layer 2 — Dimensions

**Только references на L1.**

Шесть семей (по Figma 1.1 Dimension):

1. **Adaptives** (responsive цели, не dimension в узком смысле)
   - `breakpoint.desktop.width` = `px/360` (т.е. 1440px), `mobile.width` = `px/97` (390px)
   - `layout-padding.default` = `px/5` (20px), `w-sidebar-left` = `px/16` (64px), `w-sidebar-right` = `px/5` (20px)
   - Флаги `mobile-nav: true`, `desktop-nav: true` — это не токены, это mode-switch атрибуты; выносим в отдельный DX-концепт (out of tier-1 tokens scope)

2. **Spacing/Padding** (positive only): `none=px/0, xxs=px/1, xs=px/2, s=px/3, m=px/4, l=px/6, xl=px/8, 2xl=px/10, 3xl=px/12, 4xl=px/16, 5xl=px/20, 6xl=px/24, 7xl=px/27`

3. **Spacing/Margin** (includes negatives): `neg-l = px/-4, neg-m = px/-3, ..., none = px/0, xxs...7xl` = positive copy of padding

4. **Radius**: `none=px/0, xxs=px/0.5, xs=px/1, s=px/1.5, m=px/2, l=px/3, xl=px/4, 2xl=px/5, 3xl=px/6, 4xl=px/8, 5xl=px/10, full=9999`

   Примечание по курсу §05 Corners & Shapes: nested radius formula `outer = inner + padding` — это runtime-правило для компонентов, не токен. Документируем в README.

5. **Size**: `xxs=px/5, xs=px/6, s=px/7, m=px/8, l=px/10, xl=px/12, 2xl=px/14, 3xl=px/16` — для icon sizes, avatar sizes, etc.

6. **FX**:
   - `blur.{none, xxs..7xl}` → `px/N`
   - `shift.{neg-l..neg-xxs, none, xxs..4xl}` → `px/N`
   - `spread.{none, xxs, xs, s, m}` → `px/N`

7. **Opacity**: `@0, @1, @2, @4, @8, @12, @16, @20, @24, @28, @32, @36, @40, @44, @48, @52, @56, @60, @64, @68, @72, @76, @80, @84, @88, @92, @96, @98, @99` — 29 stops. **Отдельный примитив**, не ссылается на px; нужен для L3 derivable-генерации.

**Output:**
```css
--spacing-padding-m: var(--px-4);
--radius-l:          var(--px-3);
--fx-blur-xl:        var(--px-4);
--opacity-72:        0.72;
```

**Cell inputs для L2:**
- `airiness: number` (default `1.0`) — множитель поверх density. `airiness = 1.25` → padding-m идёт в `px-5` вместо `px-4`. Эффект: более «воздушный» интерфейс без смены base_px.

Реализация: каждая name→px-index мапа в конфиге задана как «step index»; airiness смещает index, не сами числа. Это сохраняет кратность 4px (курс §04 rule 5).

### 2.3. Layer 3 — Colors · Primitives

**Три семейства + derivable.**

#### 2.3.1. Neutrals

Pivot-симметричная шкала, 13 шагов + 2 статика.

**Cell inputs:**
- `neutral.hue: number` (default 247 — cool-blue per Figma; см. курс §03 rules 5, 7 — warm-yellow запрещён)
- `neutral.chroma_curve: { peak: number, peak_step: number, falloff: number }` (default `{ peak: 0.007, peak_step: 6, falloff: 0.3 }`) — колокол вокруг pivot; на краях → 0 (статик чистый `chroma=0`)
- `neutral.lightness_curve: 'apple' | 'linear' | 'bezier'` (default `'apple'` — быстрый спад у ярких концов, плато в середине, как в iOS system greys)
- `neutral.pivot_step: number` (default 6 of 0..12)
- `neutral.endpoints_normal: { L_0, L_12 }` (default `{ 1.0, 0.08 }`)
- `neutral.endpoints_ic: { L_0, L_12 }` (default `{ 1.0, 0.0 }` — pure black при IC per Figma variable `Dark_ic: 000000`)
- `neutral.hue_drift: { start_H, end_H, easing: 'ease-in' | 'linear' }` (default `{ 247, 283, 'ease-in' }` — cool→warm by step, per Figma observation)

**Генерация:**
```
for step ∈ {0..12}:
  t = step / 12
  L[step] = lightness_curve(t, L_0, L_12)
  C[step] = chroma_curve(step, peak, peak_step, falloff)
  H[step] = hue_drift(t, start_H, end_H)
```

**Mirror invariant:**
```
dark(N_i) = light(N_{12 - i})
```
То есть `--neutral-6-dark` — это ровно тот же OKLCH что и `--neutral-6-light`. `--neutral-0-dark` = `--neutral-12-light`. Это свойство симметрии: не две шкалы, а одна, с двумя маппингами шагов.

**IC через amplification от pivot:**
```
L_ic(step) = pivot_L + (L_normal(step) - pivot_L) * amp(step)
где amp(step) = 1 + ic_amplification * |step - pivot| / pivot
```
На краях `amp → 1 + ic_amplification` (растягивает к endpoints). В середине `amp → 1` (pivot не движется).

`ic_amplification: number` (default `0.18` — подбирается так, чтобы endpoints попадали в pure white/black).

**Статики:**
```
statics.white = { track: 'step_0', across_modes: 'invariant' }
statics.dark  = { track: 'step_12', across_modes: 'tracks_endpoint' }
```
— формально `White = N0`, `Dark = N12`. Но генерим их как отдельные именованные токены для удобства в семантике (semantic `label.static.light` = `White`, не `N0`).

В IC режиме `Dark` автоматически становится `000000` (т.к. `endpoints_ic.L_12 = 0.0`). Это ожидаемое поведение; ещё не отдельная логика.

#### 2.3.2. Accents

11 анкеров × 4 режима = 44 solid + hue_shift per dL + chroma clip per dL.

**Cell inputs per accent:**
```typescript
type AccentSpec = {
  anchor: { L: number; C: number; H: number }  // light mode anchor
  hue_shift_per_dL: number  // deg / L-unit (см. §3.3 research)
  ic_hue_shift_boost: number  // default 1.0; для yellow/orange > 1.0
  chroma_clip_per_dL?: number  // default 0 — насколько C падает с |dL|
}
```

**Генерация per mode:**
```typescript
const mode_dL = {
  light:    0,
  dark:    +0.03,     // cell: `accents.dark_dL`, default +0.03
  light_ic: -0.08,    // cell: `accents.light_ic_dL`, default -0.08
  dark_ic: +0.08,     // cell: `accents.dark_ic_dL`, default +0.08
}
// ic_boost применяется ТОЛЬКО к hue, L-сдвиги независимы
const mode_hue_boost = {
  light:    1.0,
  dark:     1.0,
  light_ic: ic_hue_shift_boost,
  dark_ic:  ic_hue_shift_boost,
}

function generate(accent, mode, vibrancy, gamut):
  dL = mode_dL[mode]
  L = clamp(accent.anchor.L + dL, [0, 1])
  H = accent.anchor.H + dL * accent.hue_shift_per_dL * mode_hue_boost[mode]
  C = (accent.anchor.C - (accent.chroma_clip_per_dL ?? 0) * Math.abs(dL)) * vibrancy
  return clampToGamut({ L, C, H }, gamut)
```

`vibrancy: number` (default `1.0`) — cell для «приглушить/усилить все акценты разом».

Dark/light_ic/dark_ic значения `dL` и `ic_hue_shift_boost` — **глобальные cells**, не per-accent. Это важно: 1 ручка сдвигает все акценты на один и тот же dL, hue-shift получается разным за счёт разных `hue_shift_per_dL`. Это и есть «параметризация вместо таблиц».

#### 2.3.3. Статики (расширение)

```typescript
statics = {
  white: { L: 1.0, C: 0, H: 0 },  // invariant
  dark:  { track: 'neutral.N12' }, // auto-follows N12 (включая endpoints_ic)
}
```

#### 2.3.4. Derivable — генерация

Вход: opacity-лестница (из L2) + набор «что реально используется» (собираем с L4 ladders на этапе build).

```typescript
// collect всех (source, opacity) pairs из L4 semantic ladders
const used: Set<[PrimitiveRef, number]> = scanLadders(config.ladders)

// для каждого генерим first-class primitive
for ([ref, op] of used):
  for mode of modes:
    const base = resolvePrimitive(ref, mode)   // OKLCH с alpha=1
    emit(`${ref}-at-${op}-${mode}`, { ...base, alpha: op / 100 })
```

В CSS эмитим под одним именем с CSS var переключением per mode (через `@media` / `.dark` selectors). В ESM — словарь `{mode: {tokenName: value}}`.

**Invariant:** для любого `{source}@{opacity}` и mode, L/C/H равно L/C/H исходного `{source}` в том же mode; отличается только alpha.

---

### 2.4. Layer 4 — Colors · Semantic

**Только refs. Структура ladder'ов из Figma 4.2 Semantic:**

```
Backgrounds / Neutral.{primary, secondary, tertiary}
             / Overlay
             / Static
             / Materials / {Elevated, Base, Muted, Soft, Subtle}

Labels / Neutral.{primary, secondary, tertiary, quaternary}
       / Inverted
       / {Brand, Danger, Warning, Success, Info}.{primary..quaternary}
       / Static.{Light, Dark}

Fills / Neutral.{primary..quaternary, none}
      / {Brand, Danger, Warning, Success, Info}.{primary..quaternary, none}
      / Static.{Light, Dark}

Border / Neutral.{strong, base, soft, ghost}
       / {Brand, Danger, Warning, Success, Info}.{strong, base, soft, ghost}
       / Static.{Light, Dark}

FX / Glow.{Brand, Danger, Warning, Success, Info}
   / Focus-ring
   / Skeleton
   / Shadow.{minor, ambient, penumbra, major}

Misc / Control.bg
     / Badge.{label_contrast, label_default}
```

**Реализация:** декларативный конфиг на каждый ladder, ref-grammar как сейчас. Секции `label.accent`, `fill.accent`, `border.accent` — шаблон, применяемый к каждому акценту (Brand/Danger/Warning/Success/Info — semantic-alias'ы, см. §2.4.2).

#### 2.4.1. Semantic aliases → primitives

Figma использует semantic-имена: `Brand, Danger, Warning, Success, Info`. Они **указывают на конкретные primitive-акценты**:

```typescript
semantic_accent_map = {
  Brand:   'blue',     // тот же anchor как у brand
  Danger:  'red',
  Warning: 'orange',   // не yellow! yellow — отдельный декоративный accent
  Success: 'green',
  Info:    'teal',
}
```

Настраивается в cells (меняем `Danger → pink` одной строкой). Курс §03 rule 14 требует не менять sentiment-mapping без оснований — но технически это cell.

#### 2.4.2. Per-mode vs per-contrast refs

Из Phase 1 я выяснил, что для нейтральных labels нужно per-mode ref (напр. `secondary: light: N8@72, dark: N11@80`) потому что мы зеркалили шкалу и step-имена из Figma указывают на light-mode номера.

**После Phase 1.5 (mirror-симметрия)** эта per-mode раскладка упрощается:
- В Figma Light-mode `label.secondary = N8@72`, в Dark-mode `= N4@80`. Но Figma N4-dark = наш N8-light после зеркальства. Значит ref становится **mode-invariant**: `label.secondary = N8_after_mirror@72`.
- Технически в коде: `label.neutral.secondary = 'N_secondary@72'` где `N_secondary` резольвится через mirror в зависимости от mode автоматически.

Это удаляет 60% дублирования в `ladders`. Per-mode overrides оставляем только там, где физика требует (IC meaningful-different from normal).

#### 2.4.3. APCA-tiered validation

Как в Phase 1:
- Body labels (primary, secondary): требуют Lc ≥ 60 (normal), ≥ 75 (IC)
- Tertiary/quaternary: требуют Lc ≥ 45 (normal), ≥ 60 (IC) — decorative tier
- Icons (иcon-контраст на фоне): Lc ≥ 45
- Badges и border-accent: Lc ≥ 30 (decorative only)
- Tests pass/warn per tier; errors только для body

---

### 2.5. Layer 5 — Typography

**Cell-driven scale + кратность 4px.**

#### 2.5.1. Cells

```typescript
typography: {
  font_family: 'Geist',
  font_family_mono: 'Geist Mono',
  base_size_step: 4,          // = px/4 = 16px default
  scale_ratio: 1.125,         // major second; 1.067 (min 2nd) … 1.333 (maj 3rd)
  lh_density: 1.5,            // body line-height multiplier; headlines get 1.0-0.95 separately
  lh_headline_density: 0.95,  // per course §02 rule 4
  tracking: {
    body: 0,
    headline_per_size: -0.008, // -0.8% per unit of log(size) — см. курс §02 rule 7
    caps: 0.1,                 // +10% для ALL CAPS (rule 8)
  },
}
```

#### 2.5.2. Scale generation

```typescript
sizes = {
  xxs: base * ratio^-2,  // 12.64 → round to px/3 (12) or px/3.5 (14)
  xs:  base * ratio^-1,  // 14.22 → px/3.5 (14) or px/4 (16)
  s:   base * ratio^-0.5,
  m:   base,              // = 16px
  l:   base * ratio,      // 18
  xl:  base * ratio^2,    // 20.25 → px/5 (20)
  2xl: base * ratio^3,    // 22.78 → px/5.5 (22)
  3xl: base * ratio^4,    // ...
  ...
  6xl: base * ratio^8,
}
```

**Constraint:** все size-значения после округления **кратны `base_px / 2` = 2px**. Для `base_px=4, ratio=1.125, 8 steps` проверяем: если ratio-powers падают не на сетку, выбираем ближайший корректный step в px-шкале.

Курс §02 rule 1: «Root size divisible by 4». Базовый `base_px=4` → корень 16 кратен 4. Кегли кратны 2, что допустимо (half-step `px/N.5` допустим в Figma `pt/` шкале).

#### 2.5.3. Line-height

```typescript
line_height_per_size[key] = {
  body: round_to_px(sizes[key] * lh_density),
  headline: round_to_px(sizes[key] * lh_headline_density),
}
```

Выдаём две подшкалы: `--lh-body-m`, `--lh-headline-m`. В семантике компонентов выбираем нужную.

#### 2.5.4. Tracking

```typescript
tracking_per_size[key] = sizes[key] * tracking.headline_per_size
// = log-like curve: для headline больше уплотняем, для body tracking=0
```

Для `body` sizes — `tracking = 0`. Для `2xl+` — прогрессивно отрицательный (`-0.01em`, `-0.02em`, etc).

#### 2.5.5. Semantic names

Helper aliases:
- `label-small` = `xxs`
- `label-default` = `xs`
- `body-small` = `s`
- `body-default` = `m`
- `body-large` = `l`
- `title-m` = `xl`
- `title-l` = `2xl`
- `headline-s..3xl` = `3xl..6xl`

С мапой configurable.

### 2.6. Layer 6 — Z-index

**Чистый constants layer.**

```typescript
z_index: {
  primary: 0,
  skip_link: 50,
  secondary: 100,
  tertiary: 200,
  quaternary: 400,
  grouped_primary: 400,
  grouped_secondary: 500,
  grouped_tertiary: 600,
  inverted: 700,
  dropdown: 800,
  sticky: 900,
  modal_underlay: 1000,
  modal: 1100,
  toast: 1200,
  tooltip: 1300,
}
```

Матчит Figma 3.0 Z-index.

**Cell:** `z_base_step` (default 100). Лестница строится как `step * n + special offsets` — но по факту scale из Figma уже ± arbitrary, лучше оставить literal constants в конфиге.

Вывод: `--z-modal: 1100`.

### 2.7. Layer 7 — Materials

**3-way mode switch: `solid` / `glass` / `backdrop`.**

Каждый режим меняет как рендерится `Backgrounds/Materials/{Elevated, Base, Muted, Soft, Subtle}`:

- `solid`: materials = solid neutral fills (`Elevated = N0`, `Base = N1`, ...). Не используется blur.
- `glass`: materials = **semi-transparent + backdrop-filter blur**. Элемент полупрозрачен (N0@80 например), применяется `backdrop-filter: blur(var(--fx-blur-xl))`. Фоновый контент виден.
- `backdrop`: materials = **только blur, без opacity**. Элемент полностью матовый, но за ним включается layer blur (например для skeleton layers, spoiler reveal). Менее частый режим.

Курс §07 Blur & backdrops дает опорные значения opacity/blur (rule 10).

**Cell:** `material_mode: 'solid' | 'glass' | 'backdrop'` (global для всего UI). В runtime можно переключать через `[data-material-mode="glass"]` CSS selector.

**Генерация:**
```css
/* materials.solid */
[data-material-mode="solid"] {
  --bg-materials-elevated: var(--neutral-0);
  --bg-materials-base:     var(--neutral-1);
  /* ... */
}
[data-material-mode="glass"] {
  --bg-materials-elevated: var(--neutral-0-at-80);
  --bg-materials-base:     var(--neutral-1-at-72);
  --fx-backdrop-filter:    blur(var(--fx-blur-xl));
  /* ... */
}
[data-material-mode="backdrop"] {
  --bg-materials-elevated: var(--neutral-0);
  --fx-filter:             blur(var(--fx-blur-s));  /* layer blur, не backdrop */
}
```

Ну и в semantic-слое `Backgrounds/Materials/*` референсит `--bg-materials-*` — один ref, три реализации.

---

## 3. Deep-dive: dark-mode hue shift (**Bezold-Brücke**)

### 3.1. Физическая основа

**Три эффекта** работают вместе, когда меняется luminance:

1. **Bezold-Brücke shift** — hue воспринимаемого монохроматического света дрейфует с luminance. При увеличении L:
   - синие (λ ≈ 436-480 nm) тянутся к инварианту **474 nm** (H ≈ 245-255 в OKLCH)
   - зелёные (λ ≈ 490-560 nm) тянутся к инварианту **506 nm** (H ≈ 150)
   - жёлтые/оранжевые (λ ≈ 580-620 nm) тянутся к инварианту **571 nm** (H ≈ 100-110)
   Красные (λ > 620 nm) и фиолетовые сдвиг слабый.

2. **Abney effect** — hue смещается при добавлении белого (снижении purity). Синие → фиолетовеют, жёлтые → зеленеют. Существенно при alpha-композиции поверх белого.

3. **Helmholtz-Kohlrausch effect** — чистые хроматические цвета воспринимаются ярче, чем нейтраль той же luminance. Жёлтые «светятся» больше чем эквивалентный по L серый. Это объясняет почему anchor Yellow в Figma имеет `L=0.855` (не 0.9+) — иначе он казался бы «пересветлённым».

### 3.2. Инварианты в OKLCH-координатах

Три invariant hues попадают примерно в:

| H | λ (nm) | цвет | инвариант для |
|---|---|---|---|
| ~25-30 | 620-640 | red | orange/red/pink |
| ~100-110 | 571-580 | yellow | yellow/orange |
| ~150 | 506-510 | green | mint/teal/green |
| ~245-260 | 474-480 | blue | indigo/blue/purple |

Вне этих точек hue **дрейфует при смене L**.

### 3.3. Модель: `hue_shift_per_dL`

Для каждого акцента задаём коэффициент `k` = **deg of H per unit of dL** (dL = изменение lightness anchor'а).

```
H_mode = H_anchor + dL * k * ic_boost
```

**Теоретические коэффициенты** (из литературы по Bezold-Brücke + распространённых color-science таблиц):

| accent | anchor H | ближайший invariant | distance | sign (toward invariant) | k (deg/ΔL) |
|---|---|---|---|---|---|
| brand/blue | 257 | 245 | +12 | −k (darker = away) | **+18** (lighter → toward 245) |
| indigo | 280 | 245 | +35 | +k (darker = toward) | **+15** |
| purple | 310 | 245 | +65 | +k | **+10** |
| pink | 355 | 25 | +30 (через 0) | +k | **+8** |
| red | 22 | 25 | −3 | ≈ invariant | **−4** |
| orange | 56 | 100 | +44 | +k (darker → away) | **−16** |
| yellow | 83 | 100 | +17 | +k | **−22** |
| mint | 165 | 150 | −15 | +k | **+8** |
| teal | 190 | 150 | −40 | +k | **+12** |
| green | 144 | 150 | +6 | ≈ invariant | **−3** |

Знак `−` = «при осветлении H идёт на уменьшение». Для yellow это `H 83 → 83 + (−0.08) * (−22) = 83 + 1.76 = 84.8` при dark (+dL=+0.03? нет — у yellow light уже L=0.855, dark = 0.855+0.03=0.885 выше единицы → реально клэмп. Yellow идёт в **light_ic** с dL=−0.08 → H 83 + (−0.08) * (−22) = 83 + 1.76 ≈ 85). Но в Figma мы знаем что yellow light_ic уходит в олив H ≈ 50.

**Расхождение с Figma:** Figma yellow light_ic имеет H ≈ 50 (амбер). Моя теоретическая формула даёт ≈ 85. Значит Figma применяет **бо́льший** shift для yellow. Это может быть:

а) Figma делает `ic_hue_shift_boost = 2.5+` специально для yellow (ручная коррекция для читаемости в IC)
б) Figma shifts yellow сильнее физики — это дизайнерское решение, не Bezold-Brücke
в) Моя оценка k=−22 занижена

Пункт (а) — наиболее вероятен. Boost для yellow в IC нужен потому, что при снижении L без hue shift yellow становится похож на neutral-grey (теряет recognizable «yellow-ность»). Figma переуплощает в оранжевый, чтобы сохранить sentiment «warning».

**Решение:** per-accent `ic_hue_shift_boost` (не global). Default для всех — 1.0, для yellow — 2.5, для orange — 1.5, для blue/indigo — 1.2. Настраивается.

### 3.4. Калибровочная процедура (offline, до кодинга)

1. Достаю из Figma variables все 44 solid'а (11 accents × 4 modes) как HEX
2. Конвертирую в OKLCH
3. Для каждого accent вычисляю фактический `ΔH_mode / ΔL_mode` — это эмпирический `k_mode`
4. Сравниваю с теоретическим `k` (таблица выше)
5. Для совпадений (±20%) — использую теоретический k + ic_boost=1.0
6. Для расхождений — документирую, предлагаю: либо теоретический (физичнее), либо Figma (дизайнерский выбор), ты решаешь

Эту калибровку я выполняю **до** PR #4 и включаю результат в PR как таблицу в docs.

### 3.5. Chroma clip

При увеличении L сильно (dL > 0.1) chroma перестаёт помещаться в gamut. Модель:
```
C_mode = C_anchor * (1 - chroma_clip_per_dL * |dL|)
```
`chroma_clip_per_dL = 0.3` default. Плюс финальный gamut clamp (binary search в sRGB/P3 как в Phase 1).

### 3.6. Нейтрали — тоже hue drift

Из Figma: N0..N6 лежат на H ~ 247, N7..N12 — H ~ 283. То есть holes чуть **теплеет** при потемнении. Это не Bezold-Brücke (там низкая chroma), это дизайнерский приём — тёплые тёмные серые выглядят менее «цифровыми».

Реализация: `neutral.hue_drift` cell (см. §2.3.1). Для симметрии (dark=mirror(light)) важно, что drift идёт по L, не по mode. То есть `N6-light.H = N6-dark.H = 265` (средняя точка дрейфа) — pivot не сдвигается.

---

## 4. Валидация

Каждый слой — формальные тесты в `packages/tokens/tests/`.

### 4.1. Per-layer

| слой | test | описание |
|---|---|---|
| L1 | `units.test.ts` | все px-N целые; все pt-N кратны 0.5; density корректна |
| L2 | `dimensions.test.ts` | нет raw чисел (regex lint); все refs резольвятся |
| L3 neutrals | `neutrals.test.ts` | pivot invariant; mirror symmetry; IC endpoints pure; chroma в p3 |
| L3 accents | `accents.test.ts` | anchor matches Figma ≤ ΔL/ΔC/ΔH budget; hue_shift применён корректно |
| L3 derivable | `derivable.test.ts` | alpha = opacity/100; L/C/H из source |
| L4 APCA | `contrast.test.ts` | все пары label×bg проходят tier; tier-mapping задокументирован |
| L4 refs | `references.test.ts` | все refs резольвятся; нет циклов; unused primitives warning |
| L5 | `typography.test.ts` | sizes кратны base_px/2; line-heights в диапазоне курса |
| L6 | `z-index.test.ts` | monotonic order |
| L7 | `materials.test.ts` | mode switch не ломает контраст labels |

### 4.2. Cross-cutting

- **Snapshot** — полный dist вывод должен быть стабильным при тех же cells
- **Cell coherence** — изменение одной cell на 10% не ломает APCA / refs
- **Build perf** — < 50ms colors-only, < 200ms full
- **Figma parity** — CSV с фактическими vs ожидаемыми HEX-ами (tolerance ΔE ≤ 2 для primitives, ΔE ≤ 3 для semantic)

### 4.3. CI

На PR #4+ добавить:
- `bun test` (уже есть)
- `bun run build && node scripts/figma-parity.ts` — сравнение сгенерированных HEX с Figma export
- `bun run validate:apca` (уже есть, расширить tier-mapping)

---

## 5. Delivery phases

| PR | scope | rough size | risk |
|---|---|---|---|
| **#4** | Colors v2 · mirror + derivable + hue-shift | ~800 LOC + tests | Medium (calibration risk) |
| **#5** | L1 Units + L2 Dimensions | ~500 LOC + tests | Low |
| **#6** | L5 Typography | ~400 LOC + tests | Low |
| **#7** | L6 Z-index + L7 Materials | ~300 LOC + tests | Medium (materials semantics) |
| **#8** | Figma parity CI + docs polish | ~200 LOC | Low |

Итого ~5 PRs. Каждый — ≤ 1 день работы, зелёный CI, контрактные тесты. Никаких big-bang.

### 5.1. PR #4 · Colors v2

**Diff scope:**
- `config/tokens.config.ts` — новые cells: `neutral.{pivot_step, endpoints_ic, hue_drift, chroma_curve}`, `accents.{dark_dL, light_ic_dL, dark_ic_dL, per-accent hue_shift_per_dL, ic_hue_shift_boost}`, drop старые `mode_derivation` и `lightness_ic_delta`
- `src/generators/primitive-colors.ts` — mirror-based neutral gen, pivot amplification IC, per-accent hue-shift apply
- `src/generators/semantic-colors.ts` — упростить per-mode overrides до инвариантов через mirror
- `src/generators/derivable.ts` — **новый**, сканирует ladders, эмитит primitive-per-opacity
- `src/writers/{css,esm,dts}.ts` — эмит derivable как first-class primitives, semantics ссылаются через var()
- `src/validators/` — обновить tests под новый формат
- `tests/calibration.test.ts` — **новый**, Figma parity для 44 anchors + ~80 derivable
- `packages/tokens/docs/hue-shift.md` — **новый**, research summary + per-accent table с обоснованием каждого коэффициента

**Acceptance:**
- `bun test` 100%
- Figma parity ΔE ≤ 2 для всех 44 anchors (или документированные расхождения)
- CSS output size ± 10% от Phase 1 (derivable добавляет tokens, но semantic упрощается)
- `bun run build` < 50ms

**Risks:**
- Figma anchor values могут расходиться с теоретическими k — mitigate калибровочной процедурой §3.4 и документированием
- Mirror invariant может ломать существующие N_i@72 ссылки — mitigate пересчёт ladders под новую семантику

### 5.2. PR #5 · Units + Dimensions

- `config/tokens.config.ts` — `units`, `dimensions` секции
- `src/generators/units.ts` — px/N, pt/N с density
- `src/generators/dimensions.ts` — spacing/radius/size/fx/opacity
- Writers + tests

**Acceptance:**
- Все values матчат Figma 1.0 / 1.1
- Lint (no raw px) проходит

### 5.3. PR #6 · Typography

- `config/tokens.config.ts` — `typography` секция
- `src/generators/typography.ts` — sizes/lh/tracking
- Писатели + тесты

**Acceptance:**
- Все sizes кратны `base_px/2`
- LH-значения в диапазонах курса (body 1.2-1.6, headline 0.7-0.95)
- Tracking — отрицательный для headline, 0 для body

### 5.4. PR #7 · Z-index + Materials

- `config/tokens.config.ts` — `z_index`, `materials`
- `src/generators/z-index.ts`, `src/generators/materials.ts`
- Writers (emit per-mode CSS для materials via `[data-material-mode]`)
- Тесты: mode switch не ломает контраст labels

### 5.5. PR #8 · CI hardening

- Figma parity check в CI (или pre-commit hook)
- Documentation polish
- README с примерами для Next/Vue/Svelte/Tailwind
- Changelog и release note шаблон

---

## 6. Risks & mitigations

| # | risk | mitigation |
|---|---|---|
| R1 | Figma hue-shift != Bezold-Brücke; ломает ожидания дизайнера | Калибровка §3.4 до PR #4; доку с обоснованием; per-accent `ic_hue_shift_boost` настраивается |
| R2 | Mirror-симметрия нейтралов требует пересчёта semantic refs | PR #4 делает это системно; тесты APCA гарантируют что контраст не упал |
| R3 | Derivable cartesian product раздувает CSS | Generate-on-demand (scan ladders first); без ссылки — нет primitive |
| R4 | Base_px / density breaks когда сочетание не даёт целых px | Хардкодим список валидных комбинаций; unit-тест проверяет |
| R5 | Materials `glass` mode требует backdrop-filter который не везде работает | Fallback в `solid` через @supports; документируется |
| R6 | Typography ratio + base_px не совпадают с Figma sizes | Two options per sized: ближайший step в px-шкале; выбираем который ближе; docs |
| R7 | Semantic aliases (Brand→blue и т.д.) могут не совпадать с брендом конкретного пользователя | Cells configurable; документируется что можно переназначить |

---

## 7. Открытые вопросы (нужен ответ до PR #4)

1. **Calibration source of truth** — ты подтвердил option B (Bezold-Brücke + Figma sanity-check). Если калибровка выявит расхождение > 10° для какого-то акцента, какое правило:
   - (a) всегда доверяем физике (OKLCH + Bezold)
   - (b) всегда доверяем Figma
   - (c) case-by-case, ты ревьюишь каждое расхождение

2. **IC pure endpoints** — подтверждаешь что `Dark_ic = #000000` и `White_ic = #FFFFFF` как в Figma variables? (Это влияет на shadows и labels над bg.)

3. **`neutral.hue_drift`** — параметризуем как `{start: 247, end: 283, easing: 'ease-in'}` или оставляем константу 265? Figma показывает дрейф, но он ≤ 15°, возможно на глаз не критично.

4. **Sentiment aliases** — `Brand = blue`, `Danger = red`, `Warning = orange`, `Success = green`, `Info = teal`. Ок? Или `Warning = yellow`?

5. **Material modes** — три переключаемых (`solid` / `glass` / `backdrop`) или мы их параллельно эмитим и на уровне компонента выбирается? Figma — три независимых переключателя, каждый — boolean (как чекбоксы). Нужно понять семантику.

6. **Unit density cells** — 4 пресета (75/100/116.6/133.3) или continuous slider? Figma — 4 пресета, но continuous проще поддерживать.

7. **Typography scale** — готов ли идти с `major second (1.125)` как default? Более плотно (`minor second 1.067`) даст больше промежуточных кеглей; более широко (`major third 1.333`) — меньше размеров но дороже перепады.

---

## 8. Что НЕ входит в этот план (tier-2 / future)

- **Component tokens** (`button.primary.bg`, `card.padding`, etc.) — tier-2, после tier-1 готов
- **Icons / Flags** — отдельная библиотека, не токены
- **Animation/motion tokens** — частично в L5 (duration, easing), но полноценная motion-система — tier-2
- **Localization tokens** (RTL, letter-spacing per script) — тоже tier-2
- **Theming / brand variants** — поддерживается через swap `neutral.hue` + accent anchors, но полноценный theme-builder UI — tier-2

---

## 9. Приложение A · Cell defaults summary

```typescript
// Tier-1 defaults (one source of truth)
export const DEFAULTS = {
  // Layer 1
  units: {
    base_px: 4,
    density: 'default',  // 100%
  },

  // Layer 2
  dimensions: {
    airiness: 1.0,
  },

  // Layer 3
  colors: {
    gamut: 'p3',
    contrast: 'normal',  // 'ic' switches IC endpoints
    vibrancy: 1.0,

    neutrals: {
      hue: 247,
      pivot_step: 6,
      endpoints_normal: { L_0: 1.0, L_12: 0.08 },
      endpoints_ic:     { L_0: 1.0, L_12: 0.00 },
      ic_amplification: 0.18,
      chroma_curve: { peak: 0.007, peak_step: 6, falloff: 0.3 },
      lightness_curve: 'apple',
      hue_drift: { start_H: 247, end_H: 283, easing: 'ease-in' },
    },

    accents: {
      // global dL across modes
      dark_dL:     +0.03,
      light_ic_dL: -0.08,
      dark_ic_dL:  +0.08,

      // per-accent (L, C, H, k, boost)
      brand:   { anchor: { L: 0.603, C: 0.218, H: 257 }, k: +18, ic_boost: 1.2 },
      red:     { anchor: { L: 0.608, C: 0.214, H:  22 }, k:  -4, ic_boost: 1.0 },
      orange:  { anchor: { L: 0.712, C: 0.180, H:  56 }, k: -16, ic_boost: 1.5 },
      yellow:  { anchor: { L: 0.855, C: 0.177, H:  83 }, k: -22, ic_boost: 2.5 },
      green:   { anchor: { L: 0.656, C: 0.191, H: 144 }, k:  -3, ic_boost: 1.0 },
      teal:    { anchor: { L: 0.720, C: 0.140, H: 190 }, k: +12, ic_boost: 1.1 },
      mint:    { anchor: { L: 0.850, C: 0.105, H: 165 }, k:  +8, ic_boost: 1.3 },
      blue:    'alias:brand',
      indigo:  { anchor: { L: 0.520, C: 0.230, H: 280 }, k: +15, ic_boost: 1.2 },
      purple:  { anchor: { L: 0.555, C: 0.230, H: 310 }, k: +10, ic_boost: 1.1 },
      pink:    { anchor: { L: 0.640, C: 0.230, H: 355 }, k:  +8, ic_boost: 1.0 },
    },

    statics: {
      white: { L: 1.0, C: 0, H: 0 },
      dark:  'alias:neutrals.N12',
    },

    opacity_ladder: [0, 1, 2, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48,
                     52, 56, 60, 64, 68, 72, 76, 80, 84, 88, 92, 96, 98, 99],
  },

  // Layer 5
  typography: {
    font_family: 'Geist',
    font_family_mono: 'Geist Mono',
    base_size_step: 4,     // = 16px default
    scale_ratio: 1.125,    // major second
    lh_density: 1.5,
    lh_headline_density: 0.95,
    tracking: {
      body: 0,
      headline_per_size: -0.008,
      caps: 0.1,
    },
  },

  // Layer 7
  materials: {
    mode: 'solid',  // 'solid' | 'glass' | 'backdrop'
  },
}
```

---

## 10. Next steps

**Перед любым кодом:**
1. Ты ревьюишь план, отвечаешь на открытые вопросы §7
2. Я делаю калибровочную процедуру §3.4 (offline, до PR #4), показываю результат
3. Согласуем финальные `k` коэффициенты по каждому акценту
4. Стартую PR #4

**После одобрения плана:** PR #4 за ~1 день, затем PR #5-8 последовательно.

Если что-то в плане выглядит грязно — покажи, перепишу.
