// The sound barrier, seen: rings of condensed air and a sleeve of vapour.
//
// As the aircraft goes up through Mach 1 (SHOCK.mach) a few rings spread out from
// its nose and slide back along it, fading, and for as long as it is in the
// transonic band a cone of vapour wraps the airframe, thickest on the line. Both
// ride in the aircraft's own frame: the chase camera is behind it, and a ring left
// in the air would be behind the camera the instant it was made.
//
// Everything is unlit, translucent and untextured. The soft edges are alpha in
// the vertex colours (a four-component `color` attribute) on a surface of
// revolution, so a ring or the cone fades out along its edge with no texture.
// Pure effect: nothing here reads or changes the physics.

import * as THREE from 'three';
import { ownVapour } from './Materials.js';
import { SHOCK } from '../data/tuning.js';

const SEGMENTS = 64;

// A surface of revolution about +z through profile points { r, z, a }: radius,
// position along the axis, and alpha. White; the material's opacity is the fade.
function revolved(profile) {
  const P = profile.length, S = SEGMENTS;
  const pos = new Float32Array((S + 1) * P * 3);
  const col = new Float32Array((S + 1) * P * 4);
  const index = [];
  for (let s = 0; s <= S; s++) {
    const a = (s / S) * Math.PI * 2, c = Math.cos(a), n = Math.sin(a);
    for (let k = 0; k < P; k++) {
      const v = s * P + k, q = profile[k];
      pos[v * 3] = c * q.r; pos[v * 3 + 1] = n * q.r; pos[v * 3 + 2] = q.z;
      col[v * 4] = 1; col[v * 4 + 1] = 1; col[v * 4 + 2] = 1; col[v * 4 + 3] = q.a;
      if (s < S && k < P - 1) {
        const w = (s + 1) * P + k;
        index.push(v, w, v + 1, w, w + 1, v + 1);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 4));
  g.setIndex(index);
  return g;
}

export class ShockWave {
  // parent: the aircraft's root, so the effect rides with it. noseZ: where the
  // nose is in the aircraft's own axes (+z forward).
  constructor(parent, noseZ = 8.4) {
    this.parent = parent;
    this.noseZ = noseZ;
    this._armed = false;       // until the aircraft has been seen below the rearm number
    this.age = -1;             // seconds since it last fired; -1 is never
    this._geos = [];
    this._mats = [];

    // A ring: a flat band, clear at both edges and solid between them.
    const ringGeo = revolved([{ r: 0.74, z: 0, a: 0 }, { r: 0.9, z: 0, a: 1 }, { r: 1, z: 0, a: 0 }]);
    this._geos.push(ringGeo);
    this.rings = [];
    for (let i = 0; i < SHOCK.rings; i++) {
      const mat = ownVapour();
      this._mats.push(mat);
      const mesh = new THREE.Mesh(ringGeo, mat);
      mesh.visible = false;
      mesh.frustumCulled = false;
      mesh.renderOrder = 5;
      parent.add(mesh);
      this.rings.push(mesh);
    }

    // The sleeve: a unit cone's worth of vapour, apex forward, clear at the apex
    // and at the open rear, thickest a little behind the apex.
    const coneGeo = revolved([{ r: 0, z: 0.5, a: 0 }, { r: 0.42, z: 0.18, a: 1 }, { r: 0.78, z: -0.2, a: 0.7 }, { r: 1, z: -0.5, a: 0 }]);
    this._geos.push(coneGeo);
    this.coneMat = ownVapour();
    this._mats.push(this.coneMat);
    this.cone = new THREE.Mesh(coneGeo, this.coneMat);
    this.cone.visible = false;
    this.cone.frustumCulled = false;
    this.cone.renderOrder = 5;
    this.cone.scale.set(SHOCK.coneRadius, SHOCK.coneRadius, SHOCK.coneLength);
    this.cone.position.z = noseZ - 1.4 - SHOCK.coneLength / 2;
    parent.add(this.cone);
  }

  // Back to quiet (a new start): nothing showing, and it must be seen to be
  // slow before it can fire, so starting the air at Mach 1.4 does not boom.
  reset() {
    this.age = -1;
    this._armed = false;
    for (const r of this.rings) r.visible = false;
    this.cone.visible = false;
  }

  // 1 at the moment of the boom, easing to 0 over about a second: what the
  // camera's shake follows.
  get envelope() { return this.age < 0 ? 0 : Math.exp(-this.age * 4.5); }

  // Once a rendered frame. `flying` is false on the ground, in a wreck and while
  // paused (nothing fires and the vapour clears). Returns true on the frame it fires.
  update(dt, mach, flying, cockpit) {
    let fired = false;
    if (!flying) {
      this._armed = false;
      this.age = -1;
    } else {
      if (mach < SHOCK.rearm) this._armed = true;
      if (this._armed && mach >= SHOCK.mach) {
        this._armed = false;
        this.age = 0;
        fired = true;
      } else if (this.age >= 0) {
        this.age += dt;
      }
    }

    // The rings.
    const life = SHOCK.ringLife;
    for (let i = 0; i < this.rings.length; i++) {
      const ring = this.rings[i];
      const t = this.age - i * SHOCK.ringGap;
      if (this.age < 0 || t < 0 || t > life) { ring.visible = false; continue; }
      const u = t / life;
      const spread = 1 - (1 - u) * (1 - u);
      const radius = SHOCK.ringStart + (SHOCK.ringEnd - SHOCK.ringStart) * spread;
      ring.visible = true;
      ring.scale.set(radius, radius, 1);
      ring.position.z = this.noseZ - 2 - SHOCK.ringTravel * u;
      ring.material.opacity = SHOCK.ringOpacity * Math.pow(1 - u, 1.5) * (1 - 0.22 * i) * (cockpit ? 0.6 : 1);
    }
    if (this.age > life + SHOCK.ringGap * this.rings.length) this.age = -1;

    // The sleeve, while it is in the band: smooth on the line, gone at the edge.
    const near = flying ? Math.max(0, 1 - Math.abs(mach - SHOCK.mach) / SHOCK.coneBand) : 0;
    const e = near * near * (3 - 2 * near);
    this.cone.visible = e > 0.01;
    if (this.cone.visible) this.coneMat.opacity = SHOCK.coneOpacity * e * (cockpit ? 0.35 : 1);
    return fired;
  }

  dispose() {
    for (const r of this.rings) this.parent.remove(r);
    this.parent.remove(this.cone);
    for (const g of this._geos) g.dispose();
    for (const m of this._mats) m.dispose();
  }
}
