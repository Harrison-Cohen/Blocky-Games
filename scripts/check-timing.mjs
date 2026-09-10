// Lap timing and validation, headless.
//
// Drives the autopilot round a track and asserts that the timer agrees with the
// physics clock, that sectors add up to the lap, that a clean lap validates,
// and that the three ways to spoil a lap actually spoil it. Timing is the core
// of a time trial, so it gets a test rather than a look.
//
//   npm run timing

import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));
const { VehiclePhysics } = await import(SRC + 'game/VehiclePhysics.js');
const { Track } = await import(SRC + 'game/Track.js');
const { LapTimer, formatTime } = await import(SRC + 'game/LapTimer.js');
const { CHASSIS } = await import(SRC + 'data/cars.js');
const { SIM, TIMING } = await import(SRC + 'data/tuning.js');

const dir = SRC + 'data/tracks/';
const files = readdirSync(dir).filter((f) => f.endsWith('.js') && f !== 'index.js');
const trackData = [];
for (const f of files) trackData.push((await import(dir + f)).default);
trackData.sort((a, b) => (a.order ?? 99) - (b.order ?? 99));

const dt = 1 / SIM.hz;
const input = (throttle, brake, steer) =>
  ({ throttle, brake, steer, handbrake: 0, steerIsAnalog: true, pedalsAreAnalog: true });

function speedProfile(track, chassis, grip) {
  const n = track.count;
  const v = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const k = Math.abs(track.curvature[i]);
    v[i] = k > 1e-5 ? Math.min(chassis.topSpeed, Math.sqrt(grip * 9.81 / k)) : chassis.topSpeed;
  }
  const aBrake = grip * 9.81 * 0.85;
  for (let pass = 0; pass < 4; pass++) {
    for (let i = n - 1; i >= 0; i--) {
      const j = (i + 1) % n;
      const lim = Math.sqrt(v[j] * v[j] + 2 * aBrake * track.ds);
      if (v[i] > lim) v[i] = lim;
    }
  }
  return v;
}

// Drives `laps` timed laps. `sabotage` may nudge the car off line to test the
// invalidation rules.
function drive(track, chassis, laps, sabotage) {
  const v = new VehiclePhysics(chassis);
  const timer = new LapTimer(track, chassis.id);
  const sp = track.spawn();
  v.reset(sp.x, track.sample(sp.x, sp.z, sp.y).height + chassis.suspensionRest, sp.z, sp.yaw);
  for (let i = 0; i < 240; i++) v.step(dt, input(0, 0, 0), track);

  const profile = speedProfile(track, chassis, Math.min(chassis.gripFront, chassis.gripRear) * 0.55);
  let steerCmd = 0;
  let steps = 0;
  const maxSteps = SIM.hz * 200 * (laps + 1);

  while (timer.laps.length < laps && steps < maxSteps) {
    const i = track.nearestIndex(v.x, v.z, v.y);
    const look = Math.max(14, Math.min(60, v.speed * 2.1));
    const j = (i + Math.round(look / track.ds)) % track.count;
    let dx = track.px[j] - v.x, dz = track.pz[j] - v.z;

    // Optional push toward the outside of the road, to force a real excursion.
    if (sabotage) {
      const push = sabotage(timer, steps * dt, track, i);
      if (push) { dx += track.lx[i] * push; dz += track.lz[i] * push; }
    }

    const sy = Math.sin(v.yaw), cy = Math.cos(v.yaw);
    const fwd = dx * sy + dz * cy;
    const lat = dx * cy - dz * sy;
    const aim = Math.atan2(lat, Math.max(fwd, 1));
    const damp = v.yawRate * 0.45 * Math.min(1, v.speed / 15);
    const target = Math.max(-1, Math.min(1, aim * 1.9 - damp));
    steerCmd += Math.max(-0.05, Math.min(0.05, target - steerCmd));

    let want = Infinity;
    const ahead = Math.round(Math.max(20, v.speed * 2.2) / track.ds);
    for (let k = 0; k < ahead; k += 2) want = Math.min(want, profile[(i + k) % track.count]);
    if (!v.onTrack) want = Math.min(want, 14);

    const slide = Math.min(1, Math.abs(v.slipRear) / 0.14);
    v.step(dt, input(
      v.speed < want ? 1 - 0.9 * slide * slide : 0,
      v.speed > want * 1.04 ? Math.min(1, (v.speed - want) * 0.5) : 0,
      steerCmd), track);
    timer.step(dt, v);
    steps++;
  }
  return { timer, finished: timer.laps.length >= laps };
}

let failures = 0;
const check = (ok, label, detail = '') => {
  if (!ok) failures++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${detail ? '   ' + detail : ''}`);
};

for (const data of trackData) {
  const track = new Track(data);
  const chassis = CHASSIS[0];
  console.log(`\n${track.data.name}  ${track.length.toFixed(0)} m  ` +
    `${track.checkpoints.length} checkpoints  ${track.sectors.length} sectors`);

  const { timer, finished } = drive(track, chassis, 2, null);
  check(finished, 'two clean laps completed');
  if (!finished) continue;

  const lap = timer.laps[1];
  check(lap.valid, 'second lap is valid', lap.reason);
  check(lap.sectors.length === track.sectors.length,
    'every sector recorded', `${lap.sectors.length}`);

  const sum = lap.sectors.reduce((a, b) => a + b, 0);
  check(Math.abs(sum - lap.time) < 1e-9,
    'sectors sum to the lap time', `${formatTime(lap.time)} vs ${formatTime(sum)}`);

  // Sub-step resolution: a lap timed on whole 120 Hz ticks would always be an
  // exact multiple of the step. If that is what we get, the fraction is lost.
  const ticks = lap.time / dt;
  check(Math.abs(ticks - Math.round(ticks)) > 1e-6,
    'lap time is not quantised to the physics step',
    `${(Math.abs(ticks - Math.round(ticks)) * dt * 1000).toFixed(3)} ms off the grid`);

  check(timer.best !== null && timer.best <= lap.time, 'best lap recorded');
  check(timer.bestPossible !== null && timer.bestPossible <= timer.best,
    'best possible lap is no slower than the best lap');

  // Off track for longer than the grace period must invalidate.
  const off = drive(track, chassis, 1, (t, elapsed, tr, i) => {
    // Shove the aim well outside the barriers for longer than the grace period,
    // once the timed lap has started.
    if (!t.running || t.lapTime < 6 || t.lapTime > 6 + TIMING.offTrackGrace + 2.5) return 0;
    return tr.halfWidth[i] * 6 + 60;
  });
  check(off.finished && off.timer.laps[0] && !off.timer.laps[0].valid,
    'a long excursion invalidates the lap',
    off.timer.laps[0] ? off.timer.laps[0].reason : 'no lap');
}

// The other two ways to spoil a lap do not need a car: they are geometry. Walk
// a point along the centerline and feed it to the timer directly, so the rules
// are tested rather than a driver's ability to break them.
function walk(track, chassisId, plan) {
  const timer = new LapTimer(track, chassisId);
  const p = { x: 0, z: 0, prevX: 0, prevZ: 0, speed: 40, wheelsOnTrack: 4 };
  const at = (sample) => {
    const i = ((sample % track.count) + track.count) % track.count;
    return { x: track.px[i], z: track.pz[i] };
  };
  let here = track.startSample - 4;
  const move = (to) => {
    const a = at(here), b = at(to);
    p.prevX = a.x; p.prevZ = a.z; p.x = b.x; p.z = b.z;
    timer.step(dt, p);
    here = to;
  };
  for (const to of plan) move(to);
  return timer;
}

const track0 = new Track(trackData[0]);
const gates = track0.checkpoints;
console.log('\nValidation rules, walked directly along the centerline');

// Cross the line, then jump over gate 1 and rejoin at gate 2.
const cut = walk(track0, CHASSIS[0].id, [
  gates[0].sample + 2,
  gates[2].sample,
  ...gates.slice(3).map((g) => g.sample),
  gates[0].sample + track0.count,
]);
check(cut.laps.length === 1 && !cut.laps[0].valid,
  'skipping a checkpoint invalidates the lap',
  cut.laps[0] ? cut.laps[0].reason : 'no lap');

// Cross the line, run to gate 3, reverse back over it, then complete.
const rev = walk(track0, CHASSIS[0].id, [
  gates[0].sample + 2,
  gates[1].sample, gates[2].sample, gates[3].sample,
  gates[3].sample - 4,
  ...gates.slice(3).map((g) => g.sample),
  gates[0].sample + track0.count,
]);
check(rev.laps.length === 1 && !rev.laps[0].valid,
  'reversing over a checkpoint invalidates the lap',
  rev.laps[0] ? rev.laps[0].reason : 'no lap');

// And a clean walk still validates, so the rules above are not just always-fail.
const clean = walk(track0, CHASSIS[0].id, [
  gates[0].sample + 2,
  ...gates.slice(1).map((g) => g.sample),
  gates[0].sample + track0.count,
]);
check(clean.laps.length === 1 && clean.laps[0].valid,
  'a clean walk still validates',
  clean.laps[0] ? clean.laps[0].reason : 'no lap');

console.log(failures === 0
  ? '\nPASS: lap timing, sectors and validation behave.'
  : `\nFAIL: ${failures} timing check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
