import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DropSign } from './DropSign.js';
import { captureResult } from './capture.js';

// Must be hoisted — mocks html-to-image for capture unit tests
vi.mock('html-to-image', () => ({
  toPng: vi.fn(async () => 'data:image/png;base64,fake'),
}));

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

describe('captureResult', () => {
  const fakeSigDataUrl = 'data:image/png;base64,signature';
  const placement = {
    x: 10,
    y: 20,
    width: 100,
    height: 50,
    targetWidth: 400,
    targetHeight: 300,
    scrollX: 0,
    scrollY: 0,
  };

  beforeEach(async () => {
    // Provide a minimal fetch stub so dataUrlToBlob works
    globalThis.fetch = vi.fn(async () => ({
      blob: async () => new Blob(['fake']),
    })) as unknown as typeof fetch;
  });

  it('injects signature img into target before capture', async () => {
    const { toPng } = await import('html-to-image');
    const toPngMock = vi.mocked(toPng);

    let capturedImgs: Element[] = [];
    toPngMock.mockImplementationOnce(async (el: HTMLElement) => {
      capturedImgs = Array.from(el.querySelectorAll('img[src]'));
      return 'data:image/png;base64,fake';
    });

    const targetEl = document.createElement('div');
    document.body.appendChild(targetEl);

    await captureResult(targetEl, fakeSigDataUrl, placement);

    expect(capturedImgs).toHaveLength(1);
    expect((capturedImgs[0] as HTMLImageElement).src).toContain('data:image/png;base64,signature');

    targetEl.remove();
  });

  it('removes the temporary signature img from target after capture', async () => {
    const { toPng } = await import('html-to-image');
    const toPngMock = vi.mocked(toPng);

    toPngMock.mockImplementationOnce(async () => 'data:image/png;base64,fake');

    const targetEl = document.createElement('div');
    document.body.appendChild(targetEl);

    await captureResult(targetEl, fakeSigDataUrl, placement);

    // After capture, no img should remain
    expect(targetEl.querySelectorAll('img').length).toBe(0);

    targetEl.remove();
  });

  it('restores target position style after capture', async () => {
    const { toPng } = await import('html-to-image');
    const toPngMock = vi.mocked(toPng);
    toPngMock.mockImplementationOnce(async () => 'data:image/png;base64,fake');

    const targetEl = document.createElement('div');
    // Leave position unset (will be 'static' by default)
    targetEl.style.position = '';
    document.body.appendChild(targetEl);

    await captureResult(targetEl, fakeSigDataUrl, placement);

    // Should be restored to the previous inline value (empty string)
    expect(targetEl.style.position).toBe('');

    targetEl.remove();
  });
});
