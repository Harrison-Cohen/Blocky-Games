// The only place that touches localStorage.
//
// Everything is wrapped, because localStorage throws rather than returning null
// in private browsing on some browsers and when a page is opened from file://.
// A saved best lap is nice to have; losing one must never take the game down
// mid-session, so every failure here is swallowed and reported as "no data".
//
// Keys are namespaced and versioned. If the shape of a record ever changes,
// bump VERSION rather than writing migration code for a lap time.

const PREFIX = 'racing-game';
const VERSION = 1;

function key(name) {
  return `${PREFIX}.v${VERSION}.${name}`;
}

export function load(name, fallback = null) {
  try {
    const raw = window.localStorage.getItem(key(name));
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function save(name, value) {
  try {
    window.localStorage.setItem(key(name), JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function remove(name) {
  try {
    window.localStorage.removeItem(key(name));
  } catch {
    /* nothing to do */
  }
}

// Best laps are per track AND per chassis: a time set in the Wedge One says
// nothing about what is quick in the Haul 4x4, and merging them would make the
// slower cars permanently unbeatable.
export function recordName(trackId, chassisId) {
  return `best.${trackId}.${chassisId}`;
}

// The best lap's ghost, kept beside its record and under the same two keys: it
// is the ghost OF that record, so they can never belong to different cars.
export function ghostName(trackId, chassisId) {
  return `ghost.${trackId}.${chassisId}`;
}
