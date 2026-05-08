import type {
  DropSignOptions,
  DropSignTarget,
  DropSignWidget,
  DropSignTrigger,
  DropSignMessages,
} from './types.js';
import { injectStyles, removeStyles, createOverlayContainer } from './overlay.js';
import { createSignaturePadModal } from './signature-pad.js';
import { createPlacementBox } from './placement.js';
import { mergeMessages, mergeSignatureOptions } from './messages.js';
import { createGlobalTrigger, attachCustomTrigger } from './trigger.js';
import type { TriggerHandle } from './trigger.js';

function resolveTarget(target: DropSignTarget): HTMLElement {
  if (typeof target === 'string') {
    const el = document.querySelector(target);
    if (!el) throw new Error(`[drop-sign] Target element not found: "${target}"`);
    if (!(el instanceof HTMLElement))
      throw new Error(`[drop-sign] Target is not an HTMLElement: "${target}"`);
    return el;
  }
  return target;
}

function resolveTriggerLabel(
  trigger: DropSignTrigger | undefined,
  msgs: Required<DropSignMessages>,
): string {
  if (trigger && 'label' in trigger && trigger.label) return trigger.label;
  return msgs.sign;
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

export class DropSign {
  static init(options: DropSignOptions): DropSignWidget {
    const { target, trigger, messages, signature, onComplete, onCancel, onError } = options;

    let targetEl: HTMLElement | undefined;
    if (target !== undefined) {
      try {
        targetEl = resolveTarget(target);
      } catch (err) {
        onError?.(err);
        return { destroy: () => undefined };
      }
    }

    injectStyles();

    const msgs = mergeMessages(messages);
    const sigOpts = mergeSignatureOptions(signature);
    const label = resolveTriggerLabel(trigger, msgs);

    let overlayContainer: ReturnType<typeof createOverlayContainer> | null = null;
    let placementBox: ReturnType<typeof createPlacementBox> | null = null;
    let currentSigDataUrl = '';

    const modal = createSignaturePadModal(
      (dataUrl) => {
        currentSigDataUrl = dataUrl;
        showPlacement(dataUrl);
      },
      () => { onCancel?.(); },
      msgs,
      sigOpts,
    );

    let triggerHandle: TriggerHandle;
    try {
      if (!trigger || trigger.type === 'global') {
        const globalTrigger: Extract<DropSignTrigger, { type: 'global' }> =
          trigger?.type === 'global' ? trigger : { type: 'global' };
        triggerHandle = createGlobalTrigger(globalTrigger, label, () => modal.open());
      } else if (trigger.type === 'custom') {
        triggerHandle = attachCustomTrigger(trigger, () => modal.open());
      } else {
        throw new Error(`[drop-sign] Unknown trigger type`);
      }
    } catch (err) {
      modal.destroy();
      removeStyles();
      onError?.(err);
      return { destroy: () => undefined };
    }

    function showPlacement(dataUrl: string) {
      overlayContainer?.destroy();
      overlayContainer = createOverlayContainer();

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
          cleanup();
          try {
            const signatureBlob = await dataUrlToBlob(currentSigDataUrl);
            await onComplete?.({ signatureDataUrl: currentSigDataUrl, signatureBlob, placement });
          } catch (err) {
            onError?.(err);
          }
        },
        () => {
          placementBox = null;
          overlayContainer?.destroy();
          overlayContainer = null;
          onCancel?.();
        },
        { confirm: msgs.confirm, delete: msgs.delete },
      );

      overlayContainer.el.style.pointerEvents = 'all';
      overlayContainer.el.appendChild(placementBox.element);
    }

    function destroy() {
      triggerHandle.destroy();
      modal.destroy();
      placementBox?.destroy();
      overlayContainer?.destroy();
      removeStyles();
    }

    return { destroy };
  }
}
