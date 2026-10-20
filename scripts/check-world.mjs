// The open world, headless: the real Heightfield, TrackAreas, ChunkManager,
// WorldOrigin, AmbientLap and WorldMesh against the real Track, VehiclePhysics,
// AIDriver and AircraftPhysics, with no browser and no GPU.
//
//   - the ground the car game builds from is unchanged: a hash of TrackGround
//     over a grid, and of every byte of every TrackMesh, equals what it was
//     before the ground was extracted (so the six tracks look and drive as they did)
//   - the height function is deterministic, finite, and one function for the
//     mesh and the ground contract
//   - chunks: neighbours meet exactly, levels meet within their skirts, the mesh is
//     built from the same heights the aircraft lands on, a track's ribbon is never
//     under the terrain, and a flight at Mach 2 never leaves a hole
//   - the six tracks are placed: on land, apart, deterministically, each where its
//     biome wants it, and adding a track moves none of them
//   - the floating origin never changes what is where, and keeps drawn numbers small
//   - the AI cars: a state saved and loaded is the state, and the hand-over from the
//     replay to live driving is exact, bit for bit, at hundreds of seeded times
//   - the F-22 takes off from the home runway and flies over the world
//   - the world as Three.js objects can be run for a minute of flight
//
//   npm run world

import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));
const T = await import('./lib/track-hash.mjs');
const { OPEN_WORLD, SIM, TRACK } = await import(SRC + 'data/tuning.js');
const { Track } = await import(SRC + 'game/Track.js');
const { TrackMesh } = await import(SRC + 'game/TrackMesh.js');
const { TrackGround } = await import(SRC + 'game/TrackGround.js');
const { RacingLine } = await import(SRC + 'ai/RacingLine.js');
const { VehiclePhysics, STATE_LENGTH } = await import(SRC + 'game/VehiclePhysics.js');
const { AIDriver } = await import(SRC + 'ai/AIDriver.js');
const { World } = await import(SRC + 'world/World.js');
const { Heightfield } = await import(SRC + 'world/Heightfield.js');
const { ChunkManager, buildTerrain, ChunkTree } = await import(SRC + 'world/Chunks.js');
const { buildProps, KINDS } = await import(SRC + 'world/Props.js');
const { WorldOrigin } = await import(SRC + 'world/WorldOrigin.js');
const { Streamer } = await import(SRC + 'world/Streamer.js');
const { AmbientCar, POSE } = await import(SRC + 'world/AmbientLap.js');
const { AmbientCars } = await import(SRC + 'world/AmbientCars.js');
const { inferBiome, BIOME_INDEX } = await import(SRC + 'world/Biomes.js');
const { getChassis } = await import(SRC + 'data/cars.js');
const { OPPONENTS } = await import(SRC + 'data/opponents.js');
const H = await import('./lib/flight-harness.mjs');
const { F22 } = await import(SRC + 'data/aircraft.js');

let failed = false;
const check = (ok, msg) => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${msg}`);
  if (!ok) failed = true;
};
const DT = 1 / SIM.hz;
const f1 = (v) => v.toFixed(1);
let seed = 0x5eed;
const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };

const trackData = await T.loadTrackData();

// --- the golden numbers: what the car game builds, as it was before the extraction ----
// (recorded 2026-10-19, before TrackMesh._terrainHeight became TrackGround, from
// scripts/lib/track-hash.mjs; a change to a track file or to the ground changes them
// on purpose and these are then re-recorded with the same script)
const GOLDEN = {
  'copper-flats': { grid: '9298893a', mesh: '6cc40e4d' },
  'drag-strip': { grid: 'a1e6416c', mesh: 'c732edeb' },
  'glacier-pass': { grid: '75e1406f', mesh: '9a92b3f2' },
  'harbor-nine': { grid: 'd3f90e94', mesh: '928a86dc' },
  'pine-ridge': { grid: 'ad83c78e', mesh: '6350d02a' },
  'skyline-interchange': { grid: '2a7760b7', mesh: 'eb0760bb' },
};

console.log('\nThe car game\'s ground and meshes are unchanged');
for (const data of trackData) {
  const track = new Track(data);
  const g = new TrackGround(track);
  const grid = T.gridHash(track, (x, z) => g.height(x, z));
  const mesh = new TrackMesh(track);
  const mh = T.meshHash(mesh);
  const same = GOLDEN[data.id] && grid.hash === GOLDEN[data.id].grid && mh.hash === GOLDEN[data.id].mesh;
  check(same, `${data.id.padEnd(20)} ground ${grid.hash} (${grid.count} points), mesh ${mh.hash} (${mh.meshes} meshes, ${(mh.tris / 1e3).toFixed(0)}k triangles)${GOLDEN[data.id] ? '' : '  (no golden recorded)'}`);
  // TrackMesh asks TrackGround, and a stepped build is the same build.
  let delegates = true;
  for (let k = 0; k < 200; k++) {
    const mm = track.minimap;
    const x = mm.minX - 800 + rnd() * (mm.maxX - mm.minX + 1600), z = mm.minZ - 800 + rnd() * (mm.maxZ - mm.minZ + 1600);
    if (mesh._terrainHeight(x, z) !== g.height(x, z)) delegates = false;
  }
  const stepped = new TrackMesh(track, { defer: true });
  let steps = 0;
  for (const _ of stepped.steps()) steps++;
  const noGround = new TrackMesh(track, { ground: false });
  let a = 0, b = 0;
  mesh.group.traverse((o) => { if (o.isMesh) a++; });
  noGround.group.traverse((o) => { if (o.isMesh) b++; });
  check(delegates && T.meshHash(stepped).hash === mh.hash && a - b === 1,
    `${''.padEnd(20)} TrackMesh delegates to TrackGround; ${steps} steps build the same mesh; { ground: false } drops just the ground`);
}

// --- the world ----------------------------------------------------------------------------------
console.log('\nThe height function');
const world = new World(trackData);
const world2 = new World(trackData);
{
  let finite = true, same = true, lo = 1e9, hi = -1e9, land = 0, n = 0;
  for (let k = 0; k < 6000; k++) {
    const x = (rnd() - 0.5) * 130000, z = (rnd() - 0.5) * 130000;
    const h = world.height(x, z);
    if (!Number.isFinite(h)) finite = false;
    if (h !== world2.height(x, z)) same = false;
    lo = Math.min(lo, h); hi = Math.max(hi, h);
    n++; if (h > 0) land++;
  }
  check(finite && same, 'finite everywhere, and the same in two worlds from the same seed');
  check(hi > 1200 && hi < 3600 && lo < -200 && land / n > 0.4 && land / n < 0.7,
    `ranges from ${f1(lo)} m to ${f1(hi)} m, ${(100 * land / n).toFixed(0)}% land`);
  const other = new Heightfield({ ...OPEN_WORLD, seed: OPEN_WORLD.seed + 1 });
  let differs = 0;
  for (let k = 0; k < 200; k++) { const x = (rnd() - 0.5) * 100000, z = (rnd() - 0.5) * 100000; if (Math.abs(other.base(x, z) - world.hf.base(x, z)) > 1) differs++; }
  check(differs > 150, 'another seed is another world');
  // The edge of the world is sea.
  let edgeSea = true;
  for (let k = 0; k < 200; k++) {
    const t = (rnd() - 0.5) * 2 * OPEN_WORLD.size / 2;
    for (const [x, z] of [[OPEN_WORLD.size / 2 - 200, t], [-OPEN_WORLD.size / 2 + 200, t], [t, OPEN_WORLD.size / 2 - 200], [t, -OPEN_WORLD.size / 2 + 200]]) {
      if (world.height(x, z) > 0) edgeSea = false;
    }
  }
  check(edgeSea, 'the rim of the map is under the sea');
}

console.log('\nThe ground contract');
{
  const surfaces = new Set(['runway', 'tarmac', 'gravel', 'grass', 'sand', 'rock', 'snow', 'water']);
  const seen = new Set();
  let bad = 0;
  for (let k = 0; k < 20000; k++) {
    const x = (rnd() - 0.5) * 120000, z = (rnd() - 0.5) * 120000;
    const s = world.sample(x, z, 1e4);
    seen.add(s.surface);
    const len = Math.hypot(s.normal.x, s.normal.y, s.normal.z);
    if (!Number.isFinite(s.height) || Math.abs(len - 1) > 1e-6 || s.normal.y <= 0 || !surfaces.has(s.surface)) bad++;
  }
  check(bad === 0, `20000 samples: finite heights, unit normals pointing up, only known surfaces (saw ${[...seen].sort().join(', ')})`);
  // The sea is sea level.
  let seaOk = true;
  for (let k = 0; k < 400; k++) {
    const x = -50000 + rnd() * 6000, z = -50000 + rnd() * 6000;
    const s = world.sample(x, z, 100);
    if (world.height(x, z) < 0 && (s.height !== 0 || s.surface !== 'water')) seaOk = false;
  }
  check(seaOk, 'over the sea the ground is the sea: height 0, surface water');
  // sample() does not allocate.
  if (global.gc) {
    for (let k = 0; k < 20000; k++) world.sample(k * 3.1, k * 1.7, 50);
    global.gc();
    const before = process.memoryUsage().heapUsed;
    for (let k = 0; k < 300000; k++) world.sample((k % 997) * 50 - 20000, (k % 991) * 40 - 15000, 50);
    global.gc();
    const grown = process.memoryUsage().heapUsed - before;
    check(grown < 1.5e6, `300,000 samples grew the heap by ${(grown / 1024).toFixed(0)} KB`);
  } else console.log('  skip  allocation (run with node --expose-gc, which npm run world does)');
}

console.log('\nThe home runway');
{
  const h = OPEN_WORLD.home;
  let worst = 0, onRunway = 0, n = 0;
  for (let along = 0; along <= h.length; along += 25) {
    for (let across = -h.width / 2; across <= h.width / 2; across += 6) {
      const x = h.x + across, z = h.z + along;
      const s = world.sample(x, z, 100);
      worst = Math.max(worst, Math.abs(s.height - h.height));
      n++; if (s.surface === 'runway') onRunway++;
    }
  }
  let beyond = 0;
  for (let z = h.z - h.flatMargin; z <= h.z + h.length + h.flatMargin; z += 50) beyond = Math.max(beyond, Math.abs(world.height(h.x, z) - h.height));
  const sp = world.spawn();
  check(worst < 0.01 && onRunway === n && h.length >= 3200, `${h.length} m x ${h.width} m, level to ${(worst * 100).toFixed(1)} cm, all of it runway, on land at ${h.height} m`);
  check(beyond < 0.01 && world.sample(sp.x, sp.z, 100).surface === 'runway', `level for ${OPEN_WORLD.home.flatMargin} m past each end; the spawn is on the runway`);
}

// --- chunks ------------------------------------------------------------------------------------------
console.log('\nChunks');
{
  const tree = new ChunkTree(OPEN_WORLD);
  check(tree.rootSize >= OPEN_WORLD.size && tree.rootLevel === 8, `the tree covers ${(tree.rootSize / 1000).toFixed(0)} km in ${tree.rootLevel + 1} levels`);
  // Same-level neighbours share their edge to the bit.
  const N = OPEN_WORLD.chunkCells, V = N + 1;
  const mk = (level, ix, iz) => {
    const c = { level, ix, iz, size: tree.size(level), x0: tree.origin(level, ix), z0: tree.origin(level, iz) };
    c.terrain = buildTerrain(world, c);
    return c;
  };
  let sameEdges = true;
  for (let k = 0; k < 12; k++) {
    const level = Math.floor(rnd() * 5);
    const n = 2 ** (tree.rootLevel - level);
    const ix = 1 + Math.floor(rnd() * (n - 3)), iz = 1 + Math.floor(rnd() * (n - 3));
    const a = mk(level, ix, iz), e = mk(level, ix + 1, iz), s = mk(level, ix, iz + 1);
    for (let j = 0; j < V; j++) if (a.terrain.heights[j * V + N] !== e.terrain.heights[j * V]) sameEdges = false;
    for (let i = 0; i < V; i++) if (a.terrain.heights[N * V + i] !== s.terrain.heights[i]) sameEdges = false;
  }
  check(sameEdges, 'neighbours at the same level meet along an edge exactly');

  // The mesh is made of the heights the aircraft lands on.
  let worst = 0, count = 0;
  for (const [level, x, z] of [[0, 0, 100], [0, 5000, 16000], [1, -7000, -12000], [2, 23800, 700], [3, -25000, 8000], [4, 30000, -30000]]) {
    const ix = Math.floor((x + tree.half) / tree.size(level)), iz = Math.floor((z + tree.half) / tree.size(level));
    const c = mk(level, ix, iz);
    const cell = c.size / N;
    for (let j = 0; j < V; j += 3) for (let i = 0; i < V; i += 3) {
      const wx = c.x0 + i * cell, wz = c.z0 + j * cell;
      if (world.areas.tubeAt(wx, wz)) continue;          // the ribbon sinks the ground there
      const d = Math.abs(c.terrain.heights[j * V + i] - world.height(wx, wz));
      worst = Math.max(worst, d); count++;
    }
  }
  check(worst < 1e-3 * 10, `${count} mesh vertices equal World.height (worst ${(worst * 1000).toFixed(2)} mm, float32 rounding only)`);

  // The sea is faces, cut at the waterline: no plane to fight a beach in the
  // depth buffer. Shore chunks at every level: the top surface covers the chunk's
  // footprint exactly once (so the cut lost and doubled nothing, and every face
  // looks up), nothing but skirts goes under the sea, no face straddles it, and
  // what is flat at the waterline is painted the sea's colour.
  {
    const hf = world.hf, shores = [];
    for (let z = -30000; z <= 30000 && shores.length < 8; z += 1500) {
      let prev = hf.height(-40000, z);
      for (let x = -40000; x < 40000; x += 64) {
        const h = hf.height(x, z);
        if ((prev > 0) !== (h > 0) && Math.abs(prev - h) < 200) { shores.push([x, z]); break; }
        prev = h;
      }
    }
    check(shores.length >= 3, `found ${shores.length} shores to test the waterline cut on`);
    let chunksTested = 0, badFootprint = 0, straddle = 0, below = 0, waterOff = 0, upside = 0, waterFaces = 0, landFaces = 0;
    const W = world.biomes.water;
    for (const [sx, sz] of shores) {
      for (let level = 0; level <= 4; level++) {
        const c = mk(level, Math.floor((sx + tree.half) / tree.size(level)), Math.floor((sz + tree.half) / tree.size(level)));
        const t = c.terrain, pos = t.pos, col = t.col;
        if (!pos) continue;
        chunksTested++;
        let footprint = 0;
        for (let v = 0; v < pos.length; v += 9) {
          const ay = pos[v + 1], by = pos[v + 4], cy = pos[v + 7];
          // Signed footprint (x, z): positive for a face that looks up.
          const area = ((pos[v + 5] - pos[v + 2]) * (pos[v + 6] - pos[v]) - (pos[v + 3] - pos[v]) * (pos[v + 8] - pos[v + 2])) / 2;
          footprint += area;
          const lo = Math.min(ay, by, cy), hi = Math.max(ay, by, cy);
          if (Math.abs(area) < 1e-6) {                  // a skirt: vertical
            continue;
          }
          if (area < 0) upside++;
          if (lo < -1e-4) below++;
          if (lo < -1e-4 && hi > 1e-4) straddle++;
          if (hi < 1e-9) {
            waterFaces++;
            if (Math.abs(col[v] - W[0]) > 1e-5 || Math.abs(col[v + 1] - W[1]) > 1e-5 || Math.abs(col[v + 2] - W[2]) > 1e-5) waterOff++;
          } else landFaces++;
        }
        if (Math.abs(footprint - c.size * c.size) > c.size * c.size * 1e-5) badFootprint++;
      }
    }
    check(chunksTested >= 15 && waterFaces > 0 && landFaces > 0, `${chunksTested} shore chunks, ${waterFaces} sea faces and ${landFaces} land faces among them`);
    check(badFootprint === 0 && upside === 0, `the surface covers each chunk exactly once and every face looks up (${badFootprint} chunks off, ${upside} faces wrong)`);
    check(below === 0 && straddle === 0, `no face of the surface goes under the sea (${below}), none straddles it (${straddle})`);
    check(waterOff === 0, `every face at the waterline is the sea's colour (${waterOff} are not)`);
  }

  // Levels meet within their skirts, wherever the camera is.
  let pairs = 0, gaps = 0, worstGap = 0;
  const cams = [];
  for (let k = 0; k < 40; k++) cams.push([(rnd() - 0.5) * 100000, 30 + rnd() * 6000, (rnd() - 0.5) * 100000]);
  cams.push([0, 400, -1800], [-7024, 300, -12598], [18213, 1500, -34987], [5067, 200, 16977]);
  for (const [x, y, z] of cams) {
    const m = new ChunkManager(world);
    m.prime(x, y, z, 0, 1, 16000);
    const list = m.drawList;
    const byEdge = new Map();
    for (const c of list) for (const side of ['w', 'e', 's', 'n']) {
      // The line of the edge, and where along it this chunk spans.
      const horiz = side === 's' || side === 'n';
      const pos = horiz ? (side === 's' ? c.z0 : c.z0 + c.size) : (side === 'w' ? c.x0 : c.x0 + c.size);
      const key = `${horiz ? 'h' : 'v'}${pos}`;
      if (!byEdge.has(key)) byEdge.set(key, []);
      byEdge.get(key).push({ c, side, lo: horiz ? c.x0 : c.z0, hi: horiz ? c.x0 + c.size : c.z0 + c.size });
    }
    const edgeH = (c, side, t) => {      // the chunk's edge height at fraction t along it
      const cells = N, f = t * cells, i0 = Math.min(cells - 1, Math.floor(f)), u = f - i0, H2 = c.terrain.heights;
      // The surface is drawn no lower than the sea, so that is the edge that has to meet.
      const at = (i) => Math.max(0, side === 's' ? H2[i] : side === 'n' ? H2[N * V + i] : side === 'w' ? H2[i * V] : H2[i * V + N]);
      return at(i0) * (1 - u) + at(i0 + 1) * u;
    };
    for (const items of byEdge.values()) {
      for (const a of items) for (const b of items) {
        if (a.c === b.c || a.c.level >= b.c.level) continue;     // a is the finer
        const lo = Math.max(a.lo, b.lo), hi = Math.min(a.hi, b.hi);
        if (hi - lo < 1) continue;
        // opposite sides of a shared line
        if (!((a.side === 'e' && b.side === 'w') || (a.side === 'w' && b.side === 'e') || (a.side === 'n' && b.side === 's') || (a.side === 's' && b.side === 'n'))) continue;
        pairs++;
        const cellA = a.c.size / N, cellB = b.c.size / N;
        for (let s = 0; s <= 16; s++) {
          const p = lo + ((hi - lo) * s) / 16;
          const ha = edgeH(a.c, a.side, (p - a.lo) / (a.hi - a.lo)), hb = edgeH(b.c, b.side, (p - b.lo) / (b.hi - b.lo));
          // The finer is the more exact. If it stands above the coarse, its own
          // skirt must cover the gap; if the coarse stands above it, the coarse's.
          const gap = ha - hb;
          const cover = gap > 0 ? OPEN_WORLD.skirt * cellA : OPEN_WORLD.skirt * cellB;
          worstGap = Math.max(worstGap, Math.abs(gap) / cover);
          if (Math.abs(gap) > cover) gaps++;
        }
      }
    }
  }
  check(pairs > 500 && gaps === 0, `${pairs} joins between levels over ${cams.length} cameras: every gap inside its skirt (the worst uses ${(100 * worstGap).toFixed(0)}% of one)`);

  // A track's road is never under the terrain mesh: at the chunk levels it is
  // seen at, the surface of the mesh (triangle by triangle, as drawn) is below the
  // road along the whole of every track. (Level 3 is 128 m cells, drawn beyond
  // 9.8 km, where a road is a pixel wide; it is reported, not asserted.)
  const meshChunks = new Map();
  const chunkFor = (level, x, z) => {
    const ix = Math.floor((x + tree.half) / tree.size(level)), iz = Math.floor((z + tree.half) / tree.size(level));
    const key = level * 1e6 + ix * 1000 + iz;
    let c = meshChunks.get(key);
    if (!c) { c = mk(level, ix, iz); meshChunks.set(key, c); }
    return c;
  };
  const meshHeight = (level, x, z) => {          // the drawn surface, with the same diagonal the mesh was cut on
    const c = chunkFor(level, x, z), cell = c.size / N, Hs = c.terrain.heights;
    const fx = (x - c.x0) / cell, fz = (z - c.z0) / cell;
    const i = Math.min(N - 1, Math.floor(fx)), j = Math.min(N - 1, Math.floor(fz)), u = fx - i, v = fz - j;
    const wi = Math.round(c.x0 / cell) + i, wj = Math.round(c.z0 / cell) + j;
    const h00 = Hs[j * V + i], h10 = Hs[j * V + i + 1], h01 = Hs[(j + 1) * V + i], h11 = Hs[(j + 1) * V + i + 1];
    if (((wi + wj) & 1) === 0) return u + v <= 1 ? h00 + (h10 - h00) * u + (h01 - h00) * v : h11 + (h01 - h11) * (1 - u) + (h10 - h11) * (1 - v);
    return u >= v ? h00 + (h10 - h00) * u + (h11 - h10) * v : h00 + (h11 - h01) * u + (h01 - h00) * v;
  };
  const wpt = { x: 0, z: 0 };
  const report = [];
  let poked = 0, roadPoints = 0;
  for (const level of [0, 1, 2, 3]) {
    let over = 0, n = 0, worst = 0;
    for (const a of world.areas.list) {
      const t = a.track;
      for (let i = 0; i < t.count; i += 4) {
        if (t.bridge[i]) continue;
        a.toWorld(t.px[i], t.pz[i], wpt);
        const d = meshHeight(level, wpt.x, wpt.z) - (t.py[i] + a.dy);
        n++; if (d > 0.2) over++; worst = Math.max(worst, d);
      }
    }
    report.push(`level ${level}: ${(100 * over / n).toFixed(1)}% (worst ${worst.toFixed(1)} m)`);
    if (level <= 2) { poked += over; roadPoints += n; }
  }
  check(poked === 0 && roadPoints > 1000, `${roadPoints} points along the six roads, at levels 0 to 2: the drawn terrain is never above the road. Terrain above the road, by level: ${report.join(', ')}`);
}

console.log('\nDetail');
{
  const steps = OPEN_WORLD.detailSteps;
  const def = steps[OPEN_WORLD.detailDefault];
  check(def.lod === 1 && def.cells === OPEN_WORLD.chunkCells && def.props === 1 && def.shadow === 1 && def.scale === 1,
    `the default step (${def.name}) is the world as it was before the slider: lod 1, ${OPEN_WORLD.chunkCells} cells, props 1, shadow 1, scale 1`);
  let monotone = true;
  for (let i = 1; i < steps.length; i++) for (const k of ['lod', 'cells', 'props', 'shadow', 'scale']) if (steps[i][k] < steps[i - 1][k]) monotone = false;
  check(monotone && steps.every((t) => t.name && t.cells >= 16 && t.cells <= 96), `${steps.length} steps (${steps.map((t) => t.name).join(', ')}): none asks for less than the one before`);

  // What each step costs and what it makes: the same camera, everything built.
  const range = 30000 * OPEN_WORLD.drawMargin;
  const cams = [[0, 420, -1800], [-7024, 300, -12598]];
  let prevTris = 0, ok = true, footprintOk = true;
  const rows = [];
  for (const st of steps) {
    const m = new ChunkManager(world);
    m.setDetail({ lod: st.lod, cells: st.cells, props: st.props });
    let tris = 0, chunks = 0, ms = 0;
    for (const [x, y, z] of cams) {
      const t0 = performance.now();
      m.prime(x, y, z, 0, 1, range);
      ms += performance.now() - t0;
      tris += m.drawList.reduce((a, c) => a + c.terrain.tris, 0);
      chunks += m.drawList.length;
      // Every point in range is under exactly one chunk, at every step.
      for (let p = 0; p < 300; p++) {
        const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * (range - 2000);
        const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
        if (Math.abs(px) > m.tree.half || Math.abs(pz) > m.tree.half) continue;
        let covered = 0;
        for (const c of m.drawList) if (px >= c.x0 && px < c.x0 + c.size && pz >= c.z0 && pz < c.z0 + c.size) covered++;
        if (covered !== 1) footprintOk = false;
      }
      // Every chunk is made of the cells it was asked for, and covers itself exactly once.
      for (const c of m.drawList) {
        const pos = c.terrain.pos;
        let foot = 0;
        for (let v = 0; v < pos.length; v += 9) foot += ((pos[v + 5] - pos[v + 2]) * (pos[v + 6] - pos[v]) - (pos[v + 3] - pos[v]) * (pos[v + 8] - pos[v + 2])) / 2;
        if (c.cells !== st.cells || Math.abs(foot - c.size * c.size) > c.size * c.size * 1e-5) footprintOk = false;
      }
    }
    if (tris < prevTris) ok = false;
    prevTris = tris;
    rows.push(`        ${st.name.padEnd(8)} ${String(chunks / cams.length).padStart(5)} chunks  ${(tris / cams.length / 1e6).toFixed(2)} M triangles  ~${(tris / cams.length * 108 / 1e6).toFixed(0)} MB of video memory  ${(ms / cams.length).toFixed(0)} ms to build the lot`);
  }
  console.log(rows.join('\n'));
  check(ok, 'each step draws at least as many triangles as the one before');
  check(footprintOk, 'at every step every ground point is under exactly one chunk, and each chunk is the cells it was asked for and covers itself exactly once');

  // Props: the same lattice at 1, more at more, and the same ones where it is 1.
  const where = (lv, x, z) => { const t = new ChunkTree(OPEN_WORLD), n = t.size(lv); const ix = Math.floor((x + t.half) / n), iz = Math.floor((z + t.half) / n); return { level: lv, ix, iz, size: n, x0: t.origin(lv, ix), z0: t.origin(lv, iz) }; };
  const forestArea = world.areas.list.find((a) => a.biome === 'forest') || world.areas.list[0];
  const ch = where(0, forestArea.x + 1700, forestArea.z + 300);
  const count = (d) => buildProps(world, ch, 1, d).reduce((a, g) => a + g.count, 0);
  const n1 = count(1), n2 = count(2), n3 = count(3);
  const same = JSON.stringify(buildProps(world, ch, 1, 1).map((g) => [g.kind, g.count])) === JSON.stringify(buildProps(world, ch, 1).map((g) => [g.kind, g.count]));
  check(same && n1 > 20 && n2 > n1 * 1.6 && n3 > n2 * 1.25, `props: ${n1} in a chunk at 1, ${n2} at 2, ${n3} at 3 (and 1 is exactly what there always was)`);

  // A change of detail drops what was built (it was made at the old one) and a
  // change that leaves the ground alone does not.
  const m = new ChunkManager(world);
  const evicted = [];
  m.onEvict = (c) => evicted.push(c);
  m.prime(0, 420, -1800, 0, 1, range);
  const built = m.chunks.size;
  const sameGround = m.setDetail({ lod: 1.4, cells: m.cells, props: m.propDensify });
  check(!sameGround && evicted.length === 0, 'a sharper middle distance alone keeps the chunks already built');
  const newGround = m.setDetail({ lod: 1.4, cells: 48, props: 1 });
  check(newGround && m.chunks.size === 0 && evicted.length > 0 && evicted.length <= built, `finer cells drop them all (${evicted.length} freed) so none is left at the old detail`);
}

console.log('\nStreaming');
{
  // Fly a route at Mach 2 and build ONE chunk a frame -- far less than the 2 ms
  // budget allows -- and look for holes: a ground point in range that no chunk
  // covers.
  const m = new ChunkManager(world);
  let x = -20000, y = 900, z = -30000;
  const speed = 700, fps = 60;
  const range = 30000 * OPEN_WORLD.drawMargin;
  m.prime(x, y, z, 0, 1, range);
  const route = [[0.6, 0.8], [0.9, 0.1], [0.2, -0.97]];
  let holes = 0, frames = 0, worstPending = 0, probes = 0;
  for (let k = 0; k < 90 * fps; k++) {
    const dir = route[Math.min(2, Math.floor(k / (30 * fps)))];
    const dl = Math.hypot(dir[0], dir[1]);
    const fx = dir[0] / dl, fz = dir[1] / dl;
    x += (fx * speed) / fps; z += (fz * speed) / fps;
    y = 900 + 700 * Math.sin(k / 400);
    m.update(x, y, z, fx, fz, range);
    m.buildNext();
    frames++;
    worstPending = Math.max(worstPending, m.requests.length);
    for (let p = 0; p < 40; p++) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * (range - 2000);
      const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      if (Math.abs(px) > m.tree.half || Math.abs(pz) > m.tree.half) continue;
      probes++;
      let covered = 0;
      for (const c of m.drawList) if (px >= c.x0 && px < c.x0 + c.size && pz >= c.z0 && pz < c.z0 + c.size) covered++;
      if (covered !== 1) holes++;
    }
  }
  const st = m.stats;
  check(holes === 0, `${frames} frames at ${speed} m/s, one chunk built a frame: ${probes} ground points probed, every one under exactly one chunk (${holes} holes or overlaps)`);
  let perChunk = st.terrainMs / st.terrain, worstChunk = st.terrainMax;
  const within = (avg, worst) => avg < OPEN_WORLD.chunkBudgetMs * 0.75 && worst < OPEN_WORLD.chunkBudgetMs * 4;
  // A wall-clock measurement: a machine that is busy or swapping only ever makes
  // it slower (a stall of a second has been seen mid-run), and a real regression
  // would fail every time, so the best of three is what counts.
  let tries = 1;
  while (!within(perChunk, worstChunk) && tries < 3) {
    const t = new ChunkManager(world);
    t.prime(-20000 + 9000 * tries, 900, -30000 + 4000 * tries, 0, 1, range);
    if (t.stats.terrain > 100 && within(t.stats.terrainMs / t.stats.terrain, t.stats.terrainMax)) { perChunk = t.stats.terrainMs / t.stats.terrain; worstChunk = t.stats.terrainMax; }
    tries++;
  }
  check(within(perChunk, worstChunk),
    `a chunk takes ${perChunk.toFixed(2)} ms to build on average (${worstChunk.toFixed(1)} ms worst) against a ${OPEN_WORLD.chunkBudgetMs} ms frame budget: no worker needed${tries > 1 ? ` (the best of ${tries} measurements: this machine was busy)` : ''}`);
  // What Mach 2 actually demands.
  const demand = st.terrain / 90;
  console.log(`        ${st.terrain} chunks built over 90 s = ${demand.toFixed(0)} a second (${(demand * perChunk).toFixed(0)} ms of build a second, ${(100 * demand * perChunk / 1000).toFixed(1)}% of a core); cache ${m.chunks.size}, evicted ${st.evicted}`);
  let kept = 0, unusedBuilt = 0;
  for (const c of m.chunks.values()) { if (c.terrain) kept++; if (c.terrain && c.lastUsed < m.frame - 2) unusedBuilt++; }
  check(unusedBuilt <= OPEN_WORLD.chunkCache + 30, `the cache stays bounded: ${kept} chunks built, ${unusedBuilt} of them out of view (it keeps ${OPEN_WORLD.chunkCache} of those)`);
}

console.log('\nScenery');
{
  const tree = new ChunkTree(OPEN_WORLD);
  const chunkAt = (level, x, z) => {
    const ix = Math.floor((x + tree.half) / tree.size(level)), iz = Math.floor((z + tree.half) / tree.size(level));
    return { level, ix, iz, size: tree.size(level), x0: tree.origin(level, ix), z0: tree.origin(level, iz) };
  };
  let nanGeo = 0;
  for (const k of KINDS) {
    for (const arr of [k.geometry.pos, k.geometry.nor, k.geometry.col]) for (const v of arr) if (!Number.isFinite(v)) nanGeo++;
  }
  check(nanGeo === 0 && KINDS.length >= 12, `${KINDS.length} kinds of prop, all baked to finite geometry`);
  const forest = world.areas.byId.get('pine-ridge');
  const c = chunkAt(0, forest.x + 1700, forest.z + 300);
  const p1 = buildProps(world, c, 1), p2 = buildProps(world, c, 1);
  let total = 0, same = p1.length === p2.length;
  for (let i = 0; i < p1.length; i++) { total += p1[i].count; if (p1[i].count !== p2[i].count || p1[i].matrices.some((v, j) => v !== p2[i].matrices[j])) same = false; }
  check(total > 40 && same, `a forest chunk has ${total} props, the same every time`);
  // None on a track's own ground, or close to it.
  let onTrack = 0, tot = 0;
  for (const a of world.areas.list) {
    for (const [dx, dz] of [[0, 0], [300, -200], [-250, 150]]) {
      const ch = chunkAt(0, a.x + dx, a.z + dz);
      for (const g of buildProps(world, ch, 1)) for (let i = 0; i < g.count; i++) {
        const x = ch.x0 + g.matrices[i * 16 + 12], z = ch.z0 + g.matrices[i * 16 + 14];
        const l = a.toLocal(x, z, { x: 0, z: 0 });
        tot++; if (a.ground.outside(l.x, l.z) < OPEN_WORLD.propClear - 1) onTrack++;
      }
    }
  }
  check(onTrack === 0, `${tot} props round the six tracks, none on a track or within ${OPEN_WORLD.propClear} m of one`);
  // Nothing stands where it should not: every prop the world places, over the
  // whole of every landmark (the home runway and the six tracks), at the finest
  // level, none on the runway or its verge, none in a track's tube or hard against
  // it, none in the sea, and every prop a track brings itself stands on the ground
  // or on the track.
  {
    const hm = OPEN_WORLD.home, hf = world.hf, f = { along: 0, across: 0 };
    const sweep = (cx, cz, radius, fn) => {
      const seen = new Set();
      for (let z = cz - radius; z <= cz + radius; z += 256) for (let x = cx - radius; x <= cx + radius; x += 256) {
        const ch = chunkAt(0, x, z);
        const key = ch.ix + ',' + ch.iz;
        if (seen.has(key)) continue;
        seen.add(key);
        for (const g of buildProps(world, ch, 1)) for (let i = 0; i < g.count; i++) {
          fn(KINDS[g.kind], ch.x0 + g.matrices[i * 16 + 12], ch.z0 + g.matrices[i * 16 + 14]);
        }
      }
      return seen.size;
    };
    let n = 0, onStrip = 0, inVerge = 0;
    const chunks = sweep(hm.x, hm.z + hm.length / 2, 2600, (k, x, z) => {
      n++;
      hf.homeFrame(x, z, f);
      if (Math.abs(f.across) <= hm.width / 2 + 15 && f.along >= -30 && f.along <= hm.length + 30) onStrip++;
      if (Math.abs(f.across) <= hm.width / 2 + hm.clearSide - 1 && f.along >= -hm.clearEnd + 1 && f.along <= hm.length + hm.clearEnd - 1) inVerge++;
    });
    check(n > 1000 && onStrip === 0 && inVerge === 0, `the home runway: ${n} props round it in ${chunks} chunks, none on the strip, none within ${hm.clearSide} m of its edge or ${hm.clearEnd} m past its ends`);

    for (const a of world.areas.list) {
      let tot = 0, inTube = 0, close = 0, wet = 0, onHome = 0;
      sweep(a.x, a.z, a.radius + 1500, (k, x, z) => {
        tot++;
        const l = a.toLocal(x, z, { x: 0, z: 0 });
        const o = a.ground.outside(l.x, l.z);
        if (o <= 0) inTube++; else if (o < OPEN_WORLD.propClear - 1) close++;
        if (hf.height(x, z) < 0.5) wet++;
        if (hf.inHomeClear(x, z)) onHome++;
      });
      // The track's own scenery, against the ground the aircraft would meet.
      const mesh = new TrackMesh(a.track, { ground: false });
      const w = { x: 0, z: 0 };
      let own = 0, off = 0;
      for (const m of mesh.propMeshes) {
        const mat = m.instanceMatrix.array;
        for (let i = 0; i < m.count; i++) {
          const lx = mat[i * 16 + 12], ly = mat[i * 16 + 13], lz = mat[i * 16 + 14];
          a.toWorld(lx, lz, w);
          own++;
          const d = ly + a.dy - hf.height(w.x, w.z);
          // On the ground, or on the road's own structure (a lamp on a bridge
          // deck or its parapet: close to the road and at its height).
          if (Math.abs(d) > 3.5 && a.ground.outside(lx, lz) > 0) {
            const t = a.track;
            let best = 1e9, bi = 0;
            for (let k = 0; k < t.count; k++) {
              const q = Math.hypot(t.px[k] - lx, t.pz[k] - lz);
              if (q < best) { best = q; bi = k; }
            }
            if (!(best < 20 && Math.abs(ly - t.py[bi]) < 3)) off++;
          }
        }
      }
      check(tot > 300 && inTube === 0 && close === 0 && wet === 0 && onHome === 0 && off === 0,
        `${a.id.padEnd(20)} ${tot} world props and ${own} of its own: none in the tube, hard against it, in the sea or on the runway; ${off} of its own off the ground`);
    }
  }
  // Thinned by level.
  const lo = buildProps(world, chunkAt(2, forest.x + 1700, forest.z + 300), 1).reduce((s, g) => s + g.count, 0);
  const fine = buildProps(world, chunkAt(0, forest.x + 1700, forest.z + 300), 1).reduce((s, g) => s + g.count, 0);
  check(buildProps(world, chunkAt(3, 0, 0), 1).length === 0 && lo / 16 < fine, `props thin out with distance (${fine} in a 512 m chunk, ${(lo / 16).toFixed(0)} per 512 m at level 2, none from level ${OPEN_WORLD.propLevels})`);
}

// --- areas ----------------------------------------------------------------------------------------------
console.log('\nTrack areas');
{
  const list = world.areas.list;
  check(list.length === trackData.length, `${list.length} tracks, ${list.length} areas`);
  let landOk = true, boundsOk = true, spaced = true, fromHome = true;
  for (const a of list) {
    if (a.base < 3 || world.hf.base(a.x, a.z) < 3) landOk = false;
    if (Math.abs(a.x) + a.reach > OPEN_WORLD.size / 2 || Math.abs(a.z) + a.reach > OPEN_WORLD.size / 2) boundsOk = false;
    const d = Math.hypot(a.x - OPEN_WORLD.home.x, a.z - OPEN_WORLD.home.z);
    if (d < OPEN_WORLD.areaFromHome[0] || d > OPEN_WORLD.areaFromHome[1]) fromHome = false;
    for (const o of list) if (o !== a && Math.hypot(a.x - o.x, a.z - o.z) < a.reach + o.reach + OPEN_WORLD.areaMinSpacing - 1) spaced = false;
  }
  check(landOk && boundsOk && spaced && fromHome, 'every area is on land, inside the map, clear of the others and of the home field');
  for (const a of list) {
    console.log(`        ${a.id.padEnd(20)} ${a.biome.padEnd(7)} ${(Math.hypot(a.x, a.z) / 1000).toFixed(1).padStart(5)} km from home, base ${a.base.toFixed(0).padStart(5)} m, fit ${a.fit.toFixed(2)}`);
  }
  // Each where its biome wants it.
  const coast = list.find((a) => a.biome === 'coast');
  let sea = false;
  if (coast) for (let k = 0; k < 36 && !sea; k++) for (const r of [900, 1400, 2000, 2800]) {
    if (world.hf.base(coast.x + Math.cos(k / 36 * 6.2832) * r, coast.z + Math.sin(k / 36 * 6.2832) * r) < 0) { sea = true; break; }
  }
  const snow = list.find((a) => a.biome === 'snow');
  check((!coast || sea) && (!snow || snow.base > 500), `the port has the sea within 3 km${snow ? `, the snow area stands at ${snow.base.toFixed(0)} m` : ''}`);
  // Deterministic, and a new track moves none of them.
  const again = new World(trackData);
  let identical = true;
  for (const a of list) { const b = again.areas.byId.get(a.id); if (a.x !== b.x || a.z !== b.z || a.heading !== b.heading || a.base !== b.base) identical = false; }
  check(identical, 'the same placements in a second world');
  const extra = { ...trackData[0], id: 'spike-test-track', name: 'Spike test', world: undefined };
  const seven = new World([...trackData, extra]);
  let unmoved = true;
  for (const a of list) { const b = seven.areas.byId.get(a.id); if (Math.hypot(a.x - b.x, a.z - b.z) > 1e-6) unmoved = false; }
  const e = seven.areas.byId.get('spike-test-track');
  check(unmoved && e && e.placed && e.base >= 3, `a seventh track file is placed (${e ? `${(e.x / 1000).toFixed(1)}, ${(e.z / 1000).toFixed(1)} km` : 'nowhere'}) and the six stay where they were`);
  const hinted = new World([{ ...trackData[0], id: 'hinted', world: { biome: 'desert', placement: { x: 21000, z: -17000, heading: 1 } } }]);
  const ha = hinted.areas.byId.get('hinted');
  check(ha.x === 21000 && ha.z === -17000 && ha.heading === 1, 'a placement hint in a track file is honoured');
  // Inference matches the hints.
  const bad = [];
  for (const d of trackData) {
    const stripped = { ...d, world: undefined };
    if (inferBiome(stripped) !== d.world?.biome) bad.push(`${d.id}: guessed ${inferBiome(stripped)}, says ${d.world?.biome}`);
  }
  check(bad.length === 0, `a biome guessed from the palette, terrain and surfaces matches the hint for all six${bad.length ? ': ' + bad.join('; ') : ''}`);
  // The area's ground frame.
  let frameOk = true;
  const w = { x: 0, z: 0 }, l = { x: 0, z: 0 };
  for (const a of list) {
    for (let k = 0; k < 50; k++) {
      const lx = a.cx + (rnd() - 0.5) * 800, lz = a.cz + (rnd() - 0.5) * 800;
      a.toWorld(lx, lz, w);
      a.toLocal(w.x, w.z, l);
      if (Math.abs(l.x - lx) > 1e-6 || Math.abs(l.z - lz) > 1e-6) frameOk = false;
    }
  }
  check(frameOk, 'world to local and back is the identity in every area');
  // The ground contract on a track's own surface is the track's.
  let onOk = true, road = 0;
  for (const a of list) {
    const t = a.track;
    for (let i = 0; i < t.count; i += 37) {
      a.toWorld(t.px[i], t.pz[i], w);
      const s = world.sample(w.x, w.z, t.py[i] + a.dy + 3);
      const ref = t.sample(t.px[i], t.pz[i], t.py[i] + 3);
      if (Math.abs(s.height - (ref.height + a.dy)) > 1e-6) onOk = false;
      if (s.surface !== ref.surface) onOk = false;
      road++;
    }
  }
  check(onOk, `${road} points on the roads of the six tracks: the world's ground is Track.sample, raised by the area's base`);
}

// --- the floating origin -------------------------------------------------------------------------------------
console.log('\nThe floating origin');
{
  const mock = () => ({ position: { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } }, matrixAutoUpdate: true });
  const o = new WorldOrigin(OPEN_WORLD);
  const items = [];
  for (let k = 0; k < 400; k++) {
    const obj = mock();
    const abs = { x: (rnd() - 0.5) * 120000, y: rnd() * 3000, z: (rnd() - 0.5) * 120000 };
    items.push({ obj, abs, item: o.add(obj, abs.x, abs.y, abs.z) });
  }
  const manual = mock(); manual.matrixAutoUpdate = false; let updated = 0;
  manual.updateMatrix = () => { updated++; };
  const mi = o.add(manual, 1234.5, 6, -4321.25);
  let cam = { x: -55000, z: -50000 }, worstErr = 0, worstCam = 0, worstNear = 0, moved = 0;
  for (let k = 0; k < 6000; k++) {
    cam.x += 8.9; cam.z += 17.3;             // about 11 km every 1000 frames
    if (o.update(cam.x, cam.z)) moved++;
    worstCam = Math.max(worstCam, Math.abs(cam.x - o.ox), Math.abs(cam.z - o.oz));
    if (k % 50 === 0) {
      for (const it of items) {
        worstErr = Math.max(worstErr, Math.abs(it.obj.position.x + o.ox - it.abs.x), Math.abs(it.obj.position.z + o.oz - it.abs.z), Math.abs(it.obj.position.y - it.abs.y));
        const dx = it.abs.x - cam.x, dz = it.abs.z - cam.z;
        if (Math.abs(dx) < 2000 && Math.abs(dz) < 2000) worstNear = Math.max(worstNear, Math.abs(it.obj.position.x), Math.abs(it.obj.position.z));
      }
    }
  }
  check(moved > 20 && worstErr < 1e-3, `${moved} rebases over ${f1((cam.x + 55000 + cam.z + 50000) / 1000)} km: every object's absolute position held to ${(worstErr * 1000).toExponential(1)} mm`);
  check(worstCam <= OPEN_WORLD.rebase + 1e-9 && worstNear < OPEN_WORLD.rebase * 2 + 1, `the camera is never more than ${worstCam.toFixed(0)} m from the origin, and nothing within 2 km of it is drawn past ${worstNear.toFixed(0)} m (limit ${OPEN_WORLD.rebase * 2} m)`);
  check(updated > 0 && mi.obj === manual, 'an object that is not updated every frame is told when it moves');
  // The same flight, with the origin moving and not, is the same flight: the physics never sees it.
  const fly = (rebaseEvery) => {
    const p = new H.AircraftPhysics(F22);
    const sp = world.spawn();
    p.reset({ x: sp.x + 4000, y: 3500, z: sp.z - 9000, heading: 0.3, pitch: 0.02, speed: 230, fuel: 0.6, throttle: 0.8, gear: 0 });
    const inp = H.makeInput({ analog: false });
    const org = new WorldOrigin(OPEN_WORLD);
    const probe = mock(); org.add(probe, p.x, p.y, p.z);
    for (let i = 0; i < 120 * 60; i++) {
      inp.roll = Math.sin(i * 0.002) * 0.4; inp.pitch = Math.sin(i * 0.0013 + 1) * 0.25 + (3500 - p.y) * 0.00005;
      p.step(DT, inp, world);
      p.abFuel = 1;
      if (rebaseEvery && i % rebaseEvery === 0) org.rebaseTo(Math.round(p.x / 1000) * 1000, Math.round(p.z / 1000) * 1000);
      else if (!rebaseEvery) org.update(p.x, p.z);
    }
    return { p, org };
  };
  const a = fly(0), b = fly(97);
  const same = a.p.x === b.p.x && a.p.y === b.p.y && a.p.z === b.p.z && a.p.qx === b.p.qx && a.p.qw === b.p.qw && a.p.fuel === b.p.fuel;
  check(same && b.org.rebases > 5, `a minute of F-22 flight over the world with ${b.org.rebases} forced rebases is bit-identical to one with ${a.org.rebases} natural ones`);
}

// --- the cars on the tracks ---------------------------------------------------------------------------------
console.log('\nAI cars: state, recording and hand-over');
{
  const keyEvery = OPEN_WORLD.keyEvery;
  let allExact = true, probesDone = 0, worstPose = 0, worstWrap = 0, worstLap = 0, lapsOk = true, rounds = 0, recMs = 0;
  for (const data of trackData) {
    const track = new Track(data);
    let line = new RacingLine(track);
    for (let k = 0; k < 3; k++) {
      const o = OPPONENTS[(k * 2 + 1 + data.id.length) % OPPONENTS.length];
      const ch = getChassis(o.chassis);
      const style = { name: o.name, ...o.style };
      const car = new AmbientCar(track, line, ch, style, k, 3, keyEvery);
      const t0 = performance.now();
      for (const _ of car.record(900)) { /* a slice at a time, as the streamer does */ }
      recMs += performance.now() - t0;
      if (!car.ready) { lapsOk = false; console.log(`        ${data.id} ${o.name}: did not record`); continue; }
      worstWrap = Math.max(worstWrap, car.wrap.distance);
      worstLap = Math.max(worstLap, car.lapTime);
      rounds++;
      // The uninterrupted car, and a fresh one handed over at seeded times.
      const mkSame = () => { const c = new AmbientCar(track, line, ch, style, k, 3, keyEvery); c.period = car.period; c.keys = car.keys; c.pose = car.pose; c.ready = true; return c; };
      const ref = mkSame();
      ref.goLive(0);
      const probes = new Set();
      while (probes.size < 12) probes.add(1 + Math.floor(rnd() * (car.period - 2)));
      const test = mkSame();
      for (let n = 1; n < car.period; n++) {
        ref.step();
        if (!probes.has(n)) continue;
        test.goLive(n);
        const a1 = ref.physics.copyState(), a2 = test.physics.copyState();
        const d1 = ref.driver.copyState(), d2 = test.driver.copyState();
        probesDone++;
        if (!a1.every((v, i) => Object.is(v, a2[i])) || !d1.every((v, i) => Object.is(v, d2[i]))) allExact = false;
        // The replay's pose at this step against the live car's.
        const c = ((n % car.period) + 1) * POSE;
        worstPose = Math.max(worstPose, Math.hypot(car.pose[c] - ref.physics.x, car.pose[c + 1] - ref.physics.y, car.pose[c + 2] - ref.physics.z));
        // And ten seconds on, still the same.
        if (n < car.period - 1300 && probesDone % 4 === 0) {
          const r2 = mkSame(); r2.goLive(n);
          const r3 = mkSame(); r3.goLive(n);
          for (let s = 0; s < 1200; s++) { r2.step(); r3.step(); }
          const x1 = r2.physics.copyState(), x2 = r3.physics.copyState();
          if (!x1.every((v, i) => Object.is(v, x2[i]))) allExact = false;
          // and equal to the uninterrupted car ten seconds later
          const mid = mkSame(); mid.goLive(0); for (let s = 0; s < n + 1200; s++) mid.step();
          const x3 = mid.physics.copyState();
          if (!x1.every((v, i) => Object.is(v, x3[i]))) allExact = false;
        }
      }
    }
  }
  check(lapsOk && rounds === trackData.length * 3, `${rounds} laps recorded (${(recMs / rounds).toFixed(0)} ms each, longest lap ${worstLap.toFixed(0)} s)`);
  check(allExact, `${probesDone} hand-overs from replay to live at seeded times across ${trackData.length} tracks: the car's whole state, and its driver's, equal an uninterrupted run to the last bit, now and ten seconds on`);
  check(worstPose < 0.001, `the pose the replay shows is the live car's to ${(worstPose * 1000).toFixed(3)} mm`);
  check(worstWrap < 1, `the replay's loop closes within ${worstWrap.toFixed(2)} m (it only loops where nobody is looking)`);
  // State round trip: a car loaded from its own state and stepped matches the one that kept going.
  const track = new Track(trackData[4]), line = new RacingLine(track), ch = getChassis('porsche-911');
  const mk = () => { const p = new VehiclePhysics(ch), d = new AIDriver(track, line, ch, { name: 't' }); const i0 = track.startSample; const sp = track.spawnAt(i0, 0, line.offset[i0]); p.reset(sp.x, track.sample(sp.x, sp.z, sp.y).height + ch.suspensionRest, sp.z, sp.yaw); return { p, d }; };
  const a = mk(), b = mk();
  for (let n = 0; n < 3000; n++) a.p.step(DT, a.d.update(DT, a.p), track);
  b.p.loadState(a.p.copyState()); b.d.loadState(a.d.copyState());
  for (let n = 0; n < 3000; n++) { a.p.step(DT, a.d.update(DT, a.p), track); b.p.step(DT, b.d.update(DT, b.p), track); }
  check(a.p.copyState().every((v, i) => Object.is(v, b.p.copyState()[i])) && a.p.copyState().length === STATE_LENGTH,
    `copyState then loadState on a fresh car, then 3,000 steps: identical (${STATE_LENGTH} numbers of physics state)`);
}

console.log('\nAI cars in the world');
{
  const cars = new AmbientCars(world, OPEN_WORLD);
  const area = world.areas.byId.get('pine-ridge');
  const streamer = new Streamer();
  streamer.add(cars.jobFor(area));
  check(cars.jobFor(area) === null, 'a track\'s cars are made once');
  let frames = 0, worstFrame = 0;
  while (streamer.busy && frames < 5000) { const t0 = performance.now(); streamer.run(OPEN_WORLD.chunkBudgetMs); worstFrame = Math.max(worstFrame, performance.now() - t0); frames++; }
  const st = cars.byArea.get(area.id);
  check(st.status === 'ready' && st.cars.length === OPEN_WORLD.cars, `${st.cars.length} cars made in ${frames} frames of ${OPEN_WORLD.chunkBudgetMs} ms (the longest piece was ${worstFrame.toFixed(0)} ms: the racing line, which is one piece)`);
  const w = { x: 0, z: 0 };
  // Far: all replayed. Move the camera next to one: it goes live, and the others
  // stay replayed. Walk away: it goes back.
  for (let s = 0; s < 1500; s++) cars.fixedStep();
  cars.update(area.x + 20000, area.z);
  const farLive = cars.liveCount;
  area.toWorld(st.cars[0].physics.x, st.cars[0].physics.z, w);
  const target = { x: w.x, z: w.z };
  cars.update(target.x + 50, target.z);
  const nearLive = cars.liveCount, liveHere = st.cars[0].live;
  for (let s = 0; s < 600; s++) cars.fixedStep();
  cars.update(target.x + 20000, target.z);
  check(farLive === 0 && nearLive >= 1 && liveHere && cars.liveCount === 0,
    `far: ${farLive} live; within ${OPEN_WORLD.liveRadius} m of one: ${nearLive} live; far again: ${cars.liveCount}`);
}

// --- the F-22 over the world ----------------------------------------------------------------------------------
console.log('\nFlying over the world');
{
  const sp = world.spawn();
  const t = new H.AircraftPhysics(F22);
  t.reset({ x: sp.x, y: sp.y + 1.6, z: sp.z, heading: 0, fuel: 0.6, gear: 1, throttle: 1 });
  const ti = H.makeInput({ gearDown: true, ab: true });
  let liftoff = -1, liftSpeed = 0, rollDist = 0, lifted = false, tailStrike = false, minAgl = 1e9;
  for (let i = 0; i < 120 * 40; i++) {
    const time = i * DT, cas = t.cas / H.KT;
    ti.pitch = cas > 125 && t.y - sp.y < 60 ? Math.max(0, Math.min(0.5, ((lifted ? 0.17 : 0.14) - t.attitude().pitch) * 4)) : 0;
    ti.yaw = Math.max(-1, Math.min(1, -t.x * 0.05 - t.vx * 0.3));
    if (t.gear.hullHit > 0) tailStrike = true;
    if (liftoff < 0 && !t.onGround && t.y - sp.y > 3) { liftoff = time; liftSpeed = cas; rollDist = t.z - sp.z; lifted = true; }
    if (t.y - sp.y > 60) ti.gearDown = false;
    t.step(DT, ti, world);
    if (liftoff > 0) minAgl = Math.min(minAgl, t.y - world.height(t.x, t.z));
  }
  check(liftoff > 0 && liftSpeed > 110 && liftSpeed < 200 && rollDist < OPEN_WORLD.home.length - 600 && !tailStrike && !t.crashed,
    `takes off from the home runway in afterburner: lifts off at ${f1(liftSpeed)} kt after ${rollDist.toFixed(0)} m of ${OPEN_WORLD.home.length}, no tail strike`);
  check(t.y - sp.y > 500 && minAgl > 3, `and climbs away over the land (${(t.y - sp.y).toFixed(0)} m up after 40 s, never below ${minAgl.toFixed(0)} m of ground)`);
  // It rests on the runway.
  const r = new H.AircraftPhysics(F22);
  r.reset({ x: sp.x, y: sp.y + 1.9, z: sp.z, heading: 0, fuel: 0.6, gear: 1 });
  const ri = H.makeInput({ gearDown: true, analog: true });
  for (let i = 0; i < 120 * 8; i++) r.step(DT, ri, world);
  check(Math.abs(r.vy) < 0.01 && r.y - sp.y > 1.45 && r.y - sp.y < 1.7 && !r.crashed, `rests on its gear on the runway at ${(r.y - sp.y).toFixed(2)} m, as on the test field`);
}

// --- the sky ------------------------------------------------------------------------------------------------------------
console.log('\nSky and fog');
{
  const { Sky } = await import(SRC + 'render/Sky.js');
  const { worldEnvironment } = await import(SRC + 'render/WorldMesh.js');
  const sky = new Sky();
  const env = worldEnvironment(OPEN_WORLD);
  sky.setTrack(env, OPEN_WORLD.sunDirection);
  const before = Float32Array.from(sky._paint.geo.attributes.color.array);
  sky.setHorizon(0xd9c9a8);
  const moved = sky._paint.geo.attributes.color.array.some((v, i) => Math.abs(v - before[i]) > 1e-3);
  sky.setHorizon(env.palette.fog);
  let worst = 0;
  const now = sky._paint.geo.attributes.color.array;
  for (let i = 0; i < now.length; i++) worst = Math.max(worst, Math.abs(now[i] - before[i]));
  check(moved && worst < 1e-6, `recolouring the dome's horizon and back gives the dome it was (worst ${worst.toExponential(1)})`);
}

// --- the world as Three.js objects, for a minute of flight -------------------------------------------------------------------
console.log('\nThe world as objects');
{
  const { WorldMesh } = await import(SRC + 'render/WorldMesh.js');
  const wm = new WorldMesh(world, OPEN_WORLD);
  wm.chunks.prime(0, 500, -2000, 0, 1, wm.drawRange);
  let x = 0, y = 600, z = -2000;
  const cam = { x, y, z }, fwd = { x: 0, z: 1 };
  let threw = null, worstMs = 0, rebased = 0, visibleOk = true, maxCalls = 0;
  try {
    for (let k = 0; k < 60 * 45; k++) {
      z += 250 / 60; x += 90 / 60; y = 600 + 200 * Math.sin(k / 300);
      cam.x = x; cam.y = y; cam.z = z;
      const t0 = performance.now();
      if (wm.update(cam, fwd, 0.5, 1 / 60)) rebased++;
      worstMs = Math.max(worstMs, performance.now() - t0);
      if (k % 30 === 0) {
        for (const c of wm.chunks.drawList) if (!c.mesh || !c.mesh.mesh.visible) visibleOk = false;
        let calls = 0;
        wm.root.traverse((o) => { if (o.isMesh && o.visible) calls++; });
        maxCalls = Math.max(maxCalls, calls);
      }
    }
  } catch (e) { threw = e; console.log(e.stack); }
  const info = wm.info();
  check(!threw, `45 s of flight through WorldMesh.update ran without a fault (${rebased} rebases, ${info.chunksDrawn} chunks drawn, ${info.areasBuilt} track meshes built)`);
  check(visibleOk, 'every chunk the tree wants is a visible mesh');
  console.log(`        worst frame of world work ${worstMs.toFixed(1)} ms (a car mesh or a track step is a few ms); up to ${maxCalls} visible meshes`);
  wm.dispose();
}

console.log(failed ? '\nWORLD CHECK FAILED' : '\nWORLD CHECK PASSED');
process.exit(failed ? 1 : 0);
