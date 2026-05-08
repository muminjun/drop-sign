import SignaturePad from 'signature_pad';

export interface SignaturePadModal {
  open(): void;
  destroy(): void;
}

export function createSignaturePadModal(
  onUse: (dataUrl: string) => void,
  onCancel: () => void,
): SignaturePadModal {
  let backdrop: HTMLElement | null = null;
  let pad: SignaturePad | null = null;

  function open() {
    backdrop = document.createElement('div');
    backdrop.className = 'ds-modal-backdrop';

    const modal = document.createElement('div');
    modal.className = 'ds-modal';

    const title = document.createElement('p');
    title.className = 'ds-modal-title';
    title.textContent = 'Draw your signature';

    const canvas = document.createElement('canvas') as HTMLCanvasElement;
    canvas.className = 'ds-canvas';
    canvas.width = 480;
    canvas.height = 200;

    const actions = document.createElement('div');
    actions.className = 'ds-modal-actions';

    const clearBtn = document.createElement('button');
    clearBtn.className = 'ds-btn-clear';
    clearBtn.textContent = 'Clear';
    clearBtn.type = 'button';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'ds-btn-cancel';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.type = 'button';

    const useBtn = document.createElement('button');
    useBtn.className = 'ds-btn-use';
    useBtn.textContent = 'Use signature';
    useBtn.type = 'button';

    actions.append(clearBtn, cancelBtn, useBtn);
    modal.append(title, canvas, actions);
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    pad = new SignaturePad(canvas, { backgroundColor: 'rgba(0,0,0,0)' });

    clearBtn.addEventListener('click', () => pad?.clear());

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
    pad?.off();
    pad = null;
    backdrop?.remove();
    backdrop = null;
  }

  return { open, destroy };
}
