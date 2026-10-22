// Scenery for the open world: which props there are, what they are made of, and
// where they stand in a chunk. Headless: it returns typed arrays; the renderer
// (src/render/WorldMesh.js) turns them into instanced meshes.
//
// The props themselves are DATA (src/data/biomes.js): boxes with colours, in the
// same vocabulary as a race track's scenery. Each prop is baked into ONE
// geometry with a colour per vertex, and a chunk draws each kind it has in a
// single instanced call, so a forest costs a draw call or two however many trees
// it has.
//
// Placement is a lattice, thinned. Each kind owns a lattice of `cell` metres in
// WORLD coordinates (not the chunk's), and a lattice cell holds at most one
// prop, jittered inside the cell. Whether a cell has one is a hash of the cell
// and the kind alone, compared with the kind's density, the chunk's level and
// the biome's weight there -- so the same trees stand in the same places however
// the chunks are cut, and a coarser chunk simply shows fewer of them.

import { BIOMES, BIOME_IDS } from '../data/biomes.js';
import { hash2, hash2b } from './Noise.js';
import { hexToLinear, BIOME_INDEX } from './Biomes.js';

function strHash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
const roll = (v, rand, dflt = 0) => (v === undefined ? dflt : Array.isArray(v) ? v[0] + rand() * (v[1] - v[0]) : v);

// The six faces of a box, each as its outward normal and four corners that run
// counter-clockwise seen from outside.
const FACES = [
  [[1, 0, 0], [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]]],
  [[-1, 0, 0], [[-1, -1, 1], [-1, 1, 1], [-1, 1, -1], [-1, -1, -1]]],
  [[0, 1, 0], [[-1, 1, -1], [-1, 1, 1], [1, 1, 1], [1, 1, -1]]],
  [[0, -1, 0], [[-1, -1, 1], [-1, -1, -1], [1, -1, -1], [1, -1, 1]]],
  [[0, 0, 1], [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]]],
  [[0, 0, -1], [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]]],
];

export function addBox(out, cx, cy, cz, w, h, d, rgb) {
  for (const [n, c] of FACES) {
    for (const k of [0, 1, 2, 0, 2, 3]) {
      out.pos.push(cx + c[k][0] * w / 2, cy + c[k][1] * h / 2, cz + c[k][2] * d / 2);
      out.nor.push(n[0], n[1], n[2]);
      out.col.push(rgb[0], rgb[1], rgb[2]);
    }
  }
}

// One prop's parts, rolled and baked: { pos, nor, col } as Float32Arrays, the
// base of the prop at y = 0.
function bake(prop) {
  const rand = rng(strHash(prop.id));
  const out = { pos: [], nor: [], col: [] };
  const rgb = [0, 0, 0];
  for (const part of prop.parts) {
    hexToLinear(part.color, rgb);
    const copies = Math.max(1, Math.round(roll(part.repeat, rand, 1)));
    let w = roll(part.w, rand, 1);
    let d = part.d === undefined ? w : roll(part.d, rand, 1);
    let h = roll(part.h, rand, 1);
    let y = roll(part.y, rand, 0);
    const x0 = roll(part.x, rand, 0), z0 = roll(part.z, rand, 0);
    for (let k = 0; k < copies; k++) {
      addBox(out, x0, y + h / 2, z0, Math.abs(w), Math.abs(h), Math.abs(d), rgb);
      y += h + roll(part.rise, rand, 0);
      const shrink = roll(part.shrink, rand, 1);
      w *= shrink; d *= shrink;
      h *= roll(part.taper, rand, 1);
    }
  }
  return { pos: new Float32Array(out.pos), nor: new Float32Array(out.nor), col: new Float32Array(out.col) };
}

// Every kind of prop of every biome, flat, each with its biome's index, its seed
// and its baked geometry.
export const KINDS = [];
for (const id of BIOME_IDS) {
  for (const p of BIOMES[id].props) {
    KINDS.push({ ...p, key: `${id}/${p.id}`, biome: id, biomeIndex: BIOME_INDEX[id], seed: strHash(`${id}/${p.id}`) & 0x7fffffff, geometry: bake(p) });
  }
}

const _probe = { area: null, outside: 0, weight: 0 };
const _w = new Float64Array(BIOME_IDS.length);
const _presence = new Float64Array(BIOME_IDS.length);

// The props standing in a chunk: [{ kind, count, matrices }] where `kind` is an
// index into KINDS and matrices is `count` column-major 4x4s, in the chunk's own
// coordinates (relative to its south-west corner). `scale` thins everything,
// for the render distance setting; `densify` (1 or more) makes the lattice they
// stand on finer, so there are that many times as many, for the detail setting
// (1 is the lattice the world has always had, and the same props).
export function buildProps(world, chunk, scale = 1, densify = 1) {
  const c = world.cfg;
  const level = chunk.level;
  if (level >= c.propLevels) return [];
  const density = (c.propDensity[level] ?? 0) * scale;
  if (density <= 0) return [];
  const { x0, z0, size } = chunk;
  const biomes = world.biomes, areas = world.areas, hf = world.hf;

  // Which biomes are here at all, by the strongest weight over the chunk: a
  // chunk of desert does not go looking for pines.
  _presence.fill(0);
  for (const fz of [0.05, 0.5, 0.95]) {
    for (const fx of [0.05, 0.5, 0.95]) {
      const x = x0 + fx * size, z = z0 + fz * size;
      const w = biomes.weights(x, z, Math.max(0, hf.height(x, z)), _w);
      for (let i = 0; i < w.length; i++) if (w[i] > _presence[i]) _presence[i] = w[i];
    }
  }

  const out = [];
  for (let ki = 0; ki < KINDS.length; ki++) {
    const kind = KINDS[ki];
    if (_presence[kind.biomeIndex] < 0.02) continue;
    const cell = (kind.cell ?? c.propCell) / Math.sqrt(densify);
    const want = density * kind.density;
    const i0 = Math.floor(x0 / cell), i1 = Math.floor((x0 + size) / cell);
    const j0 = Math.floor(z0 / cell), j1 = Math.floor((z0 + size) / cell);
    let mats = null, n = 0;
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const rank = hash2(i, j, kind.seed);
        if (rank >= want) continue;
        // Inside its cell, so two neighbours cannot touch.
        const jx = 0.15 + 0.7 * hash2b(i, j, kind.seed);
        const jz = 0.15 + 0.7 * hash2(i + 91, j - 37, kind.seed);
        const x = (i + jx) * cell, z = (j + jz) * cell;
        if (x < x0 || x >= x0 + size || z < z0 || z >= z0 + size) continue;

        // Not on an airport's flat ground or its margin.
        if (world.airports.inClear(x, z)) continue;

        // Not on a race track or hard up against one: the track brings its own.
        const p = areas.probe(x, z, _probe);
        if (p.area && p.outside < c.propClear) continue;

        const h = hf.height(x, z);
        if (h < (kind.minH ?? 0.8) || h > (kind.maxH ?? 1e9)) continue;
        // Weighted by how much of this biome is here.
        const w = biomes.weights(x, z, h, _w)[kind.biomeIndex];
        if (rank >= want * w) continue;
        // Level ground only.
        const e = 3;
        const gx = (hf.height(x + e, z) - hf.height(x - e, z)) / (2 * e);
        const gz = (hf.height(x, z + e) - hf.height(x, z - e)) / (2 * e);
        if (1 / Math.sqrt(gx * gx + 1 + gz * gz) < (kind.minNy ?? 0.8)) continue;

        if (!mats) mats = new Float32Array(Math.max(16, Math.ceil(size / cell + 2) ** 2 * 16));
        if (n * 16 + 16 > mats.length) { const m2 = new Float32Array(mats.length * 2); m2.set(mats); mats = m2; }
        const ang = hash2(i - 5, j + 61, kind.seed) * Math.PI * 2;
        const cs = Math.cos(ang), sn = Math.sin(ang);
        let sx, sy, sz;
        if (kind.stretch) {
          const t = (k) => kind.stretch[k][0] + (kind.stretch[k][1] - kind.stretch[k][0]) * hash2(i + k * 13, j - k * 7, kind.seed + 3);
          sx = t(0); sy = t(1); sz = t(2);
        } else {
          const s = kind.scale[0] + (kind.scale[1] - kind.scale[0]) * hash2(i + 7, j + 3, kind.seed + 5);
          sx = sy = sz = s;
        }
        const o = n * 16;
        mats[o] = cs * sx; mats[o + 1] = 0; mats[o + 2] = -sn * sx; mats[o + 3] = 0;
        mats[o + 4] = 0; mats[o + 5] = sy; mats[o + 6] = 0; mats[o + 7] = 0;
        mats[o + 8] = sn * sz; mats[o + 9] = 0; mats[o + 10] = cs * sz; mats[o + 11] = 0;
        mats[o + 12] = x - x0; mats[o + 13] = h - 0.05; mats[o + 14] = z - z0; mats[o + 15] = 1;
        n++;
      }
    }
    if (n) out.push({ kind: ki, count: n, matrices: mats.slice(0, n * 16) });
  }
  return out;
}
