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
  // pull late and makes top speed abrupt. Range 1.5-4.
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
  launchSpeed: 14.0, // m/s over which launchBoost blends away. Range 4-20.

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

export const BRAKES = {
  // Peak braking force in Newtons at the tires, before grip limits it.
  // 14000 N on a 1200 kg car is roughly 1.2 g, which is a firm sports brake.
  // Range 6000-24000.
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

  // Handbrake force on the rear axle only, Newtons. Range 3000-12000.
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
};

export const SUSPENSION = {
  // Spring rate per corner, Newtons per meter of compression. Higher is
  // stiffer, less body movement, more nervous over bumps. This is deliberately
  // soft: visible dive and roll is most of what sells the feel, and the body
  // motion is the readout you steer by. Range 18000-70000.
  springRate: 26000,

  // Damper rate per corner, Newtons per m/s of compression speed. Too low
  // floats and oscillates, too high goes wooden and skips over bumps.
  // Critical is roughly 2 * sqrt(springRate * cornerMass), which at this
  // spring rate lands near 5500 for a mid-weight car, so this is about 0.65
  // critical: sporty, settles in one motion. Range 1800-8000.
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
  // two cars' half widths. Lower is closer racing and more rubbing. Range 0.3-1.5.
  passGap: 0.7,

  // The closest a passing lane comes to the edge of the tarmac, metres, before
  // the car's own half width. Range 0.3-2.
  passEdge: 0.6,

  // How fast a driver moves across into a passing lane, metres per second, and
  // how long it keeps to that lane once the car it was passing is out of its
  // lookahead. Ranges 1-4, 0.5-3.
  passRate: 2.2,
  passHold: 1.2,

  // When there is no room to pass: the following distance kept, a fixed gap
  // plus this many seconds at the current speed. Ranges 2-8, 0.15-0.6.
  followGap: 4,
  followTime: 0.3,

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
// at the flag. The track select screen (milestone 9) will set laps, opponents
// and difficulty; these are the defaults it starts from.
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
  // Cube GT lap, the car a new player starts in.
  referenceChassis: 'cube-gt',
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
