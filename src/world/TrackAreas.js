// Track areas: the race tracks, placed in the world.
//
// Every track in the registry becomes an AREA. An area is a rigid frame: the
// track keeps its own local coordinates (so its physics, its AI and its mesh
// are bit-identical to the car game) and the frame carries it into the world
// with a position, a heading and a base height. Converting is a rotation and an
// offset, nothing more.
//
//   world = P + R(heading) * (local - centre)         (x and z)
//   worldY = localY - track.groundLevel + base
//
// An area is not a disc. A track is a ribbon a few hundred metres across and a
// couple of kilometres long, so its influence is a TUBE round the centreline,
// measured as how far a point is outside the track's graded apron:
//
//   out to areaInner   the ground is the track's own (TrackGround: the hills the
//                      car game shows), flat beside the road
//   then areaBlend     it blends into the world's terrain
//   biomeBand          colour, scenery and fog tint blend over this wider band
//
// Placement is deterministic from the seed and the track's id, so the same
// tracks are in the same places on every launch, and adding a track file adds an
// area without moving the others (each is tried at its own seeded places, in an
// order set by the seed, not by the registry).

import { Track } from '../game/Track.js';
import { TrackGround } from '../game/TrackGround.js';
import { OPEN_WORLD } from '../data/tuning.js';
import { hash2, smoothstep, clamp } from './Noise.js';
import { inferBiome, BIOME_INDEX } from './Biomes.js';

function strHash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export class Area {
  constructor(data, cfg) {
    this.cfg = cfg;
    this.data = data;
    this.id = data.id;
    this.name = data.name;
    this.palette = data.palette;
    this.hash = strHash(data.id);
    this.biome = inferBiome(data);
    this.biomeIndex = BIOME_INDEX[this.biome];
    this.track = new Track(data);
    this.ground = new TrackGround(this.track);

    const t = this.track, mm = t.minimap;
    this.cx = (mm.minX + mm.maxX) / 2;
    this.cz = (mm.minZ + mm.maxZ) / 2;
    // Plan radius of the graded apron's outer edge, from the centre.
    let r = 0, half = 0;
    for (let i = 0; i < t.count; i++) {
      r = Math.max(r, Math.hypot(t.px[i] - this.cx, t.pz[i] - this.cz));
      half = Math.max(half, t.halfWidth[i]);
    }
    this.radius = r + t.barrierLimit(half) + t.apronWidth;
    // How far from the centre anything about this area can reach.
    this.reach = this.radius + Math.max(cfg.areaInner + cfg.areaBlend, cfg.biomeBand) + 50;
    this.reach2 = this.reach * this.reach;

    this.placed = false;
    this.x = 0; this.z = 0; this.heading = 0; this.cos = 1; this.sin = 0;
    this.base = 0; this.dy = 0;
    this._l = { x: 0, z: 0 };
  }

  place(x, z, heading, base) {
    this.x = x; this.z = z; this.heading = heading;
    this.cos = Math.cos(heading); this.sin = Math.sin(heading);
    this.base = base;
    this.dy = base - this.track.groundLevel;
    this.placed = true;
    return this;
  }

  // World to the track's own coordinates. Writes into a reused object.
  toLocal(x, z, out = this._l) {
    const dx = x - this.x, dz = z - this.z;
    out.x = dx * this.cos - dz * this.sin + this.cx;
    out.z = dx * this.sin + dz * this.cos + this.cz;
    return out;
  }

  toWorld(lx, lz, out) {
    const dx = lx - this.cx, dz = lz - this.cz;
    out.x = this.x + dx * this.cos + dz * this.sin;
    out.z = this.z - dx * this.sin + dz * this.cos;
    return out;
  }

  // Where the frame's group goes: a Three.js Group with rotation.y = heading
  // and this position puts local coordinates where toWorld says.
  get wrapperX() { return this.x - this.cx * this.cos - this.cz * this.sin; }
  get wrapperZ() { return this.z + this.cx * this.sin - this.cz * this.cos; }
}

export class TrackAreas {
  // trackData: the track data files (the registry's list in the game, the files
  // in the folder in a check). hf: the Heightfield the areas are placed on.
  constructor(trackData, hf, cfg = OPEN_WORLD) {
    this.cfg = cfg;
    this.hf = hf;
    this.list = trackData.map((d) => new Area(d, cfg));
    this.byId = new Map(this.list.map((a) => [a.id, a]));
    this._probe = { area: null, outside: 0, weight: 0 };
    this._ho = { outside: 0 };
    this._place();
  }

  // --- placement ---------------------------------------------------------------------
  _place() {
    const c = this.cfg;
    // The order is the seed's, not the registry's: a track added later, or
    // named earlier, does not take a place an existing one had.
    const order = [...this.list].sort((a, b) => hash2(a.hash, 5, c.seed) - hash2(b.hash, 5, c.seed));
    const placed = [];
    for (const a of order) {
      const hint = a.data.world?.placement;
      let best = null;
      const s = (c.seed ^ a.hash) | 0;
      if (hint) {
        best = { x: hint.x, z: hint.z, heading: hint.heading ?? hash2(0, 37, s) * Math.PI * 2 };
      } else {
        const tries = (limit, needFit) => {
          for (let k = 0; k < limit; k++) {
            const x = (hash2(k, 11, s) - 0.5) * c.size * 0.84;
            const z = (hash2(k, 23, s) - 0.5) * c.size * 0.84;
            const d = Math.hypot(x - c.home.x, z - c.home.z);
            if (d < c.areaFromHome[0] || d > c.areaFromHome[1]) continue;
            if (!this._clear(a, x, z, placed)) continue;
            const score = needFit ? this._fit(a, x, z) : (this.hf.base(x, z) > 6 ? 0.01 : -1);
            if (score < 0) continue;
            if (!best || score > best.score) best = { x, z, score, heading: hash2(k, 37, s) * Math.PI * 2 };
            if (needFit && score > 0.92) break;
          }
        };
        tries(c.areaCandidates, true);
        // Nothing fit its biome well: any dry spot at all, rather than none.
        if (!best) tries(c.areaCandidates * 12, false);
      }
      if (!best) throw new Error(`no room in the world for the track area "${a.id}"`);
      a.fit = best.score ?? 1;
      a.place(best.x, best.z, best.heading, this._baseHeight(a, best.x, best.z));
      placed.push(a);
    }
  }

  // Clear of every area already placed and of the home field, edge to edge.
  _clear(a, x, z, placed) {
    const c = this.cfg;
    for (const o of placed) {
      if (Math.hypot(x - o.x, z - o.z) < a.reach + o.reach + c.areaMinSpacing) return false;
    }
    return true;
  }

  // The height the area stands at: the land's own, averaged over the middle of
  // it (a track must not be set on a single spike), and never below the beach.
  _baseHeight(a, x, z) {
    const hf = this.hf;
    let sum = hf.base(x, z);
    for (let k = 0; k < 8; k++) {
      const ang = (k / 8) * Math.PI * 2;
      sum += hf.base(x + Math.cos(ang) * 200, z + Math.sin(ang) * 200);
    }
    return Math.max(sum / 9, a.biome === 'coast' ? 5 : 12);
  }

  // How well a place suits an area's biome, 0 to 1, or -1 if it cannot be used
  // at all. Looks only at the world's own land (hf.base), so it does not depend
  // on which areas were placed first.
  _fit(a, x, z) {
    const hf = this.hf;
    const h0 = hf.base(x, z);
    if (h0 < 3) return -1;
    const R = a.radius + 300;
    let water = 0, total = 0, rough = 0, innerWater = 0;
    for (const f of [0.6, 1, 1.8, 2.8]) {
      for (let k = 0; k < 12; k++) {
        const ang = (k / 12) * Math.PI * 2;
        const h = hf.base(x + Math.cos(ang) * R * f, z + Math.sin(ang) * R * f);
        total++;
        if (h < 0) { water++; if (f <= 1) innerWater++; }
        rough = Math.max(rough, Math.abs(h - h0));
      }
    }
    if (innerWater) return -1;
    const wet = water / total;
    const near = (v, mid, span) => clamp(1 - Math.abs(v - mid) / span, 0, 1);
    switch (a.biome) {
      case 'coast': {
        // The coast it needs: land underfoot and the sea a little way off, about
        // a third of the way round it.
        if (h0 > 55 || wet < 0.08) return -1;
        return 0.7 * near(wet, 0.3, 0.3) + 0.3 * (1 - smoothstep(15, 55, h0));
      }
      case 'snow':
        if (wet > 0.1) return -1;
        return smoothstep(150, 1500, h0);
      case 'forest':
        if (wet > 0.1 || h0 > 900) return -1;
        return near(h0, 250, 500) * (1 - clamp(rough / 700, 0, 0.5));
      case 'desert':
        if (wet > 0.1 || h0 > 600) return -1;
        return near(h0, 120, 350) * (1 - clamp(rough / 500, 0, 0.5));
      case 'flats':
        if (wet > 0.1 || h0 > 300) return -1;
        return clamp(1 - rough / 80, 0, 1) * 0.9 + 0.05;
      case 'city':
        if (wet > 0.3 || h0 > 200) return -1;
        return clamp(1 - rough / 120, 0, 1) * 0.8 + 0.1 * (wet > 0 ? 1 : 0);
      default:
        if (wet > 0.1 || h0 > 700) return -1;
        return 0.4;
    }
  }

  // --- the world's questions ---------------------------------------------------------------
  // Blend the world's terrain `y` at (x, z) into each area's own ground that
  // reaches it. Called by the heightfield, so it is allocation free.
  blend(y, x, z) {
    const c = this.cfg, list = this.list;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      const dx = x - a.x, dz = z - a.z;
      if (dx * dx + dz * dz > a.reach2) continue;
      const l = a.toLocal(x, z);
      const g = a.ground.heightAndOutside(l.x, l.z, this._ho);
      const m = 1 - smoothstep(c.areaInner, c.areaInner + c.areaBlend, this._ho.outside);
      if (m > 0) y += (g + a.dy - y) * m;
    }
    return y;
  }

  // How far to lower the terrain mesh at (x, z) so a track's ribbon is never
  // buried by a coarse facet: `depth` metres on the track's own surface, fading
  // to nothing over the last four metres of its graded apron, where ribbon and
  // ground meet.
  sink(x, z, depth) {
    const list = this.list;
    let s = 0;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      const dx = x - a.x, dz = z - a.z;
      if (dx * dx + dz * dz > a.radius * a.radius) continue;
      const l = a.toLocal(x, z);
      const o = a.ground.outside(l.x, l.z);
      if (o >= 0) continue;
      const f = smoothstep(0, -4, o);
      if (f > s) s = f;
    }
    return s * depth;
  }

  // The strongest area biome at a point: out.area (or null), out.outside (metres
  // past the apron) and out.weight (1 on the track, fading to 0 over biomeBand).
  probe(x, z, out) {
    const band = this.cfg.biomeBand, list = this.list;
    let best = 0, area = null, outside = 0;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      const dx = x - a.x, dz = z - a.z;
      if (dx * dx + dz * dz > a.reach2) continue;
      const l = a.toLocal(x, z);
      const o = a.ground.outside(l.x, l.z);
      const w = o <= 0 ? 1 : 1 - smoothstep(0, band, o);
      if (w > best) { best = w; area = a; outside = o; }
    }
    out.area = area; out.outside = outside; out.weight = best;
    return out;
  }

  // The tube round a point: the area whose graded apron the point is inside
  // (outside <= 0), or null. For the ground contract and for keeping scenery off
  // a track.
  tubeAt(x, z) {
    const list = this.list;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      const dx = x - a.x, dz = z - a.z;
      if (dx * dx + dz * dz > a.reach2) continue;
      const l = a.toLocal(x, z);
      if (a.ground.outside(l.x, l.z) <= 0) return a;
    }
    return null;
  }

  // The ground contract inside a track's own surface: the road, curbs and
  // graded apron. Returns true and fills out ({ height, normal, surface }) when
  // (x, z, y) is on one; false when the point is on the world's terrain.
  surface(x, y, z, out) {
    const list = this.list;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      const dx = x - a.x, dz = z - a.z;
      if (dx * dx + dz * dz > a.radius * a.radius) continue;
      const l = a.toLocal(x, z);
      const t = a.track;
      const ly = y - a.dy;
      const b = t.bounds(l.x, l.z, ly);
      if (Math.abs(b.lateral) > b.limit + t.apronWidth) continue;
      const s = t.sample(l.x, l.z, ly);
      out.height = s.height + a.dy;
      // The track's normal, turned into the world's frame.
      out.normal.x = s.normal.x * a.cos + s.normal.z * a.sin;
      out.normal.y = s.normal.y;
      out.normal.z = -s.normal.x * a.sin + s.normal.z * a.cos;
      out.surface = s.surface;
      return true;
    }
    return false;
  }
}
