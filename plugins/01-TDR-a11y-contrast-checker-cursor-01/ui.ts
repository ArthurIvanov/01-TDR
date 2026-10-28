import {
  contrastRatioWithOpacity,
  evaluateWcag,
  hexToRgb,
  normalizeHex,
} from './contrast';
import type { ColorPayload, SelectionColorsMessage } from './messages';

const fgColor = document.getElementById('fgColor') as HTMLInputElement;
const bgColor = document.getElementById('bgColor') as HTMLInputElement;
const fgHex = document.getElementById('fgHex') as HTMLInputElement;
const bgHex = document.getElementById('bgHex') as HTMLInputElement;
const fgMeta = document.getElementById('fgMeta') as HTMLElement;
const bgMeta = document.getElementById('bgMeta') as HTMLElement;
const preview = document.getElementById('preview') as HTMLElement;
const ratioEl = document.getElementById('ratio') as HTMLElement;
const checksEl = document.getElementById('checks') as HTMLElement;
const hintEl = document.getElementById('hint') as HTMLElement;
const errorEl = document.getElementById('error') as HTMLElement;
const followEl = document.getElementById('followSelection') as HTMLInputElement;

let fgOpacity = 1;
let bgOpacity = 1;
/** When true, selection updates overwrite color fields. */
let followSelection = true;

function post(message: { type: string }): void {
  parent.postMessage({ pluginMessage: message }, '*');
}

function setError(message: string): void {
  if (!message) {
    errorEl.hidden = true;
    errorEl.textContent = '';
    return;
  }
  errorEl.hidden = false;
  errorEl.textContent = message;
}

function bindingLabel(payload: ColorPayload | null, fallbackOpacity: number): string {
  if (!payload) {
    return fallbackOpacity < 0.999 ? `Manual · opacity ${Math.round(fallbackOpacity * 100)}%` : 'Manual';
  }
  const opacityNote =
    payload.opacity < 0.999 ? ` · ${Math.round(payload.opacity * 100)}%` : '';
  if (payload.binding.kind === 'variable') {
    return `Variable · ${payload.binding.name ?? 'unnamed'}${opacityNote}`;
  }
  if (payload.binding.kind === 'style') {
    return `Style · ${payload.binding.name ?? 'unnamed'}${opacityNote}`;
  }
  return `Unbound raw${opacityNote}`;
}

function renderMeta(el: HTMLElement, payload: ColorPayload | null, opacity: number): void {
  el.textContent = bindingLabel(payload, opacity);
  el.dataset.kind = payload?.binding.kind ?? 'manual';
}

function renderChecks(ratio: number): void {
  const results = evaluateWcag(ratio);
  checksEl.innerHTML = results
    .map((level) => {
      return `
        <div class="check">
          <div>
            <div class="check-title">${level.title}</div>
            <div class="check-meta">${level.meta}</div>
          </div>
          <span class="status ${level.pass ? 'pass' : 'fail'}">${level.pass ? 'Pass' : 'Fail'}</span>
        </div>
      `;
    })
    .join('');
}

function update(): void {
  const fg = normalizeHex(fgHex.value);
  const bg = normalizeHex(bgHex.value);
  const fgRgb = fg ? hexToRgb(fg) : null;
  const bgRgb = bg ? hexToRgb(bg) : null;

  if (!fg || !bg || !fgRgb || !bgRgb) {
    setError('Enter valid hex colors, e.g. #1A1A1A');
    return;
  }

  setError('');
  fgHex.value = fg;
  bgHex.value = bg;
  fgColor.value = fg.toLowerCase();
  bgColor.value = bg.toLowerCase();

  preview.style.color = fg;
  preview.style.background = bg;

  const ratio = contrastRatioWithOpacity(fgRgb, bgRgb, fgOpacity);
  ratioEl.textContent = `${ratio.toFixed(2)}:1`;
  renderChecks(ratio);
}

function pauseFollow(): void {
  if (!followSelection) return;
  followSelection = false;
  followEl.checked = false;
}

function applyPayload(
  which: 'fg' | 'bg',
  payload: ColorPayload | null,
): void {
  if (!payload) return;
  if (which === 'fg') {
    fgHex.value = payload.hex;
    fgColor.value = payload.hex.toLowerCase();
    fgOpacity = payload.opacity;
    renderMeta(fgMeta, payload, fgOpacity);
  } else {
    bgHex.value = payload.hex;
    bgColor.value = payload.hex.toLowerCase();
    bgOpacity = payload.opacity;
    renderMeta(bgMeta, payload, bgOpacity);
  }
}

function bindPair(colorInput: HTMLInputElement, hexInput: HTMLInputElement, which: 'fg' | 'bg'): void {
  colorInput.addEventListener('input', () => {
    pauseFollow();
    hexInput.value = colorInput.value.toUpperCase();
    if (which === 'fg') {
      fgOpacity = 1;
      renderMeta(fgMeta, null, fgOpacity);
    } else {
      bgOpacity = 1;
      renderMeta(bgMeta, null, bgOpacity);
    }
    update();
  });

  hexInput.addEventListener('input', () => {
    pauseFollow();
    const normalized = normalizeHex(hexInput.value);
    if (normalized) {
      colorInput.value = normalized.toLowerCase();
      if (which === 'fg') {
        fgOpacity = 1;
        renderMeta(fgMeta, null, fgOpacity);
      } else {
        bgOpacity = 1;
        renderMeta(bgMeta, null, bgOpacity);
      }
      update();
    } else {
      setError('Enter valid hex colors, e.g. #1A1A1A');
    }
  });

  hexInput.addEventListener('blur', () => {
    const normalized = normalizeHex(hexInput.value);
    if (normalized) {
      hexInput.value = normalized;
      colorInput.value = normalized.toLowerCase();
      update();
    }
  });
}

bindPair(fgColor, fgHex, 'fg');
bindPair(bgColor, bgHex, 'bg');

document.getElementById('swap')!.addEventListener('click', () => {
  pauseFollow();
  const prevFg = fgHex.value;
  const prevFgOpacity = fgOpacity;
  const prevFgMeta = fgMeta.textContent;
  const prevFgKind = fgMeta.dataset.kind;

  fgHex.value = bgHex.value;
  fgOpacity = bgOpacity;
  fgMeta.textContent = bgMeta.textContent;
  fgMeta.dataset.kind = bgMeta.dataset.kind ?? 'manual';

  bgHex.value = prevFg;
  bgOpacity = prevFgOpacity;
  bgMeta.textContent = prevFgMeta;
  bgMeta.dataset.kind = prevFgKind ?? 'manual';

  update();
});

followEl.addEventListener('change', () => {
  followSelection = followEl.checked;
  if (followSelection) post({ type: 'request-selection' });
});

document.getElementById('fromSelection')!.addEventListener('click', () => {
  followSelection = true;
  followEl.checked = true;
  post({ type: 'request-selection' });
});

document.getElementById('close')!.addEventListener('click', () => {
  post({ type: 'close' });
});

window.onmessage = (event: MessageEvent) => {
  const msg = event.data?.pluginMessage as SelectionColorsMessage | undefined;
  if (!msg || msg.type !== 'selection-colors') return;

  if (msg.hint) hintEl.textContent = msg.hint;

  if (!followSelection) return;

  applyPayload('fg', msg.foreground);
  applyPayload('bg', msg.background);
  update();
};

renderMeta(fgMeta, null, fgOpacity);
renderMeta(bgMeta, null, bgOpacity);
update();
post({ type: 'ready' });
