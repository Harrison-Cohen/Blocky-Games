// The chassis. These are the ONLY things that change how a car drives.
// Cosmetics in the garage never touch any value in this file.
//
// Five are modelled on real cars and one is not. Each real one carries the
// real car's published figures in `specs`: 0-60 mph, the quarter mile, top
// speed, skidpad grip and the turning circle. The game makes all five quicker
// and grippier than the real cars by the same factors -- STREET in tuning.js
// -- so each stays exactly as far from the others as the real cars are, and
// its physics numbers are tuned so that this game's physics reproduces the
// scaled figures, gameSpecs() below. `npm run specs` measures every car and
// holds it to them, so a tuning.js change that moves them shows up there;
// `node scripts/fit-specs.mjs` refits them. Dimensions, mass, weight
// distribution, centre of mass height and overhangs are the real car's.
//
// Four of the physics numbers are not the real car's, because this physics
// is not a real car's. Each is tuned to a figure in gameSpecs() instead:
//   power      Newtons of drive at a standstill in this model, tuned to the
//              0-60 and quarter mile. It is not horsepower; specs.hp is.
//   topSpeed   where the engine runs out of pull in this model, tuned so drag
//              holds the car at its real top speed, somewhat below this.
//   grip       front and rear friction, tuned to the skidpad figure.
//   steerRate  full lock, radians, tuned to the turning circle (the real
//              one shrunk by STREET.turn).
//
// Front and rear grip set the car's BALANCE, and the relationship is simpler
// than it looks: at static load the yaw balance works out to
//
//     understeer margin = gripRear / gripFront
//
// independently of weight distribution, because the weight term cancels. A car
// with equal front and rear grip is exactly neutral, which sounds desirable and
// is not: with the front tyre driven to its peak the rear is also at its peak,
// and the smallest disturbance sends it round. Every car here therefore runs
// more rear grip than front, by the margin its character calls for. Raising
// gripRear does not make a car corner harder, since the front still decides
// the limit; it only decides how hard it bites back.
//
// rollCentre (metres up from the ground) is what the body leans about in a
// corner; the lean is from the centre of mass down to it. The real cars corner
// at up to 1.9 g in this game, far past what their real bodies could hold:
// leaning about the ground they rolled 17 degrees and lifted both inside
// wheels. Each one's roll centre is set so it leans about 10 degrees per
// metre of centre of mass height at the limit -- the Chevelle most, the
// Ferrari and Roadster least -- with all four wheels down. The Wedge One has
// none and leans about the ground, as it always has.
//
// Every car here is driven through the rear axle by the physics. The Huracan
// is all-wheel drive in real life; the traction that gives it off the line is
// in its numbers rather than in a second driven axle.

import { STREET } from './tuning.js';

export const CHASSIS = [
  {
    id: 'porsche-911',
    name: 'Porsche 911',
    blurb: 'Rear engine, rear drive. Turns in sharply and puts its power down hard; lift mid-corner and the tail comes round.',
    profile: 'loft', // bodywork from its shape in CarBuilder
    specs: {
      model: '911 Carrera S (992)',
      engine: '3.0 L twin-turbo flat six',
      drive: 'Rear-wheel drive',
      hp: 443,
      zeroToSixty: 3.3,     // s
      quarterMile: 11.4,    // s
      topSpeedMph: 191,
      skidpadG: 1.05,
      turningCircle: 11.2,  // m, kerb to kerb
    },
    // --- performance ---
    topSpeed: 96.5,         // m/s. See the header: not the real top speed.
    power: 10250,           // N of drive at a standstill. See the header.
    launchSpeed: 6.6,       // m/s the launch boost lasts; ENGINE.launchSpeed
    powerFalloff: 1.8,      // ENGINE.powerFalloff, for this car
    mass: 1515,             // kg
    gripFront: 2.122,
    gripRear: 2.444,        // margin 1.15: forgiving until you lift mid-corner
    steerRate: 0.681,       // full lock, radians
    downforce: 0.35,        // N per (m/s)^2 of extra tyre load
    offroadGrip: 0.80,
    centerOfMassHeight: 0.46,
    rollCentre: 0.17,       // m. See the header: leans about 4 degrees at the limit
    // --- geometry: used by both the physics and the mesh ---
    wheelbase: 2.45,
    trackWidth: 1.57,
    wheelRadius: 0.345,
    suspensionRest: 0.38,
    rideHeight: 0.11,
    bodyLength: 4.519,
    bodyWidth: 1.852,
    bodyHeight: 1.30,
    frontOverhang: 0.98,    // front bumper ahead of the front axle, m
    weightDistribution: 0.38, // fraction of static weight on the front axle
  },
  {
    id: 'mustang-gt',
    name: 'Mustang GT',
    blurb: 'Front-engined V8 muscle. Huge straight-line pull, a heavy nose and a rear that steps out under power.',
    profile: 'loft',
    specs: {
      model: 'Mustang GT (S650)',
      engine: '5.0 L V8',
      drive: 'Rear-wheel drive',
      hp: 480,
      zeroToSixty: 4.3,
      quarterMile: 12.7,
      topSpeedMph: 155,
      skidpadG: 0.96,
      turningCircle: 12.2,
    },
    topSpeed: 75,
    power: 10040,
    launchSpeed: 4,
    powerFalloff: 1.8,
    mass: 1745,
    gripFront: 1.848,
    gripRear: 2.0,          // margin 1.08: it will rotate on you
    steerRate: 0.69,
    downforce: 0.15,
    offroadGrip: 0.80,
    centerOfMassHeight: 0.53,
    rollCentre: 0.10,       // about 5 degrees at the limit
    wheelbase: 2.72,
    trackWidth: 1.62,
    wheelRadius: 0.345,
    suspensionRest: 0.40,
    rideHeight: 0.13,
    bodyLength: 4.811,
    bodyWidth: 1.916,
    bodyHeight: 1.40,
    frontOverhang: 0.93,
    weightDistribution: 0.53,
  },
  {
    id: 'chevelle-ss',
    name: 'Chevelle SS 1969',
    blurb: 'A 1969 big block on bias-ply tyres. Brutal in a straight line, soft and slidey everywhere else.',
    profile: 'loft',
    specs: {
      model: 'Chevelle SS 396 (1969)',
      engine: '6.5 L big-block V8',
      drive: 'Rear-wheel drive',
      hp: 375,
      zeroToSixty: 6.0,
      quarterMile: 14.4,
      topSpeedMph: 128,
      skidpadG: 0.78,
      turningCircle: 12.5,
    },
    topSpeed: 60,
    power: 6650,
    launchSpeed: 4,
    powerFalloff: 4,        // holds its pull late, to 128 mph and no further
    mass: 1690,
    gripFront: 1.423,
    gripRear: 1.493,        // margin 1.05, the loosest car here
    steerRate: 0.689,
    downforce: 0.02,        // a brick with chrome on it
    offroadGrip: 0.88,
    centerOfMassHeight: 0.57,
    rollCentre: 0.11,       // about 5.5 degrees, the most lean here
    wheelbase: 2.845,
    trackWidth: 1.50,
    wheelRadius: 0.335,
    suspensionRest: 0.45,
    rideHeight: 0.15,
    bodyLength: 4.999,
    bodyWidth: 1.93,
    bodyHeight: 1.34,
    frontOverhang: 0.97,
    weightDistribution: 0.56,
  },
  {
    id: 'ferrari-enzo',
    name: 'Ferrari Enzo',
    blurb: 'Mid-engined V12 with real downforce. The fastest car here, and it grips harder the faster it goes.',
    profile: 'loft',
    specs: {
      model: 'Enzo Ferrari (2002)',
      engine: '6.0 L V12',
      drive: 'Rear-wheel drive',
      hp: 651,
      zeroToSixty: 3.3,
      quarterMile: 11.0,
      topSpeedMph: 218,
      skidpadG: 1.03,
      turningCircle: 12.4,
    },
    topSpeed: 111.5,
    power: 9490,
    launchSpeed: 12.6,
    mass: 1480,
    gripFront: 1.746,
    gripRear: 1.953,        // margin 1.12
    steerRate: 0.656,
    downforce: 1.1,         // about 340 kg at 125 mph, as the real car
    offroadGrip: 0.60,
    centerOfMassHeight: 0.40,
    rollCentre: 0.12,       // about 4 degrees at the limit
    wheelbase: 2.65,
    trackWidth: 1.655,
    wheelRadius: 0.345,
    suspensionRest: 0.34,
    rideHeight: 0.10,
    bodyLength: 4.702,
    bodyWidth: 2.035,
    bodyHeight: 1.147,
    frontOverhang: 1.14,
    weightDistribution: 0.44,
  },
  {
    id: 'lamborghini-huracan',
    name: 'Lamborghini Huracán',
    blurb: 'Mid-engined V10, the quickest off the line. Planted and calm at the limit.',
    profile: 'loft',
    specs: {
      model: 'Huracán EVO',
      engine: '5.2 L V10',
      drive: 'All-wheel drive',
      hp: 631,
      zeroToSixty: 2.8,
      quarterMile: 10.6,
      topSpeedMph: 202,
      skidpadG: 1.03,
      turningCircle: 11.5,
    },
    topSpeed: 101,
    power: 12430,
    launchSpeed: 11.8,      // all-wheel-drive traction off the line
    powerFalloff: 1.8,
    mass: 1560,
    gripFront: 1.898,
    gripRear: 2.174,        // margin 1.15: the all-wheel-drive calm
    steerRate: 0.713,
    downforce: 0.6,
    offroadGrip: 0.75,
    centerOfMassHeight: 0.42,
    rollCentre: 0.11,       // about 4 degrees at the limit
    wheelbase: 2.62,
    trackWidth: 1.645,
    wheelRadius: 0.34,
    suspensionRest: 0.35,
    rideHeight: 0.105,
    bodyLength: 4.52,
    bodyWidth: 1.933,
    bodyHeight: 1.165,
    frontOverhang: 1.07,
    weightDistribution: 0.43,
  },
  {
    id: 'tesla-roadster',
    name: 'Tesla Roadster',
    blurb: 'Three electric motors and all-wheel drive. Silent, one gear, and the quickest thing here off the line.',
    profile: 'loft',
    awd: true,              // both axles driven: see VehiclePhysics
    // Tesla's own claimed figures for the second-generation car, which has
    // not been independently tested. Tesla has not published its power, its
    // dimensions or its weight: those below are estimates from the 2017
    // prototype, as are the skidpad and the turning circle.
    specs: {
      model: 'Roadster (second generation)',
      engine: 'Three electric motors',
      drive: 'All-wheel drive',
      hp: null,             // not published
      zeroToSixty: 1.9,     // Tesla's claim
      quarterMile: 8.8,     // Tesla's claim
      topSpeedMph: 250,     // Tesla's claim, "over 250"
      skidpadG: 1.05,       // estimate
      turningCircle: 11.8,  // estimate
    },
    topSpeed: 123,
    power: 21470,
    launchSpeed: 12,
    powerFalloff: 1.8,
    mass: 1900,             // estimate: a 200 kWh battery
    gripFront: 1.904,
    gripRear: 2.094,        // margin 1.10
    steerRate: 0.694,
    downforce: 0.4,
    offroadGrip: 0.75,
    centerOfMassHeight: 0.40, // the battery is the floor
    rollCentre: 0.09,       // about 4 degrees at the limit
    wheelbase: 2.60,
    trackWidth: 1.70,
    wheelRadius: 0.36,
    suspensionRest: 0.36,
    rideHeight: 0.11,
    bodyLength: 4.25,
    bodyWidth: 1.99,
    bodyHeight: 1.15,
    frontOverhang: 0.86,
    weightDistribution: 0.45,
  },
  {
    id: 'wedge-one',
    name: 'Wedge One',
    blurb: 'Open wheel. Fastest through a corner, terrible on gravel, twitchy at the limit.',
    profile: 'openwheel', // silhouette family used by CarBuilder
    // Not a real car. Its specs are what it measures, so `npm run specs`
    // still notices a tuning change that moves it.
    specs: {
      measured: true, // the game's own figures, so STREET does not scale them
      model: 'Wedge One',
      engine: 'V10',
      drive: 'Rear-wheel drive',
      hp: 900,
      zeroToSixty: 1.3,
      quarterMile: 8.7,
      topSpeedMph: 125,
      skidpadG: 2.08,
      turningCircle: 11.1,
    },
    topSpeed: 58,
    power: 11000,
    mass: 780,
    gripFront: 1.78,
    gripRear: 1.92,
    steerRate: 0.70,
    downforce: 2.6, // this is what makes it stick in fast corners
    offroadGrip: 0.50, // the spec's "very low grip on gravel"
    centerOfMassHeight: 0.36,
    wheelbase: 3.05,
    trackWidth: 1.70,
    wheelRadius: 0.34,
    suspensionRest: 0.3, // spring rest length
    // Ground to the underside of the bodywork at rest, metres. Visual only.
    rideHeight: 0.075,
    bodyLength: 4.60,
    bodyWidth: 1.42, // narrow tub, wheels stand outside it
    bodyHeight: 0.72,
    weightDistribution: 0.45, // rear biased like a real open wheeler
  },
];

export const DEFAULT_CHASSIS = 'porsche-911';

export function getChassis(id) {
  return CHASSIS.find((c) => c.id === id) || CHASSIS[0];
}

export function chassisIndex(id) {
  const i = CHASSIS.findIndex((c) => c.id === id);
  return i < 0 ? 0 : i;
}

// How far the middle of the bodywork sits ahead of the centre of mass, in
// metres. A real car's body is not centred on its centre of mass -- a 911's
// engine hangs out behind the rear axle -- so a car with a real front
// overhang has its body placed from it. Zero for one without.
export function bodyCenter(c) {
  if (c.frontOverhang == null) return 0;
  return c.wheelbase * (1 - c.weightDistribution) + c.frontOverhang - c.bodyLength / 2;
}

// The top speed a player reads, m/s: the real car's for a real car, where the
// physics' own topSpeed is only where the engine runs out of pull.
export function realTopSpeed(c) {
  return c.specs && c.specs.topSpeedMph ? c.specs.topSpeedMph / 2.236936 : c.topSpeed;
}

// What a car does in this game: a real car's published figures scaled by
// STREET, and the Wedge One's own. `npm run specs` holds every car to these
// and the garage shows them.
export function gameSpecs(c) {
  const s = c.specs;
  if (s.measured) return s;
  return {
    ...s,
    zeroToSixty: s.zeroToSixty / STREET.accel,
    quarterMile: s.quarterMile / Math.sqrt(STREET.accel),
    skidpadG: s.skidpadG * STREET.grip,
    turningCircle: s.turningCircle / STREET.turn,
  };
}
