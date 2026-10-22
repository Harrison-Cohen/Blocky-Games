// ============================================================================
// THE HANGAR'S OPTIONS
// ----------------------------------------------------------------------------
// What the Hangar offers for each aircraft, and the rules that turn whatever was
// stored into something safe to use. Three things are kept apart, each under its
// own storage key (core/HangarStore.js), so one can never overwrite another:
//
//   livery   paint, pattern, tail number and insignia. Cosmetic: nothing in this
//            part ever reaches the physics.
//   loadout  what is hung on it and how much is in it. Changes the aircraft's
//            MASS and nothing else (the weapons arrive in milestone 7).
//   tune     three scales on how it flies. 1 is the aircraft as fitted; every
//            figure `npm run flight` holds the aircraft to is at 1.
//
// and the fourth, damage, is the health of each part (milestone 5 wears it down;
// until then it reads full).
//
// The ranges of the tune knobs are in tuning.js, HANGAR.tune. Masses here are the
// real weapons' where they are published, and say so where they are not.
// ============================================================================

import { PAINTS } from './palette.js';
import { HANGAR } from './tuning.js';
import { getAircraft } from './aircraft.js';

// The paints: the aircraft's own two greys, then the generic twelve. 'stock' as a
// body colour is exactly the grey the F-22 has always been.
export const LIVERY_PAINTS = [
  { id: 'stock', name: 'Standard grey', hex: 0x6e7782 },
  { id: 'charcoal', name: 'Charcoal', hex: 0x2c3238 },
  ...PAINTS.slice(0, 12),
];

// Split paints the whole left side (+x) in the accent colour; tips, bands and spine
// lay accent decals on the wing and tail tips, across the wings, and along the top.
export const LIVERY_PATTERNS = [
  { id: 'plain', name: 'Plain' },
  { id: 'split', name: 'Split' },
  { id: 'tips', name: 'Tips' },
  { id: 'bands', name: 'Bands' },
  { id: 'spine', name: 'Spine' },
];

// Invented marks, so no real air force's is worn.
export const LIVERY_INSIGNIA = [
  { id: 'none', name: 'None' },
  { id: 'roundel', name: 'Roundel' },
  { id: 'diamond', name: 'Diamond' },
  { id: 'chevron', name: 'Chevron' },
  { id: 'bars', name: 'Bars' },
];

export const TAIL_NUMBER_MAX = 9999;
export const TAIL_NUMBER_DIGITS = 4;

export const DEFAULT_LIVERY = { body: 'stock', accent: 'charcoal', pattern: 'plain', number: null, insignia: 'none' };

// What the livery offers on each aircraft. The paints are the same twelve; the patterns and
// the insignia are drawn on that aircraft's own panels, so each has its own list, and `stock`
// (the body colour that is the aircraft's own) is named for what it is. The airliner's are
// fictional: no real airline's colours or marks.
export const LIVERY_OPTIONS = {
  f22: { patterns: LIVERY_PATTERNS, insignia: LIVERY_INSIGNIA, stockName: 'Standard grey', default: DEFAULT_LIVERY },
  b737: {
    patterns: [
      { id: 'plain', name: 'Plain white' },
      { id: 'cheatline', name: 'Cheat line' },
      { id: 'tail', name: 'Tail colour' },
      { id: 'belly', name: 'Belly band' },
      { id: 'engines', name: 'Engine rings' },
      { id: 'full', name: 'Cheat line, tail and engines' },
    ],
    insignia: [
      { id: 'none', name: 'None' },
      { id: 'ring', name: 'Ring' },
      { id: 'wave', name: 'Wave' },
      { id: 'star', name: 'Star' },
      { id: 'bars', name: 'Bars' },
    ],
    stockName: 'Airline white',
    default: { body: 'stock', accent: 'sky', pattern: 'full', number: null, insignia: 'ring' },
  },
};
export const liveryOptions = (aircraftId) => LIVERY_OPTIONS[aircraftId] || LIVERY_OPTIONS.f22;
export const defaultLivery = (aircraftId) => ({ ...liveryOptions(aircraftId).default });

const has = (list, id) => list.some((o) => o.id === id);
const num = (v, fallback) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Whatever was stored, a livery that is safe to paint with. Each aircraft has its own
// patterns and insignia and its own default; the F-22's, as it has always been, is the
// default when no aircraft is named.
export function normalizeLivery(raw, aircraftId = 'f22') {
  const r = raw && typeof raw === 'object' ? raw : {};
  const o = liveryOptions(aircraftId), dflt = o.default;
  const n = r.number == null ? null : Math.round(num(r.number, NaN));
  return {
    body: has(LIVERY_PAINTS, r.body) ? r.body : dflt.body,
    accent: has(LIVERY_PAINTS, r.accent) ? r.accent : dflt.accent,
    pattern: has(o.patterns, r.pattern) ? r.pattern : dflt.pattern,
    number: n == null || !Number.isFinite(n) ? null : clamp(n, 0, TAIL_NUMBER_MAX),
    insignia: has(o.insignia, r.insignia) ? r.insignia : dflt.insignia,
  };
}

export const paintHex = (id) => (LIVERY_PAINTS.find((p) => p.id === id) || LIVERY_PAINTS[0]).hex;

// --- per aircraft ---------------------------------------------------------------
// `mass` is kg for one. The default loadout is the payload the aircraft's data
// already has (aircraft.js, payload), so a loadout at its default changes no figure
// the aircraft was fitted to: the mass is the data's payload plus what differs from
// the default.
export const HANGAR_OPTIONS = {
  f22: {
    loadout: [
      { id: 'medium', name: 'Medium range missiles', max: 6, step: 1, default: 6, mass: 152, source: 'AIM-120C, about 152 kg (Raytheon)' },
      { id: 'short', name: 'Short range missiles', max: 2, step: 1, default: 2, mass: 86, source: 'AIM-9X, about 85 kg (Raytheon)' },
      { id: 'rounds', name: 'Cannon rounds', max: 480, step: 20, default: 480, mass: 0.25, source: 'M61A2 20 mm; 480 rounds carried (USAF fact sheet); round mass estimated' },
      { id: 'flares', name: 'Flares', max: 60, step: 5, default: 60, mass: 0.2, source: 'estimate' },
    ],
    // The tune knobs, in the order the Hangar lists them. Ranges: tuning.js, HANGAR.tune.
    tune: [
      { id: 'power', name: 'Engine power', note: 'Thrust and fuel flow' },
      { id: 'response', name: 'Control response', note: 'Stick authority and rate damping' },
      { id: 'assist', name: 'Flight assist', note: 'How well it holds its path hands off: auto trim (and the roll self levelling, which is off as shipped). The load limits stay on' },
    ],
    // The parts that wear (milestone 5). Health is 0 to 1.
    damage: getAircraft('f22').damage,
  },
  // The 737: passengers and hold cargo are its payload. The default load (120 passengers and
  // 2,500 kg) is the data's payload (aircraft.js), so every figure it was fitted to is at the
  // default; fewer is lighter and shorter on the runway, more is heavier (the card says when it
  // is over the maximum takeoff mass).
  b737: {
    loadout: [
      { id: 'passengers', name: 'Passengers', max: 162, step: 2, default: 120, mass: 95, source: 'planning mass of a passenger with hand baggage, about 95 kg; 162 seats (spec; Boeing quotes 160 in two classes)' },
      { id: 'cargo', name: 'Hold cargo, kg', max: 8000, step: 250, default: 2500, mass: 1, source: 'baggage and freight; the hold is 45 cubic metres (Boeing)' },
    ],
    tune: [
      { id: 'power', name: 'Engine power', note: 'Thrust and fuel flow' },
      { id: 'response', name: 'Control response', note: 'Stick authority and rate damping' },
      { id: 'assist', name: 'Flight assist', note: 'How well it holds its path hands off: the auto trim. The load limits stay on' },
    ],
    damage: getAircraft('b737').damage,
  },
};

export const hangarOptions = (aircraftId) => HANGAR_OPTIONS[aircraftId] || HANGAR_OPTIONS.f22;

// The parts of an airliner. Same knobs as the fighter; the notes say what each does to it.

export function defaultLoadout(aircraftId) {
  const o = {};
  for (const it of hangarOptions(aircraftId).loadout) o[it.id] = it.default;
  return o;
}

export function normalizeLoadout(aircraftId, raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const o = {};
  for (const it of hangarOptions(aircraftId).loadout) {
    const v = Math.round(num(r[it.id], it.default) / it.step) * it.step;
    o[it.id] = clamp(v, 0, it.max);
  }
  return o;
}

export function defaultTune(aircraftId) {
  const o = {};
  for (const k of hangarOptions(aircraftId).tune) o[k.id] = 1;
  return o;
}

export function normalizeTune(aircraftId, raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const o = {};
  for (const k of hangarOptions(aircraftId).tune) {
    const cfg = HANGAR.tune[k.id];
    const v = Math.round(num(r[k.id], 1) / cfg.step) * cfg.step;
    o[k.id] = Math.round(clamp(v, cfg.min, cfg.max) * 1000) / 1000;
  }
  return o;
}

export const isStockTune = (aircraftId, tune) => {
  const t = normalizeTune(aircraftId, tune);
  return hangarOptions(aircraftId).tune.every((k) => t[k.id] === 1);
};

export function defaultDamage(aircraftId) {
  const o = {};
  for (const p of hangarOptions(aircraftId).damage) o[p.id] = 1;
  return o;
}

export function normalizeDamage(aircraftId, raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const o = {};
  for (const p of hangarOptions(aircraftId).damage) {
    // An explicit child takes precedence, even if corrupt (then only that child defaults).
    const value = Object.hasOwn(r, p.id) ? r[p.id] : p.legacy ? r[p.legacy] : undefined;
    o[p.id] = clamp(num(value, 1), 0, 1);
  }
  for (const p of hangarOptions(aircraftId).damage) if (o[p.id] === 0 && p.breaks) {
    for (const child of p.breaks) o[child] = 0;
  }
  return o;
}

// Everything the Hangar stores for an aircraft, normalised.
export function normalizeSetup(aircraftId, raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  return {
    livery: normalizeLivery(r.livery, aircraftId),
    loadout: normalizeLoadout(aircraftId, r.loadout),
    tune: normalizeTune(aircraftId, r.tune),
    damage: normalizeDamage(aircraftId, r.damage),
  };
}

// The mass of what is carried: the data's payload, moved by what differs from the
// default loadout. Exactly `def.payload` at the default.
export function payloadMass(def, loadout) {
  const l = normalizeLoadout(def.id, loadout);
  let m = def.payload;
  for (const it of hangarOptions(def.id).loadout) m += (l[it.id] - it.default) * it.mass;
  return m;
}
