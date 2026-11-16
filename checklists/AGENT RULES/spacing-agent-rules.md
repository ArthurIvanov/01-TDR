# Правила отступов (spacing) для ИИ-агентов

Для агентов, сверяющих **Figma ↔ код** и генерирующих компоненты дизайн-системы. Платформа: web (и любой UI-слой с layout). Цель: **только токены отступов**; **gap / space-between** — между элементами; **padding** — внутри контейнера; margin — по контракту проекта (обычно внешний отступ блока), без подмены ролей.

ID: `S-D-` — дизайн (Figma MCP), `S-S-` — сверка дизайн↔код, `S-C-` — создание/генерация кода, `S-U-` — корректность роли токена (gap vs padding vs margin).

Связанные роли: `roles/design-systems-architect.md`, `roles/frontend-developer.md`, `roles/ux-ui-designer.md`.  
Смежный чеклист: [typography-agent-rules.md](typography-agent-rules.md).

## Правила

1. **Источник правды** — spacing variables / styles в Figma и их контракт в коде. Литералы (`8`, `8px`, `12px`) в продуктовом UI — дефект, пока нет `EXCEPTION`.
2. **Сначала аудит дизайна через Figma MCP**, потом сверка с репозиторием, потом генерация кода. Не восстанавливай отступы «на глаз» по скриншоту.
3. **Стек не важен:** CSS Modules, CSS variables, CSS-in-JS, TS/JS theme objects — везде ссылки на spacing-токены, не на литералы.
4. **Семантика ролей (обязательно):**
   - **padding** — внутренний отступ контейнера (от края до контента).
   - **gap** (и item spacing / auto-layout gap в Figma) — расстояние **между** соседними детьми в одном layout.
   - **margin** — внешний отступ элемента относительно соседей / родителя; не заменяй им padding «для удобства» и не эмулируй gap через margin у каждого ребёнка без причины.
5. **Не выдумывай токены.** Нет матча → gap + предложение имени по шкале проекта; не silent literal.
6. **Расхождения** (дизайн, код, handoff дизайн→код) всегда явны в таблицах.
7. **Исключения** помечай `EXCEPTION` + обоснование; иначе — fail.

## Часть 1. Дизайн (Figma MCP) — `S-D-`

Используй Figma MCP (`get_design_context`, `get_variable_defs`, `get_metadata`, при необходимости `get_screenshot`). Не утверждай binding без данных из MCP.

Свойства к проверке: `padding` (top/right/bottom/left или shorthand), `itemSpacing` / `counterAxisSpacing` / **gap**, `layoutMode` (HORIZONTAL / VERTICAL / GRID), margin-эквиваленты если отдаются MCP, а также variable bindings на эти поля.

- [ ] **S-D-01** Для целевого node и значимых детей собраны фактические spacing-свойства через MCP.
- [ ] **S-D-02** Padding и gap/itemSpacing привязаны к **variables** (или к утверждённой spacing scale), не к голым числам.
- [ ] **S-D-03** Raw значения (число / px без variable) зафиксированы: node id, свойство, значение, ожидаемый токен.
- [ ] **S-D-04** В auto-layout расстояние между детьми задано через **gap / itemSpacing**, а не через «пустые» spacer-фреймы или ручные absolute offsets — иначе `LAYOUT_SMELL`.
- [ ] **S-D-05** Внутренние поля / кнопки / карточки используют **padding** на контейнере, а не сдвиг контента margin’ом первого ребёнка без причины — иначе `ROLE_MISUSE` в дизайне.
- [ ] **S-D-06** Режимы density / compact (если есть), влияющие на spacing, проверены или помечены out of scope.

### Формат отклонений дизайна

| Node | Property | Actual | Bound? | Role OK? | Expected token | Severity |
|------|----------|--------|--------|----------|----------------|----------|
| … | itemSpacing | 7 | no | yes (gap) | `--tds-space-2` | P0 |
| … | paddingLeft | 16 | yes | yes | `--tds-space-4` | OK |

`P0` — raw или role misuse в DS/ключевом UI; `P1` — черновик/маркетинг; `P2` — drift имён.

## Часть 2. Сверка с кодовой базой — `S-S-`

Найди слой spacing-токенов (например `foundation.css` `--tds-space-*`, theme `space`) и использования в компонентах.

- [ ] **S-S-01** Список spacing-токенов **в коде** (имена + значения / alias).
- [ ] **S-S-02** Список spacing variables / scale **из дизайна** (MCP).
- [ ] **S-S-03** Пары дизайн↔код по семантике; нет пары → `MISSING_IN_CODE` / `MISSING_IN_DESIGN`.
- [ ] **S-S-04** Одно имя / ступень — разные значения → `VALUE_MISMATCH`.
- [ ] **S-S-05** В компонентах найдены литералы `padding` / `gap` / `margin` вне token layer — файлы и селекторы.
- [ ] **S-S-06** Handoff: значение из Figma попало в код другим токеном или другой ролью (gap↔padding) → `HANDOFF_MISMATCH`.
- [ ] **S-S-07** Итог сверки в ответе **до** правок / codegen.

### Формат сверки

| Role | Design | Code | Status |
|------|--------|------|--------|
| space/2 | 8 → var | `--tds-space-2: 0.5rem` | OK |
| Card padding | padding 16 var | `gap: var(--tds-space-4)` | HANDOFF_MISMATCH (padding→gap) |

## Часть 3. Создание компонентов и codegen — `S-C-`

- [ ] **S-C-01** `padding`, `gap`, `row-gap`, `column-gap`, и `margin` (если в scope) задаются **только** через spacing-токены проекта.
- [ ] **S-C-02** Технология не меняет правило:
  - CSS / CSS Modules → `var(--…)` / utility classes на токенах
  - CSS-in-JS → `theme.space[2]`, не `'8px'`
  - TS/JS objects → ключи spacing из DS
- [ ] **S-C-03** Не копируй computed px из MCP в код при наличии токена; нет токена → gap + предложение, не silent literal.
- [ ] **S-C-04** Компонент не плодит локальные one-off spacing tokens вне foundation / theme (или ADR/`EXCEPTION`).
- [ ] **S-C-05** Self-check по затронутым файлам: литералы `px` в padding/gap/margin вне token files.

## Часть 4. Корректность роли токена — `S-U-`

Проверяй **в дизайне**, **в коде** и **на стыке handoff**.

| Назначение | Правильный механизм | Антипаттерн |
|------------|---------------------|-------------|
| Между flex/grid/auto-layout детьми | `gap` / `itemSpacing` (+ spacing token) | `margin` на каждом ребёнке «как gap»; spacer-box |
| Внутри контейнера до контента | `padding` (+ spacing token) | `margin` на первом/последнем ребёнке вместо padding; `gap` вместо padding вокруг одного ребёнка |
| Внешний сдвиг блока в потоке | `margin` по контракту DS | padding родителя «вместо» margin соседа без системы |

- [ ] **S-U-01** Межэлементные отступы → только gap/itemSpacing (или утверждённый stack-примитив DS на gap).
- [ ] **S-U-02** Внутренние отступы → только padding на том контейнере, который владеет полем.
- [ ] **S-U-03** Нет подмены: padding-токен не использован как gap и наоборот (в имени/семантике theme keys тоже).
- [ ] **S-U-04** Расхождения role misuse перечислены с местом: `IN_DESIGN` / `IN_CODE` / `IN_HANDOFF`.
- [ ] **S-U-05** Stack / Button / Card и т.п.: публичный API (`gap`, `padding`, `p`, `px`…) соответствует роли; не мапь `gap` prop в `padding` CSS без документации breaking.

### Формат role misuse

| Where | Node / file | Used as | Should be | Evidence |
|-------|-------------|---------|-----------|----------|
| IN_CODE | Button.css | margin-left on icon | gap on flex parent | `margin-left: 8px` |
| IN_HANDOFF | Card | Figma padding 16 | coded as gap 16 | MCP vs CSS |

## Самопроверка перед ответом

- [ ] Figma MCP использован (или блокер / ручной handoff)
- [ ] Raw spacing в дизайне перечислены
- [ ] Таблица сверки дизайн↔код есть
- [ ] Role check gap vs padding vs margin выполнен
- [ ] Новый код — только spacing tokens + верные роли
- [ ] Gaps и EXCEPTION названы

## Формат ответа

```
Роль: …
Scope (node / files):
S-D (дизайн): OK | N raw — таблица
S-S (сверка): OK | mismatches — таблица
S-U (роли gap/padding/margin): OK | misuses — таблица
S-C (код): что сделано / какие токены / какие свойства
Отклонения и EXCEPTION:
Вопросы / gaps токенов:
```
