/**
 * A11y Contrast Checker — Figma plugin main thread.
 * Resolves solid fills (Variables / styles / raw), pairs text with parent bg.
 */

import { rgbToHex, type Rgb } from './contrast';
import type { ColorPayload, SelectionColorsMessage, UiToMainMessage } from './messages';

type PaintSample = {
  rgb: Rgb;
  opacity: number;
  variableId: string | null;
  styleId: string | null;
};

figma.showUI(__html__, { width: 360, height: 560, themeColors: true });

function nodeOpacity(node: SceneNode): number {
  return 'opacity' in node ? node.opacity : 1;
}

function topSolidPaint(node: SceneNode): SolidPaint | null {
  if (!('fills' in node)) return null;
  const fills = node.fills;
  if (fills === figma.mixed || !Array.isArray(fills)) return null;

  for (let i = fills.length - 1; i >= 0; i -= 1) {
    const fill = fills[i];
    if (fill.type === 'SOLID' && fill.visible !== false) {
      return fill;
    }
  }
  return null;
}

function fillStyleIdOf(node: SceneNode): string | null {
  if (!('fillStyleId' in node)) return null;
  const id = node.fillStyleId;
  if (id === figma.mixed || !id) return null;
  return id;
}

function sampleSolid(node: SceneNode): PaintSample | null {
  const paint = topSolidPaint(node);
  if (!paint) return null;

  const paintOpacity = paint.opacity ?? 1;
  const variableId = paint.boundVariables?.color?.id ?? null;

  return {
    rgb: { r: paint.color.r, g: paint.color.g, b: paint.color.b },
    opacity: paintOpacity * nodeOpacity(node),
    variableId,
    styleId: fillStyleIdOf(node),
  };
}

async function toPayload(sample: PaintSample): Promise<ColorPayload> {
  let name: string | null = null;
  let kind: ColorPayload['binding']['kind'] = 'raw';

  if (sample.variableId) {
    const variable = await figma.variables.getVariableByIdAsync(sample.variableId);
    if (variable) {
      kind = 'variable';
      name = variable.name;
    }
  }

  if (kind === 'raw' && sample.styleId) {
    const style = await figma.getStyleByIdAsync(sample.styleId);
    if (style) {
      kind = 'style';
      name = style.name;
    }
  }

  return {
    hex: rgbToHex(sample.rgb),
    opacity: sample.opacity,
    binding: { kind, name },
  };
}

function findAncestorBackground(node: SceneNode): PaintSample | null {
  let current: BaseNode | null = node.parent;
  while (current && current.type !== 'PAGE' && current.type !== 'DOCUMENT') {
    if (current.type !== 'GROUP' && 'fills' in current) {
      const sample = sampleSolid(current as SceneNode);
      if (sample && sample.opacity > 0.01) return sample;
    }
    current = current.parent;
  }
  return null;
}

function isTextNode(node: SceneNode): node is TextNode {
  return node.type === 'TEXT';
}

function hasMixedFills(node: SceneNode): boolean {
  return 'fills' in node && node.fills === figma.mixed;
}

function findTextDescendant(node: SceneNode): TextNode | null {
  if (isTextNode(node)) return node;
  if (!('findAllWithCriteria' in node)) return null;
  const texts = node.findAllWithCriteria({ types: ['TEXT'] });
  return texts[0] ?? null;
}

async function pairTextAndBackground(
  textNode: TextNode,
  preferredBg: PaintSample | null,
): Promise<{ foreground: ColorPayload | null; background: ColorPayload | null; hint: string }> {
  const fgSample = sampleSolid(textNode);
  const bgSample = preferredBg ?? findAncestorBackground(textNode);

  const foreground = fgSample ? await toPayload(fgSample) : null;
  const background = bgSample ? await toPayload(bgSample) : null;

  if (foreground && background) {
    return {
      foreground,
      background,
      hint: preferredBg
        ? 'Container/text pair → foreground + background.'
        : 'Text fill → foreground; nearest ancestor solid → background.',
    };
  }
  if (foreground) {
    return {
      foreground,
      background: null,
      hint: 'Text fill → foreground. No solid background found — pick one manually.',
    };
  }
  return {
    foreground: null,
    background,
    hint: 'Could not read a solid text fill from selection.',
  };
}

async function pushSelectionColors(): Promise<void> {
  const selection = figma.currentPage.selection;

  let foreground: ColorPayload | null = null;
  let background: ColorPayload | null = null;
  let hint = 'Select one or two layers with solid fills, or pick colors manually.';
  let hasUnbound = false;

  try {
    if (selection.length === 0) {
      hint = 'Nothing selected — pick colors manually or select layers.';
    } else if (selection.length === 1) {
      const node = selection[0];
      if (hasMixedFills(node)) {
        hint = 'Mixed fills on selection — pick a single solid or set colors manually.';
      } else if (isTextNode(node)) {
        const paired = await pairTextAndBackground(node, null);
        foreground = paired.foreground;
        background = paired.background;
        hint = paired.hint;
      } else {
        const ownFill = sampleSolid(node);
        const textChild = findTextDescendant(node);

        if (textChild) {
          const paired = await pairTextAndBackground(textChild, ownFill);
          foreground = paired.foreground;
          background = paired.background;
          hint = paired.hint;
        } else if (ownFill) {
          foreground = await toPayload(ownFill);
          hint = 'One color from selection → foreground. Select a second layer for background.';
        } else {
          hint = 'Selected layer has no solid fill or text. Try another layer or pick colors manually.';
        }
      }
    } else {
      const textNode = selection.find(isTextNode);
      const others = selection.filter((n) => n !== textNode);

      if (textNode) {
        const fgSample = sampleSolid(textNode);
        const bgNode = others.find((n) => sampleSolid(n));
        const bgSample =
          (bgNode ? sampleSolid(bgNode) : null) ?? findAncestorBackground(textNode);

        if (fgSample) foreground = await toPayload(fgSample);
        if (bgSample) background = await toPayload(bgSample);

        if (foreground && background) {
          hint = bgNode
            ? 'Text → foreground; second selected solid → background.'
            : 'Text → foreground; ancestor solid → background.';
        } else if (foreground) {
          hint = 'Got text color — select a solid background layer too.';
        } else {
          hint = 'Could not read a solid text fill from selection.';
        }
      } else {
        const samples: { node: SceneNode; sample: PaintSample }[] = [];
        for (const node of selection) {
          if (hasMixedFills(node)) continue;
          const sample = sampleSolid(node);
          if (sample) samples.push({ node, sample });
        }

        if (samples.length === 0) {
          hint = 'Selected layers have no solid fills. Try others or pick colors manually.';
        } else if (samples.length === 1) {
          foreground = await toPayload(samples[0].sample);
          hint = 'Only one solid fill in selection → foreground.';
        } else {
          foreground = await toPayload(samples[0].sample);
          background = await toPayload(samples[1].sample);
          hint =
            samples.length > 2
              ? `Using first two of ${samples.length} solid fills from selection.`
              : 'Foreground and background taken from selection.';
        }
      }
    }

    hasUnbound =
      (foreground?.binding.kind === 'raw') ||
      (background?.binding.kind === 'raw');

    if (hasUnbound && (foreground || background)) {
      hint += ' Unbound raw fill detected (no variable/style).';
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    hint = `Could not read selection: ${message}`;
    figma.notify('Contrast Checker: failed to read selection', { error: true });
  }

  const payload: SelectionColorsMessage = {
    type: 'selection-colors',
    foreground,
    background,
    hint,
    hasUnbound,
  };

  figma.ui.postMessage(payload);
}

figma.on('selectionchange', () => {
  void pushSelectionColors();
});

figma.ui.onmessage = (msg: UiToMainMessage) => {
  if (msg.type === 'ready' || msg.type === 'request-selection') {
    void pushSelectionColors();
    return;
  }

  if (msg.type === 'close') {
    figma.closePlugin();
  }
};
