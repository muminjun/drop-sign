import type { DropSignOptions, DropSignTarget, DropSignWidget } from './types.js';
import { injectStyles, removeStyles, createOverlayContainer } from './overlay.js';
import { createSignaturePadModal } from './signature-pad.js';
import { createPlacementBox } from './placement.js';
import { captureResult } from './capture.js';

function resolveTarget(target: DropSignTarget): HTMLElement {
  if (typeof target === 'string') {
    const el = document.querySelector(target);
    if (!el) throw new Error(`[drop-sign] Target element not found: "${target}"`);
    if (!(el instanceof HTMLElement)) throw new Error(`[drop-sign] Target is not an HTMLElement: "${target}"`);
    return el;
  }
  return target;
}

export class DropSign {
  static init(options: DropSignOptions): DropSignWidget {
    const {
      target,
      buttonText = 'Sign',
      onComplete,
      onCancel,
      onError,
      capture: captureOptions,
    } = options;

    let targetEl: HTMLElement;
    try {
      targetEl = resolveTarget(target);
    } catch (err) {
      onError?.(err);
      return { destroy: () => undefined };
    }

    injectStyles();

    const button = document.createElement('button');
    button.className = 'ds-button';
    button.textContent = buttonText;
    button.type = 'button';

    const existingPos = window.getComputedStyle(targetEl).position;
    if (existingPos === 'static') targetEl.style.position = 'relative';
    targetEl.appendChild(button);

    let overlayContainer: ReturnType<typeof createOverlayContainer> | null = null;
    let placementBox: ReturnType<typeof createPlacementBox> | null = null;
    let currentSigDataUrl = '';

    const modal = createSignaturePadModal(
      (dataUrl) => {
        currentSigDataUrl = dataUrl;
        showPlacement(dataUrl);
      },
      () => {
        onCancel?.();
      },
    );

    function showPlacement(dataUrl: string) {
      overlayContainer?.destroy();
      overlayContainer = createOverlayContainer(targetEl);

      function cleanup() {
        placementBox?.destroy();
        placementBox = null;
        overlayContainer?.destroy();
        overlayContainer = null;
      }

      placementBox = createPlacementBox(
        dataUrl,
        targetEl,
        async () => {
          if (!placementBox) return;
          const placement = placementBox.getPlacement();
          // Hide overlay before capture so dashed border/buttons don't appear in the PNG
          if (overlayContainer) overlayContainer.el.style.display = 'none';
          try {
            const result = await captureResult(
              targetEl,
              currentSigDataUrl,
              placement,
              captureOptions,
            );
            // Destroy overlay only after successful capture
            cleanup();
            await onComplete?.(result);
          } catch (err) {
            // On error, still clean up
            cleanup();
            onError?.(err);
          }
        },
        () => {
          placementBox = null;
          overlayContainer?.destroy();
          overlayContainer = null;
          onCancel?.();
        },
      );

      overlayContainer.el.style.pointerEvents = 'all';
      overlayContainer.el.appendChild(placementBox.element);
    }

    button.addEventListener('click', () => modal.open());

    function destroy() {
      button.remove();
      modal.destroy();
      placementBox?.destroy();
      overlayContainer?.destroy();
      removeStyles();
      if (existingPos === 'static') targetEl.style.position = '';
    }

    return { destroy };
  }
}
