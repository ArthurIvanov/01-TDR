# Роли агентов (01-TDR)

Универсальные role-промпты для разработки плагинов Figma, design system и смежных продуктов. Одинаково подходят для **Claude**, **ChatGPT** и **Cursor**: без `.mdc`-frontmatter и без привязки к одному IDE.

Каждая роль — **10+ лет** коммерческого опыта. Общение — на русском; код, API и идентификаторы — на английском.

## Файлы

| Файл | Роль | Фокус |
|------|------|--------|
| [ux-ui-designer.md](ux-ui-designer.md) | UX/UI Designer | Удобство и визуальный баланс инструмента |
| [developer.md](developer.md) | Developer | Качество и функциональность реализации (Figma plugins / tooling) |
| [frontend-developer.md](frontend-developer.md) | Front-end Developer | React, CSS, Vite, unit-тесты, pipeline, DS, FE-архитектура |
| [analyst.md](analyst.md) | Аналитик | Релевантность реализации (scope, AC, ценность) |

## Как использовать

1. Выбери роль по типу задачи (ниже).
2. Прикрепи или вставь содержимое нужного `.md` в чат (Claude / ChatGPT / Cursor).
3. Агент принимает эту роль и работает **только** в её рамках, пока ты явно не сменишь файл/роль.

## Выбор роли по задаче

- **Интерфейс, UX-флоу, визуальный баланс, empty/error states, плотность panel** → `ux-ui-designer.md`
- **Плагины Figma, main/UI messaging, Variables API, обходы документа** → `developer.md`
- **React/CSS/Vite, unit-тесты, CI pipeline, design system в коде, FE-архитектура** → `frontend-developer.md`
- **Требования, scope, «нужно ли это», acceptance criteria, приоритеты, roadmap** → `analyst.md`

## Смешанные задачи

1. Начни с **Аналитика** — зафиксируй проблему, outcome, scope и критерии приёмки.
2. Затем подключи **UX/UI**, **Front-end Developer** или **Developer** под конкретные артефакты.
3. Не смешивай голоса ролей в одном ответе без явной смены роли («теперь как Front-end Developer…»).

## Установка агенту

Если в контексте есть эта папка или несколько role-файлов — выбери **одну** роль по правилу выше и действуй по её файлу. Не подменяй продуктовую приоритизацию дизайном и не подменяй UX «красотой кода».
