import minsSecs, { diffSecs } from './minsSecs';

/** Documentation can be found in the `/docs/SoundTouchNode.md` file */

/**
 *
 * @param {AudioContext} audioCtx - an AudioContext instance
 * @param {AudioWorkletNode} AudioWorkletNode - actual node, be it window.AudioWorkletNode, or ponyfill
 * @param {ArrayBuffer} arrayBuffer - the raw undecoded audio data
 * @param {*} options - not really used yet
 * @return {SoundTouchNode} - a SoundTouchNode instance
 */
const createSoundTouchNode = (
  audioCtx,
  AudioWorkletNode,
  arrayBuffer,
  options
) => {
  class SoundTouchNode extends AudioWorkletNode {
    /**
     * @constructor
     * @param {BaseAudioContext} context The associated BaseAudioContext.
     * @param {ArrayBuffer} arrayBuffer fixed length raw binary data buffer (undecoded audio)
     * @param {AudioWorkletNodeOptions} options User-supplied options for
     * AudioWorkletNode.
     */
    constructor(context, arrayBuffer, options) {
      super(context, 'soundtouch-worklet', options);

      // Copy the passed ArrayBuffer, so it doesn't become detached and can be reused
      this._arrayBuffer = arrayBuffer.slice(0);
      // an array of all of the listeners
      this.listeners = [];
      // setup our Worklet to Node messaging listener
      this.port.onmessage = this._messageProcessor.bind(this);
      /* play/pause time tracking variables */
      this.sourcePosition = 0;
      this.timePlayed = 0;
      this._startTime = 0;
      this._pauseTime = 0;
      this._playHead = 0;

      this._playing = false;
      this._ready = false;
      // for standardized-audio-context implementation
      this._initialPlay = true;
    }

    /**
     * @formattedDuration (getter)
     * @return {String} the audioBuffer.duration (which is in seconds) in mm:ss format
     */
    get formattedDuration() {
      return minsSecs(this.duration);
    }

    /**
     * @formattedTimePlayed (getter)
     * @return {String} the SoundTouchNode.timePlayed (which is in seconds) in mm:ss format
     */
    get formattedTimePlayed() {
      return minsSecs(this.timePlayed);
    }

    /**
     * @percentagePlayed (getter)
     * @return {Int} the percentage of how much of the audio has 'played'
     */
    get percentagePlayed() {
      return (100 * this.sourcePosition) / (this.duration * this.sampleRate);
    }

    /**
     * @percentagePlayed (setter)
     * @param {Float} percentage - the percentage at which to set the 'playHead'
     */
    set percentagePlayed(percentage) {
      const { duration, sampleRate } = this;
      // calculate exact sampleFrame position, in the audioBuffer
      this.sourcePosition = parseInt(
        duration * sampleRate * (percentage / 100)
      );
      // send message to the Worklet to update the sourcePosition
      this._updateFilterProp('sourcePosition', this.sourcePosition);
      // set the SoundTouchNode.currentTime to the proper time
      this.currentTime = (this.duration * percentage) / 100;
    }

    /**
     * @currentTime (getter)
     * @return {Float} the SoundTouchNode.currentTime (which is in seconds)
     *
     * The filter no longer updates the Node, as it's running in the worklet and
     * messaging latency would cause it to be off. As such, if the Node is not
     * 'playing' then the value has been updated, otherwise the value is derived
     * from the last known 'playHead' position plus the difference in 'startTime'
     * and 'now' (both are in milliseconds, so we calculate the difference in seconds)
     */
    get currentTime() {
      if (!this.playing) {
        return this._playHead;
      }
      return this._playHead + diffSecs(this._startTime, new Date().getTime());
    }

    /**
     * @currentTime (setter)
     * @param {Float} val - the time (in seconds) at which to set the 'playHead'
     */
    set currentTime(val) {
      this._playHead = val;
    }

    /**
     * @playing (getter)
     * @return {Boolean} is the SoundTouchNode 'playing'
     */
    get playing() {
      return this._playing;
    }

    /**
     * @playing (setter)
     * @param {Boolean} val - is the SoundTouchNode 'playing'
     */
    set playing(val) {
      this._playing = Boolean(val);
    }

    /**
     * @ready (getter)
     * @return {Boolean} is the SoundTouchNode 'ready'
     */
    get ready() {
      return this._ready;
    }

    /**
     * @ready (setter)
     * @param {Boolean} val - is the SoundTouchNode 'ready'
     */
    set ready(val) {
      this._ready = Boolean(val);
    }

    /**
     * @sampleRate (getter)
     * @return {Int|undefined} if the audioBuffer has been set it returns the buffer's 'sampleRate',
     *   otherwise returns undefined
     */
    get sampleRate() {
      if (this.audioBuffer) {
        return this.audioBuffer.sampleRate;
      }
      return undefined;
    }

    /**
     * @duration (getter)
     * @return {Float|undefined} if the audioBuffer has been set it returns the buffer's 'duration'
     *   (in seconds), otherwise returns undefined
     */
    get duration() {
      if (this.audioBuffer) {
        return this.audioBuffer.duration;
      }
      return undefined;
    }

    /**
     * @bufferLength (getter)
     * @return {Int|undefined} if the audioBuffer has been set it returns the buffer's 'length',
     *   otherwise returns undefined
     */
    get bufferLength() {
      if (this.audioBuffer) {
        return this.audioBuffer.length;
      }
      return undefined;
    }

    /**
     * @numberOfChannels (getter)
     * @return {Int|undefined} if the audioBuffer has been set it returns the buffer's 'numberOfChannels'
     *   otherwise returns undefined
     */
    get numberOfChannels() {
      if (this.audioBuffer) {
        return this.audioBuffer.numberOfChannels;
      }
      return undefined;
    }

    /* AudioWorkletProcessor SimpleFilter params*/
    // TODO: convert these to true AudioParams, at some point
    /**
     * @pitch (setter) [NO GETTER]
     * @param {Float} pitch - the 'pitch' value to send to the SoundTouch instance in the Worklet
     */
    set pitch(pitch) {
      this._updatePipeProp('pitch', pitch);
    }

    /**
     * @pitchSemitones (setter) [NO GETTER]
     * @param {Float} semitone - the 'pitchSemitones' value (key change) to send to the SoundTouch instance in the Worklet
     */
    set pitchSemitones(semitone) {
      this._updatePipeProp('pitchSemitones', semitone);
    }

    /**
     * @rate (setter) [NO GETTER]
     * @param {Float} rate - the 'rate' value to send to the SoundTouch instance in the Worklet
     */
    set rate(rate) {
      this._updatePipeProp('rate', rate);
    }

    /**
     * @tempo (setter) [NO GETTER]
     * @param {Float} tempo - the 'tempo' value to send to the SoundTouch instance in the Worklet
     */
    set tempo(tempo) {
      this._updatePipeProp('tempo', tempo);
    }
    /* AudioWorkletProcessor SimpleFilter params*/

    /**
     * @connectToBuffer
     * Creates a BufferSourceNode and attaches the 'audioBuffer' that was created by
     * 'decodeAudioData()'. Then it connects the SoundTouchNode to the BufferSourceNode.
     * This means that audio travels FROM the BufferSourceNode TO the SoundTouchNode.
     * As the 'target', SoundTouchNode receives sound data to process it.
     */
    connectToBuffer() {
      this.bufferNode = this.context.createBufferSource();
      this.bufferNode.buffer = this.audioBuffer;
      this.bufferNode.onended = () => console.log('song ended');
      this.bufferNode.connect(this);
      return this.bufferNode;
    }

    /**
     * @disconnectFrom Buffer
     * This severs the connection between the BufferSourceNode and the SoundTouchNode
     */
    disconnectFromBuffer() {
      this.bufferNode.disconnect();
    }

    /**
     * @handleAudioData
     * @param {AudioBuffer} audioBuffer - created by AudioContext.decodeAudioData()
     */
    handleAudioData(audioBuffer) {
      this.audioBuffer = audioBuffer;
      // creates a simple data structure to transfer to the Worklet, based on the audioBuffer
      this.port.postMessage({
        message: 'INITIALIZE_PROCESSOR',
        detail: this.createBaseArray(audioBuffer),
      });
    }

    /**
     * @createBaseArray
     * @param {AudioBuffer} audioBuffer - created by AudioContext.decodeAudioData()
     * @return {Array} an array of values to transfer to the Worklet
     *   Array[0]
     *     {Int} sampleRate - the sampleRate of the audioBuffer
     *     {Float} duration - the duration of the audioBuffer (in seconds)
     *     {Int} bufferLength - the length of the audioBuffer
     *     {Int} numberOfChannels - the numberOfChannels of the audioBuffer
     *   Array[1]
     *     {Float32Array} - the left channel channelData of the audioBuffer
     *   Array[2]
     *     {Float32Array} - the right channel channelData of the audioBuffer
     *       if only a single channel in the input, it will send the left channel
     *       channelData as the right channel
     */
    createBaseArray(audioBuffer) {
      return [
        {
          sampleRate: this.sampleRate,
          duration: this.duration,
          bufferLength: this.bufferLength,
          numberOfChannels: this.numberOfChannels,
        },
        audioBuffer.getChannelData(0),
        this.numberOfChannels > 1
          ? audioBuffer.getChannelData(1)
          : audioBuffer.getChannelData(0),
      ];
    }

    /* play controls */
    /**
     * @play (async)
     * @param {Float} offset - the time (in seconds) to play from, defaulting to SoundTouchNode.currentTime
     */
    async play() {
      if (!this.ready) {
        throw new Error('Your processor is not ready yet');
      }
      if (this.playing) {
        this.stop(true);
      }
      // due to issue with standardized-audio-implementation
      if (this._initialPlay) {
        if (this._playHead === 0) {
          this.percentagePlayed = 0;
        }
        this._initialPlay = false;
      }
      // start the BufferSourceNode processing immediately from this time
      //this.bufferNode.start(0, offset);
      await this.context.resume();
      // reset the 'startTime' tracking variable
      this._startTime = new Date().getTime();
      // set the SoundTouchNode to 'playing'
      this.playing = true;
    }

    pause() {
      // get the current (derived) SoundTouchNode.currentTime
      const currTime = this.currentTime;
      this.stop();
      // 'stop()' reset the SoundTouchNode.currentTime, so we set it back
      this.currentTime = currTime;
    }

    async stop() {
      // stop the BufferSourceNode from processing immediately
      //this.bufferNode.stop(0);
      await this.context.suspend();
      // reset time tracking variables
      this.currentTime = 0;
      this._startTime = new Date().getTime();
      // set the SoundTouchNode to not 'playing'
      this.playing = false;
    }
    /* end play controls */

    /* event listener handling */
    /**
     * @on
     * @param {String} eventName - name of new event listener to 'addEventListener'
     * @param {Function} cb - the callback of the new event listener
     * Event listeners are also stored in an array, for use by 'off()'
     */
    on(eventName, cb) {
      this.listeners.push({ name: eventName, cb: cb });
      this.addEventListener(eventName, (event) => cb(event.detail));
    }

    /**
     * @off
     * @param {null|String} eventName - the 'name of the event listener to remove (removeEventListener)
     *   If a 'name' is passed, we find all of the listeners with that name, in the listeners array, and remove them.
     *   If no 'name' was passed, we remove all of the event listeners in the listeners array
     */
    off(eventName = null) {
      let listeners = this.listeners;
      if (eventName) {
        listeners = listeners.filter((e) => e.name === eventName);
      }
      listeners.forEach((e) => {
        this.removeEventListener(e.name, (event) => e.cb(event.detail));
      });
    }
    /* end event listener handling */

    /**
     * @onprocessorerror
     * @param {Error} err - the Error passed from the Worklet to the Node if there is an
     * error in the Worklet's 'process()'.
     */
    onprocessorerror(err) {
      // just throw worklet errors for now
      throw err;
    }

    /**
     * @_updatePipeProp
     * @param {String} name - the name of the SoundTouch property to set
     * @param {*} value - the value of the SoundTouch property to set
     */
    _updatePipeProp(name, value) {
      // console.log(`Changing ${name} to ${value}`);
      // send message to the Worklet to set the SoundTouch instance's property
      this.port.postMessage({
        message: 'SET_PIPE_PROP',
        detail: { name, value },
      });
    }

    /**
     * @_updateFilterProp
     * @param {String} name - the name of the SimpleFilter property to set
     * @param {*} value - the value of the SimpleFilter property to set
     */
    _updateFilterProp(name, value) {
      //console.log(`Changing ${name} to ${value}`); debugging
      // send message to the Worklet to set the SimpleFilter instance's property
      this.port.postMessage({
        message: 'SET_FILTER_PROP',
        detail: { name, value },
      });
    }

    /**
     * @_messageProcessor
     * @param {*} eventFromWorker - the message 'event' sent from the AudioWorkletProcessor
     *   eventFromWorker.data {*} - the actual 'message'
     *     message {String} - the message string
     *     detail {Transferable} - any serializable data sent with the message
     */
    _messageProcessor(eventFromWorker) {
      const { message, detail } = eventFromWorker.data;
      const { sampleRate, timePlayed: currentTime } = this;

      if (message === 'SOURCEPOSITION') {
        this.sourcePosition = detail;
        const timePlayed = detail / sampleRate;
        if (currentTime !== timePlayed) {
          this.timePlayed = timePlayed;
          const timeEvent = new CustomEvent('play', {
            // we calculate all values based on the one call (above) to get the currentTime
            detail: {
              timePlayed: this.timePlayed,
              formattedTimePlayed: this.formattedTimePlayed,
              percentagePlayed: this.percentagePlayed,
            },
          });
          this.dispatchEvent(timeEvent);
        }
      }

      if (message === 'PROCESSOR_CONSTRUCTOR') {
        // console.log('processor constructor: ', detail);
        // The AudioWorkletProcessor object is instantiated, so we can now decode the raw audio.
        // The 'handleAudioData()' method will send a message back to the AudioWorkletProcessor
        this.context.decodeAudioData(
          this._arrayBuffer,
          (audioData) => this.handleAudioData(audioData),
          (err) => console.log('[decodeAudioData ERROR] ', err)
        );
        return;
      }

      if (message === 'PROCESSOR_READY') {
        /**
         * The AudioWorkletProcessor (SoundTouchWorklet) has received the bits it needs
         * to begin processing, so the AudioWorkletNode (SoundTouchNode) is now
         * 'ready' for use
         */
        this.ready = true;

        // tell the using interface that the SoundTouchNode is 'ready'
        // 'detail' is empty, but there for enabling debugging

        // this is here for backwards compatability
        if (typeof this.onInitialized === 'function') {
          this.onInitialized(detail);
          return;
        }

        // preferred method of letting the interface know we're ready
        const init = new CustomEvent('initialized', detail);
        this.dispatchEvent(init);
        return;
      }

      /**
       * called by the AudioWorkletProcessor (SoundTouchWorklet) to tell us
       * that it's done with all of the available data in the audioBuffer
       */
      if (message === 'PROCESSOR_END') {
        this.stop();
        this.percentagePlayed = 0;
        const endOfPlay = new CustomEvent('end', {
          detail: {
            timePlayed: this.currentTime,
            formattedTimePlayed: this.formattedTimePlayed,
            percentagePlayed: this.percentagePlayed,
          },
        });
        this.dispatchEvent(endOfPlay);
        return;
      }

      //console.log('[SoundTouchNode] Unknown message: ', eventFromWorker); // debugging
    }
  }

  return new SoundTouchNode(audioCtx, arrayBuffer, options);
};

export default createSoundTouchNode;
