type ExportableVariableType = 'COLOR' | 'FLOAT' | 'STRING';

type UiToPluginMessage =
  | { type: 'ready' }
  | { type: 'export-collections'; collectionIds: string[]; prefix: string }
  | { type: 'close' };

type PluginToUiMessage =
  | {
      type: 'collections';
      collections: Array<{ id: string; name: string }>;
      prefix: string;
    }
  | { type: 'export-result'; css: string }
  | { type: 'export-error'; message: string };

const EXPORTABLE_VARIABLE_TYPES: ReadonlySet<ExportableVariableType> = new Set([
  'COLOR',
  'FLOAT',
  'STRING',
]);

const DEFAULT_CSS_PREFIX = 'tdr';
const PREFIX_STORAGE_KEY = 'cssPrefix';

function postToUi(message: PluginToUiMessage): void {
  figma.ui.postMessage(message);
}

function normalizePrefix(raw: string | undefined): string {
  return (raw ?? '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .replace(/^-+|-+$/g, '');
}

function toCssCustomPropertyName(variableName: string, prefix: string): string {
  const slug = variableName.replace(/\//g, '-').replace(/\s+/g, '-');
  return prefix.length > 0 ? `--${prefix}-${slug}` : `--${slug}`;
}

function toTextStyleClassName(styleName: string, prefix: string): string {
  const slug = styleName
    .replace(/\//g, '-')
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .toLowerCase();
  if (slug.length === 0) {
    return '';
  }
  return prefix.length > 0 ? `.${prefix}-text-${slug}` : `.text-${slug}`;
}

function channelToHex(channel: number): string {
  const value = Math.round(Math.min(1, Math.max(0, channel)) * 255);
  return value.toString(16).padStart(2, '0');
}

function colorToCss(color: RGBA): string {
  const r = Math.round(Math.min(1, Math.max(0, color.r)) * 255);
  const g = Math.round(Math.min(1, Math.max(0, color.g)) * 255);
  const b = Math.round(Math.min(1, Math.max(0, color.b)) * 255);
  const a = color.a;

  if (a < 1) {
    const alpha = Number(a.toFixed(4).replace(/\.?0+$/, '') || '0');
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  return `#${channelToHex(color.r)}${channelToHex(color.g)}${channelToHex(color.b)}`;
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return '0';
  }
  const rounded = Number(value.toFixed(4));
  return String(rounded);
}

function isWeightVariableName(variableName: string): boolean {
  return /weight/i.test(variableName);
}

function floatToCss(value: number, variableName: string): string {
  const formatted = formatNumber(value);
  if (isWeightVariableName(variableName)) {
    return formatted;
  }
  return `${formatted}px`;
}

function escapeCssString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function stringToCss(value: string): string {
  return `"${escapeCssString(value)}"`;
}

function isVariableAlias(value: VariableValue): value is VariableAlias {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    value.type === 'VARIABLE_ALIAS'
  );
}

function isRgbaColor(value: VariableValue): value is RGBA {
  return (
    typeof value === 'object' &&
    value !== null &&
    'r' in value &&
    'g' in value &&
    'b' in value &&
    !('type' in value)
  );
}

async function resolveAliasCss(
  alias: VariableAlias,
  variableById: Map<string, Variable>,
  prefix: string,
): Promise<string | null> {
  let target = variableById.get(alias.id);
  if (!target) {
    const fetched = await figma.variables.getVariableByIdAsync(alias.id);
    if (!fetched) {
      return null;
    }
    variableById.set(fetched.id, fetched);
    target = fetched;
  }
  return `var(${toCssCustomPropertyName(target.name, prefix)})`;
}

async function resolveCssValue(
  value: VariableValue | undefined,
  variableById: Map<string, Variable>,
  context: {
    variableName: string;
    resolvedType: VariableResolvedDataType;
    prefix: string;
  },
): Promise<string | null> {
  if (value === undefined) {
    return null;
  }

  if (isVariableAlias(value)) {
    return resolveAliasCss(value, variableById, context.prefix);
  }

  if (context.resolvedType === 'COLOR' && isRgbaColor(value)) {
    return colorToCss(value);
  }

  if (context.resolvedType === 'FLOAT' && typeof value === 'number') {
    return floatToCss(value, context.variableName);
  }

  if (context.resolvedType === 'STRING' && typeof value === 'string') {
    return stringToCss(value);
  }

  return null;
}

function escapeCssAttributeValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function themeSelector(modeName: string): string {
  return `[data-theme="${escapeCssAttributeValue(modeName)}"]`;
}

function defaultThemeSelector(defaultModeName: string): string {
  // Default theme is both the document fallback and an explicit product API.
  // Scales to dark / highContrast / etc. via the same [data-theme] contract.
  return `:root, ${themeSelector(defaultModeName)}`;
}

function modeToSelector(
  modeName: string,
  defaultModeName: string,
  modeCountInCollection: number,
): string {
  // Single-mode collections (typical primitives/palette) stay on :root only
  // so aliases resolve via inheritance for every theme.
  if (modeCountInCollection === 1) {
    return ':root';
  }
  if (modeName === defaultModeName) {
    return defaultThemeSelector(defaultModeName);
  }
  return themeSelector(modeName);
}

function formatCssBlock(selector: string, declarations: string[]): string {
  if (declarations.length === 0) {
    return `${selector} {\n}`;
  }
  return `${selector} {\n${declarations.map((line) => `  ${line}`).join('\n')}\n}`;
}

function resolveDefaultModeName(
  collections: VariableCollection[],
): string | null {
  for (const collection of collections) {
    if (collection.modes.length > 1) {
      return collection.modes[0].name;
    }
  }
  return collections[0]?.modes[0]?.name ?? null;
}

function isExportableVariableType(
  type: VariableResolvedDataType,
): type is ExportableVariableType {
  return EXPORTABLE_VARIABLE_TYPES.has(type as ExportableVariableType);
}

async function loadTypedVariables(
  collections: VariableCollection[],
): Promise<{
  variablesByCollection: Map<string, Variable[]>;
  variableById: Map<string, Variable>;
}> {
  const variablesByCollection = new Map<string, Variable[]>();
  const variableById = new Map<string, Variable>();

  for (const collection of collections) {
    const variables = await Promise.all(
      collection.variableIds.map((id) => figma.variables.getVariableByIdAsync(id)),
    );
    // Types come from the collection contents (COLOR / FLOAT / STRING).
    const typedVariables = variables.filter(
      (variable): variable is Variable =>
        variable !== null && isExportableVariableType(variable.resolvedType),
    );
    variablesByCollection.set(collection.id, typedVariables);
    for (const variable of typedVariables) {
      variableById.set(variable.id, variable);
    }
  }

  return { variablesByCollection, variableById };
}

async function buildCssForCollections(
  collectionIds: string[],
  prefix: string,
): Promise<string> {
  if (collectionIds.length === 0) {
    throw new Error('Выберите хотя бы одну коллекцию.');
  }

  const allCollections = await figma.variables.getLocalVariableCollectionsAsync();
  const selected: VariableCollection[] = [];

  for (const id of collectionIds) {
    const collection = allCollections.find((item) => item.id === id);
    if (!collection) {
      throw new Error('Коллекция не найдена.');
    }
    if (collection.modes.length === 0) {
      throw new Error(`В коллекции «${collection.name}» нет modes.`);
    }
    selected.push(collection);
  }

  const defaultModeName = resolveDefaultModeName(selected);
  if (!defaultModeName) {
    throw new Error('Не удалось определить mode по умолчанию.');
  }

  const { variablesByCollection, variableById } =
    await loadTypedVariables(selected);

  // selector → custom property name → declaration (last write wins on conflicts)
  const blockMaps = new Map<string, Map<string, string>>();
  const selectorOrder: string[] = [];

  function ensureSelector(selector: string): Map<string, string> {
    let props = blockMaps.get(selector);
    if (!props) {
      props = new Map();
      blockMaps.set(selector, props);
      selectorOrder.push(selector);
    }
    return props;
  }

  const defaultSelector = defaultThemeSelector(defaultModeName);

  // Prefer :root (primitives), then default theme, then other themes.
  ensureSelector(':root');
  ensureSelector(defaultSelector);

  for (const collection of selected) {
    const typedVariables = variablesByCollection.get(collection.id) ?? [];

    for (const mode of collection.modes) {
      const selector = modeToSelector(
        mode.name,
        defaultModeName,
        collection.modes.length,
      );
      const props = ensureSelector(selector);

      for (const variable of typedVariables) {
        const cssName = toCssCustomPropertyName(variable.name, prefix);
        const cssValue = await resolveCssValue(
          variable.valuesByMode[mode.modeId],
          variableById,
          {
            variableName: variable.name,
            resolvedType: variable.resolvedType,
            prefix,
          },
        );
        if (cssValue !== null) {
          props.set(cssName, `${cssName}: ${cssValue};`);
        }
      }
    }
  }

  const orderedSelectors = [
    ':root',
    defaultSelector,
    ...selectorOrder.filter(
      (selector) => selector !== ':root' && selector !== defaultSelector,
    ),
  ];

  const blocks = orderedSelectors
    .map((selector) => {
      const props = blockMaps.get(selector);
      if (!props || props.size === 0) {
        return null;
      }
      return formatCssBlock(selector, Array.from(props.values()));
    })
    .filter((block): block is string => block !== null);

  if (blocks.length === 0) {
    throw new Error(
      'В выбранных коллекциях нет переменных типов COLOR / FLOAT / STRING.',
    );
  }

  return blocks.join('\n\n');
}

function fontStyleToWeight(style: string): string | null {
  const normalized = style.trim().toLowerCase();
  const table: Array<[RegExp, string]> = [
    [/\b(thin|hairline)\b/, '100'],
    [/\b(extralight|ultralight)\b/, '200'],
    [/\blight\b/, '300'],
    [/\b(regular|normal|book|roman)\b/, '400'],
    [/\bmedium\b/, '500'],
    [/\b(semibold|demibold)\b/, '600'],
    [/\b(extrabold|ultrabold)\b/, '800'],
    [/\b(bold)\b/, '700'],
    [/\b(black|heavy)\b/, '900'],
  ];

  for (const [pattern, weight] of table) {
    if (pattern.test(normalized)) {
      return weight;
    }
  }

  return null;
}

function letterSpacingToCss(letterSpacing: LetterSpacing): string {
  const value = formatNumber(letterSpacing.value);
  return letterSpacing.unit === 'PERCENT' ? `${value}%` : `${value}px`;
}

function lineHeightToCss(lineHeight: LineHeight): string | null {
  if (lineHeight.unit === 'AUTO') {
    return null;
  }
  const value = formatNumber(lineHeight.value);
  return lineHeight.unit === 'PERCENT' ? `${value}%` : `${value}px`;
}

async function resolveTextStyleFieldCss(
  style: TextStyle,
  field: VariableBindableTextField,
  fallback: string | null,
  variableById: Map<string, Variable>,
  prefix: string,
): Promise<string | null> {
  const alias = style.boundVariables?.[field];
  if (alias) {
    const css = await resolveAliasCss(alias, variableById, prefix);
    if (css !== null) {
      return css;
    }
  }
  return fallback;
}

async function buildCssForTextStyles(prefix: string): Promise<string> {
  const styles = await figma.getLocalTextStylesAsync();
  if (styles.length === 0) {
    return '';
  }

  const variableById = new Map<string, Variable>();
  const blocks: string[] = [];

  for (const style of styles) {
    const selector = toTextStyleClassName(style.name, prefix);
    if (!selector) {
      continue;
    }

    const declarations: string[] = [];

    const fontFamily = await resolveTextStyleFieldCss(
      style,
      'fontFamily',
      stringToCss(style.fontName.family),
      variableById,
      prefix,
    );
    if (fontFamily !== null) {
      declarations.push(`font-family: ${fontFamily};`);
    }

    const fontSize = await resolveTextStyleFieldCss(
      style,
      'fontSize',
      `${formatNumber(style.fontSize)}px`,
      variableById,
      prefix,
    );
    if (fontSize !== null) {
      declarations.push(`font-size: ${fontSize};`);
    }

    const weightFallback =
      style.fontName.variationSettings?.wght !== undefined
        ? formatNumber(style.fontName.variationSettings.wght)
        : fontStyleToWeight(style.fontName.style);
    const fontWeight = await resolveTextStyleFieldCss(
      style,
      'fontWeight',
      weightFallback,
      variableById,
      prefix,
    );
    if (fontWeight !== null) {
      declarations.push(`font-weight: ${fontWeight};`);
    }

    const lineHeight = await resolveTextStyleFieldCss(
      style,
      'lineHeight',
      lineHeightToCss(style.lineHeight),
      variableById,
      prefix,
    );
    if (lineHeight !== null) {
      declarations.push(`line-height: ${lineHeight};`);
    }

    const letterSpacing = await resolveTextStyleFieldCss(
      style,
      'letterSpacing',
      letterSpacingToCss(style.letterSpacing),
      variableById,
      prefix,
    );
    if (letterSpacing !== null) {
      declarations.push(`letter-spacing: ${letterSpacing};`);
    }

    if (declarations.length > 0) {
      blocks.push(formatCssBlock(selector, declarations));
    }
  }

  return blocks.join('\n\n');
}

async function buildExportCss(
  collectionIds: string[],
  prefix: string,
): Promise<string> {
  const parts: string[] = [
    await buildCssForCollections(collectionIds, prefix),
  ];

  // Text Styles are not scoped to a collection — append when present.
  const textStylesCss = await buildCssForTextStyles(prefix);
  if (textStylesCss.length > 0) {
    parts.push(textStylesCss);
  }

  return parts.join('\n\n');
}

async function loadStoredPrefix(): Promise<string> {
  try {
    const stored = await figma.clientStorage.getAsync(PREFIX_STORAGE_KEY);
    if (typeof stored === 'string') {
      return normalizePrefix(stored);
    }
  } catch (_error) {
    // Ignore storage failures and fall back to default.
  }
  return DEFAULT_CSS_PREFIX;
}

async function saveStoredPrefix(prefix: string): Promise<void> {
  try {
    await figma.clientStorage.setAsync(PREFIX_STORAGE_KEY, prefix);
  } catch (_error) {
    // Ignore storage failures.
  }
}

async function sendCollections(): Promise<void> {
  const [collections, prefix] = await Promise.all([
    figma.variables.getLocalVariableCollectionsAsync(),
    loadStoredPrefix(),
  ]);
  postToUi({
    type: 'collections',
    collections: collections.map((collection) => ({
      id: collection.id,
      name: collection.name,
    })),
    prefix,
  });
}

figma.showUI(__html__, { width: 420, height: 580 });

figma.ui.onmessage = async (msg: UiToPluginMessage) => {
  if (msg.type === 'close') {
    figma.closePlugin();
    return;
  }

  if (msg.type === 'ready') {
    try {
      await sendCollections();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Не удалось загрузить коллекции.';
      postToUi({ type: 'export-error', message });
    }
    return;
  }

  if (msg.type === 'export-collections') {
    try {
      const prefix = normalizePrefix(msg.prefix);
      await saveStoredPrefix(prefix);
      const css = await buildExportCss(msg.collectionIds, prefix);
      postToUi({ type: 'export-result', css });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Не удалось экспортировать CSS.';
      postToUi({ type: 'export-error', message });
    }
  }
};
