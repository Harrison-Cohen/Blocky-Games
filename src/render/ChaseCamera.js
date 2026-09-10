// Spring-damped chase camera.
//
// Runs at render time on the interpolated car state, not on the physics step,
// so it stays smooth at any refresh rate. The exponential smoothing below is
// frame-rate independent by construction: a naive lerp by (k * dt) is not.
//
// The lag is the point. A camera welded to the car reads as slow; one that
// trails slightly and widens its field of view is what sells speed.

import * as THREE from 'three';
import { CAMERA } from '../data/tuning.js';
import { bodyLift } from '../game/CarBuilder.js';

export const CAMERA_MODES = ['Chase', 'Cockpit', 'Far chase'];

// Frame-rate independent approach: fraction of the remaining distance to close
// per second, expressed as a rate.
function smoothTo(current, target, rate, dt) {
  return current + (target - current) * (1 - Math.exp(-rate * dt));
}

// Shared, never written to: applyAxisAngle only reads its axis. Allocating a
// Vector3 here allocated one every frame, in the cockpit view, forever.
const UP = new THREE.Vector3(0, 1, 0);

export class ChaseCamera {
  constructor(camera) {
    this.camera = camera;
    this.mode = 0;
    this.pos = new THREE.Vector3(0, 5, -10);
    this.look = new THREE.Vector3();
    this.fov = CAMERA.fovMin;

    this._idealPos = new THREE.Vector3();
    this._idealLook = new THREE.Vector3();
    this._initialized = false;
  }

  cycle() {
    this.mode = (this.mode + 1) % CAMERA_MODES.length;
    this._initialized = false; // snap rather than sweep across the car
    return CAMERA_MODES[this.mode];
  }

  get modeName() {
    return CAMERA_MODES[this.mode];
  }

  // state:   interpolated render state from VehiclePhysics.interpolate()
  // speed:   current speed in m/s
  // chassis: the car being driven. Needed for its top speed, so the FOV ramp
  //          means the same thing in every car, and for its body box, which
  //          the cockpit eye position is derived from.
  update(state, speed, chassis, dt) {
    const speedFrac = Math.min(speed / Math.max(chassis.topSpeed, 1), 1);
    const sinY = Math.sin(state.yaw), cosY = Math.cos(state.yaw);

    if (this.mode === 1) {
      // Cockpit. Rigid to the body, so pitch and roll are felt directly.
      // The eye is placed from this chassis's own dimensions: high in the cab
      // of the truck, down in the tub of the open wheeler.
      const eyeY = bodyLift(chassis) + CAMERA.cockpitLift + chassis.bodyHeight * CAMERA.cockpitHeightFrac;
      const eyeZ = chassis.bodyLength * CAMERA.cockpitForwardFrac;
      const px = state.x + eyeZ * sinY;
      const pz = state.z + eyeZ * cosY;
      // Positive pitch is nose UP in the model, so the eye -- ahead of the
      // centre of mass -- rises with it, and the view tips up the hill with the
      // car rather than down into it.
      const sinP = Math.sin(state.pitch);
      const eyeWorldY = state.y + eyeY + eyeZ * sinP;
      this._idealPos.set(px, eyeWorldY, pz);
      this._idealLook.set(
        px + sinY * 12,
        eyeWorldY + sinP * 12 + 0.4,
        pz + cosY * 12
      );
      this.pos.copy(this._idealPos);
      this.look.lerp(this._idealLook, 1 - Math.exp(-24 * dt));
      this.camera.position.copy(this.pos);
      this.camera.up.set(Math.sin(state.roll), Math.cos(state.roll), 0)
        .applyAxisAngle(UP, state.yaw);
      this.camera.lookAt(this.look);
    } else {
      const far = this.mode === 2 ? CAMERA.farMultiplier : 1;
      const distance = (CAMERA.distance + CAMERA.speedPullback * speedFrac) * far;
      const height = (CAMERA.height - CAMERA.speedDrop * speedFrac) * far;

      // Sit behind the car along its heading.
      this._idealPos.set(
        state.x - sinY * distance,
        state.y + height,
        state.z - cosY * distance
      );
      // Look into the corner: the target is pushed ahead of the car, more so
      // the faster it is going.
      const ahead = CAMERA.lookAhead * speedFrac;
      this._idealLook.set(
        state.x + sinY * ahead,
        state.y + 0.9,
        state.z + cosY * ahead
      );

      if (!this._initialized) {
        this.pos.copy(this._idealPos);
        this.look.copy(this._idealLook);
        this._initialized = true;
      } else {
        const k = CAMERA.positionSpring * CAMERA.positionDamping;
        this.pos.x = smoothTo(this.pos.x, this._idealPos.x, k, dt);
        this.pos.y = smoothTo(this.pos.y, this._idealPos.y, k * 1.6, dt);
        this.pos.z = smoothTo(this.pos.z, this._idealPos.z, k, dt);
        this.look.x = smoothTo(this.look.x, this._idealLook.x, CAMERA.lookSpring, dt);
        this.look.y = smoothTo(this.look.y, this._idealLook.y, CAMERA.lookSpring, dt);
        this.look.z = smoothTo(this.look.z, this._idealLook.z, CAMERA.lookSpring, dt);
      }

      this.camera.position.copy(this.pos);
      this.camera.up.set(0, 1, 0);
      this.camera.lookAt(this.look);
    }

    // FOV rises with speed. Smoothed so it never snaps on a gear-change-like
    // speed jump.
    const targetFov = CAMERA.fovMin + (CAMERA.fovMax - CAMERA.fovMin) * speedFrac;
    this.fov = smoothTo(this.fov, targetFov, CAMERA.fovSpring, dt);
    if (Math.abs(this.camera.fov - this.fov) > 0.01) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }
  }
}
