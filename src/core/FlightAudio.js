// Flight sound, synthesised with the Web Audio API. No files.
//
// It plays into the car engine's SoundEngine: the same audio context, the same
// master gain (so the one volume slider and the mute key govern it too), and the
// same suspension while the tab is hidden. It builds its own voices the first
// time that context is running, and a machine with no audio device plays a
// silent game.
//
// Broad core/exhaust noise and restrained engine-specific fan/turbine harmonics.
// No periodic amplitude LFOs or artificial twin-engine detuning. Each harmonic
// follows its own simulated engine spool, running state and health. The cabin
// filters engine/wind sound; alerts retain their useful spectrum.

import { DAMAGE_FX as F, FLIGHT_DAMAGE as D, FLIGHT_AUDIO, FLIGHT_AUDIO_PROFILES } from '../data/tuning.js';

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
    this.A = FLIGHT_AUDIO;
    this._chirp = 0;
    this._abPrev = 0;
  }

  // The sound of the aircraft being flown: the profile laid over the common numbers. The voices are
  // built once and only steered, so a new aircraft changes what they are steered to.
  setAircraft(def) {
    const prof = FLIGHT_AUDIO_PROFILES[def.id];
    this.A = prof ? { ...FLIGHT_AUDIO, ...prof } : FLIGHT_AUDIO;
    this._abPrev = 0;
    this._damageLevels = new Uint8Array(def.damage.length);
    this._damageWarningAt = -Infinity;
    this._damagePending = false;
  }

  _build() {
    const A = this.A;
    const s = this.sound;
    const ctx = s.ctx;
    this.ctx = ctx;
    this.bus = ctx.createGain();
    this.bus.gain.value = 0;
    // The cabin: from the cockpit camera everything above the cutoff is muffled.
    this.cabin = ctx.createBiquadFilter();
    this.cabin.type = 'lowpass';
    this.cabin.frequency.value = Math.min(20000,ctx.sampleRate/2);
    this.cabin.Q.value = 0.5;
    this.bus.connect(this.cabin).connect(s.master);
    this.alerts=ctx.createGain();this.alerts.gain.value=0;this.alerts.connect(s.master);

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
    // The core: brown noise through two low-passes (a steep slope, so no hiss
    // gets through), with no artificial amplitude modulation.
    this.rumble = noise(brown, [['highpass', A.rumbleFloor, 0.7], ['lowpass', A.rumbleIdle, 0.7], ['lowpass', A.rumbleIdle, 0.7]]);


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
      osc.type = A.toneWave;
      const band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.Q.value = A.toneQ;
      const gain=ctx.createGain();gain.gain.value=0;
      osc.connect(band).connect(gain).connect(this.whineGain);
      osc.start();
      return { osc, band, gain };
    });

    // The afterburner: a continuous deep rumble with a broad raspy band above it.
    this.burnLow = noise(brown, [['highpass', A.rumbleFloor, 0.7], ['lowpass', A.burnerLow, 0.7], ['lowpass', A.burnerLow, 0.7]]);

    this.burnRasp = noise(pink, [['bandpass', A.roarFreq, 0.9], ['lowpass', 2800, 0.7]]);


    // The air going by.
    this.wind = noise(pink, [['bandpass', A.windFreq, 0.5], ['lowpass', 3500, 0.7]]);

    // The stall chirp.
    this.stall = ctx.createOscillator();
    this.stall.type = 'square';
    this.stall.frequency.value = A.stallFreq;
    this.stallGain = ctx.createGain();
    this.stallGain.gain.value = 0;
    this.stall.connect(this.stallGain).connect(this.alerts);
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
    const A = this.A;
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
    const A = this.A;
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

  // The clunk of a flap lever at its detent, now.
  thump() {
    if (!this.built || !this.sound.ready) return;
    const A = this.A, ctx = this.ctx, t = ctx.currentTime;
    if (A.clunkGain <= 0) return;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(A.clunkFreq, t);
    osc.frequency.exponentialRampToValueAtTime(A.clunkFreq * 0.45, t + 0.16);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(A.engineGain * A.clunkGain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.connect(g).connect(this.bus);
    osc.start(t);
    osc.stop(t + 0.25);
  }

  _damageWarning(t) {
    const ctx = this.ctx, osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = 'sine'; osc.frequency.value = F.warningFreq;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(F.warningGain * this.A.engineGain, t + F.warningTime * 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, t + F.warningTime);
    osc.connect(gain).connect(this.alerts);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
    osc.start(t); osc.stop(t + F.warningTime);
  }

  // Once per rendered frame. s null is silence (paused, a menu). Otherwise
  // s = { spool 0..1, ab 0..1, speed m/s, stallWarn, gearWarn, cockpit, dt }.
  update(s) {
    const A = this.A;
    if (!this.sound.ready) return;
    if (!this.built) this._build();
    const t = this.ctx.currentTime;
    const k = A.smoothing;
    if (!s) {
      this.bus.gain.setTargetAtTime(0, t, 0.05);
      this.alerts.gain.setTargetAtTime(0,t,.05);
      return;
    }
    this.bus.gain.setTargetAtTime(s.cockpit?A.cabinGain:1, t, 0.05);
    this.alerts.gain.setTargetAtTime(1,t,.05);
    this.cabin.frequency.setTargetAtTime(s.cockpit ? A.cabinCutoff : Math.min(20000,this.ctx.sampleRate/2), t, 0.12);

    let health = 1,spool=clamp01(s.spool),burn=clamp01(s.ab);
    if (s.engines) {
      health = 0;spool=0;burn=0;
      for (let i = 0; i < s.engines.length; i++) {
        const e=s.engines[i],n=clamp01(e.n),live=e.running!==false&&s.fuelOk!==false?1:n;
        const h=clamp01(e.health)*live;health+=h;spool+=n*h;burn+=clamp01(e.abLevel)*h;
      }
      if(health>0){spool/=health;burn/=health;}
      health /= s.engines.length;
    }
    if (s.damage) {
      let anyWarning = false;
      for (let i = 0; i < s.damage.health.length; i++) {
        const h = s.damage.health[i], severity = h < D.fire ? 2 : h < D.smoke ? 1 : 0;
        anyWarning ||= severity > 0;
        if (severity > this._damageLevels[i]) this._damagePending = true;
        this._damageLevels[i] = severity;
      }
      if (!anyWarning) this._damagePending = false;
      if (this._damagePending && t - this._damageWarningAt >= F.warningCooldown) {
        this._damageWarning(t); this._damageWarningAt = t; this._damagePending = false;
      }
    }
    const E = A.engineGain * health;


    // The core.
    const rumbleLevel = E * A.rumbleGain * (0.35 + 0.9 * spool);
    const cut = A.rumbleIdle + (A.rumbleMil - A.rumbleIdle) * spool;
    this.rumble.filters[1].frequency.setTargetAtTime(cut, t, k);
    this.rumble.filters[2].frequency.setTargetAtTime(cut, t, k);
    this.rumble.gain.gain.setTargetAtTime(rumbleLevel, t, k);


    // The exhaust.
    this.exhaust.filters[0].frequency.setTargetAtTime(A.exhaustIdle + (A.exhaustMil - A.exhaustIdle) * spool, t, k);
    this.exhaust.gain.gain.setTargetAtTime(E * A.exhaustGain * (0.06 + 0.94 * spool * spool), t, k);

    // The whine.
    for(let i=0;i<this.whines.length;i++){
      const e=s.engines?.[i],n=e?clamp01(e.n):spool,h=e?clamp01(e.health)*(e.running!==false&&s.fuelOk!==false?1:n):health;
      const f=(A.whineIdle+(A.whineMil-A.whineIdle)*Math.sqrt(n))*(1-(1-h)*F.engineNoteLoss);
      const v=this.whines[i];v.osc.type=A.toneWave;v.band.Q.setTargetAtTime(A.toneQ,t,k);
      v.osc.frequency.setTargetAtTime(f,t,k);v.band.frequency.setTargetAtTime(f,t,k);
      v.gain.gain.setTargetAtTime(h*(A.toneIdle+(1-A.toneIdle)*n*n)/this.whines.length,t,k);
    }
    this.whineGain.gain.setTargetAtTime(A.engineGain*A.whineGain,t,k);

    // The afterburner.
    const ab = burn;
    if (ab > 0.12 && this._abPrev <= 0.12) this._kick(t);
    this._abPrev = ab;
    const lowLevel = E * A.roarGain * ab * 3.2;
    this.burnLow.gain.gain.setTargetAtTime(lowLevel, t, k * 2);


    const raspLevel = E * A.roarGain * ab * 1.1;
    this.burnRasp.gain.gain.setTargetAtTime(raspLevel, t, k * 2);
    this.burnRasp.filters[0].frequency.setTargetAtTime(A.roarFreq * (0.8 + 0.5 * ab), t, k);


    if (s.boom && !s.cockpit) this._boom(t + A.boomDelay);

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
