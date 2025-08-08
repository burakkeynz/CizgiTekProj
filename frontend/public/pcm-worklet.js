/* eslint-env worker */
/* global sampleRate */

class PCMWriter extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const opts = options?.processorOptions || {};
    this.targetRate = opts.targetSampleRate || 16000; // py-webrtcvad/ASR için ideal
    this.frameMs = opts.frameMs || 20; // 10/20/30 ms olabilir
    this._acc = []; // biriken downsample edilmiş mono float32
    this._inRate = sampleRate; // genelde 48000
    this._ratio = this._inRate / this.targetRate; // 3.0 (48k -> 16k)
  }

  // mono + basit linear resample
  _downmixResample(input) {
    if (!input || input.length === 0) return;
    const ch0 = input[0]; // Float32Array
    const ch1 = input[1]; // varsa
    const N = ch0.length;

    // mono
    const mono = new Float32Array(N);
    if (ch1) {
      for (let i = 0; i < N; i++) mono[i] = 0.5 * (ch0[i] + ch1[i]);
    } else {
      mono.set(ch0);
    }

    // linear resample 48k -> 16k
    const outLen = Math.floor(N / this._ratio);
    const out = new Float32Array(outLen);
    let t = 0;
    for (let i = 0; i < outLen; i++) {
      const idx = t | 0;
      const frac = t - idx;
      const s0 = mono[idx] || 0;
      const s1 = mono[idx + 1] || s0;
      out[i] = s0 + (s1 - s0) * frac;
      t += this._ratio;
    }

    this._acc.push(out);
  }

  _flushIfReady() {
    const need = Math.round(this.targetRate * (this.frameMs / 1000)); // 320 sample @20ms@16k
    if (!this._acc.length) return;

    // küçük blokları birleştir
    let total = 0;
    for (const a of this._acc) total += a.length;
    const buf = new Float32Array(total);
    let off = 0;
    for (const a of this._acc) {
      buf.set(a, off);
      off += a.length;
    }
    this._acc.length = 0;

    let cur = 0;
    while (cur + need <= buf.length) {
      const frame = new Int16Array(need);
      for (let i = 0; i < need; i++) {
        let s = Math.max(-1, Math.min(1, buf[cur + i]));
        frame[i] = (s < 0 ? s * 0x8000 : s * 0x7fff) | 0; // Int16LE
      }
      cur += need;

      this.port.postMessage({ pcm: frame.buffer }, [frame.buffer]);
    }

    if (cur < buf.length) this._acc.push(buf.slice(cur));
  }

  process(inputs) {
    const input = inputs[0];
    if (input && input.length) {
      this._downmixResample(input);
      this._flushIfReady();
    }
    return true;
  }
}

registerProcessor("pcm-writer", PCMWriter);
