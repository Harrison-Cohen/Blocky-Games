// Measurements and scripted pilots for an airliner (the 737), shared by the refit script
// and the checks. They sit beside the F-22's (flight-harness.mjs), which they use, and
// leave those alone: the F-22's pilots are tuned to a fighter and are held to the bit by
// the identity check.
//
// Everything here flies the real AircraftPhysics. The airliner is flown the way a pilot
// flies one: the autopilot holds the altitude, the lever and the flaps are set by hand.

import * as H from './flight-harness.mjs';

const { KT, FT, DT, makeInput, FLIGHT } = H;
const { Autopilot } = await import(H.R + 'flight/Autopilot.js');
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export { KT, FT, DT, makeInput, Autopilot };

// kg of payload that makes the aircraft `total` kg with `fuel` (a fraction of the tank).
export const payloadFor = (def, total, fuel) => total - def.emptyMass - def.fuelCapacity * fuel;

// A new airframe in the air at `h` metres, level, at calibrated speed `casKt` knots (or
// `mach`), the flaps and gear as given, ready to fly. The mass is `payload` kg of load
// and `fuel` of the tank.
export function inAir(def, { h = 3000, casKt = 250, mach = 0, fuel = 0.5, payload, throttle = 0.6, flaps = 0, gear = 0 } = {}) {
  const p = new H.AircraftPhysics(def);
  if (payload != null) p.setup({ payload });
  p.reset({ x: 0, y: h, z: 0, heading: 0, speed: 1, fuel, throttle, gear, flaps });
  const inp = makeInput({ analog: false, gearDown: !!gear, flaps });
  p.step(DT, inp, H.field);                              // fills p.atm
  const tas = mach > 0 ? mach * p.atm.a : (casKt * KT) / Math.sqrt(p.atm.sigma);
  p.reset({ x: 0, y: h, z: 0, heading: 0, pitch: 0.03, speed: tas, fuel, throttle, gear, flaps });
  p.flapPos = flaps;
  return { p, inp };
}

// The altitude loop the measurements below were made with: a hand held at a height for the
// purpose of measuring something else (the stall, the ceiling), so it must not move when the
// autopilot's own tuning (tuning.js, AUTOPILOT) is improved. The autopilot checks ask for the
// tuned one with `tuned: true`.
const MEASURING = { kAlt: 0.045, kAltI: 0.002, kVs: 0.03, pitchMax: 0.4, intBand: 1e9, spdMin: 30, spdMax: 400 };

// Flies `seconds` with the autopilot holding what `holds` says ({ alt, hdg, spd }, the
// targets being where it is now unless `targets` says otherwise). onStep(t, p, ap, cmd)
// is called before each step. Returns { p, ap, inp, cmd }.
export function flyAP(def, o, seconds, { holds = { alt: true, hdg: true, spd: false }, targets = {}, onStep, tuned = false } = {}) {
  const { p, inp } = inAir(def, o);
  const ap = new Autopilot(def), cmd = makeInput({ analog: false });
  if (!tuned && def.id === 'b737') Object.assign(ap.cfg, MEASURING);
  H.run(p, inp, 2);
  ap.engage(p);
  ap.altHold = !!holds.alt; ap.hdgHold = !!holds.hdg; ap.spdHold = !!holds.spd;
  if (targets.alt != null) ap.alt = targets.alt;
  if (targets.spd != null) ap.spd = targets.spd;
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) {
    const t = i * DT;
    if (onStep) onStep(t, p, ap, inp);
    ap.step(DT, p, inp, cmd);
    p.step(DT, cmd, H.field);
  }
  return { p, ap, inp, cmd };
}

// The Mach number it settles at in level flight at `h`, the lever fixed at `lever`,
// from a start at `m0` (above the answer, so the drag rise cannot trap it).
export function settledMach(def, h, lever, { m0 = 0.86, fuel = 0.5, payload, seconds = 900 } = {}) {
  const { p } = flyAP(def, { h, mach: m0, fuel, payload, throttle: lever }, seconds, {
    holds: { alt: true, hdg: true, spd: false },
    onStep: (t, q, ap, inp) => { inp.throttleRate = 0; q.throttle = lever; },
  });
  return p;
}

// The most climb it has at `h` and mass: with the lever at the stop and the altitude
// held, the speed it gains is the climb it could make (specific excess power over
// gravity), at the best of a few Mach numbers. m/s.
export function climbPotential(def, h, { fuel = 0.4, payload, machs = [0.6, 0.66, 0.72, 0.78] } = {}) {
  let best = -1e9;
  for (const mach of machs) {
    let v0 = 0, t0 = 0, v1 = 0;
    const { p } = flyAP(def, { h, mach, fuel, payload, throttle: 1 }, 14, {
      holds: { alt: true, hdg: true, spd: false },
      onStep: (t, q, ap, inp) => { inp.throttleRate = 0; q.throttle = 1; if (Math.abs(t - 6) < DT / 2) { v0 = q.tas; t0 = t; } },
    });
    v1 = p.tas;
    const accel = (v1 - v0) / (14 - t0);
    // Gaining speed while holding height: the climb it could trade it for.
    best = Math.max(best, (accel * p.tas) / 9.81);
  }
  return best;
}

// The speed (knots calibrated) at which it stalls in level flight with the flaps at
// `flaps` (the detent), the gear down when the flaps are out. The autopilot holds the
// height and the speed bleeds away at `decel` knots a second (the lever follows a
// falling speed target), so the stick is pulled as it goes. The aids' easing of the pull
// near the stall is off, so the airframe is let go on to the stall itself; the trim and
// the rest stay. The 1 g stall speed.
export function stallSpeed(def, { flaps = 0, fuel = 0.5, payload, h = 3000, gear = flaps >= 2 ? 1 : 0, start = 230, decel = 0.4 } = {}) {
  // Begin each configuration within its placard speed now that overspeed causes damage.
  start = Math.min(start, (def.flaps.detents[flaps].vfe / KT) * 0.95);
  const soft = [FLIGHT.softAlpha, FLIGHT.softPush];
  FLIGHT.softAlpha = 0.9999; FLIGHT.softPush = 0;
  try {
    let at = -1;
    flyAP(def, { h, casKt: start, fuel, payload, throttle: 0.6, flaps, gear }, 600, {
      holds: { alt: true, hdg: true, spd: true },
      onStep: (t, p, ap, inp) => {
        if (at >= 0) return;
        inp.flaps = flaps; inp.gearDown = !!gear;
        ap.spd = Math.max(40, (start - decel * Math.max(0, t - 10)) * KT);
        if (p.stalled) at = p.cas / KT;
      },
    });
    return at;
  } finally { [FLIGHT.softAlpha, FLIGHT.softPush] = soft; }
}

// --- takeoff and landing ------------------------------------------------------------------
// The runway of the test field as an airport would give it, so the F-22's centre line pilot
// works on it: u along the runway, v across it positive to the left, heading north.
export const fieldRunway = { heading: 0, cos: 1, sin: 0, base: 0, length: 3500, toLocal(x, z, out) { out.u = z; out.v = x; return out; } };
const wrapPi = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const _loc = { u: 0, v: 0 };

const vsCache = new Map();
// The 1 g stall speed (knots calibrated) at the flap detent and 65 tonnes, measured once.
export function vsRef(def, flaps) {
  const k = `${def.id}/${flaps}`;
  if (!vsCache.has(k)) vsCache.set(k, stallSpeed(def, { flaps, payload: payloadFor(def, 65000, 0.5) }));
  return vsCache.get(k);
}
// What it is at `mass`: the stall speed goes as the square root of the weight.
export const vsAt = (def, flaps, mass) => vsRef(def, flaps) * Math.sqrt(mass / 65000);

// A takeoff from `pose` ({ x, y, z, heading }, y the ground) on `ground`, the runway
// frame `ap`: the lever at the stop, the flaps at the detent, the tail held on the
// centre line by the rudder, rotated at `vrFactor` times the stall speed at three degrees
// a second to `climbPitch` degrees, the gear up once it is climbing. Returns the distance
// to the wheels being 35 feet up, the roll, the speeds, and whether anything went wrong.
export function takeoffRun(def, ground, ap, pose, { flaps = 1, fuel = 1, total = 79016, payload, vrFactor = 1.07, rotRate = 3, climbPitch = 12, seconds = 90, wheelH = 3.45, wind = null, trace = null } = {}) {
  payload = payload ?? payloadFor(def, total, fuel);
  const p = new H.AircraftPhysics(def);
  p.setup({ payload });
  p.reset({ x: pose.x, y: pose.y + wheelH + 0.05, z: pose.z, heading: pose.heading, fuel, gear: 1, throttle: 1, flaps });
  const inp = makeInput({ gearDown: true, analog: false, flaps });
  const vr = vrFactor * vsAt(def, flaps, p.mass) * KT;
  const r = { vr: vr / KT, liftoff: -1, liftoffSpeed: 0, roll: 0, d35: -1, v35: 0, tailStrike: false, crashed: false, maxOff: 0, mass: p.mass, time35: -1, p };
  let u0 = null, tRot = -1;
  H.runOn(ground, p, inp, seconds, (t) => {
    ap.toLocal(p.x, p.z, _loc);
    if (u0 === null) u0 = _loc.u;
    const att = p.attitude();
    const agl = p.y - wheelH - ap.base;
    if (p.cas >= vr && tRot < 0) tRot = t;
    const tgt = tRot < 0 ? 0 : Math.min(climbPitch, (t - tRot) * rotRate) * Math.PI / 180;
    inp.pitch = tRot < 0 ? 0 : clamp((tgt - att.pitch) * 5, -0.6, 1);
    inp.yaw = H.centreLine(p, ap, 1);
    if (p.gear.hullHit > 0 || p.gear.skidHit > 0) r.tailStrike = true;
    if (r.liftoff < 0 && !p.onGround && agl > 0.5) { r.liftoff = t; r.liftoffSpeed = p.cas / KT; r.roll = _loc.u - u0; }
    if (r.d35 < 0 && agl >= 10.67) { r.d35 = _loc.u - u0; r.v35 = p.cas / KT; r.time35 = t; }
    if (agl > 15 && p.climb > 1) inp.gearDown = false;
    if (p.onGround) r.maxOff = Math.max(r.maxOff, Math.abs(_loc.v));
    if (trace && Math.abs(t % 5) < H.DT / 2) trace.push(`${t.toFixed(0)}s u ${(_loc.u - u0).toFixed(0)} cas ${(p.cas / KT).toFixed(0)} pitch ${(att.pitch * 57.3).toFixed(1)} agl ${agl.toFixed(1)} vy ${p.vy.toFixed(1)}`);
  });
  r.crashed = p.crashed;
  r.reason = p.crashReason;
  return r;
}

// A landing: down a 3 degree path to an aim point `aim` metres past the threshold at the
// approach speed, flared to a gentle sink, the spoilers and the brakes on the roll. Call it
// every step before the physics steps, as the F-22's. Reads back: where it crossed 50 feet,
// where it touched down and how hard, where it stopped.
export function landingPilot(def, ap, { glide = 3, aim = 280, vref, flaps = 3, flareAgl = 12, wheelH = 3.45, brakeDelay = 1.0, pitchGain = 0.03, flarePitch = 3.5, flareRate = 2, brake = 1, yawGain = 0.5, idleAgl = 20 } = {}) {
  const tanG = Math.tan((glide * Math.PI) / 180), sinG = Math.sin((glide * Math.PI) / 180);
  const st = { touched: false, tdU: 0, tdSink: 0, tdTime: -1, stopped: false, stopU: 0, stopTime: -1, maxOff: 0, u50: null, v50: 0, minAgl: 1e9, decel: 0 };
  // The speed is held by the autopilot's speed loop (a PI controller on the lever), the
  // path and the flare by the stick, the centre line by the rudder.
  const spd = new Autopilot(def), scratch = makeInput({ analog: false });
  let pitchTgt = null;
  spd.altHold = false; spd.hdgHold = false; spd.spdHold = true;
  st.step = (p, inp, time) => {
    ap.toLocal(p.x, p.z, _loc);
    const agl = p.y - ap.base - wheelH;
    inp.gearDown = true; inp.flaps = flaps;
    if (st.u50 === null && agl <= 15.24 && !p.onGround) { st.u50 = _loc.u; st.v50 = p.cas / KT; }
    if (!st.touched && p.onGround) { st.touched = true; st.tdU = _loc.u; st.tdSink = p.gear.touchdownSink; st.tdTime = time; }
    if (!p.onGround && !st.touched) {
      if (!spd.on) { spd.engage(p); spd.altHold = false; spd.hdgHold = false; spd.spdHold = true; }
      spd.spd = vref;
      spd.step(DT, p, inp, scratch);
      const err = Math.max(0, aim - _loc.u) * tanG - agl;
      let wantVy = -p.tas * sinG + 0.1 * err;
      wantVy = clamp(wantVy, -8, 2);
      if (agl < flareAgl) {
        // The flare: the nose is brought up to a landing attitude at a steady rate and
        // held there, and the aircraft settles on it.
        const pitch = p.attitude().pitch;
        if (pitchTgt === null) pitchTgt = pitch;
        pitchTgt = Math.min((flarePitch * Math.PI) / 180, pitchTgt + (flareRate * Math.PI / 180) * DT);
        inp.pitch = clamp((pitchTgt - pitch) * 5, -0.5, 0.5);
      } else {
        inp.pitch = clamp((wantVy - p.vy) * pitchGain, -0.5, 0.5);
      }
      inp.throttleRate = agl < idleAgl ? -1 : scratch.throttleRate;
      inp.yaw = H.centreLine(p, ap, yawGain);
      inp.brake = 0; inp.airbrake = false;
      st.minAgl = Math.min(st.minAgl, agl);
    } else {
      // Rolling out: the lever to idle, the nose let down gently, the spoilers (they come out
      // by themselves too), the brakes once the wheels are firmly on, the rudder on the line.
      inp.throttleRate = -1;
      const pitch = p.attitude().pitch;
      inp.pitch = pitch > 0.03 ? -0.15 : 0;
      inp.yaw = H.centreLine(p, ap);
      inp.airbrake = true;
      inp.brake = st.touched && time - st.tdTime > brakeDelay ? brake : 0;
      st.maxOff = Math.max(st.maxOff, Math.abs(_loc.v));
      if (st.stopTime < 0 && p.speed < 0.5) { st.stopped = true; st.stopU = _loc.u; st.stopTime = time; }
    }
  };
  return st;
}

// Lands `def` at `mass` on `ground`'s runway `ap` from a 3 degree approach that starts
// `dist` metres out: returns the pilot's record and the physics.
export function landingRun(def, ground, ap, pose, { total = 66360, fuel = 0.3, flaps = 3, vrefFactor = 1.23, dist = 5000, glide = 3, aim = 280, seconds = 160, wheelH = 3.45, trace = null, ...opts } = {}) {
  const payload = payloadFor(def, total, fuel);
  const p = new H.AircraftPhysics(def);
  p.setup({ payload });
  const vs = vsAt(def, flaps, total) * KT;
  const vref = vrefFactor * vs;
  // The approach starts `dist` metres before the threshold (`pose`, on the ground) on the
  // runway's heading, up the glide path that meets the ground at the aim point.
  const hd = ap.heading;
  const h0 = (aim + dist) * Math.tan((glide * Math.PI) / 180);
  const startX = pose.x + Math.sin(hd) * dist, startZ = pose.z - Math.cos(hd) * dist;
  p.reset({ x: startX, y: pose.y + wheelH + h0, z: startZ, heading: hd, pitch: 0.04, speed: vref, fuel, gear: 1, throttle: 0.4, flaps });
  p.flapPos = flaps;
  const inp = makeInput({ gearDown: true, analog: false, flaps });
  const pilot = landingPilot(def, ap, { glide, aim, vref, flaps, wheelH, ...opts });
  H.runOn(ground, p, inp, seconds, (t) => {
    pilot.step(p, inp, t);
    if (trace && Math.abs(t % 10) < H.DT / 2) { ap.toLocal(p.x, p.z, _loc); trace.push(`${t.toFixed(0)}s u ${_loc.u.toFixed(0)} cas ${(p.cas / KT).toFixed(0)} agl ${(p.y - wheelH - ap.base).toFixed(1)} vy ${p.vy.toFixed(1)} thr ${p.throttle.toFixed(2)} onGnd ${p.onGround}`); }
  });
  return { st: pilot, p, vref: vref / KT, vs: vs / KT, mass: p.mass };
}

// An airliner trimmed in level flight at `h` metres and `casKt` knots, the stick centred and
// the autopilot off: settled for `settle` seconds under the autopilot, then let go. Returns
// { p, inp } like the F-22's trimmedFlight.
export function trimmedAirliner(def, h, casKt, { fuel = 0.5, payload, flaps = 0, gear = 0, settle = 40 } = {}) {
  const { p, inp, ap } = flyAP(def, { h, casKt, fuel, payload, throttle: 0.6, flaps, gear }, settle, {
    holds: { alt: true, hdg: true, spd: true },
    onStep: (t, q, a, i) => { i.flaps = flaps; i.gearDown = !!gear; },
  });
  inp.pitch = 0; inp.roll = 0; inp.yaw = 0; inp.throttleRate = 0;
  inp.flaps = flaps; inp.gearDown = !!gear;
  return { p, inp, ap };
}
