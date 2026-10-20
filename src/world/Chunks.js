// The terrain, in chunks. Headless: this file makes typed arrays and decides
// which chunks are wanted and drawn; src/render/WorldMesh.js turns them into
// Three.js meshes.
//
// A quadtree over the whole map. The smallest chunks (level 0) are
// OPEN_WORLD.chunkSize metres across, each is chunkCells x chunkCells cells, and
// every level up is twice the size with the same number of cells -- so a chunk
// costs about the same to build and draw wherever it is, and what changes with
// distance is how coarse its facets are. A node is drawn whole while the camera
// is further than splitFactor times its size, and replaced by its four children
// when it is nearer. A node's children replace it only when ALL FOUR are ready,
// and until then it stays: there are no holes while the world is still being
// built, only coarse places that sharpen.
//
// Each chunk is a triangle soup with one colour per face (the world is faceted,
// not smoothed), and a SKIRT hanging from every edge, a few cells deep. Chunks of
// different levels meet along edges where the finer one has vertices the coarser
// does not, so their heights differ by a little along the join, and the skirt is
// what keeps daylight out of that gap.
//
// Building a chunk is deterministic and costs a millisecond or two, so it is done
// on the main thread, a few at a time under a per-frame budget (Streamer.js).

import { hash2, hash2b } from './Noise.js';

// A number for a node: no strings, so the per-frame tree walk allocates nothing.
// Levels are at most 8 (256 x 256 nodes), so 9 bits an axis is room to spare.
export const keyOf = (level, ix, iz) => level * 262144 + ix * 512 + iz;

export class ChunkTree {
  constructor(cfg) {
    this.cfg = cfg;
    this.min = cfg.chunkSize;
    let level = 0;
    while (this.min * 2 ** level < cfg.size) level++;
    this.rootLevel = level;
    this.rootSize = this.min * 2 ** level;
    this.half = this.rootSize / 2;
  }
  size(level) { return this.min * 2 ** level; }
  origin(level, i) { return -this.half + i * this.size(level); }
}

export class Chunk {
  constructor(tree, level, ix, iz) {
    this.key = keyOf(level, ix, iz);
    this.level = level; this.ix = ix; this.iz = iz;
    this.size = tree.size(level);
    this.x0 = tree.origin(level, ix);
    this.z0 = tree.origin(level, iz);
    this.cells = 0;            // cells a side, set by the manager (0: the tuning's)
    this.terrain = null;       // set when the terrain is built
    this.props = null;         // set when the props are built: [{ kind, count, matrices }]
    this.lastUsed = 0;
    this.requestedAt = -1;
    this.mesh = null;          // the renderer's
  }
}

// --- the terrain of one chunk ---------------------------------------------------------
// Returns { pos, nor, col, heights, minY, maxY, tris }: position, normal and
// colour (linear) per vertex, three vertices a triangle, positions relative to
// the chunk's south-west corner. `heights` is the (cells+1)^2 grid the faces are
// cut from.
export function buildTerrain(world, chunk) {
  const c = world.cfg;
  const N = chunk.cells || c.chunkCells, V = N + 1;
  const cell = chunk.size / N;
  const { x0, z0 } = chunk;
  const hf = world.hf, areas = world.areas, biomes = world.biomes;

  const H = new Float32Array(V * V);
  const sink = c.trackSink * cell;
  let minY = Infinity, maxY = -Infinity;
  // Cells the waterline runs through: each has faces to be cut in two.
  let shore = 0;
  for (let j = 0; j < V; j++) {
    for (let i = 0; i < V; i++) {
      const x = x0 + i * cell, z = z0 + j * cell;
      let y = hf.height(x, z);
      if (sink > 0.02) y -= areas.sink(x, z, sink);
      H[j * V + i] = y;
      // The drawn surface never goes under the sea (see `face`), so neither does
      // the box round it.
      if (y < minY) minY = y > 0 ? y : 0;
      if (y > maxY) maxY = y;
    }
  }
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const a = H[j * V + i], b = H[j * V + i + 1], d = H[(j + 1) * V + i], e = H[(j + 1) * V + i + 1];
      if (Math.min(a, b, d, e) < 0 && Math.max(a, b, d, e) > 0) shore++;
    }
  }

  const depth = c.skirt * cell;
  // Two faces a cell; each cut by the waterline is a land piece and a sea piece,
  // three triangles at most where there was one, so four more a shore cell. Two
  // skirt triangles a border segment, four where the waterline crosses it.
  const tris = N * N * 2 + 4 * N * 4 + shore * 4;
  let pos = new Float32Array(tris * 9);
  let nor = new Float32Array(tris * 9);
  let col = new Float32Array(tris * 9);
  let v = 0;                                   // next vertex's float offset
  const rec = new Float64Array(15);
  const rgb = [0, 0, 0];
  const water = biomes.water;
  const cellCol = new Float32Array(N * N * 3);   // the first face's colour, for the skirts
  const wi0 = Math.round(x0 / cell), wj0 = Math.round(z0 / cell);

  // One triangle. `hint` (nx, nz) is a horizontal direction the face must look
  // toward (for skirts): the winding is flipped if it does not.
  const tri = (ax, ay, az, bx, by, bz, cx, cy, cz, color, hx = 0, hz = 0) => {
    let ux = bx - ax, uy = by - ay, uz = bz - az;
    let wx = cx - ax, wy = cy - ay, wz = cz - az;
    let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    if (hx !== 0 || hz !== 0) {
      if (nx * hx + nz * hz < 0) {
        // Swap b and c.
        [bx, by, bz, cx, cy, cz] = [cx, cy, cz, bx, by, bz];
        nx = -nx; ny = -ny; nz = -nz;
      }
    }
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    const P = [ax, ay, az, bx, by, bz, cx, cy, cz];
    for (let k = 0; k < 3; k++) {
      pos[v] = P[k * 3]; pos[v + 1] = P[k * 3 + 1]; pos[v + 2] = P[k * 3 + 2];
      nor[v] = nx; nor[v + 1] = ny; nor[v + 2] = nz;
      col[v] = color[0]; col[v + 1] = color[1]; col[v + 2] = color[2];
      v += 3;
    }
    return ny;
  };
  // A top face: the triangle's colour comes from its cell and its own hash.
  //
  // The sea is made of faces, not a plane laid over the ground. A face wholly
  // under it is one flat sea-coloured triangle at the waterline; a face the
  // waterline runs through is cut along it into the land that stands above the
  // sea and the sea beside it, which share that edge to the bit. A plane at the
  // same height as a beach cannot be told apart from it by the depth buffer, and
  // the further away the coarser the depth is, so the shore shimmered and
  // tore at any distance; here nothing is coplanar but the sea with the sea.
  const poly = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];        // up to four corners (x, y, z)
  const fan = (n, color) => {
    for (let k = 1; k + 1 < n; k++) {
      tri(poly[0], poly[1], poly[2], poly[k * 3], poly[k * 3 + 1], poly[k * 3 + 2],
        poly[k * 3 + 3], poly[k * 3 + 4], poly[k * 3 + 5], color);
    }
  };
  const face = (ia, ja, ib, jb, ic, jc, cellX, cellZ, wi, wj, t) => {
    const ya = H[ja * V + ia], yb = H[jb * V + ib], yc = H[jc * V + ic];
    const ax = ia * cell, bx = ib * cell, cx = ic * cell;
    const az = ja * cell, bz = jb * cell, cz = jc * cell;
    const top = Math.max(ya, yb, yc);
    if (top <= 0) {
      tri(ax, 0, az, bx, 0, bz, cx, 0, cz, water);
      return water;
    }
    // Normal first, for the slope the colour needs.
    const ux = bx - ax, uy = yb - ya, uz = bz - az, wx = cx - ax, wy = yc - ya, wz = cz - az;
    const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    const ny1 = ny / (Math.hypot(nx, ny, nz) || 1);
    const h = Math.max(0, (ya + yb + yc) / 3);
    biomes.facet(rec, h, ny1, hash2(wi * 2 + t, wj, c.seed + 31), hash2b(wi * 2 + t, wj, c.seed + 32), rgb, 0);
    if (Math.min(ya, yb, yc) >= 0) {
      tri(ax, ya, az, bx, yb, bz, cx, yc, cz, rgb);
      return rgb;
    }
    // Cut along the waterline, walking the corners in order so the winding holds:
    // first the part above it (the face's own surface), then the part below it,
    // flattened onto the sea.
    const X = [ax, bx, cx], Y = [ya, yb, yc], Z = [az, bz, cz];
    for (const above of [true, false]) {
      let n = 0;
      for (let k = 0; k < 3; k++) {
        const m = (k + 1) % 3;
        if (above ? Y[k] >= 0 : Y[k] <= 0) { poly[n * 3] = X[k]; poly[n * 3 + 1] = above ? Y[k] : 0; poly[n * 3 + 2] = Z[k]; n++; }
        if ((Y[k] < 0 && Y[m] > 0) || (Y[k] > 0 && Y[m] < 0)) {
          const s = Y[k] / (Y[k] - Y[m]);
          poly[n * 3] = X[k] + (X[m] - X[k]) * s; poly[n * 3 + 1] = 0; poly[n * 3 + 2] = Z[k] + (Z[m] - Z[k]) * s; n++;
        }
      }
      if (n >= 3) fan(n, above ? rgb : water);
    }
    return rgb;
  };

  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const hc = (H[j * V + i] + H[j * V + i + 1] + H[(j + 1) * V + i] + H[(j + 1) * V + i + 1]) / 4;
      const cx = x0 + (i + 0.5) * cell, cz = z0 + (j + 0.5) * cell;
      biomes.cell(cx, cz, hc, rec);
      const wi = wi0 + i, wj = wj0 + j;
      // Which way the cell is cut alternates, so no diagonal runs through the map.
      if (((wi + wj) & 1) === 0) {
        const a = face(i, j, i, j + 1, i + 1, j, cx, cz, wi, wj, 0);
        cellCol[(j * N + i) * 3] = a[0]; cellCol[(j * N + i) * 3 + 1] = a[1]; cellCol[(j * N + i) * 3 + 2] = a[2];
        face(i + 1, j, i, j + 1, i + 1, j + 1, cx, cz, wi, wj, 1);
      } else {
        const a = face(i, j, i, j + 1, i + 1, j + 1, cx, cz, wi, wj, 0);
        cellCol[(j * N + i) * 3] = a[0]; cellCol[(j * N + i) * 3 + 1] = a[1]; cellCol[(j * N + i) * 3 + 2] = a[2];
        face(i, j, i + 1, j + 1, i + 1, j, cx, cz, wi, wj, 1);
      }
    }
  }

  // Skirts: a quad hanging `depth` below each border segment, facing outward.
  // It hangs from the surface as drawn, which is never under the sea: a segment
  // the waterline crosses is hung in two, so no wall stands above the shore, and
  // the sea itself has no skirt (its neighbours are level with it, and a wall
  // there only shows as a dark line wherever two meshes' edges miss by a pixel).
  const skirtQuad = (ax, ya, az, bx, yb, bz, color, hx, hz) => {
    tri(ax, ya, az, bx, yb, bz, ax, ya - depth, az, color, hx, hz);
    tri(bx, yb, bz, bx, yb - depth, bz, ax, ya - depth, az, color, hx, hz);
    if (ya - depth < minY) minY = ya - depth;
    if (yb - depth < minY) minY = yb - depth;
  };
  const skirt = (i0, j0, i1, j1, hx, hz, cellIndex) => {
    const ax = i0 * cell, az = j0 * cell, bx = i1 * cell, bz = j1 * cell;
    const ya = H[j0 * V + i0], yb = H[j1 * V + i1];
    const color = [cellCol[cellIndex * 3] * 0.8, cellCol[cellIndex * 3 + 1] * 0.8, cellCol[cellIndex * 3 + 2] * 0.8];
    if (ya <= 0 && yb <= 0) return;
    if (ya < 0 || yb < 0) {
      const s = ya / (ya - yb), mx = ax + (bx - ax) * s, mz = az + (bz - az) * s;
      if (ya > 0) skirtQuad(ax, ya, az, mx, 0, mz, color, hx, hz);
      else skirtQuad(mx, 0, mz, bx, yb, bz, color, hx, hz);
    } else {
      skirtQuad(ax, ya, az, bx, yb, bz, color, hx, hz);
    }
  };
  for (let k = 0; k < N; k++) {
    skirt(k, 0, k + 1, 0, 0, -1, k);                       // south
    skirt(k, N, k + 1, N, 0, 1, (N - 1) * N + k);          // north
    skirt(0, k, 0, k + 1, -1, 0, k * N);                   // west
    skirt(N, k, N, k + 1, 1, 0, k * N + N - 1);            // east
  }

  // The arrays were sized for the worst case; the mesh draws every triangle in them.
  if (v !== pos.length) { pos = pos.slice(0, v); nor = nor.slice(0, v); col = col.slice(0, v); }
  return { pos, nor, col, heights: H, minY, maxY, tris: v / 9 };
}

// --- which chunks, and when ---------------------------------------------------------------
export class ChunkManager {
  // world: the headless World. build: (world, chunk) -> terrain (buildTerrain, or
  // a stub in a test).
  constructor(world, cfg = world.cfg, build = buildTerrain) {
    this.world = world;
    this.cfg = cfg;
    this.tree = new ChunkTree(cfg);
    this.build = build;
    this.chunks = new Map();
    this.drawList = [];
    this.requests = [];            // { chunk, pri, props } from the last update, best first
    this.frame = 0;
    this.onEvict = null;           // (chunk) => void, so the renderer can free its mesh
    this.propScale = 1;            // thins the props (the render distance)
    this.propDensify = 1;          // makes them more (the detail setting)
    this.lod = 1;                  // multiplies splitFactor: how sharp the middle distance is
    this.cells = cfg.chunkCells;   // cells a side of every chunk built from now on
    this.stats = { terrain: 0, terrainMs: 0, terrainMax: 0, props: 0, propMs: 0, propMax: 0, evicted: 0 };
    this._cam = { x: 0, y: 0, z: 0, fx: 0, fz: 1, range: 0 };
    this._reqPool = [];
  }

  // Work out what to draw from where the camera is. `range` is how far (metres)
  // chunks are drawn. Fills drawList (chunks with terrain, in no order) and
  // requests (what to build next, most wanted first), and returns drawList.
  update(x, y, z, fx, fz, range) {
    this.frame++;
    const cam = this._cam;
    cam.x = x; cam.y = y; cam.z = z; cam.fx = fx; cam.fz = fz; cam.range = range;
    this.drawList.length = 0;
    this._reqPool.push(...this.requests);
    this.requests.length = 0;
    this._visit(this.tree.rootLevel, 0, 0);
    // Few enough that an insertion sort is the cheap thing.
    const r = this.requests;
    for (let i = 1; i < r.length; i++) {
      const item = r[i];
      let k = i - 1;
      while (k >= 0 && r[k].pri > item.pri) { r[k + 1] = r[k]; k--; }
      r[k + 1] = item;
    }
    if (this.frame % 30 === 0) this._evict();
    return this.drawList;
  }

  _chunk(level, ix, iz) {
    const key = keyOf(level, ix, iz);
    let c = this.chunks.get(key);
    if (!c) { c = new Chunk(this.tree, level, ix, iz); c.cells = this.cells; this.chunks.set(key, c); }
    return c;
  }

  _request(chunk, pri, props) {
    if (chunk.requestedAt === this.frame * 2 + (props ? 1 : 0)) return;
    chunk.requestedAt = this.frame * 2 + (props ? 1 : 0);
    const item = this._reqPool.pop() || {};
    item.chunk = chunk; item.pri = props ? pri + 1e6 : pri; item.props = props;
    this.requests.push(item);
  }

  // Returns true when this node's area is covered by what is drawn (or is out of
  // sight), false when something in it is still missing.
  _visit(level, ix, iz) {
    const cam = this._cam, tree = this.tree;
    const size = tree.size(level);
    const x0 = tree.origin(level, ix), z0 = tree.origin(level, iz);
    const nx = cam.x < x0 ? x0 : cam.x > x0 + size ? x0 + size : cam.x;
    const nz = cam.z < z0 ? z0 : cam.z > z0 + size ? z0 + size : cam.z;
    const dxz = Math.hypot(cam.x - nx, cam.z - nz);
    if (dxz > cam.range) return true;

    const chunk = this._chunk(level, ix, iz);
    chunk.lastUsed = this.frame;
    // How far the camera is above this piece of ground, once it is known.
    const top = chunk.terrain ? chunk.terrain.maxY : 0;
    const d = Math.hypot(dxz, Math.max(0, cam.y - top));
    const behind = (nx - cam.x) * cam.fx + (nz - cam.z) * cam.fz < 0;
    const pri = d * (behind ? 1.7 : 1);

    if (level > 0 && d < this.cfg.splitFactor * this.lod * size) {
      const mark = this.drawList.length;
      let all = true;
      const i2 = ix * 2, j2 = iz * 2;
      for (let b = 0; b < 2; b++) for (let a = 0; a < 2; a++) if (!this._visit(level - 1, i2 + a, j2 + b)) all = false;
      if (all) return true;
      if (chunk.terrain) this.drawList.length = mark;       // show this one until they are all in
      else { this._request(chunk, pri - 1e5, false); return false; }  // nothing to fall back on: coarse first
    }

    if (chunk.terrain) {
      this.drawList.push(chunk);
      if (!chunk.props && level < this.cfg.propLevels) this._request(chunk, pri, true);
      return true;
    }
    this._request(chunk, pri, false);
    return false;
  }

  // Build the single most wanted thing and return what it was (or null).
  buildNext() {
    const r = this.requests;
    if (!r.length) return null;
    const item = r.shift();
    const chunk = item.chunk;
    const t0 = performance.now();
    if (item.props) {
      chunk.props = this._buildProps(chunk);
      const ms = performance.now() - t0;
      this.stats.props++; this.stats.propMs += ms; this.stats.propMax = Math.max(this.stats.propMax, ms);
    } else {
      chunk.terrain = this.build(this.world, chunk);
      const ms = performance.now() - t0;
      this.stats.terrain++; this.stats.terrainMs += ms; this.stats.terrainMax = Math.max(this.stats.terrainMax, ms);
    }
    this._reqPool.push(item);
    return item.props ? 'props' : 'terrain';
  }

  setPropBuilder(fn) { this._propBuilder = fn; }
  _buildProps(chunk) {
    return this._propBuilder ? this._propBuilder(this.world, chunk, this.propScale, this.propDensify) : [];
  }

  // The detail setting: how sharp the middle distance is, how many cells a side
  // a chunk has, how many props there are. Chunks already built are the old
  // detail, so any change that touches them drops them all (the renderer frees
  // their meshes through onEvict) and they are built again as they are wanted.
  // Returns true if that is what happened.
  setDetail({ lod, cells, props }) {
    const rebuild = cells !== this.cells || props !== this.propDensify;
    this.lod = lod;
    this.cells = cells;
    this.propDensify = props;
    if (rebuild) this.flush();
    return rebuild;
  }

  flush() {
    for (const c of this.chunks.values()) if (c.terrain && this.onEvict) this.onEvict(c);
    this.chunks.clear();
    this.drawList.length = 0;
    this.requests.length = 0;
  }

  // Build until nothing more is wanted at this camera: coarse levels first. For
  // the first frame of a flight and for tests; `ms` caps the time it may take.
  prime(x, y, z, fx, fz, range, ms = Infinity, withProps = false) {
    const t0 = performance.now();
    for (let guard = 0; guard < 4000; guard++) {
      this.update(x, y, z, fx, fz, range);
      // Most wanted first, and the props (which sort last) only if asked for.
      const next = this.requests[0];
      if (!next || (next.props && !withProps)) return true;
      this.buildNext();
      if (performance.now() - t0 > ms) return false;
    }
    return false;
  }

  // Chunks nobody has wanted for a moment go: the ones never built at once, the
  // built ones oldest first once more than `chunkCache` of them are waiting about
  // to be wanted again.
  _evict() {
    const unused = [];
    for (const c of this.chunks.values()) {
      if (c.lastUsed >= this.frame - 2) continue;
      if (!c.terrain) { this.chunks.delete(c.key); continue; }
      unused.push(c);
    }
    unused.sort((a, b) => a.lastUsed - b.lastUsed);
    for (let i = 0; i < unused.length - this.cfg.chunkCache; i++) {
      const c = unused[i];
      this.chunks.delete(c.key);
      this.stats.evicted++;
      if (this.onEvict) this.onEvict(c);
    }
  }
}
