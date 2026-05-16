import SignaturePad from 'signature_pad';
import type { DropSignMessages, DropSignSignatureOptions } from './types.js';

export interface SignaturePadModal {
  open(): void;
  destroy(): void;
}

export function createSignaturePadModal(
  onUse: (dataUrl: string) => void,
  onCancel: () => void,
  messages: Required<DropSignMessages>,
  signatureOptions: Required<DropSignSignatureOptions>,
): SignaturePadModal {
  let backdrop: HTMLElement | null = null;
  let pad: SignaturePad | null = null;

  const FALLBACK_CANVAS_WIDTH = 480;
  const FALLBACK_CANVAS_HEIGHT = 200;
  let resizeHandler: (() => void) | null = null;

  function resizeCanvas(canvas: HTMLCanvasElement, currentPad: SignaturePad | null): void {
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const rect = canvas.getBoundingClientRect();
    const displayWidth = rect.width || FALLBACK_CANVAS_WIDTH;
    const displayHeight = rect.height || FALLBACK_CANVAS_HEIGHT;
    canvas.width = Math.round(displayWidth * ratio);
    canvas.height = Math.round(displayHeight * ratio);
    canvas.getContext('2d')?.scale(ratio, ratio);
    currentPad?.clear();
  }

  function open() {
    backdrop = document.createElement('div');
    backdrop.className = 'ds-modal-backdrop';

    const modal = document.createElement('div');
    modal.className = 'ds-modal';

    const title = document.createElement('p');
    title.className = 'ds-modal-title';
    title.textContent = messages.signingTitle;

    const description = document.createElement('p');
    description.className = 'ds-modal-description';
    description.textContent = messages.signingDescription;

    const canvas = document.createElement('canvas') as HTMLCanvasElement;
    canvas.className = 'ds-canvas';
    canvas.style.touchAction = 'none';
    canvas.width = 480;
    canvas.height = 200;

    const actions = document.createElement('div');
    actions.className = 'ds-modal-actions';

    const clearBtn = document.createElement('button');
    clearBtn.className = 'ds-btn-clear';
    clearBtn.textContent = messages.clear;
    clearBtn.type = 'button';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'ds-btn-cancel';
    cancelBtn.textContent = messages.cancel;
    cancelBtn.type = 'button';

    const useBtn = document.createElement('button');
    useBtn.className = 'ds-btn-use';
    useBtn.textContent = messages.useSignature;
    useBtn.type = 'button';

    const emptyHint = document.createElement('p');
    emptyHint.className = 'ds-empty-hint';
    emptyHint.textContent = messages.emptySignatureHint;

    let hasSignature = false;

    function setHasSignature(next: boolean): void {
      hasSignature = next;
      useBtn.disabled = !hasSignature;
      emptyHint.hidden = hasSignature;
    }

    setHasSignature(false);

    actions.append(clearBtn, cancelBtn, useBtn);
    modal.append(title, description, canvas, emptyHint, actions);
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    pad = new SignaturePad(canvas, {
      backgroundColor: 'rgba(0,0,0,0)',
      penColor: signatureOptions.penColor,
      minWidth: signatureOptions.minWidth,
      maxWidth: signatureOptions.maxWidth,
      velocityFilterWeight: signatureOptions.velocityFilterWeight,
    });

    resizeCanvas(canvas, pad);

    pad.addEventListener('beginStroke', () => {
      emptyHint.hidden = true;
    });

    pad.addEventListener('endStroke', () => {
      setHasSignature(Boolean(pad && !pad.isEmpty()));
    });

    resizeHandler = () => {
      if (!pad || !pad.isEmpty()) return;
      resizeCanvas(canvas, pad);
      setHasSignature(false);
    };
    window.addEventListener('resize', resizeHandler);

    clearBtn.addEventListener('click', () => {
      pad?.clear();
      setHasSignature(false);
    });

    cancelBtn.addEventListener('click', () => {
      destroy();
      onCancel();
    });

    useBtn.addEventListener('click', () => {
      if (!pad || pad.isEmpty()) return;
      const dataUrl = pad.toDataURL('image/png');
      destroy();
      onUse(dataUrl);
    });

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        destroy();
        onCancel();
      }
    });
  }

  function destroy() {
    if (resizeHandler) {
      window.removeEventListener('resize', resizeHandler);
      resizeHandler = null;
    }
    pad?.off();
    pad = null;
    backdrop?.remove();
    backdrop = null;
  }

  return { open, destroy };
}
