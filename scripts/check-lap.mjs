// Proves a track is drivable end to end: laps it with every chassis and reports
// lap time, wall contact and time spent off the road.
//
// The autopilot here is deliberately crude -- a pure pursuit on the centerline
// with a curvature-derived speed profile. It is NOT the race AI (that is
// milestone 6). It exists so "Copper Flats is playable end to end" is something
// measured rather than assumed, and so a track edit can be checked in seconds.
//
//   npm run lap            all tracks
//   npm run lap -- pine    tracks whose id contains "pine"

import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));
const { VehiclePhysics } = await import(SRC + 'game/VehiclePhysics.js');
const { Track } = await import(SRC + 'game/Track.js');
const { CHASSIS } = await import(SRC + 'data/cars.js');
const { SIM, GRIP } = await import(SRC + 'data/tuning.js');

// The registry uses import.meta.glob, which is a bundler feature, so the track
// files are discovered from disk here instead. Same rule either way: a track is
// a file in that folder and nothing else.
const dir = SRC + 'data/tracks/';
const filter = process.argv[2];
const tracks = [];
for (const f of readdirSync(dir).sort()) {
  if (!f.endsWith('.js') || f === 'index.js') continue;
  const data = (await import(dir + f)).default;
  if (data && data.id && (!filter || data.id.includes(filter))) tracks.push(data);
}

const dt = 1 / SIM.hz;
const input = (throttle, brake, steer) =>
  ({ throttle, brake, steer, handbrake: 0, steerIsAnalog: true, pedalsAreAnalog: true });

// Cornering limit per sample from curvature, then a backward pass to place
// braking points. A rough stand-in for ai/SpeedProfile.js.
function speedProfile(track, chassis, grip) {
  const n = track.count;
  const v = new Float64Array(n);
  const g = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    // The surface under each sample, because a driver who carries tarmac speed
    // into a gravel sector is not a slow driver, he is a bad one -- and the
    // lap time he posts is a lie about the TRACK. Read from the track data,
    // the same place the physics reads it.
    const surface = track.surface[i];
    const mult = (GRIP.surface[surface] ?? 1)
      * (surface === 'tarmac' ? 1 : chassis.offroadGrip);
    g[i] = grip * mult;
    const k = Math.abs(track.curvature[i]);
    v[i] = k > 1e-5 ? Math.min(chassis.topSpeed, Math.sqrt(g[i] * 9.81 / k)) : chassis.topSpeed;
  }
  for (let pass = 0; pass < 3; pass++) {
    for (let s = n; s > 0; s--) {
      const i = (s - 1) % n, j = s % n;
      // Braking is limited by the surface you are braking ON, so the entry to
      // a gravel sector is braked for from back on the tarmac.
      const aBrake = g[i] * 9.81 * 0.85;
      v[i] = Math.min(v[i], Math.sqrt(v[j] * v[j] + 2 * aBrake * track.ds));
    }
  }
  return v;
}

function lap(track, chassis) {
  const v = new VehiclePhysics(chassis);
  const sp = track.spawn();
  v.reset(sp.x, track.sample(sp.x, sp.z, sp.y).height + chassis.suspensionRest, sp.z, sp.yaw);
  for (let i = 0; i < 240; i++) v.step(dt, input(0, 0, 0), track);

  const profile = speedProfile(track, chassis, Math.min(chassis.gripFront, chassis.gripRear) * 0.55);
  let steps = 0, wall = 0, off = 0, crossings = 0, lapStart = 0, lapSteps = null;
  let lastProg = track.progressAt(v.x, v.z, v.y);
  let steerCmd = 0;

  while (steps < SIM.hz * 400) {
    const i = track.nearestIndex(v.x, v.z, v.y);
    const look = Math.max(14, Math.min(60, v.speed * 2.1));
    const j = (i + Math.round(look / track.ds)) % track.count;
    const dx = track.px[j] - v.x, dz = track.pz[j] - v.z;
    const sy = Math.sin(v.yaw), cy = Math.cos(v.yaw);
    const fwd = dx * sy + dz * cy;
    // +x is the car's left, and physics steer is pre-flip: positive turns left.
    const lat = dx * cy - dz * sy;
    // Pure pursuit with a damping term. A bare P controller oscillates on the
    // heavy cars and then reports the CAR as undriveable, which is a lie about
    // the test driver. Real drivers damp against the yaw they already have.
    const aim = Math.atan2(lat, Math.max(fwd, 1));
    // Damping fades out at low speed, or it fights the car during a recovery.
    const damp = v.yawRate * 0.45 * Math.min(1, v.speed / 15);
    const want2 = Math.max(-1, Math.min(1, aim * 1.9 - damp));
    // Rate limit. A step change in lock is not something a driver can do, and
    // an unlimited controller oscillates itself into a spin on the straights.
    steerCmd += Math.max(-0.05, Math.min(0.05, want2 - steerCmd));
    const steer = steerCmd;

    let want = Infinity;
    const ahead = Math.round(Math.max(20, v.speed * 2.2) / track.ds);
    for (let k = 0; k < ahead; k += 2) want = Math.min(want, profile[(i + k) % track.count]);
    // Off the road, crawl back to the centreline instead of trying to race.
    // Without this the driver pins full lock at walking pace, never recovers,
    // and the harness reports a 300 s lap for what is really one mistake.
    if (!v.onTrack) want = Math.min(want, 14);

    // Throttle limiting against the rear tyres. Pure pursuit plus full throttle
    // spins the loose-rear cars on corner exit, and no amount of extra lookahead
    // fixes that -- the car is already sideways by the time the line is wrong.
    // Back out of the throttle as the rear starts to slide instead.
    const slide = Math.min(1, Math.abs(v.slipRear) / 0.14);
    const throttle = v.speed < want ? 1 - 0.9 * slide * slide : 0;
    const brake = v.speed > want * 1.04 ? Math.min(1, (v.speed - want) * 0.5) : 0;
    v.step(dt, input(throttle, brake, steer), track);

    steps++;
    if (crossings >= 1) {
      if (v.touchingBarrier) wall++;
      if (!v.onTrack) off++;
    }
    // The car starts BEHIND the line, so the first crossing opens the lap.
    const prog = track.progressAt(v.x, v.z, v.y);
    if (lastProg > track.count * 0.8 && prog < track.count * 0.2) {
      crossings++;
      if (crossings === 1) lapStart = steps;
      else { lapSteps = steps - lapStart; break; }
    }
    lastProg = prog;
  }
  return { lap: lapSteps ? lapSteps * dt : null, wall: wall * dt, off: off * dt };
}

// Scenery is data, and data can be wrong in ways that are silent: a prop spec
// TrackMesh cannot read is simply not drawn, and a track quietly loses its
// scenery without anything failing. Check the shape of it here, where a track
// edit is already being checked.
function checkProps(data) {
  const errs = [];
  for (const [n, spec] of (data.props || []).entries()) {
    const where = `props[${n}]${spec.name ? ` "${spec.name}"` : ''}`;
    if (!Array.isArray(spec.parts) || !spec.parts.length) {
      errs.push(`${where} has no parts, so nothing will be drawn`);
      continue;
    }
    for (const [k, part] of spec.parts.entries()) {
      if (part.color === undefined) errs.push(`${where}.parts[${k}] has no color`);
      for (const dim of ['w', 'h']) {
        if (part[dim] === undefined) errs.push(`${where}.parts[${k}] has no ${dim}`);
      }
    }
    if (spec.place === 'line') {
      if (!spec.spacing) errs.push(`${where} is placed on a line with no spacing`);
    } else if (!spec.count || spec.minOffset === undefined || spec.maxOffset === undefined
               || spec.minScale === undefined || spec.maxScale === undefined) {
      errs.push(`${where} is scattered and needs count, min/maxOffset and min/maxScale`);
    }
  }
  return errs;
}

let failed = false;
for (const data of tracks) {
  const track = new Track(data);
  for (const e of checkProps(data)) { failed = true; console.log(`  SCENERY  ${e}`); }
  console.log(`\n${data.name}  ${track.length.toFixed(0)} m  target ${data.targetLap}s  ` +
    `${track.checkpoints.length} checkpoints`);
  for (const chassis of CHASSIS) {
    const r = lap(track, chassis);
    if (!r.lap) { failed = true; console.log(`  ${chassis.name.padEnd(14)} DID NOT FINISH`); continue; }
    console.log(`  ${chassis.name.padEnd(14)} ${r.lap.toFixed(2)}s   wall ${r.wall.toFixed(2)}s   off-road ${r.off.toFixed(2)}s`);
  }
}
console.log(failed
  ? '\nFAIL: a car could not complete a lap, or a track has broken scenery.'
  : '\nPASS: every chassis laps every track, and every prop spec is readable.');
process.exit(failed ? 1 : 0);
