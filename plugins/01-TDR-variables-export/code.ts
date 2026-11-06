type UiToPluginMessage =
  | { type: 'ready' }
  | { type: 'export-collections'; collectionIds: string[] }
  | { type: 'close' };

type PluginToUiMessage =
  | {
      type: 'collections';
      collections: Array<{ id: string; name: string }>;
    }
  | { type: 'export-result'; css: string }
  | { type: 'export-error'; message: string };

function postToUi(message: PluginToUiMessage): void {
  figma.ui.postMessage(message);
}

function toCssCustomPropertyName(variableName: string): string {
  return `--${variableName.replace(/\//g, '-').replace(/\s+/g, '-')}`;
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

async function resolveCssValue(
  value: VariableValue | undefined,
  variableById: Map<string, Variable>,
): Promise<string | null> {
  if (value === undefined) {
    return null;
  }

  if (isVariableAlias(value)) {
    let target = variableById.get(value.id);
    if (!target) {
      const fetched = await figma.variables.getVariableByIdAsync(value.id);
      if (!fetched) {
        return null;
      }
      variableById.set(fetched.id, fetched);
      target = fetched;
    }
    return `var(${toCssCustomPropertyName(target.name)})`;
  }

  if (isRgbaColor(value)) {
    return colorToCss(value);
  }

  return null;
}

function escapeCssAttributeValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function modeToSelector(
  modeName: string,
  defaultModeName: string,
  modeCountInCollection: number,
): string {
  // Single-mode collections (typical primitives/palette) go to :root
  // so aliases from themed collections resolve via inheritance.
  if (modeCountInCollection === 1 || modeName === defaultModeName) {
    return ':root';
  }
  return `[data-theme="${escapeCssAttributeValue(modeName)}"]`;
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

async function loadColorVariables(
  collections: VariableCollection[],
): Promise<{ colorVariablesByCollection: Map<string, Variable[]>; variableById: Map<string, Variable> }> {
  const colorVariablesByCollection = new Map<string, Variable[]>();
  const variableById = new Map<string, Variable>();

  for (const collection of collections) {
    const variables = await Promise.all(
      collection.variableIds.map((id) => figma.variables.getVariableByIdAsync(id)),
    );
    const colorVariables = variables.filter(
      (variable): variable is Variable =>
        variable !== null && variable.resolvedType === 'COLOR',
    );
    colorVariablesByCollection.set(collection.id, colorVariables);
    for (const variable of colorVariables) {
      variableById.set(variable.id, variable);
    }
  }

  return { colorVariablesByCollection, variableById };
}

async function buildCssForCollections(collectionIds: string[]): Promise<string> {
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

  const { colorVariablesByCollection, variableById } =
    await loadColorVariables(selected);

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

  // Prefer :root first in output even if a themed block is visited earlier.
  ensureSelector(':root');

  for (const collection of selected) {
    const colorVariables = colorVariablesByCollection.get(collection.id) ?? [];

    for (const mode of collection.modes) {
      const selector = modeToSelector(
        mode.name,
        defaultModeName,
        collection.modes.length,
      );
      const props = ensureSelector(selector);

      for (const variable of colorVariables) {
        const cssName = toCssCustomPropertyName(variable.name);
        const cssValue = await resolveCssValue(
          variable.valuesByMode[mode.modeId],
          variableById,
        );
        if (cssValue !== null) {
          props.set(cssName, `${cssName}: ${cssValue};`);
        }
      }
    }
  }

  const orderedSelectors = [
    ':root',
    ...selectorOrder.filter((selector) => selector !== ':root'),
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
    throw new Error('В выбранных коллекциях нет COLOR-переменных.');
  }

  return blocks.join('\n\n');
}

async function sendCollections(): Promise<void> {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  postToUi({
    type: 'collections',
    collections: collections.map((collection) => ({
      id: collection.id,
      name: collection.name,
    })),
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
      const css = await buildCssForCollections(msg.collectionIds);
      postToUi({ type: 'export-result', css });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Не удалось экспортировать CSS.';
      postToUi({ type: 'export-error', message });
    }
  }
};
