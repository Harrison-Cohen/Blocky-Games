// Units for the flight readouts. The physics is SI throughout; these only
// convert for display. The cars show mph; aircraft default to knots, feet and
// Mach, with mph and metric as a setting.

export const KT = 0.514444;       // m/s per knot
export const FT = 0.3048;         // m per foot
export const MPH = 0.44704;       // m/s per mile an hour
export const KMH = 1 / 3.6;       // m/s per km/h
export const FPM = 0.3048 / 60;   // m/s per foot a minute

export const UNIT_SYSTEMS = ['aviation', 'mph', 'metric'];

export const toKnots = (v) => v / KT;
export const toFeet = (m) => m / FT;
export const toMph = (v) => v / MPH;
export const toKmh = (v) => v / KMH;
export const toFpm = (v) => v / FPM;

export function normalizeUnits(u) {
  return UNIT_SYSTEMS.includes(u) ? u : 'aviation';
}

// { value, unit } for a speed in m/s.
export function speedIn(v, system) {
  if (system === 'mph') return { value: toMph(v), unit: 'mph' };
  if (system === 'metric') return { value: toKmh(v), unit: 'km/h' };
  return { value: toKnots(v), unit: 'kt' };
}

export function altitudeIn(m, system) {
  if (system === 'aviation' || system === 'mph') return { value: toFeet(m), unit: 'ft' };
  return { value: m, unit: 'm' };
}

export function climbIn(v, system) {
  if (system === 'aviation' || system === 'mph') return { value: toFpm(v), unit: 'fpm' };
  return { value: v, unit: 'm/s' };
}
