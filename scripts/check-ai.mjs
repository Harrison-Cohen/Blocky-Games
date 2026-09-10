// Proves the AI drives: that the racing line is a better line than the
// centerline, that every chassis can lap every track on it cleanly, and that
// doing so is faster than the crude pure-pursuit-on-the-centerline driver the
// lap harness uses.
//
// That last one is the point. A racing line and a speed profile are only worth
// having if they buy time, and "the AI looks about right" is not a measurement.
//
//   npm run ai            all tracks
//   npm run ai -- pine    tracks whose id contains "pine"

import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));
const { VehiclePhysics } = await import(SRC + 'game/VehiclePhysics.js');
const { Track } = await import(SRC + 'game/Track.js');
const { RacingLine } = await import(SRC + 'ai/RacingLine.js');
const { AIDriver } = await import(SRC + 'ai/AIDriver.js');
const { CHASSIS, getChassis } = await import(SRC + 'data/cars.js');
const { OPPONENTS } = await import(SRC + 'data/opponents.js');
const { normalizeCar } = await import(SRC + 'data/customization.js');
const { SIM, TRACK } = await import(SRC + 'data/tuning.js');

const dir = SRC + 'data/tracks/';
const filter = process.argv[2];
const tracks = [];
for (const f of readdirSync(dir).sort()) {
  if (!f.endsWith('.js') || f === 'index.js') continue;
  const data = (await import(dir + f)).default;
  if (data && data.id && (!filter || data.id.includes(filter))) tracks.push(data);
}

const dt = 1 / SIM.hz;

// Is the line a line? It has to stay on the road, and it has to be straighter
// through the corners than the centerline is -- if it is not, it is decoration.
function checkLine(track, line) {
  const errs = [];
  let worstOver = 0;
  for (let i = 0; i < line.count; i++) {
    const over = Math.abs(line.offset[i]) - line.limit[i];
    if (over > worstOver) worstOver = over;
  }
  if (worstOver > 1e-3) errs.push(`line leaves its corridor by ${worstOver.toFixed(3)} m`);

  // Compare the two on the tightest tenth of the lap: that is where a line
  // earns its keep, and averaging over the straights hides it.
  const pick = (arr) => [...arr].map(Math.abs).sort((a, b) => b - a)
    .slice(0, Math.max(1, Math.round(arr.length * 0.1)));
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const kTrack = mean(pick(track.curvature));
  const kLine = mean(pick(line.curvature));
  const gain = (1 - kLine / kTrack) * 100;
  if (kLine >= kTrack) errs.push('the line is not straighter than the centerline');
  return { errs, gain, rTrack: 1 / kTrack, rLine: 1 / kLine };
}

// The same line object with every offset flattened to zero: the centerline,
// driven by the same driver with the same profile. This is the control.
function flatten(line) {
  const copy = Object.create(Object.getPrototypeOf(line));
  Object.assign(copy, line);
  copy.offset = new Float32Array(line.count);
  copy.limit = line.limit;
  copy.x = new Float32Array(line.count);
  copy.y = new Float32Array(line.count);
  copy.z = new Float32Array(line.count);
  copy.curvature = new Float32Array(line.count);
  copy.ds = new Float32Array(line.count);
  copy.s = new Float32Array(line.count);
  copy._measure();
  return copy;
}

function lap(track, line, chassis, style) {
  const p = new VehiclePhysics(chassis);
  const driver = new AIDriver(track, line, chassis, style);
  // Start ON the racing line, facing along it, as a grid slot would.
  const start = track.startSample;
  const back = Math.round(30 / track.ds);
  const i0 = ((start - back) % track.count + track.count) % track.count;
  const sp = track.spawnAt(i0, 0, line.offset[i0]);
  p.reset(sp.x, track.sample(sp.x, sp.z, sp.y).height + chassis.suspensionRest, sp.z, sp.yaw);

  let steps = 0, wall = 0, off = 0, crossings = 0, lapStart = 0, lapSteps = null;
  let lastProg = track.progressAt(p.x, p.z, p.y);
  let worstOffLine = 0;

  while (steps < SIM.hz * 400) {
    p.step(dt, driver.update(dt, p), track);
    steps++;
    if (crossings >= 1) {
      if (p.touchingBarrier) wall++;
      if (!p.onTrack) off++;
      const i = driver.sample;
      const d = Math.hypot(p.x - line.x[i], p.z - line.z[i]);
      if (d > worstOffLine) worstOffLine = d;
    }
    const prog = track.progressAt(p.x, p.z, p.y);
    if (lastProg > track.count * 0.8 && prog < track.count * 0.2) {
      crossings++;
      if (crossings === 1) lapStart = steps;
      else { lapSteps = steps - lapStart; break; }
    }
    lastProg = prog;
  }
  return {
    lap: lapSteps ? lapSteps * dt : null,
    wall: wall * dt,
    off: off * dt,
    offLine: worstOffLine,
  };
}

// The roster is data, and normalizeCar silently falls back on anything it does
// not recognise -- so a mistyped paint id gives an opponent the default car and
// nothing anywhere says so. Check it here, where the names are already loaded.
let failed = false;
for (const o of OPPONENTS) {
  const norm = normalizeCar({ chassis: o.chassis, ...o.car });
  for (const [k, v] of Object.entries({ chassis: o.chassis, ...o.car })) {
    if (norm[k] !== v) {
      failed = true;
      console.log(`  ROSTER  ${o.name}: ${k} "${v}" is not a real option `
        + `(fell back to "${norm[k]}")`);
    }
  }
  if (!getChassis(o.chassis) || getChassis(o.chassis).id !== o.chassis) {
    failed = true;
    console.log(`  ROSTER  ${o.name}: chassis "${o.chassis}" does not exist`);
  }
}
if (!failed) console.log(`roster: ${OPPONENTS.length} opponents, every option valid`);

for (const data of tracks) {
  const track = new Track(data);
  const line = new RacingLine(track);
  const { errs, gain, rTrack, rLine } = checkLine(track, line);

  console.log(`\n${data.name}   centerline ${track.length.toFixed(0)} m -> line ${line.length.toFixed(0)} m`);
  for (const e of errs) { failed = true; console.log(`  LINE  ${e}`); }
  console.log(`  tightest tenth: radius ${rTrack.toFixed(1)} m on the centerline, `
    + `${rLine.toFixed(1)} m on the line  (${gain > 0 ? '+' : ''}${gain.toFixed(0)}% straighter)`);

  // The measurement that actually matters. A curvature statistic can be argued
  // with; a lap time cannot. Same car, same driver, same speed profile maths --
  // the only difference is which line it is given.
  const ref = CHASSIS[0];
  const onLine = lap(track, line, ref, { name: 'test' });
  const onCentre = lap(track, flatten(line), ref, { name: 'test' });
  if (onLine.lap && onCentre.lap) {
    const won = onCentre.lap - onLine.lap;
    if (won <= 0) {
      failed = true;
      console.log(`  LINE  the racing line is ${(-won).toFixed(2)}s SLOWER than the centerline`);
    }
    console.log(`  ${ref.name} on the centerline ${onCentre.lap.toFixed(2)}s, `
      + `on the racing line ${onLine.lap.toFixed(2)}s  (${won > 0 ? '-' : '+'}${Math.abs(won).toFixed(2)}s)`);
  }

  for (const chassis of CHASSIS) {
    const r = lap(track, line, chassis, { name: 'test' });
    if (!r.lap) { failed = true; console.log(`  ${chassis.name.padEnd(14)} DID NOT FINISH`); continue; }
    // A lap with the car in the wall, or a long way off the road, is not a lap.
    const clean = r.wall < 0.35 && r.off < 4.0;
    if (!clean) failed = true;
    console.log(`  ${chassis.name.padEnd(14)} ${r.lap.toFixed(2)}s   wall ${r.wall.toFixed(2)}s   `
      + `off-road ${r.off.toFixed(2)}s   max ${r.offLine.toFixed(1)} m off line`
      + (clean ? '' : '   NOT CLEAN'));
  }
}

// Repeatability. The driver advances its own clock off the fixed step and must
// never read a wall clock, a random number or anything that varies between
// runs -- a rival that drives a different lap each time cannot be raced against
// and cannot be debugged.
{
  const track = new Track(tracks[0]);
  const line = new RacingLine(track);
  const run = () => {
    const p = new VehiclePhysics(CHASSIS[0]);
    const d = new AIDriver(track, line, CHASSIS[0], OPPONENTS[0].style);
    const i0 = ((track.startSample - Math.round(30 / track.ds)) % track.count + track.count) % track.count;
    const sp = track.spawnAt(i0, 0, line.offset[i0]);
    p.reset(sp.x, track.sample(sp.x, sp.z, sp.y).height + CHASSIS[0].suspensionRest, sp.z, sp.yaw);
    for (let k = 0; k < SIM.hz * 45; k++) p.step(dt, d.update(dt, p), track);
    return p;
  };
  const a = run(), b = run();
  const same = a.x === b.x && a.z === b.z && a.yaw === b.yaw;
  if (!same) failed = true;
  console.log(`\nrepeatability: two identical 45 s stints ended `
    + `${same ? 'bit-identical' : `${Math.hypot(a.x - b.x, a.z - b.z).toExponential(2)} m apart -- THE AI IS NOT DETERMINISTIC`}`);
}

console.log(failed
  ? '\nFAIL: the AI cannot lap cleanly, or the racing line is not earning its keep.'
  : '\nPASS: the line beats the centerline on time, every chassis laps it clean, and the AI is repeatable.');
process.exit(failed ? 1 : 0);
