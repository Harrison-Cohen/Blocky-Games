// Looks at the game the way a player does: starts the dev server's page in a
// real Chrome (scripts/lib/browser.mjs), goes through the title and the Fly
// menu into a flight, takes screenshots of each, and fails if the page logged
// an error or threw. It is how flight was first SEEN rather than assumed.
//
//   npm run dev                          (in another terminal)
//   node scripts/look.mjs [out-dir] [url]
//
// Writes title.png, fly-menu.png, apron.png, runway.png, air-chase.png,
// air-first-person.png, air-cockpit.png, air-orbit.png, close-up.png, map.png, hangar.png, pause.png, then the
// Boeing 737 chosen in the Hangar (hangar-737-*.png, apron-737.png, runway-737.png,
// approach-737.png, spoilers-737.png, first-person-737.png, cockpit-737.png, map-737.png) and back-on-title.png
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
  await shot('air-first-person');
  await b.eval('flight.camera.mode = 2; flight._savedCamMode = 2;');
  await b.sleep(900);
  await shot('air-cockpit');
  await b.eval('flight.camera.mode = 3; flight._savedCamMode = 3;');
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
  // Approach fixture must slow down before deploying landing flaps.
  await b.eval('const p = flight.physics; const k = 145 * 0.514444 / p.cas; p.vx *= k; p.vy *= k; p.vz *= k; p.snapshot(); flight.gearLever = true; flight.flapLever = 3; flight.airbrakeLever = false; p.throttle = 0.4; 0');
  await steps(900);
  await b.sleep(900);
  await shot('approach-737');
  await b.eval('flight.camera.cfg = { ...flight.camera.cfg, distance: 42, height: 8, speedPullback: 0 }; flight.camera.reset();');
  // The lever persists across frames and physics steps.
  await b.eval('flight.airbrakeLever = true; for (let i = 0; i < 400; i++) flight.step(1 / 120);');
  await b.sleep(150);
  await shot('spoilers-737');
  await b.eval('flight.airbrakeLever = false; flight.camera.cfg = { ...flight.camera.cfg, distance: 78, height: 19, speedPullback: 30 }; flight.camera.mode = 1; flight._savedCamMode = 1; flight.camera.reset();');
  await b.sleep(900);
  await shot('first-person-737');
  await b.eval('flight.camera.mode = 2; flight._savedCamMode = 2; flight.camera.reset();');
  await b.sleep(900);
  await shot('cockpit-737');
  for (const [name, yaw, pitch] of [['left', 0.65, 0], ['right', -0.65, 0], ['panel', 0, -0.4]]) {
    await b.eval(`flight.input._lookMouse = true; flight.input.look.x = ${yaw}; flight.input.look.y = ${pitch}; 0`);
    await b.sleep(300);
    await shot(`cockpit-737-${name}`);
  }
  await b.eval('flight.input._lookMouse=false; flight.input.look.x=flight.input.look.y=0; 0');
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

  // Milestone 5: both aircraft, pooled smoke/fire, detached wing, Repair and respawn map.
  for (const id of ['f22', 'b737']) {
    await b.eval(`flight.switchAircraft('${id}'); flight.start('air'); flight.debugDamage('engineL', 0.5); for(let i=0;i<240;i++){flight.step(1/120);flight.damageEffects.update(1/120,flight.aircraft,flight.mesh.origin,'medium');} 0`);
    await b.sleep(200);
    await shot(`damage-${id}-smoke`);
    await b.eval('flight.debugDamage("engineL",0.2); for(let i=0;i<180;i++){flight.step(1/120);flight.damageEffects.update(1/120,flight.aircraft,flight.mesh.origin,"medium");} 0');
    await b.sleep(200);
    await shot(`damage-${id}-fire`);
    await b.eval('flight.debugDamage("wingL",0); flight.damageEffects.clear(); flight.paused=true; 0');
    await b.sleep(200);
    await shot(`damage-${id}-broken`);
    await b.eval('flight.openHangar("pause"); 0');
    await b.sleep(200);
    await shot(`damage-${id}-repair`);
    await b.eval('flight.hangar._repair(null); flight.hangar.close(false); flight.resume(); flight.debugDamage("fuselage",0); flight.step(1/120); flight.openCrash(); 0');
    for(let i=0;i<100 && !(await b.eval('flight.screens.map._built'));i++)await b.sleep(100);
    await shot(`damage-${id}-respawn`);
    await b.eval('flight.respawnAt(flight.places.nearestEligible(flight.physics.x,flight.physics.z,"hangar").id); 0');
  }

  // A2: physical visit actions, rather than the Fly-menu preview.
  await b.eval('flight.start("hangar"); for(let i=0;i<480;i++)flight.step(1/120); flight.render(1,1/60); 0');
  await shot('hangar-enter-button');
  await b.eval('flight.enterHangar(); flight.hangar._focus(flight.hangar.fields.length-1); flight.hangar._paint(); 0');
  await b.sleep(250);
  await shot('hangar-departure-options');
  await b.eval('flight.hangar.buttons[1].click(); 0');
  await b.sleep(250);
  await shot('hangar-runway-departure');

  // B: both physical panels keep working with the external HUD switched off.
  for(const id of ['f22','b737']) {
    await b.eval(`flight.switchAircraft('${id}');flight.start('air');flight.camera.mode=2;flight._savedCamMode=2;flight.input._lookMouse=true;flight.input.look.x=0;flight.input.look.y=-.35;flight.hudOn=false;flight.hud.hide();flight.autopilot.engage(flight.physics);flight.render(1,1/30);0`);
    await shot(`instruments-${id}-cockpit`);
    await b.eval('flight.units="metric";flight.hud.setUnits("metric");flight.render(1,1/30);0');
    await shot(`instruments-${id}-metric`);
    await b.eval('flight.units="aviation";flight.hud.setUnits("aviation");flight.hudOn=true;flight.hud.show();0');
  }
  await b.eval('flight.input._lookMouse=false;flight.input.look.x=flight.input.look.y=0;0');

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
