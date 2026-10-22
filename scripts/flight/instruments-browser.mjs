// B actual-page checks, photographed at seated size, with an isolated save profile.
import {mkdirSync} from 'node:fs';
import {launch} from '../lib/browser.mjs';
const url=process.argv[2]||'http://localhost:5185',out=process.argv[3]||'/tmp/look-instruments';
mkdirSync(out,{recursive:true});
const b=await launch({url,width:1440,height:900,port:9358});
let count=0;
const run=async s=>b.eval(`${s};0`);
const check=async(s,name)=>{if(!await b.eval(s))throw new Error(name);console.log(`ok ${name}`);count++;};
const frame=async()=>run('flight.render(1,1/30)');
const tap=async(code,key=code)=>{await b.key('keyDown',code,key);await frame();await b.key('keyUp',code,key);};
const shot=async name=>b.shot(`${out}/${name}.png`);
try{
 await b.eval('game.onFly()');await run('game.loop.stop()');
 for(const id of ['b737','f22']){
  await run(`flight.switchAircraft('${id}');flight.start('runway');flight.camera.mode=2;flight._savedCamMode=2;flight.hudOn=true;flight.hud.show();flight.input._lookMouse=true;flight.input.look.x=flight.input.look.y=0;flight.render(1,1/30)`);
  await check('Object.values(flight.hud.views).every(v=>v.canvas.hidden)&&flight.aircraft.interior.group.visible',`${id}: Cockpit uses physical instruments without duplicate floating gauges`);
  await shot(`${id}-runway-forward`);
  await run('flight.input.look.y=-.35;flight.render(1,1/30)');await shot(`${id}-runway-panel`);
  await check('flight.aircraft.interior.instruments.surfaces.every(s=>s.count>0&&s.count<=24000&&!s.mesh.material.map)',`${id}: every mounted panel populated inside the vertex budget without textures`);
  await run('window.panelGeometry=flight.aircraft.interior.instruments.surfaces[0].positions.slice(0,3000);window.oldPanelUpdates=flight.aircraft.interior.instruments.surfaces[0].updates');
  await tap('KeyU','u');
  await run('flight.start("air");flight.camera.mode=2;flight._savedCamMode=2;flight.physics.throttle=.85;for(let i=0;i<240;i++)flight.step(1/120);flight.render(1,1/30)');
  await check('!flight.hudOn&&flight.hud.root.hidden&&flight.aircraft.interior.instruments.surfaces[0].updates>oldPanelUpdates',`${id}: U hides the overlay while physical instruments continue updating`);
  await check('flight.aircraft.interior.instruments.surfaces[0].positions.slice(0,3000).some((v,i)=>v!==panelGeometry[i])',`${id}: real flight changes the physical vector geometry`);
  await shot(`${id}-air-panel-hud-off`);
  await tap('KeyU','u');
  await run('flight.input.look.x=flight.input.look.y=0;flight.camera.mode=0;flight._savedCamMode=0;flight.render(1,1/30)');
  await check('!flight.hud.views.primary.canvas.hidden&&flight.hud.root.dataset.profile===flight.telemetry.profile.id',`${id}: external primary display follows the aircraft profile`);
  for(const units of ['aviation','mph','metric']){
   await run(`flight.units='${units}';flight.hud.setUnits('${units}');flight.render(1,1/30)`);
   await check('flight.hud.views.primary.canvas.getAttribute("aria-label").includes("airspeed "+flight.telemetry.speed+" "+flight.telemetry.speedUnit)&&flight.hud.views.primary.canvas.getAttribute("aria-label").includes("altitude "+flight.telemetry.height+" "+flight.telemetry.heightUnit)',`${id}: ${units} overlay values agree with the physical-panel snapshot`);
   await shot(`${id}-chase-${units}`);
  }
  await run('flight.units="aviation";flight.hud.setUnits("aviation");flight.camera.mode=1;flight._savedCamMode=1;flight.render(1,1/30)');
  await check(`flight.hud.views.hud.canvas.hidden===${id==='b737'} && !flight.aircraft.interior.group.visible`,`${id}: First person keeps the proper aircraft theme and no physical interior`);
  await shot(`${id}-first-person`);
  await run('flight.camera.mode=2;flight._savedCamMode=2;flight.input.look.y=-.35;flight.autopilot.engage(flight.physics);flight.autopilot.alt=4000;flight.autopilot.spd=180;flight.autopilot.hdg=1.4;flight.render(1,1/30)');
  await check('flight.telemetry.apOn&&flight.telemetry.apAltitude===Math.round(4000/.3048)&&flight.telemetry.apHeading===80',`${id}: working AP targets show selected altitude, heading and speed`);
  await shot(`${id}-cockpit-autopilot`);
  await run('flight.autopilot.disengage();(()=>{const p=flight.physics;p.reset({x:p.x,y:p.y,z:p.z,heading:1.3,pitch:.18,bank:.55,speed:180,gear:0});})();flight.step(1/120);flight.render(1,1/30)');
  await check('flight.telemetry.bank>.5&&flight.telemetry.pitch>.1',`${id}: bank and pitch feed both the attitude display and HUD`);
  await shot(`${id}-banked-panel`);
  await run('flight.debugDamage("engineL",.2);flight.render(1,1/30)');
  await check('flight.telemetry.warning==="Critical damage"&&flight.telemetry.damageRows.find(r=>r.id==="engineL").health===.2',`${id}: physical systems and warning read damaged engine health`);
  await shot(`${id}-cockpit-damage`);
  for(const [name,x,y]of[['left',.65,0],['right',-.65,0]]){
   await run(`flight.input.look.x=${x};flight.input.look.y=${y};flight.render(1,1/30)`);await shot(`${id}-look-${name}`);
  }
  await run('flight.input.look.x=0;flight.input.look.y=-.35;flight.setNight(true);flight.render(1,1/30)');await shot(`${id}-night-panel`);
  await run('flight.setNight(false);flight.input.look.x=flight.input.look.y=0;window.headingBefore=flight.telemetry.headingDeg;flight.mesh.origin.rebaseTo(flight.mesh.origin.ox+1000,flight.mesh.origin.oz-2000);flight.render(1,1/30)');
  await check('flight.telemetry.headingDeg===headingBefore&&flight.telemetry.nearest.metres>=0',`${id}: instrument/navigation values survive origin rebasing`);
  await run('flight.debugDamage("fuselage",0);flight.step(1/120);flight.respawnAt(flight.places.last.id);flight.camera.mode=2;flight.render(1,1/30)');
  await check('!flight.telemetry.apOn&&!flight.physics.crashed&&flight.telemetry.damageRows.every(r=>r.health===1)',`${id}: respawn clears old AP and damage instrument states`);
 }
 // Repeated switches must dispose old physical buffers and keep exactly one panel set.
 await run('window.disposedBuffers=0;for(let i=0;i<4;i++){for(const s of flight.aircraft.interior.instruments.surfaces)s.geometry.addEventListener("dispose",()=>disposedBuffers++);flight.switchAircraft(i%2?"f22":"b737");flight.start("air");flight.camera.mode=2;flight.render(1,1/30)}');
 await check('disposedBuffers>=21&&flight.aircraft.root.children.filter(o=>o===flight.aircraft.interior.group).length===1','repeated switches dispose old display buffers and retain one interior');
 await run('flight.camera.mode=0;flight._savedCamMode=0;flight.render(1,1/30)');
 await b.send('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});await frame();await shot('hud-1280x720');
 await check('(()=>{const vs=[flight.hud.views.primary,flight.hud.views.systems,flight.hud.views.engines].map(v=>v.canvas.getBoundingClientRect());return vs[0].right<vs[1].left&&vs[1].right<vs[2].left})()','external panels fit a 1280 by 720 view without overlap');
 // Reload uses stored aircraft selection and the data profile, with AP disengaged.
 await b.send('Page.reload');await b.sleep(1200);await b.eval('game.onFly()');await run('game.loop.stop();flight.start("air");flight.render(1,1/30)');
 await check('flight.hud.root.dataset.profile===flight.telemetry.profile.id&&!flight.autopilot.on','reload restores aircraft theme and does not restore autopilot engagement');
 const bad=b.console.filter(l=>/^(error|warning|EXCEPTION)/i.test(l)&&!/vite/i.test(l));if(bad.length)throw new Error(bad.join('\n'));
 console.log(`${count} B instrument browser checks passed, console clean; pictures ${out}`);
}finally{await b.close();}
