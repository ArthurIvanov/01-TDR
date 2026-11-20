# 01-TDR Variables Export

Figma-плагин: экспорт локальных variables и Text Styles в CSS.

## Что делает

- Читает локальные variables из **одной или нескольких** Variable Collections
- Типы определяются **автоматически** по содержимому выбранных коллекций:
  - **COLOR** → `#rrggbb` / `rgba(...)` / `var(--alias)`
  - **FLOAT** → `Npx` (spacing / size); имя содержит `weight` → unitless; alias → `var(--…)`
  - **STRING** → `"value"`; alias → `var(--…)`
- Имена: `bg/primary` → `--{prefix}-bg-primary` (по умолчанию `tdr`; пробелы → `-`); классы → `.{prefix}-text-…`
- Префикс настраивается в UI и сохраняется между запусками
- Modes: single-mode (primitives) → `:root`; дефолтный mode (первый у первой multi-mode) → `:root, [data-theme="<имя>"]`; остальные (dark, highContrast, …) → `[data-theme="<имя mode>"]`
- Alias → `var(--other-token)` (primitive/_palette + semantic в одном экспорте)
- Локальные **Text Styles** (если есть) добавляются автоматически → классы `.text-body-m`
- UI: выпадающий multi-select коллекций, «Экспортировать», resizable textarea «Вывод», «Скопировать»

## Setup

```bash
npm install
npm run build
```

Для разработки:

```bash
npm run watch
```

## Загрузка в Figma

1. Plugins → Development → Import plugin from manifest…
2. Выберите `manifest.json` из этой папки
3. Запустите плагин в файле с локальными variables / text styles
4. Отметьте коллекции (например `_palette` + semantic + space) → «Экспортировать»

## Требования

- Локальные Variable Collections с хотя бы одним mode
- Локальные Text Styles — опционально (подмешиваются при наличии)
- BOOLEAN / EASING / TIMING / remote library styles — вне scope
