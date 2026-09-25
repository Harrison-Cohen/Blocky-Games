// Sound, synthesised with the Web Audio API. No files.
//
// Voices built once and then only steered:
//   engine  two saw waves an octave apart through a lowpass filter, with an
//           amplitude wobble at the cam rate for the lumpy idle a V8 has and a
//           four cylinder does not. Pitch is the firing frequency of the
//           gearbox's rpm; the filter opens with revs and throttle.
//   tyres   white noise through a band pass, rising with slip past the limit.
//           On gravel and grass a lower, rougher band takes over.
//   wind    high-passed noise, rising with the square of speed.
// plus two one-shots: a thump for a hit or a landing, and the start tones.
//
// Browsers refuse to start audio before the page has been interacted with, so
// the context is created on the first key press or click. Nothing here throws:
// a machine with no audio device plays a silent game. The context is
// suspended while the tab is hidden, which is the spec's mute-when-hidden and
// also stops a hidden tab burning a core on an engine nobody can hear.

import { AUDIO } from '../data/tuning.js';
import { load, save } from './Storage.js';

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

export class SoundEngine {
  constructor() {
    this.ctx = null;
    const v = Number(load('volume', AUDIO.volume));
    this.volume = Number.isFinite(v) ? clamp01(v) : AUDIO.volume;
    this.muted = load('muted', false) === true;
    this._lastThump = -1;
    this._unlock = this._unlock.bind(this);
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this._unlock);
      window.addEventListener('pointerdown', this._unlock);
      document.addEventListener('visibilitychange', () => this._onVisibility());
    }
  }

  get ready() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  _unlock() {
    try {
      if (!this.ctx) this._build();
      if (this.ctx.state === 'suspended' && !document.hidden) this.ctx.resume().catch(() => {});
    } catch {
      this.ctx = null;
    }
  }

  _build() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) throw new Error('no Web Audio');
    const ctx = new Ctx();
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = this._level();
    // A gentle limiter, so a thump on top of a screaming engine never clips.
    const limit = ctx.createDynamicsCompressor();
    limit.threshold.value = -10;
    limit.ratio.value = 6;
    this.master.connect(limit).connect(ctx.destination);

    // Two seconds of white noise, shared by every noise voice.
    const len = Math.floor(ctx.sampleRate * 2);
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    // Engine.
    this.oscA = ctx.createOscillator();
    this.oscA.type = 'sawtooth';
    this.oscB = ctx.createOscillator();
    this.oscB.type = 'sawtooth';
    const sub = ctx.createGain();
    sub.gain.value = AUDIO.engineSub;
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.Q.value = AUDIO.engineQ;
    this.engineFilter.frequency.value = AUDIO.filterBase;
    this.burble = ctx.createGain();
    this.burble.gain.value = 1;
    this.lfo = ctx.createOscillator();
    this.lfo.type = 'sine';
    this.lfoDepth = ctx.createGain();
    this.lfoDepth.gain.value = 0;
    this.lfo.connect(this.lfoDepth).connect(this.burble.gain);
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.oscA.connect(this.engineFilter);
    this.oscB.connect(sub).connect(this.engineFilter);
    this.engineFilter.connect(this.burble).connect(this.engineGain).connect(this.master);
    this.oscA.start();
    this.oscB.start();
    this.lfo.start();

    this.scrub = this._noiseVoice('bandpass', AUDIO.scrubFreq, AUDIO.scrubQ);
    this.loose = this._noiseVoice('lowpass', AUDIO.looseFreq, 0.7);
    this.wind = this._noiseVoice('highpass', AUDIO.windFreq, 0.5);
  }

  _noiseVoice(type, freq, q) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(filter).connect(gain).connect(this.master);
    // Each voice starts somewhere different in the buffer, so they do not
    // share a pattern you can hear.
    src.start(0, Math.random() * 2);
    return { src, filter, gain };
  }

  // Perceived loudness is roughly the square of the gain, so the slider is
  // squared on the way in and its middle sounds like the middle.
  _level() {
    return this.muted ? 0 : this.volume * this.volume;
  }

  _applyLevel() {
    if (this.ctx) this.master.gain.setTargetAtTime(this._level(), this.ctx.currentTime, 0.03);
  }

  setVolume(v) {
    this.volume = clamp01(v);
    save('volume', this.volume);
    this._applyLevel();
  }

  toggleMute() {
    this.muted = !this.muted;
    save('muted', this.muted);
    this._applyLevel();
    return this.muted;
  }

  _onVisibility() {
    if (!this.ctx) return;
    if (document.hidden) this.ctx.suspend().catch(() => {});
    else this.ctx.resume().catch(() => {});
  }

  // Once per rendered frame. `s` null is silence: paused, in the garage, on a
  // menu. Otherwise s = { rpm, voice, throttle, shifting, slip, speed,
  // topSpeed, tarmac, loose }, slip as a multiple of the peak slip angle and
  // tarmac/loose as the share of wheels on each.
  update(s) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const k = AUDIO.smoothing;
    if (!s) {
      for (const g of [this.engineGain.gain, this.scrub.gain.gain, this.loose.gain.gain, this.wind.gain.gain]) {
        g.setTargetAtTime(0, t, 0.05);
      }
      return;
    }
    const v = s.voice;
    const rev = clamp01((s.rpm - v.idle) / Math.max(1, v.redline - v.idle));
    // An electric motor has no firing pulses: its note is the whine of the
    // motor and its inverter, `whine` times the motor's speed.
    const fire = v.electric ? (s.rpm / 60) * v.whine : (s.rpm / 60) * (v.cylinders / 2);
    this.oscA.frequency.setTargetAtTime(fire, t, k);
    this.oscB.frequency.setTargetAtTime(fire / 2, t, k);
    // Once every two turns of the crank: the cam, and the lope of a big engine.
    this.lfo.frequency.setTargetAtTime(Math.max(1, s.rpm / 120), t, k);
    this.lfoDepth.gain.setTargetAtTime(v.burble * (1 - 0.7 * rev), t, k);
    const load = clamp01(s.throttle);
    this.engineFilter.frequency.setTargetAtTime(
      AUDIO.filterBase + AUDIO.filterRange * Math.pow(rev, 1.3) * (0.4 + 0.6 * load), t, k);
    let level = AUDIO.engineGain * (AUDIO.engineOffGain + (1 - AUDIO.engineOffGain) * load) * (0.65 + 0.35 * rev);
    if (s.shifting) level *= AUDIO.shiftDip;
    // Standing still, an electric car makes no sound at all.
    if (v.electric) level *= clamp01(rev * 6);
    this.engineGain.gain.setTargetAtTime(level, t, s.shifting ? 0.01 : k);

    const slide = clamp01((s.slip - AUDIO.scrubStart) / (AUDIO.scrubFull - AUDIO.scrubStart)) * clamp01(s.speed / 8);
    this.scrub.gain.gain.setTargetAtTime(AUDIO.scrubGain * slide * s.tarmac, t, k);
    this.scrub.filter.frequency.setTargetAtTime(AUDIO.scrubFreq * (0.85 + 0.3 * slide), t, k);
    this.loose.gain.gain.setTargetAtTime(AUDIO.looseGain * clamp01(s.speed / 25) * s.loose, t, k);
    const sp = clamp01(s.speed / Math.max(1, s.topSpeed));
    this.wind.gain.gain.setTargetAtTime(AUDIO.windGain * sp * sp, t, k);
  }

  // A hit: a low sine dropping in pitch under a burst of dull noise. strength
  // 0-1.
  thump(strength) {
    if (!this.ready || !(strength > 0)) return;
    const ctx = this.ctx, t = ctx.currentTime;
    if (t - this._lastThump < 0.09) return;
    this._lastThump = t;
    const g = AUDIO.thumpGain * clamp01(strength);
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.18);
    const og = ctx.createGain();
    og.gain.setValueAtTime(g, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc.connect(og).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.27);
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const nf = ctx.createBiquadFilter();
    nf.type = 'lowpass';
    nf.frequency.value = 900;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(g * 0.6, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    n.connect(nf).connect(ng).connect(this.master);
    n.start(t, Math.random());
    n.stop(t + 0.14);
  }

  // The start: the same tone as each lamp comes on, and an octave up when
  // they all go out.
  beep(go = false) {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const len = go ? AUDIO.goLength : AUDIO.beepLength;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = go ? AUDIO.beepFreq * 2 : AUDIO.beepFreq;
    const soften = ctx.createBiquadFilter();
    soften.type = 'lowpass';
    soften.frequency.value = 2400;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(AUDIO.beepGain, t + 0.01);
    g.gain.setValueAtTime(AUDIO.beepGain, t + len - 0.05);
    g.gain.linearRampToValueAtTime(0.0001, t + len);
    osc.connect(soften).connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + len + 0.02);
  }
}
