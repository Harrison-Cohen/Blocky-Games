// A2 actual-page regressions with an isolated Chrome save profile and synthetic pad.
import {mkdirSync} from 'node:fs';
import {launch} from '../lib/browser.mjs';
const url=process.argv[2]||'http://localhost:5173',out=process.argv[3]||'/tmp/look-hangar';
mkdirSync(out,{recursive:true});
const b=await launch({url,width:1440,height:900,port:9356});
let count=0;
const check=async(expr,name)=>{if(!await b.eval(expr))throw new Error(name);console.log(`ok ${name}`);count++;};
const run=async(s)=>b.eval(`${s}; 0`);
const settle=async()=>{await b.eval('game.loading.whenIdle().then(()=>0)');await run('for(let i=0;i<480;i++)flight.step(1/120); flight.render(1,1/60)');};
const tap=async(code,key=code)=>{await b.key('keyDown',code,key);await run('flight.render(1,1/60)');await b.key('keyUp',code,key);};
const shot=async(name)=>b.shot(`${out}/${name}.png`);
try {
  await b.eval('game.onFly()');
  await run('flight.start("hangar"); game.loop.stop()');
  for(const id of ['f22','b737']) {
    await run(`flight.switchAircraft('${id}'); flight.start('hangar',flight.places.airports.major); window.entryHeading=flight.physics.attitude().heading`);
    await settle();
    await check('!flight.hangarButton.hidden && !flight.hangar.visible',`${id}: teleport offers explicit entry without auto-opening`);
    await shot(`${id}-enter`);
    for(let visit=0;visit<3;visit++) {
      if(visit===0)await run('flight.hangarButton.click()');
      else if(visit===1)await tap('Enter');
      else await run('window.testPad={connected:true,mapping:"standard",axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))}; window.realPads=navigator.getGamepads.bind(navigator); navigator.getGamepads=()=>[testPad]; flight.render(1,1/60); testPad.buttons[0]={pressed:true,value:1}; flight.render(1,1/60)');
      await check('flight.hangar.visible && flight.hangar.departures && flight.hangarButton.hidden && !flight.input.state.ab',`${id}: deliberate entry ${visit+1} opens physical visit without afterburner`);
      if(visit===0){await run('flight.hangar._focus(flight.hangar.fields.length-1); flight.hangar._paint(); flight.render(1,1/60)');await shot(`${id}-departure-options`);}
      if(visit===2) {
        await run('testPad.buttons[0]={pressed:false,value:0}; flight.render(1,1/60); flight.hangar._focus(flight.hangar.fields.length-1); flight.hangar.button=0; testPad.buttons[0]={pressed:true,value:1}; flight.render(1,1/60); flight.render(1,1/60)');
        await check('!flight.hangar.visible && !flight.input.state.ab',`${id}: held pad exit cannot reopen or engage afterburner`);
        await run('testPad.buttons[0]={pressed:false,value:0}; flight.render(1,1/60); navigator.getGamepads=realPads; delete window.testPad; delete window.realPads');
      } else if(visit===1) {await run('flight.hangar._focus(flight.hangar.fields.length-1); flight.hangar.button=0');await tap('Enter');}
      else await run('flight.hangar.buttons[0].click()');
      await b.eval('game.loading.whenIdle().then(()=>0)');
      await check('!flight.hangar.visible && !flight.paused && flight.physics.throttle===0 && !flight.autopilot.on && Math.hypot(flight.physics.vx,flight.physics.vz)===0 && Math.cos(flight.physics.attitude().heading-entryHeading)<-0.999',`${id}: departure ${visit+1} stationary and facing outward`);
      await settle();
      await check('!flight.physics.crashed && !flight.hangar.visible && !flight.hangarButton.hidden',`${id}: departure ${visit+1} clear and immediately re-enterable`);
    }
    await check('(()=>{const p=flight.physics,c=flight.scene.camera.position,o=flight.mesh.origin;return flight.world.collisions.cameraFraction(p.x,p.y,p.z,c.x+o.ox,c.y,c.z+o.oz,flight.camera.cfg.buildingClearance)>0.999})()', `${id}: outward chase camera has a clear line past the Hangar`);
    await shot(`${id}-outward`);
    await run('flight.hudOn=false; flight.hud.hide(); flight.render(1,1/60)');
    await check('!flight.hangarButton.hidden',`${id}: Enter button works with HUD hidden`);
    await run('flight.hudOn=true; flight.hud.show(); window.fuelBefore=flight.physics.fuel; flight.debugDamage("engineL",0.7); flight.enterHangar(); window.paintBefore=flight.setup.livery.body; flight.hangar._setKey("body",paintBefore==="red"?"stock":"red"); flight.hangar.buttons[1].click(); flight.render(1,1/60)');
    await check('flight.hangar.visible && flight.hangar.confirmSave && !flight.hangar.buttons[2].hidden',`${id}: pending edits require Save/Discard before runway teleport`);
    await shot(`${id}-save-discard`);
    await run('flight.hangar.buttons[2].click()');
    await check('flight.hangar.visible && !flight.hangar.confirmSave',`${id}: Keep editing cancels departure`);
    await run('flight.hangar.buttons[1].click(); flight.hangar.buttons[1].click()');
    await b.eval('game.loading.whenIdle().then(()=>0)');
    await check('flight.lastStart==="runway" && !flight.paused && flight.setup.livery.body===paintBefore && flight.physics.damage.get("engineL")===0.7 && flight.physics.fuel===fuelBefore',`${id}: Discard keeps paint, survivor damage and fuel through runway departure`);
    await check('(()=>{const at=flight.places.pose(flight.places.last,"runway");return Math.hypot(flight.physics.x-at.x,flight.physics.z-at.z)<0.001 && Math.cos(flight.physics.attitude().heading-at.heading)>0.999})()',`${id}: runway departure aligned at canonical runway start`);
    await run('flight.start("hangar")');await settle();
    await run('flight.enterHangar(); flight.hangar._setKey("body",paintBefore==="red"?"stock":"red"); window.paintSaved=flight.hangar.setup.livery.body; flight.hangar._repair("engineL"); flight.hangar.buttons[0].click(); flight.hangar.buttons[0].click()');
    await check('flight.setup.livery.body===paintSaved && flight.physics.damage.get("engineL")===1',`${id}: Save applies edits and repairs remain immediate`);
    await settle();
    await run('flight.debugDamage("engineL",0.4); flight.enterHangar(); flight.hangar._repair("engineL"); flight.hangar._setKey("body",paintSaved==="red"?"stock":"red"); flight.hangar.buttons[0].click(); flight.hangar.buttons[1].click()');
    await check('flight.setup.livery.body===paintSaved && flight.physics.damage.get("engineL")===1', `${id}: Discard paint preserves an immediate repair`);
    await settle();
    await run('window.savedVX=flight.physics.vx; flight.physics.vx=2');
    await check('!flight.enterHangar()',`${id}: moving aircraft cannot enter`);
    await run('flight.physics.vx=savedVX; flight.start("air")');
    await check('!flight.enterHangar()',`${id}: airborne aircraft cannot enter`);
    await run('flight.debugDamage("fuselage",0); flight.step(1/120)');
    await check('!flight.enterHangar()',`${id}: wreck cannot enter`);
    await run('flight.respawnAt(flight.places.last.id)');await b.eval('game.loading.whenIdle().then(()=>0)');await settle();
    await check('!flight.physics.crashed && !flight.hangarButton.hidden && Object.values(flight.physics.damage.record()).every(v=>v===1)',`${id}: wreck respawn remains repaired and eligible for explicit entry`);
  }
  // Bay choice, airport eligibility, map persistence and preview return.
  await run('flight.switchAircraft("f22"); window.shortAirport=flight.places.list.find(a=>!a.isHeliport && a.length<1500 && flight.places.eligible(a,"hangar").ok); flight.start("hangar",shortAirport)');await settle();
  await run('window.switchX=flight.physics.x; window.switchZ=flight.physics.z; flight.enterHangar(); flight.hangar._setKey("aircraft","b737"); flight.hangar.buttons[0].click(); flight.hangar.buttons[0].click()');
  await check('flight.def.id==="b737" && flight.places.last!==shortAirport && flight.places.eligible(flight.places.last,"hangar").ok', 'switch to 737 relocates from short runway to compatible airport');
  await check('flight.places.last===flight.places.nearestEligible(switchX,switchZ)', 'aircraft switch chooses nearest eligible airport to the visit');
  await settle();await check('!flight.physics.crashed && !flight.hangarButton.hidden','switched aircraft clear and re-enterable at replacement airport');
  await run('window.bayAirport=flight.places.list.find(a=>flight.places.eligible(a,"hangar").ok&&a.layout.zones.length>1); window.bay=bayAirport.layout.zones[1]; flight.start("hangar",bayAirport,{zone:bay})');await settle();
  await run('flight.enterHangar(); flight.hangar.buttons[0].click()');await settle();
  await check('flight.places.availableHangar(flight.physics)===bay && flight.places.last===bayAirport','physical visit retains second bay and actual airport');
  await run('flight.openMap(); flight.screens.map._setMode("hangar"); flight.screens.map._select(flight.screens.map.items.findIndex(a=>!flight.places.eligible(a,"hangar").ok)); window.beforeX=flight.physics.x; flight.screens.map._teleport()');
  await b.eval('game.loading.whenIdle().then(()=>0)');
  await check('flight.screens.map.visible && flight.screens.map.goEl.disabled && flight.physics.x===beforeX','map rejects incompatible Hangar teleport');
  await run('flight.screens.map._select(flight.screens.map.items.findIndex(a=>a!==flight.places.last&&flight.places.eligible(a,"hangar").ok)); window.mapAirport=flight.screens.map.items[flight.screens.map.sel]; flight.screens.map._teleport()');await settle();
  await b.eval('game.loading.whenIdle().then(()=>0)');
  await check('flight.places.last===mapAirport && flight.lastStart==="hangar" && !flight.hangar.visible && !flight.hangarButton.hidden','map Hangar teleport uses selected airport and offers entry');
  await run('flight.openMap(); flight.screens.map._select(flight.screens.map.items.findIndex(a=>flight.places.eligible(a,"hangar").ok)); for(let i=0;i<80;i++)flight.screens.map.tick(); flight.render(1,1/60)');
  await shot('map-hangar-mode');
  await run('window.realPads=navigator.getGamepads.bind(navigator); window.testPad={connected:true,mapping:"standard",axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))}; navigator.getGamepads=()=>[testPad]; flight.render(1,1/60); testPad.buttons[0]={pressed:true,value:1}; flight.render(1,1/60); flight.render(1,1/60)');
  await check('!flight.screens.map.visible && !flight.input.state.ab && !flight.hangar.visible', 'map confirmation held into flight cannot command afterburner or entry');
  await run('testPad.buttons[0]={pressed:false,value:0}; flight.render(1,1/60); navigator.getGamepads=realPads; delete window.testPad; delete window.realPads');
  await check('(async()=> (await import("/src/core/Storage.js")).load("flight.teleportMode","")==="hangar")()','Hangar map mode persisted');
  await run('window.previewX=flight.physics.x; window.previewZ=flight.physics.z; flight.showFlyMenu(); flight.openHangar("fly")');
  await check('!flight.hangar.departures && flight.hangar.buttons[0].textContent==="Save aircraft"','Fly menu preview retains Save aircraft/Discard buttons');
  await run('flight.hangar.buttons[1].click()');
  await check('flight.screens.fly.visible && flight.physics.x===previewX && flight.physics.z===previewZ','Fly menu preview closes without teleport');
  // Reproducible installation details from body coordinates, no external assets.
  await run('flight.start("runway"); flight.paused=true; flight.hud.hide(); flight.hangarButton.hidden=true; flight.aircraft.updateVisual(1,0,flight.mesh.origin.ox,flight.mesh.origin.oz)');
  for(const[name,pos,target]of [
    ['engine-front',[-7,-.6,10],[-7,-.6,1]],['engine-side',[-18,-1,4],[-5.7,-1.9,0]],['engine-rear',[-7,-2.2,-7],[-5.7,-1.9,-.5]],
    ['737-full-side',[63,10,0],[0,0,0]],['737-three-quarter',[-48,14,52],[0,0,0]],['737-tail',[10,9,-30],[0,5,-17]]]) {
    await run(`(()=>{const f=flight,root=f.aircraft.root,c=f.scene.camera;f.scene.setOverlay(false);f.aircraft.setInterior(false);c.up.set(0,1,0);c.fov=34;c.position.copy(c.position.clone().set(...${JSON.stringify(pos)}).applyQuaternion(root.quaternion).add(root.position));c.lookAt(c.position.clone().set(...${JSON.stringify(target)}).applyQuaternion(root.quaternion).add(root.position));c.updateProjectionMatrix();f.scene.frame(root.position.x,root.position.y,root.position.z,1/60);f.scene.render(1/60)})()`);
    await shot(name);
  }
  await check('(()=>{const p=flight.aircraft.built.parts.fans[0],r=p.rotation.z;flight.aircraft.updateVisual(1,.1,flight.mesh.origin.ox,flight.mesh.origin.oz);return p.rotation.z!==r})()','engine fans retain spool animation');
  const bad=b.console.filter(l=>/^(error|warning|EXCEPTION)/i.test(l)&&!/vite/i.test(l));
  if(bad.length)throw new Error(bad.join('\n'));
  console.log(`${count} A2 browser checks passed, console clean; pictures ${out}`);
} finally {await b.close();}
