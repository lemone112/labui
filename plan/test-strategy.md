# Lab UI · Tokens · Test Strategy

**Purpose:** deep, honest, self-documenting test coverage для всей tier-1 системы (7 layers). Не просто «зелёные галочки», а **активная защита от деградации и guidance для будущих агентов**.

**Problem statement (от user'а):**
> информация забывается, что-то теряется, выбери подход максимально грамотно и честно чтобы было 100% покрыто

**Target:** каждое архитектурное решение в [implementation-plan-v2.md](./implementation-plan-v2.md) защищено хотя бы одним конкретным тестом, FAIL которого даёт ясный actionable message со ссылкой на соответствующий §плана.

---

## 0. Принципы

### P1. Tests as executable spec

Тест это **spec в коде**. Если v2 plan говорит «H(L) spine monotonic» — есть тест `spine-monotonicity.test.ts` с этим assertion и комментарием-ссылкой на §4.2. Если план меняется — тест либо обновляется, либо красный. Drift не проскакивает.

### P2. Fail messages guide, don't just report

Плохой FAIL:
```
expected 60, got 53
```

Хороший FAIL:
```
label-brand-primary: APCA Lc=53 on canonical_bg=Backgrounds.Neutral.primary (L=1.0)
  Expected:  Lc ≥ 60 (tier_targets.primary.normal.apca; plan §5.1)
  Actual:    Lc = 53
  Diagnosis: blue spine doesn't reach low enough L for target Lc on white bg
  Fix:       add spine control point near L ≈ 0.47 in config.accents.blue.spine
             OR adjust tier_targets.primary if business decision changed
  Reference: plan §4.2, §5.1
```

Это создаёт CI comment, который будущий агент читает и сразу понимает что сломалось.

### P3. Test hierarchy = layer hierarchy

```
tests/
├── L1-units/              # Layer 1 · Units
├── L2-dimensions/         # Layer 2 · Dimensions
├── L3-primitives/         # Layer 3 · Primitive Colors
├── L4-semantics/          # Layer 4 · Semantic Colors
├── L5-typography/         # Layer 5 · Typography
├── L6-z-index/            # Layer 6 · Z-index
├── L7-materials/          # Layer 7 · Materials
├── cross-layer/           # integration, consistency
├── parity/                # Figma reference matching
├── guards/                # breaking change, snapshot, perf
└── runtime/               # browser / SSR integration (optional)
```

Тест который не ложится в эту иерархию — скорее всего лишний.

### P4. Каждый test file имеет header с _почему_ он существует

```typescript
/**
 * @layer L3 · Primitive Colors
 * @governs implementation-plan-v2.md §4.2 · Accent spines
 * @invariant H(L) монотонна между control points
 * @why Non-monotonic spine даёт визуальный "колебательный" эффект при
 *      traversal — напр. blue становится ЗЕЛЁНЫМ в середине L-диапазона
 *      если spine osc. Это ломает perceived color family.
 * @on-fail Check: (a) control points sorted by L; (b) no reversed H gaps;
 *          (c) Hermite interp не создаёт overshoot
 */
describe('L3 · Accent spine monotonicity', () => { ... })
```

Агент который через 3 месяца откроет этот файл в 3 утра — понимает контекст за 30 секунд.

### P5. No flaky, no skipped

Skipped test = documented ticket. Flaky test = bug в тесте или в коде. Ни того ни другого в main. CI fail = блок мерджа. Убрать `.skip`, `.only`, `xit` запрещено regex-lint'ом.

### P6. Speed budget

- Unit tests: < 50ms каждый
- Integration: < 500ms каждый
- Full suite: < 10s
- Parity suite (опционально, gated): < 30s

Перфоманс-budget enforced в CI — slow test = red.

### P7. Snapshot tests = only for stable outputs

Snapshot на финальный CSS — OK. Snapshot на intermediate values — запрещено (ломается при любой внутренней refactor). Snapshots версионируются и обновляются только через explicit `bun test -u` с PR review.

### P8. Parallel safe

Тесты не шарят state. Config загружается свежим в каждом test file. Это делает их тривиально parallelizable и даёт возможность shard'ить в CI для ещё большей скорости.

---

## 1. Test tiers (уровни глубины)

| # | tier | goal | run scope | speed |
|---|---|---|---|---|
| **T1** | **Unit** | Pure function correctness (OKLCH math, interp, APCA, gamut) | Каждая утилита | < 50ms |
| **T2** | **Contract** | Config schema, type-level invariants | Stare config | < 100ms |
| **T3** | **Invariant** | Математические свойства модели (monotonicity, mirror, convergence) | Generated primitives | < 200ms |
| **T4** | **Resolution** | Pipeline `resolve()` работает правильно на всех семантиках | All semantics × all modes | < 500ms |
| **T5** | **Contrast** | APCA + WCAG met на canonical bgs для всех tiers | All semantics × mode × contrast | < 1s |
| **T6** | **Emit** | Финальный CSS/ESM/d.ts имеет ожидаемую форму и не содержит запретных паттернов | Dist output | < 200ms |
| **T7** | **Parity** | Figma anchors совпадают с генерацией в пределах ΔE | 44 anchor HEX's | < 3s |
| **T8** | **Guard** | Breaking change detection, snapshot stability, perf budget | Full build | < 5s |
| **T9** | **Runtime** | CSS вары грузятся в браузере, mode switching работает (optional) | Playwright | < 30s |

Каждый тест должен ЯВНО заявлять свой tier в header — это помогает организовать CI pipeline: T1-T3 сначала, T4-T6 после, T7-T9 в конце fail-fast.

---

## 2. Layer 1 · Units

### tests/L1-units/

**L1.1 — base_px constraint**
```
Given config.units.base_px = N
Assert: N is positive integer
Assert: N is even (так как pt = base/2 должен быть integer)
Assert: N ∈ {2, 4, 6, 8, 16} (практичные значения)
```

**L1.2 — scaling integrality**
```
For each preset ∈ {0.75, 1.0, 1.166, 1.333}:
  For each N ∈ range(-7, 27):
    px_value = round(N * base_px * preset)
    Assert: px_value is integer
    Assert: abs(px_value - N * base_px * preset) < 0.5
```

**L1.3 — scaling continuity warning**
```
Given non-preset scaling = 1.1
Assert: build emits warning "scaling 1.1 may produce non-integer px values"
Assert: all px values still rounded
Assert: max rounding error logged in build output
```

**L1.4 — px/pt range completeness**
```
For each N in expected range:
  Assert: CSS var --px-N exists
  Assert: CSS var --pt-N exists (for pt range)
Assert: no unexpected N values in output
Assert: no missing N values in expected range
```

**L1.5 — pt half-pixel precision**
```
For each N in pt range:
  Assert: pt value is multiple of 0.5
  Assert: pt value = base_px/2 * N * scaling (± rounding)
```

**L1.6 — no raw numbers in L1 output except literals**
```
Regex-scan emitted L1 CSS: no variables, no refs (это primitive)
Each --px-N / --pt-N value is raw number+unit
```

**Total L1: 6 test files, ~20 assertions**

---

## 3. Layer 2 · Dimensions

### tests/L2-dimensions/

**L2.1 — all refs resolve**
```
For each family ∈ {spacing, radius, size, fx.blur, fx.shift, fx.spread}:
  For each entry:
    ref = entry.value  // e.g. 'px/4'
    Assert: ref resolves to L1 var (exists in L1 output)
    Assert: ref format matches /^(px|pt)\/-?\d+(\.\d+)?$/
```

**L2.2 — no raw numbers in dimension family definitions**
```
Regex-scan config.dimensions:
  forbidden: /: \d+/ where value should be ref string
  allowed: refs only, or 'full'=9999 (documented escape)
```

**L2.3 — airiness step shift**
```
For airiness ∈ {0.75, 1.0, 1.25}:
  For each spacing semantic:
    base_step = default_step
    shifted = base_step + log2(airiness) * base_step
    Assert: emitted step is round(shifted), clamped to valid range
    Assert: never negative for positive families
```

**L2.4 — airiness doesn't break refs**
```
After any airiness value:
  All semantic references still resolve to valid px/N
  No out-of-range step produced (no px/99)
```

**L2.5 — opacity stops exact list**
```
Given config.dimensions.opacity.stops
Assert: length === 29
Assert: equals [0, 1, 2, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48,
               52, 56, 60, 64, 68, 72, 76, 80, 84, 88, 92, 96, 98, 99]
Assert: sorted ascending
Assert: all unique
Assert: all in [0, 100]
```

**L2.6 — family token count**
```
For each family:
  Assert: emits expected count of tokens (documented per family)
  Assert: spacing padding positive ≥ 14 tokens
  Assert: spacing margin includes neg + positive
  Assert: radius has 'full'
```

**L2.7 — adaptives are separate from spacing**
```
Adaptives (breakpoint.*, layout_padding) don't appear in spacing family
Adaptives emit as --adaptive-* prefix
```

**L2.8 — nested radius documentation exists**
```
Assert: README mentions "nested radius rule: outer = inner + padding"
Assert: example code present
```

**Total L2: 8 test files, ~35 assertions**

---

## 4. Layer 3 · Primitive Colors

### tests/L3-primitives/

#### 4.1. Neutrals

**L3.1 — 13 steps generated**
```
Assert: neutrals array length === 13
Assert: indices 0..12 all present
```

**L3.2 — monotonic L across steps**
```
For each step in 0..11:
  Assert: L[step] > L[step+1]  // step 0 = lightest, step 12 = darkest в light
```

**L3.3 — pivot step is correct**
```
Assert: neutrals[pivot_step].L between L0 and L12
Assert: |L[pivot_step] - 0.5| < 0.1  // pivot near middle
```

**L3.4 — endpoints hit target**
```
Assert: neutrals[0].L === endpoints_normal.L0 (tolerance 0.005)
Assert: neutrals[12].L === endpoints_normal.L12 (tolerance 0.005)
```

**L3.5 — chroma curve shape**
```
Assert: chroma peak at config.chroma_curve.peak_step
Assert: chroma[0] and chroma[12] ≤ floor + 0.001
Assert: chroma monotonic decrease from peak to each endpoint
```

**L3.6 — hue drift within range**
```
Assert: hue[0] === config.hue_drift.start_H (tolerance 2°)
Assert: hue[12] === config.hue_drift.end_H (tolerance 2°)
For each step:
  Assert: hue[step] ∈ [start_H, end_H]  // monotonic
```

**L3.7 — mirror symmetry light vs dark**
```
For each step in 0..12:
  light_physical = neutrals_light[step]
  dark_physical = neutrals_dark[step]
  Assert: light_physical.L ≈ 1 - dark_physical.L + small_offset
  Assert: OR: dark is just physical_step[12-step] rendering
  (choose one consistent model; document in plan §4.1)
```

**L3.8 — IC amplification endpoints**
```
Given contrast_mode='ic' + endpoints_ic={L0:1.0, L12:0.0}:
  Assert: neutrals_ic[0].L = 1.0 (± 0.003)
  Assert: neutrals_ic[12].L = 0.0 (± 0.003)
  Assert: neutrals_ic[pivot].L ≈ neutrals_normal[pivot].L (IC пivot не двигается)
```

**L3.9 — achromatic dirt (course §03 rule 2)**
```
For each neutrals step:
  Assert: chroma > 0  // никогда pure grey (кроме если endpoint = white/black)
  Assert: OR: endpoint with floor=0 is allowed pure grey
```

**L3.10 — hue is cool-biased for 60/30/10 rule**
```
Assert: neutrals.hue ∈ [200, 320]  // cool range by default
Assert: warning if user sets hue ∈ [40, 80] (warm yellow range)
```

#### 4.2. Accents — Spines

**L3.11 — all 11 accents present**
```
Assert: config.colors.accents has keys:
  ['brand', 'red', 'orange', 'yellow', 'green', 'teal', 'mint',
   'blue', 'indigo', 'purple', 'pink']
Assert: length === 11
Assert: brand is alias to one of others (by default 'blue')
```

**L3.12 — spine format**
```
For each accent:
  Assert: spine is array of SpineControl
  Assert: spine.length ∈ [2, 4]
  Assert: spine sorted by L ascending
  Assert: all L in (0, 1)
  Assert: all H in [0, 360)
```

**L3.13 — spine monotonicity interp**
```
For each accent:
  interpolated = sample_spine(accent.spine, n=20)  // 20 points across L range
  H_values = interpolated.map(p => p.H)
  For each adjacent pair:
    Assert: monotonic OR oscillation within ±2° (Hermite smoothing)
  Assert: no backtracking beyond 5° (would create visual loop)
```

**L3.14 — spine covers operational L range**
```
For each accent:
  Assert: min(spine.L) ≤ 0.25  // covers dark side
  Assert: max(spine.L) ≥ 0.90  // covers light side
```

**L3.15 — chroma curve continuous**
```
For each accent, sampling L in [0.1, 0.95] step 0.05:
  c = apply_chroma_curve(C_raw, curve, L)
  Assert: c ≥ curve.floor
  Assert: c ≤ curve.peak (± 0.001)
  For adjacent samples:
    Assert: |c[i+1] - c[i]| < 0.02  // no jumps
```

**L3.16 — perceptual compensation cells**
```
Assert: perceptual_comp.light.chroma_mult === 1.0  // identity
Assert: perceptual_comp.light.lightness_shift === 0
Assert: perceptual_comp.dark.chroma_mult ∈ [0.85, 1.0]
Assert: perceptual_comp.dark.lightness_shift ∈ [-0.05, 0]
Assert: perceptual_comp.enable is boolean
```

**L3.17 — compensation is applied**
```
Test apply_perceptual_compensation with:
  input:  {L:0.6, C:0.22, H:257}, mode='dark'
  cells:  { chroma_mult: 0.93, lightness_shift: -0.02 }
Assert: output.L === 0.58 (± 0.001)
Assert: output.C === 0.2046 (± 0.001)
Assert: output.H === 257
```

**L3.18 — spine interp unit tests**
```
Test spine_interp with known inputs:
  yellow.spine = [(0.2,45),(0.5,65),(0.85,83),(0.95,100)]
  spine_interp(spine, 0.2)   === 45
  spine_interp(spine, 0.5)   === 65
  spine_interp(spine, 0.85)  === 83
  spine_interp(spine, 0.95)  === 100
  spine_interp(spine, 0.3)   ∈ (45, 65)  // between control points
  spine_interp(spine, 0.675) ∈ (65, 83)
  spine_interp(spine, 0.1)   === 45  // clamped below range
  spine_interp(spine, 1.0)   === 100 // clamped above range
```

#### 4.3. Opacity primitive

**L3.19 — opacity stops stable**
```
Already covered in L2.5, но ещё:
Assert: opacity.stops never changes without breaking-change PR label
```

**L3.20 — opacity emit as independent primitive**
```
Assert: CSS includes --opacity-N for each stop
Assert: values are decimal (e.g. 0.72)
Assert: no opacity composed into colors at this layer
```

**Total L3: 20+ test files, ~80 assertions**

---

## 5. Layer 4 · Semantic Colors

### tests/L4-semantics/

#### 5.1. Coverage

**L4.1 — every semantic has def**
```
Given expected semantics list (extracted from Figma + plan §5.2):
  For each expected semantic:
    Assert: exists in config.semantics
    Assert: has primitive ref
    Assert: has tier OR opacity_stop
    Assert: has canonical_bg (direct or inherited)
```

**L4.2 — every semantic resolves in every context**
```
For each semantic × mode × contrast × material_mode:
  resolved = resolve(semantic, context)
  Assert: resolved is valid OKLCH object
  Assert: L ∈ [0, 1]
  Assert: C ≥ 0
  Assert: H ∈ [0, 360)
  Assert: alpha ∈ [0, 1] if present
```

**L4.3 — no semantic resolves to same value accidentally**
```
For each pair of DISTINCT semantics (same tier excluded):
  Assert: resolved colors differ by at least ΔE 1
  // prevents accidental collapse (например labels.brand.primary === labels.brand.secondary)
```

#### 5.2. Contrast (the critical layer)

**L4.4 — APCA target met for every tier**
```
For each semantic ∈ labels.*:
  For each mode × contrast:
    bg = resolve(canonical_bg_of(semantic), context)
    fg = resolve(semantic, context)
    measured_Lc = apca(fg, bg)
    expected_Lc = tier_targets[semantic.tier][contrast].apca
    Assert: measured_Lc ≥ expected_Lc - tolerance (0.5 Lc)
    On fail: emit diagnostic (plan §P2)
```

**L4.5 — WCAG ratio met for every tier**
```
Аналогично L4.4 но для WCAG ratio.
Note: WCAG и APCA coincide для некоторых случаев, расходятся для других.
Тест проверяет ОБА, т.к. config декларирует оба taarget'а.
```

**L4.6 — border contrast met**
```
For each border.* tier:
  For each mode × contrast:
    Assert: apca(border, bg) ≥ border_tier_targets[tier][contrast].apca
```

**L4.7 — fills don't need label contrast, но не должны быть invisible**
```
For each fill.* tier:
  For each mode × contrast:
    Assert: apca(fill, bg) ≥ fill_tier_targets[tier][contrast].apca
    Assert: fill visible против bg (minimum Lc 2)
```

**L4.8 — inverted label meets contrast on inverted bg**
```
For each label.inverted ref:
  bg = label.inverted.bg_override  (e.g. Fills.Neutral.primary)
  Assert: apca(label, bg) ≥ tier_targets.primary.apca
```

#### 5.3. Gamut

**L4.9 — all resolved colors in gamut**
```
For each semantic × context:
  resolved = resolve(semantic, context)
  Given config.gamut:
    Assert: resolved ∈ p3 (or sRGB if gamut=srgb)
  Emit fallback sRGB for p3 colors
```

**L4.10 — fallback sRGB valid**
```
For each p3 color:
  sRGB_fallback = clamp_to_srgb(color)
  Assert: sRGB_fallback has L, C, H
  Assert: converts to valid hex #RRGGBB
  Assert: ΔE(p3, sRGB) < reasonable bound (5 ΔE OK для sRGB-only displays)
```

#### 5.4. Pipeline correctness

**L4.11 — apca_inverse returns correct L**
```
Test apca_inverse with known inputs:
  apca_inverse(60, bg_L=1.0)  ≈ 0.45-0.50
  apca_inverse(45, bg_L=1.0)  ≈ 0.55-0.62
  apca_inverse(60, bg_L=0.08) ≈ 0.65-0.72  // на тёмном bg нужен светлый fg
  apca_inverse(75, bg_L=1.0)  ≈ 0.30-0.38
Assert: forward apca(resolved, bg) === target_Lc (round-trip)
```

**L4.12 — gamut_clamp preserves hue**
```
For each accent × extreme L:
  raw = {L: 0.95, C: 0.5, H: 260}  // out of gamut
  clamped = gamut_clamp(raw, 'p3')
  Assert: clamped.H === raw.H (hue preserved)
  Assert: clamped.L === raw.L (L preserved)
  Assert: clamped.C < raw.C (only C reduced)
```

**L4.13 — composition resolved correctly**
```
For each semantic with opacity_stop:
  base_color = resolve_primitive(semantic.primitive, ctx)
  final = resolve(semantic, ctx)
  Assert: final.L === base_color.L
  Assert: final.C === base_color.C
  Assert: final.H === base_color.H
  Assert: final.alpha === opacity_stop_value(semantic.opacity_stop) / 100
```

#### 5.5. Progressive shadows

**L4.14 — shadow presets have layers**
```
Assert: shadow_presets.xs.length === 1
Assert: shadow_presets.s.length === 2
Assert: shadow_presets.m.length === 3
Assert: shadow_presets.l.length === 4 (или 3)
Assert: shadow_presets.xl.length === 4
```

**L4.15 — shadow layer ordering**
```
For each preset:
  For each pair of adjacent layers:
    Assert: layers[i].y ≤ layers[i+1].y  // или ≥, в зависимости от painting order
    Assert: layers[i].blur ≤ layers[i+1].blur
Document которое направление в плане §5.5, тест проверяет соответствие.
```

**L4.16 — shadow tints are Dark@N**
```
For each shadow.{minor,ambient,penumbra,major}:
  Assert: primitive === 'Dark'
  Assert: opacity_stop ∈ opacity.stops
```

**L4.17 — shadow CSS emitted correctly**
```
For each preset:
  css = emit_shadow(preset)
  Assert: css matches /^(0 \d+px \d+px \d+px 0 var\(--fx-shadow-\w+\)(, )?)+$/
  Assert: layer count in CSS === preset.layers.length
```

#### 5.6. Per-mode & per-contrast emit

**L4.18 — dark mode emit is complete**
```
Assert: CSS has [data-mode="dark"] block
Assert: all semantics overridden in dark (or explicitly mode-invariant)
```

**L4.19 — IC emit complete**
```
Assert: CSS has [data-contrast="ic"] block
Assert: all semantics overridden in IC (where tier targets differ)
```

**L4.20 — dark × IC combination**
```
Assert: CSS has [data-mode="dark"][data-contrast="ic"] block OR
        both modifiers combine correctly via cascade
Verify: label-brand-primary in dark-ic has stronger contrast than in dark-normal
```

#### 5.7. Hunt/HK compensation effect

**L4.21 — accents differ between light and dark modes (not identical)**
```
For each accent:
  light_primary = resolve(labels[accent].primary, { mode:'light', contrast:'normal' })
  dark_primary  = resolve(labels[accent].primary, { mode:'dark',  contrast:'normal' })
  Assert: ΔE(light_primary, dark_primary) > 2
  // if identical — compensation not applied, plan §4.3 violated
```

**L4.22 — compensation direction correct**
```
For each accent:
  dark_primary.C ≤ light_primary.C  // Hunt says darker should be less chromatic
  dark_primary.L ≤ light_primary.L + 0.3  // HK says darker should be physically darker
  // (tolerances чтобы не fail для accentов где spine dominates)
```

**Total L4: 22+ test files, ~150+ assertions (parameterized over semantics × modes × contrasts)**

---

## 6. Layer 5 · Typography

### tests/L5-typography/

**L5.1 — scale ratio produces monotonic**
```
sizes = generate_scale(ratio, base, range)
For each pair adjacent:
  Assert: sizes[i] < sizes[i+1]
```

**L5.2 — sizes are multiples of base_px/2**
```
For each font_size:
  Assert: size % (base_px / 2) === 0
  // (courses §02 rule 1: typography на 4px-grid)
```

**L5.3 — line-height within course range**
```
For each body size:
  Assert: lh[size] / size ∈ [1.3, 1.7]   // course §02 rule 4
For each headline size:
  Assert: lh[size] / size ∈ [0.85, 1.1]
```

**L5.4 — tracking curve**
```
For small sizes (< 14px):
  Assert: tracking[size] ≥ 0  // нельзя сжимать мелкий текст
For large sizes (> 32px):
  Assert: tracking[size] < 0  // компенсация растяжения
```

**L5.5 — font-family refs valid**
```
Assert: font_family and font_family_mono are non-empty strings
Assert: emit as CSS var
```

**L5.6 — semantic aliases cover use cases**
```
Assert: 'body_default', 'label_default', 'headline_*' aliases present
Assert: each alias maps to valid size key
```

**Total L5: 6 tests, ~20 assertions**

---

## 7. Layer 6 · Z-index

### tests/L6-z-index/

**L6.1 — monotonic**
```
Given z_index entries sorted by value:
Assert: no duplicates
Assert: strictly ascending
```

**L6.2 — expected entries exist**
```
For each required key ∈ [primary, secondary, modal, toast, tooltip, ...]:
  Assert: z_index has key
  Assert: value is integer
  Assert: value ∈ [0, 9999]
```

**L6.3 — reserved gaps**
```
Assert: tooltip > modal > dropdown > sticky > primary
Assert: at least 100 gap between semantic groups (space for user extensions)
```

**Total L6: 3 tests, ~10 assertions**

---

## 8. Layer 7 · Materials

### tests/L7-materials/

**L7.1 — 3 material modes emit**
```
For each material_mode ∈ {solid, glass, backdrop}:
  build(config with material_mode)
  Assert: materials.* all emit
  Assert: CSS block tagged with [data-material-mode="X"] or default
```

**L7.2 — label contrast preserved across material modes**
```
For each label on material:
  For each material_mode × mode × contrast:
    bg = resolve(material_bg, context)
    label = resolve(label_semantic, context)
    Assert: apca(label, bg) ≥ tier.apca
```

**L7.3 — glass material has opacity_stop**
```
For each materials.*.glass:
  Assert: has opacity_stop < 100
  Assert: has backdrop_filter or filter
```

**L7.4 — solid material is opaque**
```
For each materials.*.solid:
  Assert: no opacity_stop OR opacity_stop === 100
  Assert: no blur filter
```

**Total L7: 4 tests, ~15 assertions**

---

## 9. Cross-layer / Integration

### tests/cross-layer/

**CL1 — no raw numbers outside L1**
```
Regex-scan config file:
  In L2+ sections, no literal digits (except documented escapes)
  Exception: L3 spine control points (numbers are data, not dimensions)
  Exception: L3 tier_targets.apca values (APCA constants)
```

**CL2 — no hex colors outside spine control**
```
Regex-scan config + dist:
  In dist CSS: hex only in sRGB fallbacks (documented)
  In config: no hex literals (use OKLCH)
```

**CL3 — no undefined refs**
```
For each ref in config (semantic → primitive, dimension → L1):
  Assert: ref target exists
  Assert: ref format matches expected pattern
```

**CL4 — build deterministic**
```
Given same config:
  dist_a = build()
  dist_b = build()
  Assert: dist_a === dist_b (byte-identical)
```

**CL5 — config schema valid**
```
Use zod / io-ts schema:
  Assert: config parses without error
  Assert: required fields present
  Assert: enum values valid
```

**CL6 — cell changes scope to predicted slice**
```
Given baseline dist:
  Mutate cell: vibrancy 1.0 → 1.1
  dist_new = build()
  diff = compare(dist, dist_new)
  Assert: only accent-related vars changed
  Assert: neutrals unchanged
  Assert: dimensions unchanged
  Assert: typography unchanged
```

**CL7 — IC is orthogonal to mode**
```
output_normal_light = build({ mode:'light', contrast:'normal' })
output_normal_dark  = build({ mode:'dark',  contrast:'normal' })
output_ic_light     = build({ mode:'light', contrast:'ic' })
output_ic_dark      = build({ mode:'dark',  contrast:'ic' })
Assert: all 4 outputs distinct
Assert: ic differs from normal by lift amount (measurable)
Assert: dark differs from light by mirror + Hunt/HK
```

**CL8 — 60/30/10 rule verifiable**
```
(Course §03 rule 1: 60% bg, 30% surface, 10% accent)
Given list of semantics grouped by role:
  Assert: count(backgrounds) ≥ 3
  Assert: count(accents) ≥ 2 per sentiment
  Assert: ratios roughly match (can be relaxed to "all roles present")
```

**Total cross-layer: 8 tests, ~25 assertions**

---

## 10. Parity · Figma reference

### 10.0. Reference data — source and shape

Ground truth lives in `packages/tokens/tests/parity/fixtures/figma-anchors.json`
and is regenerated with `bun run fetch-figma` (requires `FIGMA_PAT` +
`FIGMA_FILE_KEY` env). The script walks the `🔵Colors / Color Guides`
frame in Figma, extracts every `Color wrap` sub-frame, and records:

- **neutrals** — `0..12` × 4-mode HEX tuple (13 × 4 = 52 anchors)
- **accents**  — `Brand / Red / Orange / Yellow / Green / Teal / Mint /
  Blue / Indigo / Purple / Pink` × 4 mode HEX tuple (11 × 4 = 44 anchors)
- **seals**    — `Dark / White` × 4 mode (2 × 4)
- **misc**     — `Control-bg / Label-contrast / Label-default` (3 × 4)

Each swatch in Figma is a pie of four sectors (ellipses named
`Ellipse 4/5/6/7`). The sector order maps to our CSS output scopes in
this fixed order:

| sector     | mode key       | CSS selector                                                    |
|------------|----------------|-----------------------------------------------------------------|
| Ellipse 4  | `light/normal` | `:root`                                                         |
| Ellipse 5  | `light/ic`     | `:root[data-contrast="ic"]:not([data-mode="dark"])`             |
| Ellipse 6  | `dark/ic`      | `:root[data-mode="dark"][data-contrast="ic"]`                   |
| Ellipse 7  | `dark/normal`  | `:root[data-mode="dark"]:not([data-contrast="ic"])`             |

Figma labels such as `Brand@2` are opacity-display variants (the `@N`
suffix is a mockup rendering opacity, not a semantic modifier); the
underlying HEX tuple is identical to the bare label (`Brand`). The
fetch script deduplicates by bare label.

### 10.1. Tests

**PTMODE — mode-sector order lock**
```
Assert: neutral-0 HEX from our CSS per scope matches figma.neutrals["0"]
        per sector within ΔE ≤ 10. Guards against Figma re-rotating the
        pie or us reshuffling data-mode / data-contrast scopes.
```

**PT1 — 11 accents × 4 modes (drift guard ΔE ≤ 40, plan target ΔE ≤ 3)**
```
For each (accent × mode):
  ours   = hexForVar(`--<accent>`, mode)
  theirs = figma.accents[<Accent>][modeIndex]
  Assert: ΔE2000(ours, theirs) ≤ 40
  Always log: per-accent max ΔE + full delta table
```

Today the accent spine is NOT calibrated against Figma — the drift
guard (ΔE ≤ 40) only catches catastrophic misalignments. The per-run
delta table is the source of truth for the follow-up calibration PR
that tightens this to the plan target (ΔE ≤ 3).

**PT2 — 13 neutrals × 4 modes (drift guard ΔE ≤ 20, plan target ΔE ≤ 2)**
```
For each (step × mode):
  Assert: ΔE2000 ≤ 20
  Always log: full delta table
```

Neutral spine is currently tuned for APCA label contrast, not Figma
parity — current max ΔE is ≈ 16 (neutral-8 `dark/ic`). Drift guard is
set slightly above that, plan target (ΔE ≤ 2) remains future work.

**PT3 — semantic outputs diff (deferred)**

Deferred until semantic primitives are emitted per-mode as HEX in a
form directly comparable to Figma. Today semantics are emitted as
`var(--<primitive>)` references whose HEX depends on the mode scope —
comparing them via a separate layer would duplicate PT1/PT2. Pick up
when the emit plane is extended.

**PT4 — tier tuning guidance on fail**

Implemented implicitly: PT1 + PT2 always log the full per-row delta
table and the per-accent max ΔE (sorted descending). Future calibration
PRs consume this output directly.

**Total parity: 3 tests live, 1 deferred, ~120 assertions driven by
reference data.**

---

## 11. Guards · Breaking change, snapshot, perf

### tests/guards/

**G1 — snapshot CSS stable**
```
Compare dist/tokens.css with snapshot (committed).
On diff:
  If PR not labeled 'breaking-change': FAIL
  If labeled: allow diff, update snapshot
```

**G2 — snapshot ESM stable**
```
Аналогично для dist/tokens.esm.js + dist/tokens.d.ts
```

**G3 — colors build < 80ms**
```
Measure build time for colors-only.
Assert: wallclock < 80ms на CI machine baseline
Log: emit timing in CI for trend tracking
```

**G4 — full build < 200ms**
```
Measure full build time.
Assert: wallclock < 200ms
```

**G5 — dist size budget**
```
Assert: gzipped CSS ≤ 30KB (adjust as system grows)
Assert: gzipped ESM ≤ 20KB
```

**G6 — no deprecated tokens in dist**
```
Given deprecations.json:
  For each deprecated token name:
    Assert: not in current dist
    (или: emit warning comment in CSS)
```

**G7 — accessibility regression**
```
Given previous release's APCA report:
  For each semantic:
    current_Lc = apca(current_dist[semantic], canonical_bg)
    previous_Lc = previous_report[semantic]
    If current_Lc < previous_Lc - 3:  // tolerance 3 Lc
      FAIL "Accessibility regressed"
      Exception: если изменение intentional и labeled breaking-change
```

**G8 — config schema backward compat**
```
For each removed or renamed cell:
  Assert: migration guide entry exists в CHANGELOG
  Assert: deprecation warning was in previous release
```

**Total guards: 8 tests, ~20 assertions + perf tracking**

---

## 12. Runtime · Browser/SSR integration (optional, gated)

### tests/runtime/ (optional, требует Playwright)

**R1 — CSS vars load in browser**
```
Launch headless Chromium with dist CSS applied:
  Assert: getComputedStyle(body).getPropertyValue('--label-neutral-primary')
          returns valid oklch() value
  Assert: all ~500 vars accessible
```

**R2 — Mode switching works**
```
Set body.dataset.mode = 'dark':
  Re-read vars
  Assert: values changed for mode-dependent vars
  Assert: unchanged for mode-invariant vars
```

**R3 — IC switching works**
```
Set body.dataset.contrast = 'ic':
  Assert: labels have stronger contrast
  Measure actual rendered apca from Canvas pixel reading
```

**R4 — Tailwind v4 integration**
```
Compile simple HTML with Tailwind v4 using generated @theme:
  Assert: class bg-neutral-primary resolves
  Assert: class text-brand-primary resolves
  Assert: no undefined classes
```

**R5 — SSR output is clean**
```
Render React component using tokens in Node:
  Assert: no hydration warnings
  Assert: CSS matches client-side
```

**Total runtime: 5 tests, ~15 assertions (optional tier)**

---

## 13. CI configuration

### 13.1. Pipeline stages

```yaml
name: tokens-ci

on: [push, pull_request]

jobs:
  fast:           # T1-T3, must pass first
    runs-on: ubuntu-latest
    steps:
      - checkout
      - bun install
      - bun test tests/L1-units tests/L2-dimensions tests/L3-primitives/unit-*.test.ts
      - bun test tests/cross-layer
    timeout: 2min

  medium:         # T4-T6, after fast
    needs: fast
    steps:
      - bun test tests/L3-primitives tests/L4-semantics tests/L5-typography tests/L6-z-index tests/L7-materials
    timeout: 5min

  parity:         # T7, optional gate via label
    needs: medium
    if: contains(github.event.pull_request.labels.*.name, 'parity-required') ||
        github.ref == 'refs/heads/main'
    steps:
      - bun test tests/parity
    timeout: 10min

  guards:         # T8, always on main/release
    needs: medium
    steps:
      - bun test tests/guards
      - bun run perf-budget
      - bun run size-budget
    timeout: 5min

  runtime:        # T9, gated, weekly
    if: github.event_name == 'schedule' ||
        contains(github.event.pull_request.labels.*.name, 'runtime-tests')
    steps:
      - playwright install
      - bun test tests/runtime
    timeout: 15min
```

### 13.2. Failure reporting (PR comments)

```typescript
// scripts/post-ci-comment.ts
import { summarize } from './ci-summary'

const summary = summarize(test_results)

postComment(`
## Tokens CI · ${pr_number}

### Fast (T1-T3): ${summary.fast.pass}/${summary.fast.total} ${emoji_for(summary.fast)}
### Medium (T4-T6): ${summary.medium.pass}/${summary.medium.total} ${emoji_for(summary.medium)}
### Parity (T7): ${summary.parity.pass}/${summary.parity.total} ${emoji_for(summary.parity)}

${summary.failures.length > 0 ? `
### Failures
${summary.failures.map(f => `
- **${f.name}**
  - ${f.message}
  - Reference: ${f.plan_section}
  - Fix: ${f.suggestion}
`).join('\n')}
` : ''}

### Performance
- Build: ${summary.perf.build_ms}ms (budget: 200ms)
- Size: ${summary.perf.css_kb}KB gzipped (budget: 30KB)

${summary.snapshot_diff ? `
### Snapshot diff detected
\`\`\`
${summary.snapshot_diff}
\`\`\`
Add 'breaking-change' label to override.
` : ''}
`)
```

### 13.3. Required checks for PR merge

```yaml
# branch protection on main:
required_status_checks:
  - fast
  - medium
  - guards
optional:
  - parity      # gated by label
  - runtime     # weekly
```

### 13.4. Local developer workflow

```bash
# Pre-commit hook (husky / pre-commit):
bun test tests/L1-units tests/L2-dimensions tests/cross-layer
# fast subset, < 1s

# Watch mode during development:
bun test --watch tests/L4-semantics/

# Full suite before pushing:
bun run test:full

# Update snapshots (requires explicit flag + review):
bun test -u
```

---

## 14. Self-documenting mechanisms

### 14.1. Test file header convention

**Every** test file MUST include:

```typescript
/**
 * @layer L{1-7} · {Layer name}
 * @governs implementation-plan-v2.md §{section}
 * @invariant {plain-text invariant being checked}
 * @why {rationale: what breaks user/system if this fails}
 * @on-fail {specific debugging checklist}
 */
```

Regex-lint checks every test file has this header (tests/guards/G9).

### 14.2. Diagnostic fail messages

Every assertion with potential for confusing failure MUST include:
```typescript
expect(condition).toBe(expected, `
  ${what}:          ${actual}
  Expected:         ${expected} (${plan_ref})
  Diagnosis:        ${likely_cause}
  Fix suggestions:  ${fixes.join(' OR ')}
`)
```

Helper:
```typescript
function assert_contrast(fg, bg, target, ctx) {
  const Lc = apca(fg, bg)
  if (Lc < target - 0.5) {
    throw new ContrastFailure({
      semantic: ctx.name,
      bg_ref: ctx.bg_ref,
      mode: ctx.mode,
      contrast: ctx.contrast,
      expected_Lc: target,
      actual_Lc: Lc,
      plan_refs: ['§5.1 tier_targets', '§4.2 accent spines'],
      suggestions: [
        `adjust accents.${ctx.accent}.spine to include control point near L ≈ ${apca_inverse(target, bg.L)}`,
        `check tier_targets.${ctx.tier}.${ctx.contrast}.apca if business req changed`,
      ],
    })
  }
}
```

### 14.3. Test catalog (auto-generated)

Script `scripts/generate-test-catalog.ts` scans all test files, extracts @layer / @governs / @invariant, builds `docs/test-catalog.md`:

```
# Test catalog (auto-generated)

## L1 · Units
- L1.1 — base_px constraint (tests/L1-units/base-px.test.ts)
  Governs: plan §2.1
  Invariant: base_px is positive even integer

- L1.2 — scaling integrality (tests/L1-units/scaling.test.ts)
  ...
```

Committed. Updated on every PR via CI check. Future agents can read catalog to understand what's protected.

### 14.4. Plan ↔ test cross-reference

Script `scripts/verify-plan-coverage.ts`:
- Parse implementation-plan-v2.md
- Extract every section with invariant-like assertions (e.g. «Assert», «must», «≤», «≥», «monotonic»)
- For each, find test file with matching @governs
- Emit list of plan claims without tests → FAIL if any

Ensures every architectural decision has at least one guard test.

### 14.5. Inverse: test → plan link

```typescript
// tests/L4-semantics/contrast-primary.test.ts
/**
 * @governs implementation-plan-v2.md §5.1 · Tier targets
 */
```

Reverse script: for every @governs ref, verify plan section exists → prevents orphan tests after plan edits.

### 14.6. README in tests/

```markdown
# tests/

## How to run
- `bun test` — full suite
- `bun test tests/L{N}-{layer}` — by layer
- `bun test --watch` — dev mode

## How to add a test
1. Determine which layer your test belongs to (L1-L7, cross-layer, parity, guards, runtime)
2. Check test-catalog.md for similar existing tests
3. Create file `tests/L{N}-{layer}/{feature}.test.ts`
4. Add required header (@layer, @governs, @invariant, @why, @on-fail)
5. Use diagnostic helpers from `tests/_helpers/diagnostics.ts`

## How to debug a failure
1. Read fail message — it includes plan reference and fix suggestions
2. Open referenced plan section in implementation-plan-v2.md
3. Check if invariant is being violated by recent code change
4. If invariant is outdated (plan changed), update plan FIRST, then test
5. NEVER skip test to make CI pass — escalate to user

## What NOT to do
- Don't use `.skip`, `.only`, `.xit` — blocked by regex-lint
- Don't commit snapshot changes without `breaking-change` label
- Don't test implementation details — test observable behaviors
- Don't duplicate assertions across layers — use cross-layer for integration
```

---

## 15. Regression protection

### 15.1. Golden datasets

Committed fixtures:
- `tests/_fixtures/figma-anchors.json` — 44 accent + 13 neutral HEX
- `tests/_fixtures/semantic-outputs.snapshot.json` — all ~500 semantics OKLCH values
- `tests/_fixtures/contrast-report.baseline.json` — APCA Lc for every tier

Any change to these fixtures requires:
- PR label `breaking-change` OR `parity-update`
- Manual review
- CHANGELOG entry

### 15.2. Historical trend tracking

Script `scripts/track-perf-history.ts` — writes build time + dist size to `docs/perf-history.ndjson` on every merge to main. Plot:
```
bun run perf-history --plot
```
Shows drift over time. Alarm if >20% regression over 30 days.

### 15.3. Deprecation lifecycle

Config supports:
```typescript
deprecated: {
  'label.accent.primary': {
    replacement: 'label.brand.primary',
    removed_in: '0.3.0',
    reason: 'Renamed for sentiment consistency',
  },
}
```

CI enforces:
- Deprecated tokens still emit (with CSS comment warning)
- After `removed_in` version, actually removed
- Consumer projects see deprecation warnings in build output

---

## 16. Test implementation checklist

К PR #4 (colors v2) готовим:

- [ ] `tests/_helpers/diagnostics.ts` — helper functions для rich fail messages
- [ ] `tests/_helpers/oklch-assertions.ts` — `expect(color).toMatchOKLCH()`, `expect(color).toPassAPCA()`
- [ ] `tests/_fixtures/figma-anchors.json` — extracted reference data
- [ ] `tests/L3-primitives/` — все 20+ тестов спин/нейтралов/compensation
- [ ] `tests/L4-semantics/` — все 22+ тесты resolution/contrast/gamut
- [ ] `tests/cross-layer/` — 8 integration tests
- [ ] `tests/parity/` — 4 parity tests с Figma
- [ ] `tests/guards/G1-G7` — snapshot + perf

К PR #5-8 добавляем тесты для оставшихся layers.

К PR #9 (CI hardening) — 
- [ ] `scripts/generate-test-catalog.ts`
- [ ] `scripts/verify-plan-coverage.ts`
- [ ] `scripts/post-ci-comment.ts`
- [ ] Branch protection rules updated
- [ ] `docs/test-catalog.md` auto-generated, committed
- [ ] README in `tests/`

---

## 17. Summary

**Что это дает:**

1. **100% coverage** архитектурных invariants плана v2 — каждое утверждение защищено тестом со ссылкой на план
2. **Self-documenting** — любой будущий агент (или человек) может за 1-2 файла понять что именно защищает тест и почему
3. **Actionable failures** — fail message включает plan ref, diagnosis, fix suggestions
4. **Regression-proof** — golden datasets, snapshots, perf budget, a11y regression check
5. **Fast feedback** — T1-T3 < 1s, полный suite < 10s
6. **Graduated CI** — fast tests блочат быстро, slow tests гейтятся labels
7. **Plan ↔ test bidirectional verification** — script'ы ловят orphan tests и unguarded claims

**Количество:**

- ~110+ test files
- ~400+ individual assertions (с параметризацией — эффективно 2000+ проверок)
- ~1s full unit suite
- ~10s full suite with parity

**Что НЕ в этом плане:**

- Component/integration тесты для Svelte/React/Vue пакетов — это tier-2 territory
- Visual regression (screenshot diff) — опционально later, требует baseline screenshots
- Fuzzing / property-based тесты — можно добавить для APCA/OKLCH math, но не критично на старте

**Next step:** Approve test strategy → интегрирую test skeleton в PR #4 вместе с colors v2.
