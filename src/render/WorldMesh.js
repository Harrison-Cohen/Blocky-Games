// The open world, as Three.js objects.
//
// Everything here is placed through WorldOrigin: chunks, props, the runway and
// each track's frame are registered at an ABSOLUTE position and the origin
// shifts them when the camera has flown 2 km from it. The vertices inside them
// are local to the object (a chunk's are relative to its corner, a track's are in
// the track's own coordinates), so a rebase never rewrites geometry.
//
// What it draws:
//   terrain   the chunks ChunkManager says are wanted, one mesh each, one colour
//             a facet (the `facets` material), from the Heightfield the aircraft
//             also lands on
//   props     trees, rocks, towers: one instanced mesh a kind a chunk
//   the sea   one flat faceted plane that follows the camera
//   the airports  each airport's four meshes (pavement, paint, buildings, lights),
//             built a piece a frame when the camera comes within range
//   the tracks  each area's TrackMesh, built a piece a frame without its own
//             ground (the terrain chunks draw that), under a wrapper that is the
//             area's rigid frame; its scenery is hidden beyond a distance
//   the cars  a Vehicle on each AI car that is near enough to be seen, under
//             the same wrapper, in the track's own coordinates
//
// The build work is a queue of jobs (Streamer) given a few milliseconds a frame.

import * as THREE from 'three';
import { facets, flat, setLampLevel } from './Materials.js';
import { AirportMesh } from './AirportMesh.js';
import { TrackMesh } from '../game/TrackMesh.js';
import { Vehicle } from '../game/Vehicle.js';
import { carAppearance } from '../data/customization.js';
import { ChunkManager } from '../world/Chunks.js';
import { buildProps, KINDS } from '../world/Props.js';
import { Streamer } from '../world/Streamer.js';
import { WorldOrigin } from '../world/WorldOrigin.js';
import { AmbientCars } from '../world/AmbientCars.js';
import { OPEN_WORLD } from '../data/tuning.js';

// What Scene.setEnvironment reads, as a track would give it: the sky, the fog and
// the light, from the world's own settings.
export function worldEnvironment(cfg = OPEN_WORLD, renderDistance = cfg.renderDistance.default, night = false) {
  const half = cfg.size / 2, n = cfg.night;
  return {
    data: {
      id: night ? 'flight-world-night' : 'flight-world',
      sky: night
        ? { top: n.skyTop, haze: 0.04, gradient: 0.45, disc: true, discSize: 0.016, discColor: n.moon, discGlow: 3, stars: n.stars, clouds: 0 }
        : { top: cfg.skyTop, haze: 0.3, gradient: 0.45, disc: true, discSize: 0.022, stars: 0, clouds: 0 },
      fog: { near: renderDistance * cfg.fogNear, far: renderDistance },
      post: { bloom: night ? n.bloom : 0.3, bloomThreshold: 1.0 },
      hemiIntensity: night ? n.hemiIntensity : 1.35,
      sunIntensity: night ? n.sunIntensity : 2.3,
      sunDirection: cfg.sunDirection,
    },
    palette: night
      ? { sky: n.haze, fog: n.haze, ground: n.hemiGround, sun: n.moon, hemiSky: n.hemiSky, hemiGround: n.hemiGround }
      : { sky: cfg.haze, fog: cfg.haze, ground: 0x6f8f56, sun: cfg.sun, hemiSky: 0xbfd9f2, hemiGround: 0x6f8f56 },
    groundLevel: 0,
    minimap: { minX: -half, maxX: half, minZ: -half, maxZ: half },
  };
}

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

function geometryOf(a) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(a.pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(a.nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(a.col, 3));
  return g;
}

export class WorldMesh {
  constructor(world, cfg = OPEN_WORLD) {
    this.world = world;
    this.cfg = cfg;
    this.root = new THREE.Group();
    this.origin = new WorldOrigin(cfg);
    this.streamer = new Streamer();
    this.chunks = new ChunkManager(world, cfg);
    this.chunks.setPropBuilder(buildProps);
    this.chunks.onEvict = (c) => this._freeChunk(c);
    this.ambient = new AmbientCars(world, cfg);

    this.renderDistance = cfg.renderDistance.default;
    this.night = false;               // the night preview (the fog follows it)
    this.detail = cfg.detailDefault;
    this._shown = [];
    this._frame = 0;
    this._propGeo = KINDS.map((k) => geometryOf(k.geometry));
    this._geos = [];
    this.views = new Map();           // area id -> { area, mesh, wrapper, item, propsShown, cars: Map }
    this.airportViews = new Map();    // airport id -> { airport, mesh, gen, group, item }
    this._fogTimer = 0;
    this._fog = new THREE.Color(cfg.haze);
    this._fogTarget = new THREE.Color(cfg.haze);
    this._rgb = [0, 0, 0];
    this._vehicleBudget = 0;

    this._buildWater();
    this.setLights(cfg.airports.lampDay);
    this.setDetail(this.detail);
    this.setRenderDistance(this.renderDistance);
  }

  // --- the fixed things ---------------------------------------------------------------------
  _buildWater() {
    const g = new THREE.PlaneGeometry(1, 1);
    g.rotateX(-Math.PI / 2);
    this._geos.push(g);
    // Past the map's edge, and behind the sea faces the chunks have: the same
    // colour and light as them, and pushed back in depth so it never fights them.
    this.water = new THREE.Mesh(g, flat(this.cfg.sea, { offset: -4 }));
    this.water.frustumCulled = false;
    this.root.add(this.water);
  }

  // --- render distance ----------------------------------------------------------------------------
  // The slider's value, metres. Sets how far chunks are drawn; the fog and the
  // camera follow (see applyEnvironment).
  setRenderDistance(m) {
    const rd = this.cfg.renderDistance;
    this.renderDistance = clamp(m, rd.min, rd.max);
    this.chunks.propScale = clamp(30000 / this.renderDistance, 0.5, 1);
    this.water.scale.set(this.renderDistance * 2.6, 1, this.renderDistance * 2.6);
  }

  // The detail step (OPEN_WORLD.detailSteps): how sharp the ground is in the
  // middle distance, its facets, how many props. Changing the facets or the props
  // drops every chunk built (they were made at the old detail) and returns true:
  // the caller builds the ground again round the camera before the next frame.
  // The resolution and the shadow are the Scene's, and are set by the caller from
  // the same step.
  setDetail(i) {
    const steps = this.cfg.detailSteps;
    this.detail = clamp(Math.round(i), 0, steps.length - 1);
    const s = steps[this.detail];
    return this.chunks.setDetail({ lod: s.lod, cells: s.cells, props: s.props });
  }

  get detailStep() { return this.cfg.detailSteps[this.detail]; }

  get drawRange() { return this.renderDistance * this.cfg.drawMargin; }

  // Fog and the camera's far plane for the current distance; the horizon colour
  // follows the biome you are over. Called every frame.
  applyEnvironment(scene, camAbs, dt) {
    const c = this.cfg;
    scene.setFog(this._fog, this.renderDistance * c.fogNear, this.renderDistance);
    scene.camera.far = this.drawRange + 3000;
    this._fogTimer += dt;
    if (this._fogTimer < c.fogInterval) return;
    const step = this._fogTimer;
    this._fogTimer = 0;
    const h = Math.max(0, this.world.hf.height(camAbs.x, camAbs.z));
    const rgb = this.world.biomes.fogAt(camAbs.x, camAbs.z, h, this._rgb);
    this._fogTarget.set(this.night ? c.night.haze : c.haze);
    // The biome's horizon, a little: sRGB 0-1 to the colour space THREE works in.
    const tint = new THREE.Color().setRGB(rgb[0], rgb[1], rgb[2], THREE.SRGBColorSpace);
    this._fogTarget.lerp(tint, (this.night ? c.night.tint : c.fogTint));
    this._fog.lerp(this._fogTarget, 1 - Math.exp(-step / 2.5));
    scene.sky.setHorizon(this._fog.getHex());
  }

  // --- terrain ------------------------------------------------------------------------------------
  _chunkMesh(chunk) {
    const t = chunk.terrain;
    const g = geometryOf(t);
    // Once on the GPU the arrays are not needed here: a chunk is 160 KB and there
    // are hundreds.
    for (const name of ['position', 'normal', 'color']) {
      g.attributes[name].onUpload(function () { this.array = null; });
    }
    const s = chunk.size;
    const mid = (t.minY + t.maxY) / 2, hh = (t.maxY - t.minY) / 2;
    g.boundingBox = new THREE.Box3(new THREE.Vector3(0, t.minY, 0), new THREE.Vector3(s, t.maxY, s));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(s / 2, mid, s / 2), Math.hypot(s / 2, s / 2, hh));
    const mesh = new THREE.Mesh(g, facets());
    mesh.matrixAutoUpdate = false;
    mesh.receiveShadow = chunk.level <= 1;
    this.root.add(mesh);
    const item = this.origin.add(mesh, chunk.x0, 0, chunk.z0);
    chunk.mesh = { mesh, item, props: null, seen: 0 };
    // CPU copies are not needed either (heights stay, for the physics' sake).
    t.pos = null; t.nor = null; t.col = null;
  }

  _chunkProps(chunk) {
    const cm = chunk.mesh;
    cm.props = [];
    const s = chunk.size;
    for (const grp of chunk.props) {
      const im = new THREE.InstancedMesh(this._propGeo[grp.kind], facets(), grp.count);
      im.instanceMatrix.array.set(grp.matrices);
      im.instanceMatrix.needsUpdate = true;
      im.boundingSphere = new THREE.Sphere(new THREE.Vector3(s / 2, cm.mesh.geometry.boundingSphere.center.y, s / 2),
        s * 0.75 + 140);
      im.matrixAutoUpdate = false;
      im.castShadow = chunk.level === 0;
      im.receiveShadow = true;
      this.root.add(im);
      cm.props.push({ mesh: im, item: this.origin.add(im, chunk.x0, 0, chunk.z0) });
    }
    // The matrices are in the instanced mesh now.
    for (const grp of chunk.props) grp.matrices = null;
  }

  _freeChunk(chunk) {
    const cm = chunk.mesh;
    if (!cm) return;
    this.root.remove(cm.mesh);
    this.origin.remove(cm.item);
    cm.mesh.geometry.dispose();
    if (cm.props) {
      for (const p of cm.props) { this.root.remove(p.mesh); this.origin.remove(p.item); p.mesh.dispose(); }
    }
    chunk.mesh = null;
    chunk.terrain = null;
    chunk.props = null;
  }

  // --- the frame ---------------------------------------------------------------------------------------
  // camAbs: the camera's ABSOLUTE position. fwd: where it looks, horizontally,
  // so the chunks ahead are built first. Returns true if the origin moved (the
  // caller must then place whatever it holds in drawn coordinates again).
  update(camAbs, fwd, alpha, dt) {
    this._frame++;
    const rebased = this.origin.update(camAbs.x, camAbs.z);
    const cfg = this.cfg, ch = this.chunks;

    ch.update(camAbs.x, camAbs.y, camAbs.z, fwd.x, fwd.z, this.drawRange);
    if (ch.requests.length) {
      this.streamer.add({ name: 'chunks', priority: 100, step: () => ch.buildNext() === null });
    }
    this._areaJobs(camAbs);
    this._airportJobs(camAbs);
    this.streamer.run(cfg.chunkBudgetMs);

    // Chunks into meshes, and the ones no longer wanted out of sight.
    const frame = this._frame;
    for (const chunk of ch.drawList) {
      if (!chunk.mesh) this._chunkMesh(chunk);
      const cm = chunk.mesh;
      if (chunk.props && !cm.props) this._chunkProps(chunk);
      cm.seen = frame;
      cm.mesh.visible = true;
      if (cm.props) for (const p of cm.props) p.mesh.visible = true;
    }
    const shown = [];
    for (const chunk of ch.drawList) shown.push(chunk);
    for (const chunk of this._shown) {
      const cm = chunk.mesh;
      if (cm && cm.seen !== frame) {
        cm.mesh.visible = false;
        if (cm.props) for (const p of cm.props) p.mesh.visible = false;
      }
    }
    this._shown = shown;

    // The backdrop sea follows the camera, in drawn coordinates, under the waterline.
    const lx = camAbs.x - this.origin.ox, lz = camAbs.z - this.origin.oz;
    this.water.position.set(lx, -cfg.seaDrop, lz);

    this._areas(camAbs);
    this._airports(camAbs);
    this.ambient.update(camAbs.x, camAbs.z);
    this._cars(camAbs, alpha, dt);
    return rebased;
  }

  // --- airports -----------------------------------------------------------------------------------------
  // How bright the lights are: the day's, or the night's (OPEN_WORLD.airports).
  setLights(level) { setLampLevel(level); }

  // The night preview: the fog follows it, and the lamps are as bright as the
  // night's. (The caller swaps the sky and the light, Scene.setEnvironment.)
  setNight(on) {
    this.night = !!on;
    this.setLights(on ? this.cfg.airports.lampNight : this.cfg.airports.lampDay);
    this._fogTimer = 1e9;
  }

  _airportDistance(a, camAbs) {
    return Math.max(0, Math.hypot(camAbs.x - a.px, camAbs.z - a.pz) - a.radius);
  }

  _airportJobs(camAbs) {
    const k = this.cfg.airports;
    for (const a of this.world.airports.list) {
      if (this.airportViews.has(a.id)) continue;
      if (this._airportDistance(a, camAbs) < k.buildDistance) this._startAirport(a);
    }
  }

  _startAirport(a) {
    const mesh = new AirportMesh(a, this.cfg);
    const view = { airport: a, mesh, gen: mesh.steps(), group: null, item: null };
    this.airportViews.set(a.id, view);
    this.streamer.add({
      name: `airport:${a.id}`, priority: 80,
      step: () => {
        const r = view.gen.next();
        if (r.done) this._airportBuilt(view);
        return r.done;
      },
    });
  }

  _airportBuilt(view) {
    const a = view.airport;
    view.group = view.mesh.group;
    this.root.add(view.group);
    view.item = this.origin.add(view.group, a.x, a.base, a.z);
  }

  // Build, now, every airport within `range` metres of (x, z): what a start needs
  // so it never begins on bare ground. With `ms` it stops after about that long
  // and returns false; call it again to carry on (true: all built).
  primeAirports(x, z, range, ms = Infinity) {
    const t0 = performance.now();
    for (const a of this.world.airports.list) {
      if (Math.max(0, Math.hypot(x - a.px, z - a.pz) - a.radius) > range) continue;
      if (!this.airportViews.has(a.id)) this._startAirport(a);
      const view = this.airportViews.get(a.id);
      if (view.group) continue;
      this.streamer.remove(`airport:${a.id}`);
      let r = view.gen.next();
      while (!r.done) {
        if (performance.now() - t0 > ms) return false;
        r = view.gen.next();
      }
      this._airportBuilt(view);
    }
    return true;
  }

  _airports(camAbs) {
    const k = this.cfg.airports;
    for (const view of [...this.airportViews.values()]) {
      if (this._airportDistance(view.airport, camAbs) > k.buildDistance * 1.4) this._dropAirport(view);
    }
  }

  _dropAirport(view) {
    this.streamer.remove(`airport:${view.airport.id}`);
    if (view.group) { this.root.remove(view.group); this.origin.remove(view.item); }
    view.mesh.dispose();
    this.airportViews.delete(view.airport.id);
  }

  // --- track areas ---------------------------------------------------------------------------------------
  _distanceToArea(a, camAbs) {
    return Math.max(0, Math.hypot(camAbs.x - a.x, camAbs.z - a.z) - a.radius);
  }

  _areaJobs(camAbs) {
    const cfg = this.cfg;
    for (const a of this.world.areas.list) {
      const d = this._distanceToArea(a, camAbs);
      if (!this.views.has(a.id) && d < cfg.trackBuildDistance) this._startArea(a);
      // The cars are made once the camera is a little way off from being able to
      // see them, so the 50 ms of racing line is not paid in front of one.
      if (d < cfg.meshRadius + 6000) {
        const job = this.ambient.jobFor(a);
        if (job) this.streamer.add(job);
      }
    }
  }

  _startArea(a) {
    const mesh = new TrackMesh(a.track, { ground: false, defer: true });
    const view = { area: a, mesh, wrapper: null, item: null, propsShown: true, cars: new Map() };
    this.views.set(a.id, view);
    const gen = mesh.steps();
    this.streamer.add({
      name: `track:${a.id}`, priority: 50,
      step: () => {
        const r = gen.next();
        if (r.done) this._areaBuilt(view);
        return r.done;
      },
    });
  }

  _areaBuilt(view) {
    const a = view.area;
    const wrapper = new THREE.Group();
    wrapper.rotation.y = a.heading;
    wrapper.matrixAutoUpdate = false;
    wrapper.add(view.mesh.group);
    this.root.add(wrapper);
    view.wrapper = wrapper;
    view.item = this.origin.add(wrapper, a.wrapperX, a.dy, a.wrapperZ);
  }

  _areas(camAbs) {
    const cfg = this.cfg;
    for (const view of [...this.views.values()]) {
      if (!view.wrapper) continue;
      const d = this._distanceToArea(view.area, camAbs);
      if (d > cfg.trackBuildDistance * 1.4) { this._dropArea(view); continue; }
      const near = d < cfg.trackPropDistance;
      if (near !== view.propsShown) {
        view.propsShown = near;
        for (const m of view.mesh.propMeshes) m.visible = near;
      }
    }
  }

  _dropArea(view) {
    for (const [car, v] of view.cars) v.dispose(view.wrapper);
    view.cars.clear();
    this.root.remove(view.wrapper);
    this.origin.remove(view.item);
    view.mesh.dispose();
    this.views.delete(view.area.id);
  }

  // --- cars -----------------------------------------------------------------------------------------------------
  _cars(camAbs, alpha, dt) {
    const cfg = this.cfg;
    const w = { x: 0, z: 0 };
    let made = 0;
    for (const view of this.views.values()) {
      if (!view.wrapper) continue;
      const st = this.ambient.byArea.get(view.area.id);
      if (!st || st.status !== 'ready') continue;
      for (const car of st.cars) {
        view.area.toWorld(car.physics.x, car.physics.z, w);
        const d = Math.hypot(w.x - camAbs.x, w.z - camAbs.z);
        let v = view.cars.get(car);
        // A car mesh costs 4-17 ms to build, so it is built well before it can be
        // seen (one a frame), kept while its track is, and only shown when near.
        if (!v) {
          if (d < cfg.meshRadius + 6000 && made < 1) {
            v = new Vehicle(car.chassis, carAppearance(car.spec.car));
            // The mesh reads the car's own physics: the recording's pose or the live car.
            v.physics = car.physics;
            v.root.visible = false;
            view.wrapper.add(v.root);
            view.cars.set(car, v);
            made++;
          } else continue;
        }
        const show = d < cfg.meshRadius;
        if (show !== v.root.visible) v.root.visible = show;
        if (show) v.updateVisual(alpha, dt);
      }
    }
  }

  // --- what is happening, for the tests and the look script ------------------------------------------------------
  info() {
    let tris = 0, props = 0, built = 0;
    for (const c of this.chunks.drawList) tris += c.terrain ? c.terrain.tris : 0;
    for (const c of this.chunks.drawList) if (c.props) for (const g of c.props) props += g.count || 0;
    for (const v of this.views.values()) if (v.wrapper) built++;
    return {
      chunksDrawn: this.chunks.drawList.length, chunksCached: this.chunks.chunks.size,
      tris, props, detail: this.detail, cells: this.chunks.cells,
      pending: this.chunks.requests.length, streamerMs: this.streamer.lastMs, jobs: this.streamer.jobs.length,
      areasBuilt: built, airportsBuilt: [...this.airportViews.values()].filter((v) => v.group).length,
      rebases: this.origin.rebases, carsLive: this.ambient.liveCount,
      originX: this.origin.ox, originZ: this.origin.oz,
    };
  }

  dispose() {
    for (const c of [...this.chunks.chunks.values()]) this._freeChunk(c);
    for (const v of [...this.views.values()]) if (v.wrapper) this._dropArea(v);
    for (const v of [...this.airportViews.values()]) this._dropAirport(v);
    for (const g of this._propGeo) g.dispose();
    for (const g of this._geos) g.dispose();
  }
}
