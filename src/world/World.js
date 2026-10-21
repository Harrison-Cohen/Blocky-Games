// The world, headless: the terrain, the biomes, the airports, the race-track areas
// and the ground the aircraft meets.
//
// World.sample(x, z, y) is the ground contract the test field of milestone 1
// defined and the flight code already calls, unchanged:
//
//   sample(x, z, y) -> { height, normal: { x, y, z }, surface }
//
// analytic and allocation free (the result is one reused object, so a caller
// must read it before asking again). It is the same function the terrain mesh is
// built from. Over the sea the height is the sea's, 0, and the surface is water.
//
// Surfaces: runway (or the airport's own), tarmac (taxiways and aprons, and a race
// track's own), gravel, sand, rock, snow, grass, water.

import { OPEN_WORLD } from '../data/tuning.js';
import { AIRPORTS, landLifts } from '../data/airports.js';
import { Heightfield } from './Heightfield.js';
import { Airports } from './Airports.js';
import { TrackAreas } from './TrackAreas.js';
import { Biomes, BIOME_INDEX } from './Biomes.js';

export class World {
  // trackData: the track data files (the registry's list in the game).
  // airportData: the named airports (src/data/airports.js).
  constructor(trackData, cfg = OPEN_WORLD, airportData = AIRPORTS) {
    this.cfg = cfg;
    this.hf = new Heightfield(cfg, landLifts(airportData));
    // The airports are placed from the seed alone; the track areas then keep clear
    // of them; each track's airstrip comes from its own area. That order is what
    // lets a new track file add an area and a strip and move nothing.
    this.airports = new Airports(airportData, this.hf, cfg);
    this.areas = new TrackAreas(trackData, this.hf, cfg, this.airports);
    // A strip reads the land as its track's area shapes it, so the areas are set on
    // the heightfield first and the airports last.
    this.hf.areas = this.areas;
    this.airports.addStrips(this.areas.list);
    this.hf.airports = this.airports;
    this.biomes = new Biomes(cfg, this.areas);
    this._out = { height: 0, normal: { x: 0, y: 1, z: 0 }, surface: 'grass' };
    this._w = new Float64Array(Object.keys(BIOME_INDEX).length);
  }

  height(x, z) { return this.hf.height(x, z); }

  // Where the aircraft starts on a runway, heading along it: the major airport's,
  // or the airport you name. (The flight game asks airports.start for the other
  // starts.)
  spawn(airport = this.airports.major) {
    const p = this.airports.start(airport, 'runway', {});
    return { x: p.x, z: p.z, y: p.y, heading: p.heading };
  }

  sample(x, z, y) {
    const out = this._out;
    // A race track's own surface: the road, the curbs, the graded apron.
    if (this.areas.surface(x, y, z, out)) return out;

    const hf = this.hf;
    const h = hf.height(x, z);
    const n = out.normal;
    if (h <= 0) {
      out.height = 0; n.x = 0; n.y = 1; n.z = 0; out.surface = 'water';
      return out;
    }
    // The slope, from the height a few metres either side.
    const e = 2.5;
    const gx = (hf.height(x + e, z) - hf.height(x - e, z)) / (2 * e);
    const gz = (hf.height(x, z + e) - hf.height(x, z - e)) / (2 * e);
    const inv = 1 / Math.sqrt(gx * gx + 1 + gz * gz);
    n.x = -gx * inv; n.y = inv; n.z = -gz * inv;
    out.height = h;

    const c = this.cfg;
    const paved = this.airports.surfaceAt(x, z);
    if (paved) out.surface = paved;
    else if (h < c.beachHeight) out.surface = 'sand';
    else if (n.y < c.rockSlope) out.surface = 'rock';
    else {
      const w = this.biomes.weights(x, z, h, this._w);
      if (w[BIOME_INDEX.snow] > 0.5) out.surface = 'snow';
      else if (w[BIOME_INDEX.desert] + w[BIOME_INDEX.flats] > 0.5) out.surface = 'sand';
      else out.surface = 'grass';
    }
    return out;
  }

  // Height above the ground, for the near plane and the HUD: the aircraft's
  // altitude less whatever is under it (the sea counts as ground).
  agl(x, y, z) {
    return y - Math.max(0, this.hf.height(x, z));
  }
}
