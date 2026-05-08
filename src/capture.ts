import { toPng } from 'html-to-image';
import type { DropSignResult, SignaturePlacement } from './types.js';

export async function captureResult(
  targetEl: HTMLElement,
  signatureDataUrl: string,
  placement: SignaturePlacement,
  options?: { pixelRatio?: number; backgroundColor?: string },
): Promise<DropSignResult> {
  const pixelRatio = options?.pixelRatio ?? window.devicePixelRatio ?? 1;
  const backgroundColor = options?.backgroundColor ?? '#ffffff';

  const imageDataUrl = await toPng(targetEl, { pixelRatio, backgroundColor });

  const imageBlob = await dataUrlToBlob(imageDataUrl);
  const signatureBlob = await dataUrlToBlob(signatureDataUrl);

  return {
    imageBlob,
    signatureBlob,
    signatureDataUrl,
    placement,
  };
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}
