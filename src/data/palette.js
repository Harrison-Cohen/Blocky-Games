// Palette. The six brand colors are fixed by the art direction and must not drift.
// Everything else in the game picks from here so no file ever hardcodes a hex.

export const INK = 0x0e1a2b; // panel fill, darkest structural color
export const SIGNAL = 0xff7a1a; // primary actions, speed readout
export const OFFWHITE = 0xedede7; // text and light surfaces

// Motorsport timing colors. Meaning is fixed: purple beats everyone, green beats
// your own best, yellow is slower.
export const PURPLE = 0xb57bff;
export const GREEN = 0x34d17a;
export const YELLOW = 0xf5c518;

// The 12 paint colors offered in the garage. Deliberately saturated and
// well separated in hue so six cars on a minimap are never confusable.
export const PAINTS = [
  { id: 'signal', name: 'Signal orange', hex: 0xff7a1a },
  { id: 'ember', name: 'Ember red', hex: 0xd92d20 },
  { id: 'rose', name: 'Rose', hex: 0xf25c9e },
  { id: 'violet', name: 'Violet', hex: 0xb57bff },
  { id: 'indigo', name: 'Indigo', hex: 0x4453d6 },
  { id: 'sky', name: 'Sky', hex: 0x38a9e8 },
  { id: 'teal', name: 'Teal', hex: 0x18a99a },
  { id: 'lime', name: 'Lime', hex: 0x8bc832 },
  { id: 'acid', name: 'Acid yellow', hex: 0xf5c518 },
  { id: 'sand', name: 'Sand', hex: 0xd8b878 },
  { id: 'offwhite', name: 'Off white', hex: 0xedede7 },
  { id: 'ink', name: 'Ink', hex: 0x1a2740 },
];

export function paintByIndex(i) {
  return PAINTS[((i % PAINTS.length) + PAINTS.length) % PAINTS.length];
}

// CSS-side equivalents, so the HUD and the 3D world never disagree about a color.
export const CSS = {
  ink: '#0E1A2B',
  signal: '#FF7A1A',
  offwhite: '#EDEDE7',
  purple: '#B57BFF',
  green: '#34D17A',
  yellow: '#F5C518',
};

export function hexToCss(hex) {
  return '#' + hex.toString(16).padStart(6, '0');
}
