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

const has = (list, id) => list.some((o) => o.id === id);
const num = (v, fallback) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function normalizeLivery(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const n = r.number == null ? null : Math.round(num(r.number, NaN));
  return {
    body: has(LIVERY_PAINTS, r.body) ? r.body : DEFAULT_LIVERY.body,
    accent: has(LIVERY_PAINTS, r.accent) ? r.accent : DEFAULT_LIVERY.accent,
    pattern: has(LIVERY_PATTERNS, r.pattern) ? r.pattern : DEFAULT_LIVERY.pattern,
    number: n == null || !Number.isFinite(n) ? null : clamp(n, 0, TAIL_NUMBER_MAX),
    insignia: has(LIVERY_INSIGNIA, r.insignia) ? r.insignia : DEFAULT_LIVERY.insignia,
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
    damage: [
      { id: 'wings', name: 'Wings and flaperons' },
      { id: 'tail', name: 'Tail and fins' },
      { id: 'engines', name: 'Engines' },
      { id: 'gear', name: 'Landing gear' },
      { id: 'fuselage', name: 'Fuselage' },
    ],
  },
};

export const hangarOptions = (aircraftId) => HANGAR_OPTIONS[aircraftId] || HANGAR_OPTIONS.f22;

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
  for (const p of hangarOptions(aircraftId).damage) o[p.id] = clamp(num(r[p.id], 1), 0, 1);
  return o;
}

// Everything the Hangar stores for an aircraft, normalised.
export function normalizeSetup(aircraftId, raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  return {
    livery: normalizeLivery(r.livery),
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
