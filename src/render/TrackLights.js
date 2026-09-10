// Real lights for the lamps along a track.
//
// A night circuit has a lamp every 30 m down both sides, which is a hundred or
// more of them. Every real light in the scene costs every lit pixel on screen
// another evaluation, so a hundred lights is not a thing any GPU does at frame
// rate -- but you can only ever see the pools of light near you, and the fog
// takes the rest.
//
// So the track declares WHERE its lights are (TrackMesh collects them from the
// prop specs), and this keeps a fixed pool of real spot lights and hands them
// each frame to the lamps nearest the point the camera is looking at. The pool
// is a fixed size so the shaders never recompile mid-lap, and the lamp at the
// edge of the pool is faded by how close it is to being swapped out, so a pool
// of light never pops on or off as you drive toward it: it rises out of the
// dark, which is what a lamp coming round a corner looks like anyway.
//
// A lamp's light is a cone pointing down at the road. Its falloff is gentler
// than the physical inverse square (GRAPHICS.lampDecay): at 2, a lamp strong
// enough to light the middle of the road turned anything that passed close
// under it white. The road under it is lit; the road between two lamps is as
// dark as the night around it.

import * as THREE from 'three';
import { GRAPHICS } from '../data/tuning.js';

export class TrackLights {
  constructor(scene) {
    this.scene = scene;
    this.pool = [];
    this.anchors = [];
    this._order = [];
    this._dist = new Float64Array(0);
    this._cmp = (a, b) => this._dist[a] - this._dist[b];
  }

  // anchors: [{ x, y, z, tx, ty, tz, color, intensity, range, angle, penumbra }]
  setTrack(anchors) {
    for (const l of this.pool) {
      this.scene.remove(l);
      this.scene.remove(l.target);
      l.dispose();
    }
    this.pool = [];
    this.anchors = anchors || [];
    for (const a of this.anchors) a.colorObj = new THREE.Color(a.color);

    const n = Math.min(GRAPHICS.lightPool, this.anchors.length);
    for (let k = 0; k < n; k++) {
      const l = new THREE.SpotLight(0xffffff, 0, 30, 1, 0.5, GRAPHICS.lampDecay);
      l.castShadow = false;
      this.scene.add(l);
      this.scene.add(l.target);
      this.pool.push(l);
    }
    this._order = this.anchors.map((_, i) => i);
    this._dist = new Float64Array(this.anchors.length);
  }

  // Hand the pool to the lamps nearest (x, y, z).
  update(x, y, z) {
    const n = this.pool.length;
    if (!n) return;
    const A = this.anchors;
    const dist = this._dist;
    for (let i = 0; i < A.length; i++) {
      const a = A[i];
      const dx = a.x - x, dy = a.y - y, dz = a.z - z;
      dist[i] = dx * dx + dy * dy + dz * dz;
    }
    this._order.sort(this._cmp);

    // The distance of the nearest lamp that did NOT make the pool. Everything
    // fades out as it approaches that, so the swap happens at zero brightness.
    const cut = A.length > n ? Math.sqrt(dist[this._order[n]]) : Infinity;
    const band = cut * GRAPHICS.lightFade;
    for (let k = 0; k < n; k++) {
      const i = this._order[k];
      const a = A[i];
      const l = this.pool[k];
      const d = Math.sqrt(dist[i]);
      let fade = 1;
      if (cut !== Infinity) {
        fade = Math.min(1, Math.max(0, (cut - d) / band));
        fade *= fade;
      }
      l.position.set(a.x, a.y, a.z);
      l.target.position.set(a.tx, a.ty, a.tz);
      l.target.updateMatrixWorld();
      l.color.copy(a.colorObj);
      l.intensity = a.intensity * GRAPHICS.lampIntensity * fade;
      l.distance = a.range;
      l.angle = a.angle;
      l.penumbra = a.penumbra;
    }
  }

  dispose() {
    this.setTrack([]);
  }
}
