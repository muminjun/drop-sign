import { STYLES } from './styles.js';

let styleInjected = false;
let styleEl: HTMLStyleElement | null = null;

export function injectStyles(): void {
  if (styleInjected) return;
  styleEl = document.createElement('style');
  styleEl.setAttribute('data-drop-sign', '');
  styleEl.textContent = STYLES;
  document.head.appendChild(styleEl);
  styleInjected = true;
}

export function removeStyles(): void {
  styleEl?.remove();
  styleEl = null;
  styleInjected = false;
}

export interface OverlayContainer {
  el: HTMLElement;
  destroy(): void;
}

export function createOverlayContainer(): OverlayContainer {
  const el = document.createElement('div');
  el.className = 'ds-placement-overlay';
  el.style.position = 'fixed';
  el.style.inset = '0';
  el.style.zIndex = '9998';
  el.style.pointerEvents = 'none';
  document.body.appendChild(el);

  return {
    el,
    destroy() {
      el.remove();
    },
  };
}
