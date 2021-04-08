import { SimpleFilter } from 'soundtouchjs';

const noop = () => {};

export default class WorkletFilter extends SimpleFilter {
  constructor(pipe, callback = noop) {
    super(null, pipe, callback);
    this.sourceSound = [];
  }

  putSource(source) {
    this.sourceSound.push(...source);
  }

  extractSource(out, framesReq) {
    let framesExtracted = 0;
    if (this.sourceSound.length < framesReq * 2) {
      framesExtracted = 0;
    } else {
      // output is the last set of x num of frames
      out.set(this.sourceSound.slice(-(framesReq * 2)));
      framesExtracted = framesReq;
    }
    return framesExtracted;
  }

  fillInputBuffer(frames = 0) {
    const samples = new Float32Array(frames * 2);
    const framesExtracted = this.extractSource(samples, frames);
    if (framesExtracted > 0) {
      this.inputBuffer.putSamples(samples, 0, framesExtracted);
    }
  }
}
