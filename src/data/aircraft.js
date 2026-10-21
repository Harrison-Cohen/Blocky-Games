// ============================================================================
// AIRCRAFT
// ----------------------------------------------------------------------------
// What each aircraft IS: mass, shape, wings and their curves, engines, gear,
// and the published figures it was fitted to. How it feels to fly (the aids,
// damping, stick ramps) is in tuning.js, FLIGHT.
//
// Body axes: +x LEFT, +y up, +z nose, origin at the centre of mass. Angles in
// degrees here, radians in the model; areas m2; thrust N; mass kg.
//
// `figures` is what `npm run flight` holds the aircraft to, and `source` says
// where each number came from. Where the maker does not publish a figure it is
// an estimate, said so, and fitted (scripts/fit-aircraft.mjs) to the figures
// that are published. Ungrounded numbers are marked `estimate`.
// ============================================================================

const rad = (d) => (d * Math.PI) / 180;

// Lift and drag against angle of attack, degrees, 0 to 180; the model mirrors
// them for negative angles (lift odd, drag even). Lift rises roughly linearly,
// peaks, then falls away softly into a flat plate. Drag is the profile term and
// the flat-plate term only: the induced term is added from the lift.
// A soft stall is a gentle fall after the peak; a sharp one drops at once.
const WING_LIFT = [
  [0, 0], [2, 0.11], [4, 0.22], [6, 0.33], [8, 0.44], [10, 0.55], [12, 0.66],
  [14, 0.77], [16, 0.87], [18, 0.96], [20, 1.05], [22, 1.13], [24, 1.2],
  [26, 1.26], [28, 1.31], [30, 1.34], [33, 1.34], [36, 1.28], [40, 1.18],
  [45, 1.08], [50, 1.02], [60, 0.98], [70, 0.82], [80, 0.5], [90, 0],
  [100, -0.5], [110, -0.82], [120, -0.98], [135, -1.0], [150, -0.78],
  [165, -0.4], [180, 0],
];
const WING_DRAG = [
  [0, 0.008], [4, 0.009], [8, 0.012], [12, 0.018], [16, 0.03], [20, 0.055],
  [25, 0.1], [30, 0.2], [35, 0.33], [40, 0.46], [50, 0.72], [60, 0.95],
  [75, 1.18], [90, 1.25], [105, 1.18], [120, 0.95], [135, 0.72], [150, 0.42],
  [165, 0.12], [180, 0.015],
];
const TAIL_LIFT = [
  [0, 0], [4, 0.2], [8, 0.4], [12, 0.6], [16, 0.8], [20, 0.97], [24, 1.08],
  [28, 1.08], [32, 1.0], [40, 0.95], [50, 0.98], [60, 0.96], [75, 0.8],
  [90, 0], [105, -0.8], [120, -0.96], [135, -0.98], [150, -0.7], [165, -0.35],
  [180, 0],
];
const TAIL_DRAG = [
  [0, 0.007], [4, 0.008], [8, 0.011], [12, 0.017], [16, 0.03], [20, 0.06],
  [25, 0.12], [30, 0.24], [40, 0.5], [50, 0.76], [60, 0.96], [75, 1.18],
  [90, 1.25], [105, 1.18], [120, 0.96], [135, 0.76], [150, 0.42], [165, 0.12],
  [180, 0.015],
];

// The F-22's wings are set at a few degrees of incidence to the fuselage, which
// is why it can lift off at a sane nose attitude.
const INCIDENCE = 5;
const wingChord = [0, Math.sin(rad(INCIDENCE)), Math.cos(rad(INCIDENCE))];
const wingNormal = [0, Math.cos(rad(INCIDENCE)), -Math.sin(rad(INCIDENCE))];

// The twin fins cant outward 27 degrees: the normal of each is in the x-y
// plane, pointing out and a little down.
const CANT = 27;
const finN = [Math.cos(rad(CANT)), -Math.sin(rad(CANT)), 0];

export const F22 = {
  id: 'f22',
  name: 'F-22 Raptor',
  role: 'fighter',
  // How it is built and drawn: 'fixed' is AircraftPhysics (wings and engines), 'f22'
  // the mesh in render/AircraftBuilder.js, `supersonic` whether the Mach 1 effects
  // apply, `mapIcon` its silhouette on the map and the radar.
  kind: 'fixed',
  model: 'f22',
  supersonic: true,
  mapIcon: 'delta',
  // "Start airborne": the speed (m/s), pitch (rad), throttle and flaps it is put in the
  // air with.
  airStart: { speed: 170, pitch: 0.04, throttle: 0.7, flaps: 0 },
  blurb: 'Twin-engine stealth fighter. Fast, with thrust vectoring that keeps it flying where wings alone would not.',

  // --- mass ---------------------------------------------------------------
  emptyMass: 19700,        // kg, USAF fact sheet
  maxTakeoffMass: 38000,   // kg, USAF fact sheet
  fuelCapacity: 8200,      // kg, internal, USAF fact sheet
  payload: 1500,           // kg: pilot, cannon rounds, six medium and two short-range missiles (estimate)
  // Radius of gyration squared about the pitch, yaw and roll axes (x, y, z),
  // m2. Scaled from the F-16's published inertias to the F-22's span and
  // length (yaw brought down a fifth from that, so the rudder is not sluggish
  // at approach speed). An estimate.
  gyration: [12.9, 11.5, 2.6],

  // --- shape --------------------------------------------------------------
  length: 18.9,            // m
  span: 13.56,             // m
  height: 5.08,            // m
  refArea: 78,             // m2, wing area

  // --- aerodynamics -------------------------------------------------------
  curves: {
    // stall is the angle of attack (degrees, at the surface) where the lift peaks.
    wing: { lift: WING_LIFT, drag: WING_DRAG, stall: 31 },
    tail: { lift: TAIL_LIFT, drag: TAIL_DRAG, stall: 26 },
    fin: { lift: TAIL_LIFT, drag: TAIL_DRAG, stall: 26 },
  },
  // Compressibility. The lift slope against Mach (1 is the low-speed value)
  // and the wave drag as a drag coefficient on the reference area. Without
  // these a straight lift-and-drag model has no transonic drag rise, and the
  // aircraft would not stop at its published top speed. Estimates, fitted.
  liftMach: [[0, 1], [0.6, 1.05], [0.85, 1.12], [1.0, 1.03], [1.2, 0.85], [1.6, 0.66], [2.0, 0.55], [2.5, 0.48]],
  waveCd: [[0, 0], [0.82, 0], [0.9, 0.004], [1.0, 0.016], [1.1, 0.0224], [1.3, 0.0207], [1.6, 0.0197], [2.0, 0.016], [2.5, 0.0144]],
  bodyCdA: 0.55,           // m2, the fuselage and everything not a lifting surface
  gearCdA: 0.9,            // m2 added with the gear down
  airbrakeCdA: 1.1,        // m2 added with the airbrake out
  // The scheduled flaps: how much the flaperons and leading edges add to the
  // wings' angle of attack with the gear down, radians. The flight computer
  // takes them up as the aircraft speeds up (FLIGHT.flapUp).
  flapAlpha: rad(4),
  stallAlpha: 26,          // degrees at the fuselage: the wings' stall (31) less their incidence (5)
  // The flap lever (Z and X): detent 0 is the scheduled flaps above, which the flight
  // computer sets by itself; detent 1 is the combat setting, the flaperons and leading
  // edges drooped for turning: more lift (and more drag) at a given angle of attack, so
  // a tighter turn at low speed. It is let up by itself above `vfe` (m/s calibrated).
  // alpha is the shift of the wings' zero-lift angle (rad), gain a multiple on their
  // lift, cd the drag it adds (a coefficient on the wing area). Estimates.
  flaps: {
    time: 1.5,
    autoRetract: true,
    detents: [
      { name: 'Auto', alpha: 0, gain: 0, cd: 0, vfe: Infinity },
      { name: 'Combat', alpha: rad(3), gain: 0.07, cd: 0.012, vfe: 165 },
    ],
  },

  // Six lifting surfaces. Control gains are the effective change of angle of
  // attack, radians, at full command: how far the surface moves times how much
  // of it moves. Signs are written here, once: pull is stabilators trailing
  // edge up; roll right is the left wing up and the right down; yaw right is
  // the tail pushed left.
  surfaces: [
    { name: 'wingL', area: 39, pos: [3.2, 0, -0.1], chord: wingChord, normal: wingNormal, induced: 0.16, curve: 'wing', flap: 1, control: { roll: 0.17 } },
    { name: 'wingR', area: 39, pos: [-3.2, 0, -0.1], chord: wingChord, normal: wingNormal, induced: 0.16, curve: 'wing', flap: 1, control: { roll: -0.17 } },
    { name: 'stabL', area: 5.5, pos: [2.4, 0, -6.8], chord: [0, 0, 1], normal: [0, 1, 0], induced: 0.2, curve: 'tail', control: { pitch: -0.6, roll: 0.12 } },
    { name: 'stabR', area: 5.5, pos: [-2.4, 0, -6.8], chord: [0, 0, 1], normal: [0, 1, 0], induced: 0.2, curve: 'tail', control: { pitch: -0.6, roll: -0.12 } },
    { name: 'finL', area: 7.5, pos: [1.7, 1.6, -7], chord: [0, 0, 1], normal: finN, induced: 0.25, curve: 'fin', control: { yaw: 0.45 } },
    { name: 'finR', area: 7.5, pos: [-1.7, 1.6, -7], chord: [0, 0, 1], normal: [-finN[0], finN[1], finN[2]], induced: 0.25, curve: 'fin', control: { yaw: -0.45 } },
  ],

  // --- engines ------------------------------------------------------------
  // Two Pratt and Whitney F119-PW-100. 35,000 lbf (156 kN) EACH with the
  // afterburner, per the maker and the fact sheet; about 26,000 lbf (116 kN)
  // dry is an unofficial figure. kDry and kAb are how thrust falls with
  // density; the Mach tables carry ram recovery. Fitted.
  engines: [
    { x: 0.95, y: 0.1, z: -8.4, dry: 115700, ab: 155700, idle: 0.05, kDry: 0.7, kAb: 0.8,
      machDry: [[0, 1], [0.4, 0.93], [0.9, 0.9], [1.2, 1.0], [1.6, 1.25], [2.0, 1.47], [2.5, 1.52]],
      machAb: [[0, 1], [0.4, 0.95], [0.9, 0.97], [1.2, 1.1396], [1.6, 1.2794], [2.0, 1.3492], [2.5, 1.3492]],
      spoolUp: 1.5, spoolDown: 1.0, abUp: 0.6, abDown: 0.3, sfcDry: 2.26e-5, sfcAb: 5.0e-5 },
    { x: -0.95, y: 0.1, z: -8.4, dry: 115700, ab: 155700, idle: 0.05, kDry: 0.7, kAb: 0.8,
      machDry: [[0, 1], [0.4, 0.93], [0.9, 0.9], [1.2, 1.0], [1.6, 1.25], [2.0, 1.47], [2.5, 1.52]],
      machAb: [[0, 1], [0.4, 0.95], [0.9, 0.97], [1.2, 1.1396], [1.6, 1.2794], [2.0, 1.3492], [2.5, 1.3492]],
      spoolUp: 1.5, spoolDown: 1.0, abUp: 0.6, abDown: 0.3, sfcDry: 2.26e-5, sfcAb: 5.0e-5 },
  ],
  // Two-dimensional thrust vectoring: the nozzles tilt in pitch only.
  tvMax: rad(20),

  // --- load limit ---------------------------------------------------------
  gLimit: 9,               // g, USAF fact sheet
  gLimitNeg: -3,           // g, the usual negative limit of a fighter (an estimate)

  // --- landing gear -------------------------------------------------------
  // Wheel points are where each tyre touches with the strut fully extended.
  gear: {
    wheels: [
      { name: 'nose', pos: [0, -1.75, 4.8], k: 200000, c: 20000, travel: 0.4, steer: true, brake: false },
      { name: 'mainL', pos: [2.1, -1.75, -0.9], k: 450000, c: 38000, travel: 0.45, steer: false, brake: true },
      { name: 'mainR', pos: [-2.1, -1.75, -0.9], k: 450000, c: 38000, travel: 0.45, steer: false, brake: true },
    ],
    // Where the skin strikes the ground when the gear is up.
    hull: [
      { name: 'nose', pos: [0, -0.4, 8.4] },
      { name: 'tail', pos: [0, -0.2, -9.9], skid: true },
      { name: 'belly', pos: [0, -1.0, 0] },
      { name: 'tipL', pos: [6.7, 0, -3.4] },
      { name: 'tipR', pos: [-6.7, 0, -3.4] },
      { name: 'finL', pos: [3.0, 3.4, -8.6] },
      { name: 'finR', pos: [-3.0, 3.4, -8.6] },
      { name: 'canopy', pos: [0, 1.4, 3.2] },
    ],
  },

  // --- where it can be put ------------------------------------------------
  // The shortest runway (m) it is started on or sent to, and whether it needs no
  // runway at all (a helicopter does; the heliports are for it).
  ground: { minRunway: 1000, vtol: false },

  // --- where the pilot sits and the camera looks --------------------------
  cockpitEye: [0, 1.36, 3.1],
  camTarget: [0, 0.5, 0],

  // --- the figures it is held to ------------------------------------------
  // floor: a hard minimum the check fails below. target: what it was fitted
  // to, held within `tol`. Sources are named; an estimate says so.
  figures: {
    length: { value: 18.9, tol: 0.001, source: 'USAF F-22 fact sheet' },
    span: { value: 13.56, tol: 0.01, source: 'USAF F-22 fact sheet (13.6 m)' },
    refArea: { value: 78, tol: 0.02, source: 'USAF / Lockheed Martin (about 78 m2)' },
    emptyMass: { value: 19700, tol: 0.001, source: 'USAF F-22 fact sheet' },
    maxTakeoffMass: { value: 38000, tol: 0.001, source: 'USAF F-22 fact sheet' },
    fuelCapacity: { value: 8200, tol: 0.001, source: 'USAF F-22 fact sheet' },
    thrustAb: { value: 311400, tol: 0.01, source: 'two engines at 156 kN: maker and GlobalSecurity (35,000 lbf each)' },
    thrustDry: { value: 231400, tol: 0.01, source: 'two engines at about 116 kN: unofficial estimate (26,000 lbf each)' },
    // Level flight in full afterburner at 40,000 ft, at a mid-fuel mass.
    topMach: { floor: 2.0, target: 2.2, tol: 0.06, source: 'USAF "Mach 2 class" (floor); 2.25 claimed by Milavia and DVIDS (target)' },
    // Level flight on military power, no afterburner, at 40,000 ft.
    supercruiseMach: { floor: 1.5, target: 1.75, tol: 0.06, source: 'spec (floor); 1.76 DVIDS to 1.82 Airman magazine (target)' },
    ceiling: { floor: 50000, source: 'USAF "above 50,000 ft"; 65,000 ft is a non-USAF estimate' },
    gLimit: { value: 9, source: 'USAF fact sheet (+9 g)' },
    // Thrust to weight, afterburner, at a mid-fuel mass: derived, not published.
    thrustToWeightAb: { target: 1.25, tol: 0.06, source: 'spec; derived from thrust and mass (about 50% fuel)' },
    // Estimates, fitted rather than published.
    stallSpeedCas: { target: 60, tol: 0.2, source: 'estimate: m/s calibrated, gear down, 26 t' },
  },
};

// ============================================================================
// BOEING 737-800
// ----------------------------------------------------------------------------
// Figures are Boeing's where Boeing publishes them (737 Airplane Characteristics for
// Airport Planning, D6-58325-7 Rev C, October 2025: weights, fuel, wheelbase, track,
// nose wheel steering, tyres, and the takeoff and landing field length charts) and the
// spec's (FLIGHT.md) otherwise. Where nobody publishes a figure (the inertias, the tail
// areas, the lift curve, the lift coefficient at each flap setting, the approach speed
// as a function of weight) it is an estimate, said so, and fitted
// (scripts/fit-aircraft.mjs b737) to the figures that are.
// ============================================================================

// A swept transport wing with slats: a lift slope of 0.088 a degree (about 5.0 a
// radian), a peak of 1.31 at 17 degrees, then the soft fall of a swept wing into the
// flat plate. The flaps' gain on the lift is the detent's (below), not in this curve.
const WING_LIFT_737 = [
  [0, 0], [2, 0.176], [4, 0.352], [6, 0.528], [8, 0.704], [10, 0.88], [12, 1.05],
  [14, 1.19], [15, 1.25], [16, 1.29], [17, 1.31], [18, 1.29], [19, 1.22], [20, 1.14],
  [22, 1.04], [25, 0.98], [30, 0.96], [40, 0.96], [50, 0.98], [60, 0.98], [70, 0.82],
  [80, 0.5], [90, 0], [100, -0.5], [110, -0.82], [120, -0.98], [135, -1.0], [150, -0.78],
  [165, -0.4], [180, 0],
];
const WING_DRAG_737 = [
  [0, 0.0085], [4, 0.0095], [8, 0.0125], [12, 0.019], [16, 0.035], [18, 0.06], [20, 0.1],
  [25, 0.22], [30, 0.35], [40, 0.5], [50, 0.72], [60, 0.95], [75, 1.18], [90, 1.25],
  [105, 1.18], [120, 0.95], [135, 0.72], [150, 0.42], [165, 0.12], [180, 0.015],
];
// The wings sit at three degrees to the fuselage (a cambered wing's zero-lift angle is a few
// degrees below its chord, so this stands for the camber too), so it cruises at a
// level body angle.
const INC_737 = 3;
const chord737 = [0, Math.sin(rad(INC_737)), Math.cos(rad(INC_737))];
const normal737 = [0, Math.cos(rad(INC_737)), -Math.sin(rad(INC_737))];

const CFM56 = {
  // CFM56-7B26, about 117 kN (26,300 lbf) each, no afterburner (ab is dry). A turbofan's
  // thrust falls with speed and with density: machDry is its thrust against Mach
  // relative to standing still, kDry its density exponent. Estimates, fitted so full
  // thrust at 35,000 ft is about Mach 0.82 and the service ceiling is 41,000 ft.
  dry: 117000, ab: 117000, idle: 0.07, kDry: 0.836, kAb: 0.836,
  machDry: [[0, 1], [0.2, 0.87], [0.4, 0.76], [0.6, 0.66], [0.8, 0.6], [0.9, 0.58]],
  machAb: [[0, 1], [1, 1]],
  spoolUp: 3.0, spoolDown: 2.4, abUp: 1, abDown: 1, sfcDry: 1.7e-5, sfcAb: 1.7e-5,
};

export const B737 = {
  id: 'b737',
  name: 'Boeing 737-800',
  role: 'airliner',
  blurb: 'Twin-engine airliner. Heavy and stable, slow to answer the stick, and it needs its flaps and a long runway.',
  kind: 'fixed',
  model: 'b737',
  supersonic: false,
  mapIcon: 'airliner',
  airStart: { speed: 125, pitch: 0.03, throttle: 0.6, flaps: 0 },
  camera: { distance: 78, height: 19, speedPullback: 30, orbitDistance: 150 },

  // --- mass ---------------------------------------------------------------
  emptyMass: 41413,        // kg, operating empty (Boeing: 41,412)
  maxTakeoffMass: 79016,   // kg (Boeing: 79,015)
  maxLandingMass: 66360,   // kg, Boeing
  maxZeroFuelMass: 62731,  // kg, Boeing: the most it may weigh with empty tanks (the Hangar's card warns above it)
  fuelCapacity: 20897,     // kg, usable (26,024 litres), Boeing
  // Two pilots and four cabin crew at 90 kg, 120 passengers at 95 kg with their hand
  // baggage, and 2,500 kg of hold baggage and freight (estimates: a planning mass per
  // passenger of about 95 kg).
  payload: 14440,
  // Radius of gyration squared about the pitch, yaw and roll axes (x, y, z), m2: about
  // 0.34 and 0.36 of the length and 0.23 of the span, as transport aircraft run.
  // Estimates.
  gyration: [180, 205, 68],

  // --- shape --------------------------------------------------------------
  length: 39.47,           // m
  span: 35.79,             // m, with winglets
  height: 12.6,            // m, the fin's top (Boeing: 12.62 m at empty weight)
  refArea: 124.6,          // m2, wing area

  // --- aerodynamics -------------------------------------------------------
  curves: {
    wing: { lift: WING_LIFT_737, drag: WING_DRAG_737, stall: 17 },
    tail: { lift: TAIL_LIFT, drag: TAIL_DRAG, stall: 26 },
    fin: { lift: TAIL_LIFT, drag: TAIL_DRAG, stall: 26 },
  },
  // Compressibility: a swept wing's drag rises from about Mach 0.78 and climbs hard past
  // 0.84. Estimates, fitted so full thrust at 35,000 ft settles at its maximum Mach, 0.82.
  liftMach: [[0, 1], [0.5, 1.02], [0.7, 1.05], [0.8, 1.07], [0.9, 0.95], [1.1, 0.8]],
  waveCd: [[0, 0], [0.74, 0], [0.78, 0.00113], [0.8, 0.00353], [0.82, 0.00847], [0.84, 0.01553], [0.86, 0.02543], [0.9, 0.04802], [0.95, 0.07769], [1, 0.09888], [1.2, 0.08475], [2, 0.07063]],
  bodyCdA: 0.95,           // m2: the fuselage and nacelles (the wings and tails carry their own; a clean airliner's CD0 is about 0.021)
  gearCdA: 2.4,            // m2 added with the gear down
  airbrakeName: 'Spoilers', // what the HUD calls the airbrake
  airbrakeCdA: 5.0,        // m2 added with the spoilers out
  airbrakeLiftDump: 0.8,   // the share of the wings' lift the spoilers kill, fully out
  // Ground effect: 10% more lift at the ground, nothing a wingspan up. `wingY` is where the
  // wings are against the centre of mass (m). It cushions the flare, as it does in life.
  groundEffect: { gain: 0.1, height: 36, wingY: -1.3 },
  flapAlpha: 0,            // no scheduled flaps: the lever sets them
  stallAlpha: 14,          // degrees at the fuselage: the wings' stall (17) less their incidence (3)

  // The flap lever (Z and X): up, then three detents, flaps 5 (takeoff), 15 (approach)
  // and 30 (landing). `vfe` is the speed the flaps may be out at, m/s calibrated (the
  // certified flap limit speeds: 250, 200 and 175 knots). alpha, gain and cd are what
  // each does to the wings: the shift of their zero-lift angle (rad), a multiple on
  // their lift, and the drag (a coefficient on the wing area). Estimates, fitted so
  // the approach speed at flaps 30 is 145 knots at 65 tonnes, with the others in order.
  flaps: {
    time: 9,
    autoRetract: false,
    detents: [
      { name: 'Up', deg: 0, alpha: 0, gain: 0, cd: 0, vfe: Infinity },
      { name: '5', deg: 5, alpha: rad(1.5), gain: 0.298, cd: 0.008, vfe: 128.6 },
      { name: '15', deg: 15, alpha: rad(3), gain: 0.467, cd: 0.028, vfe: 102.9 },
      { name: '30', deg: 30, alpha: rad(4.5), gain: 0.732, cd: 0.075, vfe: 90.0 },
    ],
  },

  // Five surfaces. Roll is ailerons and spoilers on the wings; pitch is the elevators and
  // the trimmable tailplane; yaw is the rudder. The tail areas are estimates.
  surfaces: [
    { name: 'wingL', area: 62.3, pos: [7.6, -1.3, -0.5], chord: chord737, normal: normal737, induced: 0.04, curve: 'wing', flap: 1, control: { roll: 0.05 } },
    { name: 'wingR', area: 62.3, pos: [-7.6, -1.3, -0.5], chord: chord737, normal: normal737, induced: 0.04, curve: 'wing', flap: 1, control: { roll: -0.05 } },
    { name: 'stabL', area: 16.4, pos: [4.6, 1.0, -17.8], chord: [0, 0, 1], normal: [0, 1, 0], induced: 0.1, curve: 'tail', control: { pitch: -0.42 } },
    { name: 'stabR', area: 16.4, pos: [-4.6, 1.0, -17.8], chord: [0, 0, 1], normal: [0, 1, 0], induced: 0.1, curve: 'tail', control: { pitch: -0.42 } },
    { name: 'fin', area: 26.4, pos: [0, 4.6, -17.6], chord: [0, 0, 1], normal: [1, 0, 0], induced: 0.12, curve: 'fin', control: { yaw: 0.28 } },
  ],

  // --- engines ------------------------------------------------------------
  // Slung under the wings, 5.7 m out from the centre line, a little below the centre
  // of mass, so power pitches the nose up a little, as it does on a 737.
  engines: [
    { x: 5.7, y: -1.9, z: 2.0, ...CFM56 },
    { x: -5.7, y: -1.9, z: 2.0, ...CFM56 },
  ],
  tvMax: 0,

  // --- load limit ---------------------------------------------------------
  gLimit: 2.5,             // g, the flaps-up limit of a transport (flaps down is 2.0)
  gLimitNeg: -1,           // g

  // --- landing gear -------------------------------------------------------
  // Boeing: the nose gear is 15.60 m ahead of the main gear, the main gear are 5.72 m
  // apart. The centre of mass is 1.6 m ahead of the mains (so the nose carries a tenth of
  // the weight) and 3.4 m up, from the clearances in the airport planning manual.
  gear: {
    wheels: [
      { name: 'nose', pos: [0, -3.5, 14.0], k: 0.9e6, c: 0.9e5, travel: 0.45, steer: true, brake: false },
      { name: 'mainL', pos: [2.86, -3.5, -1.6], k: 2.6e6, c: 3.0e5, travel: 0.5, steer: false, brake: true },
      { name: 'mainR', pos: [-2.86, -3.5, -1.6], k: 2.6e6, c: 3.0e5, travel: 0.5, steer: false, brake: true },
    ],
    hull: [
      { name: 'nose', pos: [0, -0.3, 17.5] },
      { name: 'tail', pos: [0, -0.25, -17.0], skid: true },
      { name: 'belly', pos: [0, -1.9, 0] },
      { name: 'bellyAft', pos: [0, -1.9, -9] },
      { name: 'nacelleL', pos: [5.7, -2.85, 1.0] },
      { name: 'nacelleR', pos: [-5.7, -2.85, 1.0] },
      { name: 'tipL', pos: [17.9, 0.7, -8.2] },
      { name: 'tipR', pos: [-17.9, 0.7, -8.2] },
      { name: 'fin', pos: [0, 9.0, -19.0] },
    ],
  },

  // --- where it can be put ------------------------------------------------
  // The shortest runway (m) it is started on or sent to: it lands in 1,600 m and takes
  // off in 2,316 at full weight, so 1,500 m is the least that is worth putting it on.
  ground: { minRunway: 1500, vtol: false },

  // --- where the pilot sits and the camera looks --------------------------
  cockpitEye: [-0.5, 1.5, 14.0],
  camTarget: [0, 0.5, 0],

  // --- the figures it is held to ------------------------------------------
  figures: {
    length: { value: 39.47, tol: 0.001, source: 'Boeing 737-800 (spec, FLIGHT.md)' },
    span: { value: 35.79, tol: 0.01, source: 'Boeing 737-800 with winglets (spec)' },
    refArea: { value: 124.6, tol: 0.02, source: 'Boeing 737-800 (spec)' },
    emptyMass: { value: 41413, tol: 0.001, source: 'Boeing operating empty mass 41,412 kg (airport planning manual, 2.1.3)' },
    maxTakeoffMass: { value: 79016, tol: 0.001, source: 'Boeing 79,015 kg (airport planning manual, 2.1.3)' },
    maxLandingMass: { value: 66360, tol: 0.001, source: 'Boeing (airport planning manual, 2.1.3)' },
    maxZeroFuelMass: { value: 62731, tol: 0.001, source: 'Boeing (airport planning manual, 2.1.3)' },
    fuelCapacity: { value: 20897, tol: 0.001, source: 'Boeing usable fuel 26,024 L, 20,897 kg (airport planning manual, 2.1.3)' },
    thrust: { value: 234000, tol: 0.01, source: 'two CFM56-7B26 at about 117 kN (spec)' },
    wheelbase: { value: 15.6, tol: 0.01, source: 'Boeing: 51 ft 2 in (airport planning manual, 7.2.1)' },
    track: { value: 5.72, tol: 0.01, source: 'Boeing: 18 ft 9 in (airport planning manual, 7.2.1)' },
    // The speed it settles at in level flight at 35,000 ft, mid weight, with the lever at
    // the stop, and with the lever at a cruise setting.
    maxMach: { value: 0.82, tol: 0.015, source: 'maximum operating Mach 0.82 (spec)' },
    cruiseMach: { value: 0.785, tol: 0.015, source: 'cruise Mach 0.785 (spec)' },
    ceiling: { value: 41000, tol: 0.03, source: 'service ceiling 41,000 ft (spec)' },
    // The FAA rule: the all-engine distance to 35 ft, times 1.15, at the maximum takeoff
    // mass, flaps 5, sea level, standard day, is the field length.
    takeoffFieldLength: { value: 2316, tol: 0.08, source: 'takeoff field length 2,316 m (spec; Boeing chart 3.3.29 reads about 2.2 to 2.3 km)' },
    // The FAA rule: the distance from 50 ft to a stop, divided by 0.6, at the maximum
    // landing mass, flaps 30, sea level, dry, spoilers and brakes, no reversers.
    landingFieldLength: { value: 1600, tol: 0.1, source: 'landing field length 1,600 m (spec; Boeing chart 3.4.3 reads about 1.8 to 1.9 km at flaps 30)' },
    // An estimate: Boeing does not publish it. Training and sim pages put flaps 30 at the
    // mid 130s to the high 140s knots at ordinary weights.
    vref30: { value: 145, mass: 65000, tol: 0.05, source: 'estimate: knots calibrated at flaps 30, 65 t (mid 130s to high 140s kt in training sources)' },
    // The 1 g stall speed (knots calibrated) at 65 tonnes for up, 5, 15 and 30: flaps 30 is
    // Vref (145) over the 1.23 the rules give it, the others follow from plausible lift
    // coefficients for each setting (about 1.35, 1.75, 2.0 and 2.28). Estimates.
    stall: { speeds: [153, 135, 126, 117.9], mass: 65000, tol: 0.03, source: 'estimates, from the Vref estimate and plausible lift coefficients' },
    gLimit: { value: 2.5, source: 'transport category limit, flaps up (estimate)' },
  },
};

export const AIRCRAFT = [F22, B737];
export const DEFAULT_AIRCRAFT = F22.id;
export const getAircraft = (id) => AIRCRAFT.find((a) => a.id === id) || AIRCRAFT[0];
