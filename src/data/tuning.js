// ============================================================================
// TUNING
// ----------------------------------------------------------------------------
// Every gameplay constant lives here. Nothing in this file is read at module
// load time by the physics, so you can edit values and Vite will hot-swap them
// without a page reload (see main.js).
//
// Each value has: what it does, and a sane range. Going outside the range is
// allowed, it just stops being predictable.
//
// Units are SI throughout: meters, seconds, kilograms, Newtons, radians.
// Body axes: +x right, +y up, +z forward.
// ============================================================================

export const SIM = {
  // Physics rate. The whole model is tuned at this rate; changing it changes
  // how stiff springs behave. 120 is the spec. Range 60-240.
  hz: 120,

  // Most physics steps allowed in one rendered frame. Prevents the death
  // spiral where a slow frame schedules more work than the next frame can do.
  // If you hit this the game goes slow-motion instead of freezing. Range 3-10.
  maxStepsPerFrame: 5,

  // Any frame gap longer than this is discarded rather than simulated. Stops
  // an alt-tab or a breakpoint from teleporting the car. Range 0.1-0.5.
  maxFrameDelta: 0.25,

  gravity: 9.81,

  // Mass, kg, that the spring, damper, brake and yaw stability numbers below
  // are given for. A heavier car gets proportionally stiffer springs, firmer
  // dampers, stronger brakes and more yaw stability, so every car sits at the
  // same depth on its springs, is damped alike, can stop on its tyres rather
  // than its brakes and settles after turn-in alike. On one shared set, a
  // 1745 kg Mustang sat twice as deep as the Wedge One, stopped in twice the
  // distance and swung its nose past the corner after turning in. 780 is the
  // Wedge One. Range 600-2000.
  referenceMass: 780,
};

export const INPUT = {
  // How fast keyboard steering ramps from 0 to full lock, in units/second.
  // This is the single biggest "feels like a keyboard game" knob. Lower is
  // smoother and slower to react. Range 2-10.
  steerAttack: 4.2,

  // How fast steering returns to center when you let go. Should be faster
  // than attack or the car feels like it is on ice. Range 3-15.
  steerRelease: 7.0,

  // Keyboard throttle and brake ramp, units/second. Range 3-20.
  pedalAttack: 8.0,
  pedalRelease: 12.0,

  // Gamepad stick deadzone, as a fraction of full deflection. Below this the
  // stick reads zero. Range 0.05-0.25.
  stickDeadzone: 0.12,

  // Gamepad trigger deadzone. Triggers rest slightly above zero on some pads.
  triggerDeadzone: 0.06,

  // Exponent applied to stick steering. 1 is linear, higher gives finer
  // control near center. Range 1.0-2.5.
  steerGamma: 1.5,
};

export const ENGINE = {
  // Shape of the power falloff with speed. Engine force is scaled by
  // (1 - (v/topSpeed)^falloff). 1 is linear and feels gutless up top, 3 keeps
  // pull late and makes top speed abrupt. A chassis can set its own
  // (powerFalloff in cars.js); the real cars do, so their pull through the
  // quarter mile matches the real car's. Range 1.5-4.
  powerFalloff: 2.4,

  // Global multiplier on every chassis's `power`. Same idea as GRIP's
  // mechanicalGrip: cars.js decides which car is quicker off the line, this
  // decides how quick the game is. It does not raise top speed, because top
  // speed is a separate per-chassis number and the power curve is already
  // falling away to nothing by the time a car gets there -- it only makes the
  // pull to get there stronger. Note that below about 130 km/h the cars are
  // grip limited rather than power limited, so this is felt at the TOP of the
  // range and ENGINE.launchTraction is what is felt at the bottom.
  // Range 0.8-2.5.
  powerScale: 2.1,

  // Extra force multiplier at a standstill, blended out by launchSpeed. Stops
  // low-speed acceleration feeling dead without inflating top-end power.
  // Range 1.0-2.0.
  launchBoost: 2.6,
  // m/s over which launchBoost blends away. It stands in for the low gears, so
  // a chassis whose low gears reach further can set its own (launchSpeed in
  // cars.js); the real cars do, tuned to their 0-60 and quarter mile.
  // Range 4-20 here, up to 45 per chassis.
  launchSpeed: 14.0,

  // The most of the driven axle's grip the throttle is allowed to use WHILE
  // CORNERING, leaving the rest to turn the car. 1 lets the throttle consume
  // everything, which is honest tyre physics and spins the car on every corner
  // exit when the pedal is a keyboard key. Lower means the car pulls out of
  // corners tidily; too low and it will not oversteer on power at all.
  // Range 0.5-1.
  tractionLimit: 0.72,

  // The same allowance in a STRAIGHT LINE, blended to tractionLimit above as
  // the rear tyres start doing lateral work.
  //
  // This is the number that decides how hard a car launches, and nothing else
  // does. Every car here is grip limited, not power limited, from a standstill
  // to about 130 km/h -- at rest the engine is already asking for nearly three
  // times what this allows through -- so raising `power` or `powerScale` alone
  // changes the launch by exactly nothing. This is the knob.
  //
  // 1.0 is the physical value: the whole of the rear tyres' friction budget.
  // Above 1.0 the driven axle is making more longitudinal force than its own
  // friction circle allows, which is a deliberate arcade cheat and not a tyre
  // model any more. It is safe in the sense that it only ever applies going
  // straight -- the blend closes it down to tractionLimit within about four
  // degrees of rear slip, so the moment the car is actually cornering the
  // honest limit is back.
  //
  // The ceiling is set by the tallest car, not by taste. Above about 1.6 the
  // Bighead's launch transfers more weight than its suspension has travel for:
  // it pins itself against SUSPENSION.maxPitch, the rear load starts pulsing by
  // a third either side of its mean, and the car bounces off the line instead
  // of leaving it. Raise this and check the tall cars, not the quick ones.
  // Range 0.7-1.6.
  launchTraction: 1.5,

  // How much rear slip closes launchTraction back down to tractionLimit, as a
  // fraction of GRIP.peakSlipAngle. Smaller is a more cautious traction
  // control that backs out earlier. Range 0.3-1.0.
  launchFade: 0.5,

  // Reverse force as a fraction of forward power. Range 0.2-0.6.
  reverseFactor: 0.35,

  // Below this forward speed, holding brake engages reverse instead. Range 0.3-3.
  reverseThreshold: 1.2,
};

// The five real cars, made quicker for a game.
//
// Each real car in cars.js carries the real car's published figures. Driven
// as the real cars, at 1 g and a 3-6 second 0-60, they felt heavy and slow
// beside the Wedge One's 2 g. These scale all five by the same amount, so
// each stays exactly as far from the others as the real cars are: the
// Chevelle is still the slowest and loosest, the Huracan still the quickest
// off the line. `npm run specs` holds every real car to its real figures
// scaled by these (gameSpecs() in cars.js):
//
//   0-60 mph       the real time / accel
//   quarter mile   the real time / sqrt(accel), the same car pulling accel x
//   skidpad        the real g * grip
//   turning circle the real circle / turn
//   top speed is the real car's, unscaled
//
// The garage shows the scaled figures, since they are what the car does here.
// Changing any of them moves the targets, not the cars: run
// `node scripts/fit-specs.mjs` for the numbers to put back in cars.js, then
// `npm run specs`.
export const STREET = {
  // Acceleration, as a multiple of the real car's. 1 is the real car.
  // Range 1-2.2.
  accel: 1.8,
  // Cornering grip, as a multiple of the real car's skidpad. 1 is the real
  // car; the Wedge One corners at about 2.1 g. At 1.45 the real cars went
  // round a 23-33 m circle at 40 mph to the Wedge One's 17 m and felt clunky;
  // at 1.8 the grippiest are about 1.9 g and the Chevelle 1.4 g. Range 1-2.2.
  grip: 1.8,
  // Steering lock, as a shrink of the real car's turning circle: 1.2 turns a
  // 911's 11.2 m circle into 9.3 m, tighter than the Wedge One's 11.1 m. It
  // decides hairpins and anything under about 20 mph; above that the grip
  // above does. Range 1-1.4.
  turn: 1.2,
};

export const BRAKES = {
  // Peak braking force in Newtons at the tires, before grip limits it, for a
  // car of SIM.referenceMass; each car's scales with its mass. 14000 N on
  // 780 kg is 1.8 g, so every car can brake to the limit of its tyres and
  // grip decides how hard it stops. Range 6000-24000.
  maxForce: 14000,

  // Fraction of braking sent to the front axle. Real cars are 60-70% front.
  // Push it rearward and the car will lock the rear and rotate under braking.
  // Range 0.5-0.8.
  frontBias: 0.64,

  // How much of the braking bias follows the actual axle loads instead of
  // sitting at frontBias. 0 is a fixed bias, 1 shifts the split fully onto
  // whichever axle is carrying the weight, which is what stops the rear
  // letting go when you brake and turn at the same time. Below about 0.5 the
  // car starts rotating on entry again; at 1.0 it is very stable and a little
  // reluctant to turn in. Range 0-1.
  proportioning: 1.0,

  // Handbrake force on the rear axle only, Newtons, for a car of
  // SIM.referenceMass and scaled with mass like maxForce. Range 3000-12000.
  handbrakeForce: 5200,
};

export const DRAG = {
  // Aero drag coefficient: force = coefficient * speed^2. 0.5 gives about
  // 1500 N at 55 m/s. Raising this lowers top speed and sharpens lift-off.
  // Range 0.2-1.2.
  coefficient: 0.55,

  // Rolling resistance as a fraction of vehicle weight. Range 0.008-0.03.
  rollingResistance: 0.014,

  // Extra rolling drag multiplier per surface, on top of the above.
  // This is what makes grass feel like it is eating the car.
  surfaceDrag: {
    tarmac: 1.0,
    gravel: 2.6, // Range 1.5-4
    grass: 5.5, // Range 3-9
  },
};

export const GRIP = {
  // Slip angle in radians at which a tire makes peak lateral force.
  // 0.16 rad is 9 degrees. Smaller peaks earlier and feels more nervous;
  // larger gives you more warning before the tyre lets go. Range 0.08-0.25.
  peakSlipAngle: 0.16,

  // How hard grip falls off once you are past the peak. This is THE knob for
  // catchable versus snappy. 0.5 is very forgiving, 3 is a knife edge.
  // Range 0.4-4.
  falloffSharpness: 0.9,

  // Grip retained deep past the limit, as a fraction of peak. Keeping this
  // well above zero is what makes a slide holdable instead of terminal.
  // Range 0.45-0.85.
  tailGrip: 0.72,

  // Global multiplier on every chassis's gripFront and gripRear.
  //
  // The per-car numbers in cars.js set the BALANCE between the four cars and
  // between each car's own two axles; this sets how much grip the game has.
  // Because it multiplies both axles of every car by the same amount, and the
  // surface multipliers below sit on top of it, raising it makes everything
  // feel more planted without touching any car's character or the relationship
  // between tarmac, gravel and grass. This is the knob to reach for first if
  // the cars feel slippery. Range 0.8-1.3.
  mechanicalGrip: 1.12,

  // Extra tyre load at speed, as a fraction of the car's weight at speedGripRef
  // and growing with the square of speed, like aero does. This is the knob for
  // "the car will not turn at high speed": without it every car here corners at
  // about the same g at 180 km/h as at 60, so the radius it needs grows with
  // speed squared and a fast sweeper becomes a wall. It is split between the
  // axles in their static proportion, so a car's balance -- which axle lets go
  // first -- is unchanged; it only lets go later. Nothing at walking pace
  // changes. 0 is off, and the chassis's own downforce still applies either
  // way. Range 0-1.
  speedGrip: 0.45,
  speedGripRef: 50, // m/s, about 180 km/h. Range 30-70.

  // Surface grip multipliers. Tarmac is the baseline by definition.
  surface: {
    tarmac: 1.0,
    gravel: 0.75, // spec value
    grass: 0.55, // spec value
  },

  // Rear grip multiplier while the handbrake is fully applied. Lower means the
  // rear lets go harder. Below about 0.4 the car snaps sideways faster than
  // you can read it. Range 0.3-0.7.
  handbrakeGripMult: 0.52,

  // Handbrake blend rates, units/second. Grip is cut faster than it returns,
  // which is what makes a drift settle instead of snapping back. The attack
  // is what governs how violent the initial break-away feels: high values
  // remove the rear axle in a single frame with no warning.
  handbrakeAttack: 7.5, // Range 4-20
  handbrakeRelease: 3.6, // Range 1.5-8

  // Tyre load sensitivity exponent: grip coefficient scales as (load / static
  // load) ^ -loadSensitivity. 0 is a perfectly linear tyre, which spins the car
  // on every brake-and-turn because the loaded front axle out-grips the light
  // rear. Real tyres sit around 0.15-0.3; this model exaggerates weight
  // transfer, so it needs more. Note it does NOT affect the balance of a car at
  // steady load -- the weight terms cancel -- so it can be tuned purely for how
  // the car behaves under braking and power. Raise it for stronger
  // understeer on entry, lower it to let the car rotate. Range 0.2-0.8.
  loadSensitivity: 0.95,

  // How much uneven left/right loading costs an axle. This is the term that
  // makes a tall, rolly car actually worse in corners rather than just
  // looking worse. 0 disables it. Range 0-0.5.
  rollGripLoss: 0.26,

  // Shape of the friction ellipse, which decides how much cornering grip is
  // left once an axle is already braking or driving. 2 is a true circle and is
  // the harshest; higher values are squarer and let you brake and turn at the
  // same time. Range 2.0-3.2.
  combinedExponent: 2.6,

  // Cornering grip an axle keeps even when its tyres are fully committed
  // longitudinally, as a fraction of peak. Without a floor here, threshold
  // braking removes the steering completely, which reads as a broken car
  // rather than a demanding one. Range 0.05-0.35.
  lateralFloor: 0.18,

  // Below this speed tire forces blend out, so the car does not vibrate or
  // creep at a standstill. Range 0.5-3.
  lowSpeedBlend: 1.6,

  // Speed under which the car is snapped to rest when coasting with no input.
  // Range 0.05-0.5.
  restSpeed: 0.18,
};

export const STEERING = {
  // How far past the front tyre's peak slip angle full lock is allowed to
  // push, as a multiple of it. 1.0 puts the front exactly on its peak and the
  // car turns as hard as it physically can; above about 1.6 the front is deep
  // into the falloff, makes LESS grip than at peak, and the car ploughs wide
  // however early you turn in. Below 1.0 it feels numb and refuses to rotate.
  // This is the single most important handling knob in the file.
  // Range 0.9-1.6.
  limitMargin: 1.15,

  // Below this speed the slip cap opens up to the full mechanical lock, so the
  // car can be parked and a hairpin does not need a three point turn. It fades
  // back in by three times this speed. m/s. Range 1-6.
  parkSpeed: 2.5,

  // Counter-steer assist: fraction of the rear slip angle fed back into the
  // steering automatically. Small values make a keyboard slide holdable
  // without taking control away. 0 is pure manual. Range 0-0.4.
  counterSteerAssist: 0.20,

  // Yaw stability, N m per rad/s. Resists the nose rotating FASTER OR SLOWER
  // than the car's path is actually turning -- the difference between the two
  // is the sideslip changing, and nothing else. In a steady corner the two are
  // equal, so this does nothing at all to how hard a car can corner; it only
  // acts on the transient. Without it, full keyboard lock at speed snapped the
  // nose round three times faster than the path could follow, the rear went
  // past its peak, the steering limit swung the front wheels the other way and
  // the car ran on sideways with D still held -- "it refuses to turn". Off
  // while the handbrake is on, so handbrake turns still rotate the car, and
  // faded in with speed, below. 0 is off. Higher is steadier and less lively.
  // Given for a car of SIM.referenceMass and scaled with mass: a heavier car's
  // tyres make proportionally more yaw torque, so one shared number steadied
  // a Mustang half as much as the Wedge One. Range 0-20000.
  yawStability: 14000,

  // Speeds, m/s, over which yawStability fades in. The snap it cures is a
  // corner-entry problem at speed; below the first number it is off entirely,
  // so power oversteer out of a slow corner -- the Boxhauler's whole character
  // -- is untouched. 18 m/s is 65 km/h, 32 m/s is 115 km/h. Range 10-40.
  yawStabilityFrom: 18,
  yawStabilityFull: 32,
};

export const SUSPENSION = {
  // Spring rate per corner, Newtons per meter of compression. Higher is
  // stiffer, less body movement, more nervous over bumps. This is deliberately
  // soft: visible dive and roll is most of what sells the feel, and the body
  // motion is the readout you steer by. Given for a car of SIM.referenceMass;
  // each car's scales with its mass, so all of them sit alike. Range
  // 18000-70000.
  springRate: 26000,

  // Damper rate per corner, Newtons per m/s of compression speed. Too low
  // floats and oscillates, too high goes wooden and skips over bumps.
  // Critical is roughly 2 * sqrt(springRate * cornerMass), about 4500 for the
  // reference car, so this is about 0.8 critical: sporty, settles in one
  // motion. Scaled with mass like springRate, which keeps that ratio on every
  // car. Range 1800-8000.
  damperRate: 3600,

  // Fallback resting spring length in meters, the gap between the suspension
  // mount and the ground at rest. Each chassis overrides this with its own
  // `suspensionRest` since a truck and an open wheeler do not share a ride
  // height. Range 0.25-0.7.
  restLength: 0.40,

  // Maximum compression before the bump stop, meters. Range 0.12-0.35.
  maxTravel: 0.22,

  // Bump stop stiffness multiplier once past maxTravel. Range 4-20.
  bumpStopRate: 9.0,

  // Maximum droop below rest before the wheel is considered airborne, meters.
  // Range 0.1-0.35.
  maxDroop: 0.20,

  // Pitch and roll inertia of the sprung body, kg m^2. These control how
  // quickly the body responds, not how far it goes. Lower is twitchier.
  // Range 500-3000.
  pitchInertia: 1500,
  rollInertia: 620,

  // Angular damping on the pitch and roll DOFs, N m per rad/s. This is on top
  // of the dampers and exists to guarantee the body settles. Range 2000-15000.
  pitchDamping: 6500,
  rollDamping: 4200,

  // Hard limits on body attitude, radians. Purely a safety net so a bad
  // landing can never flip the visual. 0.35 rad is 20 degrees. Range 0.15-0.5.
  maxPitch: 0.35,
  maxRoll: 0.30,

  // Yaw inertia, kg m^2. Lower means the car changes direction more eagerly.
  // This is a strong handling knob, not just a visual one. Range 700-3000.
  yawInertia: 1450,

  // Damping on yaw rate, N m per rad/s. Stops the car spinning forever once
  // the tires are past the limit. Range 200-2500.
  yawDamping: 900,

  // How much of each spring's push acts along the road's own normal rather
  // than straight up. 1 is the physical value: on a slope some of the ground's
  // push is horizontal, which is gravity pulling the car down the hill -- it
  // gathers speed on a descent, lifts off it on a climb, and a banked corner
  // actually helps the car round instead of only tilting it. 0 turns every
  // hill into a flat road that happens to change height. Range 0-1.
  groundNormal: 1.0,
};

export const CAMERA = {
  // Chase camera distance behind the car at rest, and how much further back it
  // pulls at top speed. Range: distance 5-12, pullback 0-6.
  distance: 7.2,
  speedPullback: 2.6,

  // Camera height above the car, and how much it lowers at speed.
  height: 2.9,
  speedDrop: 0.5,

  // Spring stiffness of the camera follow. Lower lags more in corners, which
  // is what sells speed. Too low and it swings. Range 3-20.
  positionSpring: 7.5,
  positionDamping: 1.0, // 1.0 is critically damped. Range 0.7-1.4.

  // How fast the look-at target tracks the car. Higher is tighter. Range 4-25.
  lookSpring: 11.0,

  // Look-at point is pushed ahead of the car by this many meters, scaled by
  // speed. Makes you look into the corner. Range 0-8.
  lookAhead: 3.4,

  // Field of view at rest and at top speed. The spec's 70 to 88.
  fovMin: 70,
  fovMax: 88,
  fovSpring: 3.0, // How fast FOV chases speed. Range 1-8.

  // Cockpit camera position, as fractions of the chassis's own body box rather
  // than fixed meters: a fixed offset that suits the hot hatch sits above the
  // roof of the open wheeler and below the cab floor of the truck.
  // Height is a fraction of bodyHeight, forward is a fraction of bodyLength.
  cockpitHeightFrac: 0.78, // Range 0.5-0.95
  cockpitForwardFrac: 0.17, // Range 0-0.3, higher sees less of its own hood
  cockpitLift: 0.06, // matches the bodywork lift in CarBuilder

  // Far chase multipliers applied to distance and height. Range 1.2-3.
  farMultiplier: 1.9,

  // How far the chase camera swings toward the direction the car is actually
  // TRAVELLING rather than where its nose points. 0 is welded to the nose, so a
  // slide swings the whole view with the bodywork; a little of this keeps the
  // road ahead in frame while the car is sideways. Range 0-0.6.
  velocityFollow: 0.3,

  // Screen shake on a hit, from a wall or another car: metres of camera jolt
  // per m/s of impact speed above shakeThreshold, the most it can ever be, and
  // how fast it dies away (per second). Brushing a wall below the threshold is
  // a scrape, not a crash, and does not shake at all.
  // Range: perImpact 0.01-0.06, max 0.2-0.8, decay 4-14, threshold 0.5-4.
  shakePerImpact: 0.03,
  shakeMax: 0.45,
  shakeDecay: 7,
  shakeThreshold: 1.5,
  // Jolt on landing, metres per m/s of vertical speed at touchdown. The crest
  // on Pine Ridge is the one that finds this. Range 0-0.05.
  shakePerLanding: 0.025,
  // A faint rumble at top speed, metres at full speed. 0 is off. Range 0-0.03.
  speedRumble: 0.012,

  // Behind the title and track select screens the camera flies the loaded
  // track, down the middle of the road, in the direction of the lap.
  // tourSpeed is m/s along the road (range 6-30). tourHeight is metres above
  // the road (range 2.5-6; Harbor Nine's tunnel roof is at 7.4). tourLookAhead
  // is how far up the road it looks, metres (range 15-60), tourLookSpring how
  // fast the view turns into a corner (range 0.5-4, lower is lazier), and
  // tourFov its field of view (range 45-75).
  tourSpeed: 14,
  tourHeight: 4.2,
  tourLookAhead: 34,
  tourLookSpring: 1.4,
  tourFov: 58,
};

export const WORLD = {
  // Fog start and end distance, meters. End should sit inside the draw
  // distance so scenery fades rather than pops. Range: near 40-200, far 200-900.
  fogNear: 90,
  fogFar: 520,

  // Directional light angle, and shadow map size. 4096 is crisp over the
  // larger shadow box below, 2048 is cheaper. Shadow camera is refit around the
  // car every frame.
  sunDirection: { x: -0.45, y: 1.0, z: 0.35 },
  shadowMapSize: 4096,
  // Half-size of the fitted shadow box, metres. Bigger reaches further down the
  // road before shadows stop; the map size above has to grow with it or the
  // shadows go soft and blocky. Range 12-70.
  shadowRadius: 48,

  // Cap on device pixel ratio. The spec asks for 1.5 to protect integrated
  // graphics; this build targets a strong machine and renders at native
  // resolution on anything up to a 2x display. Range 1-2.
  maxPixelRatio: 2,

  // Tone mapping exposure. The renderer runs ACES filmic tone mapping, which
  // rolls off bright highlights instead of clipping them to white, so a sunlit
  // flank and a specular highlight stay distinguishable. ACES also darkens the
  // midtones, hence an exposure above 1 to put them back. 0 disables tone
  // mapping entirely and returns to the raw linear look. Range 0.8-1.8.
  toneMappingExposure: 1.25,

  // Rolling ground beyond the barriers. Peak-to-trough height of the terrain
  // that surrounds the circuit, metres. It is flattened to nothing near the
  // road, so it never touches the racing surface or the graded apron -- purely
  // what you see over the walls. 0 gives the old flat plane. Range 0-60.
  terrainAmplitude: 30,

  // Distance over which the terrain flattens as it approaches the track, in
  // metres, measured from the outer edge of the apron. Shorter reads as a
  // cutting or a shelf, longer as a gentle bowl. Range 30-200.
  terrainFade: 90,

  // Size of the ground mesh cells, metres. Smaller means more, smaller facets
  // on the hills -- still faceted, just finer. Range 10-120.
  terrainCell: 16,

  // Distance over which the ground stops following the road's own height and
  // settles to the level of the circuit as a whole, metres, measured from the
  // outer edge of the apron. Near the track the ground has to track the road or
  // an elevated section stands on a plinth; far away it has to forget it, or
  // the distant plain steps wherever the nearest piece of track changes.
  // Range 150-800.
  terrainSettle: 420,
};


// ============================================================================
// GRAPHICS
// ----------------------------------------------------------------------------
// How the frame is finished and lit. None of this touches the simulation; all
// of it costs GPU time, and none of it is a texture on a surface.
// ============================================================================
export const GRAPHICS = {
  // The post-processing chain: ambient occlusion, bloom, vignette, tone
  // mapping. false draws the scene straight to the screen with none of it.
  postFX: true,

  // Multisample anti-aliasing on the HDR scene target. 0 is off, 4 is clean
  // edges, 8 is marginally cleaner and much slower. Range 0-8.
  msaa: 4,

  // Ambient occlusion. Radius is how far, in metres, a surface looks for things
  // that shade it: large enough for a container stack to darken the ground
  // around it, small enough that the road is not grey. Intensity is how dark
  // that shading gets. Samples trades noise for time. Ranges 0.5-4, 0-1.5,
  // 8-32, 0.5-3.
  ao: true,
  aoRadius: 1.8,
  aoIntensity: 0.9,
  aoSamples: 8,
  aoThickness: 1.2,

  // Samples the occlusion's denoise pass takes per pixel. It smooths a soft
  // effect, so eight looks the same as sixteen; with a full field on Skyline
  // Interchange the occlusion was still the largest single cost in the frame.
  // Range 4-16.
  aoDenoiseSamples: 8,

  // Resolution the occlusion is worked out at, as a fraction of the screen.
  // It is soft, low-frequency shading, so half resolution looks the same and
  // costs a quarter: at full resolution it was half of the whole frame on a
  // MacBook Air. Range 0.35-1.
  aoScale: 0.5,

  // Same idea for the bloom, which is a blur and never needed the detail.
  // Range 0.25-1.
  bloomScale: 0.5,

  // Bloom defaults. A track overrides these in its `post` block, because a
  // night circuit wants its lamps to spill light and a desert at noon does not.
  // Threshold is in linear HDR units: 1.0 is white, so only things told to glow
  // brighter than white bloom. Ranges 0-2, 0-1, 0.3-2.
  bloomStrength: 0.35,
  bloomRadius: 0.5,
  bloomThreshold: 1.0,

  // Shadows from every piece of scenery, including the ones a track opted out
  // of for frame rate when the budget was integrated graphics. Range true/false.
  propShadows: true,

  // Darkening toward the corners of the frame. 0 is off. Range 0-0.6.
  vignette: 0.28,

  // Softness of the sun's shadow edges, in shadow map texels. 1 is hard.
  // Range 1-6.
  shadowSoftness: 2.5,

  // Radius of the sky dome, metres. The camera's far plane follows it. It has
  // to be well outside the fog so the clouds are visible past it. Range 1200-3000.
  skyRadius: 1800,

  // --- lamps ----------------------------------------------------------------
  // How many real lights the track's lamps share. The nearest this many to the
  // camera are lit, the rest of the lamps glow but light nothing. Every one of
  // these costs every lit pixel on screen, so this is the expensive number
  // here. Range 6-32.
  lightPool: 12,

  // Fraction of the pool's reach over which the furthest lamps fade out, so
  // one entering or leaving the pool never pops. Range 0.1-0.5.
  lightFade: 0.3,

  // Multiplier on every lamp a track declares. Each track gives its lamps a
  // real intensity in candela; this is the one knob for "the lamps are too
  // bright" or "too dim" everywhere at once. Note that Lambert shading divides
  // by pi, so a pool under a lamp is much dimmer than intensity over height
  // squared suggests. Range 0.3-3.
  lampIntensity: 1.0,

  // How fast a lamp's light falls off with distance: intensity / d^decay. 2 is
  // the physical inverse square, and it is what made the lamps harsh: to light
  // the middle of the road at all, a lamp has to be so strong that anything
  // passing close under it -- the car's roof, a tunnel wall -- goes white. A
  // gentler falloff lights the road evenly from a much weaker lamp. Track lamp
  // intensities are set for this value, so change them together. Range 1-2.
  lampDecay: 1.2,

  // --- eye adaptation -------------------------------------------------------
  // The exposure dips when the frame gets brighter than this track normally
  // is -- driving into a tunnel, under a lamp, into a wall lit by your own
  // headlights -- and recovers when it does not. It never brightens past the
  // track's own exposure, so a night circuit stays dark. The brightness is
  // metered from a tiny downsampled copy of each frame, read back without
  // stalling the GPU.
  //   adaptStrength   how hard it pulls the exposure down. 0 is off. 0-1.
  //   adaptMin        the darkest it will go, as a fraction of normal. 0.3-0.9
  //   adaptTime       seconds to react to a change. 0.1-1.5
  //   adaptNormal     seconds over which "this track's normal" is averaged.
  //                   Longer means a long bright stretch stays dimmed. 3-20
  adaptStrength: 0.7,
  adaptMin: 0.45,
  adaptTime: 0.35,
  adaptNormal: 8,

  // --- frame rate -----------------------------------------------------------
  // Dynamic resolution: if frames take longer than the target, the render
  // resolution steps down until they do not, and steps back up when there is
  // room. Everything is still drawn, only at fewer pixels. The scale is a
  // fraction of the pixel ratio above; it never goes below minRenderScale.
  // Ranges true/false, 30-144, 0.4-1.
  dynamicResolution: true,
  targetFps: 60,
  minRenderScale: 0.55,

  // Scenery is split into square chunks this many metres across, so the
  // renderer can skip the chunks it cannot see -- and, as importantly, the
  // chunks outside the sun's small shadow box, which it otherwise redrew in
  // full every frame. Smaller culls tighter but costs more draw calls.
  // Range 80-400.
  propChunk: 180,

  // --- headlights, on tracks that ask for them ------------------------------
  // One spot light per car standing in for both lamps. Intensity is candela at
  // headlightDecay falloff below; range and angle are the length and half
  // width of the beam; drop is how far it dips over twenty metres. Ranges 40-400,
  // 30-150, 0.3-0.8, 0.2-0.8, 0.5-4.
  headlightColor: 0xfff1d8,
  // 85: at 130 the car in front of you in traffic, five metres ahead, was lit
  // white by your own beams.
  headlightIntensity: 85,
  // Falloff exponent, for the same reason as lampDecay: at the physical 2 the
  // beam that lights the road at 30 m turns a tunnel wall at 5 m white.
  // Range 1-2.
  headlightDecay: 1.2,
  headlightRange: 110,
  headlightAngle: 0.52,
  headlightPenumbra: 0.5,
  headlightDrop: 1.6,

  // How many of the other cars' headlights are real lights at once, handed to
  // the ones nearest the camera. The rest keep their lit lenses. Each one costs
  // every lit pixel, like a lamp. Range 0-7.
  rivalHeadlights: 3,

  // Whether the player's headlights cast shadows. Costs one more shadow pass.
  headlightShadows: true,

  // How far past white a lit brake light goes, so it blooms. Range 1-5.
  brakeGlow: 3.2,
};

// ============================================================================
// GRAPHICS LEVELS
// ----------------------------------------------------------------------------
// The garage's Graphics setting. Each level overrides some of the GRAPHICS and
// WORLD values above; anything a level does not name keeps the value written
// above. Ultra names nothing, so the blocks above are still the one place the
// top end is tuned, and every other level is a set of steps down from it.
//
// Measured on the user's Mac at 2880 x 1800 with dynamic resolution off,
// Ultra took 23.5 ms a frame on Copper Flats (25.7 ms on Harbor Nine). What
// each thing cost on its own:
//   ambient occlusion        ~9 ms    ao, aoScale
//   4x MSAA                  ~9 ms    msaa (2x saves about a third of it)
//   bloom                    ~6 ms    postFX (it has no switch of its own)
//   pixel ratio 2 -> 1.5     ~3.6 ms  maxPixelRatio (2 -> 1 saves ~11 ms)
//   16 lamps instead of 4    ~1.5 ms  lightPool, night tracks only
//   headlight shadows, rival beams, shadow map size, prop shadows: under 1 ms
// So the levels step down occlusion, MSAA and resolution first and leave the
// shadows nearly alone. Dynamic resolution stays on at every level. As set
// below they measured Low 3.5, Medium 10.6, High 19.8 and Ultra 23.9 ms on
// Copper Flats, and 3.0, 10.5, 21.4 and 27.0 ms on Harbor Nine.
// `note` is the line the garage shows under each name.
// ============================================================================
export const GRAPHICS_LEVELS = [
  {
    id: 'low',
    name: 'Low',
    note: 'Lower resolution, no post effects',
    // No post chain at all: no occlusion, no bloom, no eye adaptation. The
    // renderer still tone maps and anti-aliases the frame on its own.
    graphics: {
      postFX: false, shadowSoftness: 1.5, propShadows: false,
      lightPool: 4, rivalHeadlights: 0, headlightShadows: false,
    },
    world: { maxPixelRatio: 1, shadowMapSize: 1024 },
  },
  {
    id: 'medium',
    name: 'Medium',
    note: 'No ambient shading, smaller shadows',
    // Ambient occlusion off, the single biggest cost, but bloom and 2x MSAA
    // kept, at 1.5 pixels per point on a 2x display. Occlusion kept at a
    // third of the screen measured 16.6 ms here, too close to High's 19.8.
    graphics: {
      ao: false, msaa: 2,
      lightPool: 8, rivalHeadlights: 1, headlightShadows: false,
    },
    world: { maxPixelRatio: 1.5, shadowMapSize: 2048 },
  },
  {
    id: 'high',
    name: 'High',
    note: 'Full resolution, lighter anti-aliasing',
    // Occlusion worked out at 40% of the screen rather than half: about a
    // third less of its cost, and soft shading shows no difference.
    graphics: { msaa: 2, aoScale: 0.4, lightPool: 10, rivalHeadlights: 2 },
    world: { shadowMapSize: 2048 },
  },
  {
    id: 'ultra',
    name: 'Ultra',
    note: 'Everything at full quality',
    // Nothing overridden: exactly the GRAPHICS and WORLD blocks above.
    graphics: {},
    world: {},
  },
];

// The level a first launch uses, and what an unknown saved level falls back to.
export const DEFAULT_GRAPHICS_LEVEL = 'ultra';

// Drag racing, on a track with a `drag` block (src/game/Drag.js). Timed the
// way a real dragway times a pass. (DRAG, above, is aerodynamic drag.)
export const STRIP = {
  // Seconds staged on the line before the tree starts. Range 0.5-4.
  stageTime: 2.0,
  // A full, sportsman tree: the three ambers light this far apart and the
  // green comes this long after the last one. 0.5 is the real full tree.
  // Range 0.3-0.6.
  amberGap: 0.5,
  // How far the front tyre rolls before the clock starts, metres: seven
  // inches, the real rollout. Leaving the line before the green is a red
  // light. Range 0-0.3.
  rollout: 0.1778,
  // Length of a speed trap, metres, ending at the mark it times: 66 feet, as
  // a real strip's. Range 10-30.
  trap: 20.1168,
  // Seconds after the last car finishes before the time slip shows.
  // Range 0.5-3.
  slipDelay: 1.2,
  // Seconds after the green a car has to finish in before its pass is no
  // time. Range 15-60.
  timeout: 30,
  // How far past the centre line a car's front axle may stray, metres,
  // before it has crossed into the other lane, which loses the race.
  // Range 0.2-1.5.
  centreLine: 0.6,
};

export const TIMING = {
  // How long every wheel must be off the racing surface before the lap is
  // thrown out, seconds. Curbs count as track, so this only fires on a genuine
  // excursion. The spec's 1.5. Range 0.5-4.
  offTrackGrace: 1.5,

  // How long a sector split stays on screen after you cross the line, seconds.
  // Range 1-4.
  sectorFlashHold: 2.0,

  // Below this speed the live delta is hidden rather than shown against a
  // reference the car is nowhere near, m/s. Range 0-10.
  deltaMinSpeed: 2.0,
};

export const TRACK = {
  // Arc length between resampled centerline samples, meters. This is the
  // resolution of the road mesh AND of the ground query, so lowering it makes
  // the surface smoother and the track heavier. Range 1.2-4.
  resampleStep: 1.5,

  // Raised curb strip outside each road edge.
  curbWidth: 1.7, // meters. Range 1.0-3.0
  curbHeight: 0.11, // meters proud of the road. Range 0.05-0.2
  curbSegment: 3.4, // length of one color block before it alternates. Range 2-6

  // Barrier wall outside the curbs.
  // Metres of runoff between the curb edge and the wall. This has to be wider
  // than a car, or there is no such thing as going off: at 1.4 m the barrier
  // caught the car while its inside wheels were still on the curb, so the
  // gravel the track data declares was barely reachable and a lap could never
  // be invalidated for an excursion. Range 2-20.
  barrierGap: 9.0,
  barrierHeight: 1.0, // Range 0.6-2.0
  barrierThickness: 0.8, // Range 0.4-1.5
  barrierSegment: 4.0, // length of one wall block. Range 2-8

  // Graded apron carrying the road surface out to the surrounding ground, so
  // there is no cliff at the edge of the world on an elevated track.
  apronWidth: 48, // Range 15-60

  // How far the verge sits below the road it runs beside, metres. The apron
  // grades down to this, measured from the LOCAL road height rather than from
  // the lowest point of the circuit -- on a hill climb the two are sixty metres
  // apart, and grading to the lowest point puts a cliff beside the road and the
  // scenery down in the valley. Range 0.4-4.
  vergeDrop: 1.2,

  // Clear space in metres between the barrier line and the edge of a scenery
  // prop's own footprint. Measured against the prop's real radius after
  // scaling, not its centre, so a big mesa is pushed further out than a
  // cactus. Raise it if scenery still crowds the road. Range 4-40.
  propClearance: 12,

  // Checkpoint gates. The spec asks for one every 60 to 80 meters; they are
  // invisible, ordered, and used for lap validation and for the reset point.
  checkpointSpacing: 70, // Range 50-100

  // Sectors. Three, snapped to checkpoint indices so a split fires on a
  // discrete event rather than on a distance test.
  sectorCount: 3,
};

export const BARRIER = {
  // Scrape response when the car reaches the wall. The car is pushed back to
  // the limit, the velocity into the wall is removed, and the velocity along
  // the wall is scrubbed. It should hurt without ending the lap.

  // How much of the impact speed is given back as bounce. Keep this low or
  // the car pinballs between walls. Range 0-0.4.
  restitution: 0.12,

  // Fraction of along-the-wall speed lost per second of contact. This is the
  // scrub that actually costs you time. Range 0.3-3.
  scrapeFriction: 1.15,

  // Extra one-off speed loss scaled by how hard you hit, per m/s of impact
  // speed. Range 0-0.05.
  impactScrub: 0.018,

  // Fraction of yaw rate killed per second of contact, so a wall stops a spin
  // instead of letting the car pirouette along it. Range 1-8.
  yawScrub: 3.5,
};

// ============================================================================
// AI
// ----------------------------------------------------------------------------
// The racing line, the speed profile and the driver holding the controls.
// Nothing here changes what a car can do -- an AI car runs the same
// VehiclePhysics the player does, so every one of these numbers only changes
// how well the thing driving it uses what the car already has.
// ============================================================================
export const AI = {
  // --- the racing line ------------------------------------------------------

  // Metres kept between the racing line and the edge of the tarmac. Half a car
  // is about a metre, so this is "the outside wheels stay on the road". Lower
  // it and the line uses more of the track and starts putting wheels on the
  // curb, which the lap validator is entitled to call an off. Range 0.6-2.5.
  lineMargin: 1.15,

  // The multigrid schedule: which strides the line is solved at, coarsest
  // first, and how many descent passes each of them gets. The coarse levels
  // place the apexes and cost almost nothing because there are so few points;
  // the fine levels only tidy up. All of it runs once, at track load.
  lineLevels: [16, 8, 4, 2, 1],
  linePasses: [4000, 1500, 700, 400, 250],

  // How far each pass steps downhill. The fourth-difference operator has
  // eigenvalues up to 16, so anything at or above 0.125 diverges and the line
  // slams into the edge of its corridor everywhere -- which is exactly what it
  // did at 0.75. Range 0.02-0.1.
  lineRelax: 0.06,

  // --- the speed profile ----------------------------------------------------

  // How much of the front tyres' peak the profile plans around, AFTER the roll
  // penalty has been taken out of it. Below 1 because a tyre's peak is a peak:
  // sitting exactly on it means every bump and every load change is on the far
  // side of it.
  //
  // This is the single number that decides how fast the AI is, and it is most
  // of what a difficulty setting will move. Measured, in the Cube GT, on
  // Copper Flats / Harbor Nine / Pine Ridge / Skyline Interchange / Glacier
  // Pass, after the slope force and GRIP.speedGrip went in:
  //
  //     0.58   52.2 / 74.3 / 81.7 / 71.0 / 105.7
  //     0.66   48.6 / 68.5 / 75.0 / 65.5 /  97.6
  //     0.74   46.3 / 63.8 / 69.6 / 61.1 /  91.1
  //     target 55   / 70   / 80   / 68   / 100
  //
  // 0.66 laps at or inside every track's target. Those targets were set before
  // the cars gained high-speed grip, so on the fast tracks it is now well
  // inside them. Range 0.5-1.0.
  gripUse: 0.66,

  // Braking effort relative to that, so a driver can be committed on the brakes
  // and cautious in the corner or the other way round. Range 0.8-1.1.
  brakeMargin: 0.98,

  // Longitudinal grip the profile assumes is left when the tyres are entirely
  // committed to cornering, as a fraction of the total. Without a floor here a
  // flat-out corner produces a braking point an infinite distance upstream.
  // Range 0.05-0.35.
  longFloor: 0.18,

  // --- the driver -----------------------------------------------------------

  // Pure pursuit lookahead: a fixed part plus this many metres per m/s of the
  // speed the driver is planning for. Short makes the car dart at the line,
  // long makes it cut corners. Range 4-16, 0.6-2.0, 25-70.
  lookMin: 7,
  lookGain: 1.0,
  lookMax: 45,

  // ...and capped at this many corner radii, whatever the speed says.
  //
  // This is the one that decides whether the AI can get round a hairpin. Pure
  // pursuit aims at a point on the line, and if that point is most of a corner
  // away the chord to it cuts straight across the apex -- so the car turns in
  // too little, runs wide, and does it at a speed the profile had no complaint
  // about. On Harbor Nine's 16 m corners a 21 m lookahead put every car five
  // metres off the road at 28 km/h. Range 0.35-1.2, and never below lookFloor.
  lookRadius: 0.65,
  lookFloor: 5,

  // Steering response. Gain converts the angle to the aim point into lock;
  // damp subtracts a slice of the yaw the car already has, which is what stops
  // the heavy cars weaving; rate is how fast the driver's hands move, in units
  // of lock per second. Range 1.2-3, 0.2-0.8, 3-12.
  steerGain: 2.2,
  steerDamp: 0.45,
  steerRate: 5.5,

  // How hard the driver pulls back toward the line when sitting beside it, per
  // metre of error, and the most of the steering that term is allowed to take.
  // Pure pursuit on its own has no opinion about being parallel to the line but
  // a metre off it; this does. Too much and the car saws at the line on the
  // straights. Range 0.05-0.4, 0.1-0.6.
  crossGain: 0.16,
  crossMax: 0.35,

  // Pedals. The gains turn a speed error in m/s into pedal travel, the deadband
  // stops the driver pumping either pedal at the target speed, and pedalRate is
  // how fast a foot moves. Range 0.3-1.2, 0.2-1.0, 0.05-0.6, 3-12.
  throttleGain: 0.55,
  brakeGain: 0.45,
  deadband: 0.25,
  pedalRate: 6.0,

  // How far ahead the driver reads the profile: a fixed part plus this many
  // seconds of travel. The profile has already placed the braking points, so
  // this only has to cover the driver's own reaction. Range 3-15, 0.15-0.8.
  brakeLookMin: 6,
  brakeLookTime: 0.35,

  // Rear slip angle at which the driver is fully off the throttle, radians, and
  // how much of the throttle that takes. This is what stops pure pursuit
  // spinning the loose-rear cars on corner exit. Range 0.08-0.3, 0.5-1.
  slipBudget: 0.15,
  slipLift: 0.9,

  // Speed the driver crawls back to the line at after running wide, m/s.
  // Without it a driver off the road holds full lock at walking pace, never
  // recovers, and posts a three hundred second lap for one mistake. Range 8-25.
  recoverSpeed: 16,

  // How quickly the habitual wander fades out as the road starts turning, per
  // 1/m of curvature. Higher means the driver is tidy in more of the corner.
  // Range 20-90.
  tidyAtCorners: 45,

  // --- racing other cars ----------------------------------------------------
  // None of these do anything in time trial, where the driver is alone.

  // How far ahead a driver looks for traffic: a fixed part plus this many
  // seconds of travel. Longer is a driver who plans a pass earlier; shorter is
  // one who arrives on the back of somebody first. Range 6-20, 0.6-2.
  awareBase: 10,
  awareTime: 1.1,

  // Clear air a driver leaves beside a car it is passing, metres, on top of the
  // two cars' half widths. Lower is closer racing and more rubbing. 0.7 was
  // too close once the real cars were made quicker and the field ran nearer
  // the Wedge One's pace: a Wedge caught in the pack on Pine Ridge rubbed for
  // 5.7% of the race. 0.85 was too close again once they cornered harder
  // (STREET.grip 1.8), at 9.3%. Range 0.3-1.5.
  passGap: 1.0,

  // The closest a passing lane comes to the edge of the tarmac, metres, before
  // the car's own half width. At 0.6, with the real cars cornering harder, a
  // car passing on the outside of Copper Flats' long left-hander ran the
  // exit on the kerb for four seconds. Range 0.3-2.
  passEdge: 1.0,

  // How fast a driver moves across into a passing lane, metres per second, and
  // how long it keeps to that lane once the car it was passing is out of its
  // lookahead. Ranges 1-4, 0.5-3.
  passRate: 2.2,
  passHold: 1.2,

  // When there is no room to pass: the following distance kept, a fixed gap
  // plus this many seconds at the current speed. 0.45 with the harder
  // cornering real cars, which close up in the corners. Ranges 2-8, 0.15-0.6.
  followGap: 4,
  followTime: 0.45,

  // Whatever else a driver is doing -- passing included -- it never closes on
  // a car in its own path faster than it could brake to that car's speed in
  // the gap between them, at this deceleration, m/s^2. This is the rule that
  // stops rear-ending. Lower is more cautious. Range 3-8.
  followDecel: 5,

  // Seconds after the start that a driver holds its grid lane before joining
  // the racing line, so a two-by-two grid does not converge on one groove into
  // the first corner. Range 0-6.
  startHold: 3,

  // --- mistakes -------------------------------------------------------------
  // How long a mistake lasts, seconds, and how big it is: a braking point this
  // fraction too fast (an overshoot), an apex missed by this many metres, and a
  // lift that holds the throttle to this much. How OFTEN a driver makes one is
  // the difficulty's mistake rate, per corner. Ranges 0.6-2, 0.03-0.15,
  // 0.5-2.5, 0.1-0.6.
  mistakeTime: 1.3,
  mistakeLate: 0.08,
  mistakeWide: 1.4,
  mistakeLift: 0.3,
};

// ============================================================================
// RACE
// ----------------------------------------------------------------------------
// Race mode: the grid, the countdown, how hard the field is, and what happens
// at the flag. The track select screen sets laps, opponents and difficulty;
// these are the defaults it starts from before you have chosen any.
// ============================================================================
export const RACE = {
  // Defaults for a new race. Range 1-10, 1-7.
  laps: 3,
  opponents: 5,
  maxOpponents: 7,
  difficulty: 'club',

  // Seconds of lights before the start. The spec's three. Range 2-5.
  countdown: 3,

  // The standing grid, two by two and staggered, behind the start line. First
  // row this far behind it, rows this far apart, the right-hand slot of each
  // row this much further back, and the two slots this far either side of the
  // centreline. Metres. Ranges 5-15, 7-12, 2-6, 2-4.
  gridFirst: 9,
  gridRow: 9,
  gridStagger: 4.5,
  gridLateral: 2.8,

  // What the difficulty is measured against: the lap this chassis would do on
  // this track at this gripUse, from its speed profile. That is a clean, quick
  // Porsche 911 lap, the car a new player starts in.
  referenceChassis: 'porsche-911',
  referenceGrip: 0.66,

  // Difficulty. `pace` is the lap time each opponent is tuned to, as a
  // multiple of that reference, so a field with two Wedge Ones in it is no
  // quicker than one of Cube GTs -- the braver drivers are simply in the slower
  // cars. `brake` scales every driver's braking margin, and `mistakes` is the
  // chance per corner of an early lift, a missed apex or an overshoot.
  //
  //   Rookie  beatable in a Cube GT on the first go
  //   Club    a clean, committed lap wins
  //   Pro     the reference lap, driven by people who do not lift
  //
  // Ranges: pace 0.95-1.3, brake 0.85-1.02, mistakes 0-0.35.
  levels: {
    rookie: { name: 'Rookie', pace: 1.16, brake: 0.92, mistakes: 0.22 },
    club: { name: 'Club', pace: 1.06, brake: 0.97, mistakes: 0.08 },
    pro: { name: 'Pro', pace: 0.995, brake: 1.0, mistakes: 0.02 },
  },

  // The range a driver's grip use is held to when the race tunes it to a lap
  // time. Above maxGrip a chassis is being asked for more than it has and goes
  // off; below minGrip a fast car becomes slow in corners but still quick on the
  // straights, brakes far earlier than everyone round it, and gets driven into.
  // A driver who would need less than minGrip runs at minGrip and has their
  // whole speed plan scaled down instead, straights included. Ranges 0.4-0.6,
  // 0.7-0.9.
  minGrip: 0.5,
  maxGrip: 0.8,

  // How far a driver's own style moves their pace either side of the field's,
  // per unit of their gripUse away from 0.65. Keeps the field spread out rather
  // than five cars on the same lap time. Range 0-0.8.
  driverSpread: 0.4,

  // Rubber banding. Off by default, as the spec asks: when on, an opponent
  // behind the player gets up to catchUpBonus extra target speed, reaching the
  // full amount at catchUpRange metres behind. Ranges true/false, 0-0.1, 50-400.
  catchUp: false,
  catchUpBonus: 0.04,
  catchUpRange: 150,

  // Seconds after crossing the line before the results appear. Range 0.5-4.
  resultsDelay: 1.5,

  // Seconds after the player finishes before anyone still running is
  // classified as not finished. Range 20-180.
  finishTimeout: 60,

  // How hard the car is driven round the cool-down lap after the flag, when
  // the AI takes over. Range 0.3-0.6.
  coolDownGrip: 0.45,
};

// ============================================================================
// CONTACT
// ----------------------------------------------------------------------------
// Car against car. The same idea as the barrier response: the cars are pushed
// apart, the speed going into each other is taken out, and the speed sliding
// along each other is scrubbed. It must cost time without deciding a race: the
// player cannot punt an AI car across the map, and an AI car cannot end the
// player's race.
// ============================================================================
export const CONTACT = {
  // Bounce given back from a hit. Keep it low or it turns into bumper cars.
  // Range 0-0.3.
  restitution: 0.1,

  // The most one contact can change either car's speed, m/s. This is the cap
  // that stops a heavy car at full speed launching a light one. Range 1-8.
  maxDeltaV: 4,

  // Fraction of the speed two cars are sliding along each other at that is
  // lost per second of contact. Range 0.3-3.
  scrape: 1.4,

  // Fraction of yaw rate killed per second of contact, so a touch does not
  // spin a car. Range 1-8.
  yawScrub: 3,

  // Extra radius round each car's body, metres. Range 0-0.2.
  pad: 0.05,

  // Cars further apart in height than this do not touch -- one is on the
  // flyover and the other is underneath it. Metres. Range 1.5-5.
  maxHeight: 2.5,
};

// ============================================================================
// GHOST
// ----------------------------------------------------------------------------
// Your best lap, replayed as a translucent copy of the car you set it in. Time
// trial only. Recorded on the physics clock; see game/Ghost.js.
// ============================================================================
export const GHOST = {
  // Samples per second of lap time. The spec's 30. The ghost is interpolated
  // between samples, so this is fidelity through quick direction changes, not
  // smoothness. Range 15-60.
  hz: 30,

  // Opacity of the ghost car. Range 0.15-0.6.
  opacity: 0.34,

  // Within this many metres of your car the ghost fades further, down to
  // closeOpacity, so you are not looking through a shell parked on your
  // bonnet. Range: fadeNear 3-12, closeOpacity 0.05-0.3.
  fadeNear: 7,
  closeOpacity: 0.1,

  // Self light, so the ghost still reads on a night track. 0 is none.
  // Range 0-0.6.
  glow: 0.35,

  // A lap longer than this, in seconds, is not recorded -- a car left idling
  // on the track would otherwise fill memory. Range 120-1200.
  maxLap: 600,
};

// ============================================================================
// EFFECTS
// ----------------------------------------------------------------------------
// What the wheels leave behind: dust and gravel on loose surfaces, tyre smoke
// when the rear lets go, and skid marks on tarmac. Visual only -- none of it
// reaches the physics. See render/Effects.js.
// ============================================================================
export const EFFECTS = {
  // Particles are one pool of small cubes, one draw call. The most alive at
  // once; past this the oldest are recycled. Fine particles need a lot of
  // them, and each one is a matrix write a frame, nothing more. Range 300-5000.
  maxParticles: 3200,

  // Dust and gravel from the driven wheels on gravel and grass.
  dustRate: 110,       // per second per wheel at dustFullSpeed. Range 10-200
  dustFullSpeed: 30,   // m/s at which a wheel throws its full rate. Range 10-50
  dustMinSpeed: 2.5,   // m/s below which nothing is thrown. Range 0.5-6
  dustLife: 1.1,       // seconds. Range 0.4-2.5
  dustSize: 0.15,      // metres, starting edge length. Range 0.06-0.6
  dustGrow: 2.0,       // how many times bigger it swells. Range 1-5
  dustCarry: 0.3,      // fraction of the car's velocity it leaves with. Range 0-0.8
  dustLift: 2.4,       // m/s upwards. Range 0.5-5
  dustSpread: 1.6,     // m/s of random scatter. Range 0-4
  // Fraction of it that is small, dark, heavy chips of the surface that fall
  // straight back down rather than hanging. Range 0-0.5.
  chipShare: 0.25,

  // Tyre smoke from the rear wheels, once the rear slip angle is past this
  // multiple of GRIP.peakSlipAngle -- past the limit, not approaching it.
  // Range 0.8-1.6.
  smokeSlip: 1.05,
  smokeRate: 140,      // per second per wheel in a full slide. Range 10-250
  smokeLife: 1.5,      // seconds. Range 0.6-4
  smokeSize: 0.18,     // metres. Range 0.08-0.8
  smokeGrow: 3.2,      // Range 1.5-9
  smokeRise: 0.9,      // m/s. Range 0-2.5
  // A light grey rather than near white, so sunlit smoke stays under the bloom
  // threshold instead of glowing. Was 0xdad8d2.
  smokeColor: 0xc9c7c1,
  // A standing start at full throttle lights the rears up for the first few
  // metres: below launchSmokeSpeed (m/s) with the throttle past launchThrottle.
  launchSmokeSpeed: 9,  // Range 0-15
  launchThrottle: 0.9,  // Range 0.5-1
  // ...and only while the rear tyres are being asked for at least this share
  // of their grip, so it follows the drive rather than the pedal: revving in
  // neutral, or pulling away in a tall gear, leaves them clean. Every car
  // launches at 1 and settles to 0.6-0.7 by walking pace; pulling away in
  // top gear asks for 0.4 at most. 0.9 was right on the old, looser tyres and
  // left a 911 on the new ones about 40 cm of marks. Range 0.45-1.
  launchDriveUse: 0.55,
  // Launch smoke is its own finer haze. It is laid right under the chase
  // camera, where slide-sized smoke fills the screen.
  launchSmokeRate: 160,  // per second per rear wheel. Range 20-300
  launchSmokeSize: 0.09, // metres. Range 0.04-0.3
  launchSmokeGrow: 2.2,  // Range 1-5
  launchSmokeLife: 0.9,  // seconds. Range 0.3-2
  launchSmokeRise: 0.5,  // m/s. Range 0-2

  // Skid marks, laid by a sliding rear tyre on tarmac. Segments in the ring;
  // past this the oldest are overwritten. Range 1000-12000.
  maxSkidSegments: 6000,
  skidSlip: 1.0,       // multiple of peakSlipAngle at which a tyre marks. Range 0.7-1.6
  skidLife: 20,        // seconds a mark holds full strength. Range 3-90
  skidFade: 6,         // seconds it then takes to fade away. Range 1-20
  skidOpacity: 0.62,   // Range 0.2-0.9
  skidColor: 0x111214,
  skidWidth: 0.26,     // metres, for a 0.33 m wheel; scales with wheel size. Range 0.15-0.4
  skidStep: 0.3,       // metres between segment ends. Range 0.1-1
};

// ============================================================================
// GEARBOX (manual mode, and the garage's gearbox tune)
// ----------------------------------------------------------------------------
// In automatic, on a stock gearbox, the physics has no gears and nothing here
// is read. In manual (B, or the garage's Gearbox setting) the gear the player
// picks decides how much of the drive force reaches the tyres, on the
// player's car only: the AI, auto drive and every check never set manual.
// The ratios are AUDIO.firstGearTop and each voice's gear count below, so the
// rev counter, the engine note and the drive all agree. See game/Gearbox.js.
//
// A tuned gearbox (the garage's Gearbox section, kept per chassis) drives
// through its gears in automatic too: the physics changes gear at the tune's
// shift point and pulls through the same bands as manual. The AI and every
// check drive stock gearboxes.
// ============================================================================
export const GEARBOX = {
  // Fraction of the redline above which a gear pulls with the car's full
  // force. Below it the engine is lugging and the pull falls toward what the
  // gear gives from a standstill. Shifting up at the redline lands every car
  // inside this band; shifting early does not. Range 0.3-0.8.
  pullBand: 0.6,
  // How hard a tall gear pulls away from a standstill, as a power of its ratio
  // to first gear. At 1, second pulls about 3/4 of first and top gear about
  // 1/4. Higher punishes pulling away in the wrong gear harder. Range 0.5-2.
  lugExponent: 1.0,
  // Rev limiter: drive fades out between this fraction of the redline and the
  // redline itself, so a gear held too long stops pulling. Range 0.9-0.99.
  limiter: 0.97,
  limiterHz: 14,    // how fast the needle and the note bounce on it. Range 6-25
  limiterDip: 0.05, // how far each bounce drops the revs, fraction of the redline. Range 0-0.12

  // --- the gearbox tune -----------------------------------------------------
  // Final drive, as a multiple of the stock ratio. A shorter one (above 1)
  // multiplies the torque at the wheels, so the drive force rises by it, and
  // spins the engine faster at every road speed, so the speed the engine runs
  // out at falls by it: more pull wherever the tyres can take it -- mostly
  // above 80 mph, since every car is grip limited below that -- and a lower top
  // speed. A longer one is the reverse. The garage steps it by finalDriveStep.
  // Range: min 0.6-1, max 1-1.5, step 0.01-0.1.
  finalDriveMin: 0.8,
  finalDriveMax: 1.25,
  finalDriveStep: 0.05,
  // Where each gear runs out, as a fraction of the speed the engine runs out
  // at, stepped by gearStep. Neighbouring gears are kept at least gearGap
  // apart and first gear no shorter than firstGearMin; top gear can be no
  // taller than 1. Range: step 0.005-0.03, gap 0.01-0.1, first 0.04-0.15.
  gearStep: 0.01,
  gearGap: 0.03,
  firstGearMin: 0.06,
  // Where the automatic changes up, a fraction of the redline (AUDIO.shiftUp
  // is stock). Low and every upshift drops the revs out of pullBand and the
  // car bogs; the top is kept below `limiter`, or the automatic would sit on
  // the limiter and never change up. Changes down move with it. Range: min
  // 0.6-0.8, max below limiter, step 0.005-0.05.
  shiftPointMin: 0.7,
  shiftPointMax: 0.96,
  shiftPointStep: 0.01,
  // A tuned gearbox's engine has a power curve: full power at powerPeak of
  // the redline, falling away either side as 1 - powerDrop * (revs - peak)^2
  // -- 0.8 of peak at pullBand and 0.93 at the redline, as set. A tuned car
  // pulls by its power at its own revs over its power at the stock gearbox's,
  // so ratios and a shift point that keep the revs near the peak gain a
  // little on stock, and ones that drop them low lose more. A stock gearbox
  // never reads this. Range: peak 0.7-0.95, drop 1-6.
  powerPeak: 0.85,
  powerDrop: 3.2,
};

// ============================================================================
// AUDIO
// ----------------------------------------------------------------------------
// Synthesised with the Web Audio API, no files. See core/Audio.js. The engine
// pitch comes from the gearbox. In automatic it exists only to be heard and
// read on the HUD. In manual its ratios (firstGearTop and each voice's gears)
// are also the ratios the car drives through; see GEARBOX above.
// ============================================================================
export const AUDIO = {
  // Master volume at first launch, 0-1. The slider on the pause card saves
  // over it.
  volume: 0.7,

  // Engine: two saw waves an octave apart through a lowpass filter.
  engineGain: 0.22,      // Range 0.05-0.5
  engineOffGain: 0.55,   // fraction of that off the throttle. Range 0.2-1
  engineSub: 0.6,        // level of the octave-down saw. Range 0-1
  engineQ: 1.4,          // filter resonance. Range 0.5-6
  // Filter cutoff in Hz at idle, and how far it opens at the redline with the
  // throttle pinned. The opening is most of the difference between an engine
  // that sounds loaded and one that sounds like a kazoo. Range: base 100-800,
  // range 800-6000.
  filterBase: 260,
  filterRange: 3200,
  // How far the engine drops for the instant of a gear change, as a fraction
  // of its level. Range 0.1-1 (1 is no dip).
  shiftDip: 0.3,
  // Time constant, seconds, for every sound parameter to reach its target.
  // Lower is snappier and can click. Range 0.01-0.1.
  smoothing: 0.03,

  // The gearbox. First gear runs out at firstGearTop of the chassis's top
  // speed, top gear at the top speed itself, and the ones between are spaced
  // so every upshift drops the revs by the same ratio.
  firstGearTop: 0.26,    // Range 0.15-0.4
  shiftUp: 0.94,         // fraction of the redline it changes up at. Range 0.8-0.99
  shiftDown: 0.7,        // changes down when the lower gear would sit below this. Range 0.4-0.8
  shiftTime: 0.12,       // seconds the dip lasts. Range 0.05-0.3
  // Off the line the clutch slips: revs up to launchRpm of the redline with
  // the throttle pinned, until first gear catches up at clutchCatch of its
  // own top. Range: launchRpm 0.4-0.9, clutchCatch 0.2-0.8.
  launchRpm: 0.72,
  clutchCatch: 0.45,
  rpmRate: 14,           // how fast the revs chase their target, per second. Range 5-30

  // Each chassis's voice. cylinders set the firing frequency (rpm / 60 *
  // cylinders / 2), burble the lumpy chop at idle a big V8 has and a four
  // cylinder does not.
  // The real cars have their real engine layout, idle, redline and gear
  // count. firstGearTop, where given, replaces the one above for that car.
  voices: {
    // First gear runs to about 40 mph, eighth is an overdrive it never tops out.
    'porsche-911':         { cylinders: 6, idle: 850, redline: 7500, gears: 8, burble: 0.12, firstGearTop: 0.138 },
    'mustang-gt':          { cylinders: 8, idle: 700, redline: 7500, gears: 6, burble: 0.32, firstGearTop: 0.225 },
    // A Muncie four-speed: first to about 56 mph, top runs out near top speed.
    'chevelle-ss':         { cylinders: 8, idle: 750, redline: 6000, gears: 4, burble: 0.45, firstGearTop: 0.375 },
    'ferrari-enzo':        { cylinders: 12, idle: 1000, redline: 8200, gears: 6, burble: 0.04, firstGearTop: 0.171 },
    'lamborghini-huracan': { cylinders: 10, idle: 1000, redline: 8500, gears: 7, burble: 0.08, firstGearTop: 0.157 },
    // Electric: one gear to top speed, no idle, and a motor whine at `whine`
    // times the motor speed in place of firing pulses (Audio.js).
    'tesla-roadster':      { electric: true, whine: 3, cylinders: 0, idle: 0, redline: 18000, gears: 1, burble: 0, firstGearTop: 1 },
    'wedge-one':           { cylinders: 10, idle: 1400, redline: 11500, gears: 7, burble: 0.06 },
  },
  defaultVoice: { cylinders: 4, idle: 900, redline: 7000, gears: 6, burble: 0.15 },

  // Tyre scrub: band-passed noise rising with slip. Starts at scrubStart and
  // is full at scrubFull, both multiples of GRIP.peakSlipAngle.
  scrubGain: 0.3,        // Range 0-0.8
  scrubStart: 0.85,      // Range 0.5-1.2
  scrubFull: 1.6,        // Range 1.1-2.5
  scrubFreq: 850,        // Hz. Range 400-2000
  scrubQ: 1.2,           // Range 0.5-4
  // Gravel and grass: a lower, rougher rumble with speed. Range 0-0.6.
  looseGain: 0.24,
  looseFreq: 380,        // Hz. Range 150-900
  // Wind, rising with the square of speed. Range 0-0.3.
  windGain: 0.07,
  windFreq: 1400,        // Hz. Range 600-4000

  // Thump on a hit or a landing. Full strength at thumpFull m/s of impact.
  thumpGain: 0.9,        // Range 0-1.5
  thumpFull: 10,         // Range 4-20

  // The start: three identical tones as the lamps come on, one an octave up
  // when they go out.
  beepFreq: 520,         // Hz. Range 300-1000
  beepLength: 0.22,      // seconds. Range 0.08-0.5
  goLength: 0.6,         // seconds. Range 0.2-1.2
  beepGain: 0.3,         // Range 0-0.8
};

// ============================================================================
// FLIGHT
// ----------------------------------------------------------------------------
// The aircraft model's feel and its aids (src/flight, src/data/aircraft.js).
// What an aircraft IS -- its mass, wings, engines, gear and the figures it was
// fitted to -- lives in aircraft.js. This block is what the pilot feels of it:
// how the stick ramps, how much the flight computer helps, how hard the ground
// grips. Units are SI. Every aid is a knob, and `aids` is the master switch
// that takes them all away so you can feel the difference.
//
// Body axes are the cars': +x LEFT, +y up, +z nose. Pull is nose up, roll
// right is right wing down, yaw right is nose right.
// ============================================================================
export const FLIGHT = {
  // Master switch for the aids below (levelling, auto-trim, angle-of-attack
  // softening, the g limiter). false is the bare airframe. true/false.
  aids: true,

  // Roll self-levelling when the roll stick is centred: aileron command per
  // radian of bank, the most the aid may command (a fraction of full), and
  // the pitch (rad) past which it stands off so it cannot fight a loop.
  // OFF by default (0): the first version used 0.9 and levelled the wings the
  // moment you let go of the roll key, which made it impossible to hold a
  // turn. Range: strength 0-3, limit 0.1-0.6, maxPitch 0.5-1.4.
  levelStrength: 0,
  levelLimit: 0.3,
  levelMaxPitch: 1.1,

  // Auto-trim: with the pitch stick centred the trim integrates until the
  // flight path stops curving, so a speed change does not pitch the aircraft.
  // Rate is trim (a fraction of full) per rad/s of path curvature per second;
  // limit is how much trim it may hold; minSpeed (m/s) is where it switches on;
  // filter (s) smooths the path rate it reads. It holds only a shallow path:
  // past maxPath (rad of climb or dive) it lets go and the trim relaxes toward
  // neutral over `relax` seconds, so the airframe's own stability brings the
  // nose back up in a dive instead of holding it into the ground.
  // Rate was 0.7, which took about 10 s to find the trim after a change of
  // speed, and the aircraft climbed away meanwhile (through Mach 1 it was
  // thirty degrees nose up by the time the trim caught up); 4 finds it in two.
  // Range: rate 0.1-6, limit 0.3-0.9, minSpeed 30-90, filter 0.1-0.6,
  // maxPath 0.15-0.8, relax 2-20.
  trimRate: 4,
  trimLimit: 0.6,
  trimMinSpeed: 50,
  trimFilter: 0.25,
  trimMaxPath: 0.35,
  // The climb has its own, much higher limit: let go of a climb and the nose
  // keeps coming up (the airframe is not balanced at zero trim at speed), so
  // the trim holds the path in any climb short of nearly vertical. Dives keep
  // the short limit above. Range: 0.4-1.45.
  trimMaxClimb: 1.2,
  trimRelax: 5,
  // And when the stick is held steadily instead of centred -- the flight path
  // is not curving, so it is back pressure holding level -- the trim takes the
  // pressure up: trimHold per second per unit of stick, while the path rate is
  // under trimSteady (rad/s). This is the pilot trimming off the stick force.
  // Range: hold 0-1, steady 0.001-0.02.
  trimHold: 0.35,
  trimSteady: 0.004,

  // Angle-of-attack softening. Pull fades out between softAlpha and 1 times
  // the stall angle and the nose is pushed down by softPush (a fraction of
  // full) at the stall, so it mushes down rather than snapping into a spin.
  // warnAlpha is where the stall warning starts, as a fraction of the stall.
  // Range: softAlpha 0.6-0.98, softPush 0-1, warnAlpha 0.5-0.95.
  softAlpha: 0.88,
  softPush: 0.7,
  warnAlpha: 0.8,

  // Sideslip limiter: the rudder fades between half this angle (rad) and all
  // of it, down to betaFloor of its authority, so a held pedal settles at a
  // sideslip near the limit instead of skidding the whole aircraft sideways or
  // swinging back through it. Range: limit 0.1-0.5, floor 0.1-0.8.
  betaLimit: 0.22,
  betaFloor: 0.35,

  // The g limits are a safety net over a stick that already settles a full pull
  // at about 8.5 g and a full push at about -2 g (see dampPitch, pushAuthority).
  // Each is a cap on the stick that integrates: cut at gCutRate (a fraction of
  // the stick, per g past the limit, per second) and given back at gRelease (a
  // fraction a second) once under. The limit is the aircraft's (aircraft.js gLimit
  // 9, gLimitNeg -3); gLead (s) looks ahead along the load factor's rate. A limit
  // that fades the stick in proportion to the load had a loop gain of five with
  // the airframe's short period in it, and made the stabilators chatter two or
  // three times a second. Range: cut 0.2-3, release 0.2-3, lead 0-0.2.
  gCutRate: 2,
  gRelease: 1.0,
  gLead: 0.05,
  // How much of the pull's authority a push has: a full push settles at about
  // -2 g and the nose is not hurled down (it was -5 to -6 g, and the nose then
  // sprang back from fifteen degrees of negative incidence). Range 0.3-1.
  pushAuthority: 0.4,

  // Tail strike protection, the flight computer's. Pull is faded out as the nose
  // approaches the attitude at which the tail would touch the ground (worked out
  // from the tail point, and the height of the aircraft over the ground), and
  // pushed back past it. tailMargin is the clearance (m) kept; tailBand the
  // attitude (rad) over which the pull fades; tailLead (s) looks ahead along the
  // pitch rate so a fast rotation does not carry through; tailGuardHeight is the
  // height (m, centre of mass over the ground) above which it stops looking.
  // Range: margin 0-0.6, band 0.02-0.15, lead 0-0.6, guard 8-30.
  tailMargin: 0.08,
  tailBand: 0.05,
  tailLead: 0.3,
  tailGuardHeight: 14,
  // A tail that does touch is scraped, not wrecked: only a strike this hard (m/s
  // into the ground) or this deep (m) is a crash. Range: speed 4-14, depth 0.2-1.
  skidCrashSpeed: 9,
  skidCrashDepth: 0.6,

  // The parking hold. With the throttle at or under parkThrottle, the weight on
  // the wheels and the aircraft slower than parkSpeed (m/s) it stands still, as
  // it would on its brakes: idle thrust is more than the tyres' rolling
  // resistance, and left alone the aircraft crept off down the runway and
  // reached 20 m/s. (The taxi governor below makes the lever a speed from here
  // up: 0.05 asks for 2 m/s, so the dead band of the lever is small.) Range:
  // throttle 0.02-0.25, speed 0.1-2.
  parkThrottle: 0.04,
  parkSpeed: 0.5,

  // Control authority of the stick, the damping and the rudder is full below
  // this dynamic pressure (Pa) and fades as qFadeRef / q above it, never below
  // qFadeMin, so the aircraft stays tame at speed. Lower is gentler fast. The
  // pitch trim is not faded (see AircraftPhysics): it only keeps the airframe
  // balanced. Was 14000, which left a full pull at Mach 1+ at 18-22 degrees a
  // second and the stick dead feeling. Range: ref 6000-30000, min 0.03-0.4.
  qFadeRef: 22000,
  qFadeMin: 0.1,

  // Rate damping, in stick (a fraction of full) per rad/s. This is most of
  // what the aircraft feels like, and in effect it sets the fastest the
  // aircraft will turn on each axis: full stick against the damping gives a
  // roll of about 1/dampRoll rad/s. More is steadier and slower to start, less
  // is twitchier (the first version, 0.12, rolled at 250 degrees a second).
  // Pitch is 0.7: at 0.4 a snapped full stick overshot its 9 g by 2 to 3 and
  // rang, and the limiter ringing with it was the stabilator chatter; at 0.7 the
  // load rises straight to its plateau, seven g in 0.3 to 0.5 s.
  // Range: pitch 0.05-1, roll 0.03-0.6, yaw 0.1-0.9.
  dampPitch: 0.7,
  // How the pitch damping fades with dynamic pressure, as a power of the stick's
  // fade: 1 fades it with the stick (the first version), 0 not at all. The
  // airframe's stiffness grows with q, so at 1 the short-period motion was
  // barely damped at speed. Range 0-1.
  dampFadePow: 0.5,
  dampRoll: 0.35,
  dampYaw: 1.6,

  // Keyboard stick ramp, units/second (full deflection is 1). Analog input
  // (a pad, the mouse) skips it. Range: attack 1.5-8, release 2-14.
  stickAttack: 2.0,
  stickRelease: 10.0,
  // The pitch key has its own, quicker ramp: a tap on the pitch key moved the
  // nose a couple of degrees at the old 2.0, which felt dead. Range: attack
  // 1.5-10, release 2-14.
  pitchAttack: 4.5,
  pitchRelease: 10.0,
  // The rudder's own ramp: pedals are quick. Range: attack 2-10, release 3-12.
  yawAttack: 6.0,
  yawRelease: 7.0,

  // The throttle lever: how fast a held key or the stick moves it, fraction of
  // travel per second. Range 0.15-1.
  throttleRate: 0.35,

  // Lag on the control surfaces, seconds. Range 0.02-0.2.
  actuatorTau: 0.07,

  // Thrust vectoring fades out as dynamic pressure (Pa) rises toward this and
  // the surfaces take over. Range 4000-30000.
  tvQ: 12000,

  // Fuel burned per second as a fraction of the real figure; 0 is endless.
  // Range 0-1.
  fuelBurn: 0.35,

  // The afterburner's own tank: seconds of full burner it holds, seconds to
  // refill from empty, and the level (0-1) it must refill to before it may be
  // lit again after running dry. Range: duration 20-180, refill 30-300,
  // relight 0.05-0.5.
  abDuration: 60,
  abRefill: 90,
  abRelight: 0.2,

  // The scheduled flaps come up between flapUp (m/s calibrated airspeed) and
  // flapUp less flapUpBand: fully down below the lower speed, fully up above
  // flapUp. Range: up 90-200, band 20-100.
  flapUp: 130,
  flapUpBand: 50,

  // Seconds for the gear to travel, and for the airbrake. Range 1.5-8, 0.5-3.
  gearTime: 4,
  airbrakeTime: 1.2,

  // Nose wheel steering: the most lock (rad) and the speed (m/s) at which it
  // has faded to half. Range: max 0.3-1.0, speed 10-60.
  noseSteerMax: 0.6,
  noseSteerSpeed: 25,

  // The ground assists (milestone 3), all of them off with the master switch
  // groundAssist. The nose wheel turns at most noseSteerRate rad/s (a tapped key
  // used to snap it to full lock), and its lock is limited so the side force it
  // asks of the tyres stays under noseSteerLatG (in g): the wheelbase makes the
  // turn, v squared times tan(lock) over the wheelbase, and a full lock at 25 m/s
  // asked for two or three g and scraped a wingtip. Range: rate 0.4-3, latG 0.1-0.6.
  groundAssist: true,
  noseSteerRate: 1.3,
  noseSteerLatG: 0.4,

  // The taxi governor. A fighter's idle thrust is more than its tyres' rolling
  // resistance, so there is no speed to hold with the lever alone: a real pilot
  // rides the brakes. On its wheels, with the lever at or under taxiLeverMax and
  // slower than taxiSpeedMax (m/s), the lever asks for a speed (taxiSpeedPerLever
  // times the lever: 0.1 holds 4 m/s, 0.25 holds 10) and the wheel brakes hold the
  // aircraft to it, a taxiBrakeGain of brake per m/s over, at most taxiBrakeMax.
  // Lever 0 stops it. It never touches the steering, and off the band (above the
  // lever or the speed, or in afterburner) it does nothing, so a takeoff roll and
  // a landing roll are the pilot's. The brake has to be able to hold the thrust the
  // lever gives (66 kN at 0.25, 80 at 0.3, against about 5 of rolling resistance:
  // the engine's lever is steep). Range: lever 0.15-0.5, per lever 20-80, speed
  // 10-40, gain 0.1-1.5, max 0.4-1.
  taxiLeverMax: 0.3,
  taxiSpeedPerLever: 40,
  taxiSpeedMax: 22,
  taxiBrakeGain: 0.6,
  taxiBrakeMax: 0.8,

  // Standing on the brakes: with the wheel brake past parkBrake the aircraft does
  // not move while the lever is under parkBrakeThrottle and it is slower than
  // parkSpeed, as a real one holds a run-up on its brakes. Range: brake 0.05-0.5,
  // throttle 0.3-1.
  parkBrake: 0.15,
  parkBrakeThrottle: 0.85,

  // The gear lever cannot raise the wheels while they carry the aircraft (the
  // weight on wheels, above gearLockWow of it), and short final with the gear up
  // is a warning: below gearWarnAgl metres of ground, slower than gearWarnCas
  // (m/s calibrated). Range: wow 0.05-0.5, agl 80-500, cas 60-200.
  gearLock: true,
  gearLockWow: 0.2,
  gearWarnAgl: 220,
  gearWarnCas: 110,

  // The ground. slipSpeed is how fast (m/s) a tyre must slide before its
  // friction is fully used. brakeFriction is the extra rolling drag at full
  // wheel brake, as a fraction of the load. hullFriction is a skin dragging
  // along the ground. wheelRadius is for the spin only. Range: slip 0.2-1.5,
  // brake 0.3-1, hull 0.2-0.9.
  slipSpeed: 0.5,
  brakeFriction: 0.6,
  hullFriction: 0.5,
  wheelRadius: 0.42,
  // Per surface: lateral is the tyre's side grip, rolling its rolling
  // resistance, both as a fraction of the load. Range: lateral 0.2-1.2,
  // rolling 0.01-0.2.
  surfaces: {
    tarmac: { lateral: 1.0, rolling: 0.02 },
    runway: { lateral: 1.0, rolling: 0.02 },
    grass: { lateral: 0.55, rolling: 0.07 },
    sand: { lateral: 0.4, rolling: 0.14 },
    rock: { lateral: 0.6, rolling: 0.09 },
    snow: { lateral: 0.3, rolling: 0.1 },
    gravel: { lateral: 0.5, rolling: 0.1 },
    water: { lateral: 0.15, rolling: 0.35 },
  },

  // Until crashes exist (milestone 5), a hit this hard (m/s into the ground
  // for the skin, m/s of sink for the gear) resets you to the runway.
  // Range: crashSpeed 2-10, maxSink 3-9.
  crashSpeed: 4,
  maxSink: 5.5,
};

// The flat test field of milestone 1: a plain with a runway on it, to learn
// the aircraft on before there is a world. Dimensions in metres.
export const FIELD = {
  // Half the side of the square plain. Range 5000-80000.
  half: 40000,
  // The runway: length, width, and the heading it points (0 is north, +z).
  // Range: length 1500-5000, width 30-90.
  runwayLength: 3500,
  runwayWidth: 60,
  // Distance from the near end of the runway the aircraft starts at, m.
  startOffset: 80,
  // Fog start and end, metres. The end sets how far you can see. Range:
  // near 1500-16000, far 6000-60000.
  fogNear: 8000,
  fogFar: 32000,
  // Spacing of the speed-reference pylons, metres, and how many rings of them.
  // Range: spacing 300-2000, rings 3-20.
  pylonSpacing: 800,
  pylonRings: 9,
  // Ground and sky colours, packed 0xRRGGBB.
  ground: 0x6f8f56,
  groundAlt: 0x7a9a5e,
  runway: 0x35383f,
  marking: 0xedede7,
  sky: 0x9cc4e6,
  skyTop: 0x3f78b8,
  sun: 0xfff1d6,
};

// ============================================================================
// FLIGHT CAMERA
// ----------------------------------------------------------------------------
// The chase camera follows the aircraft's own orientation, smoothed, so it
// banks and lags through a turn and swings behind you in a loop.
// ============================================================================
export const FLIGHT_CAMERA = {
  // Chase: metres behind and above the aircraft, and how much further back it
  // pulls at speed (m at 340 m/s). Range: distance 18-70, height 3-20,
  // pullback 0-40.
  distance: 38,
  height: 9,
  speedPullback: 18,

  // How fast the camera position and its heading follow the aircraft, per
  // second. Lower lags more. Range: position 2-12, orient 1.5-10.
  positionSpring: 6,
  orientSpring: 3.2,

  // How much the camera's up vector leans toward the world's up rather than
  // the aircraft's, so a roll does not whip the horizon around. 0 rolls with
  // the aircraft, 1 stays level. Range 0-1.
  upBlend: 0.65,

  // Field of view at rest and at 340 m/s, degrees. Range 55-100.
  fovMin: 64,
  fovMax: 84,
  fovSpring: 2.5,

  // Far orbit: distance (m) and the look-at height. Range 40-200.
  orbitDistance: 90,

  // Free look turning rate with the mouse (rad per pixel) and the right
  // stick (rad/s). Range: mouse 0.001-0.008, stick 1-5.
  lookMouse: 0.0035,
  lookStick: 2.6,
  // Free look eases back to centre at this rate when released. Range 1-12.
  lookReturn: 5,

  // The near plane grows with height above the ground so depth precision holds
  // over a long view: near = nearMin + nearPerMetre * height, never past
  // nearMax. Far is the field's fog end plus farMargin. Range: nearMin
  // 0.15-1, nearPerMetre 0.001-0.01, nearMax 4-40.
  nearMin: 0.3,
  nearPerMetre: 0.004,
  nearMax: 20,
  farMargin: 3000,

  // Shake from the afterburner and from the airframe in the stall, metres.
  // Range 0-0.3.
  shakeBurner: 0.04,
  shakeStall: 0.12,
};

// ============================================================================
// FLIGHT HUD
// ============================================================================
export const FLIGHT_HUD = {
  // The pitch ladder: a rung every this many degrees, and how many degrees
  // the horizon area shows top to bottom. Range: step 5-15, span 40-90.
  ladderStep: 10,
  ladderSpan: 60,
  // Colours: the timing palette, so a warning reads like a slower sector.
  warn: '#F5C518',
  alert: '#FF7A1A',
  ok: '#34D17A',
};

// ============================================================================
// FLIGHT AUDIO
// ----------------------------------------------------------------------------
// Synthesised, no files (core/FlightAudio.js). It plays into the car engine's
// master gain, so the one volume slider and the mute key govern it too.
// ============================================================================
export const FLIGHT_AUDIO = {
  // Overall level of the engine sound, 0-1. Was 0.28 for the old white-noise
  // voices; the new ones carry more energy for the same number, so it is
  // brought down to leave the afterburner about as loud as it was (measured
  // offline: -20 dB RMS against -21). Range 0.05-0.6.
  engineGain: 0.22,
  // The turbine's whine (the compressor), one tone per engine: pitch (Hz) at
  // idle and at military power, its level, and how far the second engine's
  // spool runs from the first (a ratio; the two beat against each other the way
  // a twin does). Range: idle 300-1200, mil 1200-3500, gain 0.01-0.3, beat
  // 1.002-1.05.
  whineIdle: 620,
  whineMil: 2100,
  whineGain: 0.07,
  whineBeat: 1.013,
  // The core's low rumble: the cutoff (Hz) of its low-pass at idle and at
  // military power, and its level as a multiple of the engine gain. It is
  // brown noise (a rumble, not a hiss) and swells and ebbs slowly. `rumbleFloor`
  // cuts the sub-bass under it (Hz): a laptop's speakers cannot play it and it
  // only eats the headroom. Range: idle 60-250, mil 200-700, gain 0.2-2.5,
  // floor 30-150.
  rumbleFloor: 80,
  rumbleIdle: 110,
  rumbleMil: 380,
  rumbleGain: 1.2,
  // The exhaust, the broad roar of the jet itself: the centre (Hz) of its band
  // at idle and at military power, and its level. It rises steeply with the
  // spool. Pink noise, which falls off with pitch as a jet does. Range: idle
  // 200-700, mil 600-2000, gain 0.1-1.5.
  exhaustIdle: 320,
  exhaustMil: 1000,
  exhaustGain: 0.7,
  // The afterburner: the level of its roar, the centre (Hz) of its raspy upper
  // band, the cutoff (Hz) of the deep rumble under it, and the flutter that
  // breaks that rumble up (rate in Hz and depth, 0-1). When it lights there is
  // a thump of `burnerKick`. Range: gain 0.05-0.8, freq 300-1500, low 120-500,
  // flutter 12-60, depth 0-0.8, kick 0-1.5.
  roarGain: 0.4,
  roarFreq: 560,
  burnerLow: 240,
  burnerFlutter: 29,
  burnerFlutterDepth: 0.45,
  burnerKick: 0.8,
  // Wind and airframe noise, rising with the square of airspeed. Level at
  // 340 m/s and the band centre (Hz). Range: gain 0-0.4, freq 400-2400.
  windGain: 0.1,
  windFreq: 900,
  // From the cockpit camera the cabin muffles everything above this (Hz); the
  // other cameras hear it all. Range 600-6000.
  cabinCutoff: 1500,
  // Stall warning: a two-tone chirp. Pitch (Hz), beeps a second, level.
  // Range: freq 500-1600, rate 2-8, gain 0.05-0.4.
  stallFreq: 880,
  stallRate: 4.5,
  stallGain: 0.22,
  // The sonic boom at Mach 1: its level, and the seconds between the crossing
  // and the sound (the boom arrives a moment after the aircraft does). Range:
  // gain 0-1.5, delay 0-1.
  boomGain: 0.9,
  boomDelay: 0.12,
  // How fast every sound parameter reaches its target, seconds. Range 0.02-0.15.
  smoothing: 0.06,
};

// ============================================================================
// THE SOUND BARRIER
// ----------------------------------------------------------------------------
// What happens as the aircraft goes through Mach 1 (render/ShockWave.js, the
// boom in core/FlightAudio.js, a kick of the camera in render/FlightCamera.js):
// rings of condensed air that spread out from where it crossed and are left
// behind, a sleeve of vapour round the airframe while it is in the transonic
// band, and a boom. Pure effect: nothing here touches the physics.
// ============================================================================
export const SHOCK = {
  // The Mach number that fires it going up, and the number the aircraft must
  // fall back under before it can fire again (so hovering on the line does not
  // stutter). Range: mach 0.9-1.2, rearm 0.85-0.99.
  mach: 1.0,
  rearm: 0.96,
  // The rings: how many, seconds apart, how long each lives, the radius (m)
  // they start at and spread to, how far (m) they slide back along the aircraft
  // while they do, and how bright the first is (0-1; each is a little fainter
  // than the last). They ride with the aircraft, because the chase camera sits
  // behind it and a ring left in the air would be behind the camera at once.
  // Range: count 1-5, gap 0.05-0.3, life 0.6-3, start 2-10, end 30-150, travel
  // 20-150, opacity 0.1-0.9.
  rings: 3,
  ringGap: 0.11,
  ringLife: 1.5,
  ringStart: 4,
  ringEnd: 70,
  ringTravel: 80,
  ringOpacity: 0.55,
  // The vapour sleeve: how bright it is at its best (0-1), how far either side
  // of Mach 1 it reaches (it is thickest on the line and gone at the edge), and
  // how big (m): the length along the airframe and the radius at its rear.
  // Range: opacity 0-0.8, band 0.02-0.2, length 6-20, radius 3-12.
  coneOpacity: 0.38,
  coneBand: 0.07,
  coneLength: 13,
  coneRadius: 7,
  // The jolt: the field of view jumps by this many degrees and eases back at
  // this rate (per second), and the camera shakes for a moment (metres, as the
  // afterburner's does). Range: kick 0-12, decay 2-12, shake 0-0.4.
  kickFov: 6,
  kickDecay: 5,
  shake: 0.22,
};

// ============================================================================
// FLIGHT INPUT
// ----------------------------------------------------------------------------
// Keyboard, gamepad and mouse flight (core/FlightInput.js). Stick deadzone and
// response curve are INPUT's, shared with the cars.
// ============================================================================
export const FLIGHT_INPUT = {
  // Mouse flight: the mouse moves a virtual stick. Sensitivity is stick
  // deflection per pixel (1 / this many pixels is full deflection), the
  // deadzone is the part of the travel around the centre that reads zero, and
  // the stick drifts back toward the centre at `return` per second (0 leaves it
  // where you put it). Range: sensitivity 0.001-0.008, deadzone 0-0.2,
  // return 0-3.
  mouseSensitivity: 0.0032,
  mouseDeadzone: 0.05,
  mouseReturn: 0.9,

  // The wheel moves the throttle this much per notch in mouse flight.
  // Range 0.02-0.2.
  wheelStep: 0.06,

  // The right stick's throttle: how fast it moves the lever, as a multiple of
  // the keys' rate. Range 0.5-3.
  stickThrottle: 1.6,

  // Reset to the hangar is a hold, so it cannot be hit by accident: seconds.
  // Range 0.4-3.
  resetHold: 1.0,

  // The wheel brake on the keyboard is not a switch: held, it comes on at
  // brakeAttack of full a second and goes off at brakeRelease. (A pad's trigger
  // is analog and is not ramped.) Range: attack 1-10, release 3-20.
  brakeAttack: 2.5,
  brakeRelease: 8,

  // Triggers and the cannon: how far a trigger must be pulled to fire.
  // Range 0.1-0.8.
  triggerFire: 0.3,
};

// ============================================================================
// OPEN WORLD
// ----------------------------------------------------------------------------
// The world flight is flown in (src/world, src/render/WorldMesh.js): seeded
// terrain streamed in chunks, a floating origin, biomes, and the six race
// tracks placed in it as flyover scenery with AI cars lapping them. (WORLD, far
// above, is the car game's terrain and render block; this is a different thing.)
//
// Everything is deterministic from `seed`: the same coasts, mountains, areas and
// airports are in the same places on every launch. Changing any shape knob in
// the first half of this block changes the whole map, so the track areas move
// with it -- they are placed by looking at the land, not at fixed coordinates.
// ============================================================================
export const OPEN_WORLD = {
  // --- the map ----------------------------------------------------------------
  // Side of the square world, metres, and the seed every noise layer is cut
  // from. Nothing that costs time or memory scales with the area. The chunk
  // tree covers 131,072 m, so size can go up to that. Range: size 40000-131000.
  size: 120000,
  seed: 195,

  // Land and sea. A slow fractal pattern, `continentScale` metres across, is
  // pushed through a threshold: above `seaThreshold` it is land, below it sea,
  // and `continentGain` is how fast the coast shelves. A higher threshold is
  // more ocean. The sea floor falls to `seaDepth` metres, and the last
  // `rimWidth` metres before the edge of the world are pushed under the sea by
  // `rimStrength` so nobody flies off the end of a plain.
  // Range: scale 12000-60000, threshold 0.40-0.55, gain 2-6, depth 100-800,
  // rim 4000-20000, strength 1-4.
  continentScale: 26000,
  seaThreshold: 0.475,
  continentGain: 3.4,
  seaDepth: 420,
  rimWidth: 9000,
  rimStrength: 2.4,

  // The coastal plain land rises to before anything else is added, metres, and
  // the lowest any land goes (hills and canyons never cut below it, so there
  // are no accidental lakes). Range: plain 20-200, floor 1-20.
  plainHeight: 60,
  landFloor: 3,

  // The ranges, hills and canyons are read through coordinates pushed about by a
  // slow noise, `warpAmount` metres at most, `warpScale` metres across, so the
  // value noise's square cells do not show in the crests. Range: scale 3000-20000,
  // amount 500-6000.
  warpScale: 9000,
  warpAmount: 2600,

  // Mountain ranges: where they are (`rangeScale` metres across, present where
  // the pattern is above `rangeThreshold`), how wide a ridge system is
  // (`mountainScale`) and how tall the highest crest gets, metres. Range:
  // rangeScale 15000-60000, threshold 0.4-0.65, mountainScale 4000-20000,
  // height 800-4000.
  rangeScale: 34000,
  rangeThreshold: 0.52,
  mountainScale: 9000,
  mountainHeight: 2300,

  // Rolling hills and surface break-up: wavelength and amplitude (peak to
  // trough is twice the amplitude), metres. The detail layer is what the
  // finest chunks (16 m cells) show. Range: hillScale 1200-6000, hillHeight
  // 30-300, detailScale 80-500, detailHeight 3-30.
  hillScale: 2600,
  hillHeight: 120,
  detailScale: 240,
  detailHeight: 11,

  // Canyons: a narrow cut where a slow pattern crosses its middle, present
  // only in some regions (`canyonRegionScale`), `canyonDepth` metres deep.
  // Range: region 15000-60000, scale 2000-12000, depth 40-400.
  canyonRegionScale: 30000,
  canyonScale: 6500,
  canyonDepth: 150,

  // --- airports ---------------------------------------------------------------------
  // What each kind of airport IS (its runway, taxiways, apron, hangars, lights) is
  // data, src/data/airports.js, with the home runway of milestone 2 as the major
  // airport; these are how they are placed, flattened, cleared and drawn.
  //   seedSalt     changes where the airports with no hint go, without touching the
  //                land. Any integer.
  //   candidates   seeded places tried for each one (the best fit wins), and
  //   headings     runway headings tried at each place, evenly round the circle on
  //                whole tens of degrees. Range: candidates 30-400, headings 4-16.
  //   spacing      the least gap between two airports' flattened zones, metres.
  //                Range 2000-15000.
  //   areaClear    the least gap between an airport's flattened zone and a race
  //                track's area, metres, and stripAllowance the room an area keeps
  //                for its own airstrip on top of that. Range: clear 1000-8000,
  //                allowance 1000-5000.
  //   stripGap     how far (metres) a track's airstrip's flat ground stands from the
  //                track's graded apron: beyond the track's own ground (areaInner),
  //                so the two never share a hillside. Range 700-3000.
  //   stripReliefCost, stripApproachCost  what a metre of relief across a strip's
  //                platform and a blocked step of its approach are worth, in metres of
  //                setback from its track: it takes the nearest spot, but prefers a
  //                level one with a clear approach. Range 0-100, 0-3000.
  //   minLand      the lowest ground under an airport's platform, metres above the
  //                sea, and ringLand the lowest in the ring its blend reaches.
  //                Range: minLand 4-40, ringLand 1-15.
  //   approach*    the land under each runway's extended centre line, out to
  //                approachLength metres (checked every approachStep), stays under
  //                the runway's height plus approachSlope times the distance plus
  //                approachMargin metres: ICAO's approach surface is 2 to 2.5%.
  //                Range: slope 0.01-0.04, length 2000-10000, step 100-500, margin
  //                0-80.
  //   propMargin   no scenery (trees, rocks) within this many metres of an airport's
  //                flat ground. Range 0-300.
  //   startOffset  how far down the runway "start on the runway" puts the aircraft
  //                (m), airDistance and airHeight where "start airborne" puts it
  //                (m back from the threshold, m up), hangarMouth how far in front
  //                of a hangar bay a reset stops (m). Range: 0-400, 800-6000,
  //                300-4000, 8-40.
  //   zone         the size of a hangar bay, metres: stop inside it to open the
  //                Hangar. Range w 24-60, d 26-60 (the fighter is 19 m by 13.6 m).
  //   buildDistance how near (m) an airport's meshes are built and kept (dropped
  //                beyond 1.4 times it). Range 8000-60000.
  //   lampDay, lampNight  how bright the lights are by day and at night, as the
  //                multiplier on their colour (above 1 the bloom pass picks them
  //                out). Range 0-1, 1-8.
  //   sink         how far (as a fraction of a chunk's cell) the ground under the
  //                pavement is lowered, for the coarse chunks far away, so pavement
  //                is never buried. 0 is off. Range 0-0.2.
  //   colors       the pavement, the paint and the buildings (packed 0xRRGGBB, in
  //                the game's palette: off white, signal orange, timing yellow), and
  //                the lamps, whose brightness lampDay and lampNight set.
  airports: {
    seedSalt: 138,
    candidates: 120,
    headings: 8,
    spacing: 4000,
    areaClear: 1500,
    stripAllowance: 1200,
    stripGap: 1100,
    stripReliefCost: 25,
    stripApproachCost: 400,
    minLand: 8,
    ringLand: 3,
    approachSlope: 0.02,
    approachLength: 6000,
    approachStep: 250,
    approachMargin: 25,
    propMargin: 60,
    startOffset: 80,
    airDistance: 2600,
    airHeight: 1500,
    hangarMouth: 16,
    zone: { w: 30, d: 34 },
    buildDistance: 24000,
    lampDay: 0.4,
    lampNight: 3,
    sink: 0,
    colors: {
      runway: 0x3a3e45, taxiway: 0x484c54, apron: 0x8a8e95, pad: 0x666b73,
      white: 0xedede7, yellow: 0xf5c518,
      wall: 0xd9dbdd, roof: 0x707a86, door: 0x2a3037, accent: 0xff7a1a, glass: 0x233a52, pole: 0x5b626b,
      lampWhite: 0xffffff, lampRed: 0xff2a14, lampGreen: 0x14ff50, lampBlue: 0x2a52ff, lampAmber: 0xffa010,
    },
  },

  // --- the night preview -------------------------------------------------------------
  // Until the day and night cycle of milestone 9, "Time of day" on the Fly menu is
  // a switch between the day and one night, so the airports' lights can be judged
  // in the dark: the horizon and the top of the sky, the moon's colour and
  // strength (it is the sun's light, dimmed), the ambient light (sky and ground),
  // the stars, how much the biome tints the fog (a daylight colour: most of it
  // goes), and the bloom that makes a lamp glow. Range: intensities 0.1-1.5,
  // stars 0-3000, tint 0-0.5, bloom 0.2-1.
  night: {
    haze: 0x0a1424, skyTop: 0x02050b, moon: 0xaec4ee,
    sunIntensity: 0.5, hemiIntensity: 0.8, hemiSky: 0x2a3f66, hemiGround: 0x1c2e24,
    stars: 1400, tint: 0.08, bloom: 0.65,
  },

  // --- chunks ---------------------------------------------------------------------
  // The terrain is a quadtree of square chunks over the whole map. The smallest
  // is `chunkSize` metres across, each is `chunkCells` cells a side (so its
  // facets are chunkSize / chunkCells metres: 16 m at the finest), and each
  // level up is twice as big with the same number of cells. A chunk splits into
  // four finer ones while the camera is closer than `splitFactor` times its
  // size; a bigger factor is a sharper world further out and more chunks to
  // draw. Skirts, `skirt` cells deep, hang from every chunk edge so the seams
  // between levels never show daylight. Range: chunkSize 256-1024, cells 16-48,
  // splitFactor 1.6-4, skirt 0.5-3.
  chunkSize: 512,
  chunkCells: 32,
  splitFactor: 2.4,
  skirt: 1.4,

  // How much of each frame building chunks may take, milliseconds (a chunk costs
  // roughly 1.5-3 ms; at least one is built a frame while any are wanted), and
  // how many chunks that are no longer in view are kept for when they are wanted
  // again. Range: budget 0.5-6, cache 50-1200.
  chunkBudgetMs: 2,
  chunkCache: 300,

  // --- render distance -----------------------------------------------------------------
  // How far you can see, metres: the settings slider's range and default, and
  // the most each graphics level allows. The distance sets the fog, the camera's
  // far plane and which chunks are drawn together. Fog starts at `fogNear` of
  // it. Chunks are drawn a little past the fog (`drawMargin`) so the edge is
  // never seen. Range: min 3000-15000, max 20000-100000, default 8000-60000,
  // step 1000-8000, fogNear 0.1-0.7, drawMargin 1-1.4.
  renderDistance: { min: 8000, max: 60000, default: 30000, step: 4000 },
  levelCaps: { low: 12000, medium: 24000, high: 40000, ultra: 60000 },
  fogNear: 0.3,
  drawMargin: 1.12,

  // --- detail ---------------------------------------------------------------------------
  // How much the world is drawn WITH, as against how far: the second slider, on
  // the same cards as the view distance. Each step is a name and five numbers,
  // all relative to today's (the step named `detailDefault` is exactly what the
  // game was before the slider, 1 and 1 and 1 and 1 and 1, with 32 cells):
  //   lod      how far out each size of terrain chunk is kept (a multiple of
  //            `splitFactor`): more is sharper ground in the middle distance,
  //            and more chunks, so more draw calls and more video memory
  //   cells    cells a side of every chunk: its facets are 512 / cells metres at
  //            the finest, so 64 is 8 m ground to 16 m. Costs triangles (and the
  //            time to build a chunk) with its square, but no draw calls
  //   props    how many trees, rocks and buildings (the lattice they stand on is
  //            made finer by this)
  //   shadow   how wide the sun's shadow is (a multiple of the car world's
  //            `shadowRadius`): the shadow map is the same size, so wider is
  //            coarser, but the trees and hills around you cast onto the ground
  //   scale    the most the picture may be rendered at, as a multiple of the
  //            resolution the screen asks for. Above 1 it is supersampling,
  //            which the frame-rate controller (GRAPHICS.dynamicResolution) climbs
  //            to by itself while the frame has room to spare, and gives back
  //            when it has not; below 1 it is a ceiling.
  // Range per number: lod 0.5-3, cells 16-96, props 0.25-4, shadow 0.5-4, scale
  // 0.5-2. Memory is the limit above Ultra: a chunk is cells x cells x 216 bytes.
  detailDefault: 2,
  detailSteps: [
    { name: 'Low',      lod: 0.7,  cells: 24, props: 0.5,  shadow: 0.7, scale: 0.8 },
    { name: 'Medium',   lod: 0.85, cells: 32, props: 0.75, shadow: 0.85, scale: 1 },
    { name: 'High',     lod: 1,    cells: 32, props: 1,    shadow: 1,   scale: 1 },
    { name: 'Higher',   lod: 1.25, cells: 40, props: 1.6,  shadow: 1.5, scale: 1.25 },
    { name: 'Ultra',    lod: 1.5,  cells: 48, props: 2.4,  shadow: 2.2, scale: 1.5 },
    { name: 'Maximum',  lod: 1.8,  cells: 64, props: 3.4,  shadow: 3,   scale: 1.75 },
  ],

  // --- how it looks ------------------------------------------------------------------------
  // Which biome the land is when no race track says otherwise. Two slow
  // patterns, temperature and moisture, `scale` metres across: hotter than `hot`
  // is desert, wetter than `wet` is forest, drier than `dry` is flat dry
  // ground, grassland between, each blending over `edge`. The snow line is the
  // biome's own (src/data/biomes.js) raised by `snowTemp` metres for the hottest
  // land and lowered by as much for the coldest, fading in over `snowBand`
  // metres. Range: scale 15000-80000, thresholds 0.2-0.8, edge 0.03-0.3,
  // snowTemp 0-2500, snowBand 50-600.
  biome: { scale: 36000, hot: 0.6, wet: 0.56, dry: 0.34, edge: 0.1, snowTemp: 900, snowBand: 220 },

  // The slope (the face normal's y, 1 is flat) steeper than which bare rock
  // shows, how much each facet's colour differs from its neighbours (a fraction
  // of its brightness: it is what makes the hills read as facets), and the
  // height above the sea (metres) that is still beach. Range: slope 0.5-0.9,
  // jitter 0-0.15, beach 1-10.
  rockSlope: 0.74,
  faceJitter: 0.07,
  beachHeight: 4,

  // Slow patches of lighter and darker ground, so a plain is not one flat green:
  // how much (a fraction of brightness) and how big, metres. Range: patch 0-0.3,
  // scale 200-3000.
  patch: 0.13,
  patchScale: 900,

  // How much a track's own ground colour tints the biome around it, 0 to 1.
  // Range: mix 0-0.6.
  paletteMix: 0.22,

  // Sky and light, packed 0xRRGGBB: the horizon, the top of the sky, the sun,
  // the sea. The sun's direction is behind and above an aircraft flying north.
  haze: 0x9cc4e6,
  skyTop: 0x3f78b8,
  sun: 0xfff1d6,
  sunDirection: { x: -0.35, y: 0.8, z: -0.45 },
  sea: 0x2b729c,
  // The sea is the terrain's own faces, cut at the waterline (src/world/Chunks.js).
  // Past the edge of the map there are no chunks, so a plane stands in, this far
  // under the waterline (metres) and drawn behind it in depth, so it never fights
  // the faces that are there. Range 0.2-5.
  seaDrop: 0.5,

  // How much each biome tints the fog toward its own horizon colour, 0 for one
  // fog everywhere, and how often (seconds apart) the sky's horizon is
  // recoloured to follow it. Range: tint 0-0.6, interval 0.1-2.
  fogTint: 0.3,
  fogInterval: 0.25,

  // --- props ------------------------------------------------------------------------------------
  // Trees, rocks and buildings. A prop may stand on every lattice cell of
  // `propCell` metres; only the first `propLevels` levels of chunks have any,
  // and each shows only the fraction of them in `propDensity` (finest first).
  // The render distance slider thins them further, in proportion. Range: cell
  // 20-80, levels 1-4, density 0-1.
  propCell: 38,
  propLevels: 3,
  propDensity: [1, 0.42, 0.15],
  // Metres from a track's graded apron inside which the world puts no props (the
  // track brings its own). Range 0-200.
  propClear: 60,

  // --- track areas -----------------------------------------------------------------------------------
  // Each race track is an area: a tube round its centreline. Out to `areaInner`
  // metres past the track's graded apron the ground is the track's own
  // (TrackGround, the hills the car game shows), then it blends into the world's
  // over `areaBlend`. Biome colour and props follow over `biomeBand`, which is
  // wider. Terrain chunks near a track are lowered by `trackSink` of their cell
  // size, fading out at the apron's edge, so a coarse facet never buries the
  // road. Range: inner 200-1200, blend 300-2500, band 800-4000, sink 0-0.4.
  areaInner: 520,
  areaBlend: 950,
  biomeBand: 1900,
  trackSink: 0.14,

  // Placement. Areas are kept at least `areaMinSpacing` metres apart, tried at
  // `areaCandidates` seeded places each (best fit wins), no nearer the home field
  // than `areaFromHome[0]` and no further than `areaFromHome[1]`. Range: spacing
  // 3000-15000, candidates 40-400, from home 3000-60000.
  areaMinSpacing: 7000,
  areaCandidates: 220,
  areaFromHome: [7000, 40000],

  // How near the camera (metres) a track's mesh is built and kept, how near its
  // scenery is drawn, and how near its cars get meshes at all. Range: build
  // 4000-40000, props 1500-12000, cars 1000-8000.
  trackBuildDistance: 16000,
  trackPropDistance: 5000,

  // --- the floating origin -----------------------------------------------------------------------------
  // Everything drawn is placed relative to a point on a lattice of `lattice`
  // metres; when the camera is more than `rebase` metres from that point it
  // moves to the nearest lattice point and everything is shifted by the
  // difference. Physics never sees it. Range: lattice 500-2000, rebase 1000-4000.
  lattice: 1000,
  rebase: 2000,

  // --- cars on the tracks ----------------------------------------------------------------------------------
  // `cars` lap every track area. A car is replayed from a recording while it is
  // far away and driven by the real physics inside `liveRadius` metres; it goes
  // back to the recording past `liveRadius` times `liveHysteresis`. A full-state
  // keyframe is kept every `keyEvery` physics steps, which is also the most a
  // hand-over ever has to catch up. Range: cars 0-6, radius 200-2000,
  // hysteresis 1.1-2, keyEvery 30-480, meshRadius 1000-8000.
  cars: 3,
  liveRadius: 700,
  liveHysteresis: 1.5,
  keyEvery: 120,
  meshRadius: 4000,
};

// ============================================================================
// THE HANGAR (flight milestone 3)
// ----------------------------------------------------------------------------
// Taxi into a hangar bay (the marked rectangle in front of a hangar door) and
// stop: after `dwell` seconds the Hangar opens. "Stopped" is on the ground,
// slower than `stopSpeed` (m/s) with the lever at or under `stopLever`. The
// bay arms again when the aircraft leaves it, so a Hangar closed with Esc does
// not open again until you have been out and back in, and a reset (which puts
// you at the mouth of a bay) does not slam a screen over you. `landedAfter` is
// how long (seconds) you sit stopped on an airport for it to become the one
// you "last used": the one free flight starts at. Range: dwell 0.5-4, speed
// 0.1-1, lever 0.04-0.3, landed 1-10.
// ============================================================================
export const HANGAR = {
  dwell: 1.5,
  stopSpeed: 0.4,
  stopLever: 0.12,
  landedAfter: 3,
  // The Hangar's tuning knobs (the list of them is data/loadouts.js). Each is a
  // scale on one thing and 1 is the aircraft as fitted, which is what every figure
  // `npm run flight` holds it to is measured at. Power scales thrust and fuel flow
  // (range 0.5-1.5). Response scales the stick's authority and the rate damping
  // together (0.5-1.5); the load limits and the tail guard still act after it.
  // Assist scales the auto trim and the roll self levelling (FLIGHT.levelStrength,
  // which is 0, off, as shipped) (0.1-2); not below 0.1, since with no trim at all
  // the aircraft has to be flown on the stick alone.
  tune: {
    power: { min: 0.8, max: 1.2, step: 0.05 },
    response: { min: 0.7, max: 1.3, step: 0.05 },
    assist: { min: 0.2, max: 1.5, step: 0.1 },
  },
  // The turntable. How fast it turns (rad/s, 0-1), the camera's field of view
  // (degrees, 20-50), and how much room the aircraft is given in the open space
  // between the panel and the card (a scale on the framing: 1 fits the longest
  // diagonal of the whole footprint, 0.8 fits the aircraft's own turning circle
  // and no more; range 0.7-1.4).
  turnRate: 0.3,
  fov: 34,
  fitRoom: 0.9,
  // How full the tank is when the aircraft is put down at an airport, a fraction
  // of the tank (0.1-1). The Hangar's card quotes the mass at it. Fuel is never
  // refilled in the Hangar.
  startFuel: 0.6,
};

// ============================================================================
// THE MAP AND THE RADAR (flight milestone 3)
// ----------------------------------------------------------------------------
// The map is a picture of the world, made once from the same Heightfield and
// Biomes the terrain is: `resolution` cells a side over the whole 120 km (320 is
// a cell every 375 m), the ground in its biome's colours, hill-shaded by `shade`
// (0 flat, 1 strong), the sea darker with depth over `seaDepth` metres. It is
// drawn a few milliseconds a frame (`buildMs`) the first time the map opens.
// You can zoom from `minZoom` to `maxZoom` times the whole map, a notch of the
// wheel being `zoomStep` times, and the names of the places appear from
// `labelZoom`. Range: resolution 160-640, shade 0-1, seaDepth 100-600, build 2-20.
// The radar is the corner disc: `size` pixels, showing `range` metres out to the
// ring, with the compass round it turning with the heading. Range: size 110-220,
// range 5000-60000.
// ============================================================================
export const MAP = {
  resolution: 320,
  shade: 0.55,
  seaDepth: 300,
  seaShallow: 0x3b8fc0,
  seaDeep: 0x123560,
  snow: 0xf2f5f8,
  buildMs: 8,
  minZoom: 1,
  maxZoom: 30,
  zoomStep: 1.25,
  labelZoom: 3.5,
  airport: 0xffffff,
  track: 0xff7a1a,
  aircraft: 0xf5c518,
};

export const RADAR = {
  size: 150,
  range: 20000,
  ring: 0xedede7,
  airport: 0xedede7,
  track: 0xff7a1a,
  hostile: 0xff7a1a,
};
