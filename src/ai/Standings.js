// Live race standings.
//
// Position comes from three things only, as the spec asks: how many laps a car
// has done, the last checkpoint it crossed, and how far it is past that
// checkpoint toward the next one. Never from raw distance in the world -- on a
// figure-8, or on a track that doubles back, the car nearest the finish line
// in a straight line can be half a lap behind.
//
// Every checkpoint crossing is timed to a fraction of a step, the same way the
// lap timer does it, and kept. That gives two things for free:
//
//   laps and the fastest lap, from the start/finish crossings
//   the gap between any two cars, as the difference between the times they
//   crossed the same checkpoint -- which is what a timing screen shows, and
//   unlike a distance divided by a speed it does not jump in a corner
//
// A crossing only counts if it is the gate the car needs next, forwards. A
// car reset to its last checkpoint drives back over it and nothing happens.

import { Checkpoints } from '../game/Checkpoints.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export class Standings {
  // entries: anything with a `physics`. Rows are created in entry order.
  constructor(track, laps, entries) {
    this.track = track;
    this.laps = laps;
    this.gates = new Checkpoints(track);
    this.n = this.gates.count;
    this.clock = 0;
    this.fastest = null; // { row, time }
    this.rows = entries.map((entry) => ({
      entry,
      lap: 0,         // the lap being driven, 1-based; 0 is still on the grid
      next: 0,        // the gate this car needs next; 0 is the start line
      passed: 0,      // gates crossed in order since the start, counting the line
      times: [],      // race time at each of those crossings
      lapStart: 0,
      lapTimes: [],
      best: null,
      finished: false,
      finishTime: null,
    }));
  }

  // Once per fixed step, after the cars have moved (and been pushed apart).
  step(dt) {
    const t0 = this.clock;
    this.clock += dt;
    for (const r of this.rows) {
      if (r.finished) continue;
      const p = r.entry.physics;
      const ev = this.gates.update(p.prevX, p.prevZ, p.x, p.z, p.y);
      if (!ev || !ev.forward || ev.index !== r.next) continue;
      this._crossed(r, ev.index, t0 + ev.fraction * dt);
    }
  }

  _crossed(r, gate, at) {
    r.times[r.passed] = at;
    r.passed++;
    if (gate === 0) {
      if (r.lap > 0) {
        const lt = at - r.lapStart;
        r.lapTimes.push(lt);
        if (r.best === null || lt < r.best) r.best = lt;
        if (!this.fastest || lt < this.fastest.time) this.fastest = { row: r, time: lt };
        if (r.lap >= this.laps) {
          r.finished = true;
          r.finishTime = at;
          r.next = -1;
          return;
        }
      }
      r.lap++;
      r.lapStart = at;
    }
    r.next = (gate + 1) % this.n;
  }

  // Race distance in metres from the start line, for ordering. Negative while
  // still behind the line on the grid.
  distance(r) {
    const T = this.track;
    const p = r.entry.physics;
    const here = T.progressAt(p.x, p.z, p.y) * T.ds;
    if (r.passed === 0) return here > T.length / 2 ? here - T.length : here;
    const g = this.gates.gates;
    const c = r.passed - 1;
    const lapIndex = Math.floor(c / this.n);
    const gate = c % this.n;
    const from = g[gate].distance;
    const to = gate + 1 < this.n ? g[gate + 1].distance : T.length;
    let past = here - from;
    if (past < -T.length / 2) past += T.length;
    return lapIndex * T.length + from + clamp(past, 0, to - from);
  }

  // Finished cars first, in finishing order; then everyone else by distance.
  order() {
    const withDist = this.rows.map((r) => ({ r, d: r.finished ? 0 : this.distance(r) }));
    withDist.sort((a, b) => {
      if (a.r.finished && b.r.finished) return a.r.finishTime - b.r.finishTime;
      if (a.r.finished) return -1;
      if (b.r.finished) return 1;
      return b.d - a.d;
    });
    return withDist.map((x) => x.r);
  }

  // Seconds `behind` is behind `ahead`, at the last checkpoint `behind` crossed.
  // Null until there is a checkpoint both have crossed.
  interval(ahead, behind) {
    const c = behind.passed - 1;
    if (c < 0 || ahead.times[c] === undefined) return null;
    return behind.times[c] - ahead.times[c];
  }
}
