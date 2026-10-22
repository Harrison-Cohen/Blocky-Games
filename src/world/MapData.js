// The map, headless: a picture of the world from its own data, and the places on it.
//
// The picture is made from the same Heightfield and Biomes the terrain chunks are, so
// it cannot show a coast where there is none. It is a raster of RGBA bytes, north at
// the top and east to the right (east is -x in this world), `n` cells a side over the
// whole map. The places are read from the world's registries: every airport the world
// has and every track area, so a track file added to the game appears on the map by
// itself.

import { MAP, OPEN_WORLD } from '../data/tuning.js';

const lin2srgb = (v) => Math.round(255 * Math.pow(Math.max(0, Math.min(1, v)), 1 / 2.2));
const hex = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];

export function createRaster(n = MAP.resolution, cfg = OPEN_WORLD) {
  return { n, size: cfg.size, cell: cfg.size / n, rgba: new Uint8ClampedArray(n * n * 4), row: 0 };
}

// World to the raster's own pixel coordinates (fractional), and back.
export const toPixel = (r, x, z, out) => { out.x = (r.size / 2 - x) / r.cell; out.y = (r.size / 2 - z) / r.cell; return out; };
export const toWorldXZ = (r, px, py, out) => { out.x = r.size / 2 - px * r.cell; out.z = r.size / 2 - py * r.cell; return out; };

// Paint rows until the raster is done or `budgetMs` has gone. Returns true when done.
export function renderRaster(world, r, budgetMs = Infinity) {
  const t0 = performance.now();
  const n = r.n, half = r.size / 2, cell = r.cell, bio = world.biomes;
  const rec = new Float64Array(15), w = new Float64Array(8);
  const shallow = hex(MAP.seaShallow), deep = hex(MAP.seaDeep), snow = hex(MAP.snow);
  while (r.row < n) {
    const j = r.row;
    const z = half - (j + 0.5) * cell;
    for (let i = 0; i < n; i++) {
      const x = half - (i + 0.5) * cell;
      const h = world.hf.height(x, z);
      let R, G, B;
      if (h <= 0) {
        const t = Math.min(1, -h / MAP.seaDepth);
        R = shallow[0] + (deep[0] - shallow[0]) * t; G = shallow[1] + (deep[1] - shallow[1]) * t; B = shallow[2] + (deep[2] - shallow[2]) * t;
      } else {
        // Light from the north-west: the slope toward it brightens, away darkens.
        const hw = world.hf.height(x + cell, z), hn = world.hf.height(x, z + cell);
        const he = world.hf.height(x - cell, z), hs = world.hf.height(x, z - cell);
        const dx = (he - hw) / (2 * cell), dz = (hn - hs) / (2 * cell);
        const ny = 1 / Math.sqrt(1 + dx * dx + dz * dz);
        const shade = 1 + MAP.shade * ((-dx * 0.5 + dz * 0.5) * 2.2);
        bio.cell(x, z, h, rec);
        let rr = rec[3], gg = rec[4], bb = rec[5];
        if (h < 4) { const s = 1 - h / 4; rr += (rec[12] - rr) * s; gg += (rec[13] - gg) * s; bb += (rec[14] - bb) * s; }
        const rock = ny < 0.8 ? Math.min(1, (0.8 - ny) / 0.15) : 0;
        if (rock > 0) { rr += (rec[9] - rr) * rock; gg += (rec[10] - gg) * rock; bb += (rec[11] - bb) * rock; }
        R = lin2srgb(rr); G = lin2srgb(gg); B = lin2srgb(bb);
        const sn = bio.snowAt(x, z, h);
        if (sn > 0.3) { const s = Math.min(1, (sn - 0.3) / 0.4); R += (snow[0] - R) * s; G += (snow[1] - G) * s; B += (snow[2] - B) * s; }
        const k = Math.max(0.55, Math.min(1.4, shade));
        R *= k; G *= k; B *= k;
      }
      const o = (j * n + i) * 4;
      r.rgba[o] = R; r.rgba[o + 1] = G; r.rgba[o + 2] = B; r.rgba[o + 3] = 255;
    }
    r.row++;
    if (performance.now() - t0 > budgetMs) break;
  }
  return r.row >= n;
}

// Every place that belongs on the map, from the registries: { kind, id, name, x, z,
// heading, tier, length, biome }. (An airport's x, z is the middle of its flat ground.)
export function mapMarkers(world) {
  const out = [];
  for (const a of world.airports.list) {
    // Airport local u=0 is the threshold, not the runway centre.
    const centre=a.toWorld(a.length/2,0,{});
    out.push({ kind: 'airport', id: a.id, name: a.name, x: centre.x, z: centre.z, heading: a.heading, tier: a.tier, length: a.length, pad: a.isHeliport });
  }
  for (const a of world.areas.list) {
    out.push({ kind: 'track', id: a.id, name: a.name, x: a.x, z: a.z, heading: a.heading, tier: 'track', biome: a.biome });
  }
  return out;
}
