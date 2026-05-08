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
import { captureResult } from './capture.js';
import { mergeMessages, mergeSignatureOptions } from './messages.js';
import { createFloatingTrigger, createInlineTrigger, attachCustomTrigger } from './trigger.js';
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
  buttonText: string | undefined,
  msgs: Required<DropSignMessages>,
): string {
  if (trigger && 'label' in trigger && trigger.label) return trigger.label;
  if (buttonText !== undefined) return buttonText;
  return msgs.sign;
}

export class DropSign {
  static init(options: DropSignOptions): DropSignWidget {
    const {
      target,
      buttonText,
      trigger,
      messages,
      signature,
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

    const msgs = mergeMessages(messages);
    const sigOpts = mergeSignatureOptions(signature);
    const label = resolveTriggerLabel(trigger, buttonText, msgs);

    const existingPos = window.getComputedStyle(targetEl).position;
    if (existingPos === 'static') targetEl.style.position = 'relative';

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
      msgs,
      sigOpts,
    );

    let triggerHandle: TriggerHandle;
    try {
      if (!trigger || !trigger.type || trigger.type === 'floating') {
        triggerHandle = createFloatingTrigger(
          trigger ?? {},
          label,
          () => modal.open(),
          targetEl,
        );
      } else if (trigger.type === 'inline') {
        triggerHandle = createInlineTrigger(trigger, label, () => modal.open());
      } else if (trigger.type === 'custom') {
        triggerHandle = attachCustomTrigger(trigger, () => modal.open());
      } else {
        throw new Error(`[drop-sign] Unknown trigger type`);
      }
    } catch (err) {
      modal.destroy();
      removeStyles();
      if (existingPos === 'static') targetEl.style.position = '';
      onError?.(err);
      return { destroy: () => undefined };
    }

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
          if (overlayContainer) overlayContainer.el.style.display = 'none';
          try {
            const result = await captureResult(
              targetEl,
              currentSigDataUrl,
              placement,
              captureOptions,
            );
            cleanup();
            await onComplete?.(result);
          } catch (err) {
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
      if (existingPos === 'static') targetEl.style.position = '';
    }

    return { destroy };
  }
}
