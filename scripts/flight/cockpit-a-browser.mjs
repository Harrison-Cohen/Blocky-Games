// Approved revision, batch A: real input/lifecycle checks and reproducible views.
import {mkdirSync} from 'node:fs';
import {launch} from '../lib/browser.mjs';
const url=process.argv[2]||'http://localhost:5173', out=process.argv[3]||'/tmp/look-cockpit-a';
mkdirSync(out,{recursive:true});
const b=await launch({url,width:1440,height:900,port:9352});
let count=0;
const check=async(expr,name)=>{if(!await b.eval(expr))throw new Error(name);console.log(`ok ${name}`);count++;};
const tap=async(code,key)=>{await b.key('keyDown',code,key);await b.eval('flight.render(1,1/60); 0');await b.key('keyUp',code,key);};
try {
  await b.eval('game.onFly()');
  await b.eval('flight.start("air"); game.loop.stop(); 0');
  for(const id of ['f22','b737']) {
    await b.eval(`flight.switchAircraft('${id}'); flight.start('air'); 0`);
    await tap('KeyV','v');
    await b.eval('for(let i=0;i<240;i++)flight.step(1/120); flight.render(1,1/60); 0');
    await check('flight.airbrakeLever && flight.physics.airbrake>0.95',`${id}: V deploys and stays deployed after release`);
    await b.eval('flight.input._onKeyDown({code:"KeyV",repeat:true}); flight.render(1,1/60); 0');
    await check('flight.airbrakeLever',`${id}: repeated V cannot retract the brake`);
    await tap('KeyC','c');
    await check('flight.airbrakeLever',`${id}: camera change preserves speed brake lever`);
    await b.eval('flight.openPause(); flight.render(1,1/60); flight.resume(); flight.step(1/120); 0');
    await check('flight.airbrakeLever && flight.input.state.airbrake',`${id}: pause/resume preserves lever and command`);
    await tap('KeyV','v');
    await b.eval('for(let i=0;i<240;i++)flight.step(1/120); 0');
    await check('!flight.airbrakeLever && flight.physics.airbrake<0.02',`${id}: second press retracts after release`);
    await b.eval('window.testPad={connected:true,mapping:"standard",axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))}; window.realPads=navigator.getGamepads.bind(navigator); navigator.getGamepads=()=>[testPad]; testPad.buttons[1]={pressed:true,value:1}; flight.render(1,1/60); flight.render(1,1/60); 0');
    await check('flight.airbrakeLever',`${id}: held gamepad B toggles once`);
    await b.eval('testPad.buttons[1]={pressed:false,value:0}; flight.render(1,1/60); testPad.buttons[8]={pressed:true,value:1}; testPad.buttons[1]={pressed:true,value:1}; window.muteWas=game.sound.muted; flight.render(1,1/60); 0');
    await check('flight.airbrakeLever && game.sound.muted!==muteWas',`${id}: Back+B mutes without retracting the brake`);
    await b.eval('testPad.buttons[8]={pressed:false,value:0}; flight.render(1,1/60); testPad.buttons[1]={pressed:false,value:0}; flight.render(1,1/60); navigator.getGamepads=realPads; delete window.testPad; delete window.realPads; flight.start("air"); 0');
    await check('!flight.airbrakeLever && !flight.input.state.airbrake && flight.physics.airbrake===0',`${id}: new flight starts with speed brakes retracted`);
    await tap('KeyV','v');
    await b.eval('flight.debugDamage("fuselage",0); flight.step(1/120); flight.respawnAt(flight.places.last.id); 0');
    await b.eval('game.loading.whenIdle().then(()=>0)');
    await check('!flight.airbrakeLever && !flight.physics.crashed && flight.physics.airbrake===0',`${id}: crash respawn retracts speed brakes`);
  }
  await b.eval('flight.airbrakeLever=true; flight.switchAircraft("f22"); 0');
  await check('!flight.airbrakeLever && !flight.input.state.airbrake', 'aircraft switch retracts the old lever');
  await b.eval('flight.switchAircraft("b737"); flight.start("runway"); flight.paused=true; flight.hud.hide(); flight.aircraft.updateVisual(1,0,flight.mesh.origin.ox,flight.mesh.origin.oz); 0');
  // External camera poses are in body axes, so comparisons do not depend on runway heading.
  for(const [name,pos,target] of [['nose-side',[22,1,16],[0,.3,13]],['nose-three-quarter',[16,4,29],[0,.6,13.5]],['nose-front',[0,1.6,37],[0,.65,13.5]]]) {
    await b.eval(`(()=>{const f=flight, root=f.aircraft.root,c=f.scene.camera; f.scene.setOverlay(false); f.aircraft.setInterior(false); c.up.set(0,1,0); c.fov=34; c.position.copy(c.position.clone().set(...${JSON.stringify(pos)}).applyQuaternion(root.quaternion).add(root.position)); const at=c.position.clone().set(...${JSON.stringify(target)}).applyQuaternion(root.quaternion).add(root.position); c.lookAt(at); c.updateProjectionMatrix(); f.scene.frame(root.position.x,root.position.y,root.position.z,1/60); f.scene.render(1/60); return 0;})()`);
    await b.shot(`${out}/${name}.png`);
  }
  for (const modeName of ['runway','air']) {
    await b.eval(`flight.start('${modeName}'); flight.paused=true; flight.hud.hide(); 0`);
    for(const [name,mode,yaw,pitch] of [['cockpit-forward',2,0,0],['cockpit-left',2,.65,0],['cockpit-right',2,-.65,0],['cockpit-panel',2,0,-.4],['first-person',1,0,0]]) {
      await b.eval(`flight.camera.mode=${mode}; flight.camera.reset(); flight.input._lookMouse=true; flight.input.look.x=${yaw}; flight.input.look.y=${pitch}; flight.input.suspended=false; flight.render(1,1/60); 0`);
      await b.shot(`${out}/${modeName}-${name}.png`);
    }
  }
  const bad=b.console.filter(l=>/^(error|warning|EXCEPTION)/i.test(l)&&!/vite/i.test(l));
  if(bad.length)throw new Error(bad.join('\n'));
  console.log(`${count} batch A browser checks passed, console clean; pictures ${out}`);
} finally {await b.close();}
