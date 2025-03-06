let audioCtx;
let soundtouch;
const audioEl = document.querySelector('audio');
const pitchEl = document.getElementById('pitch');
const tempoEl = document.getElementById('tempo');
const rateEl = document.getElementById('rate');
const keyEl = document.getElementById('key');
const resetEl = document.getElementById('reset');

const onPitchChange = ({ target: { value } }) => {
  soundtouch.parameters.get('pitch').value = +value;
};

const onTempoChange = ({ target: { value } }) => {
  // ?
  audioEl.preservesPitch = true;
  audioEl.playbackRate = +value;
};

const onRateChange = ({ target: { value } }) => {
  // ?
  audioEl.preservesPitch = false;
  audioEl.playbackRate = +value;
};

const onKeyChange = ({ target: { value } }) => {
  soundtouch.parameters.get('pitchSemitones').value = +value;
};

const onReset = () => {
  if (soundtouch) {
    soundtouch.parameters.get('pitch').value = 1;
    soundtouch.parameters.get('pitchSemitones').value = 0;
  }
  audioEl.playbackRate = 1;
};

function setupFieldListeners(soundtouch) {
  if (!soundtouch) {
    return;
  }
  soundtouch.parameters.get('pitch').value = pitchEl.value;
  audioEl.preservesPitch = true;
  audioEl.playbackRate = tempoEl.value;
  audioEl.preservesPitch = false;
  audioEl.playbackRate = rateEl.value;
  soundtouch.parameters.get('pitchSemitones').value = keyEl.value;
  pitchEl.addEventListener('input', onPitchChange);
  tempoEl.addEventListener('input', onTempoChange);
  rateEl.addEventListener('input', onRateChange);
  keyEl.addEventListener('input', onKeyChange);
  resetEl.addEventListener('click', onReset);
}

function removeFieldListeners() {
  pitchEl.removeEventListener('input', onPitchChange);
  tempoEl.removeEventListener('input', onTempoChange);
  rateEl.removeEventListener('input', onRateChange);
  keyEl.removeEventListener('input', onKeyChange);
  resetEl.removeEventListener('click', onReset);
}

const onPlay = async () => {
  if (audioCtx) return;
  audioCtx = new AudioContext();
  // add worklet asynchronously from your public folder:
  await audioCtx.audioWorklet.addModule('./js/soundtouch-worklet.js');
  // or if you are using Vite:
  // await audioCtx.audioWorklet.addModule(new URL('./soundtouch.js', import.meta.url));
  soundtouch = new AudioWorkletNode(audioCtx, 'soundtouch-processor');
  soundtouch.connect(audioCtx.destination);
  // create node from audio element:
  const audioNode = audioCtx.createMediaElementSource(audioEl);
  audioNode.connect(soundtouch);
  setupFieldListeners(soundtouch);
};

audioEl.addEventListener('play', onPlay);

window.addEventListener('beforeunload', () => {
  audioEl.removeEventListener('play', onPlay);
  removeFieldListeners();
  audioCtx?.close();
  audioCtx = null;
  soundtouch = null;
});
