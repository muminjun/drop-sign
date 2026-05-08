import type { DropSignTrigger } from './types.js';

export interface TriggerHandle {
  element: HTMLElement | null;
  destroy(): void;
}

function resolveElement(ref: string | HTMLElement): HTMLElement | null {
  if (typeof ref === 'string') {
    const el = document.querySelector(ref);
    return el instanceof HTMLElement ? el : null;
  }
  return ref;
}

function applyPositionStyles(
  btn: HTMLElement,
  position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' = 'bottom-right',
): void {
  const isBottom = position.startsWith('bottom');
  const isRight = position.endsWith('right');
  btn.style.bottom = isBottom ? '24px' : 'auto';
  btn.style.top = isBottom ? 'auto' : '24px';
  btn.style.right = isRight ? '24px' : 'auto';
  btn.style.left = isRight ? 'auto' : '24px';
}

export function createGlobalTrigger(
  trigger: Extract<DropSignTrigger, { type: 'global' }>,
  label: string,
  onClick: () => void,
): TriggerHandle {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = label;
  btn.className = 'ds-button';
  applyPositionStyles(btn, trigger.position);
  document.body.appendChild(btn);
  btn.addEventListener('click', onClick);

  return {
    element: btn,
    destroy() {
      btn.removeEventListener('click', onClick);
      btn.remove();
    },
  };
}

export function attachCustomTrigger(
  trigger: Extract<DropSignTrigger, { type: 'custom' }>,
  onClick: () => void,
): TriggerHandle {
  const el = resolveElement(trigger.element);
  if (!el) {
    throw new Error('[drop-sign] Custom trigger element not found');
  }

  el.addEventListener('click', onClick);

  return {
    element: null,
    destroy() {
      el.removeEventListener('click', onClick);
    },
  };
}
