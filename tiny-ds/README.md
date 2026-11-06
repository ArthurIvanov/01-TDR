# tiny-ds

Минимальный design system на **React + TypeScript + CSS** (Vite).

## Стек

- React 19 + TypeScript
- Vite 8
- CSS tokens из Figma via **01-TDR-variables-export**
- Vitest + Testing Library
- oxlint

## Цвета (контракт плагина)

Единый drop-in файл:

`src/styles/tokens/figma-colors.css`

Формат экспорта плагина:

- Имена: `bg/lead/loud/enabled` → `--bg-lead-loud-enabled`
- `:root` — палитра (hex) + light-семантика (`var(--grey-50)` и т.п.)
- `[data-theme="dark"]` — только semantic overrides
- Alias палитры без префикса: `--grey-50`, `--base-white`, …

### Как обновить из Figma

1. В плагине отметь `_palette` + `colors` → «Экспортировать» → «Скопировать»
2. Вставь вывод **целиком** в `src/styles/tokens/figma-colors.css` (можно оставить шапку-комментарий сверху)
3. Не правь значения руками — только через Figma → re-export

Тема в рантайме: `setTheme('dark' | 'light')` из `@/theme` ставит/снимает `data-theme` на `<html>`.

## Команды

```bash
npm run dev
npm run build
npm run test
npm run lint
npm run typecheck
```

## Структура

```
src/
  components/
  styles/
    tokens/figma-colors.css   # drop-in плагина
    tokens/foundation.css     # type/space (не из color-плагина)
    tokens.css
  theme/                      # data-theme helpers
  App.tsx
```

Алиас: `@/` → `src/`.
