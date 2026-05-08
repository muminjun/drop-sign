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

export function createOverlayContainer(targetEl: HTMLElement): OverlayContainer {
  const targetRect = targetEl.getBoundingClientRect();
  const computedPos = window.getComputedStyle(targetEl).position;
  if (computedPos === 'static') {
    targetEl.style.position = 'relative';
  }

  const el = document.createElement('div');
  el.className = 'ds-placement-overlay';
  el.style.position = 'absolute';
  el.style.inset = '0';
  el.style.zIndex = '9998';
  el.style.overflow = 'hidden';
  el.style.pointerEvents = 'none';

  void targetRect;

  targetEl.appendChild(el);

  function destroy() {
    el.remove();
    if (computedPos === 'static') {
      targetEl.style.position = '';
    }
  }

  return { el, destroy };
}
