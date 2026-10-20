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

export const AIRCRAFT = [F22];
export const DEFAULT_AIRCRAFT = F22.id;
export const getAircraft = (id) => AIRCRAFT.find((a) => a.id === id) || AIRCRAFT[0];
