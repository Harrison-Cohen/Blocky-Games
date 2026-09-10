// Binds a VehiclePhysics to a car mesh.
//
// The split matters: physics runs on the fixed clock and knows nothing about
// Three.js; this file runs at render time and only reads interpolated state.
// The root carries position and yaw, the body group carries pitch and roll,
// and the wheels sit on the root so they stay planted on the ground while the
// bodywork moves on its springs. That separation is what makes the suspension
// read from outside the car.

import * as THREE from 'three';
import { VehiclePhysics, createRenderState } from './VehiclePhysics.js';
import { buildCar, BRAKE_LIGHT, DEFAULT_CONFIG } from './CarBuilder.js';
import { GRAPHICS } from '../data/tuning.js';

// Hoisted: allocating a Color every frame, for every car, to interpolate two
// numbers is exactly the kind of per-frame garbage a six car field cannot
// afford.
//
// Lit, the lamp is brighter than white, so the bloom pass catches it and a car
// braking ahead of you flares red rather than just changing colour.
const TMP_LIT = new THREE.Color(BRAKE_LIGHT.lit).multiplyScalar(GRAPHICS.brakeGlow);

export class Vehicle {
  constructor(chassis, config = DEFAULT_CONFIG) {
    this.chassis = chassis;
    this.config = config;
    this.physics = new VehiclePhysics(chassis);
    this.render = createRenderState();

    const built = buildCar(chassis, config);
    this.root = built.root;
    this.body = built.body;
    this.wheels = built.wheels;
    this.brakeLight = built.brakeLight;
    this.headlamp = built.headlamp;
    this.headlight = null;
    this._headlightsOn = false;
    this._headlightShadow = false;

    this._smoothedSteer = 0;
    this._brakeGlow = 0;
  }

  // Night driving. One spot light standing in for both lamps, carried on the
  // BODY rather than the root, so the beam dips under braking and lifts under
  // power the way real headlights do -- which is also how you can see the car
  // ahead of you braking before its tail lamps tell you.
  setHeadlights(on, shadow = false) {
    this._headlightsOn = on;
    this._headlightShadow = shadow;
    if (this.headlight) {
      this.body.remove(this.headlight);
      this.body.remove(this.headlight.target);
      this.headlight.dispose();
      this.headlight = null;
    }
    if (!on) return;
    const h = this.headlamp;
    const l = new THREE.SpotLight(GRAPHICS.headlightColor, GRAPHICS.headlightIntensity,
      GRAPHICS.headlightRange, GRAPHICS.headlightAngle, GRAPHICS.headlightPenumbra,
      GRAPHICS.headlightDecay);
    l.position.set(0, h.y, h.z);
    l.target.position.set(0, h.y - GRAPHICS.headlightDrop, h.z + 20);
    if (shadow) {
      l.castShadow = true;
      l.shadow.mapSize.set(1024, 1024);
      l.shadow.bias = -0.0006;
      l.shadow.camera.near = 0.3;
      l.shadow.camera.far = GRAPHICS.headlightRange;
    }
    this.body.add(l);
    this.body.add(l.target);
    this.headlight = l;
  }

  // Swap the chassis and the paint, rebuilding the mesh. Does NOT place the
  // car: the caller decides where it goes, because only the caller knows where
  // the ground is. Only the chassis reaches the physics -- the config is
  // cosmetic and stops at CarBuilder.
  setCar(chassis, config, parent) {
    parent.remove(this.root);
    disposeTree(this.root);
    // The tail lamp material is this car's own, not a cached one, so nothing
    // else will free it.
    this.brakeLight.dispose();

    this.chassis = chassis;
    this.config = config ?? this.config;
    this.physics.setChassis(chassis);

    const built = buildCar(chassis, this.config);
    this.root = built.root;
    this.body = built.body;
    this.wheels = built.wheels;
    this.brakeLight = built.brakeLight;
    this.headlamp = built.headlamp;
    // The old light went with the old body; a new body needs its own.
    this.headlight = null;
    if (this._headlightsOn) this.setHeadlights(true, this._headlightShadow);
    parent.add(this.root);
  }

  // Take this car out of the scene for good. Materials are shared and cached;
  // the geometry and this car's own tail lamp material are not.
  dispose(parent) {
    parent.remove(this.root);
    disposeTree(this.root);
    this.brakeLight.dispose();
    if (this.headlight) { this.headlight.dispose(); this.headlight = null; }
  }

  step(dt, input, ground) {
    this.physics.step(dt, input, ground);
  }

  updateVisual(alpha, dt) {
    const p = this.physics;
    const s = p.interpolate(alpha, this.render);
    const restLength = p.restLength;

    this.root.position.set(s.x, s.y, s.z);
    this.root.rotation.set(0, s.yaw, 0);

    // Bodywork rides on the springs. Pitch is about X, roll about Z.
    //
    // BOTH are negated. In the model, positive pitch is nose UP (a front mount
    // sits at y + sin(pitch) * lz) and positive roll drops the car's left side;
    // in three.js a positive rotation about X tips +z, the nose, DOWN, and a
    // positive rotation about Z raises +x, the left. Pitch used to go through
    // unnegated, so every climb tipped the body nose-down into the hill -- 42
    // cm of bonnet inside the road on Pine Ridge's steepest pitch -- every
    // descent put the tail through the tarmac, and braking squatted the car
    // instead of diving it.
    this.body.rotation.set(-s.pitch, 0, -s.roll);
    const sinP = Math.sin(s.pitch), sinR = Math.sin(s.roll);

    this._updateBrakeLight(dt);

    // Wheels follow their own corner's compression, so a wheel dropping into a
    // dip visibly extends while the others stay put.
    for (let i = 0; i < 4; i++) {
      const w = this.wheels[i];
      // Steer first, then spin, or a steered wheel spins about the wrong axis.
      w.rotation.order = 'YXZ';
      // Wheel centre: this corner's suspension mount, which moves with the
      // body's pitch and roll exactly as the model has it, less the spring's
      // length, plus the tyre. Leaving the mount's pitch term out sank the
      // uphill wheels 15 cm into a climb and floated the downhill ones.
      const travel = restLength - s.compression[i];
      const mount = sinP * p.cornerZ[i] - sinR * p.cornerX[i];
      w.position.y = mount - travel + this.chassis.wheelRadius;
      w.rotation.x = s.wheelSpin;
      if (i < 2) {
        // Front wheels point where the model actually steers.
        this._smoothedSteer += (p.steerAngleUsed - this._smoothedSteer) *
          (1 - Math.exp(-30 * Math.max(dt, 1e-4)));
        w.rotation.y = this._smoothedSteer;
      }
    }
  }

  // Tail lamps, driven off the pedal rather than off deceleration: a brake
  // light reports what the driver is doing, not what the car is doing. Lifting
  // off and coasting down is not braking and does not light them.
  //
  // Read from the SMOOTHED pedal in the physics, not the raw key, so the lamps
  // cannot flicker at a different rate from the braking they are reporting.
  _updateBrakeLight(dt) {
    const p = this.physics;
    const on = p.brake > 0.02 || p.handbrakeBlend > 0.02 ? 1 : 0;
    const rate = on ? BRAKE_LIGHT.attack : BRAKE_LIGHT.release;
    this._brakeGlow += (on - this._brakeGlow) * (1 - Math.exp(-rate * Math.max(dt, 1e-4)));
    this.brakeLight.color.setHex(BRAKE_LIGHT.rest).lerp(TMP_LIT, this._brakeGlow);
  }

  get speed() { return this.physics.speed; }
}

function disposeTree(obj) {
  // Materials are shared and cached, so only geometry is disposed here.
  obj.traverse((n) => {
    if (n.geometry) n.geometry.dispose();
  });
}
