/** Shared UI ↔ main message contracts. */

export type ColorBinding = {
  kind: 'variable' | 'style' | 'raw';
  /** Variable or style name when known; null for raw fills. */
  name: string | null;
};

export type ColorPayload = {
  hex: string;
  /** Paint opacity 0–1 (node opacity already multiplied in). */
  opacity: number;
  binding: ColorBinding;
};

export type SelectionColorsMessage = {
  type: 'selection-colors';
  foreground: ColorPayload | null;
  background: ColorPayload | null;
  hint: string;
  /** True when at least one sampled fill is raw (no variable / paint style). */
  hasUnbound: boolean;
};

export type UiToMainMessage =
  | { type: 'ready' }
  | { type: 'request-selection' }
  | { type: 'close' };
