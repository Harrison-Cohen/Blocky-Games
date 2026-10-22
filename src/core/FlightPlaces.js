// Where in the world the player is, and where they are put: the airport last used,
// the starts at an airport, and the hangar bays.
//
// Headless-ish (no Three.js, no DOM): it holds the state FlightGame acts on.
//
//   last        the airport free flight starts at: the one you started at, sent
//               yourself to, or sat stopped on for a few seconds after a landing.
//               Remembered (Storage `flight.lastAirport`).
//   teleportMode  which start the map's "Teleport" uses (apron, runway, airborne or Hangar).
//   the bay     stop near a Hangar: availableHangar returns the bay for explicit entry.
//               No dwell timer or latch; closing never requires leaving the zone.

import { HANGAR } from '../data/tuning.js';
import * as Storage from './Storage.js';

const MODES = ['apron', 'runway', 'air', 'hangar'];
const TIER_ORDER = { major: 0, military: 1, regional: 2, strip: 3, heliport: 4 };

export class FlightPlaces {
  constructor(world, def) {
    this.world = world;
    this.def = def;
    this.airports = world.airports;
    // The airports, in the order a list shows them: the big ones first, then by name.
    this.list = [...this.airports.list].sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier] || a.name.localeCompare(b.name));
    this.last = this.airports.byId.get(Storage.load('flight.lastAirport', '')) || this.airports.major;
    const m = Storage.load('flight.teleportMode', 'apron');
    this.teleportMode = MODES.includes(m) ? m : 'apron';
    this._pose = {};

    // The bay.
    this.zone = null;         // the bay the aircraft is in now, or null
    this._local = {};        // scratch for the Hangar approach query
    // Landed somewhere: sitting stopped on an airport.
    this._sat = null;
    this._satT = 0;
  }

  setLast(ap) {
    if (!ap || ap === this.last) return;
    this.last = ap;
    Storage.save('flight.lastAirport', ap.id);
  }

  setTeleportMode(m) {
    if (!MODES.includes(m)) return;
    this.teleportMode = m;
    Storage.save('flight.teleportMode', m);
  }

  // Can the aircraft be put in this way at this airport? { ok, why }.
  eligible(ap, mode) {
    const g = this.def.ground || {};
    if (mode === 'air') return { ok: true, why: '' };
    if (ap.isHeliport && !g.vtol) return { ok: false, why: 'Needs a runway' };
    // The shortest runway it is based on: an airliner is not put on an airstrip's apron
    // either, since it could never leave it.
    if (!ap.isHeliport && ap.length < (g.minRunway || 0)) return { ok: false, why: 'Runway too short' };
    return { ok: true, why: '' };
  }

  // The nearest airport that can take the aircraft on the ground (a 737 is not put on an airstrip),
  // to the point (x, z). Null if none can.
  nearestEligible(x, z, mode = 'apron') {
    let best = null, bd = Infinity;
    for (const ap of this.list) {
      if (!this.eligible(ap, mode).ok) continue;
      const d = Math.hypot(ap.px - x, ap.pz - z);
      if (d < bd) { bd = d; best = ap; }
    }
    return best;
  }

  // Canonical, eligible destinations only. A respawn always uses the hangar apron.
  respawnPose(id) {
    const ap = this.airports.byId.get(id);
    if (!ap || !this.eligible(ap, 'hangar').ok) return null;
    return this.pose(ap, 'hangar');
  }

  // The pose for a start at an airport (a reused object; see Airports.start).
  pose(ap, mode, departure = null) { return this.airports.start(ap, mode, this._pose, { def: this.def, ...departure }); }

  // The next (d = 1) or previous airport in the list, from the one last used.
  step(d) {
    const i = this.list.indexOf(this.last);
    return this.list[(i + d + this.list.length) % this.list.length];
  }

  // Forget where the aircraft was: it has just been put somewhere, outside any bay.
  rearm() {
    this.zone = null;
    this._sat = null; this._satT = 0;
  }

  // What the HUD says the aircraft is on: "Pinecrest Regional, runway 28", or ''.
  where(p) {
    const ap = this.airports.at(p.x, p.z);
    if (!ap) return '';
    const kind = this.airports.kindAt(p.x, p.z);
    if (kind === 'runway' && !ap.isHeliport) {
      let d = p.attitude().heading - ap.heading;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      const n = Math.abs(d) < Math.PI / 2 ? ap.layout.designators[0] : ap.layout.designators[1];
      return `${ap.name}, runway ${String(n).padStart(2, '0')}`;
    }
    const what = { taxi: 'taxiway', apron: 'apron', pad: 'overrun', runway: 'pad' }[kind];
    return what ? `${ap.name}, ${what}` : ap.name;
  }

  // Deliberate Hangar entry replaces the old dwell/armed latch. The approach
  // includes the reset/teleport point outside the painted bay. No moving aircraft.
  availableHangar(p) {
    if (!(p.onGround || p.gear?.hullHit > 0) || p.crashed || Math.hypot(p.vx, p.vz) >= HANGAR.stopSpeed || p.throttle > HANGAR.stopLever) return null;
    const ap = this.airports.at(p.x, p.z);
    if (!ap || !this.eligible(ap, 'hangar').ok) return null;
    const loc = ap.toLocal(p.x, p.z, this._local);
    for (const zone of ap.layout.zones) {
      if (loc.u >= zone.u0 && loc.u <= zone.u1 && loc.v >= zone.v0 - HANGAR.entryReach && loc.v <= zone.v1) return zone;
    }
    return null;
  }

  // Keep airport arrival bookkeeping independent of entry UI.
  update(dt, p) {
    const speed = Math.hypot(p.vx, p.vz);
    this.zone = this.availableHangar(p);
    // Sitting stopped on an airport is landing there.
    const ap = p.onGround && speed < 2 ? this.airports.at(p.x, p.z) : null;
    if (ap && ap === this._sat) {
      this._satT += dt;
      if (this._satT > HANGAR.landedAfter) this.setLast(ap);
    } else { this._sat = ap; this._satT = 0; }
    return this.zone;
  }

}
