// Local headless Chrome measurement, not a substitute for the user's interactive flight test.
import { launch } from '../lib/browser.mjs';
const b = await launch({ url: process.argv[2] || 'http://localhost:5173', width: 1920, height: 1080, port: 9347 });
try {
  await b.eval('game.setGraphics("medium"); game.onFly()');
  for (const damaged of [false, true]) {
    await b.eval(`flight.start('air'); ${damaged ? "flight.debugDamage('engineL',0.2);flight.debugDamage('fuselage',0.2);" : ''} 0`);
    await b.sleep(4000);
    const result = await b.eval(`new Promise(resolve => {
      const old = game.loop.render, rows=[], until=performance.now()+10000;
      game.loop.render = (alpha,dt) => {
        old(alpha,dt); rows.push(dt*1000);
        if(performance.now()>=until) {
          game.loop.render=old; rows.sort((a,b)=>a-b);
          const gl=game.scene.renderer.getContext(), ext=gl.getExtension('WEBGL_debug_renderer_info');
          resolve({ damaged:${damaged}, frames:rows.length, medianMs:rows[Math.floor(rows.length*.5)], p95Ms:rows[Math.floor(rows.length*.95)],
            graphics:game.graphicsLevel, canvas:[game.scene.renderer.domElement.width,game.scene.renderer.domElement.height], renderScale:game.scene.renderScale,
            particles:flight.damageEffects.pool.alive, crashed:flight.physics.crashed, renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER) });
        }
      };
    })`);
    console.log(JSON.stringify(result));
  }
} finally { await b.close(); }
