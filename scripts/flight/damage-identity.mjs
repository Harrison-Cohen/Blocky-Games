// Optional same-runtime comparison against an untouched checkout or git archive.
// Does not update, replace or bypass the recorded identity.mjs goldens.
// node scripts/flight/damage-identity.mjs /absolute/path/to/pristine-checkout
// --legacy-response additionally restores only the three B-feedback power-response knobs
// for this diagnostic. Normal gameplay intentionally differs at the user's request.
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { measure } from './identity.mjs';
import { FLIGHT } from '../../src/data/tuning.js';
if (!process.argv[2]) throw new Error('Provide a pristine checkout path for the before/after comparison');
const baseline = await import(pathToFileURL(resolve(process.argv[2], 'scripts/flight/identity.mjs')));
const before = await baseline.measure();
const legacy = process.argv.includes('--legacy-response');
const saved = [FLIGHT.throttleRate,FLIGHT.engineSpoolUpScale,FLIGHT.engineAbUpScale];
let after;
try {
  if (legacy) {
    console.log('Diagnostic with legacy response only; normal gameplay acceleration is intentionally changed.');
    FLIGHT.throttleRate=.35;FLIGHT.engineSpoolUpScale=1;FLIGHT.engineAbUpScale=1;
  }
  after = await measure();
} finally {
  [FLIGHT.throttleRate,FLIGHT.engineSpoolUpScale,FLIGHT.engineAbUpScale]=saved;
}
let failed = false;
for (const [name, hash] of Object.entries(before)) {
  const same = hash === after[name];
  console.log(`${same ? 'ok' : 'FAIL'} ${name}: before ${hash}, after ${after[name]}`);
  failed ||= !same;
}
process.exitCode = failed ? 1 : 0;
