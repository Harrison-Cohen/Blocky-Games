// The height of the world at any point, as one function.
//
// This is the ONE height function: the terrain mesh is built from it and the
// aircraft's wheels are held up by it, so what you see and what you land on
// cannot disagree. It is pure numbers (no Three.js), deterministic from the
// seed, and allocation free.
//
//   base(x, z)    the world's own height: ocean, coast, plains, hills, mountain
//                 ranges, canyons. No airports, no race tracks (a plain is
//                 lifted out of the sea where an airport asks for one).
//   height(x, z)  what is actually there: base, blended into each race track's
//                 own ground inside its area (see TrackAreas), and made flat
//                 under every airport (see Airports).
//
// Heights are metres above the sea, which is 0. Below it is sea floor; the sea
// itself is a separate flat surface (World.sample clamps to it).

import { OPEN_WORLD } from '../data/tuning.js';
import { LAND_LIFTS } from '../data/airports.js';
import { fbm2, ridged2, smoothstep } from './Noise.js';

export class Heightfield {
  // lifts: [{ x, z, radius, bias }], land raised round a place so an airport stands
  // on a plain and not in the sea (data: an airport's `land`).
  constructor(cfg = OPEN_WORLD, lifts = LAND_LIFTS) {
    this.cfg = cfg;
    this.half = cfg.size / 2;
    this.lifts = lifts;
    this.areas = null;       // set by World once the track areas are placed
    this.airports = null;    // and the airports
  }

  // The world's own height. No areas, no flat zones.
  base(x, z) {
    const c = this.cfg;

    // Land or sea: a slow fractal pattern through a threshold, with the edge of
    // the world sunk and the surroundings of an airport that asked for it lifted.
    let land = (fbm2(x / c.continentScale, z / c.continentScale, c.seed + 1, 3) - c.seaThreshold) * c.continentGain;
    const edge = Math.max(Math.abs(x), Math.abs(z));
    land -= c.rimStrength * smoothstep(this.half - c.rimWidth, this.half, edge);
    for (let i = 0; i < this.lifts.length; i++) {
      const l = this.lifts[i];
      land += l.bias * (1 - smoothstep(0, l.radius, Math.hypot(x - l.x, z - l.z)));
    }

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

  // What is actually there. The airports come last, so a platform is flat whatever
  // else reaches it.
  height(x, z) {
    let y = this.base(x, z);
    const areas = this.areas;
    if (areas) y = areas.blend(y, x, z);
    const airports = this.airports;
    if (airports) y = airports.flatten(y, x, z);
    return y;
  }
}
