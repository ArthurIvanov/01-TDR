# Публикация в Figma Community

## Карточка

**Название:** Contrast A11y: WCAG & APCA

**Краткое описание (до ~130 знаков):**
Проверка контраста WCAG и APCA с исправлением в один клик: текст, иконки, градиенты, переменные и темы.

**Полное описание:**
Contrast A11y находит ошибки контраста в выделении или на всей странице и помогает исправить их, не выходя из Figma.

- Уровни AA и AAA, а также APCA (Lc).
- Режим «Пара слоёв»: выделите два слоя и сразу увидите контраст.
- Подбор ближайшего цвета с сохранением оттенка.
- Массовое исправление с предпросмотром, одним шагом отмены.
- Градиентные фоны, прозрачность, группы с непрозрачностью.
- Переменные: проверка в светлой и тёмной темах, подбор токена, правка самой переменной.
- Подсветка проблемных слоёв на макете.

Плагин работает локально и не отправляет данные в сеть.

**Теги:** accessibility, a11y, contrast, wcag, apca, color, design system, variables

**Категория:** Accessibility

## Listing (English) — recommended primary language

**Name:** Contrast A11y: WCAG & APCA

**Tagline (~130 chars):**
WCAG & APCA contrast checker with one-click fixes: text, icons, gradients, variables and themes.

**Description:**
Contrast A11y finds contrast issues in your selection or on the whole page and helps you fix them without leaving Figma.

- AA and AAA levels, plus APCA (Lc).
- "Pair of layers" mode: select two layers and see their contrast instantly.
- Nearest-color fix that keeps the hue and saturation.
- Bulk fix with a preview and a single undo step.
- Gradient backdrops, transparency and group opacity.
- Variables: checks every mode (light and dark), suggests nearby tokens, edits the variable itself.
- Optional on-canvas highlights for failing layers.

The plugin runs locally and sends no data over the network. The interface follows your Figma language (English or Russian).

**Tags:** accessibility, a11y, contrast, wcag, apca, color, design system, variables

**Category:** Accessibility

## Материалы

| Файл | Размер | Назначение |
|---|---|---|
| [store/icon-128.png](store/icon-128.png) | 128×128 | Иконка плагина |
| [store/cover.png](store/cover.png) | 1920×960 | Обложка (русская) |
| [store/cover-en.png](store/cover-en.png) | 1920×960 | Обложка (английская, основная) |

Для галереи добавьте 2–3 скриншота реального плагина в файле Figma: список ошибок, редактор, массовое исправление.

## Чек-лист перед публикацией

- [ ] `npm run build` и `npm run lint` проходят без ошибок.
- [ ] Проверено в светлой и тёмной теме Figma.
- [ ] Проверено на большом файле (тысячи слоёв): прогресс идёт, UI не зависает.
- [ ] Проверены сценарии: нет выделения, один слой, пара слоёв, градиент, изображение под текстом.
- [ ] Проверены переменные: локальные, из библиотеки (нельзя изменить), алиасы, несколько режимов.
- [ ] Проверена отмена (Cmd/Ctrl+Z) после одиночного и массового исправления.
- [ ] Подсветка на макете удаляется при закрытии плагина.
- [ ] Проверены оба языка интерфейса (ru и en).
- [ ] В карточке указано, что плагин не использует сеть.
- [ ] Figma: Plugins → Manage plugins → Publish.
