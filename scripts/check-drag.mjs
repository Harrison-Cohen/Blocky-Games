// Drag racing, timed. Passes down Mesa Dragway through the real Track,
// VehiclePhysics and Drag, headless:
//
//   - every chassis makes a clean pass, with a reaction time that is the
//     driver's plus the rollout, and an ET that is its quarter mile less the
//     rollout (`npm run specs` holds the quarter mile to the car's figure)
//   - the splits come in order, and the trap speed is a real speed
//   - leaving before the green is a red light
//   - reaction time counts: of two identical cars, the one that launches a
//     third of a second late loses by a third of a second
//   - crossing into the other lane is a foul, and loses
//   - a car that never leaves has no time, and loses
//   - the same pass twice comes out identical, to the bit
//
//   npm run drag

import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));
const { VehiclePhysics } = await import(SRC + 'game/VehiclePhysics.js');
const { Track } = await import(SRC + 'game/Track.js');
const { Drag } = await import(SRC + 'game/Drag.js');
const { CHASSIS, getChassis, gameSpecs } = await import(SRC + 'data/cars.js');
const { SIM } = await import(SRC + 'data/tuning.js');

const track = new Track((await import(SRC + 'data/tracks/drag-strip.js')).default);
const dt = 1 / SIM.hz;
const drive = (throttle, brake = 0, steer = 0) =>
  ({ throttle, brake, steer, handbrake: 0, steerIsAnalog: true, pedalsAreAnalog: true });

let failed = false;
const check = (ok, msg) => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${msg}`);
  if (!ok) failed = true;
};
const f3 = (v) => (v === null || v === undefined ? '-' : v.toFixed(3));

// A pass. launch[k]: seconds after the green lane k floors it (negative is
// early; null never goes). steer(k, t, drag): steering, default straight.
function pass(chassis, launch, steer = () => 0) {
  const lanes = chassis.map((c, k) => ({ physics: new VehiclePhysics(c), chassis: c, name: `Lane ${k + 1}` }));
  const drag = new Drag(track, lanes);
  for (let n = 0; drag.phase !== 'done' && n < SIM.hz * 90; n++) {
    const t = drag.clock;
    drag.step(dt, drag.lanes.map((l, k) => {
      if (l.finished) return drive(0, 1);
      const go = launch[k] !== null && t >= drag.greenAt + launch[k];
      return drive(go ? 1 : 0, 0, steer(k, t, drag));
    }));
  }
  return { drag, r: drag.results() };
}

console.log('\nEvery chassis, a clean pass launching 0.25 s after the green');
for (const c of CHASSIS) {
  const { r } = pass([c], [0.25]);
  const l = r.lanes[0];
  const q = gameSpecs(c).quarterMile;
  const splits = [l.sixty, l.threeThirty, l.eighth, l.thousand, l.et];
  const ordered = splits.every((v, i) => v !== null && (i === 0 || v > splits[i - 1]));
  console.log(`  ${c.name.padEnd(20)} RT ${f3(l.reaction)}  60ft ${f3(l.sixty)}  330 ${f3(l.threeThirty)}`
    + `  1/8 ${f3(l.eighth)} @ ${l.eighthMph?.toFixed(1)}  1000 ${f3(l.thousand)}`
    + `  1/4 ${f3(l.et)} @ ${l.mph?.toFixed(1)} mph   (quarter mile ${q.toFixed(2)})`);
  check(l.clean, `${c.name}: finished clean`);
  check(l.reaction > 0.25 && l.reaction < 0.5, `${c.name}: reaction ${f3(l.reaction)} is 0.25 s plus the rollout`);
  check(ordered, `${c.name}: 60 ft, 330 ft, 1/8, 1000 ft and 1/4 come in order`);
  check(l.et > q - 0.4 && l.et < q + 0.1, `${c.name}: ET ${f3(l.et)} is its quarter mile ${q.toFixed(2)} less the rollout`);
  check(l.mph > 60 && l.mph < gameSpecs(c).topSpeedMph + 1, `${c.name}: trap ${l.mph?.toFixed(1)} mph is a real speed`);
}

console.log('\nThe rules');
{
  const { r } = pass([getChassis('porsche-911')], [-0.3]);
  check(r.lanes[0].red && r.lanes[0].reaction < 0, `leaving 0.3 s early is a red light (reaction ${f3(r.lanes[0].reaction)})`);
}
{
  const c = getChassis('porsche-911');
  const { r } = pass([c, c], [0.1, 0.43]);
  check(r.winner === 0 && Math.abs(r.margin - 0.33) < 0.01,
    `two 911s, one 0.33 s late off the line: it loses by ${f3(r.margin)} s`);
}
{
  const c = getChassis('mustang-gt');
  // The left lane drifts right into the other lane a second into the pass.
  const { r } = pass([c, c], [0.2, 0.2],
    (k, t, d) => (k === 0 && t > d.greenAt + 1.2 && t < d.greenAt + 1.7 ? -0.12 : 0));
  check(r.lanes[0].foul && r.winner === 1 && r.why === 'foul', 'crossing the centre line is a foul, and loses');
}
{
  const c = getChassis('chevelle-ss');
  const { r } = pass([c, c], [0.2, null]);
  check(!r.lanes[1].finished && r.winner === 0 && r.why === 'noTime', 'a car that never leaves has no time, and loses');
}
{
  const c = getChassis('tesla-roadster') ?? CHASSIS[0];
  const a = pass([c], [0.2]).r.lanes[0], b = pass([c], [0.2]).r.lanes[0];
  check(a.et === b.et && a.mph === b.mph && a.reaction === b.reaction, 'the same pass twice is identical');
}

console.log(failed ? '\nFAIL: drag timing has a problem.' : '\nPASS: drag passes are timed right, and the rules hold.');
process.exit(failed ? 1 : 0);
