// What the Hangar keeps between sessions, per aircraft, in four records under four
// keys: the cosmetics (livery), the loadout, the tuning and the damage. They are
// stored apart on purpose: painting an aircraft can never move its tuning, and a
// repair can never touch its paint. Everything read back is normalised
// (data/loadouts.js), so a record from an older build, a hand-edited one or a
// corrupt one becomes the defaults rather than a crash.

import * as Storage from './Storage.js';
import {
  normalizeLivery, normalizeLoadout, normalizeTune, normalizeDamage,
} from '../data/loadouts.js';

export const PARTS = ['livery', 'loadout', 'tune', 'damage'];
export const storageKey = (part, aircraftId) => `flight.${part}.${aircraftId}`;

const NORMALIZE = {
  livery: (id, raw) => normalizeLivery(raw, id),
  loadout: normalizeLoadout,
  tune: normalizeTune,
  damage: normalizeDamage,
};

export function loadSetup(aircraftId) {
  const out = {};
  for (const part of PARTS) out[part] = NORMALIZE[part](aircraftId, Storage.load(storageKey(part, aircraftId), null));
  return out;
}

// Write the parts named (all four by default), each to its own key.
export function saveSetup(aircraftId, setup, parts = PARTS) {
  let saved = true;
  for (const part of parts) if (!Storage.save(storageKey(part, aircraftId), NORMALIZE[part](aircraftId, setup[part]))) saved = false;
  return saved;
}
