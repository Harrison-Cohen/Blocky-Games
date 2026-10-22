// Actual input path for the user's inability to look down, at their screenshot aspect.
import {mkdirSync} from 'node:fs';
import {launch} from '../lib/browser.mjs';
const url=process.argv[2]||'http://localhost:5185',out=process.argv[3]||'/tmp/look-cockpit-feedback';
mkdirSync(out,{recursive:true});
const b=await launch({url,width:2048,height:1184,port:9363});let checks=0;
const run=async s=>b.eval(`${s};0`),frame=()=>run('flight.render(1,1/30)');
const check=async(s,name)=>{if(!await b.eval(s))throw Error(name);checks++;console.log('ok '+name);};
const shot=name=>b.shot(`${out}/${name}.png`);
const mouse=(type,x,y,button='none',buttons=0)=>b.send('Input.dispatchMouseEvent',{type,x,y,button,buttons,clickCount:type==='mousePressed'?1:0});
try{
 await b.eval('game.onFly()');await run('game.loop.stop()');
 for(const id of['f22','b737']){
  await run(`flight.switchAircraft('${id}');flight.start('runway');flight.camera.mode=2;flight._savedCamMode=2;flight.input.look.x=flight.input.look.y=0;flight.render(1,1/30)`);
  await shot(`${id}-forward`);
  await mouse('mouseMoved',1000,350);await mouse('mousePressed',1000,350,'right',2);await mouse('mouseMoved',1000,550,'right',2);await frame();
  await check('flight.input.look.y<-.6',`${id}: actual right-mouse downward drag reaches lower view`);
  await check('flight.scene.overlayCamera.quaternion.equals(flight.camera.camera.quaternion)',`${id}: world and cockpit use the same lower view`);
  await shot(`${id}-mouse-down`);
  await mouse('mouseMoved',1180,550,'right',2);await frame();await shot(`${id}-lower-centre`);
  await mouse('mouseReleased',1180,550,'right');
  await run('window.savedLook=flight.input.look.y;for(let i=0;i<90;i++)flight.render(1,1/60)');
  await check('Math.abs(flight.input.look.y)<Math.abs(savedLook)*.01',`${id}: released look returns smoothly to forward`);
  // Mouse-flight uses the existing pointer lock; middle look must leave virtual stick alone.
  await run('flight.input.mouseFlight=true;flight.input.look.x=flight.input.look.y=0;flight.input._mouse.x=flight.input._mouse.y=0');
  await mouse('mouseMoved',1000,350);await run('flight.input._mouse.x=flight.input._mouse.y=0');
  await mouse('mousePressed',1000,350,'middle',4);await mouse('mouseMoved',1000,550,'middle',4);await frame();
  await check('flight.input.look.y<-.6&&flight.input._mouse.x===0&&flight.input._mouse.y===0',`${id}: actual middle drag in mouse flight looks down without steering`);
  await shot(`${id}-middle-down`);await mouse('mouseReleased',1000,550,'middle');
  await run('flight.input.mouseFlight=false;flight.input.look.x=flight.input.look.y=0;flight.start("air");flight.camera.mode=2;flight._savedCamMode=2;flight.render(1,1/30)');
  for(const units of['aviation','mph','metric']){
   await run(`flight.units='${units}';flight.hud.setUnits('${units}');flight.render(1,1/30)`);await shot(`${id}-air-${units}`);
  }
  await run('flight.input.look.x=-.45;flight.input.look.y=-.75;flight.render(1,1/30)');await shot(`${id}-air-lower`);
  await run('flight.input.look.x=flight.input.look.y=0;flight.setNight(true);flight.render(1,1/30)');await shot(`${id}-night`);await run('flight.setNight(false)');
  await check('flight.aircraft.interior.instruments.surfaces.every(s=>s.count>0&&s.count<=24000)',`${id}: all panels update within their existing buffer budget`);
 }
 // Long numbers and warning line are included in the HUD fit check, not only idle values.
 await run('flight.switchAircraft("f22");flight.start("air");flight.units="aviation";flight.hud.setUnits("aviation");flight.camera.mode=2;flight._savedCamMode=2;flight.input.look.x=flight.input.look.y=0;flight.physics.reset({y:12000,speed:450,pitch:.04,gear:0,throttle:1});flight.debugDamage("engineL",.2);flight.step(1/120);flight.render(1,1/30)');await shot('f22-fast-high-warning');
 await check('flight.telemetry.height>30000&&flight.telemetry.warning==="Critical damage"','high-altitude HUD contains long numbers and damage warning');
 await run('flight.debugDamage("engineL",1);flight.camera.mode=1;flight._savedCamMode=1;flight.render(1,1/30)');await shot('f22-first-person');
 const bad=b.console.filter(l=>/^(error|warning|EXCEPTION)/i.test(l)&&!/vite/i.test(l));if(bad.length)throw Error(bad.join('\n'));
 console.log(`${checks} cockpit feedback browser checks passed, console clean; pictures ${out}`);
}finally{await b.close();}
