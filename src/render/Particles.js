// Dust, gravel and tyre smoke: one pool of chunky cubes, one draw call.
//
// Cubes rather than soft sprites, because this is a world of blocks: a puff of
// smoke here is a handful of pale boxes that swell and tumble, and dust is a
// spray of ground-coloured ones. They are opaque and fade by SHRINKING, which
// needs no transparency sorting and no per-particle opacity, so the whole pool
// costs one instanced draw and nothing else.
//
// Visual only. Emission runs at render time off the interpolated car state and
// never feeds back into the physics.

import * as THREE from 'three';
import { particles as particleMaterial } from './Materials.js';
import { EFFECTS } from '../data/tuning.js';

const M = new THREE.Matrix4();
const E = new THREE.Euler();
const C = new THREE.Color();

export class Particles {
  constructor(parent, capacity = EFFECTS.maxParticles) {
    const n = capacity;
    this.max = n;
    this.parent = parent;
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), particleMaterial(), n);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.setColorAt(0, C.setRGB(1, 1, 1));
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    this.mesh.visible = false;
    // The instances move; the unit cube's own bounds say nothing about them.
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    this.mesh.name = 'particles';
    parent.add(this.mesh);

    const f = () => new Float32Array(n);
    this.x = f(); this.y = f(); this.z = f();
    this.vx = f(); this.vy = f(); this.vz = f();
    this.floor = f();
    this.age = f(); this.life = f();
    this.size = f(); this.grow = f();
    this.rx = f(); this.ry = f(); this.spin = f();
    this.gravity = f(); this.drag = f();
    this.r = f(); this.g = f(); this.b = f();
    this.alive = 0;
    this._recycle = 0;
  }

  // Positional arguments rather than an options object: this is called
  // hundreds of times a second and must not allocate. The colour is linear.
  emit(x, y, z, vx, vy, vz, life, size, grow, r, g, b, gravity, drag, floor) {
    let i;
    if (this.alive < this.max) i = this.alive++;
    else { i = this._recycle; this._recycle = (this._recycle + 1) % this.max; }
    this.x[i] = x; this.y[i] = y; this.z[i] = z;
    this.vx[i] = vx; this.vy[i] = vy; this.vz[i] = vz;
    this.age[i] = 0; this.life[i] = Math.max(0.05, life);
    this.size[i] = size; this.grow[i] = grow;
    this.rx[i] = Math.random() * Math.PI; this.ry[i] = Math.random() * Math.PI;
    this.spin[i] = (Math.random() - 0.5) * 6;
    this.gravity[i] = gravity; this.drag[i] = drag;
    this.r[i] = r; this.g[i] = g; this.b[i] = b;
    this.floor[i] = floor;
  }

  clear() {
    this.alive = 0;
    this.mesh.count = 0;
    this.mesh.visible = false;
  }

  // dt 0 holds everything where it is, for the pause screen.
  update(dt) {
    let n = this.alive;
    if (dt > 0) {
      let i = 0;
      while (i < n) {
        const age = this.age[i] + dt;
        if (age >= this.life[i]) { n--; this._copy(n, i); continue; }
        this.age[i] = age;
        const damp = Math.exp(-this.drag[i] * dt);
        this.vx[i] *= damp;
        this.vz[i] *= damp;
        this.vy[i] = this.vy[i] * damp - this.gravity[i] * dt;
        this.x[i] += this.vx[i] * dt;
        this.y[i] += this.vy[i] * dt;
        this.z[i] += this.vz[i] * dt;
        // Chips land and stay landed rather than falling through the road.
        if (this.y[i] < this.floor[i]) {
          this.y[i] = this.floor[i];
          this.vy[i] = 0;
          this.vx[i] *= 0.5;
          this.vz[i] *= 0.5;
          this.spin[i] *= 0.4;
        }
        this.ry[i] += this.spin[i] * dt;
        i++;
      }
      this.alive = n;
      this._recycle %= Math.max(1, n);
    }

    const mesh = this.mesh;
    for (let i = 0; i < n; i++) {
      const t = this.age[i] / this.life[i];
      // Swell quickly, then hold, then shrink away over the last 40%.
      const grow = 1 + (this.grow[i] - 1) * (1 - (1 - t) * (1 - t));
      const fade = t > 0.6 ? 1 - (t - 0.6) / 0.4 : 1;
      const s = this.size[i] * grow * fade;
      E.set(this.rx[i], this.ry[i], 0);
      M.makeRotationFromEuler(E);
      const e = M.elements;
      e[0] *= s; e[1] *= s; e[2] *= s;
      e[4] *= s; e[5] *= s; e[6] *= s;
      e[8] *= s; e[9] *= s; e[10] *= s;
      e[12] = this.x[i]; e[13] = this.y[i] + s * 0.5; e[14] = this.z[i];
      mesh.setMatrixAt(i, M);
      mesh.setColorAt(i, C.setRGB(this.r[i], this.g[i], this.b[i]));
    }
    mesh.count = n;
    mesh.visible = n > 0;
    if (n > 0) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.needsUpdate = true;
    }
  }

  _copy(from, to) {
    if (from === to) return;
    for (const a of [this.x, this.y, this.z, this.vx, this.vy, this.vz, this.floor, this.age,
      this.life, this.size, this.grow, this.rx, this.ry, this.spin, this.gravity, this.drag,
      this.r, this.g, this.b]) a[to] = a[from];
  }

  dispose() {
    this.parent.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.dispose();
  }
}
