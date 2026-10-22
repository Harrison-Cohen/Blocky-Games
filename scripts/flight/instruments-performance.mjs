// Local headless Chrome, actual renderer at Medium/1080p. Report observations,
// not a guarantee of interactive flight performance or other graphics settings.
import {launch} from '../lib/browser.mjs';
const b=await launch({url:process.argv[2]||'http://localhost:5185',width:1920,height:1080,port:9360});
try{
 await b.eval('game.setGraphics("medium");game.onFly()');
 for(const id of ['f22','b737'])for(const mode of [0,2]){
  await b.eval(`flight.switchAircraft('${id}');flight.start('air');flight.camera.mode=${mode};flight._savedCamMode=${mode};flight.input.look.x=flight.input.look.y=0;flight.hudOn=true;flight.hud.show();flight.autopilot.engage(flight.physics);(()=>{const p=flight.physics;flight.route.edit(null,[{x:p.x-6000,z:p.z+8000,label:"Turn"},{x:p.x-12000,z:p.z+15000,label:"End"}]);flight.route.activate(p);flight.autopilot.followRoute(flight.route);})();0`);
  await b.sleep(4000);
  const result=await b.eval(`new Promise(resolve=>{
   const old=game.loop.render,frames=[],cpu=[],end=performance.now()+8000;
   game.loop.render=(a,dt)=>{
    const t=performance.now();old(a,dt);cpu.push(performance.now()-t);frames.push(dt*1000);
    if(performance.now()>=end){
     game.loop.render=old;frames.sort((a,b)=>a-b);cpu.sort((a,b)=>a-b);
     const gl=game.scene.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
     const panels=flight.aircraft.interior.instruments,paint=[];
     for(let i=0;i<100;i++){panels.elapsed=Infinity;const p=performance.now();panels.update(flight.telemetry,1/30);paint.push(performance.now()-p);}paint.sort((a,b)=>a-b);
     resolve({aircraft:'${id}',camera:${mode},graphics:game.graphicsLevel,canvas:[gl.drawingBufferWidth,gl.drawingBufferHeight],renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),frames:frames.length,
      frameMedianMs:frames[Math.floor(frames.length*.5)],frameP95Ms:frames[Math.floor(frames.length*.95)],renderCpuMedianMs:cpu[Math.floor(cpu.length*.5)],renderCpuP95Ms:cpu[Math.floor(cpu.length*.95)],
      physicalBatchMedianMs:paint[50],physicalBatchP95Ms:paint[95],displayVertices:panels.surfaces.reduce((n,s)=>n+s.count,0),displayCapacity:panels.surfaces.reduce((n,s)=>n+s.positions.byteLength+s.colors.byteLength,0),crashed:flight.physics.crashed});
    }
   };
  })`);
  console.log(JSON.stringify(result));
 }
 const bad=b.console.filter(l=>/^(error|warning|EXCEPTION)/i.test(l)&&!/vite/i.test(l));if(bad.length)throw new Error(bad.join('\n'));
 console.log('Performance capture console clean');
}finally{await b.close();}
