// Saved FOV, real native slider/keyboard/pad paths and world/interior projection agreement.
import {mkdirSync} from 'node:fs';
import {launch} from '../lib/browser.mjs';
const url=process.argv[2]||'http://localhost:5185',out=process.argv[3]||'/tmp/look-flight-fov';
mkdirSync(out,{recursive:true});
const b=await launch({url,width:1440,height:900,port:9365});let count=0;
const run=s=>b.eval(`${s};0`),frame=()=>run('flight.render(1,1/30)');
const check=async(s,name)=>{if(!await b.eval(s))throw Error(name);count++;console.log('ok '+name);};
const shot=name=>b.shot(`${out}/${name}.png`);
try{
 await b.eval('game.onFly()');await run('game.loop.stop()');
 await check('flight.fov===78&&flight.screens.fly.el.querySelector("input.race-range")?.getAttribute("aria-label")==="Field of view"','Fly menu offers a native FOV slider with the cockpit default');
 await run('window.slider=flight.screens.fly.el.querySelector("input[type=range]");slider.scrollIntoView({block:"center"})');
 const rect=await b.eval('(()=>{const r=slider.getBoundingClientRect();return{x:r.x+r.width*.8,y:r.y+r.height/2}})()');
 await b.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,clickCount:1,...rect});
 await b.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,clickCount:1,...rect});await frame();
 await check('flight.fov>=95&&flight.fov<=105&&Number(slider.value)===flight.fov','mouse slider changes FOV without a second row-activation increment');
 await run('window.beforeFov=flight.fov');await b.key('keyDown','ArrowRight','ArrowRight');await b.key('keyUp','ArrowRight','ArrowRight');await frame();
 await check('flight.fov===beforeFov+1&&flight.screens.fly.menu.rows[flight.screens.fly.menu.index].label==="Field of view"','focused native slider changes exactly one degree by keyboard');
 await run('flight.screens.fly.menu.handlePad({left:true})');
 await check('flight.fov===beforeFov','gamepad menu adjustment changes the same saved setting');
 await run('flight.setFov(110);flight.screens.fly.repaint()');await shot('fly-slider');
 for(const id of['f22','b737']){
  await run(`flight.switchAircraft('${id}');flight.start('air');flight.camera.mode=2;flight._savedCamMode=2;flight.input.look.x=flight.input.look.y=0;flight.setFov(78);flight.render(1,1/30)`);await shot(`${id}-cockpit-78`);
  await run('flight.setFov(110);flight.render(1,1/30)');await shot(`${id}-cockpit-110`);
  await check('flight.camera.camera.fov===110&&flight.scene.overlayCamera.fov===110&&flight.camera.camera.projectionMatrix.equals(flight.scene.overlayCamera.projectionMatrix)===false',`${id}: world and physical cockpit use the same selected angle with their own near/far planes`);
  await run('window.projection=flight.camera.camera.projectionMatrix.elements[5];flight.physics.mach=1.2;flight.camera.punch=6;flight.render(1,1/30)');
  await check('flight.camera.camera.fov===110&&flight.camera.camera.projectionMatrix.elements[5]===projection',`${id}: Mach kick cannot exceed the slider maximum`);
  await run('flight.camera.punch=0;flight.setFov(96);window.oldPhysics=JSON.stringify([flight.physics.x,flight.physics.y,flight.physics.z,flight.physics.vx,flight.physics.vy,flight.physics.vz]);for(const mode of[0,1,2,3]){flight.camera.mode=mode;flight._savedCamMode=mode;flight.render(1,1/30);if(flight.camera.camera.fov!==96)throw Error("FOV lost on camera switch")}');
  await check('JSON.stringify([flight.physics.x,flight.physics.y,flight.physics.z,flight.physics.vx,flight.physics.vy,flight.physics.vz])===oldPhysics',`${id}: camera switches preserve FOV without moving the aircraft`);
  await run('flight.camera.mode=2;flight._savedCamMode=2;flight.openPause();flight.render(1,1/30)');
  await check('flight.screens.pause.el.querySelector("input[type=range]").value==="96"',`${id}: pause slider agrees with current camera and Fly setting`);
  await shot(`${id}-pause-slider`);await run('flight.resume()');
 }
 await run('flight.setFov(55);flight.render(1,1/30)');await check('flight.camera.camera.fov===55','minimum angle applies to the camera');
 await run('flight.setFov(900);flight.render(1,1/30)');await check('flight.fov===110','out-of-range values clamp safely');
 await run('flight.setFov(104)');await b.send('Page.reload');await b.sleep(1500);await b.eval('game.onFly()');await run('game.loop.stop();flight.start("air");flight.camera.mode=2;flight.render(1,1/30)');
 await check('flight.fov===104&&flight.camera.camera.fov===104','chosen angle survives page reload and aircraft restoration');
 await b.send('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});await run('flight.openPause();flight.screens.pause.el.querySelector("input[type=range]").focus();flight.render(1,1/30)');await shot('pause-1280x720');
 await check('(()=>{const el=flight.screens.pause.el.querySelector("input[type=range]"),r=el.getBoundingClientRect(),p=el.closest(".menu-panel").getBoundingClientRect();return r.left>=p.left&&r.right<=p.right&&r.top>=p.top&&r.bottom<=p.bottom})()','slider stays visible and inside the menu at 1280 by 720');
 await run('localStorage.setItem("racing-game.v1.flight.fov",JSON.stringify({bad:true}))');await b.send('Page.reload');await b.sleep(1500);await b.eval('game.onFly()');await run('game.loop.stop()');await check('flight.fov===78','malformed stored values recover to the default');
 await run('flight.exit();game.showTitle();window.volumeBefore=game.sound.volume;game.title.menu.index=game.title.menu.rows.findIndex(r=>r.label==="Volume");game.title.menu.handlePad({left:true})');
 await check('game.sound.volume<=volumeBefore&&!game.title.el.querySelector("input[type=range]")','existing car menu settings retain their ordinary stepper behavior');
 const bad=b.console.filter(l=>/^(error|warning|EXCEPTION)/i.test(l)&&!/vite/i.test(l));if(bad.length)throw Error(bad.join('\n'));
 console.log(`${count} FOV browser checks passed, console clean; pictures ${out}`);
}finally{await b.close();}
