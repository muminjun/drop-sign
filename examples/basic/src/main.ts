import { DropSign } from 'drop-sign';

const widget = DropSign.init({
  target: '#contract-area',
  buttonText: 'Sign',
  onComplete(result) {
    const output = document.getElementById('output');
    if (!output) return;

    const resultCard = document.createElement('div');
    resultCard.className = 'result-card';

    const resultHeader = document.createElement('div');
    resultHeader.className = 'result-header';
    resultHeader.innerHTML = '<h3>Signed document (Exported Preview)</h3>';

    const resultBody = document.createElement('div');
    resultBody.className = 'result-body';

    const img = document.createElement('img');
    img.src = URL.createObjectURL(result.imageBlob);
    img.alt = 'Signed document with signature';

    const metadataContainer = document.createElement('div');
    metadataContainer.className = 'metadata-container';
    metadataContainer.innerHTML = '<span class="metadata-label">Placement Metadata</span>';

    const pre = document.createElement('pre');
    pre.textContent = JSON.stringify(result.placement, null, 2);

    metadataContainer.appendChild(pre);
    resultBody.append(img, metadataContainer);
    resultCard.append(resultHeader, resultBody);

    output.innerHTML = '';
    output.appendChild(resultCard);
  },
  onError(err) {
    console.error('[DropSign]', err);
  },
});

window.addEventListener('beforeunload', () => widget.destroy());
