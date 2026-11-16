# Роли агентов (01-TDR)

Универсальные role-промпты для разработки плагинов Figma, design system и смежных продуктов. Одинаково подходят для **Claude**, **ChatGPT** и **Cursor**: без `.mdc`-frontmatter и без привязки к одному IDE.

Роли с **10+** лет опыта; Design Systems Architect — **15+**. Общение — на русском; код, API и идентификаторы — на английском.

## Файлы

| Файл | Роль | Фокус |
|------|------|--------|
| [ux-ui-designer.md](ux-ui-designer.md) | UX/UI Designer | Удобство и визуальный баланс инструмента |
| [developer.md](developer.md) | Developer | Качество и функциональность реализации (Figma plugins / tooling) |
| [frontend-developer.md](frontend-developer.md) | Front-end Developer | React, CSS, Vite, unit-тесты, pipeline, DS, FE-архитектура |
| [design-systems-architect.md](design-systems-architect.md) | Design Systems Architect | Архитектура DS, adoption, токены, web↔native, governance |
| [analyst.md](analyst.md) | Аналитик | Релевантность реализации (scope, AC, ценность) |

## Как использовать

1. Выбери роль по типу задачи (ниже) — или позволь агенту выбрать по `.cursor/rules/roles-routing.mdc` (alwaysApply).
2. Прикрепи или вставь содержимое нужного `.md` в чат (Claude / ChatGPT / Cursor), если работаешь вне Cursor.
3. Агент принимает роль(и) и работает в их рамках, пока ты явно не сменишь файл/роль.
4. Нехватка покрытия → дополни существующий `.md` или добавь новый и обнови эту таблицу.

## Выбор роли по задаче

- **Интерфейс, UX-флоу, визуальный баланс, empty/error states, плотность panel** → `ux-ui-designer.md`
- **Плагины Figma, main/UI messaging, Variables API, обходы документа** → `developer.md`
- **React/CSS/Vite, unit-тесты, CI pipeline, design system в коде, FE-архитектура** → `frontend-developer.md`
- **Архитектура DS, adoption, слои токенов, multi-platform, governance, миграции** → `design-systems-architect.md`
- **Требования, scope, «нужно ли это», acceptance criteria, приоритеты, roadmap** → `analyst.md`

## Смешанные задачи

1. Начни с **Аналитика** — зафиксируй проблему, outcome, scope и критерии приёмки.
2. Для платформенных решений DS подключи **Design Systems Architect**, затем **UX/UI**, **Front-end Developer** или **Developer** под артефакты.
3. Несколько ролей допустимы **по фазам**; не смешивай голоса в одном абзаце без явной смены («теперь как Front-end Developer…»).

## Установка агенту

Перед каждым запросом сверься с этой папкой и `.cursor/rules/roles-routing.mdc`: выбери максимально подходящую роль (или фазы ролей), при пробелах — дополни файлы. Не подменяй продуктовую приоритизацию дизайном и не подменяй UX «красотой кода».