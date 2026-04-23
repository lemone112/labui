# Lab UI · Tier-1 Design Tokens · Implementation Plan **v2**

Status: **Proposal v2**, awaiting final sign-off before PR #4.
Author: Devin (session [e18f7764](https://app.devin.ai/sessions/e18f7764aa80498281928e11068ad60c)), 2026-04-22
Target repo: [lemone112/labui](https://github.com/lemone112/labui) — main has Phase 1 colors (PR [#3](https://github.com/lemone112/labui/pull/3)).
Supersedes: implementation-plan.md v1

Changelog vs v1:
- **Unified spine model** for all accent tiers (no opacity-based tier derivation for solid labels/borders/fills)
- **Perceptual compensation** cells between light and dark modes (Hunt/HK)
- **Composition-based derivable** (color + opacity stay as independent primitives, composed at semantic level)
- **Progressive shadows** system (multi-layer drop-shadow composition)
- **IC as orthogonal cell** to mode
- **Scaling** renamed from `density`, continuous
- **Labels = text + any icons** (not just monochrome)
- Unified **resolution pipeline** for all semantics

---

## 0. Executive summary

Система строится как **DAG из 7 слоёв**. Вся генерация проходит через **единый pipeline** на каждом слое — никаких специальных правил для конкретных tiers / modes / акцентов. Одна формула, много применений.

### Граф зависимостей

```
Layer 1 · Units                  (raw pixels, scaling)
     ↓
Layer 2 · Dimensions             (spacing / radius / size / fx / opacity — refs → L1)
     ↓
Layer 3 · Colors · Primitives    (neutrals spine / accent spines / statics / opacity stops)
     ↓
Layer 4 · Colors · Semantic      (bg / labels / fills / borders / fx / misc — resolved via pipeline)
     ↓                             ↓                     ↓
Layer 5 · Typography    Layer 6 · Z-index    Layer 7 · Materials
(refs → L1+L2+L3)      (raw ints)           (refs → L3+L4 + material_mode)
```

### Глобальные cells (12)

| # | cell | диапазон | default | эффект | слой |
|---|---|---|---|---|---|
| 1 | `base_px` | int | 4 | базовый инкремент пиксельной шкалы | L1 |
| 2 | `scaling` | float, cont. | 1.0 | масштаб всей сетки (zoom UI) | L1 |
| 3 | `airiness` | float, cont. | 1.0 | множитель spacing/radius step-index | L2 |
| 4 | `gamut` | `srgb` / `p3` | `p3` | финальный clamp цветов | L3 |
| 5 | `vibrancy` | float, 0.8-1.2 | 1.0 | множитель chroma акцентов | L3 |
| 6 | `neutral.hue` | 0-360 | 247 | базовый H нейтралов | L3 |
| 7 | `contrast_mode` | `normal` / `ic` | `normal` | переключение между tier-Lc-таргетами | L3-4 |
| 8 | `perceptual_comp.enable` | bool | `true` | применять Hunt/HK/Abney компенсации | L3 |
| 9 | `font_scale_ratio` | float | 1.125 | шаг типографической шкалы | L5 |
| 10 | `type_density` | float | 1.0 | множитель line-height | L5 |
| 11 | `material_mode` | `solid` / `glass` / `backdrop` | `solid` | рендер материал-поверхностей | L7 |
| 12 | `mode` | `light` / `dark` | `light` | базовый режим (IC — отдельная ось) | cross-cutting |

Плюс два switches (не ручки):
- `mode` × `contrast_mode` даёт 4 выхода: light/normal, light/ic, dark/normal, dark/ic
- `material_mode` даёт 3 параллельных рендера materials

---

## 1. Принципы

### 1.1. Один источник правды

Весь tier-1 живёт в `packages/tokens/config/tokens.config.ts`. Figma — опора для калибровки, не точка истины. Расхождения документируем (§11).

### 1.2. Все числа — только в L1

- В L2 нет raw px/pt literals — только refs (`unit/2`, `unit/4`)
- В L3 числа L/C/H только в spine control points и endpoint'ах нейтралов
- В L4 — только refs в формате `{primitive}@{opacity_stop?}` или `{semantic}`
- В L5 — только refs на `unit/N` + коэффициенты масштаба
- Regex-lint в CI ловит raw числа вне L1

### 1.3. Unified resolution pipeline

Каждая семантика разрешается одной функцией:

```typescript
resolve(
  def: SemanticDef,
  ctx: { mode, contrast, bg_context, gamut }
): ResolvedColor {
  // 1. выбор target Lc по tier + contrast_mode
  const target_Lc = tier_targets[def.tier][ctx.contrast]

  // 2. target L вычисляется обратным APCA на заданный bg
  const bg = resolve_primitive(def.bg_ref ?? ctx.bg_context, ctx)
  const target_L = apca_inverse(target_Lc, bg.L, def.orientation)

  // 3. spine-interp: получаем {L, H, C} в "чистой" точке на кривой цвета
  const { L, H, C_raw } = spine_interp(def.primitive.spine, target_L)

  // 4. chroma курва (гамут + HK boost)
  const C = apply_chroma_curve(C_raw, def.primitive.chroma_curve, L, vibrancy)

  // 5. перцептивная компенсация per mode (Hunt/HK для dark, passthrough для light)
  const compensated = apply_perceptual_compensation(
    { L, C, H },
    ctx.mode,
    perceptual_comp_cells
  )

  // 6. gamut clamp (binary-search в sRGB/P3)
  const clamped = gamut_clamp(compensated, ctx.gamut)

  // 7. опционально alpha (только для true-translucent семантик)
  if (def.opacity_stop !== undefined) {
    clamped.alpha = opacity_stop_value(def.opacity_stop)
  }

  // 8. validate contrast (debug / CI)
  verify_contrast(clamped, bg, target_Lc, ctx.contrast)
  
  return clamped
}
```

Один pipeline — для всех tiers всех акцентов всех режимов всех статусов. Никаких if-ов типа "если primary — lift, если tertiary — opacity". Всё через spine + contrast-target.

### 1.4. Derivable = композиция, не seal

Primitives в конфиге держат цветовые spines отдельно, opacity stops отдельно. Семантика ссылается на tuple `(primitive_ref, opacity_stop?)`. Build эмитит финальный OKLCH-with-alpha в одну CSS custom property.

**Opacity применяется ТОЛЬКО в тех случаях где действительно нужна прозрачность:**
- Glass materials (видно bg сквозь)
- Backdrop blur scrims
- Skeleton shimmers
- Focus ring glow
- Shadows (multi-layer progressive)
- Ghost/hint/placeholder семантики
- Hover/pressed state fills

Для **labels, borders, solid fills** opacity НЕ применяется — tiers это solid spine-точки.

### 1.5. Invariants (закрепляем в тестах)

| слой | invariant |
|---|---|
| L1 | `unit-N` целые px при root=16; эмит в rem; нет `--px-*`/`--pt-*`; `scaling` не ломает целочисленность (CI проверяет) |
| L2 | все refs резольвятся; нет raw чисел; radius-full=9999px сентинел в px |
| L2 concentric | `clamp(min, outer−padding, max)` ≥ 0; anchor-set `none/min/base/max/full` полный |
| L3 spines | `H(L)` monotonic; anchor — одна из control points; chroma_curve ≥ 0 |
| L3 neutrals | mirror симметрия: dark выводится логически от light через mode |
| L3 derivable | opacity_stop применяется только к финальному цвету; L/H не меняется |
| L4 | все tiers на canonical bg проходят target Lc (max APCA, WCAG) |
| L4 IC | все tiers на canonical bg проходят IC target Lc (75/60/45/30) |
| L5 | все size/lh кратны `base_px/2`; line-height в диапазонах курса |
| L6 | monotonic z-index scale |
| L7 | переключение `material_mode` не ломает contrast labels на materials |

---

## 2. Layer 1 — Units

### 2.1. Cells

```typescript
units: {
  base_px: 4,              // базовый инкремент в px при root font-size = 16
  scaling: 1.0,             // continuous float; рекомендованные пресеты: 0.75, 1.0, 1.166, 1.333
  range: { min: -7, max: 27 },
}
```

### 2.2. Генерация

```
unit(n) = round(n * base_px * scaling)   // целые px; эмитится в rem через /16
```

Range: `unit-N` для `N ∈ {-7, -6, ..., 27}` — одна целочисленная шкала индексов. Negatives используются в `spacing_margin`.

Half-step/`pt` семейство упразднено — `rem` нативно покрывает sub-pixel precision без параллельной шкалы.

### 2.3. Constraint

`base_px * scaling` должно давать целое (иначе `unit-1` после `rem × root=16` резолвится в 4.5px, ломая subpixel rendering).

**Валидация:** при non-integer результате → warning build'а с suggestion ближайшего безопасного scaling. В CI проверяем для пресетов {0.75, 1.0, 1.166, 1.333} что все N в range дают целые (значения в `units.values` до rem-конвертации).

### 2.4. Output

```css
/* L1 Units — emitted in rem at root=16; scales with browser zoom */
:root {
  --unit-0:   0;           /* bare zero is idiomatic */
  --unit-1:   0.25rem;     /*  4px @ root=16 */
  --unit-2:   0.5rem;      /*  8px */
  --unit-4:   1rem;        /* 16px — anchor */
  /* ... */
  --unit-27:  6.75rem;     /* 108px */
  --unit--1: -0.25rem;
}
```

### 2.5. Invariants

- Все `--unit-N` при scaling ∈ plan presets резольвятся в целые px при root=16
- Нет остаточных `--px-*` или `--pt-*` имён в эмите
- `--radius-full: 9999px` — единственное место где px остаётся в CSS (pill sentinel, density-immune)

---

## 3. Layer 2 — Dimensions

### 3.1. Cells

```typescript
dimensions: {
  airiness: 1.0,  // множитель step-index в name→step mapping
}
```

### 3.2. Семейства

**Adaptives** (responsive targets):
```
breakpoint.desktop.width = unit/360  // 1440px
breakpoint.mobile.width  = unit/97   // 390px
layout_padding.default   = unit/5    // 20px
w_sidebar_left           = unit/16   // 64px
w_sidebar_right          = unit/5    // 20px
```

**Spacing / Padding** (positive only):
```
none=unit/0, xxs=unit/1, xs=unit/2, s=unit/3, m=unit/4, l=unit/6, xl=unit/8,
2xl=unit/10, 3xl=unit/12, 4xl=unit/16, 5xl=unit/20, 6xl=unit/24, 7xl=unit/27
```

**Spacing / Margin** (includes negatives):
```
neg-l=unit/-4, neg-m=unit/-3, ..., none=unit/0, xxs..7xl (как padding)
```

**Radius** (R1 Hybrid — 5 anchors, continuous via `clamp()`, no discrete t-shirt steps):
```
none = 0                        /* sharp corners (indicator-like) */
min  = unit/1                   /* 4px  — minimum soft radius */
base = unit/3                   /* 12px — default for non-nested elements */
max  = unit/8                   /* 32px — largest non-pill shape (ceiling for clamp) */
full = calc(infinity * 1rem)    /* pill/circle sentinel; used directly only */
```

**Дизайн-принцип:** параметрическая шкала вместо t-shirt набора. Промежуточные значения вычисляются **в месте применения** через `clamp(min, OUTER-PADDING, max)` — см. §3.4.

**Why R1 Hybrid.** Замена 12-значной t-shirt шкалы (`xxs..5xl, full`) на 5 anchor-точек. Сохраняет Figma variable совместимость (named stops для экспорта), но лишает дизайнера/разработчика необходимости выбирать между `radius-m` и `radius-l` — `clamp()` делает это сам исходя из outer × padding в конкретном месте.

**Size** (icon/avatar dimensions):
```
xxs=unit/5, xs=unit/6, s=unit/7, m=unit/8, l=unit/10, xl=unit/12, 2xl=unit/14, 3xl=unit/16
```

**FX**:
```
blur.{none,xxs..7xl}  → unit/N
shift.{neg-l..4xl}    → unit/N
spread.{none,xxs..m}  → unit/N
```

**Opacity stops** (29 значений):
```
[0, 1, 2, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48,
 52, 56, 60, 64, 68, 72, 76, 80, 84, 88, 92, 96, 98, 99]
```

### 3.3. Airiness application

Каждая name→step мапа задаётся как **индекс** в unit-шкале (L1). Airiness смещает индекс:

```
final_step = base_step + round(airiness_shift(base_step, airiness))
```

где `airiness_shift` — мягкая нелинейная функция (compact semantic имена двигаются меньше, big semantic — больше):

```typescript
airiness_shift(step, a) = step * log2(a)  // log2(1.0)=0 → no shift, log2(1.25)≈+0.32 → +1 step on xl+
```

### 3.4. Concentric radius pattern (CSS `clamp()`, runtime)

Курс §05 rule 8: `outer_radius = inner_radius + padding`. Ментально это симметричная формула — её можно читать в обе стороны:

- **Outside-in:** `inner = outer − padding` — «есть обёртка, вычисляем что внутри»
- **Inside-out:** `outer = inner + padding` — «есть маленький элемент, вычисляем что вокруг»

Обе формы корректны. Мы **не навязываем направление** в токенах — компонент-автор выбирает по месту.

**CSS-реализация (симметричный clamp):**

```css
.outer {
  --_r:   var(--radius-base);   /* собственный радиус */
  --_pad: var(--padding-m);     /* собственный padding */
  border-radius: var(--_r);
  padding: var(--_pad);
}

/* Вложенный элемент — inner концентрично */
.outer > [data-nested] {
  border-radius: clamp(
    var(--radius-min),                  /* floor — меньше не бывает */
    calc(var(--_r) - var(--_pad)),      /* idealized concentric */
    var(--radius-max)                   /* ceiling для nесимметричных случаев */
  );
}
```

**Что гарантирует `clamp()`:**

1. `outer − padding < min` → браузер выдаёт `min`. Floor срабатывает при «тонкой рамке»: дефолтный radius сохраняется, не уезжает в sharp angle.
2. `outer − padding > max` → браузер выдаёт `max`. Ceiling срабатывает при «огромном padding»: радиус не раздувается, упирается в `radius-max` (`2rem` по умолчанию). Если нужна пилюля — компонент явно пишет `border-radius: var(--radius-full);`, **не** полагается на clamp.
3. `min ≤ outer − padding ≤ max` → чистая концентрика.

**Inside-out вариант (если компонент хочет расти вокруг дочернего элемента):**

```css
.wrapper {
  --_child-r: var(--radius-min);
  --_pad:     var(--padding-s);
  border-radius: min(
    var(--radius-max),
    calc(var(--_child-r) + var(--_pad))
  );
}
```

**Арифметика.** `clamp()`/`calc()` выполняются браузером в floating-point; при дефолтных cells (`base_px=4, scaling=1.0, airiness=1.0, root=16px`) все входные anchor'ы кратны `0.25rem = 4px`, результат тоже целый px. При `airiness ≠ 1.0` или `scaling ∈ {1.166, 1.333}` значения могут стать fractional — браузер рендерит их без артефактов (subpixel antialiasing). `abs()` и `round()` не нужны — `clamp()` с `min` анкором уже отбрасывает отрицательные результаты корректно, а `round()` — ненужное усложнение.

### 3.5. Radius anchors · Output

```css
:root {
  --radius-none: 0;                      /* sharp */
  --radius-min:  0.25rem;                /* 4px  */
  --radius-base: 0.75rem;                /* 12px */
  --radius-max:  2rem;                   /* 32px */
  --radius-full: calc(infinity * 1rem);  /* pill — used directly only */
}
```

**Что остаётся в `px`:** ничего. Все anchor'ы — в `rem`. Даже `--radius-full` использует `calc(infinity * 1rem)` — числовое значение (infinity) не зависит от множителя, но единица `rem` держит стилистическую консистентность с остальной системой.

**ESM helpers** (packages/tokens dist):

```typescript
/** Outside-in: compute inner-radius CSS expression from outer + padding. */
export function innerOf(outerRadius: string, padding: string): string {
  return `clamp(var(--radius-min), calc(${outerRadius} - ${padding}), var(--radius-max))`
}

/** Inside-out: compute outer-radius CSS expression from inner + padding. */
export function outerOf(innerRadius: string, padding: string): string {
  return `min(var(--radius-max), calc(${innerRadius} + ${padding}))`
}
```

Usage:
```typescript
import { innerOf, radiusBase, paddingM } from '@labui/tokens'
const nestedRadius = innerOf(radiusBase, paddingM)
// → 'clamp(var(--radius-min), calc(var(--radius-base) - var(--padding-m)), var(--radius-max))'
```

### 3.6. Radius invariants (CI tests)

- Exactly 5 radius vars эмитятся: `none`, `min`, `base`, `max`, `full`. Нет `xxs/xs/s/m/l/xl/2xl/.../5xl`.
- `radius-none` = `0`
- `radius-min > 0` и `radius-min < radius-base`
- `radius-base < radius-max`
- `radius-full` эмитится как `calc(infinity * 1rem)` (not as `9999px`, not as `calc(infinity * 1px)`, not as `var(--radius-max)`)
- `innerOf(radiusBase, paddingM)` возвращает valid CSS `clamp()` expression
- При любых `outer, padding` из L1/L2 шкалы: CSS `clamp(min, outer-padding, max)` математически ≥ `min` (regex/string-test на эмите + numeric simulation)

---

## 4. Layer 3 — Colors · Primitives

### 4.1. Neutrals

Pivot-симметричная шкала, 13 шагов + White + Dark.

**Cells:**

```typescript
neutrals: {
  hue: 247,                     // базовый H
  steps: 13,                    // 0..12
  pivot_step: 6,                // точка симметрии
  endpoints_normal: { L0: 1.0, L12: 0.08 },
  endpoints_ic:     { L0: 1.0, L12: 0.0  },
  ic_amplification: 0.18,       // амплитуда растяжения IC к endpoints
  chroma_curve: {
    peak: 0.007,                // max chroma в pivot
    peak_step: 6,
    falloff: 0.3,               // скорость спада к endpoints
    floor: 0.0,                 // минимум (0 → pure grey on endpoints)
  },
  lightness_curve: 'apple',     // 'linear' | 'apple' (S-кривая) | 'bezier'
  hue_drift: {                  // Figma показывает cool→warm drift по шагам
    start_H: 247,
    end_H: 283,
    easing: 'ease-in',
  },
}
```

**Генерация базовой шкалы (light mode, normal contrast):**

```
for step ∈ {0..12}:
  t = step / 12
  L[step] = lightness_curve(t, endpoints_normal.L0, endpoints_normal.L12)
  C[step] = chroma_curve(step, peak, peak_step, falloff, floor)
  H[step] = hue_drift_interp(t, start_H, end_H, easing)
```

**Mirror for dark mode (no separate table):**

В dark mode физический pixel для семантики `bg-primary` (должен быть тёмный) берётся из **того же primitive `N12`, что и в light mode**. Но в light `N0` = lightest, в dark mode когда мы эмитим `--neutral-0-dark`, он **логически** указывает на физический step 12 (темнейший).

Это реализуется так:
- Одна физическая OKLCH-шкала `physical_step[0..12]` (генерируется один раз)
- Per-mode mapping: `light[N_i] = physical_step[i]`, `dark[N_i] = physical_step[12 - i]`
- В CSS эмитится `--neutral-0` (индекс не по физической шкале, а по логической «лёгкости в текущем mode»)

**IC через amplification от pivot:**

Для IC режима физические endpoint'ы ужимаются/растягиваются:

```
L_ic(step) = pivot_L + (L_normal(step) - pivot_L) * amp(step)
amp(step) = 1 + ic_amplification * |step - pivot| / max(pivot, steps - pivot)
```

На краях `amp → 1 + ic_amplification` (растягивает к pure 0/1). В pivot `amp = 1`.

Для `endpoints_ic: { L0: 1.0, L12: 0.0 }` → в IC darkест становится pure black.

**Statics:**

```typescript
statics: {
  white: { L: 1.0, C: 0, H: 0 },     // invariant across modes
  dark:  { alias: 'neutrals.N12' },  // tracks N12 (включая endpoints_ic → 000)
}
```

### 4.2. Accents — Spines

**Каждый accent = spine (2-4 control points):**

```typescript
type SpineControl = {
  L: number  // OKLCH L
  H: number  // OKLCH H
  C?: number  // опционально — override базовой chroma_curve в этой точке
}

type AccentSpec = {
  spine: SpineControl[]                // [(L, H, C?), ...] отсортировано по L
  chroma_curve: {                      // C по L
    peak: number                        // max C (часто в anchor region)
    peak_L: number                      // L где C максимален
    falloff_low: number                 // спад к низкому L
    falloff_high: number                // спад к высокому L
    floor: number                       // min C (обычно 0.03-0.05 для «всё ещё хроматический»)
  }
  chroma_boost_per_dL: number           // 0.2-0.5; компенсация HK при затемнении
  // anchor не хранится отдельно — anchor = одна из точек spine
}
```

**Пример spine для yellow:**

```typescript
yellow: {
  spine: [
    { L: 0.20, H: 45, C: 0.12 },   // bronze/coffee
    { L: 0.50, H: 65 },             // amber
    { L: 0.85, H: 83 },             // anchor — banana
    { L: 0.95, H: 100 },            // lemon
  ],
  chroma_curve: {
    peak: 0.177, peak_L: 0.85,
    falloff_low: 0.15, falloff_high: 0.10, floor: 0.06,
  },
  chroma_boost_per_dL: 0.5,   // yellow сильно теряет C при затемнении → агрессивный boost
}
```

**Пример для blue (slim spine):**

```typescript
blue: {
  spine: [
    { L: 0.20, H: 270 },   // navy-indigo
    { L: 0.95, H: 235 },   // sky-cyan
  ],
  chroma_curve: {
    peak: 0.218, peak_L: 0.60,
    falloff_low: 0.08, falloff_high: 0.12, floor: 0.08,
  },
  chroma_boost_per_dL: 0.2,
}
```

**Spine interpolation** — monotonic Hermite. Между соседними control-points H интерполируется плавно, не делая ненужных перегибов.

**Accent список (11):**
```
brand, red, orange, yellow, green, teal, mint, blue, indigo, purple, pink
```

`brand` = alias на `blue` по умолчанию (cells configurable).

### 4.3. Perceptual compensation

Per-mode cells для компенсации Hunt / HK / Abney:

```typescript
perceptual_comp: {
  enable: true,

  light: {
    chroma_mult: 1.0,
    lightness_shift: 0,
    hue_shift: 0,
  },

  dark: {
    chroma_mult: 0.93,         // Hunt: -7% (компенсация «казаться более саtur» на dark bg)
    lightness_shift: -0.02,    // HK: dark makes color appear brighter → physically darker
    hue_shift: 0,              // Chromatic adaptation — по умолчанию 0, при необходимости tune
  },

  // IC режимы не получают отдельной компенсации — IC уже это spine-lift
}
```

Применяется **после spine-lookup, до gamut-clamp**:

```typescript
function apply_perceptual_compensation(color, mode, cells):
  if (!cells.enable) return color
  const comp = cells[mode]
  return {
    L: color.L + comp.lightness_shift,
    C: color.C * comp.chroma_mult,
    H: color.H + comp.hue_shift,
  }
```

### 4.4. Opacity stops (primitive)

Отдельный primitive: список 29 значений (см. §3.2). Никаких производных от цветов.

```typescript
opacity: {
  stops: [0, 1, 2, 4, 8, ..., 99],
}
```

Emit как CSS:
```css
--opacity-0:  0;
--opacity-1:  0.01;
--opacity-72: 0.72;
/* ... */
```

Используется только для reference в семантиках (не как composition в CSS — build делает композицию и эмитит финальный OKLCH-with-alpha).

---

## 5. Layer 4 — Colors · Semantic

### 5.1. Tier targets (cells)

```typescript
tier_targets: {
  // APCA Lc требуемый на canonical bg
  primary: {
    normal: { apca: 60, wcag: 4.5 },   // body text
    ic:     { apca: 75, wcag: 7.0 },
  },
  secondary: {
    normal: { apca: 45, wcag: 3.0 },   // metadata
    ic:     { apca: 60, wcag: 4.5 },
  },
  tertiary: {
    normal: { apca: 30, wcag: 2.0 },   // decorative
    ic:     { apca: 45, wcag: 3.0 },
  },
  quaternary: {
    normal: { apca: 15, wcag: 1.5 },   // ghost / hint
    ic:     { apca: 30, wcag: 2.0 },
  },

  // Border / icon tiers — свои таргеты
  border_strong: { normal: { apca: 45 }, ic: { apca: 60 } },
  border_base:   { normal: { apca: 30 }, ic: { apca: 45 } },
  border_soft:   { normal: { apca: 15 }, ic: { apca: 30 } },
}
```

### 5.2. Семантическое дерево

**Покрываем Figma 4.2:**

```
Backgrounds /
  Neutral.{primary, secondary, tertiary}
  Overlay / Static
  Materials / {Elevated, Base, Muted, Soft, Subtle}

Labels /                       // текст + ИКОНКИ (ЛЮБЫЕ, цветные и монохромные)
  Neutral / {primary, secondary, tertiary, quaternary}
  Inverted
  {Brand, Danger, Warning, Success, Info} / {primary, secondary, tertiary, quaternary}
  Static / {Light, Dark}

Fills /                        // поверхности компонентов (HIG systemFill)
  Neutral / {primary, secondary, tertiary, quaternary, none}
  {Brand, Danger, Warning, Success, Info} / {primary, secondary, tertiary, quaternary, none}
  Static / {Light, Dark}

Border /
  Neutral / {strong, base, soft, ghost}
  {Brand, Danger, Warning, Success, Info} / {strong, base, soft, ghost}
  Static / {Light, Dark}

FX /
  Glow / {Brand, Danger, Warning, Success, Info}
  Focus-ring
  Skeleton
  Shadow / {minor, ambient, penumbra, major}  // tints, composed в presets
  Shadow-preset / {xs, s, m, l, xl}            // progressive multi-layer

Misc /
  Control / bg
  Badge / {label_contrast, label_default}
```

### 5.3. Semantic aliases (cells)

```typescript
semantic_aliases: {
  Brand:   'blue',
  Danger:  'red',
  Warning: 'orange',
  Success: 'green',
  Info:    'teal',
}
```

Cell-level override: `semantic_aliases.Warning = 'yellow'` если нужно.

### 5.4. Canonical bg contexts

Каждая семантика имеет **canonical bg** на котором она рассчитана:

```typescript
canonical_bgs: {
  'label.*':              'Backgrounds.Neutral.primary',
  'label.*-on-secondary': 'Backgrounds.Neutral.secondary',   // если нужно отдельно
  'label.*-on-tertiary':  'Backgrounds.Neutral.tertiary',
  'label.inverted':       'Fills.Neutral.primary',           // inverted label над filled компонентом
  'border.*':             'Backgrounds.Neutral.primary',
  'fill.*':               'Backgrounds.Neutral.primary',     // fills обычно на primary bg
}
```

Если компонент использует label на нетекущем bg (например `label-neutral-primary` на `bg-tertiary`) — это допустимо но контраст может быть не идеальный. Для критичных случаев есть explicit per-bg variant.

### 5.5. Ladder определения

#### Backgrounds

```typescript
backgrounds: {
  neutral: {
    primary:   { primitive: 'N0' },   // top-most light в light-mode, darkest в dark-mode
    secondary: { primitive: 'N1' },
    tertiary:  { primitive: 'N2' },
  },
  overlay:     { primitive: 'Dark', opacity_stop: 40 },   // scrim
  static:      { primitive: 'White' },
  materials: {
    elevated: { material_mode_deps: { solid: 'N0', glass: { primitive: 'N0', opacity_stop: 80 } } },
    // ... аналогично base, muted, soft, subtle
  },
}
```

#### Labels (общий паттерн)

```typescript
labels: {
  neutral: {
    primary:    { primitive: 'N12', tier: 'primary' },     // или на spine через apca_inverse
    secondary:  { primitive: 'N12', tier: 'secondary' },
    tertiary:   { primitive: 'N12', tier: 'tertiary' },
    quaternary: { primitive: 'N12', tier: 'quaternary' },
  },
  brand: {
    primary:    { primitive: 'blue', tier: 'primary' },
    secondary:  { primitive: 'blue', tier: 'secondary' },
    tertiary:   { primitive: 'blue', tier: 'tertiary' },
    quaternary: { primitive: 'blue', tier: 'quaternary' },
  },
  // ... danger, warning, success, info
  inverted:   { primitive: 'N0', tier: 'primary', bg_override: 'Fills.Neutral.primary' },
}
```

Build resolve: для каждой семантики вычисляет target_L на canonical_bg, находит spine-point, применяет chroma_curve и perceptual_comp.

#### Fills

```typescript
fills: {
  neutral: {
    primary:    { primitive: 'blue', tier: 'fill_primary' },    // fills используют accent primitive для sentiment-специфичного fill
    secondary:  { primitive: 'blue', tier: 'fill_secondary' },
    // ...
  },
  // Neutral fills для surface-chip-input-etc:
  neutral: {
    primary:    { primitive: 'N6', tier: 'fill_primary' },
    // ...
  },
}

// Tier targets для fills (меньше чем для labels — fills это декоративные surfaces):
fill_tier_targets: {
  fill_primary:    { normal: { apca: 15 }, ic: { apca: 30 } },
  fill_secondary:  { normal: { apca: 10 }, ic: { apca: 20 } },
  fill_tertiary:   { normal: { apca: 5 },  ic: { apca: 15 } },
  fill_quaternary: { normal: { apca: 2 },  ic: { apca: 10 } },
}
```

Важно: **fills это не просто `accent @ opacity` больше**. Это solid OKLCH на spine с низким Lc (чтобы быть едва видимым над bg). Чисто и в гамуте.

Если хочется glass-эффекта (полу-прозрачный fill) — это material_mode territory (см. §8).

#### Borders

```typescript
borders: {
  neutral: {
    strong:  { primitive: 'N9', tier: 'border_strong' },
    base:    { primitive: 'N6', tier: 'border_base' },
    soft:    { primitive: 'N6', tier: 'border_soft' },
    ghost:   { primitive: 'N6', opacity_stop: 0 },   // invisible placeholder
  },
  brand: {
    strong:  { primitive: 'blue', tier: 'border_strong' },
    base:    { primitive: 'blue', tier: 'border_base' },
    soft:    { primitive: 'blue', tier: 'border_soft' },
    ghost:   { primitive: 'blue', opacity_stop: 0 },
  },
  // ...
}
```

#### FX

**Glow:**
```typescript
fx: {
  glow: {
    brand:   { primitive: 'blue', opacity_stop: 40 },   // полу-прозрачная aura
    danger:  { primitive: 'red', opacity_stop: 40 },
    // ...
  },
  focus_ring:  { primitive: 'blue', opacity_stop: 32 },
  skeleton:    { primitive: 'N6', opacity_stop: 40 },
  
  // Shadow tints (для composition в presets):
  shadow: {
    minor:    { primitive: 'Dark', opacity_stop: 1 },
    ambient:  { primitive: 'Dark', opacity_stop: 2 },
    penumbra: { primitive: 'Dark', opacity_stop: 4 },
    major:    { primitive: 'Dark', opacity_stop: 12 },
  },
}
```

**Progressive shadow presets:**

```typescript
shadow_presets: {
  xs: [
    { y: 'unit/0.25', blur: 'unit/0.5', spread: 'unit/0', tint: 'minor' },
  ],
  s: [
    { y: 'unit/0.5', blur: 'unit/1',   spread: 'unit/0', tint: 'minor' },
    { y: 'unit/1',   blur: 'unit/2',   spread: 'unit/0', tint: 'ambient' },
  ],
  m: [
    { y: 'unit/1', blur: 'unit/2', spread: 'unit/0', tint: 'minor' },
    { y: 'unit/2', blur: 'unit/4', spread: 'unit/0', tint: 'ambient' },
    { y: 'unit/4', blur: 'unit/8', spread: 'unit/0', tint: 'penumbra' },
  ],
  l: [
    { y: 'unit/1',  blur: 'unit/3',  spread: 'unit/0', tint: 'minor' },
    { y: 'unit/3',  blur: 'unit/6',  spread: 'unit/0', tint: 'ambient' },
    { y: 'unit/6',  blur: 'unit/12', spread: 'unit/0', tint: 'penumbra' },
    { y: 'unit/12', blur: 'unit/24', spread: 'unit/0', tint: 'major' },
  ],
  xl: [
    { y: 'unit/2',  blur: 'unit/8',  spread: 'unit/0', tint: 'major' },
    { y: 'unit/8',  blur: 'unit/24', spread: 'unit/0', tint: 'penumbra' },
    { y: 'unit/24', blur: 'unit/48', spread: 'unit/0', tint: 'ambient' },
    { y: 'unit/48', blur: 'unit/96', spread: 'unit/0', tint: 'minor' },
  ],
}
```

Emit как CSS:
```css
--fx-shadow-xl: 
  0 var(--unit-2)  var(--unit-8)  0 var(--fx-shadow-major),
  0 var(--unit-8)  var(--unit-24) 0 var(--fx-shadow-penumbra),
  0 var(--unit-24) var(--unit-48) 0 var(--fx-shadow-ambient),
  0 var(--unit-48) var(--unit-96) 0 var(--fx-shadow-minor);
```

Использование: `box-shadow: var(--fx-shadow-xl);`

#### Misc

```typescript
misc: {
  control: {
    bg: { material_mode_deps: { solid: 'Backgrounds.Neutral.primary', glass: ... } },
  },
  badge: {
    label_contrast: { primitive: 'White' },
    label_default:  { mode_deps: { light: 'White', dark: 'Dark' } },
  },
}
```

### 5.6. Emit

Каждая семантика эмитится как одна CSS var + один ESM export + одна d.ts entry. Per-mode / per-contrast обёрнуты в `[data-mode="dark"]` / `[data-contrast="ic"]` селекторы:

```css
/* default: light / normal */
:root {
  --label-neutral-primary: oklch(0.08 0.005 247);
  --label-brand-primary:   oklch(0.47 0.21 250);
  /* ... */
}

[data-mode="dark"] {
  --label-neutral-primary: oklch(1.00 0.001 283);
  --label-brand-primary:   oklch(0.75 0.15 230);    // slim spine, Hunt-compensated
  /* ... */
}

[data-contrast="ic"] {
  /* IC overrides применяются поверх mode */
  --label-neutral-primary: oklch(0.0 0 0);          // pure black в IC
  --label-brand-primary:   oklch(0.35 0.23 253);    // stronger spine-lift
}

[data-mode="dark"][data-contrast="ic"] {
  --label-neutral-primary: oklch(1.0 0 0);
  --label-brand-primary:   oklch(0.85 0.18 225);
}
```

### 5.7. Validation

**CI tests:**

1. Для каждой семантики в каждом mode × contrast — verify target Lc + WCAG met on canonical bg
2. Для всех primitive refs — резольвятся
3. Gamut: все финальные цвета внутри p3 (sRGB если gamut=srgb)
4. Spine monotonicity: H(L) функция не имеет сильных скачков
5. Mirror симметрия нейтралов
6. Snapshot: полный CSS output стабилен при тех же cells

---

## 6. Layer 5 — Typography

### 6.1. Cells

```typescript
typography: {
  font_family:      'Geist',
  font_family_mono: 'Geist Mono',
  base_size_step:   4,         // = px/4 = 16px default
  scale_ratio:      1.125,     // major second
  lh_body_density:  1.5,
  lh_headline_density: 0.95,
  tracking: {
    body: 0,
    headline_per_log_size: -0.008,
    caps_boost: 0.1,
  },
}
```

### 6.2. Генерация

```
for key in ['xxs', 'xs', 's', 'm', 'l', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl']:
  exponent = index_of(key) - index_of('m')
  raw_size = base * scale_ratio^exponent
  size[key] = round_to_unit_half(raw_size)       // округляем до unit/N или unit/N.5
  lh_body[key] = round_to_unit(size[key] * lh_body_density)
  lh_headline[key] = round_to_unit(size[key] * lh_headline_density)
  tracking[key] = size[key] < 18 ? 0 : tracking.headline_per_log_size * log(size[key] / base)
```

### 6.3. Constraint

Все `size[key]` должны быть кратны `base_px / 2` (= 2px по умолчанию). При non-integer после ratio-powers — берём ближайший безопасный step. Это может создать неравномерный scale, но соблюдает grid (курс §02 rule 1).

### 6.4. Output

```css
--font-family:      "Geist", system-ui, sans-serif;
--font-family-mono: "Geist Mono", monospace;

--font-size-xxs: var(--unit-3);    /* 12px */
--font-size-xs:  var(--unit-3.5);  /* 14px */
--font-size-m:   var(--unit-4);    /* 16px */
/* ... */

--lh-body-m:       var(--unit-6);  /* 24px — lh=1.5 */
--lh-headline-3xl: var(--unit-12); /* 48px — lh=0.95 */

--tracking-3xl:  -0.024em;
```

### 6.5. Semantic aliases

```typescript
typography_semantics: {
  label_small:  'xxs',
  label_default: 'xs',
  body_small:   's',
  body_default: 'm',
  body_large:   'l',
  title_m:      'xl',
  title_l:      '2xl',
  headline_s:   '3xl',
  headline_m:   '4xl',
  headline_l:   '5xl',
  headline_xl:  '6xl',
}
```

---

## 7. Layer 6 — Z-index

Чистый constants layer:

```typescript
z_index: {
  primary:             0,
  skip_link:           50,
  secondary:           100,
  tertiary:            200,
  quaternary:          400,
  grouped_primary:     400,
  grouped_secondary:   500,
  grouped_tertiary:    600,
  inverted:            700,
  dropdown:            800,
  sticky:              900,
  modal_underlay:      1000,
  modal:               1100,
  toast:               1200,
  tooltip:             1300,
}
```

Emit:
```css
--z-primary:  0;
--z-modal:    1100;
```

---

## 8. Layer 7 — Materials

### 8.1. Cells

```typescript
materials: {
  mode: 'solid',   // 'solid' | 'glass' | 'backdrop'
}
```

### 8.2. Три режима

**solid:** materials = pure solid fills. Нет blur, нет alpha.

**glass:** materials = semi-transparent + backdrop-filter blur. Фон просвечивает.

**backdrop:** materials = solid fills, но применяется blur к слою ПОД материалом (layer-blur, не backdrop-filter).

### 8.3. Генерация

Каждый material-уровень определён per material_mode:

```typescript
materials_ladder: {
  elevated: {
    solid:   { primitive: 'N0' },
    glass:   { primitive: 'N0', opacity_stop: 80, backdrop_filter: 'blur(var(--fx-blur-xl))' },
    backdrop: { primitive: 'N0', layer_filter: 'blur(var(--fx-blur-s))' },
  },
  base: {
    solid:   { primitive: 'N1' },
    glass:   { primitive: 'N1', opacity_stop: 72, backdrop_filter: 'blur(var(--fx-blur-l))' },
    backdrop: { primitive: 'N1' },
  },
  // muted, soft, subtle — аналогично
}
```

### 8.4. Output (CSS)

```css
/* default: solid */
:root {
  --materials-elevated-bg:     var(--neutral-0);
  --materials-elevated-filter: none;
}

[data-material-mode="glass"] {
  --materials-elevated-bg:     oklch(1 0.001 247 / 0.80);
  --materials-elevated-filter: blur(var(--fx-blur-xl));
  /* применять через backdrop-filter */
}

[data-material-mode="backdrop"] {
  --materials-elevated-bg:     var(--neutral-0);
  --materials-elevated-filter: blur(var(--fx-blur-s));
  /* применять через filter на layer */
}
```

### 8.5. Invariant

Переключение material_mode не должно ломать contrast labels над material-surface. В тестах: для каждой семантики label, которая используется над material → APCA проходит во всех 3 режимах × 4 mode-contrast комбинациях.

---

## 9. Валидация (cross-layer)

### 9.1. Unit tests per layer

См. §2-8. Каждый слой имеет свой `.test.ts`.

### 9.2. Integration tests

- **APCA matrix** — все пары label/bg во всех mode × contrast × material_mode
- **Gamut check** — все финальные цвета в p3 (или sRGB)
- **Spine monotonicity** — H(L) не имеет резких jumps
- **Mirror symmetry** — нейтралы mirror через pivot
- **Snapshot** — полный dist стабилен при тех же cells
- **Build performance** — < 50ms colors, < 200ms full
- **Regex lint** — нет raw чисел вне L1, нет захардкоженных hex вне spine control points

### 9.3. Figma parity

Опционально (post-merge) — скрипт сравнения сгенерированного output с Figma export. Допуск ΔE ≤ 3 для semantics, ΔE ≤ 2 для primitive anchors.

---

## 10. Delivery phases

| PR | scope | est. size | risk |
|---|---|---|---|
| **#4** | L3 Colors v2 · spines + Hunt/HK + unified pipeline + composition derivable | ~1000 LOC + tests | Medium-High (architecture shift) |
| **#5** | L1 Units (scaling/airiness) + L2 Dimensions | ~500 LOC + tests | Low |
| **#6** | L5 Typography | ~400 LOC + tests | Low |
| **#7** | L6 Z-index + L7 Materials + Progressive shadows | ~500 LOC + tests | Medium (materials composition) |
| **#8** | CI hardening, Figma parity, docs | ~200 LOC | Low |

### 10.1. PR #4 — Colors v2

**Major changes:**
- `config/tokens.config.ts`: новые секции `neutrals` (pivot + curves), `accents` (spines), `perceptual_comp`, `tier_targets`. Удалить `mode_derivation`, `lightness_ic_delta`, все per-mode overrides в ladders.
- `src/generators/primitive-colors.ts`: mirror-based neutrals, per-accent spine interp, Hunt/HK compensation.
- `src/generators/semantic-colors.ts`: **полный rewrite**. Единый `resolve(def, ctx)` pipeline. Все tiers через spine.
- `src/generators/shadow-presets.ts`: **новый**. Multi-layer progressive shadows.
- `src/writers/{css,esm,dts}.ts`: emit формат обновить под новую схему; per-mode × per-contrast selectors.
- `src/validators/`: расширенные APCA tests для каждого tier; spine monotonicity; mirror check.
- `tests/`: полный rewrite под новую модель.
- `docs/spines.md`: **новый**, калибровка spines из Figma anchors + обоснование контрольных точек.

**Acceptance:**
- Все tiers всех акцентов всех mode × contrast проходят свой target Lc на canonical bg
- Spine monotonic для всех акцентов
- Build < 80ms colors-only (чуть медленнее из-за pipeline overhead, но < 100ms OK)
- CSS output size ± 20% от Phase 1
- Figma parity: primary tier совпадает с Figma HEX в ΔE ≤ 3; tertiary/quaternary могут отклоняться (unified spine, not Figma opacity tiers)

**Pre-PR работа (до открытия PR):**
1. Из Figma извлечь 44 anchor HEX (11 accents × 4 modes)
2. Для каждого accent определить spine control points (anchor + 1-3 доп. точки, основанные на чистом хроматическом ряду)
3. Задокументировать в `docs/spines.md` обоснование каждой точки (ссылки на Bezold/HK/Hunt где применимо)

### 10.2. PR #5 — Units + Dimensions

- `config/tokens.config.ts`: `units` (base_px, scaling), `dimensions` (airiness + full семейства)
- `src/generators/units.ts`, `src/generators/dimensions.ts`
- Regex-lint для raw чисел
- Tests для целочисленности px при пресетах scaling, для airiness step-shift

### 10.3. PR #6 — Typography

- `config/tokens.config.ts`: `typography`
- `src/generators/typography.ts`
- Scale ratio + line-height + tracking генерация
- Constraint kратности base_px/2
- Tests

### 10.4. PR #7 — Z-index + Materials

- `config/tokens.config.ts`: `z_index`, `materials`, `shadow_presets`
- `src/generators/z-index.ts`, `src/generators/materials.ts`, `src/generators/shadow-presets.ts`
- Per-material_mode CSS output
- Tests: material_mode switch не ломает label contrast; shadow presets корректно эмитятся в box-shadow string

### 10.5. PR #8 — CI + Docs

- Figma parity script
- README обновление с полным Next/Vue/Svelte/Tailwind примерами
- Changelog
- Pre-commit hooks для regex-lint

---

## 11. Risks & mitigations

| # | risk | mitigation |
|---|---|---|
| R1 | Unified spine meniается визуально от opacity-tiered в Figma → user не узнаёт | PR #4 делает side-by-side compare (Figma vs output), допуск ΔE ≤ 3 для primary, расхождения в tertiary документируются. User может вернуть opacity-tiers через cell-flag если надо |
| R2 | Spine control points для accents в первой итерации могут быть неоптимальными | Начальные spines — анкоры Figma + 1-2 точки экстраполяции. Итеративная настройка после PR #4 на реальных компонентах |
| R3 | Hunt/HK компенсация -7%/-0.02 слишком агрессивна / консервативна | Cells настраиваемые; дефолт консервативный (комm. можно отключить через `perceptual_comp.enable=false`) |
| R4 | Progressive shadows требуют много CSS → bloat | Измерить gzipped size, если > 5KB на shadows — optimize (меньше layers, ссылки на общие tints) |
| R5 | Per-bg canonical context многократно эмитит один и тот же accent в разных вариантах | Dedup при emit'е: если target_L совпадает между контекстами, реюз того же var |
| R6 | APCA inverse не всегда возвращает единственный L (функция не монотонна во всём диапазоне) | Binary search с preference toward anchor; iterate with damping if overshoot |
| R7 | Material_mode switch может создать caching issues в dev | Document через data-attr switching с CSS-level cascade, не через rebuilds |

---

## 12. Открытые вопросы (закрыть до PR #4)

1. **Spine control points** — сколько и какие для каждого accent? Предлагаю для первой итерации:
   - 2 точки (navy → sky) для: blue, indigo, purple, red, pink, teal, mint, green
   - 4 точки (detailed) для: yellow, orange
   
   Или всем по 3 для единообразия.

2. **Figma parity допуск** — ΔE ≤ 3 для primary tier OK? Для tertiary/quaternary допускаем большее расхождение (они unified spine, Figma была opacity).

3. **Hunt/HK дефолты** — `chroma_mult=0.93, lightness_shift=-0.02` консервативно. Если визуально не заметна компенсация — увеличиваем до `0.88, -0.04`. Calibrate в PR #4.

4. **IC neutrals pure endpoints** — `L12_ic=0.0` (pure black) OK?

5. **Material modes** — 3 modes (solid/glass/backdrop) или только 2 (solid/glass)?

6. **Scaling presets vs continuous** — continuous с warning если non-integer, или enforce только {0.75, 1.0, 1.166, 1.333}?

7. **Typography scale_ratio default** — 1.125 (major second) OK?

8. **Sentiment aliases** — Brand=blue, Danger=red, Warning=orange, Success=green, Info=teal. Или Warning=yellow?

9. **Canonical bgs** — предлагаю по умолчанию все labels на `Backgrounds.Neutral.primary`. Нужен ли per-bg variant token family (`label-brand-on-secondary`)?

---

## 13. Что НЕ в этом плане

- Component tokens (tier-2): `button.primary.bg`, `card.padding`
- Icons / Flags libraries
- Animation / motion tokens (частично в L5, полноценное — tier-2)
- Localization (RTL, per-script tracking)
- Theming UI / brand builder

---

## 14. Next steps

**Перед PR #4:**
1. Ты ревьюишь этот план, отвечаешь на §12 открытые вопросы
2. Я калибрую spines из 44 Figma anchors (если MCP появится) или из скриншотов/zip
3. Согласуем spine control points для 11 акцентов
4. Стартую PR #4

**После PR #4:** PR #5-8 последовательно, 1 день на каждый.

---

## 15. Приложение A · Полный config skeleton

```typescript
export const config: TokensConfig = {
  units: {
    base_px: 4,
    scaling: 1.0,
  },

  dimensions: {
    airiness: 1.0,
    spacing_padding: { /* mapping */ },
    spacing_margin: { /* mapping */ },
    radius: { /* mapping */ },
    size: { /* mapping */ },
    fx: { blur: ..., shift: ..., spread: ... },
    opacity: {
      stops: [0, 1, 2, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48,
              52, 56, 60, 64, 68, 72, 76, 80, 84, 88, 92, 96, 98, 99],
    },
  },

  colors: {
    gamut: 'p3',
    vibrancy: 1.0,

    neutrals: {
      hue: 247,
      steps: 13,
      pivot_step: 6,
      endpoints_normal: { L0: 1.0, L12: 0.08 },
      endpoints_ic:     { L0: 1.0, L12: 0.0 },
      ic_amplification: 0.18,
      chroma_curve: { peak: 0.007, peak_step: 6, falloff: 0.3, floor: 0.0 },
      lightness_curve: 'apple',
      hue_drift: { start_H: 247, end_H: 283, easing: 'ease-in' },
    },

    accents: {
      brand: 'alias:blue',
      blue: {
        spine: [{ L: 0.20, H: 270 }, { L: 0.95, H: 235 }],
        chroma_curve: { peak: 0.218, peak_L: 0.60, falloff_low: 0.08, falloff_high: 0.12, floor: 0.08 },
        chroma_boost_per_dL: 0.2,
      },
      red: {
        spine: [{ L: 0.20, H: 20 }, { L: 0.95, H: 25 }],
        chroma_curve: { peak: 0.214, peak_L: 0.60, falloff_low: 0.10, falloff_high: 0.10, floor: 0.06 },
        chroma_boost_per_dL: 0.2,
      },
      orange: {
        spine: [{ L: 0.20, H: 35 }, { L: 0.55, H: 50 }, { L: 0.75, H: 56 }, { L: 0.95, H: 70 }],
        chroma_curve: { peak: 0.180, peak_L: 0.70, falloff_low: 0.14, falloff_high: 0.10, floor: 0.06 },
        chroma_boost_per_dL: 0.4,
      },
      yellow: {
        spine: [{ L: 0.20, H: 45 }, { L: 0.50, H: 65 }, { L: 0.85, H: 83 }, { L: 0.95, H: 100 }],
        chroma_curve: { peak: 0.177, peak_L: 0.85, falloff_low: 0.15, falloff_high: 0.10, floor: 0.06 },
        chroma_boost_per_dL: 0.5,
      },
      green: {
        spine: [{ L: 0.20, H: 145 }, { L: 0.95, H: 150 }],
        chroma_curve: { peak: 0.191, peak_L: 0.65, falloff_low: 0.10, falloff_high: 0.12, floor: 0.06 },
        chroma_boost_per_dL: 0.2,
      },
      teal: {
        spine: [{ L: 0.20, H: 195 }, { L: 0.95, H: 185 }],
        chroma_curve: { peak: 0.14, peak_L: 0.70, falloff_low: 0.08, falloff_high: 0.10, floor: 0.05 },
        chroma_boost_per_dL: 0.2,
      },
      mint: {
        spine: [{ L: 0.40, H: 160 }, { L: 0.90, H: 168 }],
        chroma_curve: { peak: 0.105, peak_L: 0.85, falloff_low: 0.08, falloff_high: 0.06, floor: 0.04 },
        chroma_boost_per_dL: 0.3,
      },
      indigo: {
        spine: [{ L: 0.20, H: 285 }, { L: 0.95, H: 260 }],
        chroma_curve: { peak: 0.23, peak_L: 0.55, falloff_low: 0.10, falloff_high: 0.15, floor: 0.08 },
        chroma_boost_per_dL: 0.2,
      },
      purple: {
        spine: [{ L: 0.20, H: 315 }, { L: 0.95, H: 295 }],
        chroma_curve: { peak: 0.23, peak_L: 0.55, falloff_low: 0.10, falloff_high: 0.14, floor: 0.08 },
        chroma_boost_per_dL: 0.2,
      },
      pink: {
        spine: [{ L: 0.20, H: 350 }, { L: 0.55, H: 355 }, { L: 0.95, H: 355 }],
        chroma_curve: { peak: 0.23, peak_L: 0.65, falloff_low: 0.10, falloff_high: 0.12, floor: 0.08 },
        chroma_boost_per_dL: 0.3,
      },
    },

    statics: {
      white: { L: 1.0, C: 0, H: 0 },
      dark:  'alias:neutrals.N12',
    },

    perceptual_comp: {
      enable: true,
      light: { chroma_mult: 1.0, lightness_shift: 0, hue_shift: 0 },
      dark:  { chroma_mult: 0.93, lightness_shift: -0.02, hue_shift: 0 },
    },

    tier_targets: {
      primary:    { normal: { apca: 60, wcag: 4.5 }, ic: { apca: 75, wcag: 7.0 } },
      secondary:  { normal: { apca: 45, wcag: 3.0 }, ic: { apca: 60, wcag: 4.5 } },
      tertiary:   { normal: { apca: 30, wcag: 2.0 }, ic: { apca: 45, wcag: 3.0 } },
      quaternary: { normal: { apca: 15, wcag: 1.5 }, ic: { apca: 30, wcag: 2.0 } },

      fill_primary:    { normal: { apca: 15 }, ic: { apca: 30 } },
      fill_secondary:  { normal: { apca: 10 }, ic: { apca: 20 } },
      fill_tertiary:   { normal: { apca: 5 },  ic: { apca: 15 } },
      fill_quaternary: { normal: { apca: 2 },  ic: { apca: 10 } },

      border_strong: { normal: { apca: 45 }, ic: { apca: 60 } },
      border_base:   { normal: { apca: 30 }, ic: { apca: 45 } },
      border_soft:   { normal: { apca: 15 }, ic: { apca: 30 } },
    },

    semantic_aliases: {
      Brand:   'blue',
      Danger:  'red',
      Warning: 'orange',
      Success: 'green',
      Info:    'teal',
    },
  },

  semantics: {
    backgrounds: { /* см. §5.5 */ },
    labels:      { /* см. §5.5 */ },
    fills:       { /* см. §5.5 */ },
    borders:     { /* см. §5.5 */ },
    fx:          { /* см. §5.5 */ },
    misc:        { /* см. §5.5 */ },
  },

  typography: {
    font_family: 'Geist',
    font_family_mono: 'Geist Mono',
    base_size_step: 4,
    scale_ratio: 1.125,
    lh_body_density: 1.5,
    lh_headline_density: 0.95,
    tracking: { body: 0, headline_per_log_size: -0.008, caps_boost: 0.1 },
  },

  z_index: { /* см. §7 */ },

  materials: {
    mode: 'solid',
    ladder: { /* см. §8.3 */ },
  },

  shadow_presets: { /* см. §5.5 FX progressive shadows */ },
}
```

---

## 16. Summary

Главное что изменилось относительно v1:

1. **Unified spine model** — все tiers всех акцентов генерятся из одной spine-кривой. Никаких opacity-tier derivations для labels/borders/solid fills.
2. **Perceptual compensation** Hunt/HK между light и dark — физически корректно.
3. **Composition derivable** — opacity остаётся primitive, применяется только к translucent случаям.
4. **Progressive shadows** — multi-layer box-shadow composition.
5. **Scaling + airiness** — две ручки, разные ответственности.
6. **Labels = text + ANY icons** (не только монохромные).
7. **IC orthogonal к mode** — через cell, не как отдельный mode.
8. **Unified pipeline** — один `resolve()` для всех semantics, нет специальных правил.

Если всё ОК — закрываем §12 открытые вопросы, и стартую PR #4.
