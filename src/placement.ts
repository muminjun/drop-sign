import type { NormalizedPlacement } from './types.js';

export interface PlacementBox {
  element: HTMLElement;
  getPlacement(): NormalizedPlacement;
  destroy(): void;
}

export function createPlacementBox(
  signatureDataUrl: string,
  targetEl: HTMLElement | undefined,
  onConfirm: () => void,
  onDelete: () => void,
  messages: { confirm: string; delete: string },
): PlacementBox {
  const box = document.createElement('div');
  box.className = 'ds-sig-box';

  const img = document.createElement('img');
  img.className = 'ds-sig-img';
  img.src = signatureDataUrl;
  img.alt = 'Signature';

  const controls = document.createElement('div');
  controls.className = 'ds-sig-controls';

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'ds-sig-delete';
  deleteBtn.textContent = messages.delete;
  deleteBtn.type = 'button';

  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'ds-sig-confirm';
  confirmBtn.textContent = messages.confirm;
  confirmBtn.type = 'button';

  controls.append(deleteBtn, confirmBtn);

  const seHandle = resizeHandle('ds-resize-se');
  const swHandle = resizeHandle('ds-resize-sw');
  const neHandle = resizeHandle('ds-resize-ne');
  const nwHandle = resizeHandle('ds-resize-nw');

  box.append(controls, img, seHandle, swHandle, neHandle, nwHandle);

  const initW = Math.min(200, window.innerWidth * 0.25);
  const initH = 80;
  box.style.left = `${(window.innerWidth - initW) / 2}px`;
  box.style.top = `${(window.innerHeight - initH) / 2}px`;
  box.style.width = `${initW}px`;
  box.style.height = `${initH}px`;

  setupDrag(box);
  setupResize(box, seHandle, 1, 1);
  setupResize(box, swHandle, -1, 1);
  setupResize(box, neHandle, 1, -1);
  setupResize(box, nwHandle, -1, -1);

  deleteBtn.addEventListener('click', () => {
    destroy();
    onDelete();
  });

  confirmBtn.addEventListener('click', onConfirm);

  document.addEventListener('keydown', handleKeydown);

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') onConfirm();
    if (e.key === 'Escape') {
      destroy();
      onDelete();
    }
  }

  function getPlacement(): NormalizedPlacement {
    const boxLeft = parseFloat(box.style.left);
    const boxTop  = parseFloat(box.style.top);
    const boxW    = parseFloat(box.style.width);
    const boxH    = parseFloat(box.style.height);

    if (targetEl) {
      const rect = targetEl.getBoundingClientRect();
      return {
        x:      (boxLeft - rect.left) / rect.width,
        y:      (boxTop  - rect.top)  / rect.height,
        width:  boxW / rect.width,
        height: boxH / rect.height,
      };
    }

    return {
      x:      boxLeft / window.innerWidth,
      y:      boxTop  / window.innerHeight,
      width:  boxW    / window.innerWidth,
      height: boxH    / window.innerHeight,
    };
  }

  function destroy() {
    document.removeEventListener('keydown', handleKeydown);
    box.remove();
  }

  return { element: box, getPlacement, destroy };
}

function resizeHandle(cls: string): HTMLElement {
  const el = document.createElement('div');
  el.className = `ds-resize-handle ${cls}`;
  return el;
}

function setupDrag(box: HTMLElement) {
  let dragging = false;
  let startX = 0, startY = 0, startLeft = 0, startTop = 0;

  box.addEventListener('pointerdown', (e) => {
    const target = e.target as HTMLElement;
    if (
      target.classList.contains('ds-resize-handle') ||
      target.tagName === 'BUTTON' ||
      target.tagName === 'IMG'
    ) return;
    dragging = true;
    box.setPointerCapture(e.pointerId);
    startX = e.clientX;
    startY = e.clientY;
    startLeft = parseFloat(box.style.left) || 0;
    startTop = parseFloat(box.style.top) || 0;
    e.preventDefault();
  });

  box.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const boxW = parseFloat(box.style.width) || 0;
    const boxH = parseFloat(box.style.height) || 0;
    const newLeft = Math.max(0, Math.min(window.innerWidth  - boxW, startLeft + e.clientX - startX));
    const newTop  = Math.max(0, Math.min(window.innerHeight - boxH, startTop  + e.clientY - startY));
    box.style.left = `${newLeft}px`;
    box.style.top  = `${newTop}px`;
  });

  box.addEventListener('pointerup', () => { dragging = false; });
  box.addEventListener('pointercancel', () => { dragging = false; });
}

function setupResize(
  box: HTMLElement,
  handle: HTMLElement,
  dirX: number,
  dirY: number,
) {
  let resizing = false;
  let startX = 0, startY = 0;
  let startW = 0, startH = 0, startLeft = 0, startTop = 0;

  handle.addEventListener('pointerdown', (e) => {
    resizing = true;
    handle.setPointerCapture(e.pointerId);
    startX = e.clientX;
    startY = e.clientY;
    startW = parseFloat(box.style.width) || 0;
    startH = parseFloat(box.style.height) || 0;
    startLeft = parseFloat(box.style.left) || 0;
    startTop = parseFloat(box.style.top) || 0;
    e.preventDefault();
    e.stopPropagation();
  });

  handle.addEventListener('pointermove', (e) => {
    if (!resizing) return;
    const dx = (e.clientX - startX) * dirX;
    const dy = (e.clientY - startY) * dirY;

    let newW = Math.max(60, startW + dx);
    let newH = Math.max(30, startH + dy);
    let newLeft = startLeft;
    let newTop = startTop;

    if (dirX === -1) {
      newLeft = startLeft - (newW - startW);
      newLeft = Math.max(0, newLeft);
      newW = startLeft + startW - newLeft;
    }
    if (dirY === -1) {
      newTop = startTop - (newH - startH);
      newTop = Math.max(0, newTop);
      newH = startTop + startH - newTop;
    }

    newW = Math.min(newW, window.innerWidth  - newLeft);
    newH = Math.min(newH, window.innerHeight - newTop);

    box.style.width  = `${newW}px`;
    box.style.height = `${newH}px`;
    box.style.left   = `${newLeft}px`;
    box.style.top    = `${newTop}px`;
  });

  handle.addEventListener('pointerup', () => { resizing = false; });
  handle.addEventListener('pointercancel', () => { resizing = false; });
}
