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
  // Real factory colours, for the cars modelled on real ones, named as their
  // makers name them. The per-car schemes in customization.js use these.
  { id: 'guards-red', name: 'Guards red', hex: 0xc2141c },
  { id: 'miami-blue', name: 'Miami blue', hex: 0x2aa8d6 },
  { id: 'gt-silver', name: 'GT silver', hex: 0xb8bbbd },
  { id: 'race-red', name: 'Race red', hex: 0xd0232b },
  { id: 'grabber-blue', name: 'Grabber blue', hex: 0x1f5fc4 },
  { id: 'jet-black', name: 'Jet black', hex: 0x121315 },
  { id: 'lemans-blue', name: 'LeMans blue', hex: 0x223f8a },
  { id: 'daytona-yellow', name: 'Daytona yellow', hex: 0xf0c419 },
  { id: 'rosso-corsa', name: 'Rosso Corsa', hex: 0xcf0a0a },
  { id: 'giallo-modena', name: 'Giallo Modena', hex: 0xf6d000 },
  { id: 'verde-mantis', name: 'Verde Mantis', hex: 0x6fbe2a },
  { id: 'arancio-borealis', name: 'Arancio Borealis', hex: 0xf06a10 },
  { id: 'red-multicoat', name: 'Red Multi-Coat', hex: 0xa3121c },
  { id: 'midnight-silver', name: 'Midnight Silver', hex: 0x4e5257 },
  { id: 'pearl-white', name: 'Pearl White', hex: 0xf2f1ec },
];

// CSS-side equivalents, so the HUD and the 3D world never disagree about a color.
export const CSS = {
  ink: '#0E1A2B',
  signal: '#FF7A1A',
  offwhite: '#EDEDE7',
  purple: '#B57BFF',
  green: '#34D17A',
  yellow: '#F5C518',
  // The start lamps' red, reused for the rev counter's red zone.
  redline: '#E8321F',
};

export function hexToCss(hex) {
  return '#' + hex.toString(16).padStart(6, '0');
}
