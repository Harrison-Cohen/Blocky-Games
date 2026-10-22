// One AI car lapping a track area, replayed from a recording while it is far
// away and driven by the real physics when it is near, with an exact hand-over.
//
// The rule that keeps AI cars honest is "never move one along a spline". This is
// the one narrow exception, for scenery you are kilometres from, and it earns it:
//
//   RECORD   once, headless, the real VehiclePhysics and AIDriver drive a warm-up
//            lap and then one lap that is kept. For every physics step of that
//            lap the pose is stored (what a mesh needs), and every `keyEvery`
//            steps the FULL state of the car and of its driver is stored.
//   REPLAY   far away, the pose for the current step is put on the car. No
//            physics runs.
//   LIVE     near, the keyframe at or before the current step is loaded and the
//            physics stepped forward to it -- fewer than `keyEvery` steps, a few
//            milliseconds -- and from then on the car is driven live, by the same
//            code, exactly as if it had never stopped.
//
// It is exact because the AI is deterministic (npm run ai asserts it): the state
// loaded from a keyframe and stepped on equals the state the recording went
// through, number for number, and npm run world proves it from a few hundred
// seeded times on every track. So nothing pops when you come near.
//
// All of it is on the integer step count, never on seconds, so there is no
// rounding to disagree about. The recording is a loop: the lap is its period.

import { VehiclePhysics, STATE_LENGTH } from '../game/VehiclePhysics.js';
import { AIDriver, DRIVER_STATE_LENGTH } from '../ai/AIDriver.js';
import { SIM } from '../data/tuning.js';

// x y z yaw pitch roll wheelSpin c0 c1 c2 c3 steerAngleUsed brake handbrakeBlend
export const POSE = 14;
const KEY = STATE_LENGTH + DRIVER_STATE_LENGTH;
const DT = 1 / SIM.hz;
const MAX_STEPS = SIM.hz * 400;     // a lap that takes longer than this is not a lap

function writePose(p, out, o) {
  out[o] = p.x; out[o + 1] = p.y; out[o + 2] = p.z;
  out[o + 3] = p.yaw; out[o + 4] = p.pitch; out[o + 5] = p.roll; out[o + 6] = p.wheelSpin;
  out[o + 7] = p.compression[0]; out[o + 8] = p.compression[1];
  out[o + 9] = p.compression[2]; out[o + 10] = p.compression[3];
  out[o + 11] = p.steerAngleUsed; out[o + 12] = p.brake; out[o + 13] = p.handbrakeBlend;
}
function writePrevPose(p, out, o) {
  out[o] = p.prevX; out[o + 1] = p.prevY; out[o + 2] = p.prevZ;
  out[o + 3] = p.prevYaw; out[o + 4] = p.prevPitch; out[o + 5] = p.prevRoll; out[o + 6] = p.prevWheelSpin;
  out[o + 7] = p.prevCompression0; out[o + 8] = p.prevCompression1;
  out[o + 9] = p.prevCompression2; out[o + 10] = p.prevCompression3;
  out[o + 11] = p.steerAngleUsed; out[o + 12] = p.brake; out[o + 13] = p.handbrakeBlend;
}

export class AmbientCar {
  // slot of slots: where round the lap this car starts, so they are spread out.
  constructor(track, line, chassis, style, slot, slots, keyEvery) {
    this.track = track;
    this.line = line;
    this.chassis = chassis;
    this.slot = slot;
    this.slots = slots;
    this.keyEvery = keyEvery;
    this.physics = new VehiclePhysics(chassis);
    this.driver = new AIDriver(track, line, chassis, style);
    this.ready = false;
    this.failed = false;
    this.live = false;
    this.period = 0;              // steps in the recorded lap
    this.lapTime = 0;
    this.pose = null;             // Float32Array: slot 0 is the pose before step 0, slot j + 1 is after step j
    this.keys = null;             // Float64Array: a keyframe per keyEvery steps
    this.wrap = { distance: 0, yaw: 0 };   // how far the end of the lap is from its start
  }

  // Record the car's lap. A generator: it yields after every `slice` physics
  // steps so the caller can spend a few milliseconds a frame on it.
  *record(slice = 1500) {
    const t = this.track, n = t.count;
    const p = this.physics, d = this.driver;
    const start = (t.startSample + Math.round((this.slot * n) / this.slots)) % n;
    const sp = t.spawnAt(start, 0, this.line.offset[start]);
    p.reset(sp.x, t.sample(sp.x, sp.z, sp.y).height + this.chassis.suspensionRest, sp.z, sp.yaw);
    d.reset();
    // A flying start, at most the speed the profile wants there.
    p.vLong = d.profile.v[start] * 0.85;

    let prog = 0, last = start, steps = 0;
    const advance = () => {
      let dl = d.sample - last;
      if (dl > n / 2) dl -= n; else if (dl < -n / 2) dl += n;
      if (dl > 0) prog += dl;
      last = d.sample;
    };

    // Warm-up: one lap, discarded, so the lap that is kept starts from a car that
    // has settled on its line rather than from a standing guess.
    while (prog < n) {
      p.step(DT, d.update(DT, p), t);
      advance();
      if (++steps > MAX_STEPS) { this.failed = true; return; }
      if (steps % slice === 0) yield;
    }

    // The recorded lap. Step j's state is S_j; slot 0 of the pose track is the
    // pose before step 0 (so the first interpolated frame is exact too).
    let cap = 1 << 14;
    let pose = new Float32Array(cap * POSE);
    const keys = [];
    writePrevPose(p, pose, 0);
    writePose(p, pose, POSE);
    keys.push(p.copyState(), d.copyState());
    prog = 0; last = d.sample;
    let j = 0;
    while (prog < n) {
      p.step(DT, d.update(DT, p), t);
      advance();
      j++;
      if (j > MAX_STEPS) { this.failed = true; return; }
      if ((j + 2) * POSE > pose.length) { const g = new Float32Array(pose.length * 2); g.set(pose); pose = g; }
      writePose(p, pose, (j + 1) * POSE);
      if (prog < n && j % this.keyEvery === 0) keys.push(p.copyState(), d.copyState());
      if (j % slice === 0) yield;
    }
    // j steps made the lap: the state now is, near enough, the state at step 0.
    this.period = j;
    this.lapTime = j * DT;
    this.wrap.distance = Math.hypot(p.x - pose[POSE], p.y - pose[POSE + 1], p.z - pose[POSE + 2]);
    this.wrap.yaw = Math.abs(p.yaw - pose[POSE + 3]);
    this.pose = pose.slice(0, (j + 1) * POSE);
    const flat = new Float64Array((keys.length / 2) * KEY);
    for (let k = 0; k < keys.length / 2; k++) {
      flat.set(keys[k * 2], k * KEY);
      flat.set(keys[k * 2 + 1], k * KEY + STATE_LENGTH);
    }
    this.keys = flat;
    this.ready = true;
  }

  // The state of the lap at step n, by loading the keyframe at or before it and
  // stepping on, then keep driving live. Exact.
  goLive(n) {
    const T = this.period;
    const m = n % T;
    const k = Math.floor(m / this.keyEvery);
    const o = k * KEY;
    const p = this.physics, d = this.driver;
    p.loadState(this.keys.subarray(o, o + STATE_LENGTH));
    d.loadState(this.keys.subarray(o + STATE_LENGTH, o + KEY));
    for (let s = k * this.keyEvery; s < m; s++) p.step(DT, d.update(DT, p), this.track);
    this.live = true;
  }

  goReplay() { this.live = false; }

  // One fixed physics step, for a car that is live.
  step() {
    if (this.live) this.physics.step(DT, this.driver.update(DT, this.physics), this.track);
  }

  // Replay: put the recorded pose for step n (and the one before, for the
  // interpolation) on the physics object, which a mesh then reads exactly as it
  // would a live car's.
  puppet(n) {
    const T = this.period, pose = this.pose;
    const m = n % T;
    const c = (m + 1) * POSE, b = m * POSE;     // after step m, and before it
    const p = this.physics;
    p.prevX = pose[b]; p.prevY = pose[b + 1]; p.prevZ = pose[b + 2];
    p.prevYaw = pose[b + 3]; p.prevPitch = pose[b + 4]; p.prevRoll = pose[b + 5]; p.prevWheelSpin = pose[b + 6];
    p.prevCompression0 = pose[b + 7]; p.prevCompression1 = pose[b + 8];
    p.prevCompression2 = pose[b + 9]; p.prevCompression3 = pose[b + 10];
    p.x = pose[c]; p.y = pose[c + 1]; p.z = pose[c + 2];
    p.yaw = pose[c + 3]; p.pitch = pose[c + 4]; p.roll = pose[c + 5]; p.wheelSpin = pose[c + 6];
    p.compression[0] = pose[c + 7]; p.compression[1] = pose[c + 8];
    p.compression[2] = pose[c + 9]; p.compression[3] = pose[c + 10];
    p.steerAngleUsed = pose[c + 11]; p.brake = pose[c + 12]; p.handbrakeBlend = pose[c + 13];
  }
}
