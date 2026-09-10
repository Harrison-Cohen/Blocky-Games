// ============================================================================
// TrackMesh
// ----------------------------------------------------------------------------
// Builds every piece of track geometry from a Track. Nothing here is authored
// by hand and nothing is loaded from a file: the road, curbs, barriers, start
// gantry and scenery all come out of the same spline the physics reads.
//
// Draw call budget matters more than triangle count on integrated graphics, so
// everything repeated is an InstancedMesh and every color shares one material
// through render/Materials.js.
//
// The road, curbs, barriers, ground and gantry are a dozen calls between them
// however long the track is. Scenery is what varies: a prop costs one call per
// distinct colour per variant, so a single-colour cactus in three variants is
// three calls and a six-colour container stack in three variants is nine. That
// puts a plain track around 12 and a busy one around 50, which is well inside
// budget -- but it is why `variants` and the length of a colour list are worth
// thinking about, and why parts are merged by colour rather than one per box.
// ============================================================================

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TRACK, WORLD, GRAPHICS } from '../data/tuning.js';
import { flat, unlit } from '../render/Materials.js';

// Value noise on an integer lattice, for the rolling ground beyond the walls.
// Hash-based rather than table-based so it needs no setup and is identical on
// every machine and every load.
function hash2(ix, iz) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function noise2(x, z, cell) {
  const fx = x / cell, fz = z / cell;
  const ix = Math.floor(fx), iz = Math.floor(fz);
  const tx = fx - ix, tz = fz - iz;
  const sx = tx * tx * (3 - 2 * tx);
  const sz = tz * tz * (3 - 2 * tz);
  const a = hash2(ix, iz), b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
  return (a + (b - a) * sx) * (1 - sz) + (c + (d - c) * sx) * sz;
}

// Deterministic RNG so a track looks identical every load. A track that
// reshuffles its scenery on refresh makes it impossible to learn.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export class TrackMesh {
  constructor(track) {
    this.track = track;
    this.group = new THREE.Group();
    this.palette = track.palette;
    // How hilly the world outside the barriers is. A track says this about
    // itself: a container port is flat and a forest hill climb is not, and one
    // global amplitude cannot be both.
    this.terrainAmp = track.data.terrain?.amplitude ?? WORLD.terrainAmplitude;
    this.terrainFade = track.data.terrain?.fade ?? WORLD.terrainFade;

    // World positions of every light a prop declares. The renderer hands its
    // pool of real lights to the nearest of these each frame.
    this.lights = [];

    this._buildGround();
    this._buildRibbon();
    this._buildCurbs();
    this._buildMarkings();
    this._buildBarriers();
    this._buildBridges();
    this._buildStartLine();
    this._buildProps();

    // The track never moves. Three.js otherwise walks this whole subtree every
    // frame recomputing world matrices that cannot have changed, in the main
    // pass and again in the shadow pass. Bake them once and turn that off.
    this.group.updateMatrixWorld(true);
    this.group.traverse((o) => { o.matrixAutoUpdate = false; });
  }

  // Orientation of anything sitting on the road at sample i: X along the
  // banked lateral, Z along the track, Y perpendicular to both.
  _basis(i, m, lateral, heightOffset, sx, sy, sz) {
    const t = this.track;
    const next = (i + 1) % t.count;
    const dy = t.py[next] - t.py[i];
    const f = new THREE.Vector3(t.tx[i], dy / t.ds, t.tz[i]).normalize();
    const l = new THREE.Vector3(t.lx[i], Math.tan(t.banking[i]), t.lz[i]).normalize();
    const u = new THREE.Vector3().crossVectors(f, l);
    m.makeBasis(l, u, f);
    m.scale(new THREE.Vector3(sx, sy, sz));
    m.setPosition(
      t.px[i] + t.lx[i] * lateral + u.x * heightOffset,
      t.heightAtSample(i, lateral) + u.y * heightOffset,
      t.pz[i] + t.lz[i] * lateral + u.z * heightOffset
    );
    return m;
  }

  // ABSOLUTE world height of the ground at a point, outside the barriers.
  //
  // Referenced to the road that happens to be nearest, not to a single ground
  // level for the whole circuit. On a hill climb those differ by sixty metres,
  // and referencing the circuit puts every tree on the ridge down in the
  // valley and every apron on top of a cliff. Far enough out the reference
  // fades to the level of the circuit as a whole, because out there the
  // nearest piece of track changes abruptly as you cross the halfway line
  // between two straights, and a plain that steps when the road does is worse
  // than one that is simply flat.
  //
  // Flat everywhere the car can actually reach: the noise is measured from the
  // outer edge of the graded apron, so hills only start well outside the walls.
  // Scenery uses this too, so props sit ON the ground rather than hovering.
  _terrainHeight(x, z) {
    const t = this.track;
    // Never a bridge deck: the ground under a flyover belongs to whatever runs
    // beneath it, not to the road eight metres overhead.
    const near = t.nearestGroundIndex(x, z);
    const dist = Math.hypot(x - t.px[near], z - t.pz[near]);
    const flatTo = t.barrierLimit(t.halfWidth[near]) + t.apronWidth;
    const out = dist - flatTo;

    const a = Math.min(1, Math.max(0, out / WORLD.terrainSettle));
    const settle = a * a * (3 - 2 * a);
    const base = (t.py[near] - TRACK.vergeDrop) * (1 - settle) + t.groundLevel * settle;

    const amp = this.terrainAmp;
    if (amp <= 0 || out <= 0) return base;
    const f = Math.min(1, out / this.terrainFade);
    const ease = f * f * (3 - 2 * f);

    // Three octaves: broad hills, then ridges, then a little surface break-up.
    const n =
      (noise2(x, z, 620) - 0.5) * 1.0 +
      (noise2(x + 137, z - 91, 260) - 0.5) * 0.45 +
      (noise2(x - 54, z + 218, 95) - 0.5) * 0.16;
    return base + n * amp * ease;
  }

  _buildGround() {
    const t = this.track;
    const mm = t.minimap;
    // Generous, so the edge of the plane is never in shot even from a high
    // camera. Subdivided now, because a single flat quad under a circuit with
    // 22 m of elevation change reads as a toy on a tabletop.
    const pad = 1800;
    const w = (mm.maxX - mm.minX) + pad * 2;
    const d = (mm.maxZ - mm.minZ) + pad * 2;
    const cx = (mm.minX + mm.maxX) / 2;
    const cz = (mm.minZ + mm.maxZ) / 2;

    const segX = Math.max(1, Math.round(w / WORLD.terrainCell));
    const segZ = Math.max(1, Math.round(d / WORLD.terrainCell));
    const g = new THREE.PlaneGeometry(w, d, segX, segZ);
    g.rotateX(-Math.PI / 2);

    // Every vertex is displaced, even on a flat track: _terrainHeight carries
    // the road's own elevation, so this is what keeps the ground under a
    // climbing circuit instead of under the start line.
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + cx;
      const z = pos.getZ(i) + cz;
      pos.setY(i, this._terrainHeight(x, z));
    }
    pos.needsUpdate = true;
    g.computeVertexNormals();

    const mesh = new THREE.Mesh(g, flat(this.palette.ground));
    mesh.position.set(cx, 0, cz);
    mesh.receiveShadow = true;
    this.group.add(mesh);
  }

  _buildRibbon() {
    const t = this.track;
    const n = t.count;
    const edge = TRACK.curbWidth;
    const A = t.apronWidth;

    // Rings of vertices at fixed lateral offsets. Road rings sit at the edges
    // and centre of the tarmac; apron rings hang off the outside and grade down
    // to the surrounding terrain. `road: true` means the offset is a multiple of
    // the LOCAL half width, so the ribbon narrows and widens with the track.
    // The runoff is flat out to the barrier and only grades beyond it, so one
    // ring covers the gravel and the rest are spent on the slope where the
    // shape actually changes. The outermost ring lands exactly where the
    // terrain's flatten-out ends, so ribbon and ground meet with no seam.
    const G = t.barrierGap;
    const outer = [edge + 1.4, edge + G, edge + G + A * 0.15, edge + G + A * 0.45, edge + G + A];
    const rings = [
      ...outer.map((d) => ({ road: false, d: -d })).reverse(),
      { road: true, side: -1 },
      { road: true, side: 0 },
      { road: true, side: 1 },
      ...outer.map((d) => ({ road: false, d })),
    ];
    const R = rings.length;
    const FIRST_ROAD = outer.length;
    const LAST_ROAD = FIRST_ROAD + 2;

    const pos = new Float32Array(n * R * 3);
    for (let i = 0; i < n; i++) {
      const half = t.halfWidth[i];
      for (let r = 0; r < R; r++) {
        const ring = rings[r];
        const lat = ring.road ? ring.side * half : Math.sign(ring.d) * half + ring.d;
        const o = (i * R + r) * 3;
        pos[o] = t.px[i] + t.lx[i] * lat;
        pos[o + 1] = t.heightAtSample(i, lat);
        pos[o + 2] = t.pz[i] + t.lz[i] * lat;
      }
    }

    // Two kinds of index group: the tarmac strip, split by surface name so a
    // mixed-surface track gets a gravel sector you can see, and everything
    // outboard of it drawn as runoff.
    const bySurface = new Map();
    const apronIdx = [];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const onBridge = t.bridge[i] || t.bridge[j];
      for (let r = 0; r < R - 1; r++) {
        // A bridge deck stops at its parapet. Beyond it there is air, and the
        // deck and pillars below are built separately.
        if (onBridge && (r < FIRST_ROAD - 2 || r >= LAST_ROAD + 2)) continue;
        const a = i * R + r, b = i * R + r + 1;
        const c = j * R + r, d = j * R + r + 1;
        let target;
        if (r >= FIRST_ROAD && r < LAST_ROAD) {
          const surface = t.surface[i];
          target = bySurface.get(surface);
          if (!target) { target = []; bySurface.set(surface, target); }
        } else {
          target = apronIdx;
        }
        target.push(a, c, b, b, c, d);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

    // A surface may name its own colour in the palette. Falling back to the
    // runoff colour is what a single-surface track wants; a track with a real
    // gravel SECTOR wants that road to read as a road, not as run-off that the
    // line happens to cross.
    const p = this.palette;
    const surfaceColor = {
      tarmac: p.road,
      gravel: p.gravel ?? p.runoff ?? p.ground,
      grass: p.grass ?? p.ground,
    };
    // A track may lift the road off pure black. MeshLambertMaterial has no
    // specular term, so a night circuit cannot get a wet sheen from a highlight
    // the way the cars do -- and Phong is reserved for the cars. A dark road
    // with a little emissive in it, lit by reflected strips laid under the
    // lamps, sells "wet" in a flat-shaded world better than a highlight would.
    const roadOpts = p.roadGlow ? { emissive: p.roadGlow } : {};
    const materials = [];
    const allIdx = [];
    let start = 0;
    for (const [surface, idx] of bySurface) {
      allIdx.push(...idx);
      geo.addGroup(start, idx.length, materials.length);
      materials.push(flat(surfaceColor[surface] ?? p.road, roadOpts));
      start += idx.length;
    }
    allIdx.push(...apronIdx);
    geo.addGroup(start, apronIdx.length, materials.length);
    materials.push(flat(p.runoff ?? p.ground, roadOpts));

    geo.setIndex(allIdx);
    geo.computeVertexNormals();

    const mesh = new THREE.Mesh(geo, materials);
    mesh.receiveShadow = true;
    this.group.add(mesh);
    this.roadMesh = mesh;
  }

  // Raised curbs down both edges, alternating two colours.
  //
  // One continuous ribbon, not a row of instanced blocks. Blocks were cheaper
  // and they tore themselves apart on every corner: a block is a rectangle and
  // a corner is not, so consecutive blocks spaced along the centreline overlap
  // each other on the INSIDE of the bend, where the arc is shorter. Overlapping
  // coplanar faces z-fight, and the tighter the corner the worse it flickers.
  // Shortening the blocks to fit the inside edge opens gaps of 40% or more on a
  // hairpin, so there is no spacing that works. A ribbon shares its vertices
  // with itself and cannot overlap at all.
  //
  // Cross-section, ordered by increasing lateral so the winding matches the
  // road ribbon and every face ends up pointing outwards: inner bottom, inner
  // top, outer top, outer bottom. The height step is added vertically rather
  // than along the banked normal because roadHeight() adds it vertically too,
  // so what you drive on and what you see are the same surface.
  _buildCurbs() {
    const t = this.track;
    const n = t.count;
    const W = TRACK.curbWidth;
    const H = TRACK.curbHeight;
    const R = 4; // points in the cross-section, per side

    const pos = new Float32Array(n * R * 2 * 3);
    for (let i = 0; i < n; i++) {
      const half = t.halfWidth[i];
      const tan = Math.tan(t.banking[i]);
      // side +1 runs inner -> outer, side -1 runs outer -> inner: both end up
      // ordered by increasing lateral.
      const rings = [
        [[half, 0], [half, H], [half + W, H], [half + W, 0]],
        [[-(half + W), 0], [-(half + W), H], [-half, H], [-half, 0]],
      ];
      for (let sd = 0; sd < 2; sd++) {
        for (let r = 0; r < R; r++) {
          const [lat, lift] = rings[sd][r];
          const o = ((i * 2 + sd) * R + r) * 3;
          pos[o] = t.px[i] + t.lx[i] * lat;
          pos[o + 1] = t.py[i] + lat * tan + lift;
          pos[o + 2] = t.pz[i] + t.lz[i] * lat;
        }
      }
    }

    // Colour blocks alternate every curbSegment metres of arc.
    const stepSamples = Math.max(1, Math.round(TRACK.curbSegment / t.ds));
    const idx = [[], []];
    for (let i = 0; i < n; i++) {
      // A painted curb is a tarmac thing. On a gravel sector there is nothing
      // to paint it on, and a red and white kerb running through the middle of
      // a forest gravel road reads as a mistake rather than as a track.
      if (t.surface[i] !== 'tarmac') continue;
      const j = (i + 1) % n;
      if (t.surface[j] !== 'tarmac') continue;
      const target = idx[Math.floor(i / stepSamples) % 2];
      for (let sd = 0; sd < 2; sd++) {
        const bi = (i * 2 + sd) * R;
        const bj = (j * 2 + sd) * R;
        for (let r = 0; r < R - 1; r++) {
          const a = bi + r, b = bi + r + 1;
          const c = bj + r, d = bj + r + 1;
          target.push(a, c, b, b, c, d);
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const all = [];
    const materials = [];
    const colors = [this.palette.curbA, this.palette.curbB];
    let start = 0;
    this.curbMeshes = [];
    for (let k = 0; k < 2; k++) {
      if (!idx[k].length) continue;
      all.push(...idx[k]);
      geo.addGroup(start, idx[k].length, materials.length);
      materials.push(flat(colors[k]));
      start += idx[k].length;
    }
    if (!materials.length) return;
    geo.setIndex(all);
    geo.computeVertexNormals();

    const mesh = new THREE.Mesh(geo, materials);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);
    this.curbMeshes.push(mesh);
  }

  // Painted lines: a white edge line down both sides of the tarmac, and on a
  // street circuit a dashed centre line. Laid on the road with a polygon offset
  // rather than lifted off it, so they never z-fight the surface underneath at
  // any distance, and they follow the banking because they are built from the
  // same road height function everything else is.
  _buildMarkings() {
    const t = this.track;
    const spec = t.data.markings ?? {};
    if (spec === false) return;
    const n = t.count;
    const W = spec.width ?? 0.22;
    const inset = spec.inset ?? 0.4;
    const dash = Math.max(1, Math.round((spec.dash ?? 3) / t.ds));
    const gap = Math.max(1, Math.round((spec.gap ?? 6) / t.ds));

    const pos = [];
    const idx = [];
    const strip = (latOf, keep) => {
      let prev = -1;
      for (let s = 0; s <= n; s++) {
        const i = s % n;
        if (!keep(i) || t.surface[i] !== 'tarmac') { prev = -1; continue; }
        const [a, b] = latOf(i);
        const base = pos.length / 3;
        for (const lat of [a, b]) {
          pos.push(t.px[i] + t.lx[i] * lat, t.heightAtSample(i, lat) + 0.004, t.pz[i] + t.lz[i] * lat);
        }
        if (prev >= 0) idx.push(prev, base, prev + 1, prev + 1, base, base + 1);
        prev = base;
      }
    };
    if (spec.edge !== false) {
      strip((i) => [t.halfWidth[i] - inset - W, t.halfWidth[i] - inset], () => true);
      strip((i) => [-(t.halfWidth[i] - inset), -(t.halfWidth[i] - inset - W)], () => true);
    }
    if (spec.centre) {
      strip(() => [-W * 0.5, W * 0.5], (i) => i % (dash + gap) < dash);
    }
    if (!idx.length) return;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, flat(this.palette.lines ?? 0xdcdad0, { offset: 2 }));
    mesh.receiveShadow = true;
    this.group.add(mesh);
  }

  // Barriers. The wall's inner face sits exactly on the limit the physics uses,
  // so what stops the car is what you can see stopping it.
  _buildBarriers() {
    const t = this.track;
    const style = this.track.data.barrierStyle || 'wall';
    const seg = TRACK.barrierSegment;
    const stepSamples = Math.max(1, Math.round(seg / t.ds));
    const items = [];
    for (let i = 0; i < t.count; i += stepSamples) {
      const limit = t.barrierLimit(t.halfWidth[i]);
      for (const side of [1, -1]) {
        items.push({ i, lat: side * (limit + TRACK.barrierThickness * 0.5) });
      }
    }

    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mesh = new THREE.InstancedMesh(geo, flat(this.palette.barrier), items.length);
    const m = new THREE.Matrix4();
    // A guardrail is a rail on posts, not a wall: the same stopping line, but
    // you can see past it, which is what makes a street circuit feel enclosed
    // without feeling like a trench. `tires` is a low stack.
    const h = style === 'tires' ? TRACK.barrierHeight * 0.8
      : style === 'guardrail' ? TRACK.barrierHeight * 0.42
      : TRACK.barrierHeight;
    // A wall is sunk slightly into the road; a rail is carried at knee height
    // on posts, so its centre sits higher than half its own height.
    const rail = style === 'guardrail';
    const lift = rail ? TRACK.barrierHeight - h * 0.5 : h * 0.5 - 0.2;
    items.forEach((item, k) => {
      this._basis(item.i, m, item.lat, lift,
        rail ? TRACK.barrierThickness * 0.45 : TRACK.barrierThickness, h, seg * 0.96);
      mesh.setMatrixAt(k, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);
    this.barrierMesh = mesh;

    if (!rail) return;
    // Posts, every other segment. The rail is what stops the car; these are
    // what stop it looking like a floating stripe.
    const postH = TRACK.barrierHeight - h * 0.5;
    const posts = new THREE.InstancedMesh(geo, flat(this.palette.barrier),
      Math.ceil(items.length / 2));
    let n = 0;
    for (let k = 0; k < items.length; k += 2) {
      this._basis(items[k].i, m, items[k].lat, postH * 0.5 - 0.2,
        TRACK.barrierThickness * 0.5, postH + 0.2, TRACK.barrierThickness * 0.5);
      posts.setMatrixAt(n++, m);
    }
    posts.count = n;
    posts.instanceMatrix.needsUpdate = true;
    posts.castShadow = true;
    this.group.add(posts);
  }

  // Bridge decks: where the track data flags a stretch as `bridge`, the road
  // stands on a deck with side walls and an underside instead of an
  // embankment, carried on pairs of pillars down to whatever is below. That is
  // what lets a circuit cross over itself: the embankment a road normally
  // grades into would bury the road it crosses.
  //
  // The deck's cross-section runs right wall top -> right wall bottom -> left
  // wall bottom -> left wall top, so with the same winding as the road ribbon
  // every face points outward: the walls sideways and the underside down.
  _buildBridges() {
    const t = this.track;
    const n = t.count;
    let any = false;
    for (let i = 0; i < n; i++) if (t.bridge[i]) { any = true; break; }
    if (!any) return;

    const depth = 1.6;
    const lip = TRACK.barrierThickness + 0.2;
    const R = 4;
    const pos = new Float32Array(n * R * 3);
    for (let i = 0; i < n; i++) {
      const E = t.barrierLimit(t.halfWidth[i]) + lip;
      const tan = Math.tan(t.banking[i]);
      const ring = [[E, 0], [E, -depth], [-E, -depth], [-E, 0]];
      for (let r = 0; r < R; r++) {
        const [lat, dy] = ring[r];
        const o = (i * R + r) * 3;
        pos[o] = t.px[i] + t.lx[i] * lat;
        pos[o + 1] = t.py[i] + lat * tan + dy;
        pos[o + 2] = t.pz[i] + t.lz[i] * lat;
      }
    }
    const idx = [];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      if (!t.bridge[i] || !t.bridge[j]) continue;
      for (let r = 0; r < R - 1; r++) {
        const a = i * R + r, b = i * R + r + 1;
        const c = j * R + r, d = j * R + r + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const colour = this.palette.bridge ?? this.palette.barrier;
    const deck = new THREE.Mesh(geo, flat(colour));
    deck.castShadow = true;
    deck.receiveShadow = true;
    this.group.add(deck);

    // Pillars, in pairs, standing on the ground beneath. Never on another
    // road: a pillar in the middle of the carriageway underneath is the one
    // thing a flyover must not have.
    const spacing = Math.max(1, Math.round(14 / t.ds));
    const mats = [];
    const m = new THREE.Matrix4();
    for (let i = 0; i < n; i += spacing) {
      if (!t.bridge[i]) continue;
      for (const side of [1, -1]) {
        const lat = side * t.halfWidth[i] * 0.55;
        const x = t.px[i] + t.lx[i] * lat;
        const z = t.pz[i] + t.lz[i] * lat;
        const below = t.nearestGroundIndex(x, z);
        const clear = Math.hypot(x - t.px[below], z - t.pz[below]);
        if (clear < t.barrierLimit(t.halfWidth[below]) + 1.5) continue;
        const top = t.py[i] + lat * Math.tan(t.banking[i]) - depth;
        const foot = this._terrainHeight(x, z) - 1;
        const h = top - foot;
        if (h < 0.5) continue;
        m.makeScale(1.6, h, 1.6);
        m.setPosition(x, foot + h * 0.5, z);
        mats.push(m.clone());
      }
    }
    if (!mats.length) return;
    const pillars = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), flat(colour), mats.length);
    mats.forEach((mm, k) => pillars.setMatrixAt(k, mm));
    pillars.instanceMatrix.needsUpdate = true;
    pillars.castShadow = true;
    pillars.receiveShadow = true;
    this.group.add(pillars);
  }

  _buildStartLine() {
    const t = this.track;
    const i = t.startSample;
    const half = t.halfWidth[i];
    const m = new THREE.Matrix4();

    // Checkered strip: one row of blocks straight across the road.
    const cells = 16;
    const cellW = (half * 2) / cells;
    const light = [];
    const dark = [];
    for (let c = 0; c < cells; c++) {
      const lat = -half + cellW * (c + 0.5);
      (c % 2 ? dark : light).push(lat);
    }
    const geo = new THREE.BoxGeometry(1, 1, 1);
    [[light, 0xedede7], [dark, 0x1b1b1b]].forEach(([lats, color]) => {
      const mesh = new THREE.InstancedMesh(geo, flat(color), lats.length);
      lats.forEach((lat, k) => {
        this._basis(i, m, lat, 0.015, cellW * 0.98, 0.03, 1.5);
        mesh.setMatrixAt(k, m);
      });
      mesh.instanceMatrix.needsUpdate = true;
      this.group.add(mesh);
    });

    // Overhead gantry: two posts and a beam, built from the same basis so it
    // stands square to the road whatever the banking is.
    const gantry = new THREE.Group();
    const postH = 6.2;
    const outer = t.barrierLimit(half) + 1.6;
    const postGeo = new THREE.BoxGeometry(1, 1, 1);
    const steel = flat(this.palette.barrier);
    for (const side of [1, -1]) {
      const post = new THREE.Mesh(postGeo, steel);
      this._basis(i, m, side * outer, postH * 0.5, 0.7, postH, 0.7);
      post.applyMatrix4(m);
      post.castShadow = true;
      gantry.add(post);
    }
    const beam = new THREE.Mesh(postGeo, steel);
    this._basis(i, m, 0, postH - 0.5, outer * 2 + 0.7, 1.0, 0.8);
    beam.applyMatrix4(m);
    beam.castShadow = true;
    gantry.add(beam);

    const stripe = new THREE.Mesh(postGeo, flat(this.palette.curbA));
    this._basis(i, m, 0, postH - 0.5, outer * 2 + 0.75, 0.24, 0.86);
    stripe.applyMatrix4(m);
    gantry.add(stripe);

    this.group.add(gantry);
  }

  // --- scenery -------------------------------------------------------------
  //
  // Scenery is DATA. A prop spec in a track file is a list of boxes with
  // ranged dimensions, and nothing in this file knows what a pine tree or a
  // shipping container is. That is the point: a new track is one file, and a
  // track that wants scenery this file has never heard of is still one file.
  //
  // A spec:
  //   name             labels the prop and seeds its RNG, so it looks the same
  //                    every load. A track you cannot learn is not a track.
  //   variants         how many shapes to roll from the ranges below. Default 3.
  //   parts            the boxes, described below.
  //   place            'scatter' (default) strews it over the terrain outside
  //                    the barriers; 'line' repeats it along the road, square
  //                    to the surface, which is what lamp posts, gantries and
  //                    tunnel sections are.
  //   scatter:         count, minOffset, maxOffset, minScale, maxScale, clearance
  //   line:            spacing, offset, sides, from, to, lift, minScale/maxScale
  //
  // A part:
  //   color            required. `emissive` and `unlit` are optional.
  //   w, h, d          size in metres. A [lo, hi] pair is rolled per variant.
  //                    d defaults to w, which is what a trunk or a rock wants.
  //   x, y, z          offset. y is the box's BOTTOM, so a part stands on the
  //                    ground unless it is told to do otherwise. +x is toward
  //                    the track's left, so a lamp arm reaching over the road
  //                    is mirrored automatically on the other side.
  //   spin             rotation about Y, radians.
  //   repeat           copies stacked upward, each standing on the last.
  //   shrink, taper    per-copy multiplier on width/depth, and on height.
  //   rise             vertical gap between stacked copies.
  //   jitter           random horizontal scatter per copy.
  //
  // Parts sharing a colour and finish merge into one geometry, so a prop costs
  // one draw call per distinct material per variant however many boxes it has.

  // A fixed number passes straight through; a [lo, hi] pair is rolled.
  static _roll(v, rand, dflt = 0) {
    if (v === undefined || v === null) return dflt;
    return Array.isArray(v) ? v[0] + rand() * (v[1] - v[0]) : v;
  }

  // One variant: an array of { part, geometry }, one entry per material.
  // `xFlip` mirrors the shape across the centreline for the other side of the
  // road. It is done here, on the geometry, rather than with a negative scale
  // on the instance: a negative scale flips the winding and the lighting with
  // it, and a lamp post lit from inside out is worse than two geometries.
  _propGeometry(spec, rand, xFlip = 1) {
    const roll = TrackMesh._roll;
    const groups = new Map();
    for (const part of spec.parts) {
      // A list of colours means "one of these, chosen per variant". That is
      // what makes a row of shipping containers a row of different containers
      // rather than the same container forty times.
      const color = Array.isArray(part.color)
        ? part.color[Math.min(part.color.length - 1, Math.floor(rand() * part.color.length))]
        : part.color;
      const key = `${color}|${part.emissive ?? 0}|${part.unlit ? 1 : 0}|${part.glow ?? 1}`;
      let g = groups.get(key);
      if (!g) {
        g = { look: { color, emissive: part.emissive, unlit: part.unlit, glow: part.glow }, boxes: [] };
        groups.set(key, g);
      }

      const copies = Math.max(1, Math.round(roll(part.repeat, rand, 1)));
      let w = roll(part.w, rand, 1);
      let d = part.d === undefined ? w : roll(part.d, rand, 1);
      let h = roll(part.h, rand, 1);
      let y = roll(part.y, rand, 0);
      const x0 = roll(part.x, rand, 0) * xFlip;
      const z0 = roll(part.z, rand, 0);
      const jit = roll(part.jitter, rand, 0);
      for (let k = 0; k < copies; k++) {
        const geo = new THREE.BoxGeometry(Math.abs(w), Math.abs(h), Math.abs(d));
        const spin = roll(part.spin, rand, 0);
        if (spin) geo.rotateY(spin);
        geo.translate(
          x0 + (jit ? (rand() - 0.5) * jit : 0),
          y + h * 0.5,
          z0 + (jit ? (rand() - 0.5) * jit : 0)
        );
        g.boxes.push(geo);
        y += h + roll(part.rise, rand, 0);
        const shrink = roll(part.shrink, rand, 1);
        w *= shrink; d *= shrink;
        h *= roll(part.taper, rand, 1);
      }
    }
    return [...groups.values()].map((g) => ({
      look: g.look,
      geometry: mergeGeometries(g.boxes, false),
    }));
  }

  // Horizontal radius of a variant at scale 1. Props spin about Y, so the
  // footprint is the box corner furthest from the origin in XZ.
  _variantRadius(variant) {
    let r = 0;
    for (const { geometry } of variant) {
      geometry.computeBoundingBox();
      const b = geometry.boundingBox;
      r = Math.max(r, Math.hypot(
        Math.max(Math.abs(b.min.x), Math.abs(b.max.x)),
        Math.max(Math.abs(b.min.z), Math.abs(b.max.z))
      ));
    }
    return r;
  }

  // Strewn over the terrain outside the barriers.
  _scatterMatrices(spec, rand, variants) {
    const t = this.track;
    const buckets = variants.map(() => []);
    const radii = variants.map((v) => this._variantRadius(v));
    const dummy = new THREE.Object3D();
    const margin = spec.clearance ?? TRACK.propClearance;

    let placed = 0;
    let attempts = 0;
    while (placed < spec.count && attempts < spec.count * 30) {
      attempts++;
      const i = Math.floor(rand() * t.count);
      const side = rand() < 0.5 ? 1 : -1;
      const off = side * (spec.minOffset + rand() * (spec.maxOffset - spec.minOffset));
      const x = t.px[i] + t.lx[i] * off + (rand() - 0.5) * 14;
      const z = t.pz[i] + t.lz[i] * off + (rand() - 0.5) * 14;

      // Pick the shape before testing it: clearance depends on how big this
      // particular prop actually is. Testing the centre against a flat margin
      // is what put mesas on the road -- a base slab 20 m across, scaled 2.6x,
      // reaches 26 m from its centre and still passed.
      const v = Math.floor(rand() * variants.length);
      const scale = spec.minScale + rand() * (spec.maxScale - spec.minScale);
      const clearance = radii[v] * scale + margin;

      // The circuit doubles back on itself, so an offset that is clear of one
      // straight can land on another. Reject anything close to any part of the
      // track, not just the piece it was placed from.
      const near = t.nearestIndex(x, z);
      if (Math.hypot(x - t.px[near], z - t.pz[near])
          < t.barrierLimit(t.halfWidth[near]) + clearance) continue;

      dummy.position.set(x, this._terrainHeight(x, z), z);
      dummy.rotation.set(0, rand() * Math.PI * 2, 0);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      buckets[v].push(dummy.matrix.clone());
      placed++;
    }
    return buckets;
  }

  // Repeated along the road on the road's own basis, so it banks and pitches
  // with the surface. `offset` 0 and a part list that spans the full width is
  // a gantry or a tunnel section; `offset` outside the barrier is a lamp post.
  _lineMatrices(spec, rand, variantCount) {
    const t = this.track;
    const buckets = Array.from({ length: variantCount }, () => []);
    const stepSamples = Math.max(1, Math.round((spec.spacing ?? 25) / t.ds));
    const from = Math.round((spec.from ?? 0) / t.ds);
    const to = Math.round((spec.to ?? t.length) / t.ds);
    const sides = spec.sides ?? [1, -1];
    const lift = spec.lift ?? 0;
    const m = new THREE.Matrix4();
    let n = 0;

    for (let k = from; k < to; k += stepSamples, n++) {
      const i = ((k % t.count) + t.count) % t.count;
      // A lamp post or a marker planted beyond the barrier of a bridge deck
      // would be standing on thin air, so line props skip bridges unless the
      // spec says it belongs on one.
      if (t.bridge[i] && !spec.onBridge) continue;
      for (const side of sides) {
        const v = variantCount > 1 ? Math.floor(rand() * variantCount) : 0;
        const s = spec.minScale === undefined
          ? 1
          : spec.minScale + rand() * ((spec.maxScale ?? spec.minScale) - spec.minScale);
        this._basis(i, m, side * (spec.offset ?? 0), lift, s, s, s);
        buckets[v].push({ m: m.clone(), side, n });
      }
    }
    return buckets;
  }

  _buildProps() {
    const specs = this.track.data.props || [];
    this.propMeshes = [];

    for (const spec of specs) {
      if (!spec.parts || !spec.parts.length) continue;
      // Seeded from the spec's own name, so editing one prop list does not
      // reshuffle the scenery of every other prop on the track.
      let seed = 0x5eed;
      for (const ch of spec.name ?? 'prop') seed = (Math.imul(seed, 31) + ch.charCodeAt(0)) >>> 0;
      const rand = rng(seed);
      const nVariants = Math.max(1, spec.variants ?? 3);
      const line = spec.place === 'line';
      // Opted out for frame rate when the budget was integrated graphics.
      // GRAPHICS.propShadows puts them all back.
      const shadow = spec.shadow !== false || GRAPHICS.propShadows;

      // Line props are built once per side so an asymmetric shape can lean in
      // over the road from both sides. Scattered props spin freely, so one set
      // is enough.
      const forSide = new Map();
      const build = (flip) => {
        let set = forSide.get(flip);
        if (!set) {
          set = [];
          for (let v = 0; v < nVariants; v++) set.push(this._propGeometry(spec, rand, flip));
          forSide.set(flip, set);
        }
        return set;
      };
      const base = build(1);

      // One instanced mesh per material per CHUNK of ground, not per track.
      //
      // A single instanced mesh spanning the whole circuit has a bounding
      // sphere that is always in view, so every tree on the track was drawn
      // in every pass: the main view, the ambient occlusion pre-pass, and --
      // worst -- the sun's shadow pass, whose box is only a hundred metres
      // across. Chunked, the renderer culls each piece on its own and the
      // shadow pass draws only the scenery near the car.
      const chunk = GRAPHICS.propChunk;
      const emit = (variant, matrices) => {
        if (!matrices.length) return;
        const cells = new Map();
        for (const m of matrices) {
          const key = `${Math.floor(m.elements[12] / chunk)},${Math.floor(m.elements[14] / chunk)}`;
          let list = cells.get(key);
          if (!list) { list = []; cells.set(key, list); }
          list.push(m);
        }
        for (const { look, geometry } of variant) {
          const mat = look.unlit
            ? unlit(look.color, look.glow ? { glow: look.glow } : {})
            : flat(look.color, look.emissive ? { emissive: look.emissive, glow: look.glow } : {});
          for (const list of cells.values()) {
            const mesh = new THREE.InstancedMesh(geometry, mat, list.length);
            list.forEach((m, k) => mesh.setMatrixAt(k, m));
            mesh.instanceMatrix.needsUpdate = true;
            // Culling tests this, so it has to cover this chunk's instances
            // rather than the one shape at the origin.
            mesh.computeBoundingSphere();
            // Something that gives off light does not also cast a shadow.
            mesh.castShadow = shadow && !look.unlit && !look.emissive;
            mesh.receiveShadow = true;
            this.group.add(mesh);
            this.propMeshes.push(mesh);
          }
        }
      };

      if (line) {
        const buckets = this._lineMatrices(spec, rand, nVariants);
        if (spec.light) this._collectLights(spec, buckets);
        buckets.forEach((list, vi) => {
          for (const flip of [1, -1]) {
            const mine = list.filter((p) => (p.side >= 0 ? 1 : -1) === flip).map((p) => p.m);
            if (!mine.length) continue;
            emit(build(flip)[vi], mine);
          }
        });
      } else {
        this._scatterMatrices(spec, rand, base).forEach((list, vi) => emit(base[vi], list));
      }
    }
  }

  // Where each placement of a line prop puts its light, in world space. `light`
  // is given in the prop's own coordinates, like a part, and mirrored with it
  // for the other side of the road:
  //   x, y, z      where the light is. y is height above the road.
  //   aim          how far toward the road centre the beam leans, metres of
  //                sideways travel per six metres of drop. 0 is straight down.
  //   every        only every nth placement carries a light. A tunnel section
  //                every 4 m does not want a light every 4 m.
  //   color, intensity, range, angle, penumbra   the beam. Intensity is in
  //                candela, with physically correct inverse-square falloff.
  _collectLights(spec, buckets) {
    const L = spec.light;
    const every = Math.max(1, L.every ?? 1);
    const p = new THREE.Vector3();
    const q = new THREE.Vector3();
    for (const list of buckets) {
      for (const { m, side, n } of list) {
        if (n % every) continue;
        const flip = side >= 0 ? 1 : -1;
        const x = (L.x ?? 0) * flip, y = L.y ?? 6, z = L.z ?? 0;
        p.set(x, y, z).applyMatrix4(m);
        q.set(x + (L.aim ?? 0) * flip, y - 6, z).applyMatrix4(m);
        this.lights.push({
          x: p.x, y: p.y, z: p.z, tx: q.x, ty: q.y, tz: q.z,
          color: L.color ?? 0xffc680,
          intensity: L.intensity ?? 100,
          range: L.range ?? 30,
          angle: L.angle ?? 1.0,
          penumbra: L.penumbra ?? 0.6,
        });
      }
    }
  }

  dispose() {
    // Chunks share their geometry, and disposing one twice is harmless.
    this.group.traverse((n) => { if (n.geometry) n.geometry.dispose(); });
  }
}
