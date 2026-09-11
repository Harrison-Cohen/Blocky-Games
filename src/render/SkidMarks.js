// Skid marks: rubber laid on the road by a sliding tyre.
//
// One mesh, one draw call, as a ring of quads. Each sliding wheel extends its
// own strip a segment at a time; when the ring is full the oldest segment is
// overwritten, so the cost is fixed however long a session runs. A mark holds
// full strength for EFFECTS.skidLife and then fades out over skidFade, by a
// per-vertex alpha rewritten a few times a second rather than every frame.
//
// Laid at the road's own height under each point, from the same ground query
// the physics uses, so a mark follows the banking and the crests, and on a
// crossover it sits on the road the car was on, not the one above or below.

import * as THREE from 'three';
import { skidMarks as skidMaterial } from './Materials.js';
import { EFFECTS } from '../data/tuning.js';

const LIFT = 0.02;     // metres above the surface; the polygon offset does the rest
const FADE_TICK = 0.2; // seconds between alpha rewrites
const BREAK = 3;       // metres: a jump longer than this is a teleport, not a slide
const C = new THREE.Color();

export class SkidMarks {
  constructor(parent) {
    const n = EFFECTS.maxSkidSegments;
    this.max = n;
    this.parent = parent;
    this.pos = new Float32Array(n * 12);
    this.col = new Float32Array(n * 16);
    const index = n * 4 > 65535 ? new Uint32Array(n * 6) : new Uint16Array(n * 6);
    for (let k = 0; k < n; k++) {
      const v = k * 4, o = k * 6;
      index[o] = v; index[o + 1] = v + 1; index[o + 2] = v + 2;
      index[o + 3] = v + 1; index[o + 4] = v + 3; index[o + 5] = v + 2;
    }
    const geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.colAttr = new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.posAttr);
    geo.setAttribute('color', this.colAttr);
    geo.setIndex(new THREE.BufferAttribute(index, 1));
    geo.setDrawRange(0, 0);
    this.mesh = new THREE.Mesh(geo, skidMaterial());
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    this.mesh.renderOrder = 1;
    this.mesh.name = 'skid-marks';
    parent.add(this.mesh);

    this.birth = new Float32Array(n);
    this.head = 0;
    this.count = 0;
    this.time = 0;
    this._tick = 0;
    this._newest = -Infinity;
    this.trails = new WeakMap();
    C.set(EFFECTS.skidColor);
    this.rgb = [C.r, C.g, C.b];
  }

  clear() {
    this.head = 0;
    this.count = 0;
    this.trails = new WeakMap();
    this.mesh.geometry.setDrawRange(0, 0);
  }

  // One wheel of one car, once a frame. `marking` false lifts the tyre and
  // ends its strip; the next mark starts a fresh one.
  mark(owner, wheel, x, y, z, marking, width) {
    let trails = this.trails.get(owner);
    if (!trails) {
      trails = [0, 1, 2, 3].map(() => ({ on: false, edges: false, x: 0, y: 0, z: 0,
        lx: 0, ly: 0, lz: 0, rx: 0, ry: 0, rz: 0 }));
      this.trails.set(owner, trails);
    }
    const tr = trails[wheel];
    if (!marking) { tr.on = false; return; }
    y += LIFT;
    if (!tr.on) {
      tr.on = true; tr.edges = false;
      tr.x = x; tr.y = y; tr.z = z;
      return;
    }
    const dx = x - tr.x, dz = z - tr.z;
    const d = Math.hypot(dx, dz);
    if (d > BREAK) { tr.edges = false; tr.x = x; tr.y = y; tr.z = z; return; }
    if (d < EFFECTS.skidStep) return;
    // Across the direction of travel, half the tyre's width either side.
    const h = (width * 0.5) / d;
    const px = -dz * h, pz = dx * h;
    if (!tr.edges) {
      tr.lx = tr.x + px; tr.ly = tr.y; tr.lz = tr.z + pz;
      tr.rx = tr.x - px; tr.ry = tr.y; tr.rz = tr.z - pz;
      tr.edges = true;
    }
    const lx = x + px, lz = z + pz, rx = x - px, rz = z - pz;
    this._quad(tr.lx, tr.ly, tr.lz, tr.rx, tr.ry, tr.rz, lx, y, lz, rx, y, rz);
    tr.lx = lx; tr.ly = y; tr.lz = lz;
    tr.rx = rx; tr.ry = y; tr.rz = rz;
    tr.x = x; tr.y = y; tr.z = z;
  }

  _quad(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz) {
    const k = this.head;
    const p = this.pos, o = k * 12;
    p[o] = ax; p[o + 1] = ay; p[o + 2] = az;
    p[o + 3] = bx; p[o + 4] = by; p[o + 5] = bz;
    p[o + 6] = cx; p[o + 7] = cy; p[o + 8] = cz;
    p[o + 9] = dx; p[o + 10] = dy; p[o + 11] = dz;
    const c = this.col, q = k * 16, a = EFFECTS.skidOpacity;
    for (let v = 0; v < 4; v++) {
      c[q + v * 4] = this.rgb[0];
      c[q + v * 4 + 1] = this.rgb[1];
      c[q + v * 4 + 2] = this.rgb[2];
      c[q + v * 4 + 3] = a;
    }
    this.birth[k] = this.time;
    this._newest = this.time;
    this.posAttr.addUpdateRange(o, 12);
    this.colAttr.addUpdateRange(q, 16);
    this.posAttr.needsUpdate = true;
    this.colAttr.needsUpdate = true;
    this.head = (k + 1) % this.max;
    if (this.count < this.max) {
      this.count++;
      this.mesh.geometry.setDrawRange(0, this.count * 6);
    }
  }

  update(dt) {
    this.time += dt;
    this._tick += dt;
    if (this._tick < FADE_TICK || this.count === 0) return;
    this._tick = 0;
    const life = EFFECTS.skidLife, fade = EFFECTS.skidFade, op = EFFECTS.skidOpacity;
    // Everything faded and nothing new: empty the ring rather than keep
    // drawing invisible quads.
    if (this.time - this._newest > life + fade) {
      this.head = 0;
      this.count = 0;
      this.mesh.geometry.setDrawRange(0, 0);
      return;
    }
    let changed = false;
    for (let k = 0; k < this.count; k++) {
      const age = this.time - this.birth[k];
      if (age <= life) continue;
      const a = age >= life + fade ? 0 : op * (1 - (age - life) / fade);
      const o = k * 16 + 3;
      if (this.col[o] === a) continue;
      this.col[o] = a; this.col[o + 4] = a; this.col[o + 8] = a; this.col[o + 12] = a;
      changed = true;
    }
    if (changed) {
      this.colAttr.clearUpdateRanges();
      this.colAttr.needsUpdate = true;
    }
  }

  dispose() {
    this.parent.remove(this.mesh);
    this.mesh.geometry.dispose();
  }
}
