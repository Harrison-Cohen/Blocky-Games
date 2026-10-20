// Glacier Pass. Alpine switchbacks: 2502 m and 52 m of climb.
//
// THIS FILE IS DATA. See harbor-nine.js for the prop vocabulary.
//
// Layout, from the start line on the valley floor: a quick opening right onto
// the mountain face, then three switchback hairpins, left, right, left, each
// 20 to 22 m in radius and turning through more than 160 degrees. The legs
// between them climb at about ten percent and splay apart rather than stacking,
// so from each hairpin you can see the one below you. Over the col, the road
// runs level along the ridge through a 190 m avalanche gallery -- a concrete
// roof on pillars, open to the valley on one side -- then drops off the far
// side through a pair of esses, a banked sweeper and a 580 m run down the
// valley, the fastest piece of road on any circuit here, into the last corner.
//
// The hairpins are the whole lap. Three corners you take in first gear on a
// circuit where the rest of it is flat out, on a climb, with the guardrail
// four and a half metres from the kerb.
//
// Run wide and you are in the snow: the verge is 'grass', 0.55 grip, and it
// looks the part.
//
// The elevation is blurred along the lap before it becomes control points, so
// no change of gradient is sharp enough to put a car in the air.

export default {
  id: 'glacier-pass',
  // Where it sits in the flight world (src/world); the car game never reads it.
  world: { biome: 'snow' },
  name: 'Glacier Pass',
  description: 'Alpine switchbacks. Three hairpins up a mountain face, an avalanche gallery, and a long run home.',
  order: 5,
  targetLap: 100,

  startDistance: 110,

  runoffSurface: 'grass',
  barrierStyle: 'guardrail',
  barrierGap: 4.5,
  // Short embankments, because the switchback legs are close enough that long
  // ones would hang over the leg below.
  apronWidth: 14,
  // Mountains. The biggest terrain on any circuit, pushed well back.
  terrain: { amplitude: 95, fade: 150 },

  palette: {
    sky: 0xcfdde9,
    fog: 0xcfdde9,
    ground: 0xe6ecf1,
    road: 0x3b3f46,
    lines: 0xe8e6de,
    curbA: 0xc8352c,
    curbB: 0xf2f2ec,
    barrier: 0x9aa3ab,
    runoff: 0xdde4ea,
    grass: 0xe6ecf1,
    sun: 0xfff4e6,
    hemiSky: 0xbcd4ee,
    // Snow throws light back up, so the fill from below is nearly white.
    hemiGround: 0xc3cedb,
  },
  fog: { near: 120, far: 700 },
  sunDirection: { x: 0.42, y: 0.74, z: -0.52 },
  sunIntensity: 1.9,
  hemiIntensity: 1.0,

  // Deep alpine blue overhead, white cloud sitting above the peaks.
  sky: { top: 0x2c6cc2, gradient: 0.3, haze: 0.3, clouds: 45, cloudHeight: 380,
    cloudColor: 0xffffff, wind: 6, discGlow: 8 },
  // Snow in sunlight is already near white; only genuinely bright things bloom.
  post: { bloom: 0.2, bloomThreshold: 1.7 },

  props: [
    // Pines with snow on every tier. Fixed sizes so each cap sits on its own
    // tier: tiers step up 1.6 m (2.4 tall, sunk 0.8 into the one below), and
    // each 0.3 m cap rises 1.3 m more to land 5 cm below the top of the next.
    {
      name: 'snowpines', count: 620, variants: 2, clearance: 1.5,
      minOffset: 20, maxOffset: 170, minScale: 0.7, maxScale: 1.8,
      parts: [
        { color: 0x3a2c22, w: 0.8, h: 2.6 },
        { color: [0x1d3a2b, 0x234533], w: 5.2, h: 2.4, y: 2.2,
          repeat: 4, shrink: 0.74, rise: -0.8 },
        { color: 0xf2f6f8, w: 4.4, h: 0.3, y: 4.55,
          repeat: 4, shrink: 0.74, rise: 1.3 },
      ],
    },
    // Bare rock, where the snow will not lie.
    {
      name: 'crags', count: 170, variants: 4, clearance: 3,
      minOffset: 22, maxOffset: 190, minScale: 0.8, maxScale: 2.6,
      parts: [
        { color: [0x6a6f76, 0x5a5f66, 0x7b8087, 0x4f545b],
          w: [2.6, 6.0], h: [1.4, 4.0], d: [2.2, 5.0],
          repeat: [1, 3], shrink: [0.6, 0.8], taper: [0.7, 0.9],
          spin: [0, 1.6], jitter: 1.8 },
      ],
    },
    // The glacier itself, off in the distance: stacks of blue ice.
    {
      name: 'seracs', count: 42, variants: 3, clearance: 20,
      minOffset: 180, maxOffset: 420, minScale: 1.0, maxScale: 3.0,
      parts: [
        { color: [0xa9d4ea, 0x8fc3e0, 0xc5e4f2],
          w: [8, 18], h: [10, 30], d: [8, 16],
          repeat: [1, 3], shrink: [0.65, 0.8], spin: [0, 1.2], jitter: 3 },
      ],
    },
    // Chalets in the valley, lights on.
    {
      name: 'chalets', count: 9, variants: 1, clearance: 6,
      minOffset: 40, maxOffset: 130, minScale: 0.9, maxScale: 1.2,
      parts: [
        { color: 0x6b4a32, w: 8, h: 4, d: 10 },
        { color: 0xf2f6f8, w: 9.6, h: 1.4, d: 11.4, y: 4 },
        { color: 0xffd89a, emissive: 0xffd89a, glow: 1.4, w: 8.1, h: 1.0, d: 2.2, y: 1.6 },
      ],
    },
    // Orange marker poles down both sides, the way an alpine road marks its
    // edge for the snowplough.
    {
      name: 'poles', place: 'line', variants: 1,
      spacing: 20, offset: 13.6, sides: [1, -1],
      parts: [
        { color: 0xff7a1a, w: 0.12, h: 1.7 },
        { color: 0x1b1b1b, w: 0.13, h: 0.3, y: 1.25 },
      ],
    },
    // The avalanche gallery over the summit traverse: a solid wall against the
    // mountain on the left, pillars open to the valley on the right, a
    // concrete roof with the snow lying on it. Lamps on the inside wall every
    // twelve metres, real lights, because under that roof the road is in
    // shadow at midday.
    {
      name: 'gallery', place: 'line', variants: 1,
      spacing: 4, offset: 0, sides: [0], from: 960, to: 1130,
      light: { x: 12.9, y: 5.2, aim: -1.5, every: 3, color: 0xffe2a8,
        intensity: 30, range: 16, angle: 1.2, penumbra: 0.8 },
      parts: [
        { color: 0x8a8f95, w: 1.2, h: 6.8, d: 4.05, x: 14.0 },
        { color: 0x8a8f95, w: 1.2, h: 6.8, d: 1.3, x: -14.0 },
        { color: 0x7d8288, w: 29.4, h: 0.9, d: 4.05, y: 6.8 },
        { color: 0xf2f6f8, w: 29.8, h: 0.5, d: 4.05, y: 7.7 },
        { color: 0xffe2a8, emissive: 0xffe2a8, glow: 1.2, w: 0.25, h: 0.4, d: 1.2, x: 13.3, y: 4.6 },
      ],
    },
  ],

  // x, y, z   world position of the centerline, metres
  // width     FULL road width here, metres; wider through the hairpins
  // banking   radians; only the sweeper before the long run down is banked
  controlPoints: [
  { x: 0, y: 0.05, z: 0, width: 13, surface: 'tarmac', banking: 0 },
  { x: 0, y: 0.02, z: 19.6, width: 13, surface: 'tarmac', banking: 0 },
  { x: 0, y: 0, z: 39.2, width: 13, surface: 'tarmac', banking: 0 },
  { x: 0, y: 0, z: 58.8, width: 13, surface: 'tarmac', banking: 0 },
  { x: 0, y: 0, z: 78.4, width: 13, surface: 'tarmac', banking: 0 },
  { x: 0, y: 0, z: 98, width: 13, surface: 'tarmac', banking: 0 },
  { x: 0, y: 0, z: 117.6, width: 13, surface: 'tarmac', banking: 0 },
  { x: 0, y: 0.02, z: 137.2, width: 13, surface: 'tarmac', banking: 0 },
  { x: 0, y: 0.09, z: 156.8, width: 13, surface: 'tarmac', banking: 0 },
  { x: 0, y: 0.25, z: 176.4, width: 12, surface: 'tarmac', banking: 0 },
  { x: -3.39, y: 0.58, z: 197.91, width: 12, surface: 'tarmac', banking: 0 },
  { x: -13.23, y: 1.05, z: 217.35, width: 12, surface: 'tarmac', banking: 0 },
  { x: -28.56, y: 1.72, z: 232.81, width: 12, surface: 'tarmac', banking: 0 },
  { x: -47.9, y: 2.71, z: 242.82, width: 11, surface: 'tarmac', banking: 0 },
  { x: -66.68, y: 3.99, z: 249.07, width: 11, surface: 'tarmac', banking: 0 },
  { x: -85.45, y: 5.45, z: 255.31, width: 11, surface: 'tarmac', banking: 0 },
  { x: -104.23, y: 7.13, z: 261.56, width: 11, surface: 'tarmac', banking: 0 },
  { x: -123, y: 8.85, z: 267.8, width: 11, surface: 'tarmac', banking: 0 },
  { x: -141.78, y: 10.55, z: 274.05, width: 11, surface: 'tarmac', banking: 0 },
  { x: -160.55, y: 12.15, z: 280.29, width: 11, surface: 'tarmac', banking: 0 },
  { x: -179.32, y: 13.51, z: 286.54, width: 12.5, surface: 'tarmac', banking: 0 },
  { x: -186.39, y: 14.08, z: 290.65, width: 12.5, surface: 'tarmac', banking: 0 },
  { x: -191.22, y: 14.57, z: 297.25, width: 12.5, surface: 'tarmac', banking: 0 },
  { x: -193.01, y: 15.05, z: 305.22, width: 12.5, surface: 'tarmac', banking: 0 },
  { x: -191.46, y: 15.52, z: 313.25, width: 12.5, surface: 'tarmac', banking: 0 },
  { x: -186.82, y: 16.08, z: 319.98, width: 12.5, surface: 'tarmac', banking: 0 },
  { x: -179.88, y: 16.62, z: 324.3, width: 12.5, surface: 'tarmac', banking: 0 },
  { x: -171.79, y: 17.2, z: 325.48, width: 12.5, surface: 'tarmac', banking: 0 },
  { x: -151.31, y: 18.98, z: 324.23, width: 11, surface: 'tarmac', banking: 0 },
  { x: -130.83, y: 20.94, z: 322.97, width: 11, surface: 'tarmac', banking: 0 },
  { x: -110.34, y: 23.1, z: 321.72, width: 11, surface: 'tarmac', banking: 0 },
  { x: -89.86, y: 25.06, z: 320.47, width: 11, surface: 'tarmac', banking: 0 },
  { x: -69.38, y: 26.84, z: 319.22, width: 12.5, surface: 'tarmac', banking: 0 },
  { x: -61.4, y: 27.43, z: 320.35, width: 12.5, surface: 'tarmac', banking: 0 },
  { x: -54.52, y: 27.98, z: 324.55, width: 12.5, surface: 'tarmac', banking: 0 },
  { x: -49.86, y: 28.5, z: 331.12, width: 12.5, surface: 'tarmac', banking: 0 },
  { x: -48.16, y: 29.01, z: 338.99, width: 12.5, surface: 'tarmac', banking: 0 },
  { x: -49.71, y: 29.53, z: 346.9, width: 12.5, surface: 'tarmac', banking: 0 },
  { x: -54.26, y: 30.08, z: 353.55, width: 12.5, surface: 'tarmac', banking: 0 },
  { x: -61.06, y: 30.67, z: 357.87, width: 12.5, surface: 'tarmac', banking: 0 },
  { x: -80.07, y: 32.46, z: 365.1, width: 11, surface: 'tarmac', banking: 0 },
  { x: -99.09, y: 34.44, z: 372.32, width: 11, surface: 'tarmac', banking: 0 },
  { x: -118.1, y: 36.51, z: 379.54, width: 11, surface: 'tarmac', banking: 0 },
  { x: -137.12, y: 38.57, z: 386.77, width: 11, surface: 'tarmac', banking: 0 },
  { x: -156.13, y: 40.24, z: 393.99, width: 12.5, surface: 'tarmac', banking: 0 },
  { x: -163.6, y: 40.87, z: 398.73, width: 12.5, surface: 'tarmac', banking: 0 },
  { x: -168.6, y: 41.44, z: 406.03, width: 12.5, surface: 'tarmac', banking: 0 },
  { x: -170.32, y: 41.95, z: 414.71, width: 12.5, surface: 'tarmac', banking: 0 },
  { x: -168.48, y: 42.43, z: 423.36, width: 12.5, surface: 'tarmac', banking: 0 },
  { x: -163.38, y: 42.89, z: 430.59, width: 12.5, surface: 'tarmac', banking: 0 },
  { x: -155.84, y: 43.37, z: 435.23, width: 12.5, surface: 'tarmac', banking: 0 },
  { x: -147.09, y: 43.8, z: 436.52, width: 12.5, surface: 'tarmac', banking: 0 },
  { x: -128.19, y: 44.89, z: 435.46, width: 11, surface: 'tarmac', banking: 0 },
  { x: -109.28, y: 46.02, z: 434.41, width: 11, surface: 'tarmac', banking: 0 },
  { x: -90.38, y: 47.07, z: 433.35, width: 12, surface: 'tarmac', banking: 0 },
  { x: -68.57, y: 48.06, z: 435.13, width: 12, surface: 'tarmac', banking: 0 },
  { x: -48.06, y: 48.87, z: 442.75, width: 12, surface: 'tarmac', banking: 0 },
  { x: -30.38, y: 49.58, z: 455.64, width: 12, surface: 'tarmac', banking: 0 },
  { x: -16.85, y: 50.21, z: 472.84, width: 12, surface: 'tarmac', banking: 0 },
  { x: -8.5, y: 50.7, z: 493.06, width: 12, surface: 'tarmac', banking: 0 },
  { x: -3.69, y: 50.99, z: 511.49, width: 12, surface: 'tarmac', banking: 0 },
  { x: 1.11, y: 51.17, z: 529.93, width: 12, surface: 'tarmac', banking: 0 },
  { x: 5.91, y: 51.29, z: 548.36, width: 12, surface: 'tarmac', banking: 0 },
  { x: 10.71, y: 51.4, z: 566.8, width: 12, surface: 'tarmac', banking: 0 },
  { x: 15.51, y: 51.5, z: 585.23, width: 12, surface: 'tarmac', banking: 0 },
  { x: 20.32, y: 51.6, z: 603.67, width: 12, surface: 'tarmac', banking: 0 },
  { x: 25.12, y: 51.69, z: 622.1, width: 12, surface: 'tarmac', banking: 0 },
  { x: 29.92, y: 51.76, z: 640.54, width: 12, surface: 'tarmac', banking: 0 },
  { x: 34.72, y: 51.74, z: 658.97, width: 12, surface: 'tarmac', banking: 0 },
  { x: 39.52, y: 51.55, z: 677.41, width: 12, surface: 'tarmac', banking: 0 },
  { x: 40.64, y: 51.25, z: 694.24, width: 12, surface: 'tarmac', banking: 0 },
  { x: 35.49, y: 50.79, z: 710.29, width: 12, surface: 'tarmac', banking: 0 },
  { x: 24.78, y: 50.24, z: 723.32, width: 12, surface: 'tarmac', banking: 0 },
  { x: 10.03, y: 49.62, z: 731.5, width: 12, surface: 'tarmac', banking: 0 },
  { x: -6.69, y: 48.91, z: 733.67, width: 12, surface: 'tarmac', banking: 0 },
  { x: -23.04, y: 48.06, z: 729.54, width: 12, surface: 'tarmac', banking: 0 },
  { x: -40.36, y: 46.92, z: 721.46, width: 12, surface: 'tarmac', banking: 0 },
  { x: -57.68, y: 45.55, z: 713.38, width: 12, surface: 'tarmac', banking: 0 },
  { x: -75, y: 44.15, z: 705.31, width: 12, surface: 'tarmac', banking: 0 },
  { x: -92.31, y: 42.73, z: 697.23, width: 12, surface: 'tarmac', banking: 0 },
  { x: -109.63, y: 41.3, z: 689.16, width: 12, surface: 'tarmac', banking: 0 },
  { x: -126.95, y: 39.88, z: 681.08, width: 12, surface: 'tarmac', banking: 0 },
  { x: -144.27, y: 38.46, z: 673.01, width: 12, surface: 'tarmac', banking: 0 },
  { x: -161.59, y: 37.06, z: 664.93, width: 12, surface: 'tarmac', banking: 0 },
  { x: -175.52, y: 35.96, z: 662.15, width: 12, surface: 'tarmac', banking: 0 },
  { x: -189.18, y: 34.95, z: 666.09, width: 12, surface: 'tarmac', banking: 0 },
  { x: -202.33, y: 33.92, z: 670, width: 12, surface: 'tarmac', banking: 0 },
  { x: -215.85, y: 32.88, z: 667.65, width: 12, surface: 'tarmac', banking: 0 },
  { x: -234.92, y: 31.37, z: 659.52, width: 12, surface: 'tarmac', banking: 0 },
  { x: -253.98, y: 29.74, z: 651.39, width: 12, surface: 'tarmac', banking: 0 },
  { x: -273.04, y: 28.1, z: 643.25, width: 12, surface: 'tarmac', banking: 0 },
  { x: -292.11, y: 26.54, z: 635.12, width: 12, surface: 'tarmac', banking: 0 },
  { x: -311.17, y: 24.89, z: 626.99, width: 12, surface: 'tarmac', banking: 0 },
  { x: -330.23, y: 23.25, z: 618.86, width: 12, surface: 'tarmac', banking: 0 },
  { x: -349.3, y: 21.65, z: 610.73, width: 12, surface: 'tarmac', banking: 0.0371 },
  { x: -368.36, y: 20.19, z: 602.6, width: 12, surface: 'tarmac', banking: 0.12 },
  { x: -384.31, y: 18.88, z: 592.58, width: 12, surface: 'tarmac', banking: 0.12 },
  { x: -396.37, y: 17.63, z: 578.11, width: 12, surface: 'tarmac', banking: 0.12 },
  { x: -403.35, y: 16.45, z: 560.62, width: 12, surface: 'tarmac', banking: 0.12 },
  { x: -404.56, y: 15.37, z: 541.83, width: 12, surface: 'tarmac', banking: 0.12 },
  { x: -399.89, y: 14.45, z: 523.58, width: 12, surface: 'tarmac', banking: 0.12 },
  { x: -391.92, y: 13.71, z: 505.16, width: 12, surface: 'tarmac', banking: 0.0397 },
  { x: -383.95, y: 13.14, z: 486.75, width: 12, surface: 'tarmac', banking: 0 },
  { x: -375.98, y: 12.66, z: 468.33, width: 12, surface: 'tarmac', banking: 0 },
  { x: -368.01, y: 12.21, z: 449.91, width: 12, surface: 'tarmac', banking: 0 },
  { x: -360.04, y: 11.76, z: 431.5, width: 12, surface: 'tarmac', banking: 0 },
  { x: -352.07, y: 11.32, z: 413.08, width: 12, surface: 'tarmac', banking: 0 },
  { x: -344.1, y: 10.87, z: 394.66, width: 12, surface: 'tarmac', banking: 0 },
  { x: -336.13, y: 10.42, z: 376.24, width: 12, surface: 'tarmac', banking: 0 },
  { x: -328.16, y: 9.95, z: 357.83, width: 12, surface: 'tarmac', banking: 0 },
  { x: -320.19, y: 9.51, z: 339.41, width: 12, surface: 'tarmac', banking: 0 },
  { x: -312.22, y: 9.06, z: 320.99, width: 12, surface: 'tarmac', banking: 0 },
  { x: -304.25, y: 8.61, z: 302.58, width: 12, surface: 'tarmac', banking: 0 },
  { x: -296.28, y: 8.17, z: 284.16, width: 12, surface: 'tarmac', banking: 0 },
  { x: -288.31, y: 7.72, z: 265.74, width: 12, surface: 'tarmac', banking: 0 },
  { x: -280.34, y: 7.27, z: 247.32, width: 12, surface: 'tarmac', banking: 0 },
  { x: -272.37, y: 6.83, z: 228.91, width: 12, surface: 'tarmac', banking: 0 },
  { x: -264.4, y: 6.38, z: 210.49, width: 12, surface: 'tarmac', banking: 0 },
  { x: -256.43, y: 5.93, z: 192.07, width: 12, surface: 'tarmac', banking: 0 },
  { x: -248.46, y: 5.49, z: 173.66, width: 12, surface: 'tarmac', banking: 0 },
  { x: -240.49, y: 5.04, z: 155.24, width: 12, surface: 'tarmac', banking: 0 },
  { x: -232.52, y: 4.59, z: 136.82, width: 12, surface: 'tarmac', banking: 0 },
  { x: -224.55, y: 4.15, z: 118.41, width: 12, surface: 'tarmac', banking: 0 },
  { x: -216.58, y: 3.7, z: 99.99, width: 12, surface: 'tarmac', banking: 0 },
  { x: -208.61, y: 3.23, z: 81.57, width: 12, surface: 'tarmac', banking: 0 },
  { x: -200.64, y: 2.78, z: 63.15, width: 12, surface: 'tarmac', banking: 0 },
  { x: -192.67, y: 2.34, z: 44.74, width: 12, surface: 'tarmac', banking: 0 },
  { x: -184.7, y: 1.91, z: 26.32, width: 12, surface: 'tarmac', banking: 0 },
  { x: -176.73, y: 1.51, z: 7.9, width: 12, surface: 'tarmac', banking: 0 },
  { x: -168.76, y: 1.19, z: -10.51, width: 12, surface: 'tarmac', banking: 0 },
  { x: -158.86, y: 1.01, z: -23.66, width: 13, surface: 'tarmac', banking: 0 },
  { x: -144.04, y: 0.87, z: -30.82, width: 13, surface: 'tarmac', banking: 0 },
  { x: -123.17, y: 0.74, z: -35.34, width: 13, surface: 'tarmac', banking: 0 },
  { x: -102.3, y: 0.63, z: -39.85, width: 13, surface: 'tarmac', banking: 0 },
  { x: -81.43, y: 0.53, z: -44.36, width: 13, surface: 'tarmac', banking: 0 },
  { x: -60.57, y: 0.43, z: -48.87, width: 13, surface: 'tarmac', banking: 0 },
  { x: -38.46, y: 0.32, z: -48.65, width: 13, surface: 'tarmac', banking: 0 },
  { x: -18.6, y: 0.22, z: -38.91, width: 13, surface: 'tarmac', banking: 0 },
  { x: -4.89, y: 0.12, z: -21.56, width: 13, surface: 'tarmac', banking: 0 },
  ],
};
