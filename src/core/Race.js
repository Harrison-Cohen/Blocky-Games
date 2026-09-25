// A race: the field, the grid, the lights, and everything that happens between
// the lights going out and the last car taking the flag.
//
// No Three.js and no DOM in here. The race is a simulation that owns the
// drivers and the standings and is handed the cars' physics; Game owns the
// meshes that show it. That is what lets `npm run race` run a full field round
// every track with no browser -- the same code, not a copy of it.
//
// Each fixed step, in order:
//   1. every car's position on the track, once, for the drivers to read
//   2. every driver decides, every car moves -- the player's too
//   3. contact between the cars is resolved
//   4. the standings see who crossed a checkpoint during the step

import { AIDriver } from '../ai/AIDriver.js';
import { SpeedProfile } from '../ai/SpeedProfile.js';
import { Standings } from '../ai/Standings.js';
import { resolveContacts } from '../game/Contact.js';
import { getChassis, bodyCenter } from '../data/cars.js';
import { RACE, AI, SUSPENSION } from '../data/tuning.js';

const IDLE = { throttle: 0, brake: 0, steer: 0, handbrake: 0, steerIsAnalog: true, pedalsAreAnalog: true };

// The profile lap time for a chassis at a given bravery.
function profileLap(track, line, chassis, gripUse, brakeMargin) {
  return new SpeedProfile(track, line, chassis, { gripUse, brakeMargin }).lapTime();
}

// How a driver in this chassis reaches a lap of `want` seconds: the grip use,
// and a scale on the whole speed plan. Lap time falls as grip use rises, so a
// bisection finds it in a dozen profiles -- within RACE.minGrip and maxGrip.
// Past maxGrip the chassis is being asked for more than it has, so the driver
// runs at maxGrip and is simply slower. Below minGrip a quick car would be
// timid in the corners and flat out on the straights, braking far earlier than
// the cars round it; instead it stays at minGrip and the whole plan is scaled
// down evenly.
function solvePace(track, line, chassis, brakeMargin, want) {
  const lapAt = (g) => profileLap(track, line, chassis, g, brakeMargin);
  if (lapAt(RACE.maxGrip) > want) return { gripUse: RACE.maxGrip, speedScale: 1 };
  const slowest = lapAt(RACE.minGrip);
  if (slowest < want) return { gripUse: RACE.minGrip, speedScale: slowest / want };
  let lo = RACE.minGrip, hi = RACE.maxGrip;
  for (let k = 0; k < 12; k++) {
    const mid = (lo + hi) / 2;
    if (lapAt(mid) > want) lo = mid; else hi = mid;
  }
  return { gripUse: (lo + hi) / 2, speedScale: 1 };
}

export class Race {
  // settings: { laps, difficulty }
  // player:   { physics, chassis, name, number, color }
  // field:    [{ spec, physics, chassis, color }] -- the opponents, in any order
  constructor({ track, line, settings, player, field }) {
    this.track = track;
    this.line = line;
    this.laps = settings.laps;
    this.level = RACE.levels[settings.difficulty] ?? RACE.levels.club;
    this.difficulty = settings.difficulty;

    // Tune every opponent to a lap time. The reference is a clean 911 lap
    // on this track; the difficulty sets how far off it the field runs, and
    // each driver's own style moves them a little either side of that.
    const refChassis = getChassis(RACE.referenceChassis);
    const reference = profileLap(track, line, refChassis, RACE.referenceGrip, AI.brakeMargin);
    const tuned = field.map((f, k) => {
      const style = f.spec.style;
      const spread = 1 - RACE.driverSpread * ((style.gripUse ?? AI.gripUse) - 0.65);
      const want = reference * this.level.pace * spread;
      const brakeMargin = (style.brakeMargin ?? AI.brakeMargin) * this.level.brake;
      const { gripUse, speedScale } = solvePace(track, line, f.chassis, brakeMargin, want);
      return { f, k, want, gripUse, speedScale, brakeMargin };
    });
    // Quickest at the front of the grid, as a qualifying session would put them.
    tuned.sort((a, b) => a.want - b.want);

    this.entries = tuned.map(({ f, k, gripUse, speedScale, brakeMargin }) => ({
      id: f.spec.id,
      name: f.spec.name,
      number: f.spec.car.number,
      color: f.color,
      chassis: f.chassis,
      physics: f.physics,
      isPlayer: false,
      halfLen: f.chassis.bodyLength / 2,
      halfWid: f.chassis.bodyWidth / 2,
      offset: bodyCenter(f.chassis),
      driver: new AIDriver(track, line, f.chassis, {
        name: f.spec.name, ...f.spec.style, gripUse, speedScale, brakeMargin,
        mistakeRate: this.level.mistakes, seed: 1000 + k * 7919,
      }),
    }));
    // The player starts last, as the spec asks.
    this.player = {
      id: 'player', name: player.name, number: player.number, color: player.color,
      chassis: player.chassis, physics: player.physics, isPlayer: true,
      halfLen: player.chassis.bodyLength / 2, halfWid: player.chassis.bodyWidth / 2,
      offset: bodyCenter(player.chassis),
      driver: null,
    };
    this.entries.push(this.player);

    this.standings = new Standings(track, this.laps, this.entries);
    this.playerRow = this.standings.rows[this.entries.length - 1];
    this.traffic = this.entries.map((e) => ({ i: 0, lat: 0, y: 0, speed: 0, halfLen: e.halfLen, halfWid: e.halfWid }));
    this.contactCars = this.entries.map((e) => ({ physics: e.physics, halfLen: e.halfLen, halfWid: e.halfWid }));

    this.phase = 'countdown';   // then 'racing', then 'done'
    this.countdown = RACE.countdown;
    this.playerFinished = false;
    this.playerFinishClock = 0;
    this.coolDown = null;
    this.contacts = 0;
    this.placeGrid();
  }

  // Two by two, staggered, behind the line.
  placeGrid() {
    const t = this.track;
    this.entries.forEach((e, k) => {
      const row = Math.floor(k / 2);
      const right = k % 2 === 1;
      const back = RACE.gridFirst + row * RACE.gridRow + (right ? RACE.gridStagger : 0);
      const lateral = right ? -RACE.gridLateral : RACE.gridLateral;
      const spawn = t.spawnAt(t.startSample, back, lateral);
      const rest = e.chassis.suspensionRest ?? SUSPENSION.restLength;
      const ground = t.sample(spawn.x, spawn.z, spawn.y);
      e.physics.reset(spawn.x, ground.height + rest, spawn.z, spawn.yaw);
      if (e.driver) e.driver.reset();
    });
  }

  get clock() { return this.standings.clock; }

  step(dt, playerInput) {
    const t = this.track;
    if (this.phase === 'countdown') {
      // Every car sits on its springs but goes nowhere: stepped with no input,
      // then put back where it was. The player's throttle does nothing yet.
      for (const e of this.entries) {
        const p = e.physics;
        const x = p.x, z = p.z, yaw = p.yaw;
        p.step(dt, IDLE, t);
        p.x = x; p.z = z; p.yaw = yaw;
        p.vLong = 0; p.vLat = 0; p.yawRate = 0;
      }
      this.countdown -= dt;
      if (this.countdown <= 0) {
        this.countdown = 0;
        this.phase = 'racing';
        // Everyone leaves the grid in their own lane rather than diving for
        // the racing line together.
        this.entries.forEach((e, k) => {
          if (e.driver) e.driver.holdLane(k % 2 === 1 ? -RACE.gridLateral : RACE.gridLateral);
        });
      }
      return;
    }

    // 1. where everyone is, once
    for (let k = 0; k < this.entries.length; k++) {
      const p = this.entries[k].physics, tr = this.traffic[k];
      const i = t.nearestIndex(p.x, p.z, p.y);
      tr.i = i;
      tr.lat = (p.x - t.px[i]) * t.lx[i] + (p.z - t.pz[i]) * t.lz[i];
      tr.y = p.y;
      tr.speed = p.speed;
    }
    if (RACE.catchUp) this._catchUp();

    // 2. drive
    for (let k = 0; k < this.entries.length; k++) {
      const e = this.entries[k];
      let input;
      if (!e.isPlayer) input = e.driver.update(dt, e.physics, this.traffic, k);
      else if (this.coolDown) input = this.coolDown.update(dt, e.physics, this.traffic, k);
      else input = playerInput;
      e.physics.step(dt, input, t);
    }

    // 3. contact
    for (const e of this.entries) {
      e.physics.inContact = false;
      e.physics.contactSpeed = (e.physics.contactSpeed || 0) * Math.exp(-6 * dt);
    }
    this.contacts += resolveContacts(this.contactCars, dt);

    // 4. standings
    this.standings.step(dt);

    if (!this.playerFinished && this.playerRow.finished) {
      this.playerFinished = true;
      this.playerFinishClock = this.clock;
      // Past the flag the AI drives the player's car round, gently, so the
      // rest of the field has somebody to go round rather than into.
      this.coolDown = new AIDriver(t, this.line, this.player.chassis,
        { name: 'Cool down', gripUse: RACE.coolDownGrip, wander: 0 });
    }
    if (this.phase === 'racing' && this.playerFinished) {
      const allIn = this.standings.rows.every((r) => r.finished);
      if (allIn || this.clock - this.playerFinishClock > RACE.finishTimeout) this.phase = 'done';
    }
  }

  // Rubber banding, when switched on: opponents behind the player get a little
  // more target speed, more the further back they are.
  _catchUp() {
    const s = this.standings;
    const mine = s.distance(this.playerRow);
    for (const r of s.rows) {
      const e = r.entry;
      if (e.isPlayer) continue;
      const behind = mine - s.distance(r);
      e.driver.boost = 1 + RACE.catchUpBonus * Math.min(1, Math.max(0, behind) / RACE.catchUpRange);
    }
  }

  // What the HUD shows.
  view() {
    const s = this.standings;
    const order = s.order();
    const at = order.indexOf(this.playerRow);
    const ahead = at > 0 ? order[at - 1] : null;
    const behind = at < order.length - 1 ? order[at + 1] : null;
    // The timing gap, from the last checkpoint both cars crossed. If one has
    // passed the other since then, that reading is stale and points the wrong
    // way -- so until the next checkpoint, estimate it from the distance
    // between them at the speed of the car behind.
    const gap = (front, back) => {
      const g = s.interval(front, back);
      if (g !== null && g >= 0) return g;
      if (front.finished || back.finished) return g;
      const d = s.distance(front) - s.distance(back);
      return Math.max(0, d / Math.max(5, back.entry.physics.speed));
    };
    return {
      position: at + 1,
      count: order.length,
      lap: Math.max(1, Math.min(this.laps, this.playerRow.lap)),
      laps: this.laps,
      ahead: ahead ? { name: ahead.entry.name, gap: gap(ahead, this.playerRow) } : null,
      behind: behind ? { name: behind.entry.name, gap: gap(this.playerRow, behind) } : null,
      finished: this.playerFinished,
    };
  }

  // The classification. Anyone still running when the race is called is shown
  // in their running order without a time.
  results() {
    const s = this.standings;
    const order = s.order();
    const winner = order[0];
    const fastest = s.fastest;
    return order.map((r, k) => ({
      position: k + 1,
      name: r.entry.name,
      number: r.entry.number,
      color: r.entry.color,
      chassis: r.entry.chassis.name,
      isPlayer: r.entry.isPlayer,
      assisted: !!r.entry.assisted,
      finished: r.finished,
      total: r.finished ? r.finishTime : null,
      gap: r.finished && winner.finished && r !== winner ? r.finishTime - winner.finishTime : null,
      lapsDown: !r.finished && winner.finished ? Math.max(0, this.laps - r.lap + 1) : 0,
      best: r.best,
      fastest: !!fastest && fastest.row === r,
    }));
  }
}
