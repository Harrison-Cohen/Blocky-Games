// Checkpoint crossing detection.
//
// A checkpoint is a plane through a centerline sample, facing down the track.
// Crossing it is a sign change in the signed distance to that plane between the
// previous physics position and the current one, which is why this runs on the
// fixed step and takes the PREVIOUS position as an argument rather than reading
// it back later: at 50 m/s the car covers 0.4 m per step, so testing only the
// current position would miss nothing, but the FRACTION of the step at which
// the plane was crossed is what keeps lap times off the 8.3 ms step grid.
//
// A gate has no width. It spans the WHOLE drivable area -- road, curbs,
// runoff, out to the barrier and beyond -- so a car anywhere on this part of
// the track trips it, however wide it runs. Earlier versions stopped the gate a
// fixed distance past the road edge, and a car running wide through the runoff
// went past unseen; the next gate then called a cleanly driven lap a missed
// checkpoint.
//
// What stops an unbounded plane from firing for a car on some OTHER part of the
// track that happens to cross its extension is WHERE the crossing happened: the
// crossing point's nearest road sample has to be within half a gate spacing of
// this gate. That lookup is height-aware, so a gate on a flyover is not tripped
// by a car on the road underneath, nor the reverse. Cutting the infield is
// still caught -- by the barriers, and by the off-track timer.
//
// This class only reports crossings and their direction. Deciding what a
// crossing MEANS -- a valid lap, a missed gate, a reversal -- is LapTimer's job.

export class Checkpoints {
  constructor(track) {
    this.track = track;
    this.gates = track.checkpoints;
    // How far along the lap, in samples, a crossing may be from its gate and
    // still belong to it: half the gap to the next gate.
    this.reach = Math.max(2, Math.round(track.length / this.gates.length / 2 / track.ds));
    // Reused, so a 120 Hz hot path with a six car field allocates nothing.
    this._event = { index: 0, forward: true, fraction: 0 };
  }

  get count() {
    return this.gates.length;
  }

  // Returns the crossing that happened during this step, or null. At most one
  // gate can be crossed per step unless the car covers a whole checkpoint
  // spacing in 8.3 ms, which is 8400 m/s.
  update(prevX, prevZ, x, z, y) {
    for (let k = 0; k < this.gates.length; k++) {
      const g = this.gates[k];
      const dPrev = (prevX - g.x) * g.tx + (prevZ - g.z) * g.tz;
      const dNow = (x - g.x) * g.tx + (z - g.z) * g.tz;
      if ((dPrev < 0) === (dNow < 0)) continue;

      // Where the car passed through the plane. Only a crossing on this part of
      // the track counts; the plane runs on forever and other roads cross it.
      const span = dNow - dPrev;
      const f = span === 0 ? 0 : -dPrev / span;
      const cx = prevX + (x - prevX) * f;
      const cz = prevZ + (z - prevZ) * f;
      const n = this.track.count;
      let gap = Math.abs(this.track.nearestIndex(cx, cz, y) - g.sample);
      if (gap > n / 2) gap = n - gap;
      if (gap > this.reach) continue;

      this._event.index = k;
      this._event.forward = dPrev < 0;
      this._event.fraction = f < 0 ? 0 : f > 1 ? 1 : f;
      return this._event;
    }
    return null;
  }
}
