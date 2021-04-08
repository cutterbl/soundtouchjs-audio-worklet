/*
 * SoundTouch JS audio processing library
 * Copyright (c) Olli Parviainen
 * Copyright (c) Ryan Berdeen
 * Copyright (c) Jakub Fiala
 * Copyright (c) Steve 'Cutter' Blades
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 2.1 of the License, or (at your option) any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA  02111-1307  USA
 */

// since the worker does not run in main thread, we need the regeneratorRuntime
// bundled into the worker itself, as Babel with add all the helpers for the
// worker code
import 'regenerator-runtime/runtime';
import { SoundTouch } from 'soundtouchjs';
import WorkletFilter from './WorkletFilter';

class SoundTouchWorklet extends AudioWorkletProcessor {
  /**
   * @constructor
   * @param {options} nodeOptions - currently nothing to worry about
   */
  constructor(options) {
    super();
    this.name = this.constructor.name;

    this.options = options.processorOptions;
    /*processorOptions: {
      sampleRate: this.bufferSource.sampleRate,
      duration: this.bufferSource.duration,
      bufferLength: this.bufferSource.bufferLength,
      numberOfChannels: this.bufferSource.numberOfChannels,
    },*/

    this.oFrames = 0;
    this.vOFrames = 0;

    this.playingAt = 0;
    this.lastPlayingAt = 0;
    this._pipe = new SoundTouch();
    this._filter = new WorkletFilter(this._pipe);

    // This is the sample buffer array length per channel
    // More info in 'process()' on why we use this length
    this.bufferSize = 128;

    this.inSamples = new Float32Array(this.bufferSize * 2);
    this.outSamples = new Float32Array(this.bufferSize * 2);
    // Setup the message listener to process messages from the AudioWorkletNode (SoundTouchNode)
    this.port.onmessage = this._messageProcessor.bind(this);

    this.running = true;
  }

  /**
   * @static parameterDescriptors
   *
   * Defines the AudioParam's of the processor
   *
   * @link https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletProcessor/parameterDescriptors
   *
   * @return {AudioWorkletProcessorSubclass.parameterDescriptors}
   */
  static get parameterDescriptors() {
    return [
      {
        name: 'pitch',
        defaultValue: 1,
        minValue: 0.1,
        maxValue: 2.0,
        automationRate: 'k-rate',
      },
      {
        name: 'pitchSemitones',
        defaultValue: 0,
        minValue: -7,
        maxValue: 7,
        automationRate: 'k-rate',
      },
      {
        name: 'tempo',
        defaultValue: 1,
        minValue: 0.1,
        maxValue: 4.0,
        automationRate: 'k-rate',
      },
    ];
  }

  /**
   * @_messageProcessor
   * @param {*} eventFromWorker - messaging event object sent from the AudioWorkletNode (SoundTouchNode)
   *   eventFromWorker.data (the only really important part)
   *     {String} message - the message sent
   *     {Transferable} detail - any data sent with the message
   */
  _messageProcessor(eventFromWorker) {
    const { message, detail } = eventFromWorker.data;

    if (message === 'SET_FILTER_PROP' && detail) {
      // sets the passed property value on the SimpleFilter instance
      const { name, value } = detail;
      this._filter[name] = value;
      // this is debugging stuff, doing nothing if nothing is listening for it
      this.port.postMessage({
        message: 'FILTER_PROP_CHANGED',
        detail: `Updated ${name} to ${
          this._filter[name]
        }\ntypeof ${typeof value}`,
      });
      return;
    }

    if (message === 'SET_UPDATE_INTERVAL' && detail) {
      this.options.updateInterval = detail;
      this.port.postMessage({
        message: 'UPDATE_INTERVAL_CHANGED',
        detail: `Updated 'updateInterval' to ${detail}`,
      });
      return;
    }

    if (message === 'STOP') {
      this.stop();
      return;
    }

    // anything else
    console.log(
      '[PitchShifterWorkletProcessor] Unknown message: ',
      eventFromWorker
    );
  }

  /**
   * @_sendMessage
   * @param {String} message - message to send
   * @param {*} detail - anything that can be serialized into a Transferable
   * Simple method for sending messages to the AudioWorkletNode (SoundTouchNode)
   */
  _sendMessage(message, detail = null) {
    if (!message) {
      return;
    }
    this.port.postMessage({ message, detail });
  }

  async stop() {
    if (!this.running) {
      return;
    }

    this.running = false;

    this.process = null;
    await this.updatePlayingAt();

    await this._sendMessage('PROCESSOR_END');
  }

  async updatePlayingAt() {
    return this._sendMessage('PLAYINGAT', this.playingAt);
  }

  /**
   * Sets the 'pipe' parameters for processing the audio samples.
   *
   * @param {object} parameters - An object containing the key/value pairs of our processors AudioParam's.
   *                              Each AudioParam of our worklet is a 'k-rate' parameter, meaning it's value
   *                              is applied to all 128 samples in a process cycle. The 'value' of each
   *                              param is an array with a single value (pitch = parameters.pitch[0])
   */
  setupProcessParameters(parameters) {
    // set pipe params from AudioParam's
    const {
      tempo: [tempoValue],
      pitch: [pitchValue],
      pitchSemitones: [semitonesValue],
    } = parameters;
    this._pipe.tempo = tempoValue;
    this._pipe.pitch = pitchValue;
    this._pipe.pitchSemitones = semitonesValue;
  }

  /**
   * @process()
   *
   * This is the worklet's audio processor method. From the MDN Documentation:
   * "The method is called synchronously by the audio rendering thread, once for
   * each audio rendering quantum. That is, every time the next 128 audio frames
   * are ready to process, this method is invoked."
   *
   * Unlike the script processor, the inputs and outputs are passed in automatically,
   * rather than as part of the 'event'. Also note that each has already been broken
   * down to individual channels. You don't have to use the 'getDataChannel()' method,
   * just reference by their index `inputs[n][m][i]` will access n-th input,
   * m-th channel of that input, and i-th sample of that channel.
   *
   * @param {array} inputs      - An array of 'inputs' connected to the node. We only access the first input
   *                              (input[0]), and it's left (input[0][0]) and right (input[0][1]) channels.
   *                              Each channel being a Float32Array(128) of audio samples.
   * @param {array} outputs     - An array of 'outputs' connected to the node. We only access the first output
   *                              (output[0]), and it's left (output[0][0]) and right (output[0][1]) channels.
   *                              Each channel is a Float32Array(128) of audio samples, filled by processing
   *                              our input samples.
   * @param {object} parameters - An object containing the key/value pairs of our processors AudioParam's.
   *                              Each AudioParam of our worklet is a 'k-rate' parameter, meaning it's value
   *                              is applied to all 128 samples in a process cycle. The 'value' of each
   *                              param is an array with a single value (pitch = parameters.pitch[0])
   * @return {boolean}          - I process to continue
   */
  process(inputs, outputs, parameters) {
    // if not initialized and no input data then don't chew process cycles
    if (!this.running || !inputs[0].length) {
      return true;
    }

    this.setupProcessParameters(parameters);

    /**
     * Process frames into sample buffer, 128 frames at a time. This is the change from the previous process,
     * as the scriptProcessor could be configured to process at different bufferSizes (256, 512, 1024, 2048, 4096,
     * 8192, 16384). Now, the AudioWorkletProcessor only, always, processes 128 sampleFrames at a time, resulting
     * in lower (better) processing latency.
     *
     * 'framesExtracted' should always equal the sampleFrames (128) *2 (one for each channel). If no frames were
     * extracted, then we hit the end of the audioBuffer
     **/
    if (this.vOFrames <= this.options.inputFrames) {
      const outputFrames = this.processFilter(inputs, outputs);
      this.vOFrames += outputFrames;
    } else {
      this.stop();
      return false;
    }

    this._sendMessage('SOURCEPOSITION', this._filter.sourcePosition);

    this.playingAt = this.vOFrames / this.options.sampleRate;

    if (this.playingAt - this.lastPlayingAt >= this.options.updateInterval) {
      this.updatePlayingAt();
      this.lastPlayingAt = this.playingAt;
    }

    this.options.inputFrames += inputs[0][0].length;

    return true;
  }

  processFilter(inputs, outputs) {
    let [leftIn, rightIn] = inputs[0];

    // if mono input
    if (!rightIn) {
      rightIn = leftIn;
    }

    // assign to function locals for quick access
    const [leftOut, rightOut] = outputs[0];

    const inSamples = this.inSamples;

    const len = leftIn.length;
    let i = 0;
    for (; i < len; i = i + 1) {
      inSamples[2 * i] = leftIn[i];
      inSamples[2 * i + 1] = rightIn[i];
    }

    this._filter.putSource(inSamples);

    const framesExtracted = this._filter.extract(
      this.outSamples,
      this.bufferSize
    );

    let j = 0;
    for (; j < framesExtracted; j = j + 1) {
      leftOut[j] = this.outSamples[j * 2];
      rightOut[j] = this.outSamples[j * 2 + 1];
    }

    return framesExtracted;
  }
}

registerProcessor('soundtouch-worklet', SoundTouchWorklet);
