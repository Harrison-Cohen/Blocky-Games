// The biomes of the flight world, as data.
//
// A biome is a look and a vocabulary of scenery: the tones the ground's facets
// are cut from, the colour of bare rock and sand, the horizon colour its fog
// leans toward, the height snow starts at, and a list of props. Nothing outside
// this file knows what a pine or a cactus is; the world builds whatever is
// listed here, so a new biome (or a new tree) is an entry in this file.
//
// Two kinds of biome. The land has a REGIONAL one, chosen from slow temperature
// and moisture patterns (grassland, desert, forest, snow, flats). A race track's
// area imposes its own over the ground around it, blending in over a transition
// band, which is how a port gets its coast and a city its downtown (coast and
// city are only ever imposed by a track).
//
// A track names its biome in `world: { biome }`. A track that does not gets one
// from its palette, terrain and surfaces (src/world/Biomes.js, inferBiome).
//
// Colours are packed 0xRRGGBB as an artist sees them; the world turns them into
// the linear values its vertex colours need.
//
// PROPS. A prop is boxes, in the same vocabulary as a track's scenery (see
// TrackMesh): each part has w, h, d (d defaults to w), x, y, z (y is the BOTTOM,
// so a part stands on the ground), and a colour. `repeat` stacks copies upward,
// each `shrink` times the width of the one below. A [lo, hi] pair is rolled once
// when the prop is built. Parts are baked into ONE geometry per prop, with a
// colour per vertex, so every prop is one instanced draw per chunk.
//   density   the share of lattice cells that carry one, at the finest level
//   cell      the lattice, metres (the world's `propCell` when absent)
//   scale     [lo, hi] each instance is scaled by; `stretch` instead gives a
//             [lo, hi] for width, height and depth separately (towers)
//   minNy     the steepest ground it will stand on (the face normal's y)
//   minH,maxH the heights above the sea it stands between
// Seeded per prop id, so a prop looks the same every launch.

export const BIOME_IDS = ['grassland', 'desert', 'forest', 'snow', 'flats', 'coast', 'city'];

const pine = (crown, cap) => [
  { w: 0.8, h: 2.2, color: 0x4a3a2a },
  { w: 5.2, h: 2.8, y: 1.6, color: crown, repeat: 4, shrink: 0.72, rise: -0.5 },
  ...(cap ? [{ w: 1.6, h: 1.1, y: 10.2, color: cap }] : []),
];

export const BIOMES = {
  grassland: {
    name: 'Grassland',
    ground: [0x6f9157, 0x7a9d5e, 0x628650],
    rock: 0x8b857a, sand: 0xd9cc9b,
    fog: 0xa6c8e2, snowLine: 1300,
    props: [
      { id: 'oak', density: 0.07, scale: [0.8, 1.6], minNy: 0.86, maxH: 1500,
        parts: [{ w: 0.8, h: 2.6, color: 0x5a4430 },
          { w: 4.6, h: 3.4, y: 2.4, color: 0x4f7a3a },
          { w: 3, h: 2.4, y: 5.5, color: 0x5d8c45 }] },
      { id: 'bush', density: 0.12, scale: [0.7, 1.5], minNy: 0.8, maxH: 1500,
        parts: [{ w: 2.2, h: 1.3, d: 1.8, color: 0x4a6f35 }] },
      { id: 'boulder', density: 0.025, scale: [0.8, 2.2], minNy: 0.6,
        parts: [{ w: 3, h: 1.9, d: 2.4, color: 0x8a857a }, { w: 1.8, h: 1.3, x: 1.8, z: 0.8, color: 0x7d786e }] },
    ],
  },

  desert: {
    name: 'Desert',
    ground: [0xc08652, 0xb4784a, 0xcb9560],
    rock: 0x9a5f3c, sand: 0xd9b886,
    fog: 0xd9c9a8, snowLine: 2300,
    props: [
      { id: 'cactus', density: 0.05, scale: [0.8, 1.7], minNy: 0.88, maxH: 1800,
        parts: [{ w: 0.9, h: 4.4, color: 0x5b7f3a },
          { w: 1.4, h: 0.6, d: 0.6, x: 0.9, y: 1.9, color: 0x5b7f3a },
          { w: 0.6, h: 1.8, x: 1.5, y: 1.9, color: 0x5b7f3a }] },
      { id: 'mesa', density: 0.012, scale: [1, 3.2], minNy: 0.8, cell: 90,
        parts: [{ w: 14, h: 5, d: 11, color: 0xb06a3a },
          { w: 10, h: 5, d: 8, y: 5, color: 0xc2794a },
          { w: 7, h: 3, d: 5.5, y: 10, color: 0xa65f34 }] },
      { id: 'scrub', density: 0.1, scale: [0.6, 1.4], minNy: 0.8,
        parts: [{ w: 1.6, h: 0.8, d: 1.3, color: 0x8a8148 }] },
    ],
  },

  forest: {
    name: 'Forest',
    ground: [0x41683a, 0x4a7240, 0x375b34],
    rock: 0x6f6d66, sand: 0xc9bd8f,
    fog: 0x9fb8b0, snowLine: 1450,
    props: [
      { id: 'pine', density: 0.34, scale: [0.8, 1.7], minNy: 0.82, maxH: 1900,
        parts: pine(0x2f5a34) },
      { id: 'pine-dark', density: 0.14, scale: [0.9, 1.8], minNy: 0.82, maxH: 1900,
        parts: pine(0x244a2c) },
      { id: 'boulder', density: 0.02, scale: [0.8, 2], minNy: 0.6,
        parts: [{ w: 3, h: 1.9, d: 2.4, color: 0x6f6d66 }] },
    ],
  },

  snow: {
    name: 'Snow',
    ground: [0xeef3f7, 0xe3ebf1, 0xf6f9fb],
    rock: 0x77797d, sand: 0xdfe6ec,
    fog: 0xc9dae8, snowLine: 300,
    props: [
      { id: 'pine-snow', density: 0.13, scale: [0.8, 1.6], minNy: 0.84, maxH: 2000,
        parts: pine(0x2b4d3c, 0xeef3f7) },
      { id: 'ice-rock', density: 0.03, scale: [0.9, 2.4], minNy: 0.6,
        parts: [{ w: 3.4, h: 2.4, d: 2.8, color: 0x8d949c }, { w: 2, h: 1, y: 2.4, color: 0xeef3f7 }] },
    ],
  },

  flats: {
    name: 'Dry flats',
    ground: [0xc9bd94, 0xbfb388, 0xd2c79f],
    rock: 0xa49a82, sand: 0xdcd0a6,
    fog: 0xd8cfb8, snowLine: 3500,
    props: [
      { id: 'scrub', density: 0.06, scale: [0.6, 1.3], minNy: 0.85,
        parts: [{ w: 1.5, h: 0.7, d: 1.2, color: 0x7a7a4c }] },
      { id: 'flat-rock', density: 0.012, scale: [0.8, 1.8], minNy: 0.7,
        parts: [{ w: 3.2, h: 1.1, d: 2.6, color: 0xa49a82 }] },
    ],
  },

  coast: {
    name: 'Port and shore',
    ground: [0x7d8a82, 0x73817a, 0x88948c],
    rock: 0x6e7377, sand: 0xd2c493,
    fog: 0xa9c3d6, snowLine: 2000,
    props: [
      { id: 'container-stack', density: 0.02, scale: [1, 1.4], minNy: 0.93, maxH: 40, cell: 52,
        parts: [{ w: 2.5, h: 2.6, d: 6.1, x: -1.4, color: 0xb23a2c },
          { w: 2.5, h: 2.6, d: 6.1, x: 1.4, color: 0x1f7a80 },
          { w: 2.5, h: 2.6, d: 6.1, x: -1.4, y: 2.6, color: 0xd98a2b },
          { w: 2.5, h: 2.6, d: 6.1, x: 1.4, y: 2.6, color: 0xb23a2c }] },
      { id: 'harbour-crane', density: 0.002, scale: [1, 1.2], minNy: 0.95, maxH: 30, cell: 140,
        parts: [{ w: 3, h: 34, d: 3, x: -8, color: 0xd9a21a },
          { w: 3, h: 3, d: 46, x: -8, y: 34, z: 8, color: 0xd9a21a },
          { w: 1, h: 8, d: 1, x: -8, y: 37, z: 28, color: 0xb98a14 }] },
      { id: 'shore-grass', density: 0.06, scale: [0.7, 1.4], minNy: 0.85, maxH: 25,
        parts: [{ w: 1.8, h: 0.9, d: 1.5, color: 0x6a8650 }] },
    ],
  },

  city: {
    name: 'City',
    ground: [0x6b7076, 0x62676d, 0x74797f],
    rock: 0x7a7e84, sand: 0xc8c0a8,
    fog: 0xb0adb8, snowLine: 2200,
    props: [
      // The downtown block grid: a tower on most cells of a 96 m lattice, each
      // its own width and height, with a darker cap.
      { id: 'tower', density: 0.78, cell: 96, minNy: 0.93, maxH: 250,
        stretch: [[26, 52], [24, 150], [26, 52]],
        parts: [{ w: 1, h: 1, d: 1, color: 0x7b8493 }, { w: 0.8, h: 0.04, d: 0.8, y: 1, color: 0x4a5058 }] },
      { id: 'block', density: 0.6, cell: 96, minNy: 0.93, maxH: 250,
        stretch: [[24, 42], [10, 34], [24, 42]],
        parts: [{ w: 1, h: 1, d: 1, color: 0xa39484 }, { w: 0.7, h: 0.06, d: 0.7, y: 1, color: 0x5d5a55 }] },
    ],
  },
};
