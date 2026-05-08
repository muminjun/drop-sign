import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DropSign } from './DropSign.js';
import { mergeMessages, mergeSignatureOptions } from './messages.js';

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

describe('DropSign.init', () => {
  it('throws if target not found', () => {
    const onError = vi.fn();
    DropSign.init({ target: '#missing', onError });
    expect(onError).toHaveBeenCalled();
    const err = onError.mock.calls[0]?.[0];
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toContain('#missing');
  });

  it('appends sign button to target element', () => {
    const widget = DropSign.init({ target: '#target' });
    const btn = document.querySelector('.ds-button');
    expect(btn).toBeTruthy();
    expect(btn?.textContent).toBe('Sign');
    widget.destroy();
  });

  it('uses custom buttonText', () => {
    const widget = DropSign.init({ target: '#target', buttonText: 'Add signature' });
    expect(document.querySelector('.ds-button')?.textContent).toBe('Add signature');
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
});

describe('trigger modes', () => {
  beforeEach(() => {
    document.body.innerHTML =
      '<div id="target" style="width:400px;height:300px;"></div>' +
      '<div id="sig-area"></div>' +
      '<button id="custom-btn">My Sign</button>';
    document.head.innerHTML = '';
  });

  it('default floating appends .ds-button inside targetEl', () => {
    const widget = DropSign.init({ target: '#target' });
    const btn = document.querySelector('.ds-button');
    expect(btn).toBeTruthy();
    expect(document.getElementById('target')!.contains(btn)).toBe(true);
    widget.destroy();
  });

  it('floating positionAnchor viewport appends to document.body, not targetEl', () => {
    const widget = DropSign.init({
      target: '#target',
      trigger: { type: 'floating', positionAnchor: 'viewport' },
    });
    const btn = document.querySelector('.ds-button-viewport');
    expect(btn).toBeTruthy();
    expect(document.getElementById('target')!.contains(btn)).toBe(false);
    expect(document.body.contains(btn)).toBe(true);
    widget.destroy();
  });

  it('floating positionAnchor viewport button is removed from body on destroy', () => {
    const widget = DropSign.init({
      target: '#target',
      trigger: { type: 'floating', positionAnchor: 'viewport' },
    });
    widget.destroy();
    expect(document.querySelector('.ds-button-viewport')).toBeNull();
  });

  it('floating position bottom-left sets correct inline style', () => {
    const widget = DropSign.init({
      target: '#target',
      trigger: { type: 'floating', position: 'bottom-left' },
    });
    const btn = document.querySelector('.ds-button') as HTMLElement | null;
    expect(btn?.style.left).toBe('24px');
    expect(btn?.style.right).toBe('auto');
    widget.destroy();
  });

  it('floating position top-right sets correct inline style', () => {
    const widget = DropSign.init({
      target: '#target',
      trigger: { type: 'floating', position: 'top-right' },
    });
    const btn = document.querySelector('.ds-button') as HTMLElement | null;
    expect(btn?.style.top).toBe('24px');
    expect(btn?.style.right).toBe('24px');
    widget.destroy();
  });

  it('inline trigger creates button inside container', () => {
    const widget = DropSign.init({
      target: '#target',
      trigger: { type: 'inline', container: '#sig-area', label: '(Sign)' },
    });
    const container = document.getElementById('sig-area')!;
    const btn = container.querySelector('.ds-btn-inline');
    expect(btn).toBeTruthy();
    expect(btn?.textContent).toBe('(Sign)');
    widget.destroy();
  });

  it('inline text variant adds ds-btn-inline--text class', () => {
    const widget = DropSign.init({
      target: '#target',
      trigger: { type: 'inline', container: '#sig-area', variant: 'text', label: '(서명)' },
    });
    const btn = document.querySelector('.ds-btn-inline--text');
    expect(btn).toBeTruthy();
    expect(btn?.textContent).toBe('(서명)');
    widget.destroy();
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

  it('destroy removes SDK-created inline trigger button', () => {
    const widget = DropSign.init({
      target: '#target',
      trigger: { type: 'inline', container: '#sig-area', label: 'Sign' },
    });
    expect(document.querySelector('.ds-btn-inline')).toBeTruthy();
    widget.destroy();
    expect(document.querySelector('.ds-btn-inline')).toBeNull();
  });

  it('destroy does not remove custom trigger element from DOM', () => {
    const widget = DropSign.init({
      target: '#target',
      trigger: { type: 'custom', element: '#custom-btn' },
    });
    widget.destroy();
    expect(document.getElementById('custom-btn')).toBeTruthy();
  });

  it('messages.sign sets the floating button label', () => {
    const widget = DropSign.init({
      target: '#target',
      messages: { sign: '서명' },
    });
    expect(document.querySelector('.ds-button')?.textContent).toBe('서명');
    widget.destroy();
  });

  it('trigger.label takes priority over messages.sign', () => {
    const widget = DropSign.init({
      target: '#target',
      trigger: { type: 'floating', label: 'Start Signing' },
      messages: { sign: '서명' },
    });
    expect(document.querySelector('.ds-button')?.textContent).toBe('Start Signing');
    widget.destroy();
  });

  it('buttonText is used when no messages.sign is provided', () => {
    const widget = DropSign.init({ target: '#target', buttonText: 'Add Signature' });
    expect(document.querySelector('.ds-button')?.textContent).toBe('Add Signature');
    widget.destroy();
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

