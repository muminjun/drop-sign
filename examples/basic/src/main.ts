import { DropSign } from 'drop-sign';
import type { DropSignResult, DropSignWidget } from 'drop-sign';

type Mode = 'global-br' | 'global-tl' | 'custom';

let currentWidget: DropSignWidget | null = null;

const WEIGHT_PRESETS = {
  thin: { minWidth: 0.3, maxWidth: 1.2 },
  medium: { minWidth: 0.7, maxWidth: 2.5 },
  thick: { minWidth: 1.2, maxWidth: 4.0 },
} as const;

const MODE_DESCRIPTIONS: Record<Mode, string> = {
  'global-br': 'Mode: Global trigger — fixed button at bottom-right',
  'global-tl': 'Mode: Global trigger — fixed button at top-left, Korean labels',
  'custom': 'Mode: Custom trigger — user-provided #custom-sign-btn',
};

function getPenColor(): string {
  return (document.getElementById('pen-color') as HTMLInputElement).value;
}

function getLineWeight(): { minWidth: number; maxWidth: number } {
  const val = (document.getElementById('line-weight') as HTMLSelectElement)
    .value as keyof typeof WEIGHT_PRESETS;
  return WEIGHT_PRESETS[val] ?? WEIGHT_PRESETS.medium;
}

function onComplete(result: DropSignResult) {
  const output = document.getElementById('output')!;
  const card = document.createElement('div');
  card.className = 'result-card';

  const header = document.createElement('div');
  header.className = 'result-header';
  header.innerHTML = '<h3>Signature captured</h3>';

  const body = document.createElement('div');
  body.className = 'result-body';

  const img = document.createElement('img');
  img.src = result.signatureDataUrl;
  img.alt = 'Signature';
  img.style.maxHeight = '80px';

  const metaContainer = document.createElement('div');
  metaContainer.className = 'metadata-container';
  metaContainer.innerHTML = '<span class="metadata-label">Placement (normalized)</span>';
  const pre = document.createElement('pre');
  pre.textContent = JSON.stringify(result.placement, null, 2);
  metaContainer.appendChild(pre);

  body.append(img, metaContainer);
  card.append(header, body);
  output.innerHTML = '';
  output.appendChild(card);
}

function initMode(mode: Mode) {
  currentWidget?.destroy();
  currentWidget = null;

  const customTriggerArea = document.getElementById('custom-trigger-area') as HTMLElement;
  customTriggerArea.style.display = 'none';

  const weight = getLineWeight();
  const signature = { penColor: getPenColor(), ...weight, velocityFilterWeight: 0.7 };
  const descEl = document.getElementById('mode-description')!;
  descEl.textContent = MODE_DESCRIPTIONS[mode];

  if (mode === 'global-br') {
    currentWidget = DropSign.init({
      target: '#contract-area',
      trigger: { type: 'global', position: 'bottom-right' },
      signature,
      onComplete,
      onError: (err) => console.error('[DropSign]', err),
    });
  } else if (mode === 'global-tl') {
    currentWidget = DropSign.init({
      target: '#contract-area',
      trigger: { type: 'global', position: 'top-left', label: '서명' },
      messages: {
        sign: '서명',
        clear: '지우기',
        cancel: '취소',
        useSignature: '서명 사용',
        confirm: '적용',
        delete: '삭제',
        signingTitle: '서명을 입력하세요',
        signingDescription: '마우스, 트랙패드, Apple Pencil 또는 손가락으로 서명하세요.',
      },
      signature,
      onComplete,
      onError: (err) => console.error('[DropSign]', err),
    });
  } else if (mode === 'custom') {
    customTriggerArea.style.display = 'block';
    currentWidget = DropSign.init({
      target: '#contract-area',
      trigger: { type: 'custom', element: '#custom-sign-btn' },
      signature,
      onComplete,
      onError: (err) => console.error('[DropSign]', err),
    });
  }
}

document.querySelectorAll<HTMLButtonElement>('.mode-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mode-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    initMode(btn.dataset.mode as Mode);
  });
});

document.getElementById('pen-color')!.addEventListener('input', () => {
  const active = document.querySelector('.mode-btn.active') as HTMLButtonElement;
  initMode(active.dataset.mode as Mode);
});
document.getElementById('line-weight')!.addEventListener('change', () => {
  const active = document.querySelector('.mode-btn.active') as HTMLButtonElement;
  initMode(active.dataset.mode as Mode);
});

initMode('global-br');

window.addEventListener('beforeunload', () => currentWidget?.destroy());
