// Airports: where they are, what they are made of, and the ground they stand on.
// Headless: plain numbers, no Three.js, nothing allocated in the queries the
// physics and the terrain make a million times a second.
//
// An airport is a rigid frame, as a race track's area is. Its origin is the
// runway's threshold, `u` runs along the runway and `v` across it, positive to the
// LEFT of the direction of travel (src/data/airports.js says how a layout is
// written). Heading is the compass heading of the runway: 0 north (+z), east is -x.
//
//   world x = X + v cos(h) - u sin(h)
//   world z = Z + u cos(h) + v sin(h)
//
// What an airport does to the world:
//
//   a PLATFORM, a rectangle in its frame that the ground is made exactly flat on
//   (at the airport's base height), blending into the land over `blend` metres.
//   Runway, taxiways, apron and hangars all stand inside it, so the pavement is
//   coplanar with the ground under it, and a polygon offset on the pavement beats
//   it at any distance. The rectangle and the blend are the home runway of
//   milestone 2's, generalised (Chebyshev distance, so the major airport's land is
//   byte for byte what it was).
//   a SURFACE the wheels meet (runway, tarmac), answered by surfaceAt()
//   a CLEAR zone no scenery stands in (inClear()), and hangar ZONES (zoneAt())
//
// Placement is deterministic from the seed and each airport's id. Airports are
// placed from the seed alone (the ones with a hint where the hint says, the rest at
// the best of a few seeded places on flat land, apart from each other); the race
// track areas are placed after them and keep clear of them; and each track's
// airstrip is derived from its own area alone (addStrips). So adding a track moves
// no airport, no area and no other strip.

import { OPEN_WORLD } from '../data/tuning.js';
import { AIRPORTS, TIERS, stripFor } from '../data/airports.js';
import { hash2 } from './Noise.js';

const TAU = Math.PI * 2;

function strHash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const wrap = (a) => ((a % TAU) + TAU) % TAU;

// --- the layout of one airport, in its own frame -----------------------------------------
// From a tier's recipe: the pavement as rectangles that abut and never overlap (so
// two coplanar faces of different colour can never fight), the structures, the
// hangar zones, the parking stands and the platform. `over` may carry a runway
// override (a longer one); zone is the size of a hangar bay.
export function buildLayout(tierName, over = {}, zone = { w: 30, d: 34 }) {
  const r = TIERS[tierName];
  if (!r) throw new Error(`no such kind of airport: ${tierName}`);
  const rw = { ...r.runway, ...(over.runway || {}) };
  const L = rw.length, W = rw.width, f = (x) => x * L;
  const pave = [];
  pave.push({ kind: 'runway', u0: 0, u1: L, v0: -W / 2, v1: W / 2 });
  if (rw.blast) {
    pave.push({ kind: 'pad', u0: -rw.blast, u1: 0, v0: -W / 2, v1: W / 2 });
    pave.push({ kind: 'pad', u0: L, u1: L + rw.blast, v0: -W / 2, v1: W / 2 });
  }

  // The taxiways. A parallel one on the left with exits across the gap to the
  // runway, or a stub to the apron.
  const tx = r.taxiway;
  let apronV0;
  if (tx.kind === 'parallel') {
    const vA = tx.offset - tx.width / 2, vB = tx.offset + tx.width / 2;
    const exits = tx.exits.map(f);
    pave.push({ kind: 'taxi', u0: exits[0] - tx.exitWidth / 2, u1: exits[exits.length - 1] + tx.exitWidth / 2, v0: vA, v1: vB });
    for (const e of exits) pave.push({ kind: 'taxi', u0: e - tx.exitWidth / 2, u1: e + tx.exitWidth / 2, v0: W / 2, v1: vA });
    apronV0 = vB;
  } else {
    const e = f(tx.at);
    pave.push({ kind: 'taxi', u0: e - tx.width / 2, u1: e + tx.width / 2, v0: W / 2, v1: W / 2 + tx.gap });
    apronV0 = W / 2 + tx.gap;
  }
  const a = r.apron;
  const apron = { kind: 'apron', u0: f(a.from), u1: f(a.to), v0: apronV0, v1: apronV0 + a.depth };
  pave.push(apron);

  // The row along the back of the apron, and a marked bay in front of each hangar.
  const structures = [], zones = [];
  const backV0 = apron.v1 + 6;
  let backEdge = apron.v1;
  for (const b of r.back) {
    const s = { kind: b.kind, u: f(b.at), v: backV0 + b.d / 2, w: b.w, d: b.d, h: b.h, shelter: !!b.shelter, zone: -1 };
    if (b.zone) {
      const zd = Math.min(zone.d, a.depth - 2);
      s.zone = zones.length;
      zones.push({ u0: s.u - zone.w / 2, u1: s.u + zone.w / 2, v0: apron.v1 - zd, v1: apron.v1, structure: structures.length, airport: null, index: zones.length });
    }
    structures.push(s);
    backEdge = Math.max(backEdge, s.v + b.d / 2);
  }
  structures.push({ kind: 'sock', u: rw.pad ? -25 : L * 0.06, v: -(W / 2 + (rw.pad ? 30 : 45)), w: 1, d: 1, h: 9, shelter: false, zone: -1 });

  // Parking stands along the front of the apron, the first one straight across the
  // taxiway from the exit (or the stub) the aircraft would use, so "start on the apron"
  // is a straight run to the runway; the others spread either side of it. The nose
  // points across the taxiway (a right turn from the runway's heading).
  const stands = [];
  const n = r.stands, len = apron.u1 - apron.u0, sv = apron.v0 + Math.min(40, a.depth * 0.33);
  const mid = (apron.u0 + apron.u1) / 2;
  let first = tx.kind === 'parallel'
    ? tx.exits.map(f).reduce((best, e) => (Math.abs(e - mid) < Math.abs(best - mid) ? e : best))
    : f(tx.at);
  first = Math.min(apron.u1 - 14, Math.max(apron.u0 + 14, first));
  const pitch = Math.min(45, len / Math.max(1, n));
  for (let i = 0; i < n; i++) {
    const k = Math.ceil(i / 2) * (i % 2 === 1 ? 1 : -1);
    let u = first + k * pitch;
    if (u > apron.u1 - 14 || u < apron.u0 + 14) u = first - k * pitch;       // the other side, if it is off the apron
    if (u > apron.u1 - 14 || u < apron.u0 + 14) continue;
    stands.push({ u, v: sv, rel: Math.PI / 2 });
  }

  // The platform.
  const p = r.platform;
  const blast = rw.blast || 0;
  const platform = {
    u0: -(blast + p.end), u1: L + blast + p.end,
    v0: -(W / 2 + p.right), v1: p.leftTo ?? backEdge + p.left,
    blend: p.blend,
  };
  return {
    tier: tierName, length: L, width: W, surface: rw.surface, pad: !!rw.pad, blast,
    pave, apron, structures, zones, stands, platform,
    taxiway: tx, lights: r.lights, marks: r.marks, designators: [0, 0], relief: r.relief, range: r.range,
  };
}

const designator = (headingRad) => {
  const d = Math.round((wrap(headingRad) * 180) / Math.PI / 10) % 36;
  return d === 0 ? 36 : d;
};

export class Airport {
  constructor(data, k) {
    this.data = data;
    this.id = data.id;
    this.name = data.name;
    this.tier = data.tier;
    this.track = data.track || null;
    this.hash = strHash(data.id);
    this.layout = buildLayout(data.tier, { runway: data.runway }, k.zone);
    for (const z of this.layout.zones) z.airport = this;
    const pl = this.layout.platform;
    // The platform's centre and half sizes, in the frame, and how far from the
    // centre anything it does can reach (blend included, with its square corners).
    this.cu = (pl.u0 + pl.u1) / 2; this.cv = (pl.v0 + pl.v1) / 2;
    this.hu = (pl.u1 - pl.u0) / 2; this.hv = (pl.v1 - pl.v0) / 2;
    this.blend = pl.blend;
    this.reach = Math.hypot(this.hu + pl.blend, this.hv + pl.blend);
    this.radius = Math.hypot(this.hu, this.hv);
    this.placed = false;
    this.x = 0; this.z = 0; this.heading = 0; this.cos = 1; this.sin = 0; this.base = 0;
    this.px = 0; this.pz = 0;        // the platform's centre, in the world
    this._p = { x: 0, z: 0 };
  }

  get runway() { return this.layout; }
  get length() { return this.layout.length; }
  get isHeliport() { return this.layout.pad; }

  place(x, z, heading, base) {
    this.x = x; this.z = z; this.heading = wrap(heading);
    this.cos = Math.cos(this.heading); this.sin = Math.sin(this.heading);
    this.base = base;
    this.placed = true;
    const c = this.toWorld(this.cu, this.cv, this._p);
    this.px = c.x; this.pz = c.z;
    this.layout.designators = [designator(this.heading), designator(this.heading + Math.PI)];
    return this;
  }

  toWorld(u, v, out) {
    out.x = this.x + v * this.cos - u * this.sin;
    out.z = this.z + u * this.cos + v * this.sin;
    return out;
  }

  toLocal(x, z, out) {
    const dx = x - this.x, dz = z - this.z;
    out.u = dz * this.cos - dx * this.sin;
    out.v = dx * this.cos + dz * this.sin;
    return out;
  }

  // Where the frame's group goes in the renderer: a Group with rotation.y =
  // -heading holds the airport's geometry written as x = v, z = u.
  get rotationY() { return -this.heading; }
}

export class Airports {
  // data: the airport list (src/data/airports.js). hf: the Heightfield, used only
  // for its own land (base) while placing, so it does not matter which areas exist.
  constructor(data = AIRPORTS, hf, cfg = OPEN_WORLD) {
    this.cfg = cfg;
    this.k = cfg.airports;
    this.hf = hf;
    this.list = data.map((d) => new Airport(d, this.k));
    this.byId = new Map();
    this.center = { x: 0, z: 0 };
    this._u = { u: 0, v: 0 };
    this._w = { x: 0, z: 0 };
    this._place();
    this._finalize();
  }

  // --- placement ------------------------------------------------------------------------
  _place() {
    const c = this.cfg, k = this.k;
    const hinted = this.list.filter((a) => a.data.placement);
    for (const a of hinted) {
      const h = a.data.placement;
      const probe = this._probe(a, h.x, h.z, h.heading ?? 0, false);
      a.fit = 1;
      a.place(h.x, h.z, h.heading ?? 0, a.data.height ?? probe.mean);
    }
    const major = hinted.find((a) => a.tier === 'major');
    if (major) { this.center.x = major.x; this.center.z = major.z; }

    // The order is the seed's, not the list's: a line added to the data, or named
    // earlier, does not take a place another airport had.
    const order = this.list.filter((a) => !a.data.placement)
      .sort((a, b) => hash2(a.hash, 5, c.seed + k.seedSalt) - hash2(b.hash, 5, c.seed + k.seedSalt));
    for (const a of order) this._placeOne(a);
    for (const a of this.list) this.byId.set(a.id, a);
  }

  _placed() { return this.list.filter((a) => a.placed); }

  _placeOne(a) {
    const c = this.cfg, k = this.k;
    const s = (c.seed ^ a.hash ^ (k.seedSalt | 0)) | 0;
    const placed = this._placed();
    const [rmin, rmax] = a.layout.range;
    let best = null;
    const tryPlace = (limit, strict) => {
      for (let i = 0; i < limit; i++) {
        // The platform's centre, so the heading can be tried after.
        const xc = (hash2(i, 13, s) - 0.5) * c.size * 0.84;
        const zc = (hash2(i, 29, s) - 0.5) * c.size * 0.84;
        if (rmax > 0) {
          const d = Math.hypot(xc - this.center.x, zc - this.center.z);
          if (d < rmin || d > rmax) continue;
        }
        let ok = true;
        for (const o of placed) {
          if (Math.hypot(xc - o.px, zc - o.pz) < a.reach + o.reach + k.spacing) { ok = false; break; }
        }
        if (!ok) continue;
        // Land under and round it, before the dearer questions.
        if (this.hf.base(xc, zc) < k.minLand) continue;
        const R = a.radius + a.blend * 0.5;
        let wet = false;
        for (let q = 0; q < 8 && !wet; q++) {
          const ang = (q / 8) * TAU;
          if (this.hf.base(xc + Math.cos(ang) * R, zc + Math.sin(ang) * R) < k.ringLand) wet = true;
        }
        if (wet) continue;
        // Headings: evenly round the circle from a seeded start, on whole tens of
        // degrees so the runway's number is a round one.
        const start = hash2(i, 41, s) * (360 / k.headings);
        let top = null;
        for (let q = 0; q < k.headings; q++) {
          const deg = Math.round((start + (q * 360) / k.headings) / 10) * 10;
          const h = (deg * Math.PI) / 180;
          // The origin that puts the platform's centre at (xc, zc) at this heading.
          const cs = Math.cos(h), sn = Math.sin(h);
          const ox = xc - (a.cv * cs - a.cu * sn), oz = zc - (a.cu * cs + a.cv * sn);
          const p = this._probe(a, ox, oz, h, true);
          if (!p.ok) continue;
          if (!top || p.score > top.score) top = { ...p, ox, oz, h };
        }
        if (!top) continue;
        if (!best || top.score > best.score) best = top;
        if (top.score > 0.85) return;
      }
    };
    tryPlace(k.candidates, true);
    // Nothing fit well: any flat enough place at all, rather than none.
    if (!best) tryPlace(k.candidates * 6, false);
    if (!best) throw new Error(`no room in the world for the airport "${a.id}"`);
    a.fit = best.score;
    a.place(best.ox, best.oz, best.h, Math.round(best.mean * 100) / 100);
  }

  // How well an airport would sit at an origin and heading: the land under its
  // platform and the ring its blend reaches, the relief across it, and whether the
  // approach to each end is clear. All from the world's own land (hf.base), so it
  // does not depend on what has been placed. `full` false skips the verdict.
  // `soft` is for a strip beside a track, which takes the hills it is given: relief
  // up to four times the tier's and an approach that is not clear cost it (they are
  // returned, not ruled out). `sample` is the height read: the world's own land, or
  // for a strip the land as the track's area has shaped it.
  _probe(a, ox, oz, h, full, soft = false, sample = null) {
    const k = this.k, L = a.layout, pl = L.platform;
    const cs = Math.cos(h), sn = Math.sin(h);
    const read = sample || ((x, z) => this.hf.base(x, z));
    const at = (u, v) => read(ox + v * cs - u * sn, oz + u * cs + v * sn);
    let min = Infinity, max = -Infinity, sum = 0, n = 0;
    const NU = 9, NV = 5, cap = L.relief * (soft ? 4 : 1);
    for (let j = 0; j < NV; j++) {
      for (let i = 0; i < NU; i++) {
        const y = at(pl.u0 + ((pl.u1 - pl.u0) * i) / (NU - 1), pl.v0 + ((pl.v1 - pl.v0) * j) / (NV - 1));
        if (y < min) min = y;
        if (y > max) max = y;
        sum += y; n++;
        // Ruled out as soon as it is: most places are, and the rest is dear.
        if (full && (min < k.minLand || max - min > cap)) return { ok: false, why: min < k.minLand ? 'low' : 'relief' };
      }
    }
    const mean = sum / n;
    const out = { ok: true, score: 1, mean, relief: max - min, min, max, approach: 0 };
    if (!full) return out;
    if (min < k.minLand) { out.ok = false; out.why = 'low'; return out; }
    if (max - min > L.relief * (soft ? 4 : 1)) { out.ok = false; out.why = 'relief'; return out; }
    // The ring the blend reaches: land all round, and no great cliff in it.
    let rmin = Infinity, dev = 0;
    const b = pl.blend;
    const u0 = pl.u0 - b, u1 = pl.u1 + b, v0 = pl.v0 - b, v1 = pl.v1 + b;
    for (let q = 0; q < 24; q++) {
      const t = q / 24;
      let u, v;
      if (t < 0.25) { u = u0 + (u1 - u0) * (t / 0.25); v = v0; }
      else if (t < 0.5) { u = u1; v = v0 + (v1 - v0) * ((t - 0.25) / 0.25); }
      else if (t < 0.75) { u = u1 - (u1 - u0) * ((t - 0.5) / 0.25); v = v1; }
      else { u = u0; v = v1 - (v1 - v0) * ((t - 0.75) / 0.25); }
      const y = at(u, v);
      if (y < rmin) rmin = y;
      dev = Math.max(dev, Math.abs(y - mean));
    }
    if (rmin < k.ringLand) { out.ok = false; out.why = 'ring'; return out; }
    // The approach to each end: the land under the extended centre line stays under
    // a gentle slope up from the runway's end.
    for (const end of [0, 1]) {
      const endU = end ? L.length + L.blast : -L.blast, dir = end ? 1 : -1;
      for (let d = pl.blend + Math.abs(end ? pl.u1 - endU : pl.u0 - endU); d <= k.approachLength; d += k.approachStep) {
        const y = at(endU + dir * d, 0);
        if (y > mean + k.approachSlope * d + k.approachMargin) {
          if (!soft) { out.ok = false; out.why = 'approach'; return out; }
          out.approach++;
        }
      }
    }
    out.score = Math.max(0, 1 - 0.6 * Math.min(1, (max - min) / L.relief) - 0.4 * Math.min(1, dev / (L.relief * 5)));
    return out;
  }

  // --- a track's airstrip -----------------------------------------------------------------
  // One for every track area, from that area alone: parallel to the long side of the
  // track's bounding box (turned by the area's own heading), set beside it on the
  // better side, as near as the land allows with the strip's flat zone `stripGap`
  // metres clear of the track's graded apron. `areas` are the placed Areas.
  addStrips(areas) {
    for (const area of areas) {
      if (this.byId.has(`strip-${area.id}`)) continue;
      const a = new Airport(stripFor(area.data), this.k);
      this._placeStrip(a, area);
      this.list.push(a);
      this.byId.set(a.id, a);
    }
    this._finalize();
  }

  _placeStrip(a, area) {
    const k = this.k, mm = area.track.minimap;
    const alongX = mm.maxX - mm.minX >= mm.maxZ - mm.minZ;
    // The long axis in the world: the area's frame turns it.
    const p0 = area.toWorld(area.cx, area.cz, { x: 0, z: 0 });
    const p1 = area.toWorld(area.cx + (alongX ? 1 : 0), area.cz + (alongX ? 0 : 1), { x: 0, z: 0 });
    let dx = p1.x - p0.x, dz = p1.z - p0.z;
    const dl = Math.hypot(dx, dz); dx /= dl; dz /= dl;
    const heading = Math.atan2(-dx, dz);
    const cs = Math.cos(heading), sn = Math.sin(heading);
    // Left of the runway: (cos h, sin h).
    const lx = cs, lz = sn;
    const pl = a.layout.platform;
    const loc = { x: 0, z: 0 };
    let best = null;
    for (const side of [1, -1]) {
      for (const shift of [0, 500, -500, 1100, -1100]) {
        for (let t = 0; t <= area.radius * 2 + 6000; t += 100) {
          // The platform's centre, and the origin it puts the airport at.
          const xc = area.x + side * t * lx + shift * dx, zc = area.z + side * t * lz + shift * dz;
          const ox = xc - (a.cv * cs - a.cu * sn), oz = zc - (a.cu * cs + a.cv * sn);
          // The platform's edge, outside the track's graded apron by the gap.
          let clear = true;
          const edge = (u, v) => {
            const wx = ox + v * cs - u * sn, wz = oz + u * cs + v * sn;
            area.toLocal(wx, wz, loc);
            if (area.ground.outside(loc.x, loc.z) < k.stripGap) clear = false;
          };
          for (let q = 0; q <= 16 && clear; q++) {
            const u = pl.u0 + ((pl.u1 - pl.u0) * q) / 16, v = pl.v0 + ((pl.v1 - pl.v0) * q) / 16;
            edge(u, pl.v0); edge(u, pl.v1); edge(pl.u0, v); edge(pl.u1, v);
          }
          if (!clear) continue;
          const pr = this._probe(a, ox, oz, heading, true, true, (x, z) => this.hf.height(x, z));
          if (!pr.ok) continue;
          // As near as it can be, level, with a clear approach, in that order of
          // what a metre of each is worth.
          const cost = t + 0.5 * Math.abs(shift) + k.stripReliefCost * pr.relief + k.stripApproachCost * pr.approach;
          if (!best || cost < best.cost) best = { cost, ox, oz, mean: pr.mean, fit: pr.score };
          break;         // the nearest setback this side and shift can use
        }
      }
    }
    if (!best) throw new Error(`no room beside the track "${area.id}" for its airstrip`);
    a.fit = best.fit;
    a.place(best.ox, best.oz, heading, Math.round(best.mean * 100) / 100);
  }

  // --- the typed arrays the queries read -------------------------------------------------
  _finalize() {
    const n = this.list.length;
    this.n = n;
    this.pxs = new Float64Array(n); this.pzs = new Float64Array(n);
    this.cs = new Float64Array(n); this.sn = new Float64Array(n);
    this.hus = new Float64Array(n); this.hvs = new Float64Array(n);
    this.bs = new Float64Array(n); this.bl = new Float64Array(n);
    this.r2 = new Float64Array(n); this.p2 = new Float64Array(n);
    this.cus = new Float64Array(n); this.cvs = new Float64Array(n);
    const margin = this.k.propMargin;
    this.list.forEach((a, i) => {
      this.pxs[i] = a.px; this.pzs[i] = a.pz;
      this.cs[i] = a.cos; this.sn[i] = a.sin;
      this.hus[i] = a.hu; this.hvs[i] = a.hv;
      this.bs[i] = a.base; this.bl[i] = a.blend;
      this.r2[i] = a.reach * a.reach;
      const pr = Math.hypot(a.hu + margin, a.hv + margin);
      this.p2[i] = pr * pr;
      this.cus[i] = a.cu; this.cvs[i] = a.cv;
    });
    this.major = this.list.find((a) => a.tier === 'major') || this.list[0] || null;
  }

  // --- the world's questions ----------------------------------------------------------------
  // Flatten the land's height `y` at (x, z): on an airport's platform it is the
  // airport's base height, and round it the height blends into the land's own.
  // Called by the heightfield for every vertex of every chunk, so it is a loop with
  // a squared-distance reject and no allocation.
  flatten(y, x, z) {
    const n = this.n;
    for (let i = 0; i < n; i++) {
      const dx = x - this.pxs[i], dz = z - this.pzs[i];
      if (dx * dx + dz * dz > this.r2[i]) continue;
      const u = dz * this.cs[i] - dx * this.sn[i], v = dx * this.cs[i] + dz * this.sn[i];
      const ou = (u < 0 ? -u : u) - this.hus[i], ov = (v < 0 ? -v : v) - this.hvs[i];
      const d = ou > ov ? ou : ov;
      const b = this.bl[i];
      if (d >= b) continue;
      if (d <= 0) return this.bs[i];
      const t = d / b;
      y += (this.bs[i] - y) * (1 - t * t * (3 - 2 * t));
    }
    return y;
  }

  // How far (metres) a point is outside the airport's platform; negative inside it.
  _outside(i, x, z) {
    const dx = x - this.pxs[i], dz = z - this.pzs[i];
    const u = dz * this.cs[i] - dx * this.sn[i], v = dx * this.cs[i] + dz * this.sn[i];
    const ou = (u < 0 ? -u : u) - this.hus[i], ov = (v < 0 ? -v : v) - this.hvs[i];
    return ou > ov ? ou : ov;
  }

  // The airport whose platform a point is on, or null.
  at(x, z) {
    for (let i = 0; i < this.n; i++) {
      const dx = x - this.pxs[i], dz = z - this.pzs[i];
      if (dx * dx + dz * dz > this.p2[i]) continue;
      if (this._outside(i, x, z) <= 0) return this.list[i];
    }
    return null;
  }

  // Is this point in the ground kept clear of scenery: the platform and a margin?
  inClear(x, z) {
    const m = this.k.propMargin;
    for (let i = 0; i < this.n; i++) {
      const dx = x - this.pxs[i], dz = z - this.pzs[i];
      if (dx * dx + dz * dz > this.p2[i]) continue;
      if (this._outside(i, x, z) <= m) return true;
    }
    return false;
  }

  // The surface a wheel meets at (x, z) if it is on pavement: 'runway' (or the
  // runway's own surface), 'tarmac', else null.
  surfaceAt(x, z) {
    for (let i = 0; i < this.n; i++) {
      const dx = x - this.pxs[i], dz = z - this.pzs[i];
      if (dx * dx + dz * dz > this.p2[i]) continue;
      const u = dz * this.cs[i] - dx * this.sn[i] + this.cus[i];
      const v = dx * this.cs[i] + dz * this.sn[i] + this.cvs[i];
      const a = this.list[i], pave = a.layout.pave;
      for (let j = 0; j < pave.length; j++) {
        const p = pave[j];
        if (u >= p.u0 && u <= p.u1 && v >= p.v0 && v <= p.v1) return p.kind === 'runway' ? a.layout.surface : 'tarmac';
      }
    }
    return null;
  }

  // What a point is on, for the HUD: 'runway', 'taxi', 'apron' or 'pad', or null. (The
  // wheels ask surfaceAt: this is for a person.)
  kindAt(x, z) {
    for (let i = 0; i < this.n; i++) {
      const dx = x - this.pxs[i], dz = z - this.pzs[i];
      if (dx * dx + dz * dz > this.p2[i]) continue;
      const u = dz * this.cs[i] - dx * this.sn[i] + this.cus[i];
      const v = dx * this.cs[i] + dz * this.sn[i] + this.cvs[i];
      const pave = this.list[i].layout.pave;
      for (let j = 0; j < pave.length; j++) {
        const p = pave[j];
        if (u >= p.u0 && u <= p.u1 && v >= p.v0 && v <= p.v1) return p.kind;
      }
    }
    return null;
  }

  // The hangar zone (a marked bay in front of a hangar door) a point is in, or
  // null. The zone knows its airport.
  zoneAt(x, z) {
    for (let i = 0; i < this.n; i++) {
      const dx = x - this.pxs[i], dz = z - this.pzs[i];
      if (dx * dx + dz * dz > this.p2[i]) continue;
      const u = dz * this.cs[i] - dx * this.sn[i] + this.cus[i];
      const v = dx * this.cs[i] + dz * this.sn[i] + this.cvs[i];
      const zones = this.list[i].layout.zones;
      for (let j = 0; j < zones.length; j++) {
        const q = zones[j];
        if (u >= q.u0 && u <= q.u1 && v >= q.v0 && v <= q.v1) return q;
      }
    }
    return null;
  }

  // The nearest airport to a point (optionally one that passes `ok`), with its
  // distance: { airport, distance }, or null.
  nearest(x, z, ok = null) {
    let best = null, bd = Infinity;
    for (const a of this.list) {
      if (ok && !ok(a)) continue;
      const d = Math.hypot(x - a.px, z - a.pz);
      if (d < bd) { bd = d; best = a; }
    }
    return best ? { airport: best, distance: bd } : null;
  }

  // Where an aircraft is put at an airport: 'apron' (a parking stand, nose to the
  // taxiway), 'runway' (on the threshold, down the runway), 'air' (on the extended
  // centre line, high and level) or 'hangar' (the mouth of a hangar bay, facing the
  // door). Writes { x, y, z, heading, mode, airport }: y is the ground's height (the
  // caller puts the wheels on it), or that plus the height of an air start.
  start(ap, mode = 'apron', out = {}) {
    const k = this.k, L = ap.layout;
    let u, v, rel = 0, up = 0;
    if (mode === 'runway') { u = L.pad ? L.length / 2 : k.startOffset; v = 0; }
    else if (mode === 'air') { u = -k.airDistance; v = 0; up = k.airHeight; }
    else if (mode === 'hangar') {
      const z = L.zones[0];
      u = (z.u0 + z.u1) / 2; v = z.v0 - k.hangarMouth; rel = -Math.PI / 2;
    } else { const s = L.stands[0]; u = s.u; v = s.v; rel = s.rel; mode = 'apron'; }
    ap.toWorld(u, v, this._w);
    out.x = this._w.x; out.z = this._w.z;
    out.y = ap.base + up;
    out.heading = wrap(ap.heading + rel);
    out.mode = mode;
    out.airport = ap;
    return out;
  }
}
