// ============================================================================
// Track
// ----------------------------------------------------------------------------
// Turns a track data file into everything the game needs: a resampled
// centerline, the ground query, track containment, checkpoints, sectors and a
// minimap path. All of it derives from the one spline, so nothing can ever
// disagree with anything else. The minimap cannot show a different shape from
// the road, and a checkpoint cannot sit off the tarmac.
//
// This class implements the SAME ground contract FlatGround did in milestone 1:
//
//   sample(x, z, y) -> { height, normal, surface, onTrack }
//
// and adds one more used for barrier containment:
//
//   bounds(x, z, y) -> { lateral, limit, inwardX, inwardZ, onTrack }
//
// `y` is optional and is the height of whatever is asking. It only matters
// where the track crosses over itself: there, two pieces of road share an x and
// a z, and without knowing how high the car is there is no telling whether it
// is on the bridge or on the road beneath it.
//
// Both are analytic and allocation free. They are called four times per car per
// 120 Hz step, so with a six car field that is nearly 3000 calls a second;
// raycasting a road mesh for this would not hold frame rate, and would only be
// as accurate as the triangles.
// ============================================================================

import * as THREE from 'three';
import { TRACK } from '../data/tuning.js';

const GRID_CELL = 24; // meters. Query checks the 3x3 cells around a point.
// How much a metre of height difference counts against a sample, in squared
// metres of horizontal distance per squared metre of height. At 16 a road eight
// metres overhead is as far away as one 32 m to the side, which no piece of the
// road you are actually on ever is; on an ordinary hill every sample nearby is
// at nearly the same height, so this changes nothing there.
const VERTICAL_WEIGHT = 16;
const GRID_STRIDE = 100003; // prime, keeps the (ix, iz) hash collision free in practice

// The road cross-section, as one function.
//
// The physics ground query and the road mesh BOTH go through this, so the
// surface the car drives on and the surface you can see are the same surface by
// construction. Two copies of this formula that drift apart is how a car ends
// up hovering a few centimeters over a curb.
//
//   lateral   signed offset from the centerline, positive to the track's LEFT
//   returns   world height of the driving surface at that offset
export function roadHeight(baseY, bank, half, lateral, groundLevel, curbWidth, curbHeight, apronWidth, barrierGap) {
  const abs = Math.abs(lateral);
  const curbEdge = half + curbWidth;
  // The runoff stays in the plane of the road all the way out to the barrier;
  // only past the wall does the ground grade away to the terrain. Grading from
  // the curb instead put the entire gravel trap on a 13 degree side slope, so
  // anything that ran wide slid down it and could not be driven back out.
  // A runoff you cannot recover from is a trap, not a runoff.
  const edge = curbEdge + barrierGap;
  let h = baseY + lateral * Math.tan(bank);
  if (abs > edge) {
    // Past the barrier the ground grades down to the surrounding terrain, so
    // an elevated track does not end in a cliff.
    const t = Math.min(1, (abs - edge) / apronWidth);
    const ease = t * t * (3 - 2 * t);
    h = h * (1 - ease) + groundLevel * ease;
  } else if (abs > half && abs <= curbEdge) {
    h += curbHeight; // the curb stands proud of the road
  }
  return h;
}

export class Track {
  constructor(data) {
    this.data = data;
    this.palette = data.palette;
    this.runoffSurface = data.runoffSurface || 'gravel';
    // Metres of runoff between the curb edge and the wall. The default is the
    // tuning value; a track may narrow it, because how much room there is to
    // make a mistake is part of a circuit's character rather than a global
    // constant. A desert course wants acres of gravel, a container port wants
    // a guardrail right there. Floored at 3 m: below that the wall catches a
    // car whose inside wheels are still on the curb, and then "off the track"
    // stops existing at all.
    this.barrierGap = Math.max(3, data.barrierGap ?? TRACK.barrierGap);
    // Width of the embankment graded down beyond the wall. A mountain pass with
    // switchbacks cannot hang 48 m of embankment off each leg: the legs are
    // closer than that, and the upper leg's embankment would roof over the
    // road below it. Floored so an elevated road never ends in a cliff edge.
    this.apronWidth = Math.max(6, data.apronWidth ?? TRACK.apronWidth);

    this._buildCenterline();
    this._buildGrid();
    this._buildCheckpoints();
    this._buildMinimap();

    // Reused outputs. Callers must not retain them.
    this._sampleOut = { height: 0, normal: { x: 0, y: 1, z: 0 }, surface: 'tarmac', onTrack: true };
    this._boundsOut = { lateral: 0, limit: 0, inwardX: 0, inwardZ: 0, onTrack: true };
  }

  // -------------------------------------------------------------------------
  _buildCenterline() {
    const cps = this.data.controlPoints;
    const n = cps.length;

    // Centripetal parameterisation, because uniform Catmull-Rom overshoots on
    // the tight hairpin and would push the centerline outside its own road.
    const curve = new THREE.CatmullRomCurve3(
      cps.map((p) => new THREE.Vector3(p.x, p.y, p.z)),
      true,
      'centripetal',
      0.5
    );
    this.curve = curve;

    // Dense pass first, so arc length is measured rather than assumed.
    const dense = Math.max(2000, n * 40);
    const dp = [];
    const du = [];
    const tmp = new THREE.Vector3();
    let length = 0;
    for (let i = 0; i <= dense; i++) {
      const u = i / dense;
      curve.getPoint(u, tmp);
      dp.push(tmp.clone());
      du.push(u);
      if (i > 0) length += dp[i].distanceTo(dp[i - 1]);
    }
    this.length = length;

    // Resample the dense polyline at a fixed arc length.
    const step = TRACK.resampleStep;
    const count = Math.max(16, Math.round(length / step));
    const ds = length / count; // exact, so cumulative distance is just i * ds
    this.count = count;
    this.ds = ds;

    this.px = new Float32Array(count);
    this.py = new Float32Array(count);
    this.pz = new Float32Array(count);
    this.tx = new Float32Array(count); // unit tangent, XZ only
    this.tz = new Float32Array(count);
    this.lx = new Float32Array(count); // unit lateral, points to the track's LEFT
    this.lz = new Float32Array(count);
    this.halfWidth = new Float32Array(count);
    this.banking = new Float32Array(count);
    this.surface = new Array(count);
    // 1 where the road is a bridge deck: elevated, with nothing under its edges
    // but air. The mesh builder gives it a deck and pillars instead of an
    // embankment, and the terrain ignores it.
    this.bridge = new Uint8Array(count);
    // Signed curvature, 1/meters. Positive curves toward the track's LEFT.
    // A property of the spline, so it lives with the spline: the racing line
    // and speed profile in milestone 6 read it rather than recomputing it.
    this.curvature = new Float32Array(count);

    let di = 0;
    let walked = 0;
    for (let i = 0; i < count; i++) {
      const target = i * ds;
      while (di < dense && walked + dp[di].distanceTo(dp[di + 1]) < target) {
        walked += dp[di].distanceTo(dp[di + 1]);
        di++;
      }
      const segLen = dp[di].distanceTo(dp[di + 1]) || 1e-6;
      const f = Math.min(1, Math.max(0, (target - walked) / segLen));
      this.px[i] = dp[di].x + (dp[di + 1].x - dp[di].x) * f;
      this.py[i] = dp[di].y + (dp[di + 1].y - dp[di].y) * f;
      this.pz[i] = dp[di].z + (dp[di + 1].z - dp[di].z) * f;

      // Per-sample attributes come from the control points either side of the
      // curve parameter this sample landed on.
      const u = du[di] + (du[di + 1] - du[di]) * f;
      const seg = u * n;
      const si = Math.min(n - 1, Math.floor(seg));
      const st = seg - si;
      const a = cps[si];
      const b = cps[(si + 1) % n];
      this.halfWidth[i] = (a.width + (b.width - a.width) * st) * 0.5;
      this.banking[i] = a.banking + (b.banking - a.banking) * st;
      // Surface is discrete: it applies from its control point up to the next.
      // Interpolating a material makes no sense, and a hard edge is what you
      // want anyway so a gravel sector starts somewhere you can see.
      this.surface[i] = a.surface || 'tarmac';
      this.bridge[i] = a.bridge ? 1 : 0;
    }

    // Tangents from the resampled ring, so they are consistent with the mesh.
    for (let i = 0; i < count; i++) {
      const j = (i + 1) % count;
      const k = (i - 1 + count) % count;
      let dx = this.px[j] - this.px[k];
      let dz = this.pz[j] - this.pz[k];
      const l = Math.hypot(dx, dz) || 1;
      dx /= l; dz /= l;
      this.tx[i] = dx;
      this.tz[i] = dz;
      // lateral = up x tangent, which points to the track's LEFT.
      this.lx[i] = dz;
      this.lz[i] = -dx;
    }

    // Curvature from the rate of change of heading with arc length.
    for (let i = 0; i < count; i++) {
      const j = (i + 1) % count;
      const k = (i - 1 + count) % count;
      const aj = Math.atan2(this.tx[j], this.tz[j]);
      const ak = Math.atan2(this.tx[k], this.tz[k]);
      let d = aj - ak;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      // Heading increases turning RIGHT, so negate to make positive mean left.
      this.curvature[i] = -d / (2 * this.ds);
    }
  }

  // -------------------------------------------------------------------------
  // Uniform grid over the centerline samples. Turns "which part of the track am
  // I near" into a couple of hash lookups instead of a scan over ~950 samples.
  _buildGrid() {
    this.grid = new Map();
    for (let i = 0; i < this.count; i++) {
      const key = this._cellKey(this.px[i], this.pz[i]);
      let cell = this.grid.get(key);
      if (!cell) { cell = []; this.grid.set(key, cell); }
      cell.push(i);
    }
  }

  _cellKey(x, z) {
    const ix = Math.floor(x / GRID_CELL);
    const iz = Math.floor(z / GRID_CELL);
    return ix * GRID_STRIDE + iz;
  }

  // Nearest centerline sample index to a world position. Deterministic: it is a
  // pure function of its arguments, with no cached "last index" that could make
  // two cars disagree or make a replay diverge.
  //
  // With `y`, height counts too, which is what tells a flyover from the road
  // under it. Without it, this is the plain horizontal nearest sample.
  nearestIndex(x, z, y) {
    return this._nearest(x, z, y, false);
  }

  // Nearest sample that is NOT a bridge deck. The ground belongs to the road
  // that is actually on it.
  nearestGroundIndex(x, z) {
    return this._nearest(x, z, undefined, true);
  }

  _nearest(x, z, y, groundOnly) {
    const ix = Math.floor(x / GRID_CELL);
    const iz = Math.floor(z / GRID_CELL);
    const useY = y !== undefined;
    let best = -1;
    let bestD = Infinity;
    for (let ax = -1; ax <= 1; ax++) {
      for (let az = -1; az <= 1; az++) {
        const cell = this.grid.get((ix + ax) * GRID_STRIDE + (iz + az));
        if (!cell) continue;
        for (let c = 0; c < cell.length; c++) {
          const i = cell[c];
          if (groundOnly && this.bridge[i]) continue;
          const dx = this.px[i] - x;
          const dz = this.pz[i] - z;
          let d = dx * dx + dz * dz;
          if (useY) {
            const dy = this.py[i] - y;
            d += dy * dy * VERTICAL_WEIGHT;
          }
          if (d < bestD) { bestD = d; best = i; }
        }
      }
    }
    if (best >= 0 && useY) {
      // The height term is there to pick the right ROAD where two cross. Once
      // it has, the right sample on that road is the one nearest in plan, and
      // the height term must not choose it: weighted by height, a point well
      // below the centreline -- a rear wheel on a 16% climb -- prefers
      // samples further up the hill, which are nearer its height, and the road
      // height that came back was the height a couple of metres uphill. That
      // propped every car's tail up on steep climbs and floated the rear
      // wheels off the road. Walking along the chosen road stays on it.
      const plan = (i) => {
        const dx = this.px[i] - x, dz = this.pz[i] - z;
        return dx * dx + dz * dz;
      };
      for (let k = 0; k < 16; k++) {
        const ahead = (best + 1) % this.count;
        const behind = (best - 1 + this.count) % this.count;
        const here = plan(best);
        if (plan(ahead) < here) best = ahead;
        else if (plan(behind) < here) best = behind;
        else break;
      }
    }
    if (best >= 0) return best;
    // Far from the track: coarse scan then refine. Only happens on a teleport,
    // never in normal driving, so the cost does not matter.
    let coarse = 0;
    bestD = Infinity;
    const stride = 8;
    for (let i = 0; i < this.count; i += stride) {
      if (groundOnly && this.bridge[i]) continue;
      const dx = this.px[i] - x, dz = this.pz[i] - z;
      const d = dx * dx + dz * dz;
      if (d < bestD) { bestD = d; coarse = i; }
    }
    bestD = Infinity;
    for (let o = -stride; o <= stride; o++) {
      const i = (coarse + o + this.count) % this.count;
      if (groundOnly && this.bridge[i]) continue;
      const dx = this.px[i] - x, dz = this.pz[i] - z;
      const d = dx * dx + dz * dz;
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  // Project a world position onto the centerline. Returns the sample index and
  // the fractional position along the segment leaving it, plus signed lateral
  // offset. Positive lateral is the track's LEFT.
  _project(x, z, out, y) {
    const i = this.nearestIndex(x, z, y);
    // Decide whether the point sits ahead of or behind sample i, and project
    // onto that segment so height varies smoothly instead of in ds-sized steps.
    const dx = x - this.px[i];
    const dz = z - this.pz[i];
    const along = dx * this.tx[i] + dz * this.tz[i];
    let i0 = i;
    let f = along / this.ds;
    if (f < 0) { i0 = (i - 1 + this.count) % this.count; f += 1; }
    f = Math.min(1, Math.max(0, f));
    const i1 = (i0 + 1) % this.count;

    const bx = this.px[i0] + (this.px[i1] - this.px[i0]) * f;
    const bz = this.pz[i0] + (this.pz[i1] - this.pz[i0]) * f;
    // Lateral basis at the projected point.
    let ax = this.lx[i0] + (this.lx[i1] - this.lx[i0]) * f;
    let az = this.lz[i0] + (this.lz[i1] - this.lz[i0]) * f;
    const al = Math.hypot(ax, az) || 1;
    ax /= al; az /= al;

    out.i0 = i0; out.i1 = i1; out.f = f;
    out.baseX = bx; out.baseZ = bz;
    out.latX = ax; out.latZ = az;
    out.lateral = (x - bx) * ax + (z - bz) * az;
    out.baseY = this.py[i0] + (this.py[i1] - this.py[i0]) * f;
    out.bank = this.banking[i0] + (this.banking[i1] - this.banking[i0]) * f;
    out.half = this.halfWidth[i0] + (this.halfWidth[i1] - this.halfWidth[i0]) * f;
    return out;
  }

  _proj = { i0: 0, i1: 0, f: 0, baseX: 0, baseZ: 0, baseY: 0, latX: 0, latZ: 0, lateral: 0, bank: 0, half: 0 };

  // --- the ground contract -------------------------------------------------
  sample(x, z, y) {
    const out = this._sampleOut;
    const p = this._project(x, z, this._proj, y);

    const tanBank = Math.tan(p.bank);
    const absLat = Math.abs(p.lateral);
    out.height = this.heightAt(p.baseY, p.bank, p.half, p.lateral);

    // Normal: the banked road plane, tilted by the local slope. Cheap and
    // exact enough, since the car only uses it for the contact frame.
    const slope = (this.py[p.i1] - this.py[p.i0]) / this.ds;
    const nx = -tanBank * p.latX - slope * this.tx[p.i0];
    const nz = -tanBank * p.latZ - slope * this.tz[p.i0];
    const nl = Math.hypot(nx, 1, nz) || 1;
    out.normal.x = nx / nl; out.normal.y = 1 / nl; out.normal.z = nz / nl;

    // Surface comes from the track data, never from a texture.
    out.surface = absLat <= p.half ? this.surface[p.i0] : this.runoffSurface;

    // Whether this exact point is on the racing surface. Curbs count as track,
    // as they do in motorsport, so clipping an apex is never an off. Lap
    // validation reads this per wheel, which is what "all four wheels off"
    // means -- testing the car's centre instead would call a two-wheels-out
    // moment an off and let a car with its nose on the grass through.
    out.onTrack = absLat <= p.half + TRACK.curbWidth;
    return out;
  }

  // Road surface height, shared with the mesh builder. See roadHeight above.
  //
  // The apron grades to the verge beside THIS piece of road, not to the lowest
  // point of the circuit. Grading to the lowest point is fine on a flat track
  // and absurd on a hill climb: it drops the ground fifty metres in the forty
  // eight the apron has to do it in, so the road ends up running along the top
  // of a wall.
  heightAt(baseY, bank, half, lateral) {
    return roadHeight(baseY, bank, half, lateral, baseY - TRACK.vergeDrop,
      TRACK.curbWidth, TRACK.curbHeight, this.apronWidth, this.barrierGap);
  }

  // Same thing addressed by sample index, which is what the mesh builder wants.
  heightAtSample(i, lateral) {
    return this.heightAt(this.py[i], this.banking[i], this.halfWidth[i], lateral);
  }

  // --- containment ---------------------------------------------------------
  // The barrier line: road, curb, a little flat, then the wall.
  barrierLimit(half) {
    return half + TRACK.curbWidth + this.barrierGap;
  }

  bounds(x, z, y) {
    const out = this._boundsOut;
    const p = this._project(x, z, this._proj, y);
    const limit = this.barrierLimit(p.half);
    out.lateral = p.lateral;
    out.limit = limit;
    // Inward is toward the centerline, so it flips with the side you are on.
    const sign = p.lateral >= 0 ? -1 : 1;
    out.inwardX = p.latX * sign;
    out.inwardZ = p.latZ * sign;
    out.onTrack = Math.abs(p.lateral) <= p.half;
    return out;
  }

  // -------------------------------------------------------------------------
  _buildCheckpoints() {
    // Checkpoint 0 IS the start/finish line. Everything downstream measures lap
    // progress from here, so the line is the origin of the lap rather than an
    // arbitrary point in the control point list.
    this.startSample = Math.round((this.data.startDistance || 0) / this.ds) % this.count;

    const target = TRACK.checkpointSpacing;
    const n = Math.max(6, Math.round(this.length / target));
    this.checkpoints = [];
    for (let k = 0; k < n; k++) {
      const prog = Math.round((k * this.count) / n);
      const i = (this.startSample + prog) % this.count;
      this.checkpoints.push({
        index: k,
        sample: i,
        prog, // samples travelled from the start line, so checkpoints sort by lap order
        x: this.px[i], y: this.py[i], z: this.pz[i],
        tx: this.tx[i], tz: this.tz[i],
        lx: this.lx[i], lz: this.lz[i],
        half: this.halfWidth[i],
        distance: prog * this.ds,
      });
    }
    // Sector boundaries snap to checkpoints, so a split is a discrete event on
    // an already validated gate rather than a separate distance test.
    this.sectors = [];
    for (let s = 0; s < TRACK.sectorCount; s++) {
      this.sectors.push(Math.round((s * n) / TRACK.sectorCount));
    }
  }

  _buildMinimap() {
    // Derived from the same samples as the road, so it can never disagree.
    const target = 160;
    const stride = Math.max(1, Math.floor(this.count / target));
    const path = [];
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < this.count; i += stride) {
      path.push(this.px[i], this.pz[i]);
      minX = Math.min(minX, this.px[i]); maxX = Math.max(maxX, this.px[i]);
      minZ = Math.min(minZ, this.pz[i]); maxZ = Math.max(maxZ, this.pz[i]);
    }
    this.minimap = { path, minX, maxX, minZ, maxZ };
  }

  // Lowest point on the track. The distant ground settles to this, once it is
  // far enough away to have stopped following the road.
  get groundLevel() {
    if (this._groundLevel === undefined) {
      let lo = Infinity;
      for (let i = 0; i < this.count; i++) lo = Math.min(lo, this.py[i]);
      this._groundLevel = lo - 1.2;
    }
    return this._groundLevel;
  }

  // Where the car starts, and where R puts it back. `back` moves it upstream
  // of the gate so it is not dropped exactly on the line.
  spawnAt(sampleIndex, back = 0, lateralOffset = 0) {
    const i = ((sampleIndex - Math.round(back / this.ds)) % this.count + this.count) % this.count;
    const yaw = Math.atan2(this.tx[i], this.tz[i]);
    return {
      x: this.px[i] + this.lx[i] * lateralOffset,
      y: this.py[i] + lateralOffset * Math.tan(this.banking[i]),
      z: this.pz[i] + this.lz[i] * lateralOffset,
      yaw,
    };
  }

  // On the grid, a little behind the line.
  spawn() {
    return this.spawnAt(this.startSample, 22);
  }

  // How far round the lap a world position is, in samples from the start line.
  progressAt(x, z, y) {
    return (this.nearestIndex(x, z, y) - this.startSample + this.count) % this.count;
  }

  // Last checkpoint at or behind a world position, for the R key. Compared in
  // lap progress, not raw sample index, so it behaves across the start line.
  lastCheckpointFor(x, z, y) {
    const prog = this.progressAt(x, z, y);
    let best = this.checkpoints[0];
    for (const cp of this.checkpoints) {
      if (cp.prog <= prog && cp.prog >= best.prog) best = cp;
    }
    return best;
  }
}
