// The flight camera: chase, cockpit, far orbit, and free look on top of each.
//
// The cars' ChaseCamera is built around a yaw-only car and a chassis; an
// aircraft pitches through the vertical and rolls upside down, so this one
// follows the aircraft's full orientation instead.
//
//   chase    behind and above, the heading smoothed so it lags into a turn and
//            swings round in a loop. The offset is smoothed in the aircraft's
//            own frame, never in the world, or the camera would trail a
//            supersonic aircraft by hundreds of metres.
//   cockpit  the pilot's eye, welded to the airframe.
//   orbit    far behind, free to be swung round.
//
// Free look turns the view: round the aircraft in chase and orbit, in place
// from the cockpit.

import * as THREE from 'three';
import { FLIGHT_CAMERA, SHOCK } from '../data/tuning.js';

export const FLIGHT_CAMERA_MODES = ['Chase', 'Cockpit', 'Far orbit'];

const UP = new THREE.Vector3(0, 1, 0);
const _q = new THREE.Quaternion();
const _f = new THREE.Vector3();
const _u = new THREE.Vector3();
const _r = new THREE.Vector3();
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _target = new THREE.Vector3();
const _eulerQ = new THREE.Quaternion();

export class FlightCamera {
  constructor(camera) {
    this.camera = camera;
    // The settings, held on the camera so a test can bring it in close.
    this.cfg = FLIGHT_CAMERA;
    this.mode = 0;
    this.qs = new THREE.Quaternion();          // the smoothed orientation
    this.offset = new THREE.Vector3(0, FLIGHT_CAMERA.height, -FLIGHT_CAMERA.distance);
    this.fov = FLIGHT_CAMERA.fovMin;
    this.punch = 0;                // degrees of jolt on the field of view, easing to 0
    this._init = false;
    this.groundFn = null;   // (x, z) in scene coordinates -> ground height, or null
    this._shake = 0;
    this._t = 0;
  }

  cycle() {
    this.mode = (this.mode + 1) % FLIGHT_CAMERA_MODES.length;
    this.reset();
  }

  get name() { return FLIGHT_CAMERA_MODES[this.mode]; }

  reset() { this._init = false; this._offsetInit = false; }

  // state: the aircraft's render state (x, y, z, qx..qw) in scene coordinates.
  // speed m/s, agl metres above the ground, look {x, y}, shake 0..1,
  // eye [x,y,z] the pilot's eye in body axes, groundY the ground height under
  // the camera (to keep it out of the terrain).
  update(state, speed, agl, look, shake, eye, groundY, dt) {
    const C = this.cfg;
    this._t += dt;
    const cam = this.camera;
    _q.set(state.qx, state.qy, state.qz, state.qw);

    if (!this._init) {
      this.qs.copy(_q);
      this._init = true;
    }

    // Field of view widens with speed.
    const fovT = C.fovMin + (C.fovMax - C.fovMin) * Math.min(1, speed / 340);
    this.fov += (fovT - this.fov) * (1 - Math.exp(-C.fovSpring * dt));
    // A jolt (the sound barrier) widens it for a moment and eases off.
    this.punch -= this.punch * (1 - Math.exp(-SHOCK.kickDecay * dt));
    cam.fov = (this.mode === 1 ? Math.max(this.fov, 72) : this.fov) + this.punch;

    if (this.mode === 1) {
      // The pilot's eye. Free look turns the head.
      _v.set(eye[0], eye[1], eye[2]).applyQuaternion(_q);
      cam.position.set(state.x + _v.x, state.y + _v.y, state.z + _v.z);
      cam.up.set(0, 1, 0).applyQuaternion(_q);
      _f.set(0, 0, 1).applyQuaternion(_q);
      this._look(_f, cam.up, look);
      _target.copy(cam.position).add(_f);
    } else {
      // Smooth the heading toward the aircraft's. Faster when the camera is
      // far behind (the orbit), slower and lagging in the chase.
      const k = 1 - Math.exp(-(this.mode === 2 ? C.orientSpring * 2 : C.orientSpring) * dt);
      this.qs.slerp(_q, k);
      _f.set(0, 0, 1).applyQuaternion(this.qs);
      _u.set(0, 1, 0).applyQuaternion(this.qs);
      // Lean the camera's up toward the world's, so a roll does not whip the horizon.
      _u.lerp(UP, C.upBlend).normalize();

      const dist = this.mode === 2 ? C.orbitDistance : C.distance + C.speedPullback * Math.min(1, speed / 340);
      const hgt = this.mode === 2 ? C.height * 1.6 : C.height;
      // Target offset, in the smoothed frame, with free look swinging it round.
      _r.crossVectors(_u, _f).normalize();         // left
      _v.copy(_f).multiplyScalar(-dist).addScaledVector(_u, hgt);
      if (look.x || look.y) {
        _eulerQ.setFromAxisAngle(_u, look.x);
        _v.applyQuaternion(_eulerQ);
        _w.copy(_r).applyQuaternion(_eulerQ);
        _eulerQ.setFromAxisAngle(_w, -look.y);
        _v.applyQuaternion(_eulerQ);
      }
      if (!this._offsetInit) { this.offset.copy(_v); this._offsetInit = true; }
      this.offset.lerp(_v, 1 - Math.exp(-C.positionSpring * dt));
      cam.position.set(state.x + this.offset.x, state.y + this.offset.y, state.z + this.offset.z);
      cam.up.copy(_u);
      // Look a little ahead of the aircraft, so the view is where it is going;
      // swung round it with free look, look at the aircraft itself.
      const swung = Math.min(1, (Math.abs(look.x) + Math.abs(look.y)) / 0.5);
      _target.set(state.x, state.y, state.z)
        .addScaledVector(_f, this.mode === 2 ? 0 : 14 * (1 - swung))
        .addScaledVector(_u, 1.5);
    }

    // Shake: the afterburner and the stall.
    if (shake > 0) {
      const a = shake;
      cam.position.x += Math.sin(this._t * 61) * a * 0.5;
      cam.position.y += Math.sin(this._t * 73 + 1) * a * 0.5;
      cam.position.z += Math.sin(this._t * 67 + 2) * a * 0.5;
    }

    // Never under the ground. In the open world the ground is wherever the
    // camera has got to, not under the aircraft, so a hook can ask.
    if (this.groundFn) groundY = this.groundFn(cam.position.x, cam.position.z);
    if (cam.position.y < groundY + 1.5) cam.position.y = groundY + 1.5;

    // The near plane grows with height above the ground so depth holds over a
    // long view, but never past just in front of the aircraft: a camera that
    // sits 20 m behind it must not slice its tail off.
    const away = this.mode === 1 ? 0 : this.offset.length();
    cam.near = this.mode === 1 ? 0.1
      : Math.max(0.1, Math.min(C.nearMax, C.nearMin + C.nearPerMetre * Math.max(0, agl), away * 0.45));
    cam.updateProjectionMatrix();

    cam.lookAt(_target);
  }

  // Turn a forward vector by the free-look offsets about the camera's up and right.
  _look(f, up, look) {
    if (!look.x && !look.y) return;
    _r.crossVectors(up, f).normalize();
    _eulerQ.setFromAxisAngle(up, look.x);
    f.applyQuaternion(_eulerQ);
    _w.copy(_r).applyQuaternion(_eulerQ);
    _eulerQ.setFromAxisAngle(_w, -look.y);
    f.applyQuaternion(_eulerQ);
  }
}
