# Правила отступов для ИИ-агентов

Универсальный чеклист для Claude, Cursor, ChatGPT и др. Платформа: web и смежные поставки DS (CSS / SCSS / CSS-in-JS / TS objects / XML и т.п.). Фокус: **токены spacing**, роли **gap vs padding**, слои **layout vs component**, сверка Figma ↔ код, codegen без литералов.

Cursor-правило-зеркало: `.cursor/rules/spacing-agent.mdc`. Держи оба согласованными при правках.

**Как читать:** `P0` — блокер handoff / релиза, `P1` — обязательно исправить в спринте. ID (`S-D-`, `S-S-`, `S-U-`, `S-C-`) стабильны: ссылайтесь на них в задачах и PR.

---

## Когда применять

- Аудит макета / компонента в Figma через **MCP Figma Server** (padding, gap / itemSpacing, margin)
- Сверка spacing variables / scale дизайна с токенами в репозитории
- Генерация или правка UI из дизайна (любой стек стилей)
- Проверка, что токен применён в правильной **роли** и на правильном **слое**

## Жёсткие правила

1. **Только токены:** `padding`, `gap` / `itemSpacing`, `margin` (и связанные: `paddingTop/Right/Bottom/Left`, stack spacing — если в контракте DS) берутся из spacing-токенов. Сырые значения (`8`, `8px`, `16`, `1rem` вне token layer) в продуктовом коде и в «готовом» дизайне — дефект.
2. **Не молчи о хардкоде:** найденный литерал → строка в таблице отклонений с ID, узлом/файлом и предложенным токеном. Не «исправляй тихо», подставляя угаданный px.
3. **Нет токена → gap, не silent literal:** предложи имя (по конвенции репозитория), статус `MISSING_TOKEN`, не вшивай computed px из MCP.
4. **Расхождение дизайн ↔ код — дефект контракта**, не вкусовщина: фиксируй до правок (`VALUE_MISMATCH`, `MISSING_IN_CODE`, `MISSING_IN_DESIGN`, `NAME_MISMATCH`, `HANDOFF_MISMATCH`).
5. **Semantic → только alias на primitive:** каждый semantic-токен обязан ссылаться на primitive (или цепочку alias, оканчивающуюся primitive). Прямое значение (`8`, `8px`, `16`) в semantic — дефект (`SEMANTIC_HARDCODE` / `MISSING_ALIAS`). Хардкод допустим **только** в primitive-слое. Layout/component tokens, если они semantic по роли, подчиняются тому же правилу (alias, не raw).
6. **Роль свойства жёсткая:**
   - **gap** (`itemSpacing`, `row-gap`, `column-gap`, stack spacing) — только расстояние **между** соседними детьми;
   - **padding** — только внутренний отступ от краёв контейнера до контента;
   - **margin** — внешний отступ узла (если в scope задачи); не подменять им gap внутри flex/grid/auto-layout без обоснования.
7. **Слой токена жёсткий:**
   - **layout tokens** — построение экранов / секций / сеток интерфейса (page, section, stack, grid gutters);
   - **component tokens** — композиция **внутри** компонента (внутренние отступы Button, gaps в ListItem и т.п.);
   - layout-токен внутри «кишок» компонента или component-токен на уровне page layout — дефект слоя (`LAYER_MISUSE`).
8. **Стек не важен:** CSS custom properties, SCSS maps, CSS Modules, CSS-in-JS, Tailwind theme keys, TS/JS theme objects, Android/iOS dimens — везде ссылка на токен/alias, не на сырое число.
9. **Не выдумывай шкалу:** если в репозитории нет spacing tokens — останови codegen, перечисли open questions, предложи минимальный контракт (имена + слои layout/component), не изобретай параллельную шкалу «на глаз».

---

## Фаза 1. Проверка дизайна (MCP Figma Server)

Инструменты: `get_design_context`, `get_variable_defs`, `get_metadata`, `get_screenshot` — по необходимости; сначала variables / auto-layout bindings, потом computed styles узлов.

### Что считать «токеном» в Figma

| Источник | OK | Не OK |
|---|---|---|
| Variable bound к `padding*`, `itemSpacing`, `margin*` (если есть) | да | — |
| Semantic variable = alias на primitive | да | Semantic с raw value (`SEMANTIC_HARDCODE`) |
| Auto-layout: padding / gap через variables из DS library | да | Числа без binding |
| Локальный override: `padding: 13` на инстансе | — | хардкод (`HARDCODED_OVERRIDE`) |
| MCP вернул только computed px без variable id | — | трактовать как несвязанное значение, пока не доказано иное |

### Чеклист

- [ ] **S-D-01 P0** Для проверяемых узлов зафиксированы: node id, auto-layout (если есть), variable bindings по `padding*` / `itemSpacing` / `margin*`.
- [ ] **S-D-02 P0** Каждое spacing-поле либо bound к variable, либо занесено в отклонения.
- [ ] **S-D-03 P0** Хардкод и локальные overrides перечислены явно (узел, свойство, значение, ожидаемый токен или `UNKNOWN`).
- [ ] **S-D-04 P1** Имена variables сверены с конвенцией DS (primitive → semantic → layout/component); сырые primitive на UI-слое без semantic alias — отметить.
- [ ] **S-D-05 P0** Каждый semantic spacing variable в scope — alias на primitive (или цепочка до primitive); raw value в semantic → `SEMANTIC_HARDCODE` / `MISSING_ALIAS`.
- [ ] **S-D-06 P1** В дизайне визуально различимы: gap между детьми vs padding контейнера; подмена одного другим — в отклонения с `ROLE_MISUSE`.
- [ ] **S-D-07 P1** Если MCP отдал только computed styles — не выдавать их за «токены»; дочитать `get_variable_defs` и bindings.

### Формат отклонений (дизайн)

| ID | Node | Property | Found | Expected token | Kind |
|---|---|---|---|---|---|
| S-D-… | `12:34` | paddingLeft | `13` | `space.padding.md` или `UNKNOWN` | `HARDCODED` / `UNBOUND` / `OVERRIDE` / `ROLE_MISUSE` / `SEMANTIC_HARDCODE` / `MISSING_ALIAS` |

---

## Фаза 2. Сверка с кодовой базой

Цель: понять, какие spacing values / tokens есть в дизайне и в коде; все расхождения — до реализации.

### Источники в коде (искать по репозиторию)

- Token packages / theme: `space`, `spacing`, `gap`, `padding`, `margin`, `layout`, `component`
- CSS: `--space-*`, `--spacing-*`, `--gap-*`, `--padding-*`
- CSS-in-JS / TS: `theme.space`, `theme.spacing`, `gaps`, `paddings`
- Платформенные: `dimens`, inset / padding resources

### Чеклист

- [ ] **S-S-01 P0** Построен список spacing tokens из кода (имя → значение или alias-цепочка; слой: primitive / semantic / layout / component).
- [ ] **S-S-02 P0** Каждый spacing variable из дизайна сопоставлен с кодом: совпадение имени **и** значения (px/rem).
- [ ] **S-S-03 P0** Расхождения классифицированы: `MISSING_IN_CODE` · `MISSING_IN_DESIGN` · `VALUE_MISMATCH` · `NAME_MISMATCH` · `LITERAL_IN_COMPONENT` · `HANDOFF_MISMATCH` · `SEMANTIC_HARDCODE` · `MISSING_ALIAS`.
- [ ] **S-S-04 P0** Литералы spacing в компонентах продукта (вне token layer) найдены поиском и перечислены.
- [ ] **S-S-05 P0** Все semantic spacing tokens в коде — alias на primitive (нет inline raw); обрыв цепочки или raw в semantic → `MISSING_ALIAS` / `SEMANTIC_HARDCODE`. То же для layout/component, если они semantic по роли.
- [ ] **S-S-06 P1** В UI ожидаются semantic / layout / component tokens по правилам DS, не «голые» primitive без причины.
- [ ] **S-S-07 P1** Перед правками показана таблица сверки; правки без сверки запрещены.

### Формат сверки

| Design token | Code token | Alias → primitive | Design value | Code value | Layer | Status |
|---|---|---|---|---|---|---|
| `space/gap/md` | `spacing.gap.md` | `space.16` | 16 | 16 | layout | `OK` |
| `space/padding/sm` | `spacing.padding.sm` | _(raw `8`)_ | 8 | 8 | component | `SEMANTIC_HARDCODE` |
| `space/section/y` | — | — | 32 | — | layout | `MISSING_IN_CODE` |

---

## Фаза 3. Роли и слои использования

Валидация **до и после** codegen: правильное свойство и правильный слой токена.

### Gap vs padding vs margin

| Роль | Назначение | Типичные CSS / Figma | Запрещено |
|---|---|---|---|
| **gap** | Расстояние между соседними элементами в одном контейнере | `gap`, `row-gap`, `column-gap`; Figma `itemSpacing` | Имитировать gap через `margin` на каждом ребёнке без причины; использовать padding «между» детьми |
| **padding** | Внутренние отступы от краёв контейнера | `padding` / стороны; Figma padding auto-layout | Задавать «внешний» воздух экрана только padding’ом ребёнка вместо padding/отступа родителя-секции по контракту DS |
| **margin** | Внешний отступ самого узла | `margin` / стороны | Подменять gap внутри flex/grid/auto-layout; смешивать с padding без явной модели |

### Layout vs component tokens

| Слой | Где применять | Где нельзя |
|---|---|---|
| **layout** | Page / section / grid / stack экрана; расстояние между блоками интерфейса | Внутри определения компонента DS, если для этого есть component tokens |
| **component** | Внутри определения компонента (например padding кнопки, gaps в поле ввода, внутренний stack карточки) | Построение page layout, сеток экрана, «глобальных» секций |

Если в репозитории нет явного разделения имён — зафиксируй open question и предложи конвенцию (`space.layout.*` / `space.component.*` или принятый в DS аналог); не смешивай слои молча.

### Чеклист

- [ ] **S-U-01 P0** Между элементами одного контейнера в коде используется **gap** (или эквивалент), не padding/margin-имитация — иначе `ROLE_MISUSE` + где (`IN_DESIGN` / `IN_CODE` / `IN_HANDOFF`).
- [ ] **S-U-02 P0** Внутренние отступы контейнера — только **padding**-токены; gap не используется как «отступ от края».
- [ ] **S-U-03 P0** Component-токены не вынесены на page/section layout; layout-токены не зашиты внутрь компонента вместо component scale — иначе `LAYER_MISUSE`.
- [ ] **S-U-04 P1** Одинаковая визуальная величина с разной ролью (gap 16 vs padding 16) не схлопывается в один «универсальный» space без учёта роли, если DS разделяет имена по роли.
- [ ] **S-U-05 P1** Handoff (дизайн → код) сохраняет роль: Figma `itemSpacing` → `gap`; Figma padding → `padding`; подмена при переносе — `HANDOFF_MISMATCH`.

### Формат нарушений роли / слоя

| ID | Where | Found | Expected | Kind |
|---|---|---|---|---|
| S-U-… | `Card.tsx` / node `12:34` | `margin-right: var(--space-md)` на детях | `gap: var(--space-gap-md)` | `ROLE_MISUSE` / `IN_CODE` |
| S-U-… | `PageHeader` layout | `var(--button-padding-x)` | `var(--space-layout-section-x)` | `LAYER_MISUSE` |

---

## Фаза 4. Реализация / codegen из дизайна

Генерация и правки кода — **только** через spacing tokens целевого стека, с соблюдением ролей и слоёв.

### Чеклист

- [ ] **S-C-01 P0** В сгенерированном коде нет сырых `padding` / `gap` / `margin` literals (кроме слоя определения самих токенов).
- [ ] **S-C-02 P0** Значения из MCP (`padding: 16`, `itemSpacing: 8` и т.п.) не копируются в компонент; используется имя токена из фазы 2.
- [ ] **S-C-03 P0** Технология вывода соблюдает контракт репозитория:

  | Стек | Ожидаемая ссылка (пример) |
  |---|---|
  | CSS / CSS Modules | `var(--space-gap-md)`, `var(--space-padding-sm)` |
  | SCSS | `map-get` / mixin / CSS var из tokens |
  | CSS-in-JS | `theme.space.gap.md` / `theme.spacing.padding.sm` |
  | TS / JS object | ключ theme, не `{ padding: 16 }` в JSX |
  | Tailwind | theme key / `@apply` из DS, не `p-[13px]` / `gap-[7px]` |
  | XML / native | `@dimen` / inset resource / spacing token ref |

- [ ] **S-C-04 P0** Codegen выбирает свойство по роли: между детьми → gap-токен; от края → padding-токен; слой — layout или component по контексту узла.
- [ ] **S-C-05 P0** Если токена нет — codegen останавливается на этом свойстве: `MISSING_TOKEN` + предлагаемое имя и слой; TODO с ID допустим, **не** магическое число.
- [ ] **S-C-06 P1** Не дублировать spacing-шкалу локально в компоненте («свой» `spacings` рядом с DS).
- [ ] **S-C-07 P1** Не подменять роль при удобстве стека (например Tailwind `space-x-*` вместо `gap`, если это ломает модель DS) без явной пометки в допущениях.

---

## Самопроверка перед ответом

- [ ] Figma: bindings проверены; хардкод в таблице `S-D-*`
- [ ] Semantic → alias на primitive (дизайн и код); нет `SEMANTIC_HARDCODE`
- [ ] Код: сверка сделана; статусы `S-S-*` явны
- [ ] Роли gap/padding/margin и слои layout/component проверены (`S-U-*`)
- [ ] Codegen / правки: только токены; нет computed px из MCP (`S-C-*`)
- [ ] Пробелы токенов = gap + имя + слой, не silent literal
- [ ] Допущения и вопросы перечислены

## Формат ответа

```
Объект (фрейм / компонент / файлы):
Проверено (ID): S-D-xx, S-S-xx, S-U-xx, S-C-xx, ...
Отклонения дизайна (хардкод / unbound / semantic без alias):
Сверка дизайн ↔ код (вкл. alias → primitive):
Нарушения ролей (gap/padding/margin):
Нарушения слоёв (layout/component):
Пробелы токенов (предложенные имена + слой):
Изменения в коде (только через токены):
Допущения:
Вопросы:
```

Краткий минимум при мелкой правке:

```
Проверено: …
Отклонения: …
Роли / слои: …
Токены в коде: …
```
