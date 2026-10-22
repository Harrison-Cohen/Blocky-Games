// The International Standard Atmosphere, to 32 km, as one small function.
//
// Everything that depends on altitude -- lift, drag, thrust, the speed of
// sound, what the airspeed indicator reads -- is worked out from this, so a
// Mach number and an airspeed come out right and are the same everywhere.
//
// Headless: plain numbers, no allocation. `atmosphere` writes into an object
// the caller owns.

export const ISA = {
  g0: 9.80665,        // m/s2
  R: 287.05287,       // J/(kg K), specific gas constant of dry air
  gamma: 1.4,
  T0: 288.15,         // K at sea level
  p0: 101325,         // Pa at sea level
  rho0: 1.225,        // kg/m3 at sea level
  a0: 340.294,        // m/s at sea level
};

const LAPSE = 0.0065;       // K/m below 11 km
const H_TROP = 11000;
const H_STRAT = 20000;
const H_TOP = 32000;
const T_STRAT = 216.65;
const P_TROP = 22632.06;    // Pa at 11 km
const P_STRAT = 5474.89;    // Pa at 20 km

export function createAtmosphere() {
  return { T: ISA.T0, p: ISA.p0, rho: ISA.rho0, a: ISA.a0, sigma: 1 };
}

// Temperature, pressure, density and speed of sound at geometric altitude h
// (metres, clamped to 0..32 km), written into out.
export function atmosphere(h, out) {
  const alt = h < 0 ? 0 : h > H_TOP ? H_TOP : h;
  let T, p;
  if (alt <= H_TROP) {
    T = ISA.T0 - LAPSE * alt;
    p = ISA.p0 * Math.pow(T / ISA.T0, ISA.g0 / (LAPSE * ISA.R));
  } else if (alt <= H_STRAT) {
    T = T_STRAT;
    p = P_TROP * Math.exp(-ISA.g0 * (alt - H_TROP) / (ISA.R * T_STRAT));
  } else {
    T = T_STRAT + 0.001 * (alt - H_STRAT);
    p = P_STRAT * Math.pow(T / T_STRAT, -ISA.g0 / (0.001 * ISA.R));
  }
  out.T = T;
  out.p = p;
  out.rho = p / (ISA.R * T);
  out.a = Math.sqrt(ISA.gamma * ISA.R * T);
  out.sigma = out.rho / ISA.rho0;
  return out;
}

// Equivalent airspeed: what the same dynamic pressure would be at sea level.
export function equivalentAirspeed(tas, rho) {
  return tas * Math.sqrt(rho / ISA.rho0);
}

// Calibrated airspeed -- what the airspeed indicator reads, from the pitot
// pressure with compressibility, referred to sea level. Stall, rotation and
// approach speeds are all given in this, so the HUD shows it.
export function calibratedAirspeed(tas, p, a) {
  const m = tas / a;
  // Impact pressure behind the shock for supersonic flight (Rayleigh pitot),
  // isentropic below it.
  let qc;
  if (m < 1) {
    qc = p * (Math.pow(1 + 0.2 * m * m, 3.5) - 1);
  } else {
    qc = p * (166.9216 * m * m * m * m * m * m * m / Math.pow(7 * m * m - 1, 2.5) - 1);
  }
  const r = qc / ISA.p0 + 1;
  const cas = ISA.a0 * Math.sqrt(5 * (Math.pow(r, 2 / 7) - 1));
  return cas;
}
