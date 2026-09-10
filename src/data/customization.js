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

// Two digits. Three would fit on the car but not legibly on a roundel built
// out of seven-segment bars, and an unreadable number is worse than a small
// range of readable ones.
export const NUMBER_MIN = 1;
export const NUMBER_MAX = 99;

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
