/** Pure color / WCAG contrast helpers — no Figma APIs. */

export type Rgb = { r: number; g: number; b: number };

export type WcagLevelId =
  | 'aa-normal'
  | 'aa-large'
  | 'aaa-normal'
  | 'aaa-large'
  | 'ui';

export type WcagLevel = {
  id: WcagLevelId;
  title: string;
  meta: string;
  min: number;
};

export type WcagResult = WcagLevel & { pass: boolean };

export const WCAG_LEVELS: readonly WcagLevel[] = [
  { id: 'aa-normal', title: 'AA · Normal text', meta: 'Requires 4.5:1', min: 4.5 },
  { id: 'aa-large', title: 'AA · Large text', meta: 'Requires 3:1 (18pt / 14pt bold)', min: 3 },
  { id: 'aaa-normal', title: 'AAA · Normal text', meta: 'Requires 7:1', min: 7 },
  { id: 'aaa-large', title: 'AAA · Large text', meta: 'Requires 4.5:1', min: 4.5 },
  { id: 'ui', title: 'UI / Graphics', meta: 'Non-text contrast · 3:1', min: 3 },
] as const;

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function toHexChannel(channel: number): string {
  const value = Math.round(clamp01(channel) * 255);
  return value.toString(16).padStart(2, '0');
}

export function rgbToHex(color: Rgb): string {
  return `#${toHexChannel(color.r)}${toHexChannel(color.g)}${toHexChannel(color.b)}`.toUpperCase();
}

export function normalizeHex(value: string): string | null {
  let hex = String(value || '').trim().toUpperCase();
  if (!hex.startsWith('#')) hex = `#${hex}`;
  if (/^#[0-9A-F]{3}$/.test(hex)) {
    hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }
  if (!/^#[0-9A-F]{6}$/.test(hex)) return null;
  return hex;
}

export function hexToRgb(hex: string): Rgb | null {
  const normalized = normalizeHex(hex);
  if (!normalized) return null;
  return {
    r: parseInt(normalized.slice(1, 3), 16) / 255,
    g: parseInt(normalized.slice(3, 5), 16) / 255,
    b: parseInt(normalized.slice(5, 7), 16) / 255,
  };
}

/** Alpha-composite `fg` over `bg` (both in linear sRGB 0–1 channels). */
export function compositeOver(fg: Rgb, fgAlpha: number, bg: Rgb): Rgb {
  const a = clamp01(fgAlpha);
  return {
    r: fg.r * a + bg.r * (1 - a),
    g: fg.g * a + bg.g * (1 - a),
    b: fg.b * a + bg.b * (1 - a),
  };
}

function channelLuminance(c: number): number {
  const v = clamp01(c);
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(rgb: Rgb): number {
  return (
    0.2126 * channelLuminance(rgb.r) +
    0.7152 * channelLuminance(rgb.g) +
    0.0722 * channelLuminance(rgb.b)
  );
}

export function contrastRatio(fg: Rgb, bg: Rgb): number {
  const L1 = relativeLuminance(fg);
  const L2 = relativeLuminance(bg);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Contrast between foreground and background.
 * If `fgOpacity` < 1, composites fg over bg before measuring (WCAG-friendly for translucent text/icons).
 */
export function contrastRatioWithOpacity(fg: Rgb, bg: Rgb, fgOpacity = 1): number {
  const effectiveFg = fgOpacity >= 1 - 1e-6 ? fg : compositeOver(fg, fgOpacity, bg);
  return contrastRatio(effectiveFg, bg);
}

export function evaluateWcag(ratio: number): WcagResult[] {
  return WCAG_LEVELS.map((level) => ({
    ...level,
    pass: ratio >= level.min,
  }));
}
