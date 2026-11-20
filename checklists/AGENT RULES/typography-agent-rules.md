# Правила типографики для ИИ-агентов

Универсальный чеклист для Claude, Cursor, ChatGPT и др. Платформа: web и смежные поставки DS (CSS / SCSS / CSS-in-JS / TS objects / XML и т.п.). Фокус: **токены типографики**, сверка Figma ↔ код, codegen без литералов.

Cursor-правило-зеркало: `.cursor/rules/typography-agent.mdc`. Держи оба согласованными при правках.

**Как читать:** `P0` — блокер handoff / релиза, `P1` — обязательно исправить в спринте. ID (`T-D-`, `T-S-`, `T-C-`) стабильны: ссылайтесь на них в задачах и PR.

---

## Когда применять

- Аудит макета / компонента в Figma через **MCP Figma Server**
- Сверка text styles / variables дизайна с токенами в репозитории
- Генерация или правка UI из дизайна (любой стек стилей)

## Жёсткие правила

1. **Только токены:** `fontFamily`, `fontSize`, `fontWeight`, `lineHeight`, `letterSpacing` (и связанные: `paragraphSpacing`, `textCase`, `textDecoration` — если есть в контракте DS) берутся из typography-токенов или text styles, связанных с ними. Сырые значения (`16`, `16px`, `400`, `#000`, `'Inter'`) в продуктовом коде и в «готовом» дизайне — дефект.
2. **Не молчи о хардкоде:** найденный литерал → строка в таблице отклонений с ID, узлом/файлом и предложенным токеном. Не «исправляй тихо», подставляя угаданный px.
3. **Нет токена → gap, не silent literal:** предложи имя (по конвенции репозитория), статус `MISSING_TOKEN`, не вшивай computed px из MCP.
4. **Расхождение дизайн ↔ код — дефект контракта**, не вкусовщина: фиксируй до правок (`VALUE_MISMATCH`, `MISSING_IN_CODE`, `MISSING_IN_DESIGN`, `NAME_MISMATCH`).
5. **Semantic → только alias на primitive:** каждый semantic-токен обязан ссылаться на primitive (или цепочку alias, оканчивающуюся primitive). Прямое значение (`16`, `16px`, `400`, `'Inter'`) в semantic — дефект (`SEMANTIC_HARDCODE` / `MISSING_ALIAS`). Хардкод допустим **только** в primitive-слое.
6. **Стек не важен:** CSS custom properties, SCSS maps, CSS Modules, styled-components / emotion, Tailwind theme keys, TS/JS theme objects, Android XML / Compose TextStyle, iOS Dynamic Type — везде ссылка на токен/alias, не на сырое число.
7. **Не выдумывай шкалу:** если в репозитории нет typography tokens — останови codegen, перечисли open questions, предложи минимальный контракт (имена + слои), не изобретай параллельную шкалу «на глаз».

---

## Фаза 1. Проверка дизайна (MCP Figma Server)

Инструменты: `get_design_context`, `get_variable_defs`, `get_metadata`, `get_screenshot` — по необходимости; сначала variables / text styles, потом computed styles узлов.

### Что считать «токеном» в Figma

| Источник | OK | Не OK |
|---|---|---|
| Variable bound к `fontSize` / `fontWeight` / `lineHeight` / `letterSpacing` / family | да | — |
| Semantic variable = alias на primitive | да | Semantic с raw value (`SEMANTIC_HARDCODE`) |
| Text style, у которого поля завязаны на variables (или на единый DS text style из библиотеки) | да | Text style с захардкоженными числами без variables — пометить как риск |
| Локальный override: `fontSize: 15` на инстансе | — | хардкод (`HARDCODED_OVERRIDE`) |
| MCP вернул только computed px без variable id / style id | — | трактовать как несвязанное значение, пока не доказано иное |

### Чеклист

- [ ] **T-D-01 P0** Для проверяемых текстовых узлов зафиксированы: node id, text style (если есть), variable bindings по полям типографики.
- [ ] **T-D-02 P0** Каждое поле (`fontFamily`, `fontSize`, `fontWeight`, `lineHeight`, `letterSpacing`) либо bound к variable / DS text style, либо занесено в отклонения.
- [ ] **T-D-03 P0** Хардкод и локальные overrides перечислены явно (узел, свойство, значение, ожидаемый токен или `UNKNOWN`).
- [ ] **T-D-04 P1** Имена variables / styles сверены с конвенцией DS (primitive → semantic → component); сырые primitive в UI-слое без semantic alias — отметить.
- [ ] **T-D-05 P0** Каждый semantic typography variable в scope — alias на primitive (или цепочка до primitive); raw value в semantic → `SEMANTIC_HARDCODE` / `MISSING_ALIAS`.
- [ ] **T-D-06 P1** Один визуальный роль-уровень (например heading/body/caption) не размазан по разным несвязанным значениям на одном экране без обоснования.
- [ ] **T-D-07 P1** Если MCP отдал только computed styles — не выдавать их за «токены»; запросить / дочитать `get_variable_defs` и bindings.

### Формат отклонений (дизайн)

| ID | Node / Style | Property | Found | Expected token | Kind |
|---|---|---|---|---|---|
| T-D-… | `12:34` / `Body/M` | fontSize | `15` | `font.size.md` или `UNKNOWN` | `HARDCODED` / `UNBOUND` / `OVERRIDE` / `SEMANTIC_HARDCODE` / `MISSING_ALIAS` |

---

## Фаза 2. Сверка с кодовой базой

Цель: понять, какие стили есть в дизайне и какие токены/стили есть в коде; все расхождения — до реализации.

### Источники в коде (искать по репозиторию)

- Token packages / theme: `tokens`, `typography`, `fontSize`, `lineHeight`, `fontWeight`, `letterSpacing`
- CSS: `--font-*`, `--text-*`, `@mixin` / maps
- CSS-in-JS / TS: `theme.typography`, `textStyles`, `fonts`
- Платформенные: `TextAppearance`, `TextStyle`, XML `dimens` / style refs

### Чеклист

- [ ] **T-S-01 P0** Построен список typography tokens / text styles из кода (имя → значение или alias-цепочка).
- [ ] **T-S-02 P0** Каждый style / variable из дизайна сопоставлен с кодом: совпадение имени **и** значения (с учётом единиц: px/rem/%/unitless line-height).
- [ ] **T-S-03 P0** Расхождения классифицированы: `MISSING_IN_CODE` · `MISSING_IN_DESIGN` · `VALUE_MISMATCH` · `NAME_MISMATCH` · `LITERAL_IN_COMPONENT` · `SEMANTIC_HARDCODE` · `MISSING_ALIAS`.
- [ ] **T-S-04 P0** Литералы типографики в компонентах продукта (вне token layer) найдены поиском и перечислены; не списывать на «временный UI».
- [ ] **T-S-05 P0** Все semantic typography tokens в коде — alias на primitive (нет inline raw); обрыв цепочки или raw в semantic → `MISSING_ALIAS` / `SEMANTIC_HARDCODE`.
- [ ] **T-S-06 P1** В UI ожидаются semantic / component tokens, не «голые» primitive, если так принято в DS.
- [ ] **T-S-07 P1** Перед правками показана таблица сверки; правки без сверки запрещены.

### Формат сверки

| Design token / style | Code token | Alias → primitive | Design value | Code value | Status |
|---|---|---|---|---|---|
| `text/body/md` | `typography.body.md` | `font.size.16` / `font.line.24` | 16/24 | 16/24 | `OK` |
| `text/body/md` | `typography.body.md` | _(raw `16`)_ | 16/24 | 16 | `SEMANTIC_HARDCODE` |
| `text/caption` | — | — | 12/16 | — | `MISSING_IN_CODE` |

---

## Фаза 3. Реализация / codegen из дизайна

Генерация и правки кода — **только** через typography tokens целевого стека.

### Чеклист

- [ ] **T-C-01 P0** В сгенерированном коде нет сырых `font-size` / `font-weight` / `line-height` / `letter-spacing` / family literals (кроме слоя определения самих токенов).
- [ ] **T-C-02 P0** Значения из MCP (`fontSize: 16` и т.п.) не копируются в компонент; используется имя токена из фазы 2.
- [ ] **T-C-03 P0** Технология вывода соблюдает контракт репозитория:

  | Стек | Ожидаемая ссылка (пример) |
  |---|---|
  | CSS / CSS Modules | `var(--font-size-md)` / class из DS |
  | SCSS | `map-get` / mixin / CSS var из tokens |
  | CSS-in-JS | `theme.typography.bodyMd` / `css\`font: ${tokens...}\`` |
  | TS / JS object | ключ theme, не `{ fontSize: 16 }` в JSX |
  | Tailwind | theme key / `@apply` из DS, не `text-[15px]` |
  | XML / native | `@style` / `TextStyle` / resource ref |

- [ ] **T-C-04 P0** Если токена нет — codegen останавливается на этом свойстве: `MISSING_TOKEN` + предлагаемое имя; допускается временный TODO-комментарий с ID, **не** магическое число.
- [ ] **T-C-05 P1** Семантика уровня текста (heading / body / label) сохранена именем токена, а не угадана по px.
- [ ] **T-C-06 P1** Не дублировать шкалу локально в компоненте («свой» `fontSizes` рядом с DS).

---

## Самопроверка перед ответом

- [ ] Figma: bindings проверены; хардкод в таблице `T-D-*`
- [ ] Semantic → alias на primitive (дизайн и код); нет `SEMANTIC_HARDCODE`
- [ ] Код: сверка сделана; статусы `T-S-*` явны
- [ ] Codegen / правки: только токены; нет computed px из MCP (`T-C-*`)
- [ ] Пробелы токенов = gap + имя, не silent literal
- [ ] Допущения и вопросы перечислены

## Формат ответа

```
Объект (фрейм / компонент / файлы):
Проверено (ID): T-D-xx, T-S-xx, T-C-xx, ...
Отклонения дизайна (хардкод / unbound / semantic без alias):
Сверка дизайн ↔ код (вкл. alias → primitive):
Пробелы токенов (предложенные имена):
Изменения в коде (только через токены):
Допущения:
Вопросы:
```

Краткий минимум при мелкой правке:

```
Проверено: …
Отклонения: …
Токены в коде: …
```
