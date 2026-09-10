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
// The gate is finite. A car cutting across the infield passes through the plane
// of a gate it is nowhere near, so the crossing only counts if the car is also
// within the road width at that point.
//
// This class only reports crossings and their direction. Deciding what a
// crossing MEANS -- a valid lap, a missed gate, a reversal -- is LapTimer's job.

const GATE_MARGIN = 3.0; // meters of slack outside the road edge, so a car
                         // riding the curb still trips the gate
// ...and of height. A gate on a flyover must not be tripped by a car passing
// underneath it, nor a gate under the bridge by a car going over. The crest on
// Pine Ridge puts a car about a metre in the air, so this is well clear of any
// jump and well short of any bridge.
const GATE_HEIGHT = 5.0;

export class Checkpoints {
  constructor(track) {
    this.track = track;
    this.gates = track.checkpoints;
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
      if (y !== undefined && Math.abs(y - g.y) > GATE_HEIGHT) continue;
      const dPrev = (prevX - g.x) * g.tx + (prevZ - g.z) * g.tz;
      const dNow = (x - g.x) * g.tx + (z - g.z) * g.tz;
      if ((dPrev < 0) === (dNow < 0)) continue;

      // Where along the plane the car passed. Off the end of the gate means it
      // was never really there.
      const span = dNow - dPrev;
      const f = span === 0 ? 0 : -dPrev / span;
      const cx = prevX + (x - prevX) * f;
      const cz = prevZ + (z - prevZ) * f;
      const lateral = (cx - g.x) * g.lx + (cz - g.z) * g.lz;
      if (Math.abs(lateral) > g.half + GATE_MARGIN) continue;

      this._event.index = k;
      this._event.forward = dPrev < 0;
      this._event.fraction = f < 0 ? 0 : f > 1 ? 1 : f;
      return this._event;
    }
    return null;
  }
}
