import { SoundTouch } from 'soundtouchjs';
class SoundTouchWorklet extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'rate', defaultValue: 1.0, minValue: 0.25, maxValue: 4.0 },
      { name: 'tempo', defaultValue: 1.0, minValue: 0.25, maxValue: 4.0 },
      { name: 'pitch', defaultValue: 1.0, minValue: 0.25, maxValue: 4.0 },
      { name: 'pitchSemitones', defaultValue: 0, minValue: -24, maxValue: 24 },
    ];
  }
  constructor() {
    super();
    this.bufferSize = 128;
    this._samples = new Float32Array(this.bufferSize * 2);
    this._pipe = new SoundTouch();
  }

  process(inputs, outputs, parameters) {
    if (!inputs[0].length) return true;

    const leftInput = inputs[0][0];
    const rightInput = inputs[0].length > 1 ? inputs[0][1] : inputs[0][0];

    const leftOutput = outputs[0][0];
    const rightOutput = outputs[0].length > 1 ? outputs[0][1] : outputs[0][0];
    const samples = this._samples;

    if (!leftOutput || !leftOutput.length) return false;

    const rate = parameters.rate[0] ?? parameters.rate;
    const tempo = parameters.tempo[0] ?? parameters.tempo;
    const pitch = parameters.pitch[0] ?? parameters.pitch;
    const pitchSemitones =
      parameters.pitchSemitones[0] ?? parameters.pitchSemitones;

    this._pipe.rate = rate;
    this._pipe.tempo = tempo;
    this._pipe.pitch = pitch * Math.pow(2, pitchSemitones / 12);

    for (let i = 0; i < leftInput.length; i++) {
      samples[i * 2] = leftInput[i];
      samples[i * 2 + 1] = rightInput[i];
    }

    this._pipe.inputBuffer.putSamples(samples, 0, leftInput.length);

    this._pipe.process();

    const processedSamples = new Float32Array(leftInput.length * 2);
    this._pipe.outputBuffer.receiveSamples(processedSamples, leftOutput.length);

    for (let i = 0; i < leftInput.length; i++) {
      leftOutput[i] = processedSamples[i * 2];
      rightOutput[i] = processedSamples[i * 2 + 1];

      if (isNaN(leftOutput[i]) || isNaN(rightOutput[i])) {
        leftOutput[i] = 0;
        rightOutput[i] = 0;
      }
    }

    return true;
  }
}

registerProcessor('soundtouch-processor', SoundTouchWorklet);
