// Shared by the flight checks and the refit script: a headless aircraft, a
// field to put it on, and a few scripted pilots. No Three.js, no browser.
import { fileURLToPath } from 'node:url';
export const R = fileURLToPath(new URL('../../src/', import.meta.url));
const { AircraftPhysics, attitude, createAttitude } = await import(R + 'flight/AircraftPhysics.js');
const { TestField } = await import(R + 'world/TestField.js');
const { FLIGHT, SIM } = await import(R + 'data/tuning.js');
export { AircraftPhysics, attitude, createAttitude, TestField, FLIGHT, SIM };
export const FT = 0.3048, KT = 0.514444;
export const DT = 1 / SIM.hz;

export const field = new TestField();

export function makeInput(over = {}) {
  return Object.assign({ pitch: 0, roll: 0, yaw: 0, analog: true, throttleRate: 0, throttleKick: 0,
    ab: false, brake: 0, gearDown: false, airbrake: false }, over);
}

// An aircraft flying level at altitude `h` metres and `mach`, wings level,
// gear up, at a given fuel fraction.
export function airborne(def, { h = 3000, mach = 0.6, fuel = 0.5, throttle = 0.8, heading = 0 } = {}) {
  const p = new AircraftPhysics(def);
  // Speed of sound there, from the model's own atmosphere.
  p.y = h;
  p.reset({ x: 0, y: h, z: 0, heading, speed: 1, fuel, throttle, gear: 0 });
  p.step(DT, makeInput(), field);        // fills p.atm
  const tas = mach * p.atm.a;
  p.reset({ x: 0, y: h, z: 0, heading, pitch: 0.03, speed: tas, fuel, throttle, gear: 0 });
  return p;
}

// Holds altitude with the stick: climbs or descends toward `target` metres,
// leaving the auto-trim to hold the path in between.
export function altitudeHold(p, inp, target, gain = 1) {
  const err = target - p.y;
  const wantVy = Math.max(-40, Math.min(40, err * 0.12));
  const e = wantVy - p.vy;
  // A dead band: the stick centres when the climb rate is near what is wanted,
  // which is when the auto-trim takes over and holds the path.
  const dead = 0.8;
  const f = Math.abs(e) < dead ? 0 : e - Math.sign(e) * dead;
  inp.pitch = Math.max(-0.6, Math.min(0.6, f * 0.02 * gain));
}

export function run(p, inp, seconds, onStep) {
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) {
    if (onStep) onStep(i * DT);
    p.step(DT, inp, field);
  }
}

// --- performance measurements, shared by the checks and the refit --------------

// The Mach number it settles at in level flight at `h` metres, held there by
// the stick, from a start at `m0` (above the answer, so the transonic drag peak
// cannot trap it). `ab` selects the afterburner.
export function levelMach(def, h, ab, m0, secs = 480, fuel = 0.5) {
  const p = airborne(def, { h, mach: m0, fuel, throttle: 1 });
  const inp = makeInput({ ab });
  run(p, inp, secs, () => { altitudeHold(p, inp, h); p.abFuel = 1; });
  return p;
}

// Seconds to accelerate from Mach `m0` to `m1` in afterburner at `h`, or -1.
export function accelTime(def, h, m0, m1, limit = 200, fuel = 0.5) {
  const p = airborne(def, { h, mach: m0, fuel, throttle: 1 });
  const inp = makeInput({ ab: true });
  let t1 = -1;
  run(p, inp, limit, (t) => {
    altitudeHold(p, inp, h); p.abFuel = 1;
    if (t1 < 0 && p.mach >= m1) t1 = t;
  });
  return t1;
}

// An aircraft trimmed in level flight at `h` metres and `casKt` knots of
// calibrated airspeed, the stick centred, the throttle held where the speed
// stays. Returns { p, inp }; the throttle is left as the lever sits.
export function trimmedFlight(def, h, casKt, { analog = false, fuel = 0.5 } = {}) {
  const p = airborne(def, { h, mach: 0.5, fuel, throttle: 0.7 });
  const tas = (casKt * KT) / Math.sqrt(p.atm.sigma);
  p.reset({ x: 0, y: h, z: 0, heading: 0, pitch: 0.03, speed: tas, fuel, throttle: 0.7, gear: 0 });
  const inp = makeInput({ analog });
  const target = p.tas;
  run(p, inp, 40, () => { inp.throttleRate = Math.max(-1, Math.min(1, (target - p.tas) * 0.05)); altitudeHold(p, inp, h); });
  inp.pitch = 0; inp.roll = 0; inp.yaw = 0; inp.throttleRate = 0;
  return { p, inp };
}
