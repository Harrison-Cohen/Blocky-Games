// Pine Ridge. Forest hill climb loop: 1924 m and 63 m of climb.
//
// THIS FILE IS DATA. See harbor-nine.js for the prop vocabulary.
//
// Layout, from the start line on the valley floor: a long right-hand sweeper
// opens the climb, then a second right and a left kink up through the trees.
// At the entry to Turn 4 the tarmac stops and 565 m of gravel begins -- very
// nearly the middle sector -- climbing to the ridge, over a crest and along the
// top. The tarmac comes back at the entry to the banked downhill sweeper,
// which is 110 degrees at 60 m radius with the outside edge raised 7.5 degrees,
// and from there it is downhill all the way home.
//
// Three things to know about it:
//
//   The crest at 799 m is laid on top of the elevation profile as a smooth bump
//   rather than cut into it, so its vertical radius is a chosen number, about
//   100 m, instead of whatever the spline happened to do to a kink. Measured
//   flat out, since hills started pulling cars down them: they arrive at 38 to
//   41 m/s, and all but the Wedge One leave the ground, for between a tenth of
//   a second and 1.2 s; the Wedge's downforce holds it down. It is a jump, not
//   a rise, and the one place on any circuit where the car is in the air.
//
//   The gravel is 0.75 grip with heavy drag, so the middle sector is about
//   throttle discipline rather than commitment. The 4x4's off-road bonus is
//   worth real time here and nowhere else.
//
//   The steepest sustained gradient is 11%, on the climb out of Turn 2 and on
//   the descent off the ridge. The apron grades to the verge beside the road
//   rather than to the bottom of the valley, so the road never runs along the
//   top of a wall.
//
// The turn angles sum to a full circle, which is what closes the loop.

export default {
  id: 'pine-ridge',
  name: 'Pine Ridge',
  description: 'Forest hill climb. Real elevation, a gravel middle sector and a banked downhill sweeper.',
  order: 3,
  targetLap: 80,

  // 120 m up the opening straight, before the road starts to climb.
  startDistance: 120,

  // Run wide here and you are in the grass at the treeline: 0.55 grip and
  // enough drag to make it a genuine mistake rather than a shortcut.
  runoffSurface: 'grass',
  barrierStyle: 'guardrail',
  barrierGap: 6.5,

  // Real hills. This is the one track where the terrain outside the barriers
  // is doing as much work as the road.
  terrain: { amplitude: 55, fade: 120 },

  palette: {
    sky: 0xa2b3ae,
    fog: 0xa2b3ae,
    ground: 0x2c4630,
    road: 0x3b4048,
    // The gravel sector is a road, not run-off, so it gets its own colour
    // rather than borrowing the verge's.
    gravel: 0x8d8474,
    grass: 0x40603a,
    curbA: 0xc8452b,
    curbB: 0xe4e0d4,
    barrier: 0x74806c,
    runoff: 0x466038,
    sun: 0xfff2dc,
    hemiGround: 0x24401f,
  },
  // Close and cold, so the trees fade into it a couple of corners ahead.
  fog: { near: 65, far: 360 },
  sunDirection: { x: -0.62, y: 0.55, z: 0.56 },
  sunIntensity: 2.0,
  hemiIntensity: 1.05,

  // Cold and overcast-bright: a grey-blue zenith over the mist, and low cloud.
  sky: { top: 0x5f7f98, gradient: 0.6, haze: 0.3, clouds: 55, cloudHeight: 210,
    cloudColor: 0xe6eae8, wind: 5, discGlow: 5 },
  post: { bloom: 0.2, bloomThreshold: 1.6 },

  props: [
    // The forest. Trunk height and the height the foliage starts at are fixed
    // so the two always meet; the number of tiers, their size and how fast they
    // shrink are what make one tree different from the next.
    {
      name: 'pines', count: 700, variants: 5, clearance: 1.5,
      minOffset: 20, maxOffset: 155, minScale: 0.75, maxScale: 1.75,
      parts: [
        { color: 0x3a2c1e, w: 0.85, h: 4.0, d: 0.85 },
        { color: [0x24552f, 0x1d4a2a, 0x2c6236, 0x1a4226, 0x2f6b3a],
          w: [4.4, 5.6], h: [2.2, 2.9], y: 2.4,
          repeat: [3, 5], shrink: [0.70, 0.80], taper: [0.85, 0.95], rise: [-1.0, -0.6] },
      ],
    },

    // Slate outcrops. Self-contained stacks, so ranges are safe here.
    {
      name: 'outcrops', count: 140, variants: 4, clearance: 3,
      minOffset: 22, maxOffset: 170, minScale: 0.7, maxScale: 2.2,
      parts: [
        { color: [0x6b6f74, 0x585d64, 0x777b80, 0x4e535a],
          w: [2.4, 5.0], h: [1.2, 3.0], d: [2.0, 4.4],
          repeat: [1, 3], shrink: [0.6, 0.8], taper: [0.7, 0.9],
          spin: [0, 1.6], jitter: 1.6 },
      ],
    },

    // Low brush and stumps right up against the treeline, so the edge of the
    // road is busy rather than a clean line into empty grass.
    {
      name: 'brush', count: 320, variants: 4, clearance: 1, shadow: false,
      minOffset: 17, maxOffset: 75, minScale: 0.6, maxScale: 1.4,
      parts: [
        { color: [0x2d4a26, 0x35562c, 0x3f5a2e, 0x4a3a24],
          w: [1.0, 2.2], h: [0.6, 1.4], d: [1.0, 2.0],
          repeat: [1, 3], shrink: [0.6, 0.85], spin: [0, 1.5], jitter: 1.4 },
      ],
    },

    // Marker posts, so the edge of the road is legible where the trees close in
    // and the fog takes the corner exit away.
    {
      name: 'markers', place: 'line', variants: 1, shadow: false,
      spacing: 32, offset: 17.2, sides: [1, -1],
      parts: [
        { color: 0xe4e0d4, w: 0.16, h: 1.1, d: 0.16 },
        { color: 0xff7a1a, emissive: 0x5a2400, w: 0.2, h: 0.24, d: 0.2, y: 0.88 },
      ],
    },
  ],

  // x, y, z   world position of the centerline, metres
  // width     FULL road width here, metres
  // surface   applies from this point up to the next
  // banking   radians about the road's own tangent; positive raises the left
  //           edge, which is correct banking for a right hand corner. Every
  //           banked corner here turns right, so banking is positive.
  controlPoints: [
  { x: 0, y: 2, z: 0, width: 15, surface: 'tarmac', banking: 0 },
  { x: 0, y: 2.3, z: 20.33, width: 14.8, surface: 'tarmac', banking: 0 },
  { x: 0, y: 2.6, z: 40.67, width: 14.7, surface: 'tarmac', banking: 0 },
  { x: 0, y: 2.89, z: 61, width: 14.5, surface: 'tarmac', banking: 0 },
  { x: 0, y: 3.19, z: 81.33, width: 14.4, surface: 'tarmac', banking: 0 },
  { x: 0, y: 3.49, z: 101.67, width: 14.2, surface: 'tarmac', banking: 0 },
  { x: 0, y: 3.79, z: 122, width: 14.1, surface: 'tarmac', banking: 0 },
  { x: -4.22, y: 4.93, z: 145.94, width: 14, surface: 'tarmac', banking: 0.0275 },
  { x: -16.38, y: 7.24, z: 167, width: 13.9, surface: 'tarmac', banking: 0.045 },
  { x: -35, y: 9.54, z: 182.62, width: 13.9, surface: 'tarmac', banking: 0.045 },
  { x: -57.84, y: 11.85, z: 190.94, width: 13.8, surface: 'tarmac', banking: 0.0225 },
  { x: -80.5, y: 14.03, z: 194.93, width: 13.8, surface: 'tarmac', banking: 0 },
  { x: -103.15, y: 16.2, z: 198.92, width: 13.7, surface: 'tarmac', banking: 0 },
  { x: -125.8, y: 18.37, z: 202.92, width: 13.7, surface: 'tarmac', banking: 0 },
  { x: -148.45, y: 20.55, z: 206.91, width: 13.6, surface: 'tarmac', banking: 0 },
  { x: -171.1, y: 22.72, z: 210.91, width: 13.6, surface: 'tarmac', banking: 0 },
  { x: -193.75, y: 24.89, z: 214.9, width: 13.5, surface: 'tarmac', banking: 0 },
  { x: -212.85, y: 26.85, z: 214.9, width: 13.5, surface: 'tarmac', banking: 0 },
  { x: -230.8, y: 29.04, z: 208.37, width: 13.4, surface: 'tarmac', banking: 0 },
  { x: -245.43, y: 31.23, z: 196.09, width: 13.3, surface: 'tarmac', banking: 0 },
  { x: -257.64, y: 33.4, z: 181.53, width: 13.3, surface: 'tarmac', banking: 0 },
  { x: -269.86, y: 35.57, z: 166.98, width: 13.2, surface: 'tarmac', banking: 0 },
  { x: -284.73, y: 37.83, z: 153.94, width: 13.2, surface: 'tarmac', banking: 0 },
  { x: -302.83, y: 40.1, z: 145.98, width: 13.1, surface: 'tarmac', banking: 0 },
  { x: -322.49, y: 42.36, z: 143.82, width: 13, surface: 'tarmac', banking: 0 },
  { x: -341.88, y: 44.42, z: 147.68, width: 13, surface: 'tarmac', banking: 0 },
  { x: -362.08, y: 46.05, z: 155.03, width: 13, surface: 'tarmac', banking: 0 },
  { x: -382.29, y: 47.67, z: 162.39, width: 13, surface: 'tarmac', banking: 0 },
  { x: -402.49, y: 49.3, z: 169.74, width: 13, surface: 'tarmac', banking: 0 },
  { x: -422.69, y: 50.93, z: 177.09, width: 13, surface: 'tarmac', banking: 0 },
  { x: -442.9, y: 52.56, z: 184.45, width: 13, surface: 'tarmac', banking: 0 },
  { x: -463.1, y: 54.19, z: 191.8, width: 12.7, surface: 'gravel', banking: 0 },
  { x: -480.46, y: 55.53, z: 194.47, width: 12.2, surface: 'gravel', banking: 0 },
  { x: -497.51, y: 56.87, z: 190.3, width: 12, surface: 'gravel', banking: 0 },
  { x: -511.67, y: 58.08, z: 179.92, width: 12, surface: 'gravel', banking: 0 },
  { x: -520.78, y: 58.59, z: 164.91, width: 12, surface: 'gravel', banking: 0 },
  { x: -525.6, y: 59.23, z: 151.67, width: 12, surface: 'gravel', banking: 0 },
  { x: -530.42, y: 60.45, z: 138.43, width: 12, surface: 'gravel', banking: 0 },
  { x: -535.24, y: 62.44, z: 125.19, width: 12, surface: 'gravel', banking: 0 },
  { x: -540.05, y: 64.49, z: 111.95, width: 12, surface: 'gravel', banking: 0 },
  { x: -544.87, y: 64.69, z: 98.71, width: 12, surface: 'gravel', banking: 0 },
  { x: -549.69, y: 63.11, z: 85.47, width: 12, surface: 'gravel', banking: 0 },
  { x: -554.51, y: 61.04, z: 72.23, width: 12, surface: 'gravel', banking: 0 },
  { x: -559.33, y: 59.59, z: 58.99, width: 12, surface: 'gravel', banking: 0 },
  { x: -564.15, y: 58.86, z: 45.75, width: 12, surface: 'gravel', banking: 0 },
  { x: -568.97, y: 58.47, z: 32.51, width: 12, surface: 'gravel', banking: 0 },
  { x: -571.93, y: 58.17, z: 17.59, width: 12, surface: 'gravel', banking: 0 },
  { x: -570.28, y: 57.88, z: 2.47, width: 12.1, surface: 'gravel', banking: 0 },
  { x: -564.15, y: 57.59, z: -11.46, width: 12.1, surface: 'gravel', banking: 0 },
  { x: -554.12, y: 57.3, z: -22.89, width: 12.1, surface: 'gravel', banking: 0 },
  { x: -538.65, y: 57.09, z: -35.88, width: 12.2, surface: 'gravel', banking: 0 },
  { x: -523.17, y: 57.55, z: -48.86, width: 12.3, surface: 'gravel', banking: 0 },
  { x: -507.7, y: 58.02, z: -61.85, width: 12.3, surface: 'gravel', banking: 0 },
  { x: -492.23, y: 58.48, z: -74.83, width: 12.4, surface: 'gravel', banking: 0 },
  { x: -476.75, y: 58.94, z: -87.81, width: 12.4, surface: 'gravel', banking: 0 },
  { x: -461.33, y: 59.48, z: -105.14, width: 12.5, surface: 'gravel', banking: 0 },
  { x: -451.53, y: 59.99, z: -126.15, width: 12.6, surface: 'gravel', banking: 0 },
  { x: -448.17, y: 59.4, z: -149.1, width: 12.8, surface: 'gravel', banking: 0 },
  { x: -448.17, y: 58.88, z: -169.43, width: 12.9, surface: 'gravel', banking: 0 },
  { x: -448.17, y: 58.37, z: -189.76, width: 13, surface: 'gravel', banking: 0 },
  { x: -448.17, y: 57.85, z: -210.1, width: 13.1, surface: 'gravel', banking: 0 },
  { x: -448.17, y: 57.34, z: -230.43, width: 13.2, surface: 'gravel', banking: 0 },
  { x: -448.17, y: 56.82, z: -250.76, width: 13.4, surface: 'gravel', banking: 0.0299 },
  { x: -448.17, y: 56.31, z: -271.1, width: 13.5, surface: 'tarmac', banking: 0.0929 },
  { x: -443.8, y: 54.84, z: -293.57, width: 14, surface: 'tarmac', banking: 0.13 },
  { x: -431.33, y: 52.41, z: -312.78, width: 14, surface: 'tarmac', banking: 0.13 },
  { x: -412.58, y: 49.98, z: -325.91, width: 14, surface: 'tarmac', banking: 0.13 },
  { x: -390.27, y: 47.55, z: -331.06, width: 14, surface: 'tarmac', banking: 0.1119 },
  { x: -367.65, y: 45.12, z: -327.48, width: 14, surface: 'tarmac', banking: 0.052 },
  { x: -347.44, y: 42.85, z: -320.12, width: 14, surface: 'tarmac', banking: 0 },
  { x: -327.23, y: 40.56, z: -312.77, width: 14, surface: 'tarmac', banking: 0 },
  { x: -307.01, y: 38.25, z: -305.41, width: 14, surface: 'tarmac', banking: 0 },
  { x: -286.8, y: 35.93, z: -298.05, width: 14, surface: 'tarmac', banking: 0 },
  { x: -266.59, y: 33.62, z: -290.7, width: 14, surface: 'tarmac', banking: 0 },
  { x: -246.38, y: 31.31, z: -283.34, width: 14, surface: 'tarmac', banking: 0 },
  { x: -231.94, y: 29.51, z: -275, width: 14, surface: 'tarmac', banking: 0 },
  { x: -221.22, y: 27.71, z: -262.23, width: 14.1, surface: 'tarmac', banking: 0 },
  { x: -215.52, y: 25.9, z: -246.57, width: 14.1, surface: 'tarmac', banking: 0 },
  { x: -211.88, y: 23.67, z: -225.89, width: 14.2, surface: 'tarmac', banking: 0 },
  { x: -208.23, y: 21.54, z: -205.21, width: 14.2, surface: 'tarmac', banking: 0 },
  { x: -204.58, y: 19.41, z: -184.53, width: 14.3, surface: 'tarmac', banking: 0 },
  { x: -200.94, y: 17.29, z: -163.84, width: 14.3, surface: 'tarmac', banking: 0 },
  { x: -192.62, y: 14.82, z: -141, width: 14.4, surface: 'tarmac', banking: 0 },
  { x: -177, y: 12.34, z: -122.38, width: 14.4, surface: 'tarmac', banking: 0 },
  { x: -155.94, y: 9.87, z: -110.22, width: 14.5, surface: 'tarmac', banking: 0 },
  { x: -132, y: 8.23, z: -106, width: 14.6, surface: 'tarmac', banking: 0 },
  { x: -109, y: 7.11, z: -106, width: 14.6, surface: 'tarmac', banking: 0 },
  { x: -86, y: 5.99, z: -106, width: 14.7, surface: 'tarmac', banking: 0 },
  { x: -63, y: 4.87, z: -106, width: 14.7, surface: 'tarmac', banking: 0 },
  { x: -40, y: 3.75, z: -106, width: 14.7, surface: 'tarmac', banking: 0 },
  { x: -24.69, y: 3, z: -102.96, width: 14.8, surface: 'tarmac', banking: 0 },
  { x: -11.72, y: 2.86, z: -94.28, width: 14.8, surface: 'tarmac', banking: 0 },
  { x: -3.04, y: 2.72, z: -81.31, width: 14.8, surface: 'tarmac', banking: 0 },
  { x: 0, y: 2.58, z: -66, width: 14.9, surface: 'tarmac', banking: 0 },
  { x: 0, y: 2.39, z: -44, width: 14.9, surface: 'tarmac', banking: 0 },
  { x: 0, y: 2.19, z: -22, width: 15, surface: 'tarmac', banking: 0 },
  ],
};
