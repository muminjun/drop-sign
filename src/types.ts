export type DropSignTarget = string | HTMLElement;

export type DropSignTrigger =
  | {
      type?: 'floating';
      positionAnchor?: 'target' | 'viewport';
      position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
      label?: string;
      pressEffect?: boolean;
    }
  | {
      type: 'inline';
      container: string | HTMLElement;
      label?: string;
      variant?: 'button' | 'text';
      pressEffect?: boolean;
    }
  | {
      type: 'custom';
      element: string | HTMLElement;
    };

export interface DropSignMessages {
  sign?: string;
  clear?: string;
  cancel?: string;
  useSignature?: string;
  confirm?: string;
  delete?: string;
  signingTitle?: string;
  signingDescription?: string;
}

export interface DropSignSignatureOptions {
  penColor?: string;
  minWidth?: number;
  maxWidth?: number;
  velocityFilterWeight?: number;
}

export interface DropSignOptions {
  target: DropSignTarget;
  buttonText?: string;
  trigger?: DropSignTrigger;
  messages?: DropSignMessages;
  signature?: DropSignSignatureOptions;
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
