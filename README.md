# SoundTouchJS Audio Worklet

The SoundTouchNode is an extension of the Web Audio API [AudioWorkletNode](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletNode).
It works in conjunction with the SoundTouchWorklet, the [AudioWorkletProcessor](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletProcessor) that
processes the audio from the buffer. You must have the worklet registered
in your code prior to utilizing the node. The node is represented as a
true [AudioNode](https://developer.mozilla.org/en-US/docs/Web/API/AudioNode).

## Browsers and Usage Considerations

[AudioWorklet](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet)s are currently only available in Chrome, MS Edge, and Electron (with hacks). We use RollupJS and Babel to compile all of our dependencies.

The SoundTouchWorklet runs in it's own context, off the main thread, when using the native WebAudio API. As such, the Babel runtime is bundled with the other worklet dependencies. All of the necessary [SoundTouch](https://github.com/cutterbl/SoundTouchJS) bits are precompiled into the worklet, and the SoundTouchNode controls their properties. Adding worklets/webworkers to your application can be tricky. Read the documentation below for more information.

## Setting Up the AudioWorkletProcessor (SoundTouchWorklet)

The worklet must first be registered with the audio context, prior to
creating an instance of your SoundTouchNode, and is compiled and included in this package (`/dist/soundtouch-worklet.js`). According to new browser
security bits, you must have some form of user interaction prior to
creating your [AudioContext](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext). The following is a `setupContext()` method
called from the 'loadSource()' method

```js
const setupContext = function () {
  audioCtx = new AudioContext();
  return audioCtx.audioWorklet
    .addModule('./js/soundtouch-worklet.js')
    .catch((err) => console.log(err));
};
```

The [AudioContext](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext) [audioWorklet.addModule()](https://developer.mozilla.org/en-US/docs/Web/API/Worklet/addModule) method returns a Promise. The path passed to this method is the path to the SoundTouchWorklet, available from the build `@soundtouchjs/audio-worklet/dist/soundtouch-worklet.js`. Pathing to this file is important, and your server must include a 'Content-Type' header of `text/javascript` or `application/javascript` for the file to run properly.

_**[NOTE]**: If you are using a bundler (webpack, rollup, etc) to
bundle your app, you may require a special 'loader' for worklets/
web workers._

## Setting Up the AudioWorkletNode (SoundTouchNode)

Once you have setup your worklet, and retrieved your raw (undecoded) file for processing, you now need to create an instance of the SoundTouchNode. We provide a factory method for this, so that you can use polyfilled/ponyfilled WebAudio API classes if necessary.

```js
//top of the file
import createSoundTouchNode from '@soundtouchjs/audio-worklet';
//... and later

// called from our `loadSource()` method, after we've retrieved the
// raw audio data
const setupSoundtouch = function () {
  if (soundtouch) {
    soundtouch.off();
  }
  soundtouch = createSoundTouchNode(audioCtx, AudioWorkletNode, buffer);
  soundtouch.on('initialized', onInitialized);
};
```

### Chaining AudioNodes

You must connect the SoundTouchNode with the [AudioBufferSourceNode](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode), so that audio will move from the [AudioBuffer](https://developer.mozilla.org/en-US/docs/Web/API/AudioBuffer) through the [AudioWorkletNode](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletNode) and, by extension, through the [AudioWorkletProcessor](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletNode). You do this by calling the `connectToBuffer()` method of the SoundTouchNode, which returns the [AudioBufferSourceNode](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode) object. This means that additional audio processing happens by chaining additional [AudioNode](https://developer.mozilla.org/en-US/docs/Web/API/AudioNode)s, passing audio from the SoundTouchNode on to the next node in the chain, until you finally connect the [AudioContext](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext) [AudioDestintionNode](https://developer.mozilla.org/en-US/docs/Web/API/AudioDestinationNode). You can see this in our _example_ by looking at it's `play()` method.

```js
const play = function () {
  if (is_ready) {
    bufferNode = soundtouch.connectToBuffer();
    gainNode = audioCtx.createGain();
    soundtouch.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    // ...
  }
};
```

This also means that, when pausing or stopping audio, you must disconnect all [AudioNode](https://developer.mozilla.org/en-US/docs/Web/API/AudioNode)s as well. You can see this in our _example_ by looking at it's `pause()` method.

```js
const pause = function (stop = false, override = false) {
  if (bufferNode) {
    gainNode.disconnect();
    soundtouch.disconnect();
    soundtouch.disconnectFromBuffer();
    // ...
  }
};
```

## Events

The SoundTouchNode provides several 'events' that your interface
may require:

- 'initialize' - necessary to know that the [AudioWorkletProcessor](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletNode) is now ready to process
- 'play' - called every second while the audio is playing, giving you minor information about the playhead
  - {Float} timePlayed - the current 'playHead' position in seconds
  - {String} formattedTimePlayed - the 'timePlayed' in 'mm:ss' format
  - {Int} percentagePlayed - the percentage of what's been played based on the 'timePlayed' and audio duration
- 'end' - called when the [AudioWorkletProcessor](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletNode) has processed all available data

## Player controls

Three methods are provided for controlling that 'playHead' of your audio

- 'play()' - plays the audio
- 'pause()' - pauses the audio, but maintains the 'playHead' position
- 'stop()' - stops the audio entirely

_**[Note]**: 'stop()' does not fire the 'end' event, and will require you to setup new
[AudioContext](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext), worklet, and SoundTouchNode instances to start audio again._

## Controllable Properties

There are several properties you can set to control the SoundTouchWorklet, effecting
the playback.

- {Float} pitch - controls the pitch of the audio playback (soundtouch.pitch = 1.16)
- {Float} pitchSemitones - controls the 'key' of the audio playback in half step increments (soundtouch.pitchSemitones = .5)
- {Float} rate - controls the 'rate' of the audio playback (soundtouch.rate = 1.23)
- {Float} tempo - controls the tempo of the audio playback (soundtouch.tempo = 1.45)
- {Float} percentagePlayed - controls the position of the playHead for audio playback

## Read Only Properties

You also have several other read-only properties available

- {Boolean} ready - the processor is ready
- {Boolean} playing - the process is playing
- {Float} duration - the duration of the [AudioBuffer](https://developer.mozilla.org/en-US/docs/Web/API/AudioBuffer) in seconds (only available once the processor is ready)
- {String} formattedDuration - the duration of the audio in the [AudioBuffer](https://developer.mozilla.org/en-US/docs/Web/API/AudioBuffer) in 'mm:ss' format (only available once the processor is ready)
- {Int} sampleRate - the sampleRate of the [AudioBuffer](https://developer.mozilla.org/en-US/docs/Web/API/AudioBuffer) (only available once the processor is ready) [number of audio samples per second]
- {Int} bufferLength - the length of the [AudioBuffer](https://developer.mozilla.org/en-US/docs/Web/API/AudioBuffer) (only available once the processor is ready) (sampleRate \* duration)
- {Int} numberOfChannels - the number of audio channels in the [AudioBuffer](https://developer.mozilla.org/en-US/docs/Web/API/AudioBuffer) (only available once the processor is ready)

(There are other read-only properties, but they are derived values, and shouldn't be accessed externally when the Node is 'playing' as latency may effect the values given)

## Memory Considerations

Due to the Stretch and Rate Transposition features of SoundTouch, as well as the nature of AudioWorklets, it is currently necessary to maintain copies of the AudioBuffer in both the browser's main process thread as well as in the [AudioWorkletGlobalScope](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletGlobalScope) (where the processor processes). This may change in the future, once the [SharedArrayBuffer](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer) gains complete adoption in other browsers, but for now it's necessary, and you should be aware of the overhead it creates.

## Credits

Thank You to [Janick Delot](https://github.com/watch-janick) for sponsoring this feature for SoundTouchJS

Thanks to [Christoph Guttandin](https://github.com/chrisguttandin), of [standardized-audio-context](https://github.com/chrisguttandin/standardized-audio-context) fame, for the idea of providing the factory method to enable polyfill/ponyfill usage.


1