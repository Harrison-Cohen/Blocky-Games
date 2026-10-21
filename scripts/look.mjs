// Looks at the game the way a player does: starts the dev server's page in a
// real Chrome (scripts/lib/browser.mjs), goes through the title and the Fly
// menu into a flight, takes screenshots of each, and fails if the page logged
// an error or threw. It is how flight was first SEEN rather than assumed.
//
//   npm run dev                          (in another terminal)
//   node scripts/look.mjs [out-dir] [url]
//
// Writes title.png, fly-menu.png, apron.png, runway.png, air-chase.png,
// air-cockpit.png, air-orbit.png, close-up.png, map.png, hangar.png, pause.png, then the
// Boeing 737 chosen in the Hangar (hangar-737-*.png, apron-737.png, runway-737.png,
// approach-737.png, spoilers-737.png, cockpit-737.png, map-737.png) and back-on-title.png
// into out-dir (default /tmp/look). The page's physics barely runs in a software-rendered
// browser, so the 737 is flown by stepping the aircraft here (flight.step).

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
  await b.eval('flight.start("apron")');
  await b.sleep(1200);
  await shot('apron');
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
  await b.eval('flight.openMap("pause")');
  // The map is drawn a few milliseconds a frame; wait until it is whole.
  for (let i = 0; i < 180 && !(await b.eval('flight.screens.map._built')); i++) await b.sleep(500);
  await b.sleep(500);
  await shot('map');
  await b.eval('flight.screens.hideAll()');
  await b.eval('flight.openHangar("pause")');
  await b.sleep(1500);
  await shot('hangar');
  await b.eval('flight.hangar.close(false); flight.screens.hideAll();');
  await b.eval('flight.camera.mode = 0; flight.openPause()');
  await b.sleep(600);
  await shot('pause');
  await b.eval('flight.resume()');

  // The Boeing 737, through the Hangar as a player gets it.
  const steps = (n) => b.eval(`for (let i = 0; i < ${n}; i++) flight.step(1 / 120)`);
  await b.eval('flight.openHangar("fly")');
  await b.sleep(700);
  await b.eval('flight.hangar._setKey("aircraft", "b737")');
  await b.sleep(1200);
  for (const [k, a] of [['a', -0.6], ['b', 1.0], ['c', 2.6], ['d', 4.2]]) {
    await b.eval(`flight.hangar.turntable.turn.rotation.y = ${a}`);
    await b.sleep(350);
    await shot(`hangar-737-${k}`);
  }
  await b.eval('flight.hangar.close(true)');
  await b.sleep(900);
  await b.eval('flight.start("apron")');
  await b.sleep(1300);
  await shot('apron-737');
  await b.eval('flight.start("runway")');
  await b.sleep(900);
  await shot('runway-737');
  await b.eval('flight.start("air")');
  await b.eval('flight.gearLever = true; flight.flapLever = 3; flight.input.state.airbrake = false');
  await steps(900);
  await b.sleep(900);
  await shot('approach-737');
  await b.eval('flight.camera.cfg = { ...flight.camera.cfg, distance: 42, height: 8, speedPullback: 0 }; flight.camera.reset();');
  // (Set and flown in one call: the input is polled between calls and would let them go.)
  await b.eval('flight.input.state.airbrake = true; for (let i = 0; i < 400; i++) { flight.input.state.airbrake = true; flight.step(1 / 120); }');
  await b.sleep(150);
  await shot('spoilers-737');
  await b.eval('flight.input.state.airbrake = false; flight.camera.cfg = { ...flight.camera.cfg, distance: 78, height: 19, speedPullback: 30 }; flight.camera.mode = 1; flight._savedCamMode = 1; flight.camera.reset();');
  await b.sleep(900);
  await shot('cockpit-737');
  await b.eval('flight.camera.mode = 0; flight._savedCamMode = 0; flight.camera.reset(); flight.autopilot.engage(flight.physics)');
  await steps(240);
  await b.sleep(900);
  await shot('autopilot-737');
  await b.eval('flight.openMap("pause")');
  for (let i = 0; i < 180 && !(await b.eval('flight.screens.map._built')); i++) await b.sleep(500);
  await b.sleep(500);
  await shot('map-737');
  await b.eval('flight.screens.hideAll()');
  // Back to the F-22 the same way, so the title and the car game find nothing changed.
  await b.eval('flight.openHangar("pause")');
  await b.sleep(500);
  await b.eval('flight.hangar._setKey("aircraft", "f22")');
  await b.sleep(500);
  await b.eval('flight.hangar.close(true)');
  await b.sleep(500);
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
