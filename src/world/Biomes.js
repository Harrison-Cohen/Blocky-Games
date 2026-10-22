// Biomes: which one the ground is at a point, and what colour it is.
//
// The data (tones, props, snow lines) is src/data/biomes.js; this is the logic
// that blends them. Headless, no Three.js.
//
// weights(x, z, h) fills one weight per biome, summing to 1. The land's regional
// biome comes from two slow patterns (temperature and moisture) and from height
// (snow); a race track's area then pulls the weights toward its own biome over a
// transition band, which is what makes a desert track sit in a desert and fade
// into the grassland around it rather than stopping at a line.

import { OPEN_WORLD, WORLD } from '../data/tuning.js';
import { BIOMES, BIOME_IDS } from '../data/biomes.js';
import { fbm2, smoothstep } from './Noise.js';

export const BIOME_COUNT = BIOME_IDS.length;
export const BIOME_INDEX = Object.fromEntries(BIOME_IDS.map((id, i) => [id, i]));
const GRASS = BIOME_INDEX.grassland, DESERT = BIOME_INDEX.desert, FOREST = BIOME_INDEX.forest;
const SNOW = BIOME_INDEX.snow, FLATS = BIOME_INDEX.flats;

// sRGB (0-255) to linear (0-1), the space vertex colours are lit in.
const toLinear = (v) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};
export function hexToLinear(hex, out, o = 0) {
  out[o] = toLinear((hex >> 16) & 255);
  out[o + 1] = toLinear((hex >> 8) & 255);
  out[o + 2] = toLinear(hex & 255);
  return out;
}

function hsl(hex) {
  const r = ((hex >> 16) & 255) / 255, g = ((hex >> 8) & 255) / 255, b = (hex & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s, l };
}

// The biome a track belongs to. Its own `world.biome` when it names one;
// otherwise a guess from what the track already says about itself, so that
// dropping a new track file into src/data/tracks changes nothing else.
export function inferBiome(data) {
  const named = data.world?.biome;
  if (named && BIOME_INDEX[named] !== undefined) return named;
  const c = hsl(data.palette.ground);
  const amp = data.terrain?.amplitude ?? WORLD.terrainAmplitude;
  const bridge = data.controlPoints.some((p) => p.bridge);
  if (c.l > 0.8 && c.s < 0.3) return 'snow';
  if (bridge) return 'city';
  if (data.headlights && amp < 8) return 'coast';
  if (amp <= 0) return 'flats';
  if (c.h < 50 && c.s > 0.3) return 'desert';
  if (c.h >= 60 && c.h <= 170) return amp >= 25 ? 'forest' : 'grassland';
  return 'grassland';
}

export class Biomes {
  constructor(cfg = OPEN_WORLD, areas = null) {
    this.cfg = cfg;
    this.areas = areas;
    const n = BIOME_COUNT;
    this.tone = new Float64Array(n * 3 * 3);     // three facet tones a biome, linear
    this.rock = new Float64Array(n * 3);
    this.sand = new Float64Array(n * 3);
    this.fog = new Float64Array(n * 3);          // sRGB 0-1: the renderer sets fog from sRGB
    this.snowLine = new Float64Array(n);
    BIOME_IDS.forEach((id, i) => {
      const b = BIOMES[id];
      for (let k = 0; k < 3; k++) hexToLinear(b.ground[k % b.ground.length], this.tone, (i * 3 + k) * 3);
      hexToLinear(b.rock, this.rock, i * 3);
      hexToLinear(b.sand, this.sand, i * 3);
      this.fog[i * 3] = ((b.fog >> 16) & 255) / 255;
      this.fog[i * 3 + 1] = ((b.fog >> 8) & 255) / 255;
      this.fog[i * 3 + 2] = (b.fog & 255) / 255;
      this.snowLine[i] = b.snowLine;
    });
    this.water = hexToLinear(cfg.sea, new Float64Array(3));   // what the sea's own faces are painted
    this._w = new Float64Array(n);
    this._probe = { area: null, outside: 0, weight: 0 };
    this._pal = new Float64Array(3);
  }

  // Fills `out` (length BIOME_COUNT) with the biome weights at a point `h` metres
  // above the sea. Returns it.
  weights(x, z, h, out) {
    const c = this.cfg, b = c.biome, n = BIOME_COUNT;
    const T = fbm2(x / b.scale, z / b.scale, c.seed + 21, 3);
    const M = fbm2(x / b.scale + 63.1, z / b.scale - 12.7, c.seed + 22, 3);
    const e = b.edge;
    const desert = smoothstep(b.hot - e, b.hot + e, T) * (1 - smoothstep(b.wet - e, b.wet + e, M));
    const forest = smoothstep(b.wet - e, b.wet + e, M) * (1 - desert);
    const flats = (1 - smoothstep(b.dry - e, b.dry + e, M)) * (1 - desert) * (1 - forest);
    const grass = Math.max(0, 1 - desert - forest - flats);

    // Snow by height: the biome's own line, higher where it is warm.
    const line = grass * this.snowLine[GRASS] + desert * this.snowLine[DESERT] + forest * this.snowLine[FOREST]
      + flats * this.snowLine[FLATS] + (T - 0.5) * 2 * b.snowTemp;
    const snow = smoothstep(line, line + b.snowBand, h);
    for (let i = 0; i < n; i++) out[i] = 0;
    out[GRASS] = grass * (1 - snow);
    out[DESERT] = desert * (1 - snow);
    out[FOREST] = forest * (1 - snow);
    out[FLATS] = flats * (1 - snow);
    out[SNOW] = snow;

    // A track's area pulls toward its own biome.
    const areas = this.areas;
    if (areas) {
      const p = areas.probe(x, z, this._probe);
      if (p.area && p.weight > 0) {
        const k = p.weight;
        for (let i = 0; i < n; i++) out[i] *= 1 - k;
        out[p.area.biomeIndex] += k;
      }
    }
    return out;
  }

  // The horizon colour the fog leans toward here, sRGB 0-1, written to out[0..2].
  fogAt(x, z, h, out) {
    const w = this.weights(x, z, h, this._w);
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < BIOME_COUNT; i++) {
      const k = w[i];
      if (k < 0.004) continue;
      r += k * this.fog[i * 3]; g += k * this.fog[i * 3 + 1]; b += k * this.fog[i * 3 + 2];
    }
    out[0] = r; out[1] = g; out[2] = b;
    return out;
  }

  // The colours of one CELL of ground, which its two facets then share: three
  // facet tones, bare rock and sand, each the biome weights' blend, linear RGB,
  // written to rec (length 15). Weighing the biomes is the dear part of colouring
  // a chunk, so it is done once a cell, not once a facet.
  cell(x, z, h, rec) {
    const c = this.cfg;
    const w = this.weights(x, z, h, this._w);
    for (let i = 0; i < 15; i++) rec[i] = 0;
    for (let i = 0; i < BIOME_COUNT; i++) {
      const k = w[i];
      if (k < 0.004) continue;
      for (let t = 0; t < 9; t++) rec[t] += k * this.tone[i * 9 + t];
      for (let t = 0; t < 3; t++) { rec[9 + t] += k * this.rock[i * 3 + t]; rec[12 + t] += k * this.sand[i * 3 + t]; }
    }
    // A track's own palette, a little, over its area.
    const p = this._probe;
    if (p.area && p.weight > 0 && c.paletteMix > 0) {
      const m = p.weight * c.paletteMix;
      const pal = hexToLinear(p.area.palette.ground, this._pal);
      for (let t = 0; t < 9; t++) rec[t] += (pal[t % 3] - rec[t]) * m;
    }
    // Slow patches of lighter and darker ground.
    if (c.patch > 0) {
      const k = 1 + (fbm2(x / c.patchScale, z / c.patchScale, c.seed + 41, 2) - 0.5) * 2 * c.patch;
      for (let t = 0; t < 9; t++) rec[t] *= k;
    }
    return rec;
  }

  // One facet's colour from its cell's record: `h` metres above the sea, `ny` its
  // normal's y (1 is flat), and f1, f2 two numbers in [0, 1) that are the facet's
  // own (a hash of where it is) -- which of the three tones it takes, and how
  // much lighter or darker than its neighbours it is. Linear RGB to out[o..o+2].
  facet(rec, h, ny, f1, f2, out, o = 0) {
    const c = this.cfg;
    const t = Math.min(2, Math.floor(f1 * 3)) * 3;
    let r = rec[t], g = rec[t + 1], b = rec[t + 2];

    // Beach at the shore. (Below the sea there is no ground to colour: the
    // terrain mesh is cut at the waterline and the sea is its own faces.)
    if (h < c.beachHeight) {
      const sand = 1 - smoothstep(c.beachHeight * 0.5, c.beachHeight, h);
      r += (rec[12] - r) * sand; g += (rec[13] - g) * sand; b += (rec[14] - b) * sand;
    }

    // Bare rock where it is steep.
    const rock = smoothstep(c.rockSlope + 0.06, c.rockSlope - 0.12, ny);
    if (rock > 0) { r += (rec[9] - r) * rock; g += (rec[10] - g) * rock; b += (rec[11] - b) * rock; }

    const k = 1 + (f2 - 0.5) * 2 * c.faceJitter;
    out[o] = r * k; out[o + 1] = g * k; out[o + 2] = b * k;
  }

  // Snow underfoot, for the ground contract.
  snowAt(x, z, h) {
    return this.weights(x, z, h, this._w)[SNOW];
  }
}
