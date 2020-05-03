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
import { SoundTouch, SimpleFilter } from 'soundtouchjs';
import ProcessAudioBufferSource from './ProcessAudioBufferSource';

class SoundTouchWorklet extends AudioWorkletProcessor {
  /**
   * @constructor
   * @param {*} nodeOptions - currently nothing to worry about
   */
  constructor(nodeOptions) {
    super();

    this._initialized = false;
    // This is the sample buffer array length per channel
    // More info in 'process()' on why we use this length
    this.bufferSize = 128;
    // Setup the message listener to process messages from the AudioWorkletNode (SoundTouchNode)
    this.port.onmessage = this._messageProcessor.bind(this);
    // Send a message to the AudioWorkletNode to let it know this object is available
    this.port.postMessage({
      message: 'PROCESSOR_CONSTRUCTOR',
      detail: nodeOptions,
    });
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

    if (message === 'INITIALIZE_PROCESSOR') {
      /**
       * Message from the AudioWorkletNode (SoundTouchNode) to initialize the processor with the included data
       */
      const [bufferProps, leftChannel, rightChannel] = detail;
      /**
       * Setup the ProcessAudioBufferSource. Object takes constructor arguments to build an object
       * that mirrors the WebAudioBufferSource object, as far as internal methods, properties, and process,
       * tailored to the data passed in.
       */
      this.bufferSource = new ProcessAudioBufferSource(
        bufferProps,
        leftChannel,
        rightChannel
      );
      // setup sampleBuffer to bufferSize * two channels
      this._samples = new Float32Array(this.bufferSize * 2);
      this._pipe = new SoundTouch();
      /**
       * The SimpleFilter takes the source and SoundTouch to perform the
       * filtering operations on the audio data (stretch, transpose, etc)
       */
      this._filter = new SimpleFilter(this.bufferSource, this._pipe);
      // Notify the AudioWorkletNode (SoundTouchNode) that the processor is now ready
      this.port.postMessage({
        message: 'PROCESSOR_READY',
        // debugging
        /*detail: {
          sampleRate: this.bufferSource.sampleRate,
          duration: this.bufferSource.duration,
          bufferLength: this.bufferSource.bufferLength,
          numberOfChannels: this.bufferSource.numberOfChannels,
          leftChannel: this.bufferSource.leftChannel,
          rightChannel: this.bufferSource.rightChannel,
        },*/
      });
      this._initialized = true;
      return true;
    }

    if (message === 'SET_PIPE_PROP' && detail) {
      // sets the passed property value on the SoundTouch instance
      const { name, value } = detail;
      this._pipe[name] = value;
      // this is debugging stuff, doing nothing if nothing is listening for it
      this.port.postMessage({
        message: 'PIPE_PROP_CHANGED',
        detail: `Updated ${name} to ${
          this._pipe[name]
        }\ntypeof ${typeof value}`,
      });
      return;
    }

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
   * @param {*} inputs - completely ignored, as we get our input from the SimpleFilter
   * @param {*} outputs - single output of two {Float32Array(128)} channels
   */
  process(inputs, outputs) {
    // if not initialized and no input data then don't chew process cycles
    if (!this._initialized || !inputs[0].length) {
      return true;
    }

    // assign to function locals for quick access
    const left = outputs[0][0];
    const right = outputs[0][1];
    const samples = this._samples;

    if (!left || (left && !left.length)) {
      return false;
    }

    /**
     * Process frames into sample buffer, 128 frames at a time. This is the change from the previous process,
     * as the scriptProcessor could be configured to process at different bufferSizes (256, 512, 1024, 2048, 4096,
     * 8192, 16384). Now, the AudioWorkletProcessor only, always, processes 128 sampleFrames at a time, resulting
     * in lower (better) processing latency.
     *
     * 'framesExtracted' should always equal the sampleFrames (128) *2 (one for each channel). If no frames were
     * extracted, then we hit the end of the audioBuffer
     **/
    const framesExtracted = this._filter.extract(samples, inputs[0][0].length);

    if (!framesExtracted) {
      this._sendMessage('PROCESSOR_END');
      return false;
    }

    this._sendMessage('SOURCEPOSITION', this._filter.sourcePosition);

    /**
     * Write new frames to the outputs
     * The sampleBuffer is an interleavered Float32Array (LRLRLRLRLR...), so
     * we pull the bits from their corresponding location
     **/
    let i = 0;
    for (; i < framesExtracted; i = i + 1) {
      // even frames to the left (starting with 0)
      left[i] = samples[i * 2];
      // odd frames to the right (starting with 1)
      right[i] = samples[i * 2 + 1];
    }

    return true;
  }
}

registerProcessor('soundtouch-worklet', SoundTouchWorklet);
