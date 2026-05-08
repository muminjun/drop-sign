import type { DropSignTrigger } from './types.js';

export interface TriggerHandle {
  /** The created button element, or null for custom triggers. */
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

export function createFloatingTrigger(
  trigger: Extract<DropSignTrigger, { type?: 'floating' }>,
  label: string,
  onClick: () => void,
  targetEl: HTMLElement,
): TriggerHandle {
  const positionAnchor = trigger.positionAnchor ?? 'target';
  const position = trigger.position ?? 'bottom-right';
  const pressEffect = trigger.pressEffect !== false;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = label;
  applyPositionStyles(btn, position);
  if (!pressEffect) btn.dataset.noPress = '';

  if (positionAnchor === 'viewport') {
    btn.className = 'ds-button ds-button-viewport';
    document.body.appendChild(btn);
  } else {
    btn.className = 'ds-button';
    targetEl.appendChild(btn);
  }

  btn.addEventListener('click', onClick);

  return {
    element: btn,
    destroy() {
      btn.removeEventListener('click', onClick);
      btn.remove();
    },
  };
}

export function createInlineTrigger(
  trigger: Extract<DropSignTrigger, { type: 'inline' }>,
  label: string,
  onClick: () => void,
): TriggerHandle {
  const container = resolveElement(trigger.container);
  if (!container) {
    throw new Error('[drop-sign] Inline trigger container not found');
  }

  const variant = trigger.variant ?? 'button';
  const pressEffect = trigger.pressEffect !== false;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = label;
  btn.className =
    variant === 'text' ? 'ds-btn-inline ds-btn-inline--text' : 'ds-btn-inline';
  if (!pressEffect) btn.dataset.noPress = '';

  container.appendChild(btn);
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
      // Do NOT remove el — it belongs to the caller.
    },
  };
}
