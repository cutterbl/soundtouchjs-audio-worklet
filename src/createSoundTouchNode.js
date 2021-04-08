import minsSecs, { diffSecs } from './minsSecs';

const noop = () => {};

/** Documentation can be found in the `/docs/SoundTouchNode.md` file */

/**
 *
 * @param {AudioContext} audioCtx - an AudioContext instance
 * @param {AudioWorkletNode} AudioWorkletNode - actual node, be it window.AudioWorkletNode, or ponyfill
 * @param {ArrayBuffer} arrayBuffer - the raw undecoded audio data
 * @param {*} options - not really used yet
 * @return {SoundTouchNode} - a SoundTouchNode instance
 */
const createSoundTouchNode = (audioCtx, AudioWorkletNode, options) => {
  class SoundTouchNode extends AudioWorkletNode {
    /**
     * @constructor
     * @param {BaseAudioContext} context The associated BaseAudioContext.
     * @param {AudioWorkletNodeOptions} options User-supplied options for
     * AudioWorkletNode.
     */
    constructor(context, options) {
      super(context, 'soundtouch-worklet', options);

      this.name = this.constructor.name;

      Object.assign(this, options.processorOptions);
      /**
       * sampleRate
       * duration
       * bufferLength
       * numberOfChannels
       */

      this.processorOptions = options.processorOptions;
      this.sampleRate = this.processorOptions.sampleRate;

      // an array of all of the listeners
      this.listeners = [];
      // setup our Worklet to Node messaging listener
      this.port.onmessage = this._messageProcessor.bind(this);

      this._onUpdate = noop;
      this._onEnd = noop;

      this.running = true;

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
      this.ready = true;
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
    /* get percentagePlayed() {
      return (100 * this.sourcePosition) / (this.duration * this.sampleRate);
    } */

    /**
     * @percentagePlayed (setter)
     * @param {Float} percentage - the percentage at which to set the 'playHead'
     */
    /* set percentagePlayed(percentage) {
      const { duration, sampleRate } = this;
      // calculate exact sampleFrame position, in the audioBuffer
      this.sourcePosition = parseInt(
        duration * sampleRate * (percentage / 100)
      );
      // send message to the Worklet to update the sourcePosition
      this._updateFilterProp('sourcePosition', this.sourcePosition);
      // set the SoundTouchNode.currentTime to the proper time
      this.currentTime = (this.duration * percentage) / 100;
    } */

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
    /* get currentTime() {
      if (!this.playing) {
        return this._playHead;
      }
      return this._playHead + diffSecs(this._startTime, new Date().getTime());
    } */

    /**
     * @currentTime (setter)
     * @param {Float} val - the time (in seconds) at which to set the 'playHead'
     */
    /* set currentTime(val) {
      this._playHead = val;
    } */

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
              //percentagePlayed: this.percentagePlayed,
            },
          });
          this.dispatchEvent(timeEvent);
        }
      }

      if (message === 'PROCESSOR_READY') {
        /**
         * The AudioWorkletProcessor (SoundTouchWorklet) has received the bits it needs
         * to begin processing, so the AudioWorkletNode (SoundTouchNode) is now
         * 'ready' for use
         */
        /* this.ready = true;

        // tell the using interface that the SoundTouchNode is 'ready'
        // 'detail' is empty, but there for enabling debugging

        // this is here for backwards compatability
        if (typeof this.onInitialized === 'function') {
          this.onInitialized(detail);
          return;
        }

        // preferred method of letting the interface know we're ready
        const init = new CustomEvent('initialized', detail);
        this.dispatchEvent(init); */
        return;
      }

      /**
       * called by the AudioWorkletProcessor (SoundTouchWorklet) to tell us
       * that it's done with all of the available data in the audioBuffer
       */
      if (message === 'PROCESSOR_END') {
        //this.stop();
        this.percentagePlayed = 0;
        const endOfPlay = new CustomEvent('end', {
          detail: {
            timePlayed: this.currentTime,
            formattedTimePlayed: this.formattedTimePlayed,
            //percentagePlayed: this.percentagePlayed,
          },
        });
        this.dispatchEvent(endOfPlay);
        return;
      }

      //console.log('[SoundTouchNode] Unknown message: ', eventFromWorker); // debugging
    }
  }

  return new SoundTouchNode(audioCtx, options);
};

export default createSoundTouchNode;
