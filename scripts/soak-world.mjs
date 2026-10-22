// Flies the real game for a while in a real Chrome (scripts/lib/browser.mjs) and
// reports how it went: frame pacing, what the world was doing, and any error the
// page logged. It is the test that a minute of flight at speed -- chunks
// streaming in, the origin rebasing, tracks building, AI cars going live -- does
// not hitch, as far as a headless Chrome can say (it has the GPU but not your
// display, so the frame times are a guide, not your fps).
//
//   npm run dev                                (in another terminal)
//   node scripts/soak-world.mjs [seconds] [speed m/s] [url]
//
// The aircraft is put 400 m above the land in the east of the map, heading west
// at the speed given (default 300 m/s) with the throttle open, and flown by a
// rough terrain-following pilot (the stick held toward 350 m above the highest
// ground in the next 4 km), so the world is seen fast and not too high, which is
// when it is hardest to stream. The page's frame intervals are recorded.

import { launch } from './lib/browser.mjs';

const seconds = +(process.argv[2] || 40);
const speed = +(process.argv[3] || 300);
const url = process.argv[4] || 'http://localhost:5173';

const b = await launch({ url, width: 1440, height: 900, port: 9346 });
let failed = false;
try {
  await b.eval('game.onFly()');
  await b.sleep(1500);
  // Heading east is 90 degrees (east is -x), so this flies toward -x.
  await b.eval(`(() => {
    flight.start('air');
    const p = flight.physics;
    p.reset({ x: 30000, y: flight.world.height(30000, -16000) + 400, z: -16000, heading: Math.PI / 2, pitch: 0, speed: ${speed}, fuel: 0.6, throttle: 0.7, gear: 0 });
    flight._primeWorld();
    // The terrain-following pilot, over the stick FlightInput reads.
    const inp = flight.input, orig = inp.poll.bind(inp);
    inp.poll = (dt) => {
      const s = orig(dt), q = flight.physics;
      let ground = 0;
      const dx = -Math.sin(flight.physics.attitude().heading) , dz = Math.cos(flight.physics.attitude().heading);
      for (let k = 0; k <= 8; k++) ground = Math.max(ground, flight.world.height(q.x + dx * 500 * k, q.z + dz * 500 * k));
      const want = ground + 350;
      s.pitch = Math.max(-0.6, Math.min(0.6, (want - q.y) * 0.004 - q.vy * 0.02));
      s.analog = true;
      s.roll = Math.max(-1, Math.min(1, -flight.physics.attitude().bank * 1.5));
      return s;
    };
    window.__t = []; window.__info = [];
    const loop = (t) => { window.__t.push(t); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    window.__timer = setInterval(() => {
      const i = flight.mesh.info(), q = flight.physics;
      window.__info.push({ ...i, x: Math.round(q.x), y: Math.round(q.y), z: Math.round(q.z), tas: Math.round(q.tas), crashed: q.crashed });
    }, 1000);
    return true;
  })()`);
  await b.sleep(seconds * 1000);
  const r = JSON.parse(await b.eval(`(() => {
    clearInterval(window.__timer);
    const t = window.__t, d = [];
    for (let i = 1; i < t.length; i++) d.push(t[i] - t[i - 1]);
    d.sort((a, c) => a - c);
    const pct = (p) => d[Math.min(d.length - 1, Math.floor(d.length * p))];
    return JSON.stringify({ frames: d.length, median: pct(0.5), p95: pct(0.95), p99: pct(0.99), max: d[d.length - 1],
      over25: d.filter((v) => v > 25).length, over50: d.filter((v) => v > 50).length, info: window.__info });
  })()`));
  console.log(`${r.frames} frames in ${seconds} s at ${speed} m/s: median ${r.median.toFixed(1)} ms, 95th ${r.p95.toFixed(1)}, 99th ${r.p99.toFixed(1)}, worst ${r.max.toFixed(0)}; ${r.over25} over 25 ms, ${r.over50} over 50 ms`);
  for (const i of r.info.filter((_, k) => k % 5 === 0)) {
    console.log(`  x ${String(i.x).padStart(7)} z ${String(i.z).padStart(7)} alt ${String(i.y).padStart(5)} tas ${i.tas}  chunks ${i.chunksDrawn}/${i.chunksCached}  tracks ${i.areasBuilt}  live cars ${i.carsLive}  rebases ${i.rebases}  jobs ${i.jobs}${i.crashed ? '  CRASHED' : ''}`);
  }
  await b.shot('/tmp/soak-world.png');
} catch (e) {
  console.error('soak failed:', e.message);
  failed = true;
}
const bad = b.console.filter((l) => /^(error|warning|EXCEPTION)/i.test(l) && !/vite/i.test(l));
if (bad.length) { console.error('The page logged:\n  ' + bad.join('\n  ')); failed = true; }
console.log(failed ? 'SOAK FAILED' : 'the console is clean');
await b.close();
process.exit(failed ? 1 : 0);
