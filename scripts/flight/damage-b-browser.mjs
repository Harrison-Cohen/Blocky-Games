// Part B end-to-end checks and pictures, using an isolated Chrome save profile.
import { mkdirSync } from 'node:fs';
import { launch } from '../lib/browser.mjs';
const url = process.argv[2] || 'http://localhost:5173', out = process.argv[3] || '/tmp/look-m5b';
mkdirSync(out, { recursive: true });
const b = await launch({ url, width: 1440, height: 900, port: 9346 });
let count = 0;
const check = async (expr, name) => { if (!await b.eval(expr)) throw new Error(name); console.log(`ok ${name}`); count++; };
const shot = async (name) => { await b.sleep(150); await b.shot(`${out}/${name}.png`); };
try {
  await b.eval('game.onFly()');
  await b.eval('game.sound._unlock(); flight.start("air"); 0');
  for (const id of ['f22', 'b737']) {
    await b.eval(`flight.switchAircraft('${id}'); flight.start('air'); flight.debugDamage('engineL', 0.5); for(let i=0;i<120;i++)flight.step(1/120); for(let i=0;i<120;i++){flight.step(1/120);flight.damageEffects.update(1/120,flight.aircraft,flight.mesh.origin,'medium');} 0`);
    await check('flight.damageEffects.pool.alive > 0 && flight.damageEffects.pool.alive <= 224', `${id}: smoke emits inside the particle cap`);
    await shot(`${id}-smoke`);
    await b.eval('flight.debugDamage("engineL",0.2); for(let i=0;i<120;i++){flight.step(1/120);flight.damageEffects.update(1/120,flight.aircraft,flight.mesh.origin,"medium");} 0');
    await check('flight.damageEffects.pool.r.some((v,i)=>i<flight.damageEffects.pool.alive && v===1)', `${id}: fire particles appear below 30 percent health`);
    await shot(`${id}-fire`);
    await b.eval('flight.debugDamage("wingL",0); flight.aircraft.updateVisual(1,0,flight.mesh.origin.ox,flight.mesh.origin.oz); flight.damageEffects.clear(); flight.paused=true; 0');
    await check('flight.aircraft.built.damageGroups.wingL.every(o=>!o.visible) && flight.aircraft.built.damageGroups.wingR.every(o=>o.visible)', `${id}: broken wing disappears on its own side`);
    await shot(`${id}-broken-wing`);
    await b.eval('flight.openHangar("pause"); 0');
    await shot(`${id}-repair`);
    await b.eval('flight.hangar._repair(null); flight.hangar.close(false); flight.resume(); 0');
    await check('Object.values(flight.physics.damage.record()).every(h=>h===1)', `${id}: repair restores the damaged and broken parts`);
    await b.eval('flight.debugDamage("fuselage",0); flight.step(1/120); flight.openCrash(); 0');
    await check('flight.screens.map.visible && flight.screens.map.respawn && flight.screens.map.mode==="hangar" && flight.screens.map.modesEl.hidden && flight.paused', `${id}: crash opens the paused respawn map with apron-only start`);
    await check('flight.screens.map.items[flight.screens.map.sel]===flight.places.nearestEligible(flight.physics.x,flight.physics.z,"hangar")', `${id}: nearest compatible airport is selected`);
    await b.eval('window.savedRespawnCallback=flight.screens.map.ctx0.onTeleport; flight.screens.map.ctx0.onTeleport=()=>false; flight.screens.map._teleport(); flight.screens.map.ctx0.onTeleport=savedRespawnCallback; delete window.savedRespawnCallback; 0');
    await b.eval('game.loading.whenIdle().then(()=>0)');
    await check('flight.screens.map.visible && flight.physics.crashed', `${id}: a rejected spawn callback leaves the airport list usable`);
    // Keyboard and pad may inspect a disabled destination but cannot confirm it.
    await b.eval('flight.screens.map._select(flight.screens.map.items.findIndex(a=>!flight.places.eligible(a,"hangar").ok)); flight.screens.map.handlePad({confirm:true}); 0');
    await check('flight.physics.crashed && flight.screens.map.visible && flight.screens.map.goEl.disabled', `${id}: pad confirm cannot spawn at an incompatible airport`);
    await check('!flight.respawnAt("missing-airport")', `${id}: stale/invalid respawn ID is rejected`);
    if(id==='f22') { await b.key('keyDown','Escape','Escape'); await b.key('keyUp','Escape','Escape'); }
    else await b.eval('flight.screens.map.handlePad({back:true}); 0');
    await check('flight.screens.crash.visible && !flight.screens.map.visible', `${id}: Back/Esc opens exit choices without resuming the wreck`);
    await b.eval('flight.openCrash(); 0');
    // Keep one unsuitable entry visible to make the disabled reason reviewable.
    for(let i=0;i<100 && !await b.eval('flight.screens.map._built');i++)await b.sleep(100);
    await shot(`${id}-respawn`);
    await b.eval('window.chosenRespawn = flight.screens.map.items.find(a=>flight.places.eligible(a,"hangar").ok && a!==flight.places.last); if(!chosenRespawn)chosenRespawn=flight.places.last; flight.screens.map._select(flight.screens.map.items.indexOf(chosenRespawn)); 0');
    if(id==='f22') { await b.key('keyDown','Enter','Enter'); await b.key('keyUp','Enter','Enter'); }
    else await b.eval('flight.screens.map.handlePad({start:true}); 0');
    await b.eval('game.loading.whenIdle().then(()=>0)');
    await check(`flight.def.id==='${id}' && !flight.physics.crashed && !flight.paused && flight.places.last===chosenRespawn && Object.values(flight.physics.damage.record()).every(h=>h===1)`, `${id}: Enter/Start respawns the same aircraft fully repaired at the chosen airport`);
    await check('(()=>{const at=flight.places.pose(chosenRespawn,"hangar");return Math.hypot(flight.physics.x-at.x,flight.physics.z-at.z)<0.1 && Math.hypot(flight.physics.vx,flight.physics.vz)<0.1})()', `${id}: spawn is stationary at the exact hangar apron`);
    await check('flight.damageEffects.pool.alive===0', `${id}: respawn clears old smoke/fire`);
    await shot(`${id}-respawn-apron`);
  }
  // Verify sound parameters and warning latching in the actual audio context.
  await b.eval('flight.start("air"); flight.debugDamage("engineL",0.5); for(let i=0;i<10;i++)flight.render(1,1/60); 0');
  await check('game.sound.ready && flight.audio.built && flight.audio._damageLevels[flight.physics.damage.index("engineL")]===1', 'Web Audio damage warning is active');
  await b.eval('window.warningStamp=flight.audio._damageWarningAt; for(let i=0;i<60;i++)flight.render(1,1/60); 0');
  await check('flight.audio._damageWarningAt===warningStamp', 'unchanged damage does not repeat the warning');
  await b.eval('flight.debugDamage("fuselage",0); flight.step(1/120); flight.openCrash(); flight.screens.map.el.querySelector(".map-close").click(); 0');
  await check('!flight.active && game.loop.step===flight._loopWas.step', 'Back to title leaves the wreck and restores the car loop');
  const bad = b.console.filter((l)=>/^(error|warning|EXCEPTION)/i.test(l)&&!/vite/i.test(l));
  if(bad.length)throw new Error(bad.join('\n'));
  console.log(`${count} part B browser checks passed, console clean; pictures ${out}`);
} finally { await b.close(); }
