import { DropSign } from 'drop-sign';

const widget = DropSign.init({
  target: '#contract-area',
  buttonText: 'Sign',
  onComplete(result) {
    const output = document.getElementById('output');
    if (!output) return;

    const heading = document.createElement('h3');
    heading.textContent = 'Signed document:';

    const img = document.createElement('img');
    img.src = URL.createObjectURL(result.imageBlob);
    img.alt = 'Signed document';

    const pre = document.createElement('pre');
    pre.textContent = JSON.stringify(result.placement, null, 2);

    output.innerHTML = '';
    output.append(heading, img, pre);
  },
  onError(err) {
    console.error('[DropSign]', err);
  },
});

window.addEventListener('beforeunload', () => widget.destroy());
