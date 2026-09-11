// Everything the wheels leave behind: dust and gravel, tyre smoke, skid marks.
//
// Reads each car's physics -- slip, surface, which wheels are on the ground --
// and its interpolated render state, once per rendered frame, and writes only
// to the particle pool and the skid mark ring. Visual only: nothing here can
// change how a car drives, and nothing here runs on the physics clock, so it
// is free to use Math.random.
//
// Dust comes off the DRIVEN wheels, which on every car here are the rears:
// that is where the physics puts the drive force.

import * as THREE from 'three';
import { Particles } from './Particles.js';
import { SkidMarks } from './SkidMarks.js';
import { EFFECTS, GRIP } from '../data/tuning.js';

const WHITE = new THREE.Color(1, 1, 1);

export class Effects {
  constructor(parent) {
    this.particles = new Particles(parent);
    this.skids = new SkidMarks(parent);
    this.track = null;
    this.colors = {};
    this.smoke = new THREE.Color(EFFECTS.smokeColor);
    this._owed = new WeakMap(); // per car: particles owed per wheel, as a fraction
  }

  // Each track's loose surfaces throw their own colour of dirt: the palette
  // the road mesh is painted from.
  setTrack(track) {
    this.track = track;
    const p = track.data.palette || {};
    const ground = p.ground ?? 0x8a7a60;
    const gravel = p.gravel ?? p.runoff ?? ground;
    const grass = p.grass ?? ground;
    this.colors = {
      gravel: { dust: new THREE.Color(gravel).lerp(WHITE, 0.25), chip: new THREE.Color(gravel).multiplyScalar(0.55) },
      // Grass throws earth as much as grass.
      grass: { dust: new THREE.Color(grass).lerp(new THREE.Color(0x6b5a44), 0.45), chip: new THREE.Color(grass).multiplyScalar(0.6) },
    };
    this.particles.clear();
    this.skids.clear();
  }

  // cars: Vehicles (physics, interpolated render state, chassis). dt 0 holds
  // everything in place, for the pause screen.
  update(cars, dt) {
    if (dt > 0 && this.track) for (const v of cars) this._emit(v, dt);
    this.particles.update(dt);
    this.skids.update(dt);
  }

  _emit(v, dt) {
    const p = v.physics, s = v.render, c = v.chassis;
    const speed = p.speed;
    const sinY = Math.sin(s.yaw), cosY = Math.cos(s.yaw);
    // The car's velocity in world axes, the same way the physics moves it.
    const vx = p.vLong * sinY + p.vLat * cosY;
    const vz = p.vLong * cosY - p.vLat * sinY;
    const slide = Math.abs(p.slipRear) / GRIP.peakSlipAngle;
    // A launch is the rear tyres asked for nearly all their grip from low
    // speed. Read off the drive the physics actually put through them, not
    // the pedal: in neutral the throttle only revs the engine.
    const launch = p.vLong > 0.2 && speed < EFFECTS.launchSmokeSpeed &&
      p.throttle > EFFECTS.launchThrottle && (p.driveUse || 0) >= EFFECTS.launchDriveUse;
    const handbrake = p.handbrakeBlend > 0.3 && speed > 4;
    const width = EFFECTS.skidWidth * (c.wheelRadius / 0.33);
    let owed = this._owed.get(p);
    if (!owed) { owed = new Float32Array(4); this._owed.set(p, owed); }

    for (let i = 0; i < 4; i++) {
      if (!p.wheelGrounded[i]) { this.skids.mark(p, i, 0, 0, 0, false, width); continue; }
      const rear = i >= 2;
      const surface = p.wheelSurface[i];
      let rate = 0, smoke = false, marking = false;
      if (surface === 'tarmac') {
        marking = rear && speed > 0.5 && (slide > EFFECTS.skidSlip || handbrake || launch);
        if (rear && (slide > EFFECTS.smokeSlip || launch || (handbrake && slide > 0.5))) {
          smoke = true;
          // A launch is its own, finer haze: it happens right under the chase
          // camera, where full-size slide smoke fills the screen.
          const k = Math.min(1, Math.max(0.25, (slide - EFFECTS.smokeSlip) / 0.8)) * Math.min(1, speed / 12);
          rate = launch ? Math.max(EFFECTS.launchSmokeRate, EFFECTS.smokeRate * k) : EFFECTS.smokeRate * k;
        }
      } else if (rear && speed > EFFECTS.dustMinSpeed) {
        // More when the tyre is being driven, not just rolling through it.
        const spin = (p.driveUse || 0) * Math.min(1, slide);
        rate = EFFECTS.dustRate * (Math.min(1, speed / EFFECTS.dustFullSpeed) + 0.6 * spin);
      }
      if (!marking && rate <= 0) { this.skids.mark(p, i, 0, 0, 0, false, width); continue; }

      // This wheel's contact patch, the same way the physics finds it.
      const lx = p.cornerX[i], lz = p.cornerZ[i];
      const wx = s.x + lx * cosY + lz * sinY;
      const wz = s.z - lx * sinY + lz * cosY;
      const gy = this.track.sample(wx, wz, s.y).height;
      this.skids.mark(p, i, wx, gy, wz, marking, width);
      if (rate <= 0) continue;
      owed[i] += rate * dt;
      while (owed[i] >= 1) {
        owed[i] -= 1;
        if (smoke) this._smoke(wx, gy, wz, vx, vz, launch);
        else this._dust(wx, gy, wz, vx, vz, surface);
      }
    }
  }

  _smoke(x, y, z, vx, vz, launch) {
    const r = Math.random;
    const E = EFFECTS;
    const size = (launch ? E.launchSmokeSize : E.smokeSize) * (0.7 + 0.6 * r());
    const grow = (launch ? E.launchSmokeGrow : E.smokeGrow) * (0.7 + 0.6 * r());
    const life = (launch ? E.launchSmokeLife : E.smokeLife) * (0.7 + 0.6 * r());
    const rise = launch ? E.launchSmokeRise : E.smokeRise;
    const shade = 0.88 + 0.12 * r();
    const col = this.smoke;
    this.particles.emit(
      x + (r() - 0.5) * 0.3, y, z + (r() - 0.5) * 0.3,
      vx * 0.12 + (r() - 0.5) * 1.2, rise * (0.6 + 0.8 * r()), vz * 0.12 + (r() - 0.5) * 1.2,
      life, size, grow,
      col.r * shade, col.g * shade, col.b * shade,
      0, 1.4, y);
  }

  _dust(x, y, z, vx, vz, surface) {
    const r = Math.random;
    const set = this.colors[surface] || this.colors.gravel;
    const carry = EFFECTS.dustCarry, spread = EFFECTS.dustSpread;
    if (r() < EFFECTS.chipShare) {
      // A chip of the surface itself: small, dark, thrown up and falling back.
      const size = 0.07 + 0.07 * r();
      const col = set.chip;
      this.particles.emit(
        x, y, z,
        vx * carry + (r() - 0.5) * spread * 2, EFFECTS.dustLift * (1.1 + 0.8 * r()), vz * carry + (r() - 0.5) * spread * 2,
        0.5 + 0.4 * r(), size, 1,
        col.r, col.g, col.b,
        9.8, 0.3, y);
      return;
    }
    const size = EFFECTS.dustSize * (0.7 + 0.6 * r());
    const shade = 0.9 + 0.2 * r();
    const col = set.dust;
    this.particles.emit(
      x + (r() - 0.5) * 0.4, y, z + (r() - 0.5) * 0.4,
      vx * carry + (r() - 0.5) * spread, EFFECTS.dustLift * (0.5 + 0.8 * r()), vz * carry + (r() - 0.5) * spread,
      EFFECTS.dustLife * (0.7 + 0.6 * r()), size, EFFECTS.dustGrow * (0.7 + 0.6 * r()),
      Math.min(1, col.r * shade), Math.min(1, col.g * shade), Math.min(1, col.b * shade),
      0.8, 2.2, y);
  }

  dispose() {
    this.particles.dispose();
    this.skids.dispose();
  }
}
