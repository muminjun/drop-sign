export type DropSignTarget = string | HTMLElement;

export type DropSignTrigger =
  | {
      type: 'global';
      position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
      label?: string;
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
  emptySignatureHint?: string;
}

export interface DropSignSignatureOptions {
  penColor?: string;
  minWidth?: number;
  maxWidth?: number;
  velocityFilterWeight?: number;
}

export interface NormalizedPlacement {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DropSignResult {
  signatureDataUrl: string;
  signatureBlob: Blob;
  placement: NormalizedPlacement;
}

export interface DropSignOptions {
  target?: DropSignTarget;
  trigger?: DropSignTrigger;
  messages?: DropSignMessages;
  signature?: DropSignSignatureOptions;
  onComplete?: (result: DropSignResult) => void | Promise<void>;
  onCancel?: () => void;
  onError?: (error: unknown) => void;
}

export interface DropSignWidget {
  destroy(): void;
}
