// Everything cosmetic, and nothing else.
//
// Not one value in this file may reach VehiclePhysics. Chassis is the only
// thing that changes how a car drives; paint, wheels, wings and roof boxes are
// geometry and colour. CarBuilder is the only module that reads these lists.
//
// Options are data in the same spirit as tracks: a new livery is an entry here
// plus the geometry that draws it, and nothing else changes.

import { PAINTS } from './palette.js';
import { CHASSIS, DEFAULT_CHASSIS } from './cars.js';

export const LIVERIES = [
  { id: 'none', name: 'Plain' },
  { id: 'stripes', name: 'Racing stripes' },
  { id: 'split', name: 'Split' },
  { id: 'quarters', name: 'Quarter panels' },
  { id: 'checker', name: 'Checker' },
];

export const WHEEL_STYLES = [
  { id: 'blocky', name: 'Blocky' },
  { id: 'fivespoke', name: 'Five spoke' },
  { id: 'deepdish', name: 'Deep dish' },
  { id: 'knobby', name: 'Offroad knobby' },
];

export const SPOILERS = [
  { id: 'none', name: 'None' },
  { id: 'lip', name: 'Lip' },
  { id: 'ducktail', name: 'Ducktail' },
  { id: 'wing', name: 'Big wing' },
];

export const ROOF_ITEMS = [
  { id: 'none', name: 'None' },
  { id: 'lightbar', name: 'Light bar' },
  { id: 'box', name: 'Roof box' },
  { id: 'spare', name: 'Spare tyre' },
];

// A short list rather than the full 12: a headlight is a lens, and half the
// paint palette does not read as one.
export const HEADLIGHT_COLORS = [
  { id: 'warm', name: 'Warm white', hex: 0xfff2d0 },
  { id: 'cold', name: 'Cold white', hex: 0xdcecff },
  { id: 'amber', name: 'Amber', hex: 0xffb03a },
  { id: 'blue', name: 'Ice blue', hex: 0x8fd4ff },
];

// Any number up to four digits, typed in the garage. The roundel shrinks the
// seven-segment digits to fit as the number gets longer; past four they stop
// being readable from the chase camera.
export const NUMBER_MIN = 0;
export const NUMBER_MAX = 9999;
export const NUMBER_DIGITS = 4;

// Named paint schemes: primary, secondary and wheel colour that go together.
// Ids from palette.js, like everything else the garage stores. The player can
// save their own alongside these; see normalizePresets.
export const COLOUR_PRESETS = [
  { id: 'signal', name: 'Signal', primary: 'signal', secondary: 'ink', wheelColor: 'ink' },
  { id: 'stealth', name: 'Stealth', primary: 'ink', secondary: 'signal', wheelColor: 'ink' },
  { id: 'hornet', name: 'Hornet', primary: 'acid', secondary: 'ink', wheelColor: 'ink' },
  { id: 'arctic', name: 'Arctic', primary: 'offwhite', secondary: 'sky', wheelColor: 'ink' },
  { id: 'deep-sea', name: 'Deep sea', primary: 'indigo', secondary: 'teal', wheelColor: 'offwhite' },
  { id: 'ultraviolet', name: 'Ultraviolet', primary: 'violet', secondary: 'ink', wheelColor: 'offwhite' },
  { id: 'desert-rally', name: 'Desert rally', primary: 'sand', secondary: 'ember', wheelColor: 'ink' },
  { id: 'mint', name: 'Mint', primary: 'teal', secondary: 'offwhite', wheelColor: 'ink' },
  { id: 'bubblegum', name: 'Bubblegum', primary: 'rose', secondary: 'sky', wheelColor: 'offwhite' },
  { id: 'heatwave', name: 'Heatwave', primary: 'ember', secondary: 'acid', wheelColor: 'ink' },
  { id: 'lagoon', name: 'Lagoon', primary: 'sky', secondary: 'offwhite', wheelColor: 'indigo' },
  { id: 'copper', name: 'Copper', primary: 'signal', secondary: 'sand', wheelColor: 'ink' },
  { id: 'moss', name: 'Moss', primary: 'lime', secondary: 'ink', wheelColor: 'sand' },
];

// Each chassis starts in its own scheme, so the five cars are five different
// cars before anyone opens the garage.
export const CHASSIS_PRESET = {
  'cube-gt': 'signal',
  'boxhauler-v8': 'hornet',
  'wedge-one': 'ultraviolet',
  'haul-4x4': 'desert-rally',
  'bighead': 'bubblegum',
};

export const PRESET_NAME_MAX = 24;
export const USER_PRESET_MAX = 24;

export const DEFAULT_CAR = {
  chassis: DEFAULT_CHASSIS,
  primary: 'signal',
  secondary: 'ink',
  livery: 'none',
  wheelStyle: 'fivespoke',
  wheelColor: 'ink',
  spoiler: 'none',
  roofItem: 'none',
  headlight: 'warm',
  number: 7,
};

const pick = (list, id, fallback) =>
  list.find((o) => o.id === id) ?? list.find((o) => o.id === fallback) ?? list[0];

// A saved config comes back from localStorage, which is to say from a previous
// version of this game, a different browser, or someone editing it by hand.
// Anything unrecognised falls back to the default rather than reaching
// CarBuilder as undefined and building a car out of NaNs.
export function normalizeCar(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const d = DEFAULT_CAR;
  const num = Math.round(Number(r.number));
  return {
    chassis: (CHASSIS.find((c) => c.id === r.chassis) ?? CHASSIS[0]).id,
    primary: pick(PAINTS, r.primary, d.primary).id,
    secondary: pick(PAINTS, r.secondary, d.secondary).id,
    livery: pick(LIVERIES, r.livery, d.livery).id,
    wheelStyle: pick(WHEEL_STYLES, r.wheelStyle, d.wheelStyle).id,
    wheelColor: pick(PAINTS, r.wheelColor, d.wheelColor).id,
    spoiler: pick(SPOILERS, r.spoiler, d.spoiler).id,
    roofItem: pick(ROOF_ITEMS, r.roofItem, d.roofItem).id,
    headlight: pick(HEADLIGHT_COLORS, r.headlight, d.headlight).id,
    number: Number.isFinite(num) ? Math.min(NUMBER_MAX, Math.max(NUMBER_MIN, num)) : d.number,
  };
}

// The garage stores ids, because ids survive a palette edit and raw hex values
// do not. CarBuilder wants colours. This is the one place that converts.
export function carAppearance(car) {
  const c = normalizeCar(car);
  return {
    primary: pick(PAINTS, c.primary).hex,
    secondary: pick(PAINTS, c.secondary).hex,
    wheel: pick(PAINTS, c.wheelColor).hex,
    // The hub is derived, not chosen: a rim in the same colour as the tyre
    // disappears, and that is one picker's worth of ways to build an ugly car
    // that nobody wants.
    hub: isDark(pick(PAINTS, c.wheelColor).hex) ? 0xd8d8d2 : 0x2a2a30,
    headlight: pick(HEADLIGHT_COLORS, c.headlight).hex,
    livery: c.livery,
    wheelStyle: c.wheelStyle,
    spoiler: c.spoiler,
    roofItem: c.roofItem,
    number: c.number,
  };
}

// Rec. 709 luma. Used to decide what reads against a colour rather than to
// look correct in any colour space sense.
export function isDark(hex) {
  const r = (hex >> 16) & 255, g = (hex >> 8) & 255, b = hex & 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) < 140;
}

export function contrastTo(hex) {
  return isDark(hex) ? 0xedede7 : 0x0e1a2b;
}

// --- one car per chassis -----------------------------------------------------
// Every chassis keeps its own car: paint, parts and number. Stored as
//   { chassis: the one being driven, cars: { [chassisId]: car } }
// with every chassis filled in, so nothing downstream ever meets a gap.

const PAINT_KEYS = ['primary', 'secondary', 'wheelColor'];

// Just the three paints of a car or a preset.
export function paintOf(src) {
  return { primary: src.primary, secondary: src.secondary, wheelColor: src.wheelColor };
}

// A chassis nobody has painted yet wears its own scheme from CHASSIS_PRESET.
export function defaultCarFor(chassisId) {
  const preset = COLOUR_PRESETS.find((p) => p.id === CHASSIS_PRESET[chassisId]);
  return normalizeCar({ ...DEFAULT_CAR, ...(preset ? paintOf(preset) : {}), chassis: chassisId });
}

// `legacy` is the single car older versions saved for whichever chassis was in
// use. It becomes that chassis's car, and the rest start from their defaults.
export function normalizeGarage(raw, legacy = null) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const saved = r.cars && typeof r.cars === 'object' ? r.cars : {};
  const old = legacy && typeof legacy === 'object' ? normalizeCar(legacy) : null;
  const cars = {};
  for (const c of CHASSIS) {
    const s = saved[c.id];
    cars[c.id] = s && typeof s === 'object' ? normalizeCar({ ...s, chassis: c.id })
      : old && old.chassis === c.id ? old
      : defaultCarFor(c.id);
  }
  const chassis = CHASSIS.some((c) => c.id === r.chassis) ? r.chassis
    : old ? old.chassis : DEFAULT_CHASSIS;
  return { chassis, cars };
}

// The player's own colour presets, as they come back from storage: named,
// three real paints each, ids unique, and no more than USER_PRESET_MAX.
export function normalizePresets(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  const ids = new Set(COLOUR_PRESETS.map((p) => p.id));
  for (const p of raw) {
    if (out.length >= USER_PRESET_MAX) break;
    if (!p || typeof p !== 'object') continue;
    const name = String(p.name ?? '').trim().slice(0, PRESET_NAME_MAX);
    if (!name) continue;
    let id = typeof p.id === 'string' && p.id ? p.id : `u${out.length}`;
    while (ids.has(id)) id += '_';
    ids.add(id);
    out.push({
      id,
      name,
      primary: pick(PAINTS, p.primary, 'signal').id,
      secondary: pick(PAINTS, p.secondary, 'ink').id,
      wheelColor: pick(PAINTS, p.wheelColor, 'ink').id,
    });
  }
  return out;
}

// The preset a car's paint is, the built-in ones first, or null if it is a
// scheme of its own.
export function presetFor(car, userPresets = []) {
  const same = (p) => PAINT_KEYS.every((k) => p[k] === car[k]);
  return COLOUR_PRESETS.find(same) ?? userPresets.find(same) ?? null;
}
