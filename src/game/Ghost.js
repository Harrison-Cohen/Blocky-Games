// Ghost laps.
//
// Recorded on the physics clock, replayed on the lap clock, and never touched
// by anything that varies with the frame rate. Pure data -- no Three.js -- so
// the recorder runs headless in the checks against the real LapTimer.
//
// Samples fall on exact multiples of 1/hz of LAP time, starting at the instant
// the car crossed the line, not at whichever physics step happened to follow
// it. A step covers a slice of lap time, and any sample inside that slice is
// the car's state interpolated to it -- the same sub-step idea that keeps the
// lap times themselves off the 8.3 ms grid. The last sample is the line itself,
// so the ghost of a 1:08.485 lap crosses it at 1:08.485.
//
// Only a new valid best is ever kept. An invalid lap is recorded like any
// other -- the recorder cannot know how a lap will end -- and thrown away at
// the line.

import { GHOST } from '../data/tuning.js';

const CHANNELS = 6; // x, y, z, yaw, pitch, roll

// Stored quantised: a centimetre on position, a tenth of a milliradian on
// angle, and each channel as the difference from the frame before, which is a
// small number at 30 Hz. Around 55 KB of JSON for a minute's lap. The
// quantised values are what is differenced, so rounding never accumulates.
const POS_Q = 100;
const ANG_Q = 10000;
const FORMAT = 1;

function angleDelta(from, to) {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export class GhostLap {
  // frames: [x, y, z, yaw, pitch, roll] per sample. Sample k < count - 1 is at
  // k / hz seconds into the lap; the last is at exactly `time`, on the line.
  constructor(hz, frames, time, chassis = null, car = null) {
    this.hz = hz;
    this.frames = frames;
    this.count = frames.length / CHANNELS;
    this.time = time;
    this.chassis = chassis;
    this.car = car;
  }

  // The pose `t` seconds into the lap, written into `out`. False before the
  // line and after the flag, where there is no ghost to draw.
  poseAt(t, out) {
    const n = this.count;
    if (n < 2 || !(t >= 0) || t > this.time) return false;
    let i = Math.floor(t * this.hz);
    let a;
    if (i >= n - 2) {
      // Between the last whole sample and the line.
      i = n - 2;
      const t0 = i / this.hz;
      const span = this.time - t0;
      a = span > 1e-9 ? (t - t0) / span : 1;
    } else {
      a = t * this.hz - i;
    }
    a = a < 0 ? 0 : a > 1 ? 1 : a;
    const f = this.frames;
    const o = i * CHANNELS, q = o + CHANNELS;
    out.x = f[o] + (f[q] - f[o]) * a;
    out.y = f[o + 1] + (f[q + 1] - f[o + 1]) * a;
    out.z = f[o + 2] + (f[q + 2] - f[o + 2]) * a;
    out.yaw = f[o + 3] + angleDelta(f[o + 3], f[q + 3]) * a;
    out.pitch = f[o + 4] + (f[q + 4] - f[o + 4]) * a;
    out.roll = f[o + 5] + (f[q + 5] - f[o + 5]) * a;
    return true;
  }
}

export class GhostRecorder {
  constructor(hz = GHOST.hz) {
    this.hz = hz;
    this.buf = new Float64Array(CHANNELS * 2048);
    this.reset();
  }

  reset() {
    this.count = 0;
    this.recording = false;
    this._lapStart = null;
    this._laps = -1;
    this._next = 0;
    this._tooLong = false;
  }

  // Once per physics step, AFTER LapTimer.step, so the physics prev* fields
  // still hold the start of the step. Returns a GhostLap when the lap that just
  // closed is a new valid best for this track and chassis, otherwise null.
  step(timer, p, dt) {
    let best = null;
    const laps = timer.laps.length;
    if (laps !== this._laps) {
      // A lap closed on this step -- or the timer was reset, which empties the
      // list and closes nothing.
      const lap = this._laps >= 0 && laps > this._laps ? timer.laps[laps - 1] : null;
      if (this.recording && !this._tooLong && lap && lap.valid && timer.newRecord) {
        // The line was crossed inside this step, at the instant the new lap
        // began, so the time since then says where in the step that was.
        const since = timer.clock - timer.lapStart;
        this._push(p, 1 - since / dt);
        best = new GhostLap(this.hz, Float32Array.from(this.buf.subarray(0, this.count * CHANNELS)),
          lap.time, timer.chassisId);
      }
      this._laps = laps;
      this.recording = false;
    }

    if (!timer.running) {
      this.recording = false;
      return best;
    }
    if (!this.recording || timer.lapStart !== this._lapStart) {
      this.recording = true;
      this._lapStart = timer.lapStart;
      this.count = 0;
      this._next = 0;
      this._tooLong = false;
    }

    // This step covered lap time (t0, t1]. Any sample due in that window is
    // the car's state interpolated to it.
    const t1 = timer.clock - timer.lapStart;
    if (t1 > GHOST.maxLap) { this._tooLong = true; return best; }
    const t0 = t1 - dt;
    while (this._next / this.hz <= t1 + 1e-9) {
      this._push(p, (this._next / this.hz - t0) / dt);
      this._next++;
    }
    return best;
  }

  _push(p, a) {
    a = a < 0 ? 0 : a > 1 ? 1 : a;
    if ((this.count + 1) * CHANNELS > this.buf.length) {
      const grown = new Float64Array(this.buf.length * 2);
      grown.set(this.buf);
      this.buf = grown;
    }
    const b = this.buf, o = this.count * CHANNELS;
    b[o] = p.prevX + (p.x - p.prevX) * a;
    b[o + 1] = p.prevY + (p.y - p.prevY) * a;
    b[o + 2] = p.prevZ + (p.z - p.prevZ) * a;
    b[o + 3] = p.prevYaw + angleDelta(p.prevYaw, p.yaw) * a;
    b[o + 4] = p.prevPitch + (p.pitch - p.prevPitch) * a;
    b[o + 5] = p.prevRoll + (p.roll - p.prevRoll) * a;
    this.count++;
  }
}

// To and from what goes in localStorage.
export function encodeGhost(lap) {
  const f = lap.frames, n = lap.count;
  const d = new Array(n * CHANNELS);
  const last = [0, 0, 0, 0, 0, 0];
  for (let k = 0; k < n; k++) {
    for (let c = 0; c < CHANNELS; c++) {
      const q = Math.round(f[k * CHANNELS + c] * (c < 3 ? POS_Q : ANG_Q));
      d[k * CHANNELS + c] = q - last[c];
      last[c] = q;
    }
  }
  return { format: FORMAT, hz: lap.hz, time: lap.time, chassis: lap.chassis, car: lap.car, count: n, d };
}

// Null for anything that is not a ghost this version wrote: what comes out of
// storage is whatever was there, including an older game or an edit by hand.
export function decodeGhost(raw) {
  if (!raw || typeof raw !== 'object' || raw.format !== FORMAT) return null;
  const { hz, time, count, d } = raw;
  if (!(hz > 0 && hz <= 240)) return null;
  if (!(time > 0 && time < 3600)) return null;
  if (!Number.isInteger(count) || count < 2 || count > time * hz + 3) return null;
  if (!Array.isArray(d) || d.length !== count * CHANNELS) return null;
  const frames = new Float32Array(count * CHANNELS);
  const acc = [0, 0, 0, 0, 0, 0];
  for (let i = 0; i < d.length; i++) {
    const v = d[i];
    if (!Number.isInteger(v)) return null;
    const c = i % CHANNELS;
    acc[c] += v;
    frames[i] = acc[c] / (c < 3 ? POS_Q : ANG_Q);
  }
  return new GhostLap(hz, frames, time,
    typeof raw.chassis === 'string' ? raw.chassis : null,
    raw.car && typeof raw.car === 'object' ? raw.car : null);
}
