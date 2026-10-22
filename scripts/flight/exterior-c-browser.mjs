import {mkdirSync} from 'node:fs';
import {launch} from '../lib/browser.mjs';
const out=process.argv[3]||'/tmp/look-c-exterior';mkdirSync(out,{recursive:true});
const b=await launch({url:process.argv[2]||'http://localhost:5186',width:1440,height:900,port:9373});
try{
 await b.eval('game.onFly()');await b.eval('game.loop.stop();flight.start("air");flight.paused=true;flight.hud.hide();flight.mesh.root.visible=false;flight.aircraft.root.position.set(0,0,0);flight.aircraft.root.quaternion.identity();flight.aircraft.setInterior(false);flight.aircraft.interior.group.visible=false;game.scene.setOverlay(false);game.scene.scene.fog=null;0');
 for(const [name,pos]of[['front',[0,2,29]],['side',[29,2,0]],['top',[0,31,0]],['quarter',[20,12,24]],['rear',[0,4,-29]]]){
  await b.eval(`(()=>{const c=game.scene.camera;c.fov=46;c.near=.1;c.far=8000;c.position.set(...${JSON.stringify(pos)});c.up.set(0,${name==='top'?0:1},${name==='top'?-1:0});c.lookAt(0,0,0);c.updateProjectionMatrix();game.scene.render(1/60);})();0`);
  await b.shot(`${out}/f22-${name}.png`);
 }
 await b.eval('game.scene.camera.up.set(0,1,0);flight.mesh.root.visible=true;flight.start("runway");flight.camera.mode=2;flight._savedCamMode=2;flight.input._lookMouse=true;flight.input.look.x=flight.input.look.y=0;0');
 for(const fov of[78,110])for(const down of[0,-.4]){
  await b.eval(`flight.setFov(${fov});flight.input.look.y=${down};flight.render(1,1/30);0`);await b.shot(`${out}/f22-cockpit-${fov}-${down===0?'forward':'down'}.png`);
 }
 const bad=b.console.filter(l=>/^(error|warning|EXCEPTION)/i.test(l)&&!/vite/i.test(l));if(bad.length)throw Error(bad.join('\n'));
 console.log('9 F-22 exterior/cockpit pictures, clean console: '+out);
}finally{await b.close();}
