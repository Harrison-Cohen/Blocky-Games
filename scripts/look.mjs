// Looks at the game the way a player does: starts the dev server's page in a
// real Chrome (scripts/lib/browser.mjs), goes through the title and the Fly
// menu into a flight, takes screenshots of each, and fails if the page logged
// an error or threw. It is how flight was first SEEN rather than assumed.
//
//   npm run dev                          (in another terminal)
//   node scripts/look.mjs [out-dir] [url]
//
// Writes title.png, fly-menu.png, runway.png, air-chase.png, air-cockpit.png,
// air-orbit.png, close-up.png, pause.png, back-on-title.png into out-dir
// (default /tmp/look).

import { mkdirSync } from 'node:fs';
import { launch } from './lib/browser.mjs';

const out = process.argv[2] || '/tmp/look';
const url = process.argv[3] || 'http://localhost:5173';
mkdirSync(out, { recursive: true });

const b = await launch({ url, width: 1440, height: 900 });
const shot = (name) => b.shot(`${out}/${name}.png`);
let failed = false;

try {
  await shot('title');
  await b.eval('game.onFly()');
  await b.sleep(1800);
  await shot('fly-menu');
  await b.eval('flight.start("runway")');
  await b.sleep(900);
  await shot('runway');
  await b.eval('flight.start("air")');
  await b.sleep(2200);
  await shot('air-chase');
  await b.eval('flight.camera.mode = 1; flight._savedCamMode = 1;');
  await b.sleep(700);
  await shot('air-cockpit');
  await b.eval('flight.camera.mode = 2; flight._savedCamMode = 2;');
  await b.sleep(700);
  await shot('air-orbit');
  await b.eval('flight.camera.mode = 0; flight._savedCamMode = 0; flight.camera.cfg = { ...flight.camera.cfg, distance: 21, height: 4.2, speedPullback: 0 };');
  await b.sleep(900);
  await shot('close-up');
  await b.eval('flight.camera.mode = 0; flight.openPause()');
  await b.sleep(600);
  await shot('pause');
  await b.eval('flight.resume()');
  // Out again, to the title, and the car game still there.
  await b.eval('flight.exit()');
  await b.sleep(900);
  await shot('back-on-title');
} catch (e) {
  console.error('look failed:', e.message);
  failed = true;
}

const bad = b.console.filter((l) => /^(error|warning|EXCEPTION)/i.test(l) && !/vite/i.test(l));
if (bad.length) { console.error('The page logged:\n  ' + bad.join('\n  ')); failed = true; }
console.log(failed ? 'LOOK FAILED' : `looked: screenshots in ${out}, the console is clean`);
await b.close();
process.exit(failed ? 1 : 0);
