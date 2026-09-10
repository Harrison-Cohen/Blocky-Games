// The five chassis. These are the ONLY things that change how a car drives.
// Cosmetics in the garage never touch any value in this file.
//
// Stats are absolute, not multipliers, so you can read a car's character
// straight off the row. Shared behavior lives in tuning.js; this file is
// only what makes these five different from each other.

// Front and rear grip set the car's BALANCE, and the relationship is simpler
// than it looks: at static load the yaw balance works out to
//
//     understeer margin = gripRear / gripFront
//
// independently of weight distribution, because the weight term cancels. A car
// with equal front and rear grip is exactly neutral, which sounds desirable and
// is not: with the front tyre driven to its peak the rear is also at its peak,
// and the smallest disturbance sends it round. Every car here therefore runs
// more rear grip than front, by the margin its character calls for -- 1.15 for
// the friendly hatch, 1.08 for the muscle car that is meant to be loose, 1.20
// for the truck. Raising gripRear does not make a car corner harder, since the
// front still decides the limit; it only decides how hard it bites back.

export const CHASSIS = [
  {
    id: 'cube-gt',
    name: 'Cube GT',
    blurb: 'Balanced hot hatch. High grip, easy to place, gives up top speed.',
    profile: 'hatch', // silhouette family used by CarBuilder
    // --- performance ---
    topSpeed: 52, // m/s, about 187 km/h
    power: 9000, // Newtons of drive force at a standstill
    mass: 1150, // kg
    gripFront: 1.35, // peak lateral friction coefficient, front axle
    gripRear: 1.55, // very slightly more than front = mild understeer, forgiving
    steerRate: 0.62, // max steering angle at low speed, radians (35 deg)
    downforce: 0.9, // Newtons per (m/s)^2, added to tire load at speed
    offroadGrip: 0.85, // multiplier applied on gravel and grass
    centerOfMassHeight: 0.52, // m. Drives all weight transfer.
    // --- geometry: used by both the physics and the mesh ---
    wheelbase: 2.55,
    trackWidth: 1.62,
    wheelRadius: 0.33,
    suspensionRest: 0.4, // spring rest length
    // Ground to the underside of the bodywork at rest, metres. Visual only.
    rideHeight: 0.13,
    bodyLength: 4.05,
    bodyWidth: 1.80,
    bodyHeight: 1.30,
    weightDistribution: 0.60, // fraction of static weight on the front axle
  },
  {
    id: 'boxhauler-v8',
    name: 'Boxhauler V8',
    blurb: 'Muscle. Enormous top speed, loose rear, hates changing direction.',
    profile: 'muscle', // silhouette family used by CarBuilder
    topSpeed: 62,
    power: 12000,
    mass: 1550,
    gripFront: 1.26,
    gripRear: 1.36, // the smallest margin of the four: it will rotate on you
    steerRate: 0.52,
    downforce: 0.5,
    offroadGrip: 0.80,
    centerOfMassHeight: 0.60,
    wheelbase: 2.92,
    trackWidth: 1.74,
    wheelRadius: 0.36,
    suspensionRest: 0.42, // spring rest length
    // Ground to the underside of the bodywork at rest, metres. Visual only.
    rideHeight: 0.12,
    bodyLength: 4.85,
    bodyWidth: 1.95,
    bodyHeight: 1.28,
    weightDistribution: 0.55,
  },
  {
    id: 'wedge-one',
    name: 'Wedge One',
    blurb: 'Open wheel. Fastest through a corner, terrible on gravel, twitchy at the limit.',
    profile: 'openwheel', // silhouette family used by CarBuilder
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
  {
    id: 'haul-4x4',
    name: 'Haul 4x4',
    blurb: 'Offroad truck. Best on loose stuff and crests, heavy and rolly on tarmac.',
    profile: 'truck', // silhouette family used by CarBuilder
    topSpeed: 46,
    power: 9500,
    mass: 1900,
    gripFront: 1.10,
    gripRear: 1.32,
    steerRate: 0.58,
    downforce: 0.2,
    offroadGrip: 1.25, // the only car that gains grip off tarmac
    centerOfMassHeight: 0.80, // tall. With GRIP.rollGripLoss this really costs it.
    wheelbase: 2.98,
    trackWidth: 1.86,
    wheelRadius: 0.45,
    suspensionRest: 0.62, // spring rest length
    // Ground to the underside of the bodywork at rest, metres. Visual only.
    rideHeight: 0.30,
    bodyLength: 4.55,
    bodyWidth: 2.00,
    bodyHeight: 1.85,
    weightDistribution: 0.56,
  },
  {
    id: 'bighead',
    name: 'Bighead',
    blurb: 'A head, on four wheels. Rolls like a ship, and quicker off the line than it has any right to be.',
    profile: 'face', // silhouette family used by CarBuilder
    topSpeed: 54,
    power: 13400,
    mass: 1420,
    gripFront: 1.32,
    // Margin 1.17, the most forgiving of the five. It has to be: the challenge
    // in this car is the roll, and a tall car that ALSO snaps is just unfair.
    gripRear: 1.55,
    steerRate: 0.60,
    downforce: 0.2, // a brick. There is no aerodynamic story here at all
    offroadGrip: 0.95,
    // The tallest by a distance, and with GRIP.rollGripLoss that is the whole
    // character of the car: it leans, the loaded outside tyre stops paying its
    // way, and the grip it has on paper is not the grip it has mid-corner.
    centerOfMassHeight: 0.92,
    wheelbase: 2.40,
    trackWidth: 1.70,
    wheelRadius: 0.34,
    suspensionRest: 0.44,
    rideHeight: 0.16,
    bodyLength: 3.30,
    bodyWidth: 2.00,
    bodyHeight: 2.25,
    weightDistribution: 0.52,
  },
];

export const DEFAULT_CHASSIS = 'cube-gt';

export function getChassis(id) {
  return CHASSIS.find((c) => c.id === id) || CHASSIS[0];
}

export function chassisIndex(id) {
  const i = CHASSIS.findIndex((c) => c.id === id);
  return i < 0 ? 0 : i;
}
