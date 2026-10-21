// The F-22 must fly exactly as it did before milestone 4. This file records what it
// did, from the tree as it stood before any of that work, and proves it still does it
// to the bit.
//
// Six scripted flights, each stepped for a fixed number of 120 Hz steps, the whole
// state (position, velocity, orientation, rates, fuel, controls, surfaces, gear,
// engines) folded into a 32-bit hash once a second and again at the end, plus the
// F-22's default mesh and three liveries (every geometry attribute, index, material
// and transform). A changed bit anywhere changes the hash.
//
//   npm run flight                          (compares against GOLDEN)
//   node scripts/flight/identity.mjs        (prints the table to paste into GOLDEN)
//
// Re-record only on purpose: a change that moves these numbers has changed how the
// F-22 flies or looks.

import { fileURLToPath } from 'node:url';

const H = await import('../lib/flight-harness.mjs');
const T = await import('../lib/track-hash.mjs');
const { F22 } = await import(H.R + 'data/aircraft.js');
const { World } = await import(H.R + 'world/World.js');
const { AIRPORTS } = await import(H.R + 'data/airports.js');
const { OPEN_WORLD } = await import(H.R + 'data/tuning.js');
const { buildAircraft } = await import(H.R + 'render/AircraftBuilder.js');
const { AircraftPhysics, makeInput, field, DT } = H;

// Recorded on the tree as it stood before milestone 4 (commit f00427b).
export const GOLDEN = {
  takeoff: '3f2cfbfe',
  scripted: '09bf0cef',
  manoeuvre: '4ee079ce',
  landing: '0245d3c6',
  taxi: 'c28ddd66',
  parked: 'dc711af3',
  meshDefault: 'c62a6dc3',
  meshTips: '468e0c98',
  meshSplit: '3f01b48b',
};

const STATE = ['x', 'y', 'z', 'vx', 'vy', 'vz', 'qx', 'qy', 'qz', 'qw', 'wx', 'wy', 'wz', 'fuel', 'mass',
  'throttle', 'trim', 'gearDown', 'airbrake', 'abFuel', 'nozzle', 'pitchCmd', 'rollCmd', 'yawCmd',
  'thrustTotal', 'nz', 'alpha', 'beta', 'agl', 'brake', 'cas', 'mach'];

// Folds the whole state of an AircraftPhysics into a hasher.
function fold(h, p) {
  for (const k of STATE) h.number(p[k]);
  for (const d of p.defl) h.number(d);
  for (const c of p.gear.compression) h.number(c);
  for (const c of p.gear.load) h.number(c);
  h.number(p.gear.steerAngle);
  for (const e of p.engines) { h.number(e.n); h.number(e.abLevel); h.number(e.thrust); }
  h.number(p.crashed ? 1 : 0);
  h.number(p.onGround ? 1 : 0);
}

// Steps `seconds`, calling pre(time) before each step and folding the state once a second.
function flown(h, ground, p, inp, seconds, pre) {
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) {
    if (pre) pre(i * DT, i);
    p.step(DT, inp, ground);
    if (i % 120 === 119) fold(h, p);
  }
  fold(h, p);
}

const lcg = (seed) => {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
};

// The world as it stood when the goldens were recorded: without the approach corridor cut at the
// major (milestone 4). The corridor changes the land the F-22 climbs out over, so what its tail
// guard sees below it, and so its takeoff, and nothing about the aircraft; it is the aircraft that
// is held to the bit, so it is flown over the land it was recorded over.
function worldOf() { return T.loadTrackData().then((d) => new World(d, OPEN_WORLD, AIRPORTS.map((a) => ({ ...a, corridor: false })))); }

export async function measure() {
  const out = {};
  const world = await worldOf();
  const AP = world.airports;

  // A takeoff in afterburner from the major in the world.
  {
    const ap = AP.major, sp = AP.start(ap, 'runway', {});
    const p = new AircraftPhysics(F22);
    p.reset({ x: sp.x, y: sp.y + 1.75, z: sp.z, heading: sp.heading, fuel: 0.6, gear: 1, throttle: 1 });
    const inp = makeInput({ gearDown: true, ab: true });
    const pilot = H.takeoffPilot(ap), h = new T.Hasher();
    flown(h, world, p, inp, 40, (t) => pilot.step(p, inp, t));
    out.takeoff = h.hex;
  }

  // The 30 s keyboard flight the frame-rate check flies, on the test field.
  {
    const p = new AircraftPhysics(F22);
    p.reset({ x: 0, y: 1.9, z: 80, heading: 0.1, fuel: 0.6, gear: 1, throttle: 1 });
    const h = new T.Hasher(), inp = makeInput();
    flown(h, field, p, inp, 30, (t, n) => {
      const s = n / 120;
      inp.gearDown = s < 14; inp.ab = s < 22; inp.analog = false;
      inp.pitch = s > 7 && s < 8.5 ? 1 : s > 16 && s < 17 ? -0.6 : s > 20 && s < 22 ? 0.7 : 0;
      inp.roll = s > 11 && s < 12.5 ? 1 : s > 24 && s < 26 ? -1 : 0;
      inp.yaw = s > 9 && s < 9.5 ? 0.5 : 0;
      inp.throttleRate = s > 26 ? -0.5 : 0;
      inp.brake = 0;
    });
    out.scripted = h.hex;
  }

  // Sixty seconds of every control, at random: pitch, roll, rudder, throttle, burner,
  // airbrake and gear, through a stall and out of it.
  {
    const p = H.airborne(F22, { h: 3000, mach: 0.7, fuel: 0.5, throttle: 0.8 });
    const inp = makeInput({ analog: false });
    const rnd = lcg(20261021), h = new T.Hasher();
    const pick = (a) => a[Math.floor(rnd() * a.length)];
    flown(h, field, p, inp, 60, (t, n) => {
      if (n % 30 === 0) {
        inp.pitch = pick([-1, -0.5, 0, 0, 0.5, 1]);
        inp.roll = pick([-1, 0, 0, 1]);
        inp.yaw = pick([-1, 0, 0, 0, 1]);
        inp.throttleRate = pick([-1, 0, 0, 1]);
        inp.ab = rnd() < 0.4;
        inp.airbrake = rnd() < 0.25;
        inp.gearDown = rnd() < 0.2;
        p.abFuel = 1;
      }
      if (p.y < 600 && !p.crashed) { inp.pitch = 0.6; inp.throttleRate = 1; }
    });
    out.manoeuvre = h.hex;
  }

  // A landing at Pinecrest from a three degree approach.
  {
    const ap = AP.byId.get('pinecrest');
    const aim = 300, dist = 5000, glide = 3, w = { x: 0, z: 0 };
    ap.toWorld(-dist, 0, w);
    const h0 = (aim + dist) * Math.tan((glide * Math.PI) / 180);
    const p = new AircraftPhysics(F22);
    p.reset({ x: w.x, y: ap.base + 1.75 + h0, z: w.z, heading: ap.heading, pitch: 0.09, speed: 80, fuel: 0.4, gear: 1, throttle: 0.3 });
    const inp = makeInput({ gearDown: true }), pilot = H.landingPilot(ap, { aim }), h = new T.Hasher();
    flown(h, world, p, inp, 150, (t) => pilot.step(p, inp, t));
    out.landing = h.hex;
  }

  // A taxi from the first stand at the major to the runway, 120 s of it.
  {
    const ap = AP.major, sp = AP.start(ap, 'apron', {});
    const p = new AircraftPhysics(F22);
    p.reset({ x: sp.x, y: sp.y + 1.75, z: sp.z, heading: sp.heading, fuel: 0.6, gear: 1, throttle: 0 });
    const inp = makeInput({ gearDown: true, analog: false });
    const pilot = H.taxiPilot(ap, H.standToRunway(ap), { reach: 4 }), h = new T.Hasher();
    flown(h, world, p, inp, 120, () => pilot.step(p, inp, world));
    out.taxi = h.hex;
  }

  // Standing on the field: idle, the brakes, a run-up held on them, let go.
  {
    const p = new AircraftPhysics(F22);
    p.reset({ x: 0, y: 1.75, z: 0, heading: 0, fuel: 0.6, gear: 1, throttle: 0 });
    const inp = makeInput({ gearDown: true, analog: false }), h = new T.Hasher();
    flown(h, field, p, inp, 60, (t) => {
      inp.brake = t > 20 && t < 40 ? 1 : 0;
      p.throttle = t < 10 ? 0 : t < 20 ? 0.12 : t < 40 ? 0.5 : 0.2;
      inp.gearDown = t < 55;
    });
    out.parked = h.hex;
  }

  // The meshes: the default, and two liveries that touch the most panels.
  const rootHash = (root) => {
    const h = new T.Hasher();
    let meshes = 0;
    root.updateMatrixWorld(true);
    root.traverse((o) => {
      h.string(o.type);
      h.array(new Float64Array(o.matrix.elements));
      h.number(o.visible ? 1 : 0);
      if (!o.isMesh) return;
      meshes++;
      for (const name of Object.keys(o.geometry.attributes).sort()) { h.string(name); h.array(o.geometry.attributes[name].array); }
      if (o.geometry.index) h.array(o.geometry.index.array);
      const m = o.material;
      h.number(m.color ? m.color.getHex() : -1); h.number(m.emissive ? m.emissive.getHex() : -1);
      h.number(m.opacity); h.number(m.shininess ?? -1); h.number(m.transparent ? 1 : 0); h.number(m.side);
    });
    return `${h.hex}`;
  };
  const dflt = buildAircraft(F22);
  out.meshDefault = rootHash(dflt.root); dflt.dispose();
  const tips = buildAircraft(F22, { body: 'sky', accent: 'acid', pattern: 'tips', insignia: 'roundel', number: 22 });
  out.meshTips = rootHash(tips.root); tips.dispose();
  const split = buildAircraft(F22, { body: 'ember', accent: 'ink', pattern: 'split', insignia: 'diamond', number: 4012 });
  out.meshSplit = rootHash(split.root); split.dispose();
  return out;
}

export default async function run(kit) {
  console.log('\nThe F-22 is unchanged (identical to the bit to the tree before milestone 4)');
  const got = await measure();
  for (const k of Object.keys(GOLDEN)) kit.check(got[k] === GOLDEN[k], `${k.padEnd(12)} ${got[k]}${got[k] === GOLDEN[k] ? '' : `  (recorded ${GOLDEN[k]})`}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const got = await measure();
  console.log('export const GOLDEN = {');
  for (const [k, v] of Object.entries(got)) console.log(`  ${k}: '${v}',`);
  console.log('};');
}
