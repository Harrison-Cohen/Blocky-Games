// A drag pass: one or two cars staged side by side on a track with a `drag`
// block, a tree of start lights, and the timing a real dragway gives you.
//
// Pure state on the fixed clock, like Race: no Three.js, no DOM, so the check
// scripts drive it headless. It moves the cars itself, because every car has
// to be timed inside the step that moved it.
//
// How a pass is timed, as on a real strip:
//   - Each car is staged with its front tyres on the start line.
//   - The tree: stageTime on the line, then three ambers STRIP.amberGap apart,
//     then the green (a full tree).
//   - The clock starts when the front tyre has rolled STRIP.rollout, seven
//     inches. Reaction time is that moment less the green; leaving before the
//     green is a red light.
//   - ET at each mark (60 ft, 330 ft, 1/8 mile, 1000 ft, the finish) runs from
//     that same moment. Speeds are averaged over the 66 ft before the 1/8 mile
//     and before the finish.
//   - Every crossing is interpolated inside the physics step it happened in,
//     so nothing is quantised to 1/120 s.
//   - First to the finish line wins -- reaction time counts. A red light or a
//     car that crosses into the other lane loses; if both red-light, the first
//     to go loses.

import { STRIP, SUSPENSION } from '../data/tuning.js';

const FT = 0.3048;

export class Drag {
  // lanes: [{ physics, chassis, name }], one or two. The first takes the left
  // lane, the second the right.
  constructor(track, lanes) {
    this.track = track;
    this.distance = track.data.drag.distance;
    this.laneOffset = track.data.drag.lane;
    const s = track.startSample;
    this.x0 = track.px[s]; this.z0 = track.pz[s];
    this.tx = track.tx[s]; this.tz = track.tz[s];
    this.lx = track.lx[s]; this.lz = track.lz[s];
    this.yaw = Math.atan2(this.tx, this.tz);

    const trap = STRIP.trap;
    const L = this.distance;
    // Every distance a crossing is recorded at, from the start line.
    this.marks = [
      { id: 'leave', d: STRIP.rollout },
      { id: 'sixty', d: 60 * FT },
      { id: 'threeThirty', d: 330 * FT },
      { id: 'eighthTrap', d: 660 * FT - trap },
      { id: 'eighth', d: 660 * FT },
      { id: 'thousand', d: 1000 * FT },
      { id: 'finishTrap', d: L - trap },
      { id: 'finish', d: L },
    ].filter((m) => m.id === 'finish' || m.id === 'finishTrap' || m.d < L);

    this.lanes = lanes.map((l, k) => ({ ...l, side: k === 0 ? 1 : -1 }));
    this.restage();
  }

  get twoLane() { return this.lanes.length > 1; }

  // Back on the line, both cars staged, the tree dark.
  restage() {
    this.clock = 0;
    this.phase = 'staged'; // then 'run' at the green, 'done' once the slip is ready
    this.greenAt = STRIP.stageTime + 3 * STRIP.amberGap;
    this.settledAt = null;
    for (const lane of this.lanes) {
      const p = lane.physics;
      const spawn = this.spawnFor(lane);
      const rest = lane.chassis.suspensionRest ?? SUSPENSION.restLength;
      const ground = this.track.sample(spawn.x, spawn.z, spawn.y);
      p.reset(spawn.x, ground.height + rest, spawn.z, spawn.yaw);
      Object.assign(lane, {
        cross: {}, leave: null, reaction: null, red: false, foul: false,
        finished: false, noTime: false, dist: 0,
      });
    }
  }

  // Staged: square to the strip in its own lane, front axle on the line.
  spawnFor(lane) {
    const a = lane.physics.a;
    const lat = lane.side * this.laneOffset;
    return {
      x: this.x0 - this.tx * a + this.lx * lat,
      y: this.track.py[this.track.startSample],
      z: this.z0 - this.tz * a + this.lz * lat,
      yaw: this.yaw,
    };
  }

  // controls: one input per lane, in lane order.
  step(dt, controls) {
    this.clock += dt;
    if (this.phase === 'staged' && this.clock >= this.greenAt) this.phase = 'run';
    this.lanes.forEach((lane, k) => {
      lane.physics.step(dt, controls[k], this.track);
      this._time(lane, dt);
    });
    if (this.phase !== 'run') return;

    // Past the timeout, whoever has not finished has no time.
    if (this.clock - this.greenAt > STRIP.timeout) {
      for (const lane of this.lanes) if (!lane.finished) lane.noTime = true;
    }
    const over = this.lanes.every((l) => l.finished || l.noTime);
    if (over && this.settledAt === null) this.settledAt = this.clock;
    if (this.settledAt !== null && this.clock - this.settledAt >= STRIP.slipDelay) this.phase = 'done';
  }

  // Where the front axle is: metres along the strip from the start line, and
  // metres to the left of the centreline.
  _front(x, z, yaw, a, out) {
    const fx = x + Math.sin(yaw) * a - this.x0;
    const fz = z + Math.cos(yaw) * a - this.z0;
    out.d = fx * this.tx + fz * this.tz;
    out.lat = fx * this.lx + fz * this.lz;
    return out;
  }

  _time(lane, dt) {
    const p = lane.physics;
    const was = this._front(p.prevX, p.prevZ, p.prevYaw, p.a, this._a || (this._a = {}));
    const d0 = was.d;
    const now = this._front(p.x, p.z, p.yaw, p.a, this._b || (this._b = {}));
    const d1 = now.d;
    lane.dist = d1;
    if (lane.finished) return;

    // Into the other lane before the finish: a foul, whatever the clock says.
    if (this.twoLane && lane.side * now.lat < -STRIP.centreLine) lane.foul = true;

    if (d1 <= d0) return;
    for (const m of this.marks) {
      if (lane.cross[m.id] !== undefined || d0 >= m.d || d1 < m.d) continue;
      const t = this.clock - dt + dt * (m.d - d0) / (d1 - d0);
      lane.cross[m.id] = t;
      if (m.id === 'leave') {
        lane.leave = t;
        lane.reaction = t - this.greenAt;
        lane.red = t < this.greenAt;
      }
      if (m.id === 'finish') lane.finished = true;
    }
  }

  // --- what the HUD and the time slip read ---------------------------------

  // The tree. ambers: how many of the three are lit; per lane, its red and
  // green lamps.
  tree() {
    const c = this.clock;
    const lit = c < STRIP.stageTime || c >= this.greenAt
      ? 0 : Math.min(3, Math.floor((c - STRIP.stageTime) / STRIP.amberGap) + 1);
    return {
      staged: c < this.greenAt || this.phase === 'staged',
      ambers: lit,
      lanes: this.lanes.map((l) => ({ red: l.red, green: c >= this.greenAt && !l.red })),
    };
  }

  // Seconds since this lane's clock started, frozen at the finish. Null
  // before it has left the line.
  elapsed(k) {
    const l = this.lanes[k];
    if (l.leave === null) return null;
    if (l.finished) return l.cross.finish - l.leave;
    return Math.max(0, this.clock - l.leave);
  }

  // The time slip: every figure for each lane, and who won.
  results() {
    const since = (l, id) => (l.cross[id] === undefined || l.leave === null ? null : l.cross[id] - l.leave);
    const mph = (l, id, trapId) => (l.cross[id] === undefined || l.cross[trapId] === undefined ? null
      : (STRIP.trap / (l.cross[id] - l.cross[trapId])) * 2.236936);
    const lanes = this.lanes.map((l) => ({
      name: l.name,
      chassis: l.chassis,
      reaction: l.reaction,
      red: l.red,
      foul: l.foul,
      finished: l.finished,
      sixty: since(l, 'sixty'),
      threeThirty: since(l, 'threeThirty'),
      eighth: since(l, 'eighth'),
      eighthMph: mph(l, 'eighth', 'eighthTrap'),
      thousand: since(l, 'thousand'),
      et: since(l, 'finish'),
      mph: mph(l, 'finish', 'finishTrap'),
      finishAt: l.finished ? l.cross.finish : null,
      clean: l.finished && !l.red && !l.foul,
    }));
    return { lanes, ...this._winner(lanes) };
  }

  _winner(r) {
    if (r.length < 2) return { winner: null, margin: null, why: null };
    const out = r.map((l) => l.red || l.foul || !l.finished);
    if (!out[0] && !out[1]) {
      const w = r[0].finishAt <= r[1].finishAt ? 0 : 1;
      return { winner: w, margin: Math.abs(r[0].finishAt - r[1].finishAt), why: 'finish' };
    }
    if (out[0] !== out[1]) {
      const w = out[0] ? 1 : 0;
      const loser = r[1 - w];
      return { winner: w, margin: null,
        why: loser.red ? 'red' : loser.foul ? 'foul' : 'noTime' };
    }
    // Both out. Two red lights: the first to go loses.
    if (r[0].red && r[1].red) {
      const w = r[0].reaction < r[1].reaction ? 1 : 0;
      return { winner: w, margin: null, why: 'red' };
    }
    return { winner: null, margin: null, why: 'bothOut' };
  }
}
