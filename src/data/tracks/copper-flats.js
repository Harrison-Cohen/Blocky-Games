// Copper Flats. Desert mesa: wide, fast and flowing.
//
// THIS FILE IS DATA. Adding a track means dropping a file like this one into
// this folder, and nothing else: index.js finds it. If a new track ever needs a
// change anywhere else, the track system is wrong and that is the bug.
//
// Layout, in order from the start line: a long straight, a fast 190 m radius
// sweeper, a short link, a medium corner, a long diagonal, a second medium
// corner, a chute, and one very tight 21 m hairpin that punishes anyone who
// arrives too hot.
//
// The four corners sweep 110, 70, 80 and 100 degrees. They add to 360 so the
// loop closes, and they are deliberately unequal: four 90 degree corners with
// two parallel straights closes just as well but produces a stadium oval.
//
// Control points:
//   x, y, z   world position of the centerline, meters
//   width     FULL road width at this point, meters
//   surface   'tarmac' | 'gravel' | 'grass', applies from here to the next point
//   banking   radians, rotation of the road about its own tangent. Positive
//             raises the LEFT edge, which is correct banking for a right hand
//             corner. Every corner here turns right, so banking is positive.

export default {
  id: 'copper-flats',
  name: 'Copper Flats',
  description: 'Desert mesa. Wide, fast and flowing, with a hairpin that punishes overdriving.',
  order: 1, // position in the track list
  targetLap: 55,

  // Arc length from the first control point to the start/finish line, meters.
  // Control point 0 sits at the hairpin exit, so the line is placed well up the
  // main straight: that leaves room to line a grid up behind it and means a
  // reset does not drop you mid-hairpin.
  startDistance: 120,

  // What the car finds when it runs wide off the tarmac.
  runoffSurface: 'gravel',
  barrierStyle: 'wall',

  // This track's own light and color. Each track sets these so the three read
  // as different places rather than one place recolored.
  palette: {
    sky: 0xc8bfae,
    fog: 0xc8bfae,
    ground: 0xa85f32,
    road: 0x4a4741,
    curbA: 0xd94f2b,
    curbB: 0xe8e4d8,
    barrier: 0xb8ae9c,
    runoff: 0x8f5a35,
    sun: 0xfff0d4,
    hemiGround: 0x7a4526,
  },
  fog: { near: 140, far: 620 },
  sunDirection: { x: -0.35, y: 0.9, z: 0.28 },
  sunIntensity: 2.3,
  hemiIntensity: 1.0,

  // A hard desert blue straight up, bleaching to dust at the horizon, a high
  // sun and a few towering fair-weather clouds.
  // A low gradient exponent brings the blue down toward the horizon, so it is
  // in the chase camera's frame rather than only straight up.
  sky: { top: 0x3f78b8, gradient: 0.3, haze: 0.35, clouds: 26, cloudHeight: 320,
    cloudColor: 0xfbf7ee, wind: 3, discGlow: 7 },
  post: { bloom: 0.25, bloomThreshold: 1.5 },

  // Scenery. Boxes with ranged dimensions; see harbor-nine.js for the full
  // vocabulary and the one rule that matters when editing it.
  props: [
    // Stacked slabs, each smaller than the one below and turned a little.
    {
      name: 'mesa', count: 26, variants: 3, clearance: 12,
      minOffset: 90, maxOffset: 320, minScale: 1.0, maxScale: 2.6,
      parts: [
        { color: [0x8f4a26, 0xa85f32, 0x6f3a1e],
          w: [26, 46], h: [5, 14], d: [22, 44],
          repeat: [2, 4], shrink: [0.62, 0.80], spin: [0, 0.7] },
      ],
    },
    // Boulders, piled rather than stacked: the negative rise sinks each one
    // into the last so they read as a heap and not as a totem.
    {
      name: 'rocks', count: 150, variants: 3, clearance: 8,
      minOffset: 26, maxOffset: 140, minScale: 0.6, maxScale: 1.7,
      parts: [
        { color: [0x7a6a55, 0x8f7d63, 0x5f5344],
          w: [0.9, 3.3], h: [0.6, 2.6], d: [0.9, 3.4],
          repeat: [2, 4], shrink: [0.7, 1.0], rise: [-1.2, -0.4],
          spin: [0, 1.5], jitter: 4 },
      ],
    },
    // A trunk and a pair of arms. The trunk height is fixed so the arms cannot
    // roll their way above the top of it; size variety comes from the scale.
    {
      name: 'cactus', count: 110, variants: 3, clearance: 6,
      minOffset: 22, maxOffset: 130, minScale: 0.8, maxScale: 1.6,
      parts: [
        { color: [0x3f6b3a, 0x4a7a42, 0x355c32], w: 0.7, h: 4.2, d: 0.7 },
        { color: [0x3f6b3a, 0x4a7a42, 0x355c32], w: 1.5, h: 0.55, d: 0.55, x: 0.9, y: 1.9 },
        { color: [0x3f6b3a, 0x4a7a42, 0x355c32], w: 0.55, h: 1.5, d: 0.55, x: 1.55, y: 2.2 },
        { color: [0x3f6b3a, 0x4a7a42, 0x355c32], w: 1.5, h: 0.55, d: 0.55, x: -0.9, y: 2.5 },
        { color: [0x3f6b3a, 0x4a7a42, 0x355c32], w: 0.55, h: 1.1, d: 0.55, x: -1.55, y: 2.8 },
      ],
    },
  ],

  controlPoints: [
  { x: 0, y: -5.39, z: -60, width: 15, surface: 'tarmac', banking: 0 },
  { x: 0, y: -4.54, z: -26.4, width: 15, surface: 'tarmac', banking: 0 },
  { x: 0, y: -3.77, z: 7.1, width: 15, surface: 'tarmac', banking: 0 },
  { x: 0, y: -3.10, z: 40.7, width: 15, surface: 'tarmac', banking: 0 },
  { x: 0, y: -2.54, z: 74.3, width: 15, surface: 'tarmac', banking: 0 },
  { x: 0, y: -2.09, z: 107.9, width: 15, surface: 'tarmac', banking: 0 },
  { x: 0, y: -1.75, z: 141.4, width: 15, surface: 'tarmac', banking: 0 },
  { x: 0, y: -1.46, z: 175, width: 15, surface: 'tarmac', banking: 0 },
  { x: 0, y: -0.10, z: 208.6, width: 15, surface: 'tarmac', banking: 0 },
  { x: 0, y: 2.17, z: 242.1, width: 15, surface: 'tarmac', banking: 0 },
  { x: 0, y: -0.31, z: 275.7, width: 15, surface: 'tarmac', banking: 0 },
  { x: 0, y: -1.81, z: 309.3, width: 15, surface: 'tarmac', banking: 0 },
  { x: 0, y: -2.53, z: 342.9, width: 15, surface: 'tarmac', banking: 0 },
  { x: 0, y: -1.59, z: 376.4, width: 15, surface: 'tarmac', banking: 0 },
  { x: 0, y: -0.45, z: 410, width: 16, surface: 'tarmac', banking: 0.055 },
  { x: 1.2, y: -0.04, z: 431.4, width: 16, surface: 'tarmac', banking: 0.055 },
  { x: 4.8, y: 0.30, z: 452.6, width: 16, surface: 'tarmac', banking: 0.055 },
  { x: 10.8, y: 0.67, z: 473.1, width: 16, surface: 'tarmac', banking: 0.055 },
  { x: 19.1, y: 1.10, z: 492.9, width: 16, surface: 'tarmac', banking: 0.055 },
  { x: 29.5, y: 1.58, z: 511.7, width: 16, surface: 'tarmac', banking: 0.055 },
  { x: 42, y: 2.12, z: 529.1, width: 16, surface: 'tarmac', banking: 0.055 },
  { x: 56.3, y: 2.70, z: 545, width: 16, surface: 'tarmac', banking: 0.055 },
  { x: 72.4, y: 3.33, z: 559.2, width: 16, surface: 'tarmac', banking: 0.055 },
  { x: 90, y: 3.99, z: 571.5, width: 16, surface: 'tarmac', banking: 0.055 },
  { x: 108.8, y: 4.69, z: 581.8, width: 16, surface: 'tarmac', banking: 0.055 },
  { x: 128.7, y: 5.41, z: 589.8, width: 16, surface: 'tarmac', banking: 0.055 },
  { x: 149.4, y: 6.14, z: 595.6, width: 16, surface: 'tarmac', banking: 0.055 },
  { x: 170.5, y: 6.86, z: 599, width: 16, surface: 'tarmac', banking: 0.055 },
  { x: 192, y: 7.59, z: 600, width: 16, surface: 'tarmac', banking: 0.055 },
  { x: 213.3, y: 8.28, z: 598.6, width: 16, surface: 'tarmac', banking: 0.055 },
  { x: 234.4, y: 8.95, z: 594.7, width: 16, surface: 'tarmac', banking: 0.055 },
  { x: 255, y: 9.57, z: 588.5, width: 15, surface: 'tarmac', banking: 0 },
  { x: 280.7, y: 10.28, z: 579.2, width: 15, surface: 'tarmac', banking: 0 },
  { x: 306.4, y: 10.87, z: 569.8, width: 15, surface: 'tarmac', banking: 0 },
  { x: 332, y: 11.32, z: 560.5, width: 14, surface: 'tarmac', banking: 0.045 },
  { x: 345.9, y: 11.51, z: 554, width: 14, surface: 'tarmac', banking: 0.045 },
  { x: 358.5, y: 11.65, z: 545.2, width: 14, surface: 'tarmac', banking: 0.045 },
  { x: 369.4, y: 11.73, z: 534.4, width: 14, surface: 'tarmac', banking: 0.045 },
  { x: 378.2, y: 11.75, z: 521.8, width: 14, surface: 'tarmac', banking: 0.045 },
  { x: 384.6, y: 11.72, z: 507.9, width: 14, surface: 'tarmac', banking: 0.045 },
  { x: 388.6, y: 11.63, z: 493.1, width: 14, surface: 'tarmac', banking: 0.045 },
  { x: 389.9, y: 11.48, z: 477.8, width: 14, surface: 'tarmac', banking: 0 },
  { x: 389.9, y: 10.98, z: 446.3, width: 14, surface: 'tarmac', banking: 0 },
  { x: 389.9, y: 10.23, z: 414.7, width: 14, surface: 'tarmac', banking: 0 },
  { x: 389.9, y: 9.24, z: 383.2, width: 14, surface: 'tarmac', banking: 0 },
  { x: 389.9, y: 8.06, z: 351.6, width: 14, surface: 'tarmac', banking: 0 },
  { x: 389.9, y: 7.14, z: 320.1, width: 14, surface: 'tarmac', banking: 0 },
  { x: 389.9, y: 7.36, z: 288.6, width: 14, surface: 'tarmac', banking: 0 },
  { x: 389.9, y: 5.79, z: 257, width: 14, surface: 'tarmac', banking: 0 },
  { x: 389.9, y: 2.02, z: 225.5, width: 14, surface: 'tarmac', banking: 0 },
  { x: 389.9, y: -1.15, z: 194, width: 14, surface: 'tarmac', banking: 0 },
  { x: 389.9, y: -3.26, z: 162.4, width: 14, surface: 'tarmac', banking: 0 },
  { x: 389.9, y: -4.04, z: 130.9, width: 14, surface: 'tarmac', banking: 0 },
  { x: 389.9, y: -5.15, z: 99.3, width: 14, surface: 'tarmac', banking: 0 },
  { x: 389.9, y: -6.53, z: 67.8, width: 14, surface: 'tarmac', banking: 0.04 },
  { x: 388.7, y: -7.17, z: 52.4, width: 14, surface: 'tarmac', banking: 0.04 },
  { x: 385.2, y: -7.76, z: 37.3, width: 14, surface: 'tarmac', banking: 0.04 },
  { x: 379.3, y: -8.31, z: 22.9, width: 14, surface: 'tarmac', banking: 0.04 },
  { x: 371.3, y: -8.79, z: 9.7, width: 14, surface: 'tarmac', banking: 0.04 },
  { x: 361.3, y: -9.23, z: -2.2, width: 14, surface: 'tarmac', banking: 0.04 },
  { x: 349.7, y: -9.61, z: -12.4, width: 14, surface: 'tarmac', banking: 0.04 },
  { x: 336.5, y: -9.94, z: -20.7, width: 14, surface: 'tarmac', banking: 0.04 },
  { x: 322.3, y: -10.20, z: -26.8, width: 14, surface: 'tarmac', banking: 0.04 },
  { x: 307.3, y: -10.41, z: -30.7, width: 13, surface: 'tarmac', banking: 0 },
  { x: 279, y: -10.65, z: -35.7, width: 13, surface: 'tarmac', banking: 0 },
  { x: 250.8, y: -10.69, z: -40.6, width: 13, surface: 'tarmac', banking: 0 },
  { x: 222.5, y: -10.56, z: -45.6, width: 13, surface: 'tarmac', banking: 0 },
  { x: 194.2, y: -10.27, z: -50.6, width: 13, surface: 'tarmac', banking: 0 },
  { x: 166, y: -9.83, z: -55.6, width: 13, surface: 'tarmac', banking: 0 },
  { x: 137.7, y: -9.27, z: -60.6, width: 13, surface: 'tarmac', banking: 0 },
  { x: 109.5, y: -8.62, z: -65.6, width: 13, surface: 'tarmac', banking: 0 },
  { x: 81.2, y: -7.90, z: -70.5, width: 13, surface: 'tarmac', banking: 0 },
  { x: 52.9, y: -7.13, z: -75.5, width: 13, surface: 'tarmac', banking: 0 },
  { x: 24.7, y: -6.36, z: -80.5, width: 12, surface: 'tarmac', banking: 0.025 },
  { x: 17.4, y: -6.16, z: -80.5, width: 12, surface: 'tarmac', banking: 0.025 },
  { x: 10.5, y: -5.96, z: -78, width: 12, surface: 'tarmac', banking: 0.025 },
  { x: 4.9, y: -5.77, z: -73.3, width: 12, surface: 'tarmac', banking: 0.025 },
  { x: 1.3, y: -5.57, z: -67, width: 12, surface: 'tarmac', banking: 0.025 },
  ],
};
