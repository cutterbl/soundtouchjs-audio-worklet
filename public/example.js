/**
 * Loosely based on an example from:
 * http://onlinetonegenerator.com/pitch-shifter.html
 */

// This is pulling SoundTouchJS from the local file system. See the README for proper usage.
import createSoundTouchNode from './js/soundtouch-audio-node.js';

/**
 * https://github.com/chrisguttandin/standardized-audio-context
 * To see this working with the standaridized-audio-context ponyfill,
 * uncomment these two lines
 */
//import sac from 'https://jspm.dev/standardized-audio-context';
//const { AudioContext, AudioWorkletNode } = sac;

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
  /* currTime.innerHTML = detail.formattedTimePlayed;
  progressMeter.value = detail.percentagePlayed; */
};

const decodeAudio = (arrayBuffer) => {
  return new Promise((resolve, reject) => {
    audioCtx.decodeAudioData(
      arrayBuffer,
      (audioData) => resolve(audioData),
      (err) => reject(err)
    );
  });
};

const loadSource = async (url) => {
  /* if (is_playing) {
    pause(true);
  } */
  try {
    playBtn.setAttribute('disabled', 'disabled');

    await setupContext();
    // fetches file, reads response as an arrayBuffer,
    // then decodes that to an audioBuffer
    buffer = await fetch(url)
      .then((resp) => resp.arrayBuffer())
      .then(decodeAudio);
    setupSoundtouch();
    loadBtn.setAttribute('disabled', 'disabled');
  } catch (err) {
    console.error('[loadSource] ', err);
  }
};

const setupContext = async function () {
  try {
    audioCtx = new AudioContext();
    return audioCtx.audioWorklet.addModule('./js/soundtouch-worklet.js');
  } catch (err) {
    console.error('[setupContext] ', err);
  }
};

const buildNodeOptions = function (audioBuffer) {
  if (!audioBuffer) {
    throw new Error('No audioBuffer');
  }
  const {
    sampleRate,
    duration,
    length: bufferLength,
    numberOfChannels,
  } = audioBuffer;
  return {
    processorOptions: {
      sampleRate,
      duration,
      bufferLength,
      numberOfChannels,
      inputFrames: 0,
      updateInterval: 1.0,
    },
  };
};

const setupSoundtouch = function () {
  if (soundtouch) {
    soundtouch.off();
  }
  const options = buildNodeOptions(buffer);
  soundtouch = createSoundTouchNode(audioCtx, AudioWorkletNode, options);
  //soundtouch.on('initialized', onInitialized);
  onInitialized();
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
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    bufferNode = audioCtx.createBufferSource();
    bufferNode.buffer = buffer;
    gainNode = audioCtx.createGain();
    bufferNode.connect(gainNode); // AudioBuffer goes to SoundTouchNode
    //soundtouch.connect(gainNode); // SoundTouch goes to the GainNode
    //bufferNode.connect(gainNode);
    gainNode.connect(soundtouch); // GainNode goes to the AudioDestinationNode
    soundtouch.connect(audioCtx.destination);

    //soundtouch.play();
    bufferNode.start();

    is_playing = true;
    playBtn.setAttribute('disabled', 'disabled');
    stopBtn.removeAttribute('disabled');
  }
};

const pause = function (stop = false, override = false) {
  if (bufferNode) {
    /* gainNode.disconnect(); // disconnect the DestinationNode
    soundtouch.disconnect(); // disconnect the AudioGainNode
    soundtouch.disconnectFromBuffer(); // disconnect the SoundTouchNode

    if (stop) {
      soundtouch.stop();
    } else {
      soundtouch.pause();
    } */
    console.log(`Stopped at ${audioCtx.currentTime}`);
    bufferNode.stop();
    soundtouch.disconnect();
    gainNode.disconnect();
    bufferNode.disconnect();

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
  const tempo = soundtouch.parameters.get('tempo');
  tempo.setValueAtTime(this.value, audioCtx.currentTime);
  tempoOutput.innerHTML = this.value;
});

pitchSlider.addEventListener('input', function () {
  const pitch = soundtouch.parameters.get('pitch');
  const tempo = soundtouch.parameters.get('tempo');
  pitch.setValueAtTime(this.value, audioCtx.currentTime);
  tempo.setValueAtTime(tempoSlider.value, audioCtx.currentTime);
  pitchOutput.innerHTML = this.value;
});

keySlider.addEventListener('input', function () {
  const semitones = soundtouch.parameters.get('pitchSemitones');
  const tempo = soundtouch.parameters.get('tempo');
  semitones.setValueAtTime(this.value, audioCtx.currentTime);
  tempo.setValueAtTime(tempoSlider.value, audioCtx.currentTime);
  keyOutput.innerHTML = this.value / 2;
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
