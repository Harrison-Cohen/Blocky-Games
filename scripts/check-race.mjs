// Proves race mode works: a full field on every track, three laps, with the
// player's car driven by the AI too. Everybody has to finish; nobody may spend
// long off the road, stuck, or leaning on somebody else; the difficulty
// settings have to come out in the right order; and the same race run twice
// has to come out the same.
//
// The spec's test for the AI is that it "races side by side without turning
// into bumper cars". Contact time is the measurement for that.
//
//   npm run race            all tracks
//   npm run race -- harbor  tracks whose id contains "harbor"

import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));
const { VehiclePhysics } = await import(SRC + 'game/VehiclePhysics.js');
const { Track } = await import(SRC + 'game/Track.js');
const { RacingLine } = await import(SRC + 'ai/RacingLine.js');
const { AIDriver } = await import(SRC + 'ai/AIDriver.js');
const { Race } = await import(SRC + 'core/Race.js');
const { getChassis } = await import(SRC + 'data/cars.js');
const { OPPONENTS } = await import(SRC + 'data/opponents.js');
const { SIM, RACE, CONTACT } = await import(SRC + 'data/tuning.js');

const dir = SRC + 'data/tracks/';
const filter = process.argv[2];
const tracks = [];
for (const f of readdirSync(dir).sort()) {
  if (!f.endsWith('.js') || f === 'index.js') continue;
  const data = (await import(dir + f)).default;
  // A drag strip is raced two cars at a time, not in a field: npm run drag.
  if (data && data.id && !data.drag && (!filter || data.id.includes(filter))) tracks.push(data);
}
tracks.sort((a, b) => a.order - b.order);

const dt = 1 / SIM.hz;
let failed = false;
const fail = (msg) => { failed = true; console.log(`  FAIL  ${msg}`); };

function runRace(track, line, difficulty, opponents = RACE.maxOpponents) {
  const player = { physics: new VehiclePhysics(getChassis('porsche-911')), chassis: getChassis('porsche-911'),
    name: 'Player', number: 7, color: 0xff7a1a };
  const field = OPPONENTS.slice(0, opponents).map((spec) => {
    const chassis = getChassis(spec.chassis);
    return { spec, chassis, physics: new VehiclePhysics(chassis), color: 0xffffff };
  });
  const race = new Race({ track, line, settings: { laps: RACE.laps, difficulty }, player, field });
  // The stand-in for the player: a Club-ish driver who also sees the traffic.
  const me = race.entries.length - 1;
  const stand = new AIDriver(track, line, player.chassis, { name: 'Player', gripUse: RACE.referenceGrip, seed: 99 });

  const stats = race.entries.map(() => ({ off: 0, offMax: 0, wall: 0, contact: 0, stuck: 0, stuckMax: 0, hardest: 0 }));
  const limit = SIM.hz * (track.data.targetLap * RACE.laps * 2.5 + 30);
  let steps = 0;
  while (race.phase !== 'done' && steps < limit) {
    race.step(dt, stand.update(dt, player.physics, race.traffic, me));
    steps++;
    if (race.phase !== 'racing') continue;
    race.entries.forEach((e, k) => {
      const p = e.physics, s = stats[k];
      const row = race.standings.rows[k];
      if (row.finished) return;
      if (!p.onTrack) { s.off += dt; s.offMax = Math.max(s.offMax, s.off); } else s.off = 0;
      if (p.touchingBarrier) s.wall += dt;
      if (p.inContact) s.contact += dt;
      s.hardest = Math.max(s.hardest, p.contactSpeed || 0);
      if (race.clock > 6 && p.speed < 3) { s.stuck += dt; s.stuckMax = Math.max(s.stuckMax, s.stuck); } else s.stuck = 0;
    });
  }
  return { race, stats, steps };
}

function report(track, { race, stats }, verbose) {
  const results = race.results();
  const rows = race.standings.rows;
  const all = rows.every((r) => r.finished);
  if (!all) fail(`${track.data.name}: ${rows.filter((r) => !r.finished).length} car(s) did not finish`);
  const winner = results[0];
  if (verbose) {
    console.log(`\n${track.data.name}  ${race.laps} laps, ${race.difficulty}, ${race.entries.length} cars, `
      + `${race.contacts} contact steps, fastest lap ${race.standings.fastest ? race.standings.fastest.time.toFixed(2) : '-'}s `
      + `(${race.standings.fastest ? race.standings.fastest.row.entry.name : '-'})`);
  }
  for (const res of results) {
    const k = race.entries.findIndex((e) => e.name === res.name);
    const s = stats[k];
    const time = race.standings.rows[k].finishTime ?? race.clock;
    const contactShare = s.contact / time;
    const problems = [];
    if (s.offMax > 4) problems.push(`off the road ${s.offMax.toFixed(1)}s at once`);
    if (s.stuckMax > 5) problems.push(`stuck ${s.stuckMax.toFixed(1)}s`);
    if (contactShare > 0.05) problems.push(`in contact ${(contactShare * 100).toFixed(1)}% of the race`);
    if (problems.length) fail(`${track.data.name}: ${res.name} ${problems.join(', ')}`);
    if (verbose) {
      console.log(`  P${String(res.position).padEnd(2)} ${res.name.padEnd(15)} ${res.chassis.padEnd(13)} `
        + `${res.total !== null ? res.total.toFixed(2).padStart(7) + 's' : ' running'}`
        + `${res.gap !== null ? ('  +' + res.gap.toFixed(2)).padEnd(9) : '         '}`
        + `  best ${res.best !== null ? res.best.toFixed(2) : '-'}${res.fastest ? ' *' : '  '}`
        + `  contact ${(contactShare * 100).toFixed(1)}%  hardest ${s.hardest.toFixed(1)} m/s  wall ${s.wall.toFixed(1)}s`);
    }
  }
  return results;
}

const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;

for (const data of tracks) {
  const track = new Track(data);
  const line = new RacingLine(track);
  report(track, runRace(track, line, RACE.difficulty), true);
}

// Difficulty has to mean something: on the first track, the field's average
// finishing time must fall from Rookie to Club to Pro.
{
  const track = new Track(tracks[0]);
  const line = new RacingLine(track);
  const avg = {};
  for (const level of ['rookie', 'club', 'pro']) {
    const { race } = runRace(track, line, level);
    const times = race.standings.rows.filter((r) => !r.entry.isPlayer && r.finished).map((r) => r.finishTime);
    avg[level] = mean(times);
  }
  console.log(`\ndifficulty on ${track.data.name}: field average ${Object.entries(avg).map(([k, v]) => `${k} ${v.toFixed(1)}s`).join(', ')}`);
  if (!(avg.rookie > avg.club && avg.club > avg.pro)) fail('difficulty levels are not in order');
}

// Repeatability: the same race twice must finish in the same order at the same
// times, to the bit. Mistakes, passing and contact are all on the fixed clock.
{
  const track = new Track(tracks[0]);
  const line = new RacingLine(track);
  const a = runRace(track, line, 'rookie').race.results().map((r) => `${r.name}:${r.total}`);
  const b = runRace(track, line, 'rookie').race.results().map((r) => `${r.name}:${r.total}`);
  const same = a.join('|') === b.join('|');
  console.log(`repeatability: two identical races finished ${same ? 'identically' : 'DIFFERENTLY'}`);
  if (!same) fail('a race does not replay the same way');
}

console.log(failed
  ? '\nFAIL: race mode has a problem.'
  : '\nPASS: a full field races every track to the flag, cleanly, in the right order of difficulty, and repeatably.');
process.exit(failed ? 1 : 0);
