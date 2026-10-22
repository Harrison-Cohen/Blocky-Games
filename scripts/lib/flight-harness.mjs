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

// --- airports: pilots that fly a runway at any heading --------------------------------
// The scripted pilots above fly a runway along +z at x = 0. An airport's runway is
// wherever it is, pointing wherever it points: these work in the runway's own frame
// (Airport.toLocal: u along it, v across it, positive to the left).
const clampv = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const wrapPi = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const _loc = { u: 0, v: 0 };

// Keeps the aircraft on the centre line: the pedal from how far it is off it, how fast
// it is going away from it, and how far it points off the runway's heading.
export function centreLine(p, ap, gain = 1) {
  ap.toLocal(p.x, p.z, _loc);
  const he = wrapPi(p.attitude().heading - ap.heading);
  const across = p.vx * ap.cos + p.vz * ap.sin;
  return clampv(gain * (0.05 * _loc.v + 0.3 * across - 1.6 * he), -1, 1);
}

// A takeoff in afterburner from the start of `ap`'s runway: rotate at 125 kt, hold the
// climb attitude, gear up at 60 m. Call it every step before the physics steps.
export function takeoffPilot(ap) {
  const st = { lifted: false, liftoff: -1, liftSpeed: 0, roll: 0, tailStrike: false, u0: null };
  st.step = (p, inp, time) => {
    ap.toLocal(p.x, p.z, _loc);
    if (st.u0 === null) st.u0 = _loc.u;
    const cas = p.cas / KT;
    const agl = p.y - ap.base;
    inp.pitch = cas > 125 && agl < 60 ? Math.max(0, Math.min(0.5, ((st.lifted ? 0.17 : 0.14) - p.attitude().pitch) * 4)) : 0;
    inp.yaw = centreLine(p, ap);
    if (p.gear.hullHit > 0 || p.gear.skidHit > 0) st.tailStrike = true;
    if (st.liftoff < 0 && !p.onGround && agl > 3) { st.liftoff = time; st.liftSpeed = cas; st.roll = _loc.u - st.u0; st.lifted = true; }
    if (agl > 60) inp.gearDown = false;
  };
  return st;
}

// Step an aircraft over a ground (a World, or the test field) for `seconds`, calling
// onStep(time) before each step.
export function runOn(ground, p, inp, seconds, onStep) {
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) {
    if (onStep) onStep(i * DT);
    p.step(DT, inp, ground);
  }
}

// A landing: a 3 degree approach to an aim point past the threshold, gear down, the
// speed held at `vref` (m/s calibrated), a flare to a gentle sink, the throttle back,
// then brakes and the airbrake and the centre line on the way out. Call it every step
// before the physics steps. `st` reads back: the touchdown (where, how hard), where it
// stopped, how far off the line it went.
export function landingPilot(ap, { glide = 3, aim = 300, vref = 76, flareAgl = 22, brakeDelay = 1.5 } = {}) {
  const tanG = Math.tan((glide * Math.PI) / 180), sinG = Math.sin((glide * Math.PI) / 180);
  const st = { touched: false, tdU: 0, tdSink: 0, tdTime: -1, stopped: false, stopU: 0, stopTime: -1, maxOff: 0, minAgl: 1e9 };
  st.step = (p, inp, time) => {
    ap.toLocal(p.x, p.z, _loc);
    const agl = p.y - ap.base - 1.75;           // the wheels' height over the ground
    const cas = p.cas;
    inp.gearDown = true;
    if (!st.touched && p.onGround) { st.touched = true; st.tdU = _loc.u; st.tdSink = p.gear.touchdownSink; st.tdTime = time; }
    if (!p.onGround && !st.touched) {
      const err = (Math.max(0, aim - _loc.u)) * tanG - agl;         // above the path: negative
      let wantVy = -p.tas * sinG + 0.1 * err;
      if (agl < flareAgl) wantVy = -Math.max(0.3, Math.min(2.0, 0.07 * agl));
      wantVy = Math.max(-8, Math.min(2, wantVy));
      const e = wantVy - p.vy;
      const dead = 0.15;
      const fe = Math.abs(e) < dead ? 0 : e - Math.sign(e) * dead;
      inp.pitch = Math.max(-0.5, Math.min(0.5, fe * 0.06));
      inp.throttleRate = agl < flareAgl * 0.7 ? -1 : Math.max(-1, Math.min(1, (vref - cas) * 0.12));
      inp.yaw = centreLine(p, ap, 0.8);
      inp.brake = 0; inp.airbrake = false;
      st.minAgl = Math.min(st.minAgl, agl);
    } else {
      // Rolling out: hold the nose a little up for the aerodynamic braking, then let it
      // down; brakes once the wheels are firmly on; the pedal keeps the centre line.
      inp.throttleRate = -1;
      const pitch = p.attitude().pitch;
      inp.pitch = pitch > 0.07 ? -0.25 : 0;
      inp.yaw = centreLine(p, ap);
      inp.airbrake = true;
      inp.brake = st.touched && time - st.tdTime > brakeDelay ? 1 : 0;
      st.maxOff = Math.max(st.maxOff, Math.abs(_loc.v));
      if (st.stopTime < 0 && p.speed < 0.5) { st.stopped = true; st.stopU = _loc.u; st.stopTime = time; }
    }
  };
  return st;
}

// A taxi: follows a route of (u, v) points in an airport's frame at a walking speed,
// the pedal from the heading it wants, the lever from the speed it wants (the taxi
// governor turns the lever into a speed). `st.done` when the last point is reached;
// `st.off` counts steps with a wheel off the pavement.
export function taxiPilot(ap, route, { speed = 5, slow = 3, reach = 7 } = {}) {
  const st = { i: 0, done: false, off: 0, maxSpeed: 0 };
  st.step = (p, inp, ground) => {
    if (st.done) { p.throttle = 0; inp.yaw = 0; return; }
    ap.toLocal(p.x, p.z, _loc);
    const wp = route[st.i];
    const du = wp[0] - _loc.u, dv = wp[1] - _loc.v;
    if (Math.hypot(du, dv) < reach) { st.i++; if (st.i >= route.length) { st.done = true; return; } }
    const cur = route[st.i];
    const tu = cur[0] - _loc.u, tv = cur[1] - _loc.v;
    const wx = -tu * ap.sin + tv * ap.cos, wz = tu * ap.cos + tv * ap.sin;
    const want = Math.atan2(-wx, wz);
    const he = wrapPi(want - p.attitude().heading);
    inp.yaw = clampv(he * 2.2, -1, 1);
    // Slower for a sharp turn.
    const target = Math.abs(he) > 0.5 ? slow : speed;
    const lever = Math.max(0.06, target / (p.F || FLIGHT).taxiSpeedPerLever);
    inp.throttleRate = clampv((lever - p.throttle) * 4, -1, 1);
    st.maxSpeed = Math.max(st.maxSpeed, Math.hypot(p.vx, p.vz));
    // Pavement under the wheels: the mains (2.1 m out) and the nose.
    if (ground && p.gear) {
      let bad = false;
      for (const wh of p.gear.wheels) {
        const r = p.r;
        const wxw = p.x + r[0] * wh.x + r[1] * wh.y + r[2] * wh.z, wzw = p.z + r[6] * wh.x + r[7] * wh.y + r[8] * wh.z;
        const s = ground.sample(wxw, wzw, p.y).surface;
        if (s !== 'tarmac' && s !== 'runway') bad = true;
      }
      if (bad) st.off++;
    }
  };
  return st;
}

// A route with its corners rounded: each interior vertex becomes a quadratic arc that
// leaves the legs `radius` metres before and after it (so a 10 m taxi turn of a fighter
// stays on a taxiway that is 15 m wide).
export function roundedRoute(raw, radius = 10, steps = 4) {
  // Duplicate points and straight-through points are not corners.
  const pts = [raw[0]];
  for (let i = 1; i < raw.length; i++) {
    const b = raw[i], a = pts[pts.length - 1];
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 1e-6) continue;
    const prev = pts[pts.length - 2];
    if (prev) {
      const cross = (a[0] - prev[0]) * (b[1] - a[1]) - (a[1] - prev[1]) * (b[0] - a[0]);
      if (Math.abs(cross) < 1e-6) { pts[pts.length - 1] = b; continue; }
    }
    pts.push(b);
  }
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1], b = pts[i], c = pts[i + 1];
    const l1 = Math.hypot(b[0] - a[0], b[1] - a[1]), l2 = Math.hypot(c[0] - b[0], c[1] - b[1]);
    const d1 = [(b[0] - a[0]) / l1, (b[1] - a[1]) / l1], d2 = [(c[0] - b[0]) / l2, (c[1] - b[1]) / l2];
    const turn = Math.acos(clampv(d1[0] * d2[0] + d1[1] * d2[1], -1, 1));
    const t = Math.min(radius * Math.tan(turn / 2), l1 * 0.5, l2 * 0.5);
    const p1 = [b[0] - d1[0] * t, b[1] - d1[1] * t], p2 = [b[0] + d2[0] * t, b[1] + d2[1] * t];
    for (let k = 0; k <= steps; k++) {
      const s = k / steps, m = 1 - s;
      out.push([m * m * p1[0] + 2 * m * s * b[0] + s * s * p2[0], m * m * p1[1] + 2 * m * s * b[1] + s * s * p2[1]]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

// The route from an airport's first parking stand to the middle of its runway: onto
// the taxiway, along it to an exit, up the exit and onto the runway.
export function standToRunway(ap, radius = 9) {
  const L = ap.layout, tx = L.taxiway, s0 = L.stands[0];
  let pts;
  if (tx.kind === 'parallel') {
    const e = tx.exits.map((x) => x * L.length).reduce((best, x) => (Math.abs(x - s0.u) < Math.abs(best - s0.u) ? x : best));
    pts = [[s0.u, s0.v], [s0.u, tx.offset], [e, tx.offset], [e, L.width / 2 + 8], [e, 0]];
  } else {
    const e = tx.at * L.length;
    pts = [[s0.u, s0.v], [e, 0]];
  }
  return roundedRoute(pts, radius);
}
