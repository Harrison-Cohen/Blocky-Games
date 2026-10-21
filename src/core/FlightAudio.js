// Flight sound, synthesised with the Web Audio API. No files.
//
// It plays into the car engine's SoundEngine: the same audio context, the same
// master gain (so the one volume slider and the mute key govern it too), and the
// same suspension while the tab is hidden. It builds its own voices the first
// time that context is running, and a machine with no audio device plays a
// silent game.
//
// The first version sounded like static, because every voice was a slice of
// WHITE noise, and a slice of white noise hisses at any cutoff. A jet is not
// white: it is a deep rumble, a roar that falls off with pitch, and a thin tone
// on top. So the noise here is shaped before it is filtered (brown noise falls
// 6 dB an octave, pink 3), the tone is a real voice with a second engine beating
// against the first, and the afterburner is a flickering low growl, not a band
// of hiss.
//
// Voices, built once and then only steered:
//   rumble   the core: brown noise, its inaudible sub-bass cut away, through a
//            steep low-pass that opens with the spool, swelling and ebbing slowly
//   exhaust  the jet itself: pink noise in a band that rises with the spool
//   whine    the compressor: a tone per engine, the two a hair apart so they beat
//   burner   the afterburner: a deep rumble that flickers, a raspy band above it,
//            and a thump when it lights
//   wind     airframe noise, rising with the square of the airspeed
//   boom     the sonic boom, once, as the aircraft goes through Mach 1
//   stall    a two-tone chirp, gated, for the stall warning
//
// Each category will get its own switch in the settings (milestone 9).

import { FLIGHT_AUDIO as A } from '../data/tuning.js';

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// A loopable buffer of shaped noise: generate a little extra, then blend the
// tail into the head so the seam does not click.
function shapedNoise(ctx, seconds, kind) {
  const rate = ctx.sampleRate;
  const n = Math.floor(rate * seconds), L = Math.floor(rate * 0.25);
  const gen = new Float32Array(n + L);
  if (kind === 'brown') {
    let last = 0;
    for (let i = 0; i < gen.length; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      gen[i] = last * 3.5;
    }
  } else {
    // Paul Kellet's pink filter.
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < gen.length; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
      gen[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
  }
  const buf = ctx.createBuffer(1, n, rate);
  const out = buf.getChannelData(0);
  let peak = 0;
  for (let i = 0; i < n; i++) {
    out[i] = i < L ? gen[i] * (i / L) + gen[n + i] * (1 - i / L) : gen[i];
    peak = Math.max(peak, Math.abs(out[i]));
  }
  const norm = peak > 0 ? 0.9 / peak : 1;
  for (let i = 0; i < n; i++) out[i] *= norm;
  return buf;
}

export class FlightAudio {
  constructor(sound) {
    this.sound = sound;
    this.built = false;
    this._chirp = 0;
    this._abPrev = 0;
  }

  _build() {
    const s = this.sound;
    const ctx = s.ctx;
    this.ctx = ctx;
    this.bus = ctx.createGain();
    this.bus.gain.value = 0;
    // The cabin: from the cockpit camera everything above the cutoff is muffled.
    this.cabin = ctx.createBiquadFilter();
    this.cabin.type = 'lowpass';
    this.cabin.frequency.value = 20000;
    this.cabin.Q.value = 0.5;
    this.bus.connect(this.cabin).connect(s.master);

    const brown = shapedNoise(ctx, 3, 'brown');
    const pink = shapedNoise(ctx, 3, 'pink');
    this._brown = brown;
    this._pink = pink;

    // A voice of noise: a buffer through a chain of filters ([type, freq, Q]),
    // then a gain into `to`.
    const noise = (buffer, chain, to = this.bus) => {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      let node = src;
      const filters = chain.map(([type, freq, q]) => {
        const f = ctx.createBiquadFilter();
        f.type = type; f.frequency.value = freq; f.Q.value = q;
        node.connect(f); node = f;
        return f;
      });
      const gain = ctx.createGain();
      gain.gain.value = 0;
      node.connect(gain).connect(to);
      src.start(0, Math.random() * 2);
      return { src, filters, gain };
    };
    // A slow oscillator that moves a gain up and down by `depth` (itself a gain
    // the update steers, so the swing follows the level).
    const lfo = (freq, target) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = freq;
      const depth = ctx.createGain();
      depth.gain.value = 0;
      o.connect(depth).connect(target);
      o.start();
      return { osc: o, depth };
    };

    // The core: brown noise through two low-passes (a steep slope, so no hiss
    // gets through), with two slow swells on it.
    this.rumble = noise(brown, [['highpass', A.rumbleFloor, 0.7], ['lowpass', A.rumbleIdle, 0.7], ['lowpass', A.rumbleIdle, 0.7]]);
    this.swellA = lfo(1.7, this.rumble.gain.gain);
    this.swellB = lfo(0.43, this.rumble.gain.gain);

    // The exhaust: pink noise in a band, with the top rolled off.
    this.exhaust = noise(pink, [['bandpass', A.exhaustIdle, 0.55], ['lowpass', 3200, 0.7]]);

    // The whine: a sawtooth per engine through a broad band-pass, the second
    // a hair off the first. Together they go through a low-pass that takes off
    // the fizz.
    this.whineGain = ctx.createGain();
    this.whineGain.gain.value = 0;
    const whineTop = ctx.createBiquadFilter();
    whineTop.type = 'lowpass';
    whineTop.frequency.value = 5200;
    whineTop.Q.value = 0.5;
    this.whineGain.connect(whineTop).connect(this.bus);
    this.whines = [0, 1].map(() => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      const band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.Q.value = 1.8;
      osc.connect(band).connect(this.whineGain);
      osc.start();
      return { osc, band };
    });

    // The afterburner: a deep rumble that flickers, and a raspy band above it.
    this.burnLow = noise(brown, [['highpass', A.rumbleFloor, 0.7], ['lowpass', A.burnerLow, 0.7], ['lowpass', A.burnerLow, 0.7]]);
    this.flickerA = lfo(A.burnerFlutter, this.burnLow.gain.gain);
    this.flickerB = lfo(A.burnerFlutter * 0.41, this.burnLow.gain.gain);
    this.burnRasp = noise(pink, [['bandpass', A.roarFreq, 0.9], ['lowpass', 2800, 0.7]]);
    this.flickerC = lfo(A.burnerFlutter * 0.7, this.burnRasp.gain.gain);

    // The air going by.
    this.wind = noise(pink, [['bandpass', A.windFreq, 0.5], ['lowpass', 3500, 0.7]]);

    // The stall chirp.
    this.stall = ctx.createOscillator();
    this.stall.type = 'square';
    this.stall.frequency.value = A.stallFreq;
    this.stallGain = ctx.createGain();
    this.stallGain.gain.value = 0;
    this.stall.connect(this.stallGain).connect(this.bus);
    this.stall.start();
    this.built = true;
  }

  // The thump of the afterburner lighting: a low tone falling away, and a puff
  // of rumble with it.
  // The sonic boom, struck at time t: the front of the wave is a deep thump that
  // falls in pitch, with a short sharp crack on it, and the rumble of the air
  // closing behind. Through the same bus, so the cabin muffles the crack and not
  // the thump.
  _boom(t) {
    if (A.boomGain <= 0) return;
    const ctx = this.ctx, G = A.boomGain;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(84, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.6);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(G * 0.8, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
    osc.connect(g).connect(this.bus);
    osc.start(t);
    osc.stop(t + 1.15);
    // A burst of noise through a filter, its level rising in `attack` seconds
    // and dying away over `decay`.
    const burst = (buffer, type, freq, q, level, attack, decay) => {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const f = ctx.createBiquadFilter();
      f.type = type; f.frequency.value = freq; f.Q.value = q;
      const e = ctx.createGain();
      e.gain.setValueAtTime(0, t);
      e.gain.linearRampToValueAtTime(level, t + attack);
      e.gain.exponentialRampToValueAtTime(0.001, t + attack + decay);
      src.connect(f).connect(e).connect(this.bus);
      src.start(t, Math.random() * 2);
      src.stop(t + attack + decay + 0.05);
    };
    burst(this._pink, 'bandpass', 900, 0.6, G * 0.5, 0.004, 0.18);
    burst(this._brown, 'lowpass', 220, 0.7, G * 0.9, 0.06, 1.7);
  }

  _kick(t) {
    if (A.burnerKick <= 0) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(95, t);
    osc.frequency.exponentialRampToValueAtTime(34, t + 0.55);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(A.engineGain * A.burnerKick * 1.6, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    osc.connect(g).connect(this.bus);
    osc.start(t);
    osc.stop(t + 0.75);
  }

  // Once per rendered frame. s null is silence (paused, a menu). Otherwise
  // s = { spool 0..1, ab 0..1, speed m/s, stallWarn, gearWarn, cockpit, dt }.
  update(s) {
    if (!this.sound.ready) return;
    if (!this.built) this._build();
    const t = this.ctx.currentTime;
    const k = A.smoothing;
    if (!s) {
      this.bus.gain.setTargetAtTime(0, t, 0.05);
      return;
    }
    this.bus.gain.setTargetAtTime(1, t, 0.05);
    this.cabin.frequency.setTargetAtTime(s.cockpit ? A.cabinCutoff : 20000, t, 0.12);

    const E = A.engineGain;
    const spool = clamp01(s.spool);

    // The core.
    const rumbleLevel = E * A.rumbleGain * (0.35 + 0.9 * spool);
    const cut = A.rumbleIdle + (A.rumbleMil - A.rumbleIdle) * spool;
    this.rumble.filters[1].frequency.setTargetAtTime(cut, t, k);
    this.rumble.filters[2].frequency.setTargetAtTime(cut, t, k);
    this.rumble.gain.gain.setTargetAtTime(rumbleLevel, t, k);
    this.swellA.depth.gain.setTargetAtTime(rumbleLevel * 0.2, t, k);
    this.swellB.depth.gain.setTargetAtTime(rumbleLevel * 0.14, t, k);

    // The exhaust.
    this.exhaust.filters[0].frequency.setTargetAtTime(A.exhaustIdle + (A.exhaustMil - A.exhaustIdle) * spool, t, k);
    this.exhaust.gain.gain.setTargetAtTime(E * A.exhaustGain * (0.06 + 0.94 * spool * spool), t, k);

    // The whine.
    const f = A.whineIdle + (A.whineMil - A.whineIdle) * spool;
    this.whines[0].osc.frequency.setTargetAtTime(f, t, k);
    this.whines[1].osc.frequency.setTargetAtTime(f * A.whineBeat, t, k);
    this.whines[0].band.frequency.setTargetAtTime(f * 1.6, t, k);
    this.whines[1].band.frequency.setTargetAtTime(f * A.whineBeat * 1.6, t, k);
    this.whineGain.gain.setTargetAtTime(E * A.whineGain * (0.25 + 0.75 * spool) * 1.6, t, k);

    // The afterburner.
    const ab = clamp01(s.ab);
    if (ab > 0.12 && this._abPrev <= 0.12) this._kick(t);
    this._abPrev = ab;
    const lowLevel = E * A.roarGain * ab * 3.2;
    this.burnLow.gain.gain.setTargetAtTime(lowLevel, t, k * 2);
    this.flickerA.depth.gain.setTargetAtTime(lowLevel * A.burnerFlutterDepth, t, k);
    this.flickerB.depth.gain.setTargetAtTime(lowLevel * A.burnerFlutterDepth * 0.6, t, k);
    const raspLevel = E * A.roarGain * ab * 1.1;
    this.burnRasp.gain.gain.setTargetAtTime(raspLevel, t, k * 2);
    this.burnRasp.filters[0].frequency.setTargetAtTime(A.roarFreq * (0.8 + 0.5 * ab), t, k);
    this.flickerC.depth.gain.setTargetAtTime(raspLevel * A.burnerFlutterDepth * 0.5, t, k);

    if (s.boom) this._boom(t + A.boomDelay);

    // The wind.
    const v = clamp01(s.speed / 340);
    this.wind.gain.gain.setTargetAtTime(A.windGain * v * v * 1.5, t, k);
    this.wind.filters[0].frequency.setTargetAtTime(A.windFreq * (0.6 + 0.8 * v), t, k);

    // The stall warning gates on and off at a steady rate, in two tones.
    if (s.stallWarn) {
      this._chirp += s.dt * A.stallRate;
      const on = this._chirp % 1 < 0.5;
      this.stall.frequency.setTargetAtTime(this._chirp % 2 < 1 ? A.stallFreq : A.stallFreq * 1.26, t, 0.005);
      this.stallGain.gain.setTargetAtTime(on ? A.stallGain : 0, t, 0.006);
    } else if (s.gearWarn) {
      // Gear up on short final: one low tone, a quarter of a second in each second.
      this._gearT = (this._gearT || 0) + s.dt;
      this.stall.frequency.setTargetAtTime(A.stallFreq * 0.72, t, 0.005);
      this.stallGain.gain.setTargetAtTime(this._gearT % 1.1 < 0.28 ? A.stallGain * 0.8 : 0, t, 0.006);
    } else {
      this.stallGain.gain.setTargetAtTime(0, t, 0.02);
    }
  }
}
