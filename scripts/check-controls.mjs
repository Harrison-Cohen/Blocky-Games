// The controls chart against the input code, headless.
//
//   - every key in the chart (data/controls.js) is a key the input layer for that
//     set really listens for, so a key cannot be printed that does nothing
//   - every row has an action, at least one key, and a gamepad button or null
//   - no key is printed twice in one row
//   - keys the input code listens for that the chart does not show are listed
//     (information, not a failure: weapons are not built yet)
//
//   npm run controls

import { readFileSync } from 'node:fs';

const SRC = new URL('../src/', import.meta.url);
const { CONTROLS } = await import(new URL('data/controls.js', SRC));

let failed = false;
const check = (ok, msg) => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${msg}`);
  if (!ok) failed = true;
};

const CODE = /'(Key[A-Z]|Arrow(?:Up|Down|Left|Right)|Space|Escape|Tab|Enter|Backquote|Slash|Period|Comma|ShiftLeft|ShiftRight)'/g;

for (const [name, set] of Object.entries(CONTROLS)) {
  const text = readFileSync(new URL(set.source, SRC), 'utf8');
  const listened = new Set([...text.matchAll(CODE)].map((m) => m[1]));
  const shown = new Set();
  let rowsOk = true;
  let unbound = [];
  for (const row of set.rows) {
    const codes = row.keys.map((k) => k[1]).filter(Boolean);
    if (!row.action || row.keys.length === 0 || (row.pad !== null && typeof row.pad !== 'string')) rowsOk = false;
    if (new Set(codes).size !== codes.length) rowsOk = false;
    for (const c of codes) { shown.add(c); if (!listened.has(c)) unbound.push(`${row.action}: ${c}`); }
  }
  for (const [, code] of set.extra || []) { shown.add(code); if (!listened.has(code)) unbound.push(`extra: ${code}`); }
  check(rowsOk, `${name}: every row has an action, keys and a pad button or none`);
  check(unbound.length === 0, `${name}: every key in the chart is bound in ${set.source}${unbound.length ? ' (not found: ' + unbound.join(', ') + ')' : ''}`);
  const missing = [...listened].filter((c) => !shown.has(c));
  console.log(`  info  ${name}: keys the code listens for that the chart does not show: ${missing.join(' ') || 'none'}`);
}

console.log(failed ? '\nCONTROLS CHECK FAILED' : '\nPASS: the controls chart matches the input code.');
process.exit(failed ? 1 : 0);
