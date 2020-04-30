/**
 * Loosely based on an example from:
 * http://onlinetonegenerator.com/pitch-shifter.html
 */

// This is pulling SoundTouchJS from the local file system. See the README for proper usage.
import SoundTouchNode from './js/soundtouch-audio-node.js';

const loadBtn = document.getElementById('load');
const playBtn = document.getElementById('play');
const stopBtn = document.getElementById('stop');
const tempoSlider = document.getElementById('tempoSlider');
const tempoOutput = document.getElementById('tempo');
tempoOutput.innerHTML = tempoSlider.value;
const pitchSlider = document.getElementById('pitchSlider');
const pitchOutput = document.getElementById('pitch');
pitchOutput.innerHTML = pitchSlider.value;
const keySlider = document.getElementById('keySlider');
const keyOutput = document.getElementById('key');
keyOutput.innerHTML = keySlider.value;
const volumeSlider = document.getElementById('volumeSlider');
const volumeOutput = document.getElementById('volume');
volumeOutput.innerHTML = volumeSlider.value;
const currTime = document.getElementById('currentTime');
const duration = document.getElementById('duration');
const progressMeter = document.getElementById('progressMeter');

let audioCtx;
let gainNode;
let soundtouch;
let buffer;
let bufferNode;
let is_ready = false;

const resetControls = () => {
  playBtn.setAttribute('disabled', 'disabled');
  stopBtn.setAttribute('disabled', 'disabled');
  soundtouch.tempo = tempoSlider.value;
  soundtouch.pitch = pitchSlider.value;
  soundtouch.percentagePlayed = 0;
  progressMeter.value = 0;
  duration.innerHTML = soundtouch.formattedDuration;
};

const onEnd = (detail) => {
  resetControls();
  updateProgress(detail);
  setupSoundtouch();
};

const onInitialized = (detail) => {
  console.log('PitchSoundtouch Initialized ', detail);
  resetControls();
  playBtn.removeAttribute('disabled');
  soundtouch.on('play', updateProgress);
  soundtouch.on('end', onEnd);
  is_ready = true;
};

const updateProgress = (detail) => {
  currTime.innerHTML = detail.formattedTimePlayed;
  progressMeter.value = detail.percentagePlayed;
};

const loadSource = async (url) => {
  if (is_playing) {
    pause(true);
  }
  try {
    playBtn.setAttribute('disabled', 'disabled');

    await setupContext();
    buffer = await fetch(url).then((resp) => resp.arrayBuffer());
    setupSoundtouch();
  } catch (err) {
    console.error('[loadSource] ', err);
  }

  loadBtn.setAttribute('disabled', 'disabled');
};

const setupContext = function () {
  try {
    audioCtx = new AudioContext();
    return audioCtx.audioWorklet.addModule('./js/soundtouch-worklet.js');
  } catch (err) {
    console.error('[setupContext] ', err);
  }
};

const setupSoundtouch = function () {
  if (soundtouch) {
    soundtouch.off();
  }
  soundtouch = new SoundTouchNode(audioCtx, buffer);
  soundtouch.on('initialized', onInitialized);
};

const load = function () {
  try {
    loadSource('./bensound-actionable.mp3');
  } catch (err) {
    console.log(err);
  }
};

let is_playing = false;
const play = function () {
  if (is_ready) {
    bufferNode = soundtouch.connectToBuffer(); // AudioBuffer goes to SoundTouchNode
    gainNode = audioCtx.createGain();
    soundtouch.connect(gainNode); // SoundTouch goes to the GainNode
    gainNode.connect(audioCtx.destination); // GainNode goes to the AudioDestinationNode

    soundtouch.play();

    is_playing = true;
    playBtn.setAttribute('disabled', 'disabled');
    stopBtn.removeAttribute('disabled');
  }
};

const pause = function (stop = false, override = false) {
  if (bufferNode) {
    gainNode.disconnect(); // disconnect the DestinationNode
    soundtouch.disconnect(); // disconnect the AudioGainNode
    soundtouch.disconnectFromBuffer(); // disconnect the SoundTouchNode

    if (stop) {
      soundtouch.stop();
    } else {
      soundtouch.pause();
    }

    stopBtn.setAttribute('disabled', 'disabled');
    if (is_playing || override) {
      playBtn.removeAttribute('disabled');
    }
  }
};

loadBtn.onclick = load;
playBtn.onclick = play;
stopBtn.onclick = () => pause();

tempoSlider.addEventListener('input', function () {
  tempoOutput.innerHTML = soundtouch.tempo = this.value;
});

pitchSlider.addEventListener('input', function () {
  pitchOutput.innerHTML = soundtouch.pitch = this.value;
  soundtouch.tempo = tempoSlider.value;
});

keySlider.addEventListener('input', function () {
  soundtouch.pitchSemitones = this.value;
  keyOutput.innerHTML = this.value / 2;
  soundtouch.tempo = tempoSlider.value;
});

volumeSlider.addEventListener('input', function () {
  volumeOutput.innerHTML = gainNode.gain.value = this.value;
});

progressMeter.addEventListener('click', function (event) {
  const pos = event.target.getBoundingClientRect();
  const relX = event.pageX - pos.x;
  const perc = (relX * 100) / event.target.offsetWidth;
  pause(null, true);
  soundtouch.percentagePlayed = perc;
  progressMeter.value = perc;
  currTime.innerHTML = soundtouch.formattedTimePlayed;
  if (is_playing) {
    play();
  }
});
