import { toPng } from 'html-to-image';
import type { SignaturePlacement } from './types.js';

export async function captureResult(
  targetEl: HTMLElement,
  signatureDataUrl: string,
  placement: SignaturePlacement,
  options?: { pixelRatio?: number; backgroundColor?: string },
): Promise<{ imageBlob: Blob; signatureBlob: Blob; signatureDataUrl: string; placement: SignaturePlacement }> {
  const pixelRatio = options?.pixelRatio ?? window.devicePixelRatio ?? 1;
  const backgroundColor = options?.backgroundColor ?? '#ffffff';

  const computedPos = window.getComputedStyle(targetEl).position;
  const prevInlinePos = targetEl.style.position;
  if (computedPos === 'static') {
    targetEl.style.position = 'relative';
  }

  const sigImg = document.createElement('img');
  sigImg.src = signatureDataUrl;
  sigImg.style.position = 'absolute';
  sigImg.style.left = `${placement.x}px`;
  sigImg.style.top = `${placement.y}px`;
  sigImg.style.width = `${placement.width}px`;
  sigImg.style.height = `${placement.height}px`;
  sigImg.style.pointerEvents = 'none';
  sigImg.style.zIndex = '9999';
  targetEl.appendChild(sigImg);

  let imageDataUrl: string;
  try {
    imageDataUrl = await toPng(targetEl, { pixelRatio, backgroundColor });
  } finally {
    sigImg.remove();
    targetEl.style.position = prevInlinePos;
  }

  const imageBlob = await dataUrlToBlob(imageDataUrl);
  const signatureBlob = await dataUrlToBlob(signatureDataUrl);

  return { imageBlob, signatureBlob, signatureDataUrl, placement };
}

export function persistResult(
  targetEl: HTMLElement,
  signatureDataUrl: string,
  placement: SignaturePlacement,
): { persistedEl: HTMLElement; removePersisted: () => void } {
  const computedPos = window.getComputedStyle(targetEl).position;
  if (computedPos === 'static') {
    targetEl.style.position = 'relative';
  }

  const sigImg = document.createElement('img');
  sigImg.src = signatureDataUrl;
  sigImg.style.position = 'absolute';
  sigImg.style.left = `${placement.x}px`;
  sigImg.style.top = `${placement.y}px`;
  sigImg.style.width = `${placement.width}px`;
  sigImg.style.height = `${placement.height}px`;
  sigImg.style.pointerEvents = 'none';
  sigImg.style.zIndex = '9999';
  targetEl.appendChild(sigImg);

  return {
    persistedEl: sigImg,
    removePersisted: () => sigImg.remove(),
  };
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}
