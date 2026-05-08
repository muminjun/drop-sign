import type { DropSignMessages, DropSignSignatureOptions } from './types.js';

export const DEFAULT_MESSAGES: Required<DropSignMessages> = {
  sign: 'Sign',
  clear: 'Clear',
  cancel: 'Cancel',
  useSignature: 'Use signature',
  confirm: 'Confirm',
  delete: 'Delete',
  signingTitle: 'Draw your signature',
  signingDescription: 'Use your mouse, trackpad, Apple Pencil, or finger.',
};

export function mergeMessages(user?: DropSignMessages): Required<DropSignMessages> {
  if (!user) return { ...DEFAULT_MESSAGES };
  return { ...DEFAULT_MESSAGES, ...user };
}

export const DEFAULT_SIGNATURE_OPTIONS: Required<DropSignSignatureOptions> = {
  penColor: '#111827',
  minWidth: 0.7,
  maxWidth: 2.5,
  velocityFilterWeight: 0.7,
};

export function mergeSignatureOptions(
  user?: DropSignSignatureOptions,
): Required<DropSignSignatureOptions> {
  if (!user) return { ...DEFAULT_SIGNATURE_OPTIONS };
  return { ...DEFAULT_SIGNATURE_OPTIONS, ...user };
}
