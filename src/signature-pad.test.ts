import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSignaturePadModal } from './signature-pad.js';
import { mergeMessages, mergeSignatureOptions } from './messages.js';

interface MockSignaturePadInstance {
  canvas: HTMLCanvasElement;
  clear: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  isEmpty: ReturnType<typeof vi.fn>;
  toDataURL: ReturnType<typeof vi.fn>;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject | null): void;
  emit(type: string): void;
  setEmpty(empty: boolean): void;
}

const signaturePadMock = vi.hoisted(() => ({
  instances: [] as MockSignaturePadInstance[],
}));

vi.mock('signature_pad', () => {
  class MockSignaturePad implements MockSignaturePadInstance {
    canvas: HTMLCanvasElement;
    clear = vi.fn(() => {
      this.empty = true;
    });
    off = vi.fn();
    isEmpty = vi.fn(() => this.empty);
    toDataURL = vi.fn(() => 'data:image/png;base64,signature');
    private empty = true;
    private listeners = new Map<string, EventListenerOrEventListenerObject[]>();

    constructor(canvas: HTMLCanvasElement) {
      this.canvas = canvas;
      signaturePadMock.instances.push(this);
    }

    addEventListener(type: string, listener: EventListenerOrEventListenerObject | null): void {
      if (!listener) return;
      const listeners = this.listeners.get(type) ?? [];
      listeners.push(listener);
      this.listeners.set(type, listeners);
    }

    emit(type: string): void {
      const event = new Event(type);
      for (const listener of this.listeners.get(type) ?? []) {
        if (typeof listener === 'function') {
          listener(event);
        } else {
          listener.handleEvent(event);
        }
      }
    }

    setEmpty(empty: boolean): void {
      this.empty = empty;
    }
  }

  return { default: MockSignaturePad };
});

function rect(width: number, height: number): DOMRect {
  return {
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: width,
    bottom: height,
    width,
    height,
    toJSON: () => ({}),
  } as DOMRect;
}

function openModal(messages = mergeMessages()) {
  const onUse = vi.fn();
  const onCancel = vi.fn();
  const modal = createSignaturePadModal(
    onUse,
    onCancel,
    messages,
    mergeSignatureOptions(),
  );

  modal.open();

  const pad = signaturePadMock.instances[signaturePadMock.instances.length - 1]!;
  const useBtn = document.querySelector<HTMLButtonElement>('.ds-btn-use')!;
  const clearBtn = document.querySelector<HTMLButtonElement>('.ds-btn-clear')!;
  const canvas = document.querySelector<HTMLCanvasElement>('.ds-canvas')!;

  return { modal, onUse, onCancel, pad, useBtn, clearBtn, canvas };
}

beforeEach(() => {
  document.body.innerHTML = '';
  signaturePadMock.instances.length = 0;
  vi.restoreAllMocks();
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue(rect(300, 125));
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    scale: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true });
});

describe('createSignaturePadModal', () => {
  it('opens with Use signature disabled while the pad is empty', () => {
    const { modal, useBtn } = openModal();

    expect(useBtn.disabled).toBe(true);
    expect(document.querySelector('.ds-empty-hint')?.textContent).toBe('Draw a signature to continue.');

    modal.destroy();
  });

  it('uses localized empty-state hint copy from messages', () => {
    const { modal } = openModal(
      mergeMessages({ emptySignatureHint: '서명을 입력해야 계속할 수 있습니다.' }),
    );

    expect(document.querySelector('.ds-empty-hint')?.textContent).toBe(
      '서명을 입력해야 계속할 수 있습니다.',
    );

    modal.destroy();
  });

  it('enables Use signature after a stroke ends', () => {
    const { modal, pad, useBtn } = openModal();

    pad.setEmpty(false);
    pad.emit('endStroke');

    expect(useBtn.disabled).toBe(false);
    expect(document.querySelector<HTMLElement>('.ds-empty-hint')?.hidden).toBe(true);

    modal.destroy();
  });

  it('disables Use signature again after clearing', () => {
    const { modal, pad, useBtn, clearBtn } = openModal();
    pad.setEmpty(false);
    pad.emit('endStroke');
    expect(useBtn.disabled).toBe(false);

    clearBtn.click();

    expect(pad.clear).toHaveBeenCalled();
    expect(useBtn.disabled).toBe(true);
    expect(document.querySelector<HTMLElement>('.ds-empty-hint')?.hidden).toBe(false);

    modal.destroy();
  });

  it('does not call onUse when the pad is empty', () => {
    const { modal, onUse, useBtn } = openModal();

    useBtn.disabled = false;
    useBtn.click();

    expect(onUse).not.toHaveBeenCalled();

    modal.destroy();
  });

  it('sizes the canvas backing store from displayed dimensions and device pixel ratio', () => {
    const { modal, canvas } = openModal();

    expect(canvas.width).toBe(600);
    expect(canvas.height).toBe(250);

    modal.destroy();
  });

  it('does not clear a non-empty signature on window resize', () => {
    const { modal, pad } = openModal();
    pad.clear.mockClear();
    pad.setEmpty(false);

    window.dispatchEvent(new Event('resize'));

    expect(pad.clear).not.toHaveBeenCalled();

    modal.destroy();
  });
});
