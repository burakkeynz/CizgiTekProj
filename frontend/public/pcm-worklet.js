/* eslint-env worker */
/* global sampleRate */

class PCMWriter extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const { targetSampleRate = 16000, frameMs = 20 } =
      options?.processorOptions || {};
    this.targetSR = targetSampleRate;
    this.frameSamples = Math.round((this.targetSR * frameMs) / 1000); // 320
    this.buf = new Float32Array(0);
  }

  downsample48kTo16k(input) {
    const outLen = Math.floor(input.length / 3);
    const out = new Float32Array(outLen);
    for (let i = 0, j = 0; j < outLen; j++, i += 3) {
      out[j] = input[i]; // simple pick
    }
    return out;
  }

  floatTo16LE(float32) {
    const out = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
      let s = Math.max(-1, Math.min(1, float32[i]));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return out;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const mono = input[0];

    // 48k -> 16k
    const ds = sampleRate === 48000 ? this.downsample48kTo16k(mono) : mono;

    // concat buffer
    const old = this.buf;
    const merged = new Float32Array(old.length + ds.length);
    merged.set(old, 0);
    merged.set(ds, old.length);
    this.buf = merged;

    // frame boylarında
    while (this.buf.length >= this.frameSamples) {
      const chunk = this.buf.slice(0, this.frameSamples);
      this.buf = this.buf.slice(this.frameSamples);
      const pcm16 = this.floatTo16LE(chunk);
      this.port.postMessage({ pcm: pcm16.buffer }, [pcm16.buffer]);
    }
    return true;
  }
}

registerProcessor("pcm-writer", PCMWriter);
