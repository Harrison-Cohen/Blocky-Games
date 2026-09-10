// Headlights for the other cars on a night track.
//
// Every real light costs every lit pixel on screen, so seven opponents with a
// beam each would cost as much as half the lamp pool again. But you only ever
// see the beams of the few cars near you, so -- the same idea as TrackLights --
// a fixed handful of spot lights is handed each frame to the cars nearest the
// camera. The rest still have lit lenses; they just are not lighting the road
// somewhere you cannot see.
//
// The player's own headlights are not part of this: they belong to the
// player's car and cast shadows.

import * as THREE from 'three';
import { GRAPHICS } from '../data/tuning.js';

const HERE = new THREE.Vector3();
const AIM = new THREE.Vector3();

export class HeadlightPool {
  constructor(scene) {
    this.scene = scene;
    this.lights = [];
    this._order = [];
    this._from = new THREE.Vector3();
    this._cmp = (a, b) =>
      a.vehicle.root.position.distanceToSquared(this._from) - b.vehicle.root.position.distanceToSquared(this._from);
  }

  // A fixed count per track, so the shaders never recompile mid-race.
  setCount(n) {
    while (this.lights.length > n) {
      const l = this.lights.pop();
      this.scene.remove(l);
      this.scene.remove(l.target);
      l.dispose();
    }
    while (this.lights.length < n) {
      const l = new THREE.SpotLight(GRAPHICS.headlightColor, 0, GRAPHICS.headlightRange,
        GRAPHICS.headlightAngle, GRAPHICS.headlightPenumbra, GRAPHICS.headlightDecay);
      l.castShadow = false;
      this.scene.add(l);
      this.scene.add(l.target);
      this.lights.push(l);
    }
  }

  // cars: anything with a `vehicle`. After the cars' visuals are updated.
  update(cars, cameraPosition) {
    const n = this.lights.length;
    if (!n) return;
    const order = this._order;
    order.length = 0;
    for (const c of cars) order.push(c);
    this._from.copy(cameraPosition);
    order.sort(this._cmp);
    for (let k = 0; k < n; k++) {
      const l = this.lights[k];
      const c = order[k];
      if (!c) { l.intensity = 0; continue; }
      const v = c.vehicle;
      v.root.updateMatrixWorld(true);
      v.body.localToWorld(HERE.set(0, v.headlamp.y, v.headlamp.z));
      v.body.localToWorld(AIM.set(0, v.headlamp.y - GRAPHICS.headlightDrop, v.headlamp.z + 20));
      l.position.copy(HERE);
      l.target.position.copy(AIM);
      l.target.updateMatrixWorld();
      l.intensity = GRAPHICS.headlightIntensity;
    }
  }

  dispose() { this.setCount(0); }
}
