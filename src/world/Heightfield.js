// The height of the world at any point, as one function.
//
// This is the ONE height function: the terrain mesh is built from it and the
// aircraft's wheels are held up by it, so what you see and what you land on
// cannot disagree. It is pure numbers (no Three.js), deterministic from the
// seed, and allocation free.
//
//   base(x, z)    the world's own height: ocean, coast, plains, hills, mountain
//                 ranges, canyons. No airports, no race tracks.
//   height(x, z)  what is actually there: base, flattened under the home
//                 runway, and blended into each race track's own ground inside
//                 its area (see TrackAreas).
//
// Heights are metres above the sea, which is 0. Below it is sea floor; the sea
// itself is a separate flat surface (World.sample clamps to it).

import { OPEN_WORLD } from '../data/tuning.js';
import { fbm2, ridged2, smoothstep } from './Noise.js';

export class Heightfield {
  constructor(cfg = OPEN_WORLD) {
    this.cfg = cfg;
    this.half = cfg.size / 2;
    this.areas = null;       // set by World once the track areas are placed
    this._homeSetup();
  }

  _homeSetup() {
    const h = this.cfg.home;
    // The runway's frame: it runs from (x, z) along its heading. Heading 0 is
    // north (+z) and east is -x, as everywhere in flight.
    this.hx = h.x; this.hz = h.z;
    this.hSin = Math.sin(h.heading);
    this.hCos = Math.cos(h.heading);
  }

  // Where a world point sits in the runway's own frame: `along` its length from
  // the threshold, `across` it (positive to the left, +x for a northbound
  // runway).
  homeFrame(x, z, out) {
    const dx = x - this.hx, dz = z - this.hz;
    out.along = dz * this.hCos - dx * this.hSin;
    out.across = dx * this.hCos + dz * this.hSin;
    return out;
  }

  // The world's own height. No areas, no flat zones.
  base(x, z) {
    const c = this.cfg;

    // Land or sea: a slow fractal pattern through a threshold, with the edge of
    // the world sunk and the home field's surroundings lifted.
    let land = (fbm2(x / c.continentScale, z / c.continentScale, c.seed + 1, 3) - c.seaThreshold) * c.continentGain;
    const edge = Math.max(Math.abs(x), Math.abs(z));
    land -= c.rimStrength * smoothstep(this.half - c.rimWidth, this.half, edge);
    const dHome = Math.hypot(x - this.hx, z - this.hz);
    land += c.home.landBias * (1 - smoothstep(0, c.home.landRadius, dHome));

    if (land <= 0) return Math.max(land, -1) * c.seaDepth;

    // The ranges, hills and canyons are read through a warped copy of the
    // coordinates: a lattice of value noise otherwise leaves its square cells in
    // every crest, and a mountain seen from the air must not look gridded.
    const wx = x + (fbm2(x / c.warpScale, z / c.warpScale, c.seed + 8, 2) - 0.5) * 2 * c.warpAmount;
    const wz = z + (fbm2(x / c.warpScale + 41.3, z / c.warpScale - 17.9, c.seed + 9, 2) - 0.5) * 2 * c.warpAmount;

    // How far inland: nothing but the beach plain until the land is well clear
    // of the water, so the coast is a shelf and not a cliff.
    const inland = smoothstep(0.04, 0.45, land);
    let y = c.plainHeight * smoothstep(0, 0.35, land);

    // Mountain ranges where a broad pattern is high; ridged, so they have crests.
    const range = smoothstep(c.rangeThreshold, c.rangeThreshold + 0.2,
      fbm2(wx / c.rangeScale, wz / c.rangeScale, c.seed + 2, 2));
    if (range > 0) {
      const r = ridged2(wx / c.mountainScale, wz / c.mountainScale, c.seed + 3, 5);
      y += range * Math.pow(r, 1.6) * c.mountainHeight * inland;
    }

    // Hills, a little less of them on the plains the ranges leave between them,
    // and the finest break-up on top.
    const hills = (fbm2(wx / c.hillScale, wz / c.hillScale, c.seed + 4, 4) - 0.5) * 2;
    y += hills * c.hillHeight * inland * (1 - 0.5 * range);
    y += (fbm2(x / c.detailScale, z / c.detailScale, c.seed + 5, 3) - 0.5) * 2 * c.detailHeight * inland;

    // Canyons: a thin cut along the middle of a slow pattern, in some regions.
    const region = smoothstep(0.55, 0.7, fbm2(x / c.canyonRegionScale, z / c.canyonRegionScale, c.seed + 6, 2));
    if (region > 0) {
      const v = 1 - Math.abs(2 * fbm2(wx / c.canyonScale, wz / c.canyonScale, c.seed + 7, 3) - 1);
      y -= smoothstep(0.9, 0.995, v) * region * c.canyonDepth * inland;
    }
    // Land stays land: hills and canyons shape it but never drown it. (A lake
    // is a thing the map should choose to have, not a dip that went too far.)
    return Math.max(y, c.landFloor * smoothstep(0, 0.12, land));
  }

  _frame = { along: 0, across: 0 };

  // What is actually there.
  height(x, z) {
    let y = this.base(x, z);
    y = this._flatten(y, x, z);
    const areas = this.areas;
    if (areas) y = areas.blend(y, x, z);
    return y;
  }

  // The home field is a level rectangle with a soft edge.
  _flatten(y, x, z) {
    const h = this.cfg.home;
    const f = this.homeFrame(x, z, this._frame);
    // Distance outside the flat rectangle (negative inside it).
    const ox = Math.abs(f.across) - h.flatHalfWidth;
    const oz = f.along < 0 ? -f.along - h.flatMargin : f.along > h.length ? f.along - h.length - h.flatMargin : -1;
    const d = Math.max(ox, oz);
    if (d >= h.blend) return y;
    const m = 1 - smoothstep(0, h.blend, d);
    return y + (h.height - y) * m;
  }

  // Is this point in the ground kept clear of scenery round the runway: the
  // strip, a verge either side of it and a run-off past each end?
  inHomeClear(x, z) {
    const h = this.cfg.home;
    const f = this.homeFrame(x, z, this._frame);
    return Math.abs(f.across) <= h.width / 2 + h.clearSide && f.along >= -h.clearEnd && f.along <= h.length + h.clearEnd;
  }

  // Is this point on the runway's own strip?
  onRunway(x, z) {
    const h = this.cfg.home;
    const f = this.homeFrame(x, z, this._frame);
    return Math.abs(f.across) <= h.width / 2 && f.along >= 0 && f.along <= h.length;
  }
}
