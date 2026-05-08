export type DropSignTarget = string | HTMLElement;

export interface DropSignOptions {
  target: DropSignTarget;
  buttonText?: string;
  classNamePrefix?: string;
  capture?: {
    pixelRatio?: number;
    backgroundColor?: string;
  };
  onComplete?: (result: DropSignResult) => void | Promise<void>;
  onCancel?: () => void;
  onError?: (error: unknown) => void;
}

export interface SignaturePlacement {
  x: number;
  y: number;
  width: number;
  height: number;
  targetWidth: number;
  targetHeight: number;
  scrollX: number;
  scrollY: number;
}

export interface DropSignResult {
  imageBlob: Blob;
  signatureBlob: Blob;
  signatureDataUrl: string;
  placement: SignaturePlacement;
}

export interface DropSignWidget {
  destroy(): void;
}
