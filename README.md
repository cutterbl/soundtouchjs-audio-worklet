# SoundTouchJS Audio Worklet

## BREAKING CHANGE:

The SoundTouchWorklet is a true [AudioWorkletProcessor](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletProcessor) that processes the audio in real time. You must have the worklet registered in your code prior to utilizing the node. The node is represented as a
true [AudioWorkletNode](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletNode).

## See It In Action

Clone the repo, run `npm install`, then run `npm run build`, then `npm start`.

## Browsers and Usage Considerations

The SoundTouchWorklet runs in it's own context, off the main thread, using the native WebAudio API. As such, the Babel runtime is bundled with the other worklet dependencies. All of the necessary [SoundTouch](https://github.com/cutterbl/SoundTouchJS) bits are precompiled into the worklet, and the SoundTouchNode controls their properties. Adding worklets/webworkers to your application can be tricky. Read the documentation below for more information.

## Setting Up the AudioWorkletProcessor (SoundTouchWorklet)

The worklet must first be registered with the audio context, prior to
creating an instance of your AudioWorkletNode, and is compiled and included in this package (`/dist/soundtouch-worklet.js`). According to new browser
security bits, you must have some form of user interaction prior to
creating your [AudioContext](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext). The following is a sample `setupContext()` method.

```js
let audioCtx;
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

It's easy to attach the processor to an AudioContext.

````js
// ref to an <audio> element
let audioEl = document.querySelector('audio');
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

## Controllable Parameters

There are several properties you can set to control the SoundTouchWorklet, effecting
the playback.

- {Float} pitch - controls the pitch of the audio playback
- {Float} pitchSemitones - controls the 'key' of the audio playback in half step increments
- {Float} rate - controls the 'rate' of the audio playback
- {Float} tempo - controls the tempo of the audio playback

This is a true AudioWorkletNode, and as such, you can control the properties in real-time, while the audio is playing. This is a powerful feature, and can be used to create some interesting audio effects.

```js
soundtouch.parameters.get('pitch').value = someValue;
````

## Credits

Thank You to [Janick Delot](https://github.com/watch-janick) for sponsoring this feature for SoundTouchJS

Thanks to [Christoph Guttandin](https://github.com/chrisguttandin), of [standardized-audio-context](https://github.com/chrisguttandin/standardized-audio-context) fame, for the idea of providing the factory method to enable polyfill/ponyfill usage.

Thanks to [Moebits](https://github.com/Moebits) for their conversion of the previous version to a true, real time AudioWorkletProcessor. Also thanks to [Mutil](https://github.com/mutil) for providing a working example.

## Contributing

Know how to make it better? Please fork and submit a PR!
