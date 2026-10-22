// ============================================================================
// TrackGround
// ----------------------------------------------------------------------------
// The height of the ground around a track, outside its barriers, as one headless
// function of (x, z) in the track's own coordinates. It used to be a private
// method of TrackMesh, which meant the only thing that knew where the hills were
// was a mesh nobody could build without Three.js and about 50 ms to spare. The
// flight world needs the same answer for its terrain and for the aircraft's
// ground contact, whether or not the track's mesh exists, so it lives here and
// TrackMesh asks it.
//
// Nothing about the numbers changed when it moved: TrackMesh's output is
// byte-identical (scripts/check-world.mjs holds a hash of it), so the six
// tracks look and drive as they did.
//
// Two heights, and the difference matters:
//
//   height(x, z)         the ground. Flat at the verge beside the nearest road
//                        inside the graded apron, settling to the level of the
//                        circuit as a whole far away, with hills in between.
//                        This is what the terrain mesh and the scenery sit on.
//   surfaceHeight(x, z)  what an aircraft's wheels meet: the road, curbs and
//                        graded apron where there are any (Track.sample),
//                        and the ground outside them.
// ============================================================================

import { TRACK, WORLD } from '../data/tuning.js';

// Value noise on an integer lattice, for the rolling ground beyond the walls.
// Hash-based rather than table-based so it needs no setup and is identical on
// every machine and every load.
function hash2(ix, iz) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function noise2(x, z, cell) {
  const fx = x / cell, fz = z / cell;
  const ix = Math.floor(fx), iz = Math.floor(fz);
  const tx = fx - ix, tz = fz - iz;
  const sx = tx * tx * (3 - 2 * tx);
  const sz = tz * tz * (3 - 2 * tz);
  const a = hash2(ix, iz), b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
  return (a + (b - a) * sx) * (1 - sz) + (c + (d - c) * sx) * sz;
}

export class TrackGround {
  // amplitude and fade are how hilly the world outside the barriers is. A track
  // says this about itself: a container port is flat and a forest hill climb is
  // not, and one global amplitude cannot be both.
  constructor(track, amplitude = track.data.terrain?.amplitude ?? WORLD.terrainAmplitude,
    fade = track.data.terrain?.fade ?? WORLD.terrainFade) {
    this.track = track;
    this.amplitude = amplitude;
    this.fade = fade;
  }

  // ABSOLUTE height of the ground at a point, outside the barriers.
  //
  // Referenced to the road that happens to be nearest, not to a single ground
  // level for the whole circuit. On a hill climb those differ by sixty metres,
  // and referencing the circuit puts every tree on the ridge down in the
  // valley and every apron on top of a cliff. Far enough out the reference
  // fades to the level of the circuit as a whole, because out there the
  // nearest piece of track changes abruptly as you cross the halfway line
  // between two straights, and a plain that steps when the road does is worse
  // than one that is simply flat.
  //
  // Flat everywhere the car can actually reach: the noise is measured from the
  // outer edge of the graded apron, so hills only start well outside the walls.
  // Scenery uses this too, so props sit ON the ground rather than hovering.
  height(x, z) {
    // Never a bridge deck: the ground under a flyover belongs to whatever runs
    // beneath it, not to the road eight metres overhead.
    const near = this.track.nearestGroundIndex(x, z);
    return this._height(near, x, z, this._outside(near, x, z));
  }

  // The same height, and how far outside the graded apron the point is (see
  // outside), for the cost of one nearest-road search instead of two. The
  // number lands in out.outside.
  heightAndOutside(x, z, out) {
    const near = this.track.nearestGroundIndex(x, z);
    const o = this._outside(near, x, z);
    out.outside = o;
    return this._height(near, x, z, o);
  }

  _outside(near, x, z) {
    const t = this.track;
    const dist = Math.hypot(x - t.px[near], z - t.pz[near]);
    return dist - (t.barrierLimit(t.halfWidth[near]) + t.apronWidth);
  }

  _height(near, x, z, out) {
    const t = this.track;
    const a = Math.min(1, Math.max(0, out / WORLD.terrainSettle));
    const settle = a * a * (3 - 2 * a);
    const base = (t.py[near] - TRACK.vergeDrop) * (1 - settle) + t.groundLevel * settle;

    const amp = this.amplitude;
    if (amp <= 0 || out <= 0) return base;
    const f = Math.min(1, out / this.fade);
    const ease = f * f * (3 - 2 * f);

    // Three octaves: broad hills, then ridges, then a little surface break-up.
    const n =
      (noise2(x, z, 620) - 0.5) * 1.0 +
      (noise2(x + 137, z - 91, 260) - 0.5) * 0.45 +
      (noise2(x - 54, z + 218, 95) - 0.5) * 0.16;
    return base + n * amp * ease;
  }

  // The surface an aircraft's wheels meet. Inside the graded apron that is
  // Track.sample, the one function the cars drive on and the ribbon is built
  // from; outside it, the ground. The two agree at the apron's edge, where both
  // are the verge beside the road. `y`, when given, is the height of whatever
  // is asking and lets a flyover be told from the road beneath it.
  surfaceHeight(x, z, y) {
    const t = this.track;
    const b = t.bounds(x, z, y);
    if (Math.abs(b.lateral) <= b.limit + t.apronWidth) return t.sample(x, z, y).height;
    return this.height(x, z);
  }

  // How far a point is from the track, measured past the edge of the graded
  // apron. Negative on the apron and the road, positive on the ground outside
  // it. Cheap: one grid lookup. The flight world blends its own terrain into
  // this ground by it.
  outside(x, z) {
    return this._outside(this.track.nearestGroundIndex(x, z), x, z);
  }
}
