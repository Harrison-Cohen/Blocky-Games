// ============================================================================
// RacingLine
// ----------------------------------------------------------------------------
// The line the AI aims at, built once per track from the same spline the
// physics reads. It is stored as a lateral OFFSET per centerline sample, so it
// shares the track's indexing and its spatial grid: finding the nearest point
// on the racing line is finding the nearest point on the track, which the
// physics already does for free.
//
// How it is built:
//
//   Start on the centerline and repeatedly step every point downhill on the
//   total squared curvature of the whole loop, keeping it on its own
//   cross-section and inside the usable width.
//
// The objective matters more than the method. Minimising LENGTH is the obvious
// thing and it is wrong: the shortest way through a corner hugs the inside edge
// for the entire corner, which makes the line TIGHTER than the centerline it
// came from -- measured, 8.6 m of radius where the road had 14. That is the
// slowest way round, not the fastest. Minimising curvature instead gives the
// line one apex, and it has to run wide before and after to get it, which is
// the geometric line: outside, inside, outside, without any of those three
// ever being written down.
//
// The gradient of the squared second difference is the fourth difference, which
// is why this smooths against four neighbours and not two.
//
// Deriving the line rather than placing apexes by hand matters because a line
// assembled from hand-placed apexes has to be re-tuned every time a track
// changes width, and there are three tracks whose widths change constantly.
//
// There is deliberately no late-apex bias on top of this. One was written --
// push out where the corner is still tightening, pull in where it opens up --
// and it was measurably worse: it drives off the rate of change of curvature,
// which on a resampled spline is mostly noise, and the kinks it left cost 46
// seconds a lap on Pine Ridge. The minimum-curvature line already apexes where
// a driver would; it does not need help.
//
// The whole thing is deterministic and runs once at track load.
// ============================================================================

import { AI } from '../data/tuning.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export class RacingLine {
  constructor(track) {
    this.track = track;
    const n = track.count;
    this.count = n;

    this.offset = new Float32Array(n);    // lateral from the centerline, + is track LEFT
    this.limit = new Float32Array(n);     // how far out the line is allowed to go
    this.x = new Float32Array(n);
    this.y = new Float32Array(n);
    this.z = new Float32Array(n);
    this.curvature = new Float32Array(n); // signed, 1/m, + curves left
    this.ds = new Float32Array(n);        // arc length from i to i+1 ALONG THE LINE
    this.s = new Float32Array(n);         // cumulative arc length from sample 0

    for (let i = 0; i < n; i++) {
      // Room for half a car plus a margin, measured from the road edge. The
      // line may use the full width of the tarmac and no more: a line that
      // runs on the curb looks right and puts two wheels on a surface the lap
      // validator is entitled to call an off.
      this.limit[i] = Math.max(0, track.halfWidth[i] - AI.lineMargin);
    }

    this._solve();
    this._measure();
  }

  // Gradient descent on total squared curvature, inside the corridor.
  //
  // Solved coarse first, then refined. The fourth-difference operator diffuses
  // information along the loop about as slowly as anything in numerical
  // analysis does -- at full resolution the line was still sitting within three
  // centimetres of the centerline after twelve hundred passes, which is to say
  // it had not started. Halving the number of unknowns speeds that up by
  // roughly sixteen times, so the line is solved on every sixteenth sample,
  // interpolated onto every eighth, solved again, and so on down to every one.
  // The coarse levels place the apexes and the fine levels tidy them up.
  _solve() {
    for (let k = 0; k < AI.lineLevels.length; k++) {
      const stride = AI.lineLevels[k];
      this._descend(stride, AI.linePasses[k], AI.lineRelax);
      if (stride > 1) this._interpolate(stride);
    }
  }

  // One level. Gauss-Seidel -- each sample is updated in place and its
  // neighbours see the new value immediately -- because that propagates a
  // change around the lap in a fraction of the passes a double-buffered sweep
  // needs. The operator's eigenvalues do not depend on the stride, so one
  // descent rate is stable at every level.
  _descend(stride, passes, rate) {
    const t = this.track;
    const n = this.count;
    const o = this.offset;
    const m = Math.max(8, Math.floor(n / stride));
    // Evenly spread rather than k*stride, so the last gap at the wrap is the
    // same size as all the others.
    const at = (k) => Math.round(((k % m) + m) % m * n / m) % n;
    const px = (i) => t.px[i] + t.lx[i] * o[i];
    const pz = (i) => t.pz[i] + t.lz[i] * o[i];

    for (let pass = 0; pass < passes; pass++) {
      for (let k = 0; k < m; k++) {
        const i = at(k);
        const a2 = at(k - 2), a1 = at(k - 1), b1 = at(k + 1), b2 = at(k + 2);
        // -(fourth difference): downhill on the sum of squared second
        // differences, which is the discrete bending energy of the loop.
        const gx = 4 * (px(a1) + px(b1)) - (px(a2) + px(b2)) - 6 * px(i);
        const gz = 4 * (pz(a1) + pz(b1)) - (pz(a2) + pz(b2)) - 6 * pz(i);
        // Only the part of that step lying along this sample's own lateral is
        // available: the line is parameterised by the track's cross-sections
        // and cannot move along them.
        const along = gx * t.lx[i] + gz * t.lz[i];
        o[i] = clamp(o[i] + along * rate, -this.limit[i], this.limit[i]);
      }
    }
  }

  // Carry a coarse solution onto every sample, so the next level starts from it
  // rather than from the centerline.
  _interpolate(stride) {
    const n = this.count;
    const o = this.offset;
    const m = Math.max(8, Math.floor(n / stride));
    const at = (k) => Math.round(((k % m) + m) % m * n / m) % n;
    for (let k = 0; k < m; k++) {
      const i = at(k), j = at(k + 1);
      const span = ((j - i) % n + n) % n;
      for (let d = 1; d < span; d++) {
        const idx = (i + d) % n;
        const f = d / span;
        const v = o[i] + (o[j] - o[i]) * f;
        o[idx] = clamp(v, -this.limit[idx], this.limit[idx]);
      }
    }
  }

  _measure() {
    const t = this.track;
    const n = this.count;
    for (let i = 0; i < n; i++) {
      this.x[i] = t.px[i] + t.lx[i] * this.offset[i];
      this.z[i] = t.pz[i] + t.lz[i] * this.offset[i];
      // Height ON the racing line, not on the centerline: the speed profile
      // reads gradients off this, and on Pine Ridge the two differ by metres.
      this.y[i] = t.heightAtSample(i, this.offset[i]);
    }

    let total = 0;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      this.ds[i] = Math.hypot(this.x[j] - this.x[i], this.z[j] - this.z[i]);
      this.s[i] = total;
      total += this.ds[i];
    }
    this.length = total;

    // Curvature from the rate of change of heading with arc length, the same
    // way Track measures its own, so the two are directly comparable.
    for (let i = 0; i < n; i++) {
      const a = (i - 1 + n) % n;
      const b = (i + 1) % n;
      const h1 = Math.atan2(this.x[i] - this.x[a], this.z[i] - this.z[a]);
      const h2 = Math.atan2(this.x[b] - this.x[i], this.z[b] - this.z[i]);
      let d = h2 - h1;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      const span = (this.ds[a] + this.ds[i]) * 0.5;
      // Heading increases turning RIGHT, so negate to make positive mean left.
      this.curvature[i] = span > 1e-6 ? -d / span : 0;
    }
  }

  // Unit tangent of the line at sample i, in XZ.
  tangent(i, out) {
    const b = (i + 1) % this.count;
    let dx = this.x[b] - this.x[i];
    let dz = this.z[b] - this.z[i];
    const l = Math.hypot(dx, dz) || 1;
    out.x = dx / l;
    out.z = dz / l;
    return out;
  }

  // The point `distance` metres further along the line from sample i.
  // Walks the samples rather than indexing by arc length, because ds varies
  // with how far the line is from the centerline and a uniform-spacing
  // assumption drifts by metres over a lap.
  ahead(i, distance, out) {
    const n = this.count;
    let k = i;
    let left = distance;
    for (let step = 0; step < n; step++) {
      const d = this.ds[k];
      if (left <= d || d <= 1e-6) {
        const f = d > 1e-6 ? left / d : 0;
        const j = (k + 1) % n;
        out.x = this.x[k] + (this.x[j] - this.x[k]) * f;
        out.z = this.z[k] + (this.z[j] - this.z[k]) * f;
        out.index = k;
        return out;
      }
      left -= d;
      k = (k + 1) % n;
    }
    out.x = this.x[i];
    out.z = this.z[i];
    out.index = i;
    return out;
  }
}
