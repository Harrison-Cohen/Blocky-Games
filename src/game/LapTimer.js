// Lap timing, sector splits and lap validation.
//
// Everything here runs on the PHYSICS clock. Not Date.now(), which drifts
// against the simulation and jumps when the tab is throttled, and not frame
// deltas, which vary with the display. `clock` advances by exactly dt per fixed
// step, so a lap time is a count of simulation steps and is reproducible.
//
// Crossings are timed to a fraction of a step. Naively counting whole steps
// would quantise every lap and sector time to 8.3 ms, which is a real margin in
// a time trial and makes the best-possible-lap arithmetic visibly lumpy. The
// checkpoint reports WHERE in the step the plane was crossed and that fraction
// is added on, so the resolution is limited by the physics rate only through
// the accuracy of the position, not through the size of the tick.
//
// A lap is valid when every gate was crossed once, in order, forwards, and the
// car never had all four wheels off the racing surface for longer than the
// grace period. Invalid laps still complete and are still shown -- struck
// through -- because hiding them makes the lap list confusing. They are simply
// never saved and never set a record.

import { TIMING } from '../data/tuning.js';
import { Checkpoints } from './Checkpoints.js';
import { load, save, recordName } from '../core/Storage.js';

// Motorsport timing colours, used for both sector splits and the live delta.
export const PURPLE = 'purple'; // best ever seen
export const GREEN = 'green';   // better than the reference
export const YELLOW = 'yellow'; // slower than the reference

export class LapTimer {
  constructor(track, chassisId) {
    this.track = track;
    this.checkpoints = new Checkpoints(track);
    this.sectorCount = track.sectors.length;
    // Kept outside reset(), because swapping chassis resets the timer and must
    // not quietly hand an auto-driven lap back to the player.
    this.assisted = false;
    this.setChassis(chassisId);
  }

  // Records are per track AND per chassis, so swapping cars swaps the target.
  setChassis(chassisId) {
    this.chassisId = chassisId;
    const rec = load(recordName(this.track.data.id, chassisId), null);
    this.best = rec && typeof rec.best === 'number' ? rec.best : null;
    this.bestSplits = rec && Array.isArray(rec.splits) ? rec.splits : null;
    this.bestSectors = rec && Array.isArray(rec.sectors)
      ? rec.sectors.slice()
      : new Array(this.sectorCount).fill(null);
    this.reset();
  }

  reset() {
    this.clock = 0;
    this.laps = [];
    this.running = false;      // a timed lap is in progress
    this.lapStart = 0;
    this.lapTime = 0;
    this.expected = 0;         // next gate index this lap needs
    this.invalid = false;
    this.invalidReason = '';
    this.offTime = 0;
    this.splits = [];          // time from lap start to each gate crossed
    this.sectorIndex = 0;
    this.sectorStart = 0;
    this.sectorTimes = [];
    this.lastLap = null;
    this.newRecord = false;
    this.flash = null;         // { text, colour, until }
    this.delta = null;
    this.deltaColour = YELLOW;
  }

  // Called once per fixed physics step, AFTER the vehicle has stepped, so the
  // physics prev* fields still hold the position at the start of this step.
  step(dt, p) {
    const stepStart = this.clock;
    this.clock += dt;

    if (this.running) {
      this.lapTime = this.clock - this.lapStart;
      if (this.assisted) this._invalidate('auto drive');

      // All four wheels off the racing surface, continuously. Touching the
      // track at all resets the timer -- this is an excursion test, not a
      // budget for how much time may be spent off in total.
      if (p.wheelsOnTrack === 0) {
        this.offTime += dt;
        if (this.offTime > TIMING.offTrackGrace) this._invalidate('off track');
      } else {
        this.offTime = 0;
      }
    }

    const ev = this.checkpoints.update(p.prevX, p.prevZ, p.x, p.z, p.y);
    if (ev) this._crossed(ev, stepStart + ev.fraction * dt);

    if (this.flash && this.clock >= this.flash.until) this.flash = null;
    this._updateDelta(p);
  }

  _crossed(ev, at) {
    if (!ev.forward) {
      // Reversing back over a gate. The lap is gone, but the car is still on
      // track and the timer keeps running until the line.
      if (this.running) this._invalidate('reversed');
      return;
    }

    if (ev.index === 0) {
      if (this.running) this._completeLap(at);
      this._startLap(at);
      return;
    }

    if (!this.running) return; // gates before the first line crossing are an out lap

    if (ev.index !== this.expected) {
      this._invalidate('missed a checkpoint');
      // Carry on from where the car actually is, so one mistake does not make
      // every later gate report a second failure.
      this.expected = ev.index + 1;
    } else {
      this.expected++;
    }

    this.splits[ev.index] = at - this.lapStart;

    // Sector boundaries are checkpoint indices, so a split is a discrete event
    // on an already validated gate rather than a separate distance test.
    const nextBoundary = this.track.sectors[this.sectorIndex + 1];
    if (nextBoundary !== undefined && ev.index === nextBoundary) {
      this._completeSector(at);
    }
  }

  _startLap(at) {
    this.running = true;
    this.lapStart = at;
    this.lapTime = 0;
    this.expected = 1;
    this.invalid = false;
    this.invalidReason = '';
    this.offTime = 0;
    this.splits = [];
    this.sectorIndex = 0;
    this.sectorStart = at;
    this.sectorTimes = [];
  }

  _completeSector(at) {
    const s = this.sectorIndex;
    const time = at - this.sectorStart;
    this.sectorTimes[s] = time;
    this.sectorStart = at;
    this.sectorIndex = s + 1;

    // A sector set on an invalid lap is not a record. It is still shown, so you
    // can see the split you just drove, but only in yellow.
    let colour = YELLOW;
    if (!this.invalid) {
      const bestEver = this.bestSectors[s];
      if (bestEver === null || time < bestEver) {
        this.bestSectors[s] = time;
        colour = PURPLE;
        this._persist();
      } else if (this.bestSplits && time < this._referenceSector(s)) {
        colour = GREEN;
      }
    }
    this.flash = {
      text: `Sector ${s + 1}  ${formatTime(time)}`,
      colour,
      until: this.clock + TIMING.sectorFlashHold,
    };
  }

  // The sector time from the current best lap, for green/yellow comparison.
  _referenceSector(s) {
    if (!this.bestSplits) return Infinity;
    const from = s === 0 ? 0 : this.bestSplits[this.track.sectors[s]];
    const boundary = this.track.sectors[s + 1];
    const to = boundary === undefined ? this.best : this.bestSplits[boundary];
    if (typeof from !== 'number' || typeof to !== 'number') return Infinity;
    return to - from;
  }

  _completeLap(at) {
    const time = at - this.lapStart;
    // Every gate crossed forwards, in order, means expected walked all the way
    // to the end of the list.
    const complete = this.expected >= this.checkpoints.count;
    if (!complete && !this.invalid) this._invalidate('missed a checkpoint');
    const valid = !this.invalid && complete;

    // Close the final sector on the line.
    if (this.sectorIndex < this.sectorCount) this._completeSector(at);

    const lap = {
      number: this.laps.length + 1,
      time,
      valid,
      reason: this.invalidReason,
      sectors: this.sectorTimes.slice(),
    };
    this.laps.push(lap);
    this.lastLap = lap;

    this.newRecord = false;
    if (valid && (this.best === null || time < this.best)) {
      this.best = time;
      this.bestSplits = this.splits.slice();
      this.bestSplits[0] = 0;
      this.bestSplits[this.checkpoints.count] = time;
      this.newRecord = true;
      this._persist();
      this.flash = {
        text: `New record  ${formatTime(time)}`,
        colour: PURPLE,
        until: this.clock + TIMING.sectorFlashHold,
      };
    }
  }

  _invalidate(reason) {
    if (this.invalid) return;
    this.invalid = true;
    this.invalidReason = reason;
  }

  // Auto drive. A lap the AI drove is not the player's lap: it still runs and
  // is still listed, struck through like any other invalid lap, but it can
  // never be saved or set a record. Switching it on part way round throws out
  // the lap in progress, since some of that lap was not driven by the player.
  setAssisted(on) {
    this.assisted = on;
    if (on && this.running) this._invalidate('auto drive');
  }

  // The player pressing R teleports the car. Whatever lap was in progress is
  // not a lap any more.
  invalidateForReset() {
    if (this.running) this._invalidate('reset');
  }

  _persist() {
    save(recordName(this.track.data.id, this.chassisId), {
      best: this.best,
      splits: this.bestSplits,
      sectors: this.bestSectors,
    });
  }

  // Live delta against the best lap, interpolated between checkpoints by how
  // far round the lap the car actually is. Comparing whole checkpoints only
  // would make the delta jump once every 70 m and read as broken.
  _updateDelta(p) {
    this.delta = null;
    if (!this.running || !this.bestSplits || this.best === null) return;
    if (p.speed < TIMING.deltaMinSpeed) return;

    const gates = this.checkpoints.gates;
    const last = Math.min(this.expected - 1, gates.length - 1);
    if (last < 0) return;

    const d0 = gates[last].distance;
    const d1 = last + 1 < gates.length ? gates[last + 1].distance : this.track.length;
    const t0 = this.bestSplits[last];
    const t1 = last + 1 < gates.length ? this.bestSplits[last + 1] : this.best;
    if (typeof t0 !== 'number' || typeof t1 !== 'number' || d1 <= d0) return;

    const here = this.track.progressAt(p.x, p.z, p.y) * this.track.ds;
    const f = Math.max(0, Math.min(1, (here - d0) / (d1 - d0)));
    const reference = t0 + (t1 - t0) * f;
    this.delta = this.lapTime - reference;
    this.deltaColour = this.delta < 0 ? GREEN : YELLOW;
  }

  // Sum of the best sector times ever set: the lap you would have if you strung
  // your best sectors together. Null until every sector has been set once.
  get bestPossible() {
    let total = 0;
    for (const s of this.bestSectors) {
      if (typeof s !== 'number') return null;
      total += s;
    }
    return total;
  }
}

// m:ss.mmm, with tabular figures in the stylesheet so the digits do not shuffle
// as they count. Always three decimals: a lap timer that changes width mid-lap
// is the thing this whole font choice exists to avoid.
export function formatTime(seconds) {
  if (typeof seconds !== 'number' || !isFinite(seconds)) return '--:--.---';
  const sign = seconds < 0 ? '-' : '';
  const s = Math.abs(seconds);
  const m = Math.floor(s / 60);
  const rest = s - m * 60;
  return `${sign}${m}:${rest < 10 ? '0' : ''}${rest.toFixed(3)}`;
}

// +0.123 / -0.456, for the live delta and gaps.
export function formatDelta(seconds) {
  if (typeof seconds !== 'number' || !isFinite(seconds)) return '';
  return `${seconds >= 0 ? '+' : '-'}${Math.abs(seconds).toFixed(3)}`;
}
