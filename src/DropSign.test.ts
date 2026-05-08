import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DropSign } from './DropSign.js';

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
