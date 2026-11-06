# 01-TDR Variables Export

Figma-плагин: экспорт локальных **COLOR** variables в CSS custom properties.

## Что делает

- Читает локальные COLOR-переменные из **одной или нескольких** Variable Collections
- Имена: `bg/primary` → `--bg-primary` (пробелы тоже → `-`)
- Modes: дефолтный (первый mode у первой multi-mode коллекции) и single-mode коллекции → `:root`; остальные → `[data-theme="<имя mode>"]`
- Alias → `var(--other-token)`
- Несколько коллекций сливаются в один CSS по селекторам (удобно: `_palette` + semantic)
- UI: чекбоксы коллекций, «Экспортировать», превью, «Скопировать»

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
3. Запустите плагин в файле с локальными variables
4. Отметьте нужные коллекции (например `_palette` и semantic) → «Экспортировать»

## Требования

- Локальные Variable Collections с хотя бы одним mode
- Экспортируются только переменные типа COLOR
