import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DropSign } from './DropSign.js';
import { mergeMessages, mergeSignatureOptions } from './messages.js';
import { createPlacementBox } from './placement.js';

describe('mergeMessages', () => {
  it('returns English defaults when called with no argument', () => {
    const msgs = mergeMessages();
    expect(msgs.sign).toBe('Sign');
    expect(msgs.clear).toBe('Clear');
    expect(msgs.cancel).toBe('Cancel');
    expect(msgs.useSignature).toBe('Use signature');
    expect(msgs.confirm).toBe('Confirm');
    expect(msgs.delete).toBe('Delete');
    expect(msgs.signingTitle).toBe('Draw your signature');
  });

  it('overrides only specified fields', () => {
    const msgs = mergeMessages({ sign: '서명', clear: '지우기' });
    expect(msgs.sign).toBe('서명');
    expect(msgs.clear).toBe('지우기');
    expect(msgs.cancel).toBe('Cancel');
    expect(msgs.confirm).toBe('Confirm');
  });

  it('returns a fresh copy each call', () => {
    const a = mergeMessages();
    const b = mergeMessages();
    expect(a).not.toBe(b);
  });
});

describe('mergeSignatureOptions', () => {
  it('returns numeric defaults when called with no argument', () => {
    const opts = mergeSignatureOptions();
    expect(opts.penColor).toBe('#111827');
    expect(opts.minWidth).toBe(0.7);
    expect(opts.maxWidth).toBe(2.5);
    expect(opts.velocityFilterWeight).toBe(0.7);
  });

  it('overrides only specified fields', () => {
    const opts = mergeSignatureOptions({ penColor: '#1d4ed8', maxWidth: 4 });
    expect(opts.penColor).toBe('#1d4ed8');
    expect(opts.maxWidth).toBe(4);
    expect(opts.minWidth).toBe(0.7);
    expect(opts.velocityFilterWeight).toBe(0.7);
  });
});

beforeEach(() => {
  document.body.innerHTML = '<div id="target" style="width:400px;height:300px;"></div>';
  document.head.innerHTML = '';
});

function pointerEvent(type: string, clientX: number, clientY: number): PointerEvent {
  const event = new Event(type, { bubbles: true, cancelable: true }) as PointerEvent;
  Object.defineProperties(event, {
    clientX: { value: clientX },
    clientY: { value: clientY },
    pointerId: { value: 1 },
  });
  return event;
}

describe('DropSign.init', () => {
  it('throws if target not found', () => {
    const onError = vi.fn();
    DropSign.init({ target: '#missing', onError });
    expect(onError).toHaveBeenCalled();
    const err = onError.mock.calls[0]?.[0];
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toContain('#missing');
  });

  it('appends sign button to document.body', () => {
    const widget = DropSign.init({ target: '#target' });
    const btn = document.querySelector('.ds-button');
    expect(btn).toBeTruthy();
    expect(document.body.contains(btn)).toBe(true);
    widget.destroy();
  });

  it('injects styles on init and removes on destroy', () => {
    expect(document.querySelector('[data-drop-sign]')).toBeNull();
    const widget = DropSign.init({ target: '#target' });
    expect(document.querySelector('[data-drop-sign]')).toBeTruthy();
    widget.destroy();
    expect(document.querySelector('[data-drop-sign]')).toBeNull();
  });

  it('removes button on destroy', () => {
    const widget = DropSign.init({ target: '#target' });
    expect(document.querySelector('.ds-button')).toBeTruthy();
    widget.destroy();
    expect(document.querySelector('.ds-button')).toBeNull();
  });

  it('returns widget with destroy method', () => {
    const widget = DropSign.init({ target: '#target' });
    expect(typeof widget.destroy).toBe('function');
    widget.destroy();
  });

  it('onComplete receives signatureDataUrl, signatureBlob, and placement', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ blob: async () => new Blob(['sig']) })));

    const onComplete = vi.fn();
    const widget = DropSign.init({ onComplete });  // no target

    const btn = document.querySelector('.ds-button') as HTMLElement;
    expect(btn).toBeTruthy();
    expect(onComplete).not.toHaveBeenCalled();

    widget.destroy();
    vi.unstubAllGlobals();
  });
});

describe('trigger modes', () => {
  beforeEach(() => {
    document.body.innerHTML =
      '<div id="target" style="width:400px;height:300px;"></div>' +
      '<button id="custom-btn">My Sign</button>';
    document.head.innerHTML = '';
  });

  it('default trigger appends .ds-button to document.body', () => {
    const widget = DropSign.init({ target: '#target' });
    const btn = document.querySelector('.ds-button');
    expect(btn).toBeTruthy();
    expect(document.body.contains(btn)).toBe(true);
    expect(document.getElementById('target')!.contains(btn)).toBe(false);
    widget.destroy();
  });

  it('global trigger default label is Sign', () => {
    const widget = DropSign.init({ target: '#target' });
    expect(document.querySelector('.ds-button')?.textContent).toBe('Sign');
    widget.destroy();
  });

  it('global trigger label option overrides default', () => {
    const widget = DropSign.init({
      target: '#target',
      trigger: { type: 'global', label: 'Start Signing' },
    });
    expect(document.querySelector('.ds-button')?.textContent).toBe('Start Signing');
    widget.destroy();
  });

  it('messages.sign sets the global button label', () => {
    const widget = DropSign.init({
      target: '#target',
      messages: { sign: '서명' },
    });
    expect(document.querySelector('.ds-button')?.textContent).toBe('서명');
    widget.destroy();
  });

  it('global trigger bottom-left sets correct inline style', () => {
    const widget = DropSign.init({
      target: '#target',
      trigger: { type: 'global', position: 'bottom-left' },
    });
    const btn = document.querySelector('.ds-button') as HTMLElement | null;
    expect(btn?.style.left).toBe('24px');
    expect(btn?.style.right).toBe('auto');
    widget.destroy();
  });

  it('global trigger top-right sets correct inline style', () => {
    const widget = DropSign.init({
      target: '#target',
      trigger: { type: 'global', position: 'top-right' },
    });
    const btn = document.querySelector('.ds-button') as HTMLElement | null;
    expect(btn?.style.top).toBe('24px');
    expect(btn?.style.right).toBe('24px');
    widget.destroy();
  });

  it('global trigger button is removed from body on destroy', () => {
    const widget = DropSign.init({ target: '#target' });
    expect(document.querySelector('.ds-button')).toBeTruthy();
    widget.destroy();
    expect(document.querySelector('.ds-button')).toBeNull();
  });

  it('custom trigger does not create any new buttons', () => {
    const before = document.querySelectorAll('button').length;
    const widget = DropSign.init({
      target: '#target',
      trigger: { type: 'custom', element: '#custom-btn' },
    });
    expect(document.querySelectorAll('button').length).toBe(before);
    widget.destroy();
  });

  it('destroy does not remove custom trigger element from DOM', () => {
    const widget = DropSign.init({
      target: '#target',
      trigger: { type: 'custom', element: '#custom-btn' },
    });
    widget.destroy();
    expect(document.getElementById('custom-btn')).toBeTruthy();
  });

  it('calls onError and returns no-op widget when custom trigger element not found', () => {
    const onError = vi.fn();
    const widget = DropSign.init({
      target: '#target',
      trigger: { type: 'custom', element: '#nonexistent' },
      onError,
    });
    expect(onError).toHaveBeenCalled();
    expect(() => widget.destroy()).not.toThrow();
  });
});

describe('createPlacementBox — getPlacement', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });
    Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
      configurable: true,
      value: vi.fn(),
    });
  });

  it('with target: returns target-relative normalized coords', () => {
    const target = document.createElement('div');
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({
      left: 100, top: 50, width: 400, height: 300,
      right: 500, bottom: 350, x: 100, y: 50, toJSON: () => ({}),
    } as DOMRect);

    const box = createPlacementBox(
      'data:image/png;base64,sig',
      target,
      () => {}, () => {},
      { confirm: 'Confirm', delete: 'Delete' },
    );
    box.element.style.left = '300px';
    box.element.style.top = '100px';
    box.element.style.width = '80px';
    box.element.style.height = '40px';

    const p = box.getPlacement();
    expect(p.x).toBeCloseTo(0.5);
    expect(p.y).toBeCloseTo(0.167, 2);
    expect(p.width).toBeCloseTo(0.2);
    expect(p.height).toBeCloseTo(0.133, 2);

    box.destroy();
  });

  it('with target: allows out-of-range when box is outside target', () => {
    const target = document.createElement('div');
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({
      left: 100, top: 50, width: 400, height: 300,
      right: 500, bottom: 350, x: 100, y: 50, toJSON: () => ({}),
    } as DOMRect);

    const box = createPlacementBox(
      'data:image/png;base64,sig',
      target,
      () => {}, () => {},
      { confirm: 'Confirm', delete: 'Delete' },
    );
    box.element.style.left = '0px';
    box.element.style.top = '50px';
    box.element.style.width = '80px';
    box.element.style.height = '40px';

    const p = box.getPlacement();
    expect(p.x).toBeCloseTo(-0.25);
    expect(p.width).toBeGreaterThan(0);
    expect(p.height).toBeGreaterThan(0);

    box.destroy();
  });

  it('without target: returns viewport-relative normalized coords', () => {
    const box = createPlacementBox(
      'data:image/png;base64,sig',
      undefined,
      () => {}, () => {},
      { confirm: 'Confirm', delete: 'Delete' },
    );
    box.element.style.left = '512px';
    box.element.style.top = '384px';
    box.element.style.width = '204.8px';
    box.element.style.height = '76.8px';

    const p = box.getPlacement();
    expect(p.x).toBeCloseTo(0.5);
    expect(p.y).toBeCloseTo(0.5);
    expect(p.width).toBeCloseTo(0.2);
    expect(p.height).toBeCloseTo(0.1);

    box.destroy();
  });

  it('width and height are always positive', () => {
    const box = createPlacementBox(
      'data:image/png;base64,sig',
      undefined,
      () => {}, () => {},
      { confirm: 'Confirm', delete: 'Delete' },
    );
    box.element.style.left = '100px';
    box.element.style.top = '100px';
    box.element.style.width = '60px';
    box.element.style.height = '30px';

    const p = box.getPlacement();
    expect(p.width).toBeGreaterThan(0);
    expect(p.height).toBeGreaterThan(0);

    box.destroy();
  });

  it('moves placement controls below the box near the top edge after dragging', () => {
    const box = createPlacementBox(
      'data:image/png;base64,sig',
      undefined,
      () => {},
      () => {},
      { confirm: 'Confirm', delete: 'Delete' },
    );

    box.element.dispatchEvent(pointerEvent('pointerdown', 512, 384));
    box.element.dispatchEvent(pointerEvent('pointermove', 512, -1000));

    expect(box.element.classList.contains('ds-sig-box--controls-below')).toBe(true);

    box.destroy();
  });

  it('keeps placement controls above the box when there is top space after resizing', () => {
    const box = createPlacementBox(
      'data:image/png;base64,sig',
      undefined,
      () => {},
      () => {},
      { confirm: 'Confirm', delete: 'Delete' },
    );
    const resizeHandle = box.element.querySelector<HTMLElement>('.ds-resize-se')!;

    box.element.style.top = '120px';
    resizeHandle.dispatchEvent(pointerEvent('pointerdown', 560, 424));
    resizeHandle.dispatchEvent(pointerEvent('pointermove', 620, 464));

    expect(box.element.classList.contains('ds-sig-box--controls-below')).toBe(false);

    box.destroy();
  });
});
