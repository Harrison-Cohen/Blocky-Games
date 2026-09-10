// Sky: a graded dome, the sun or the moon, stars and clouds.
//
// A flat clear colour is the one thing in the frame that looks like a
// placeholder, and on a daylight track it is a third of the screen. Everything
// here is generated and none of it is a texture:
//
//   dome    a sphere with a colour per vertex, graded from the FOG colour at the
//           horizon -- so the terrain fades into the sky with no seam -- up to
//           the track's own zenith colour, with a warm haze around the sun.
//   disc    the sun, or on a night track the moon, along the same direction the
//           track's directional light comes from, so what you see in the sky is
//           what is casting the shadows. Brighter than white, so it blooms.
//   stars   points of fixed pixel size, above the horizon only.
//   clouds  chunky flat-shaded boxes, lit by the same sun and fill as the rest
//           of the world, drifting on the wind. Smooth cars, chunky world, and
//           the sky is part of the world.
//
// The dome, disc and stars follow the camera, because they are infinitely far
// away. The clouds do not: they are fixed in the world so they have parallax,
// and they are placed far enough out to never be inside the fog.
//
// All of it comes from the track's `sky` block. See copper-flats.js.

import * as THREE from 'three';
import { GRAPHICS } from '../data/tuning.js';
import { flat, unlit, skyDome, stars } from './Materials.js';

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const HOR = new THREE.Color();
const TOP = new THREE.Color();
const SUN = new THREE.Color();
const OUT = new THREE.Color();

export class Sky {
  constructor() {
    this.group = new THREE.Group();       // dome, disc, stars: follow the camera
    this.cloudGroup = new THREE.Group();  // world-fixed
    this.clouds = null;
    this._owned = [];                     // geometries to dispose on a track swap
  }

  setTrack(track, sunDir) {
    this._clear();
    const data = track.data;
    const p = track.palette;
    const cfg = data.sky || {};
    const R = GRAPHICS.skyRadius;

    const sl = Math.hypot(sunDir.x, sunDir.y, sunDir.z) || 1;
    const sx = sunDir.x / sl, sy = sunDir.y / sl, sz = sunDir.z / sl;

    // --- dome ---------------------------------------------------------------
    HOR.setHex(p.fog ?? p.sky);
    if (cfg.top !== undefined) TOP.setHex(cfg.top);
    else TOP.setHex(p.sky).multiplyScalar(0.7);
    SUN.setHex(cfg.hazeColor ?? p.sun ?? 0xffffff);
    const haze = cfg.haze ?? 0.25;
    const curve = cfg.gradient ?? 0.5;

    const geo = new THREE.SphereGeometry(R, 72, 36);
    const pos = geo.attributes.position;
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) / R, y = pos.getY(i) / R, z = pos.getZ(i) / R;
      const t = Math.pow(Math.max(0, y), curve);
      OUT.copy(HOR).lerp(TOP, t);
      // Haze around the sun. The wide part is held down to the horizon, where
      // the air is thickest: a low sun sets the whole horizon glowing, a high
      // one leaves the sky above it blue with only a bright core round the
      // disc. Spreading it evenly washed a noon sky out to white.
      const s = Math.max(0, x * sx + y * sy + z * sz);
      const low = Math.pow(1 - Math.max(0, y), 3);
      const glow = haze * (Math.pow(s, 6) * 0.8 * low + Math.pow(s, 64) * 1.2);
      OUT.r += SUN.r * glow; OUT.g += SUN.g * glow; OUT.b += SUN.b * glow;
      col[i * 3] = OUT.r; col[i * 3 + 1] = OUT.g; col[i * 3 + 2] = OUT.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const dome = new THREE.Mesh(geo, skyDome());
    dome.frustumCulled = false;
    dome.renderOrder = -10;
    this._add(dome, geo);

    // --- sun or moon --------------------------------------------------------
    if (cfg.disc !== false && sy > -0.02) {
      const size = cfg.discSize ?? 0.03;
      const dg = new THREE.SphereGeometry(R * size, 24, 12);
      const disc = new THREE.Mesh(dg,
        unlit(cfg.discColor ?? p.sun ?? 0xffffff, { fog: false, glow: cfg.discGlow ?? 6 }));
      disc.position.set(sx * R * 0.9, sy * R * 0.9, sz * R * 0.9);
      disc.frustumCulled = false;
      disc.renderOrder = -9;
      this._add(disc, dg);
    }

    // --- stars --------------------------------------------------------------
    if (cfg.stars) {
      const rand = rng(0x57a125);
      // Two layers: many dim ones, a few just bright enough to catch the bloom.
      // Sizes are in render-target pixels, so they stay small at any
      // resolution; bigger, and a bloomed star reads as a snowflake.
      for (const [share, size, glow] of [[0.88, 1.0, 0.55], [0.12, 1.6, 1.15]]) {
        const n = Math.round(cfg.stars * share);
        const sp = new Float32Array(n * 3);
        let k = 0;
        while (k < n) {
          const u = rand() * 2 - 1, a = rand() * Math.PI * 2;
          const r = Math.sqrt(1 - u * u);
          const y = Math.abs(u);
          if (y < 0.06) continue;
          sp[k * 3] = Math.cos(a) * r * R * 0.95;
          sp[k * 3 + 1] = y * R * 0.95;
          sp[k * 3 + 2] = Math.sin(a) * r * R * 0.95;
          k++;
        }
        const sg = new THREE.BufferGeometry();
        sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
        const pts = new THREE.Points(sg, stars(cfg.starColor ?? 0xdfe6f2, size, glow));
        pts.frustumCulled = false;
        pts.renderOrder = -9;
        this._add(pts, sg);
      }
    }

    // --- clouds -------------------------------------------------------------
    if (cfg.clouds) this._buildClouds(track, cfg);
  }

  _buildClouds(track, cfg) {
    const mm = track.minimap;
    const cx = (mm.minX + mm.maxX) / 2;
    const cz = (mm.minZ + mm.maxZ) / 2;
    const rand = rng(0xc10d5);
    const base = track.groundLevel + (cfg.cloudHeight ?? 260);
    // Outside the fog, or the fog swallows them; inside the dome, or the dome
    // hides them. Both bounds follow from the numbers rather than being picked.
    const fogFar = track.data.fog?.far ?? 500;
    const inner = Math.max(fogFar * 0.6, 280);
    const outer = GRAPHICS.skyRadius * 0.72;
    this._cloudSpan = outer;
    this._cloudCentre = { x: cx, z: cz };

    const boxes = [];
    for (let c = 0; c < cfg.clouds; c++) {
      const a = rand() * Math.PI * 2;
      const r = inner + rand() * (outer - inner);
      const x = cx + Math.cos(a) * r;
      const z = cz + Math.sin(a) * r;
      const y = base + rand() * 110;
      const scale = 0.7 + rand() * 1.1;
      const puffs = 3 + Math.floor(rand() * 5);
      for (let k = 0; k < puffs; k++) {
        boxes.push({
          cloud: c,
          ox: (rand() - 0.5) * 120 * scale,
          oy: rand() * 14 * scale,
          oz: (rand() - 0.5) * 70 * scale,
          w: (40 + rand() * 60) * scale,
          h: (10 + rand() * 12) * scale,
          d: (26 + rand() * 40) * scale,
          x, y, z,
        });
      }
    }
    const geo = new THREE.BoxGeometry(1, 1, 1);
    // Lit like the rest of the world, plus some light of their own. From the
    // ground you only ever see a cloud's underside, and in a world with one sun
    // and a hemisphere fill that face gets nothing but the ground-bounce colour
    // -- which on a desert is brown, and turned every cloud into a floating
    // slab of rock. Real clouds are lit from below by the sky, and this is that.
    const colour = cfg.cloudColor ?? 0xf4f4ef;
    const mesh = new THREE.InstancedMesh(geo,
      flat(colour, { fog: false, emissive: colour, glow: cfg.cloudGlow ?? 0.55 }), boxes.length);
    mesh.frustumCulled = false;
    this.clouds = { mesh, boxes, m: new THREE.Matrix4(), wind: cfg.wind ?? 4 };
    this._placeClouds(0);
    this.cloudGroup.add(mesh);
    this._owned.push(geo);
  }

  // Drift the whole field along +x, wrapping each cloud back round to the far
  // side once it has gone past the edge, so the sky never empties.
  _placeClouds(dt) {
    const c = this.clouds;
    const span = this._cloudSpan;
    const cx = this._cloudCentre.x;
    const m = c.m;
    for (let i = 0; i < c.boxes.length; i++) {
      const b = c.boxes[i];
      if (dt) {
        b.x += c.wind * dt;
        if (b.x - cx > span) b.x -= span * 2;
      }
      m.makeScale(b.w, b.h, b.d);
      m.setPosition(b.x + b.ox, b.y + b.oy, b.z + b.oz);
      c.mesh.setMatrixAt(i, m);
    }
    c.mesh.instanceMatrix.needsUpdate = true;
  }

  update(cameraPosition, dt) {
    this.group.position.copy(cameraPosition);
    if (this.clouds && dt > 0) this._placeClouds(dt);
  }

  _add(obj, geometry) {
    this.group.add(obj);
    this._owned.push(geometry);
  }

  _clear() {
    for (const o of [...this.group.children]) this.group.remove(o);
    for (const o of [...this.cloudGroup.children]) this.cloudGroup.remove(o);
    for (const g of this._owned) g.dispose();
    this._owned = [];
    this.clouds = null;
  }
}
