// ============================================================================
// VehiclePhysics
// ----------------------------------------------------------------------------
// The driving model. Pure state and plain numbers: no Three.js objects, no DOM,
// no allocation in step(). That keeps it testable in Node and cheap to run six
// times per physics step for a full field.
//
// Axes: +x right, +y up, +z forward. Yaw increases turning right.
// Corner order is always [FL, FR, RL, RR].
//
// Structure of one step, in order:
//   1. smooth digital input (in physics time, never per frame)
//   2. suspension: 4 corner springs against the ground query
//   3. sprung body: heave, pitch, roll as 3 driven DOFs
//   4. axle loads out of those spring forces  <- the weight transfer link
//   5. longitudinal forces
//   6. lateral forces, bicycle model, limited by the axle loads from (4)
//   7. integrate, snapshot for interpolation
// ============================================================================

import { SIM, INPUT, ENGINE, BRAKES, DRAG, GRIP, STEERING, SUSPENSION, BARRIER } from '../data/tuning.js';
import { manualDrive, voiceFor } from './Gearbox.js';

const FL = 0, FR = 1, RL = 2, RR = 3;
// Body axes: +x LEFT, +y up, +z forward. See setChassis() for why x is left.

// ---------------------------------------------------------------------------
// The one grip function. Everything about how the car behaves at and past the
// limit is in these five lines, which is where the spec wants it.
//
//   s        normalized slip: |slipAngle| / peakSlipAngle
//   returns  fraction of peak grip available, 0..1
//
// Below the peak it rises on a sine so grip is flat-topped at the limit
// instead of coming to a point, which is what makes the limit findable.
// Past the peak it decays exponentially toward tailGrip, never to zero, which
// is what makes a slide catchable rather than terminal.
// ---------------------------------------------------------------------------
export function gripFalloff(s, sharpness = GRIP.falloffSharpness, tail = GRIP.tailGrip) {
  if (s <= 0) return 0;
  if (s <= 1) return Math.sin(Math.PI * 0.5 * s);
  return tail + (1 - tail) * Math.exp(-(s - 1) * sharpness);
}

// How much cornering grip an axle has left after the longitudinal force it is
// already carrying. The exponent shapes the friction ellipse: 2 is a true
// circle, higher is squarer and allows more combined grip.
function lateralRemaining(cap, longUsed) {
  if (cap < 1) return 0;
  const u = Math.min(1, Math.abs(longUsed) / cap);
  const p = GRIP.combinedExponent;
  const left = Math.pow(Math.max(0, 1 - Math.pow(u, p)), 1 / p);
  // Never take ALL the steering away. A car that cannot be turned at all under
  // braking is not forgiving, it is just unresponsive.
  return cap * Math.max(left, GRIP.lateralFloor);
}

// Uneven left/right loading costs an axle grip, because tyre grip is sublinear
// in load. Hoisted to module scope: as a closure inside step() this allocated a
// new function every physics step, for every car on track.
function loadSensitivity(load, ref) {
  if (ref < 1 || load < 1) return 1;
  return Math.pow(load / ref, -GRIP.loadSensitivity);
}
function rollPenalty(lf, rf) {
  const sum = lf + rf;
  if (sum < 1) return 1;
  const ratio = Math.abs(lf - rf) / sum;
  return 1 - GRIP.rollGripLoss * ratio * ratio;
}

// Extra tyre load from GRIP.speedGrip at speed v, in Newtons. Exported because
// the AI's speed profile has to plan with exactly the grip the car will have.
export function speedGripLoad(chassis, v) {
  const r = v / GRIP.speedGripRef;
  return chassis.mass * SIM.gravity * GRIP.speedGrip * r * r;
}

function surfaceMult(surface, chassis) {
  const base = GRIP.surface[surface] ?? 1.0;
  return surface === 'tarmac' ? base : base * chassis.offroadGrip;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

// Move `current` toward `target` at `rate` units/second. Frame-rate independent
// because it is only ever called from inside the fixed step.
function approach(current, target, rate, dt) {
  const d = target - current;
  const step = rate * dt;
  if (Math.abs(d) <= step) return target;
  return current + Math.sign(d) * step;
}

export class VehiclePhysics {
  constructor(chassis) {
    this.setChassis(chassis);
    this.reset(0, 0, 0, 0);
  }

  setChassis(chassis) {
    this.chassis = chassis;
    // Distance from the center of mass to each axle. weightDistribution is the
    // fraction of static weight carried by the FRONT axle, so a high value
    // means the mass sits close to the front and `a` is small.
    this.a = chassis.wheelbase * (1 - chassis.weightDistribution); // CG -> front
    this.b = chassis.wheelbase * chassis.weightDistribution; // CG -> rear
    this.halfTrack = chassis.trackWidth * 0.5;
    // Ride height is per chassis: a truck and an open wheeler do not share one.
    this.restLength = chassis.suspensionRest ?? SUSPENSION.restLength;

    // Corner offsets in body space, [FL, FR, RL, RR].
    // +x is the car's LEFT, not its right: the nose is +z and up is +y, and in
    // a right-handed frame right = forward x up = -x. Getting this backwards
    // mirrors the corner load telemetry without changing any behavior, which
    // makes it very easy to miss.
    this.cornerX = [this.halfTrack, -this.halfTrack, this.halfTrack, -this.halfTrack];
    this.cornerZ = [this.a, this.a, -this.b, -this.b];
  }

  reset(x, y, z, yaw) {
    this.x = x; this.y = y; this.z = z;
    this.yaw = yaw; this.pitch = 0; this.roll = 0;

    this.vLong = 0; // body frame, +z forward
    this.vLat = 0;  // body frame, +x right
    this.vy = 0;    // world vertical
    this.yawRate = 0; this.pitchRate = 0; this.rollRate = 0;

    // Smoothed input state. Lives here, not in Input.js, so it is integrated
    // on the fixed clock and cannot vary with display refresh rate.
    this.steer = 0; this.throttle = 0; this.brake = 0; this.handbrakeBlend = 0;
    this.steerAngleUsed = 0;

    this.compression = [0, 0, 0, 0];
    this.cornerLoad = [0, 0, 0, 0];
    this.wheelGrounded = [false, false, false, false];
    this.wheelSurface = ['tarmac', 'tarmac', 'tarmac', 'tarmac'];
    this.wheelOnTrack = [true, true, true, true];
    this.wheelsOnTrack = 4;
    this.wheelSpin = 0; // radians, visual only

    // Telemetry, read by the debug overlay and the wheel effects. Never read
    // by the model itself.
    this.slipFront = 0; this.slipRear = 0;
    this.driveUse = 0; // drive force as a share of what the rear tyres can take, 0-1
    this.latForceFront = 0; this.latForceRear = 0;
    this.frontLoad = 0; this.rearLoad = 0;
    this.surface = 'tarmac';
    this.wheelsOnGround = 4;
    this.wheelsOffTarmac = 0;
    this.airborne = false;
    this.touchingBarrier = false;
    this.impactSpeed = 0; // last barrier hit, m/s. Drives shake and audio later.
    this.onTrack = true;

    this.snapshot();
    this.prevX = this.x; this.prevY = this.y; this.prevZ = this.z;
    this.prevYaw = this.yaw; this.prevPitch = this.pitch; this.prevRoll = this.roll;
  }

  // Kept so the renderer can interpolate, and so timing can later solve the
  // exact sub-step fraction at which a checkpoint plane was crossed. Without
  // this, lap times quantize to the physics step.
  snapshot() {
    this.prevX = this.x; this.prevY = this.y; this.prevZ = this.z;
    this.prevYaw = this.yaw; this.prevPitch = this.pitch; this.prevRoll = this.roll;
    this.prevWheelSpin = this.wheelSpin;
    this.prevCompression0 = this.compression[0];
    this.prevCompression1 = this.compression[1];
    this.prevCompression2 = this.compression[2];
    this.prevCompression3 = this.compression[3];
  }

  get speed() {
    return Math.hypot(this.vLong, this.vLat);
  }

  // -------------------------------------------------------------------------
  step(dt, input, ground) {
    this.snapshot();

    const c = this.chassis;
    const m = c.mass;
    const g = SIM.gravity;

    // --- 1. input -----------------------------------------------------------
    // Analog channels pass straight through: a stick value is already
    // frame-rate independent because it comes from hardware, not integration.
    // Digital channels are ramped here, on the fixed clock.
    if (input.steerIsAnalog) {
      this.steer = input.steer;
    } else {
      const towardCenter = Math.abs(input.steer) < Math.abs(this.steer) ||
        Math.sign(input.steer) !== Math.sign(this.steer);
      const rate = towardCenter ? INPUT.steerRelease : INPUT.steerAttack;
      this.steer = approach(this.steer, input.steer, rate, dt);
    }
    if (input.pedalsAreAnalog) {
      this.throttle = input.throttle;
      this.brake = input.brake;
    } else {
      this.throttle = approach(this.throttle, input.throttle,
        input.throttle > this.throttle ? INPUT.pedalAttack : INPUT.pedalRelease, dt);
      this.brake = approach(this.brake, input.brake,
        input.brake > this.brake ? INPUT.pedalAttack : INPUT.pedalRelease, dt);
    }
    // Handbrake cuts grip fast and gives it back slowly. That asymmetry is why
    // a drift settles instead of snapping.
    this.handbrakeBlend = approach(this.handbrakeBlend, input.handbrake,
      input.handbrake > this.handbrakeBlend ? GRIP.handbrakeAttack : GRIP.handbrakeRelease, dt);

    const speed = this.speed;
    const absLong = Math.abs(this.vLong);

    // --- 2. suspension ------------------------------------------------------
    const sinP = Math.sin(this.pitch), cosP = Math.cos(this.pitch);
    const sinR = Math.sin(this.roll), cosR = Math.cos(this.roll);
    const sinY = Math.sin(this.yaw), cosY = Math.cos(this.yaw);

    let totalSpringForce = 0;
    let groundedCount = 0;
    let offTarmac = 0;
    // Body torques are accumulated from the same arrays that define where the
    // corners are, so the sign of a corner force can never disagree with the
    // side of the car it is on. Writing these out by hand with FL/FR/RL/RR
    // literals is how the roll term ends up fighting the geometry.
    //   a force F at lateral offset lx pushes that side UP  -> roll -= F * lx
    //   a force F at longitudinal offset lz pushes it UP    -> pitch += F * lz
    let pitchSpringTorque = 0;
    let rollSpringTorque = 0;
    // Horizontal part of the ground's push, in world axes. See below.
    let slopeFx = 0;
    let slopeFz = 0;

    // Body velocity in world axes, for the ground speed under each corner.
    const bodyVx = this.vLong * sinY + this.vLat * cosY;
    const bodyVz = this.vLong * cosY - this.vLat * sinY;

    for (let i = 0; i < 4; i++) {
      const lx = this.cornerX[i], lz = this.cornerZ[i];
      // World XZ of the corner, yaw only. Pitch and roll are small enough that
      // their effect on the horizontal position is not worth the trig.
      const ox = lx * cosY + lz * sinY;
      const oz = -lx * sinY + lz * cosY;
      const wx = this.x + ox;
      const wz = this.z + oz;

      // The body's height goes with the query, so on a track that crosses
      // over itself the wheels find the road they are on and not the one
      // above or below it.
      const sample = ground.sample(wx, wz, this.y);
      this.wheelSurface[i] = sample.surface;
      this.wheelOnTrack[i] = sample.onTrack !== false;
      if (sample.surface !== 'tarmac') offTarmac++;
      const n = sample.normal;

      // Height of this corner's suspension mount, given body attitude.
      const mountY = this.y + sinP * lz - sinR * lx;
      const gap = mountY - sample.height;
      const comp = this.restLength - gap;

      // How fast the road under this corner is rising or falling, from the
      // slope of the surface and how fast the corner is crossing it. Zero on
      // the flat, and several metres a second on a descent.
      const cvx = bodyVx + this.yawRate * oz;
      const cvz = bodyVz - this.yawRate * ox;
      const groundVy = n.y > 0.2 ? -(n.x * cvx + n.z * cvz) / n.y : 0;

      // Compression speed, which is what a damper resists. It is the mount's
      // vertical speed RELATIVE TO THE ROAD, not relative to the world.
      //
      // Measured against the world, a car driving down a 12% slope at 25 m/s
      // has its mounts falling at 3 m/s, and every damper reads that as the car
      // dropping onto its springs: 3600 N per m/s, four corners, about three
      // times the car's weight pushing it UP. The body was launched off every
      // descent, spent four and a half seconds a lap on Pine Ridge with its
      // wheels in the air, and only settled once the road levelled out again.
      const mountVy = this.vy + cosP * this.pitchRate * lz - cosR * this.rollRate * lx - groundVy;

      this.compression[i] = comp;

      if (comp <= -SUSPENSION.maxDroop) {
        // Wheel is in the air. No force, and the visual droops to full extension.
        this.compression[i] = -SUSPENSION.maxDroop;
        this.cornerLoad[i] = 0;
        this.wheelGrounded[i] = false;
        continue;
      }

      let f = SUSPENSION.springRate * comp - SUSPENSION.damperRate * mountVy;
      if (comp > SUSPENSION.maxTravel) {
        // Bump stop. Stops a hard landing from punching the body through the road.
        f += SUSPENSION.springRate * SUSPENSION.bumpStopRate * (comp - SUSPENSION.maxTravel);
      }
      f = Math.max(f, 0); // a spring can push, never pull

      this.cornerLoad[i] = f;
      this.wheelGrounded[i] = comp > -SUSPENSION.maxDroop * 0.98;
      if (this.wheelGrounded[i]) groundedCount++;
      totalSpringForce += f;
      pitchSpringTorque += f * lz;
      rollSpringTorque -= f * lx;
      // The road pushes along its own normal, not straight up, so on a slope
      // part of that push is horizontal. That is gravity acting down the hill:
      // the car gathers speed on a descent, loses it on a climb, and a banked
      // corner leans the car into the turn instead of only tilting it.
      slopeFx += f * n.x * SUSPENSION.groundNormal;
      slopeFz += f * n.z * SUSPENSION.groundNormal;
    }

    this.wheelsOnGround = groundedCount;
    this.wheelsOffTarmac = offTarmac;
    this.airborne = groundedCount === 0;

    // --- 4. axle loads ------------------------------------------------------
    // Downforce is added as extra vertical load, so it feeds grip through the
    // same path as weight does. No special case anywhere else.
    const downforce = c.downforce * speed * speed;
    // High-speed grip, on top of the chassis's own aero. Split between the axles
    // in their static proportion, so it adds grip without moving any car's
    // balance -- the Boxhauler is exactly as loose as it was, only at a higher
    // speed. Straight to the tyres rather than through the springs, so the car
    // rides at the same height and still leaves the ground over a crest.
    const assist = speedGripLoad(c, speed);
    this.frontLoad = this.cornerLoad[FL] + this.cornerLoad[FR] + downforce * 0.5
      + assist * c.weightDistribution;
    this.rearLoad = this.cornerLoad[RL] + this.cornerLoad[RR] + downforce * 0.5
      + assist * (1 - c.weightDistribution);

    // Uneven left/right loading costs an axle grip, because tire grip is
    // sublinear in load. Without this term a tall car rolls but does not
    // actually handle worse, and the Haul 4x4 has no downside.
    const frontRollMult = rollPenalty(this.cornerLoad[FL], this.cornerLoad[FR]);
    const rearRollMult = rollPenalty(this.cornerLoad[RL], this.cornerLoad[RR]);

    // Surface grip per axle, averaged across that axle's two wheels.
    const frontSurface = 0.5 *
      (surfaceMult(this.wheelSurface[FL], c) + surfaceMult(this.wheelSurface[FR], c));
    const rearSurface = 0.5 *
      (surfaceMult(this.wheelSurface[RL], c) + surfaceMult(this.wheelSurface[RR], c));
    this.surface = this.wheelSurface[RL];
    this.wheelsOnTrack =
      (this.wheelOnTrack[0] ? 1 : 0) + (this.wheelOnTrack[1] ? 1 : 0) +
      (this.wheelOnTrack[2] ? 1 : 0) + (this.wheelOnTrack[3] ? 1 : 0);

    // Handbrake only ever touches the rear.
    const handbrakeMult = 1 - this.handbrakeBlend * (1 - GRIP.handbrakeGripMult);

    // Tyre load sensitivity. A tyre's grip coefficient falls as it is pushed
    // harder into the road, so an axle carrying twice the load makes well under
    // twice the grip. This is the term that decides whether a car understeers
    // or spins under braking, and leaving it out is what made every car here
    // slide out on corner entry: braking put 2.4x as much load on the front
    // axle as the rear, so the front made 2.4x the cornering force, while the
    // wheelbase only balances 1.5x. The surplus is pure yaw torque.
    //
    // Measured against each axle's static share of whatever load is present,
    // so downforce -- which loads both axles evenly -- still adds grip, and
    // only genuine front-to-rear transfer is penalised.
    const totalLoad = this.frontLoad + this.rearLoad;
    const lsFront = loadSensitivity(this.frontLoad, totalLoad * c.weightDistribution);
    const lsRear = loadSensitivity(this.rearLoad, totalLoad * (1 - c.weightDistribution));

    const G = GRIP.mechanicalGrip;
    const muFront = c.gripFront * G * frontSurface * frontRollMult * lsFront;
    const muRear = c.gripRear * G * rearSurface * rearRollMult * handbrakeMult * lsRear;

    const maxLatFront = muFront * this.frontLoad;
    const maxLatRear = muRear * this.rearLoad;

    // --- 5 & 6. tyre forces -------------------------------------------------
    // Slip angles blend out at walking pace so the car does not shiver or
    // creep when stopped.
    const speedBlend = smoothstep(0, GRIP.lowSpeedBlend, speed);
    const vRef = Math.max(absLong, GRIP.lowSpeedBlend);

    const vLatFront = this.vLat + this.yawRate * this.a;
    const vLatRear = this.vLat - this.yawRate * this.b;

    // --- steering limit ------------------------------------------------------
    // Cap the front SLIP ANGLE, not the wheel angle.
    //
    // A tyre makes peak force at peakSlipAngle and LESS beyond it. Steering
    // past that peak therefore does not turn the car harder, it turns it less
    // and scrubs speed doing it. On a keyboard, where a key press means full
    // lock, that is what happened on every corner: the front sat at twice its
    // peak slip, grip fell away, and the car ploughed straight off the outside
    // of the bend however early you turned in.
    //
    // Capping the wheel angle on a speed curve cannot fix that, because the
    // angle which saturates the tyre depends on how much the car is already
    // yawing -- the same 15 degrees of lock is nothing mid-corner and far too
    // much on turn-in. Capping the slip angle needs no speed term at all: it
    // states the condition directly, "never ask the front for more than it
    // has". It is also immune to the axle loads, so a landing that spikes the
    // suspension can no longer throw the steering limit wide open.
    //
    // Below walking pace the cap opens up to the full mechanical lock, or the
    // car could not be parked and the hairpin would need a three point turn.
    //
    // Every one of these terms depends on WHICH WAY the car is travelling, and
    // `dir` is that. A steered tyre dragged backwards makes its side force the
    // other way round from one rolled forwards -- that is the whole of why a
    // car reverses into a parking space the way it does -- so the sign of
    // vLong belongs in the front axle's arithmetic and used to be thrown away.
    const dir = this.vLong < 0 ? -1 : 1;

    const kinFront = Math.atan2(vLatFront, vRef);
    const slipCap = GRIP.peakSlipAngle * STEERING.limitMargin;
    const park = 1 - smoothstep(STEERING.parkSpeed, STEERING.parkSpeed * 3, speed);
    const cap = slipCap + (c.steerRate - slipCap) * park;
    // Small angle, the front slip works out to (kinFront - dir * steerAngle),
    // so bounding it to +/- cap bounds dir * steerAngle, not steerAngle.
    let steerAngle = clamp(this.steer * c.steerRate,
      dir * kinFront - cap, dir * kinFront + cap);
    this.steerLimit = cap;

    // Counter-steer assist. Feeds a slice of the rear slip back into the
    // steering, in the same direction the tail is sliding, which is what a
    // driver does. Small values keep a keyboard slide holdable without taking
    // the car over.
    const rawRearSlip = Math.atan2(vLatRear, vRef);
    if (!this.airborne) {
      // Also mirrored: the yaw a given lock produces flips with direction, so
      // the correction that opposes a slide has to flip with it too.
      steerAngle += dir * STEERING.counterSteerAssist * rawRearSlip * speedBlend;
      steerAngle = clamp(steerAngle, -c.steerRate, c.steerRate);
    }

    // Recorded for the renderer so the front wheels visibly point where the
    // model actually thinks they point, counter-steer assist included.
    this.steerAngleUsed = steerAngle;

    // Front slip angle, measured in the steered wheel's own frame rather than
    // approximated in the body's. Written this way it needs no special case for
    // reverse: the wheel-frame longitudinal velocity carries the sign, and the
    // slip angle comes out mirrored on its own. The previous form measured the
    // slip against |vLong|, so the front axle behaved as though the car were
    // always going forwards -- and reversing with the wheel to the right walked
    // the car to the LEFT.
    //
    // Forwards, and at the small angles that matter, this is the same number
    // the old expression gave, so the way the car drives is untouched.
    const cs = Math.cos(steerAngle);
    const sn = Math.sin(steerAngle);
    const wheelLong = this.vLong * cs + vLatFront * sn;
    const wheelLat = vLatFront * cs - this.vLong * sn;
    const slipFront = Math.atan2(wheelLat,
      Math.max(Math.abs(wheelLong), GRIP.lowSpeedBlend));
    this.slipFront = slipFront;
    // The rear wheel is not steered, so its slip angle is already measured
    // against |vLong| in the right frame and reverses correctly as it stands.
    const slipRear = rawRearSlip;
    this.slipRear = slipRear;

    // --- longitudinal, decided FIRST ----------------------------------------
    // Order matters, and this is the single most important thing about how the
    // car behaves at the limit. The driver commands throttle and brake, so
    // those get first call on each axle's grip and cornering gets the
    // remainder. Braking therefore eats the front tyres' ability to turn, and
    // arriving too hot pushes the nose wide.
    //
    // Doing it the other way round -- lateral first, longitudinal with the
    // leftovers -- gives the front axle full cornering force while braking
    // unloads the rear, so the front makes nearly twice the rear's grip and
    // the car pivots on corner entry every single time.
    let driveForce = 0;
    let brakeForce = 0;

    if (this.throttle > 0) {
      const frac = clamp(absLong / c.topSpeed, 0, 1);
      const powerFactor = Math.max(0, 1 - Math.pow(frac, ENGINE.powerFalloff));
      const launch = 1 + (ENGINE.launchBoost - 1) * (1 - smoothstep(0, ENGINE.launchSpeed, absLong));
      driveForce = c.power * ENGINE.powerScale * this.throttle * powerFactor * launch;
    }

    if (this.brake > 0) {
      if (this.vLong > ENGINE.reverseThreshold) {
        brakeForce = -BRAKES.maxForce * this.brake;
      } else if (this.vLong > -c.topSpeed * 0.35) {
        // Standing still or already rolling back: brake becomes reverse.
        driveForce = -c.power * ENGINE.powerScale * ENGINE.reverseFactor * this.brake;
      } else {
        brakeForce = BRAKES.maxForce * this.brake; // slowing a reverse
      }
    }

    // Longitudinal force actually put through each axle, capped by what that
    // axle's tyres can carry at all.
    let longFront = 0;
    let longRear = 0;
    if (!this.airborne) {
      // Traction limit on the driven axle.
      //
      // Letting the throttle spend the rear tyres' whole friction budget is
      // correct tyre physics and completely undriveable on a keyboard, where
      // the throttle is either off or pinned: the rear is left with only the
      // lateral floor, so every corner exit is a spin. A real driver feathers
      // it and a real gearbox does not offer peak thrust at 15 m/s; this stands
      // in for both. Set tractionLimit to 1 for the raw, unassisted behaviour.
      // ...and in a straight line there is nothing else asking for the rear
      // tyres, so the allowance opens up. This is what makes a car launch:
      // every car here is grip limited from rest to about 130 km/h, so the
      // engine's output below that speed is decided entirely by this line.
      // The allowance closes back to the cornering value as soon as the rear
      // starts working sideways, which is both what a traction control does
      // and what stops the extra force reaching a corner exit.
      const straight = 1 - smoothstep(0,
        GRIP.peakSlipAngle * ENGINE.launchFade, Math.abs(slipRear));
      const allowance = ENGINE.tractionLimit +
        (ENGINE.launchTraction - ENGINE.tractionLimit) * straight;
      const driveCap = maxLatRear * allowance;
      driveForce = clamp(driveForce, -driveCap, driveCap); // rear drive

      // Manual gearbox, the player's car only. The chosen gear passes some
      // fraction of the force the tyres would take -- after the traction cap,
      // or every gear would launch the same, grip limited, car. Reverse is
      // still the brake pedal's, in any gear but neutral. Nothing without
      // `input.manual` set (the AI, auto drive, every check) reaches this.
      if (input.manual) {
        driveForce *= driveForce > 0
          ? manualDrive(voiceFor(c.id), input.gear, absLong / c.topSpeed)
          : (input.gear >= 1 ? 1 : 0);
      }
      this.driveUse = driveCap > 1 ? clamp(driveForce / driveCap, 0, 1) : 0;

      // Load sensitive proportioning. A fixed bias sends the same force to the
      // rear whether it is carrying half the car's weight or a fifth of it, and
      // under hard braking the second case is what pivots the car: the rear
      // spends its whole friction budget slowing down and has none left to
      // hold the line. Real cars fit a proportioning valve for this reason.
      const totalGrip = maxLatFront + maxLatRear;
      const loadBias = totalGrip > 1 ? maxLatFront / totalGrip : BRAKES.frontBias;
      const bias = BRAKES.frontBias + (loadBias - BRAKES.frontBias) * BRAKES.proportioning;

      const bf = clamp(brakeForce * bias, -maxLatFront, maxLatFront);
      const br = clamp(brakeForce * (1 - bias), -maxLatRear, maxLatRear);
      let hb = 0;
      if (this.handbrakeBlend > 0 && absLong > 0.4) {
        // The handbrake is a rear-axle force that ignores the bias entirely.
        hb = -Math.sign(this.vLong) * BRAKES.handbrakeForce * this.handbrakeBlend;
      }
      longFront = bf;
      longRear = driveForce + br + hb;
      brakeForce = bf + br + hb;
    } else {
      driveForce = 0;
      brakeForce = 0;
      this.driveUse = 0;
    }

    // --- lateral, with whatever grip is left --------------------------------
    let latFront = 0, latRear = 0;
    if (!this.airborne) {
      const nF = gripFalloff(Math.abs(slipFront) / GRIP.peakSlipAngle);
      const nR = gripFalloff(Math.abs(slipRear) / GRIP.peakSlipAngle);
      const availF = lateralRemaining(maxLatFront, longFront);
      const availR = lateralRemaining(maxLatRear, longRear);
      latFront = -Math.sign(slipFront) * Math.min(nF * maxLatFront, availF) * speedBlend;
      latRear = -Math.sign(slipRear) * Math.min(nR * maxLatRear, availR) * speedBlend;
    }
    this.latForceFront = latFront;
    this.latForceRear = latRear;

    const dragForce = -Math.sign(this.vLong) * DRAG.coefficient * this.vLong * this.vLong;
    const surfaceDragMult = 0.5 *
      ((DRAG.surfaceDrag[this.wheelSurface[RL]] ?? 1) + (DRAG.surfaceDrag[this.wheelSurface[RR]] ?? 1));
    const rrForce = this.airborne
      ? 0
      : -Math.sign(this.vLong) * DRAG.rollingResistance * m * g * surfaceDragMult *
        smoothstep(0, 0.5, absLong);

    // --- 7. integrate -------------------------------------------------------
    const fLong = driveForce + brakeForce + dragForce + rrForce - latFront * Math.sin(steerAngle);
    const fLat = latFront * Math.cos(steerAngle) + latRear;

    // The slope's horizontal push, turned into the body frame.
    const slopeLong = slopeFx * sinY + slopeFz * cosY;
    const slopeLat = slopeFx * cosY - slopeFz * sinY;

    const aLong = (fLong + slopeLong) / m;
    const aLat = (fLat + slopeLat) / m;

    // How fast the car's PATH is turning: the part of the acceleration across
    // the velocity, over the speed. Compared against the yaw rate below, the
    // difference is the sideslip changing -- see STEERING.yawStability.
    const v2 = Math.max(this.vLong * this.vLong + this.vLat * this.vLat, 1);
    const pathRate = (this.vLong * aLat - this.vLat * aLong) / v2;
    const stability = this.airborne ? 0
      : STEERING.yawStability * (1 - this.handbrakeBlend)
        * smoothstep(STEERING.yawStabilityFrom, STEERING.yawStabilityFull, speed);

    // The +vLat*yawRate / -vLong*yawRate terms are the rotating-frame
    // correction. Without them the car does not actually go round a corner.
    this.vLong += (aLong + this.vLat * this.yawRate) * dt;
    this.vLat += (aLat - this.vLong * this.yawRate) * dt;

    // Yaw
    const yawTorque = latFront * Math.cos(steerAngle) * this.a - latRear * this.b
      - SUSPENSION.yawDamping * this.yawRate
      - stability * (this.yawRate - pathRate);
    this.yawRate += (yawTorque / SUSPENSION.yawInertia) * dt;
    this.yaw += this.yawRate * dt;

    // --- 3. sprung body: heave, pitch, roll ---------------------------------
    const fVertical = totalSpringForce - m * g - downforce;
    this.vy += (fVertical / m) * dt;
    this.y += this.vy * dt;

    // Pitch. Spring term: more force at the front raises the nose. Inertia
    // term: accelerating squats, braking dives. They fight, and where they
    // settle is the load transfer that already fed grip above.
    const pitchTorque =
      pitchSpringTorque +
      aLong * m * c.centerOfMassHeight -
      SUSPENSION.pitchDamping * this.pitchRate;
    this.pitchRate += (pitchTorque / SUSPENSION.pitchInertia) * dt;
    this.pitch = clamp(this.pitch + this.pitchRate * dt, -SUSPENSION.maxPitch, SUSPENSION.maxPitch);

    // Roll. Positive roll drops the +x side, which is the car's LEFT. So a
    // right-hand corner (lateral acceleration toward -x) rolls positive, and
    // the car leans out of the turn as it should.
    const rollTorque =
      rollSpringTorque -
      aLat * m * c.centerOfMassHeight -
      SUSPENSION.rollDamping * this.rollRate;
    this.rollRate += (rollTorque / SUSPENSION.rollInertia) * dt;
    this.roll = clamp(this.roll + this.rollRate * dt, -SUSPENSION.maxRoll, SUSPENSION.maxRoll);

    // World position from body-frame velocity.
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    this.x += (this.vLong * sy + this.vLat * cy) * dt;
    this.z += (this.vLong * cy - this.vLat * sy) * dt;

    // --- barriers -----------------------------------------------------------
    // The car is kept inside the track ribbon by a distance-to-centerline test
    // rather than by mesh collision: the ribbon is generated from the spline,
    // so the spline already knows exactly where its own edge is. The response
    // pushes the car back in, removes the speed going into the wall, and
    // scrubs the speed running along it. It has to cost real time without
    // ending the lap.
    this.touchingBarrier = false;
    this.impactSpeed *= Math.exp(-6 * dt);
    if (ground.bounds) {
      const b = ground.bounds(this.x, this.z, this.y);
      this.onTrack = b.onTrack;
      // The limit is for the car's CENTER, so it is inset by half the car's
      // track width: the bodywork should stop at the wall, not the origin.
      const limit = Math.max(0.5, b.limit - this.halfTrack - 0.1);
      const over = Math.abs(b.lateral) - limit;
      if (over > 0) {
        this.touchingBarrier = true;
        this.x += b.inwardX * over;
        this.z += b.inwardZ * over;

        const syw = Math.sin(this.yaw), cyw = Math.cos(this.yaw);
        let vx = this.vLong * syw + this.vLat * cyw;
        let vz = this.vLong * cyw - this.vLat * syw;

        const nx = -b.inwardX, nz = -b.inwardZ; // outward, into the wall
        const vn = vx * nx + vz * nz;
        if (vn > 0) {
          // Kill the velocity going into the wall, returning a little as bounce.
          const remove = vn * (1 + BARRIER.restitution);
          vx -= nx * remove;
          vz -= nz * remove;
          this.impactSpeed = Math.max(this.impactSpeed, vn);
          const hit = Math.max(0, 1 - vn * BARRIER.impactScrub);
          vx *= hit; vz *= hit;
        }
        // Everything left is running along the wall, so scrape it.
        const f = Math.exp(-BARRIER.scrapeFriction * dt);
        vx *= f; vz *= f;

        this.vLong = vx * syw + vz * cyw;
        this.vLat = vx * cyw - vz * syw;
        // A wall should stop a spin, not let the car pirouette down it.
        this.yawRate *= Math.exp(-BARRIER.yawScrub * dt);
      }
    }

    // Visual wheel rotation.
    this.wheelSpin += (this.vLong / c.wheelRadius) * dt;

    // Settle to a genuine stop rather than creeping.
    if (speed < GRIP.restSpeed && this.throttle < 0.01 && Math.abs(driveForce) < 1) {
      this.vLong = 0;
      this.vLat = 0;
      this.yawRate *= 0.5;
    }
  }

  // Interpolated render state. alpha is the fraction between the last two
  // physics steps, so the car moves smoothly at any refresh rate.
  interpolate(alpha, out) {
    const lerp = (a, b) => a + (b - a) * alpha;
    // Yaw is wrapped so the car does not spin the long way round the seam.
    let dYaw = this.yaw - this.prevYaw;
    while (dYaw > Math.PI) dYaw -= Math.PI * 2;
    while (dYaw < -Math.PI) dYaw += Math.PI * 2;

    out.x = lerp(this.prevX, this.x);
    out.y = lerp(this.prevY, this.y);
    out.z = lerp(this.prevZ, this.z);
    out.yaw = this.prevYaw + dYaw * alpha;
    out.pitch = lerp(this.prevPitch, this.pitch);
    out.roll = lerp(this.prevRoll, this.roll);
    out.wheelSpin = lerp(this.prevWheelSpin, this.wheelSpin);
    out.compression[0] = lerp(this.prevCompression0, this.compression[0]);
    out.compression[1] = lerp(this.prevCompression1, this.compression[1]);
    out.compression[2] = lerp(this.prevCompression2, this.compression[2]);
    out.compression[3] = lerp(this.prevCompression3, this.compression[3]);
    return out;
  }
}

export function createRenderState() {
  return { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, wheelSpin: 0, compression: [0, 0, 0, 0] };
}
