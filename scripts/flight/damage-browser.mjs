// Real-page lifecycle checks, separate Chrome profile, no changes to the user's saves.
// node scripts/flight/damage-browser.mjs <url> <screenshots-dir>
import { launch } from '../lib/browser.mjs';
import { mkdirSync } from 'node:fs';
const url = process.argv[2] || 'http://localhost:5173';
const out = process.argv[3] || '/tmp/look-damage';
mkdirSync(out, { recursive: true });
const b = await launch({ url, width: 1440, height: 900, port: 9345 });
let checks = 0;
const test = async (expression, label) => {
  if (!(await b.eval(expression))) throw new Error(label);
  checks++; console.log(`ok ${label}`);
};
try {
  await b.eval('game.onFly()');
  await b.eval('flight.start("air"); flight.debugDamage("engineL", 0.5); for(let i=0;i<120;i++) flight.step(1/120); 0');
  await test('flight.physics.engines[0].health === 0.5 && JSON.parse(localStorage.getItem("racing-game.v1.flight.damage.f22")).engineL === 0.5', 'dev hook applies and persists engine health');
  await b.sleep(300);
  await b.shot(`${out}/damage-f22-hud.png`);
  await b.eval('flight.debugDamage("tail",0.25); 0');
  await b.sleep(100);
  await test('flight.hud.warnEl.textContent === "Critical damage" && flight.hud.damageEl.classList.contains("critical")', 'critical health shows the critical warning');
  await b.shot(`${out}/damage-f22-critical.png`);
  await b.eval('flight.debugDamage("tail",1); flight.start("air"); 0');
  await test('flight.physics.damage.get("engineL") === 0.5 && flight.physics.engines[0].health === 0.5', 'restart preserves survivable damage');
  await b.eval('flight.openHangar("pause"); flight.hangar.setup.tune.power = 1.1; flight.hangar._repair("engineL"); flight.hangar.close(false); 0');
  await test('flight.physics.damage.get("engineL") === 1 && flight.physics.engines[0].health === 1 && flight.setup.tune.power === 1 && JSON.parse(localStorage.getItem("racing-game.v1.flight.damage.f22")).engineL === 1', 'repair commits immediately even when pending tuning is discarded');
  await b.eval('flight.debugDamage("wingL",0.5); flight.switchAircraft("b737"); flight.start("air"); flight.debugDamage("engineR",0.4); for(let i=0;i<120;i++)flight.step(1/120); 0');
  await test('flight.physics.engines[1].health === 0.4 && JSON.parse(localStorage.getItem("racing-game.v1.flight.damage.f22")).wingL === 0.5', 'switching saves outgoing aircraft separately');
  await b.sleep(300);
  await b.shot(`${out}/damage-737-hud.png`);
  await b.eval('flight.openHangar("pause"); 0');
  await b.sleep(200);
  await b.shot(`${out}/damage-737-repair.png`);
  await b.eval('flight.hangar.close(false); flight.switchAircraft("f22"); flight.start("air"); 0');
  await test('flight.physics.damage.get("wingL") === 0.5', 'switching back restores damage');
  await b.eval('flight.debugDamage("gear",0); flight.toHangar(); for(let i=0;i<240;i++)flight.step(1/120); 0');
  await b.eval('game.loading.whenIdle().then(()=>0)');
  await test('!flight.physics.crashed && flight.physics.damage.get("gear") === 0 && flight.physics.gear.weightOnWheels === 0', 'returning to hangar with collapsed gear survives without silently repairing');
  await b.eval('flight.debugDamage("fuselage",0); flight.step(1/120); 0');
  await test('flight.physics.crashed', 'destroyed fuselage enters crash flow');
  await b.eval('flight.respawnAt(flight.places.last.id); 0');
  await b.eval('game.loading.whenIdle().then(()=>0)');
  await test('Object.values(flight.physics.damage.record()).every(h=>h===1)', 'crash replacement restores all parts');
  await b.eval('flight.debugDamage("tail",0.55); flight.exit(); location.reload(); 0');
  await b.sleep(1000);
  await b.eval('game.onFly()');
  await b.eval('flight.start("air"); 0');
  await test('flight.physics.damage.get("tail")===0.55', 'page reload restores persisted damage');
  await b.eval('flight.switchAircraft("b737"); flight.start("air"); 0');
  await test('flight.physics.damage.get("engineR")===0.4', 'page reload preserves the other aircraft record');
  const bad = b.console.filter((l) => /^(error|warning|EXCEPTION)/i.test(l) && !/vite/i.test(l));
  if (bad.length) throw new Error(bad.join('\n'));
  console.log(`${checks} browser damage checks passed, console clean; screenshots ${out}`);
} finally { await b.close(); }
