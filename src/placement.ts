import type { SignaturePlacement } from './types.js';

export interface PlacementBox {
  element: HTMLElement;
  getPlacement(): SignaturePlacement;
  destroy(): void;
}

export function createPlacementBox(
  signatureDataUrl: string,
  targetEl: HTMLElement,
  onConfirm: () => void,
  onDelete: () => void,
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
  deleteBtn.textContent = 'Delete';
  deleteBtn.type = 'button';

  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'ds-sig-confirm';
  confirmBtn.textContent = 'Confirm';
  confirmBtn.type = 'button';

  controls.append(deleteBtn, confirmBtn);

  const seHandle = resizeHandle('ds-resize-se');
  const swHandle = resizeHandle('ds-resize-sw');
  const neHandle = resizeHandle('ds-resize-ne');
  const nwHandle = resizeHandle('ds-resize-nw');

  box.append(controls, img, seHandle, swHandle, neHandle, nwHandle);

  const targetRect = targetEl.getBoundingClientRect();
  const initW = Math.min(200, targetRect.width * 0.4);
  const initH = 80;

  box.style.left = `${(targetRect.width - initW) / 2}px`;
  box.style.top = `${(targetRect.height - initH) / 2}px`;
  box.style.width = `${initW}px`;
  box.style.height = `${initH}px`;

  setupDrag(box, targetEl);
  setupResize(box, seHandle, targetEl, 1, 1);
  setupResize(box, swHandle, targetEl, -1, 1);
  setupResize(box, neHandle, targetEl, 1, -1);
  setupResize(box, nwHandle, targetEl, -1, -1);

  deleteBtn.addEventListener('click', () => {
    box.remove();
    onDelete();
  });

  confirmBtn.addEventListener('click', onConfirm);

  document.addEventListener('keydown', handleKeydown);

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') onConfirm();
    if (e.key === 'Escape') {
      box.remove();
      onDelete();
    }
  }

  function getPlacement(): SignaturePlacement {
    const rect = targetEl.getBoundingClientRect();
    return {
      x: parseFloat(box.style.left),
      y: parseFloat(box.style.top),
      width: parseFloat(box.style.width),
      height: parseFloat(box.style.height),
      targetWidth: rect.width,
      targetHeight: rect.height,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
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

function setupDrag(box: HTMLElement, container: HTMLElement) {
  let startX = 0, startY = 0, startLeft = 0, startTop = 0;
  let dragging = false;

  box.addEventListener('mousedown', (e) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('ds-resize-handle') ||
        target.tagName === 'BUTTON' ||
        target.tagName === 'IMG') return;
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    startLeft = parseFloat(box.style.left) || 0;
    startTop = parseFloat(box.style.top) || 0;
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const containerRect = container.getBoundingClientRect();
    const boxW = parseFloat(box.style.width) || 0;
    const boxH = parseFloat(box.style.height) || 0;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const newLeft = Math.max(0, Math.min(containerRect.width - boxW, startLeft + dx));
    const newTop = Math.max(0, Math.min(containerRect.height - boxH, startTop + dy));
    box.style.left = `${newLeft}px`;
    box.style.top = `${newTop}px`;
  });

  document.addEventListener('mouseup', () => { dragging = false; });
}

function setupResize(
  box: HTMLElement,
  handle: HTMLElement,
  container: HTMLElement,
  dirX: number,
  dirY: number,
) {
  let resizing = false;
  let startX = 0, startY = 0;
  let startW = 0, startH = 0, startLeft = 0, startTop = 0;

  handle.addEventListener('mousedown', (e) => {
    resizing = true;
    startX = e.clientX;
    startY = e.clientY;
    startW = parseFloat(box.style.width) || 0;
    startH = parseFloat(box.style.height) || 0;
    startLeft = parseFloat(box.style.left) || 0;
    startTop = parseFloat(box.style.top) || 0;
    e.preventDefault();
    e.stopPropagation();
  });

  document.addEventListener('mousemove', (e) => {
    if (!resizing) return;
    const containerRect = container.getBoundingClientRect();
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

    newW = Math.min(newW, containerRect.width - newLeft);
    newH = Math.min(newH, containerRect.height - newTop);

    box.style.width = `${newW}px`;
    box.style.height = `${newH}px`;
    box.style.left = `${newLeft}px`;
    box.style.top = `${newTop}px`;
  });

  document.addEventListener('mouseup', () => { resizing = false; });
}
