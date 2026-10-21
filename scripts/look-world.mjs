// Looks at the open world the way a player does: a real Chrome (scripts/lib/
// browser.mjs) on the dev server's page, the aircraft put down in front of each
// place worth seeing, a screenshot of each, and a line of numbers about what was
// being drawn. It fails if the page logged an error or threw.
//
//   npm run dev                                (in another terminal)
//   node scripts/look-world.mjs [out-dir] [url] [only]
//
// Writes PNGs into out-dir (default /tmp/look-world): the runway, the home field
// from the air, each track area from the air and from beside its road, the airports
// (one of each tier, the apron, a hangar bay, the night, the map, the Hangar), the
// coast, the mountains, the high view, the pause card. `only` is a substring: only
// the shots whose name contains it are taken.
//
// It also measures z-fighting. Pavement is laid on a flat plateau a polygon offset
// above it, which is exact only if the two are coplanar and the offset wins at every
// distance; flicker is what failing looks like, so it takes the approach to a runway
// from low, from 3 km and from 10 km, renders twice with the camera a metre apart,
// and counts the sampled pavement pixels that changed a lot (against plain ground on
// the same plateau as the control). It fails if the pavement flickers more than the
// ground does.

import { mkdirSync } from 'node:fs';
import { launch } from './lib/browser.mjs';

const out = process.argv[2] || '/tmp/look-world';
const url = process.argv[3] || 'http://localhost:5173';
const only = process.argv[4] || '';
mkdirSync(out, { recursive: true });

const b = await launch({ url, width: 1440, height: 900, port: 9344 });
let failed = false;
const info = async () => JSON.parse(await b.eval('JSON.stringify(flight.mesh.info())'));
const settle = async (ms = 7000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    await b.sleep(250);
    const i = await info();
    if (i.pending === 0 && i.jobs === 0) return i;
  }
  return info();
};

// Put the aircraft `agl` metres above the ground at (x, z) facing a heading in
// degrees (0 north, 90 east), frozen, with the world built round it.
const place = (x, agl, z, headingDeg, speed = 120) => b.eval(`(() => {
  const f = flight;
  f.start('air');
  f.physics.reset({ x: ${x}, y: f.world.height(${x}, ${z}) + ${agl}, z: ${z}, heading: ${headingDeg} * Math.PI / 180, pitch: 0, speed: ${speed}, fuel: 0.6, throttle: 0.5, gear: 0 });
  f.paused = true;
  f.hud.hide();
  f.camera.reset();
  f._primeWorld();
  return true;
})()`);

// What a frame costs to draw right now: the time with the GPU drained, and the
// calls and triangles. (Headless Chrome at 1440 x 900: a guide, not the user's fps.)
const cost = async () => JSON.parse(await b.eval(`(() => {
  const sc = flight.scene, r = sc.renderer, gl = r.getContext();
  for (let i = 0; i < 5; i++) sc.render(1 / 60);
  gl.finish();
  r.info.autoReset = false; r.info.reset();
  const t0 = performance.now(), N = 20;
  for (let i = 0; i < N; i++) sc.render(1 / 60);
  gl.finish();
  const ms = (performance.now() - t0) / N;
  const out = { ms: +ms.toFixed(1), calls: Math.round(r.info.render.calls / N), tris: Math.round(r.info.render.triangles / N) };
  r.info.autoReset = true;
  return JSON.stringify(out);
})()`));

const shot = async (name, label = '') => {
  if (only && !name.includes(only)) return;
  const i = await settle();
  await b.sleep(400);
  await b.shot(`${out}/${name}.png`);
  const c = await cost();
  console.log(`${name.padEnd(24)} ${label.padEnd(26)} chunks ${String(i.chunksDrawn).padStart(3)}/${i.chunksCached}  tracks ${i.areasBuilt}  live cars ${i.carsLive}  ${c.calls} calls ${(c.tris / 1e6).toFixed(2)} M tris  ${c.ms} ms`);
};

try {
  await b.eval('game.onFly()');
  await b.sleep(1500);
  const areas = JSON.parse(await b.eval(`JSON.stringify(flight.world.areas.list.map((a) => {
    const t = a.track, i = t.startSample, w = { x: 0, z: 0 };
    a.toWorld(t.px[i], t.pz[i], w);
    return { id: a.id, biome: a.biome, x: a.x, z: a.z, startX: w.x, startZ: w.z, base: a.base, dy: a.dy, py: t.py[i] };
  }))`));
  const heading = (dx, dz) => (Math.atan2(-dx, dz) * 180) / Math.PI;

  // The home field.
  await b.eval('flight.start("runway"); flight.paused = true; flight.hud.hide();');
  await shot('01-runway', 'on the runway');
  await place(0, 400, -1800, 0, 150);
  await shot('02-home-air', 'over the home field');

  // Each track area: from a kilometre out, then low beside the road.
  let n = 3;
  for (const a of areas) {
    // From 1.4 km away, looking at the middle of the area, 300 m above its base.
    const hr = Math.PI * heading(a.startX - a.x, a.startZ - a.z) / 180;
    const px = a.x + Math.sin(hr) * 1400, pz = a.z - Math.cos(hr) * 1400;
    await place(px, 300, pz, heading(a.x - px, a.z - pz), 120);
    await shot(`${String(n).padStart(2, '0')}-${a.id}-air`, `${a.biome} from 1.4 km`);
    const fx = a.x + Math.sin(hr) * 5500, fz = a.z - Math.cos(hr) * 5500;
    await place(fx, 700, fz, heading(a.x - fx, a.z - fz), 200);
    await shot(`${String(n).padStart(2, '0')}-${a.id}-far`, `${a.biome} from 5.5 km`);
    // Low over the start line, along the road.
    await place(a.startX, 100, a.startZ, heading(a.x - a.startX, a.z - a.startZ), 90);
    await shot(`${String(n + 1).padStart(2, '0')}-${a.id}-low`, 'low over the start');
    n += 2;
  }

  // The AI cars, close: put the aircraft 100 m from one and a little above it. The
  // world is frozen while it is placed, so the car is where the replay or the live
  // physics left it.
  for (const id of ['copper-flats', 'harbor-nine']) {
    const a = areas.find((q) => q.id === id);
    if (!a || (only && !`cars-${id}`.includes(only))) continue;
    await place(a.startX, 100, a.startZ, 0, 90);
    await settle();
    const car = JSON.parse(await b.eval(`(() => {
      const st = flight.mesh.ambient.byArea.get('${id}');
      if (!st || !st.cars.length) return 'null';
      const c = st.cars[1] || st.cars[0], w = { x: 0, z: 0 };
      st.area.toWorld(c.physics.x, c.physics.z, w);
      return JSON.stringify({ x: w.x, z: w.z, live: c.live, name: c.spec.name, chassis: c.chassis.id });
    })()`));
    if (!car) { console.log(`cars-${id}: none ready`); continue; }
    // To the side, so the aircraft is not in the way: the car is left of its nose.
    await place(car.x + 100, 25, car.z + 55, 90, 60);
    await shot(`${n++}-cars-${id}`, `${car.name}'s ${car.chassis}, ${car.live ? 'live' : 'replayed'}`);
  }


  // The airports: one of each tier from the air, from the approach end.
  const apInfo = async (id) => JSON.parse(await b.eval(`JSON.stringify((() => { const a = flight.world.airports.byId.get('${id}'); return { x: a.x, z: a.z, base: a.base, h: a.heading, len: a.length, name: a.name }; })())`));
  const tiers = [['meridian-intl', 'major'], ['fort-falcon', 'air base'], ['pinecrest', 'regional'], ['strip-copper-flats', 'track airstrip'], ['skyline-heliport', 'heliport']];
  for (const [id, label] of tiers) {
    if (only && !`airport-${id}`.includes(only)) continue;
    // From the right of the runway, 1.3 km out and 400 m up, looking across its middle (left of the heading is minus 90 degrees on the compass).
    const a = await apInfo(id);
    const u = a.len * 0.4, v = -1300, cs = Math.cos(a.h), sn = Math.sin(a.h);
    await place(a.x + v * cs - u * sn, 400, a.z + u * cs + v * sn, (a.h * 180) / Math.PI - 90, 70);
    await shot(`${String(n++).padStart(2, '0')}-airport-${id}`, `${label}, from the side`);
  }
  // On the ground: the apron start, the hangar bay, the runway at the threshold.
  for (const [mode, id] of [['apron', 'meridian-intl'], ['hangar', 'meridian-intl'], ['apron', 'pinecrest'], ['runway', 'strip-copper-flats']]) {
    if (only && !`ground-${mode}-${id}`.includes(only)) continue;
    await b.eval(`(() => { const f = flight; f.start('${mode}', f.world.airports.byId.get('${id}')); f.paused = true; f.hud.hide(); f.camera.reset(); })()`);
    await shot(`${String(n++).padStart(2, '0')}-ground-${mode}-${id}`, `${mode} start, ${id}`);
  }
  // The night preview: the lamps.
  if (!only || 'night'.includes(only)) {
    const a = await apInfo('meridian-intl');
    await b.eval('flight.setNight(true)');
    await place(a.x + Math.sin(a.h) * 1200, 250, a.z - Math.cos(a.h) * 1200, (a.h * 180) / Math.PI, 70);
    await shot(`${String(n++).padStart(2, '0')}-night-approach`, 'the major airport at night');
    await place(a.x + 200, 3000, a.z - 6000, (a.h * 180) / Math.PI, 150);
    await shot(`${String(n++).padStart(2, '0')}-night-far`, 'its lights from 3 km up');
    await b.eval('flight.setNight(false)');
  }
  // The map, the radar and the Hangar.
  if (!only || 'map'.includes(only)) {
    await b.eval('flight.paused = false; flight.openMap("fly")');
    // The map is drawn a few milliseconds a frame; wait until it is whole.
    for (let i = 0; i < 180 && !(await b.eval('flight.screens.map._built')); i++) await b.sleep(500);
    await b.sleep(500);
    await b.shot(`${out}/${String(n++).padStart(2, '0')}-map.png`);
    await b.eval('flight.screens.map.close ? flight.screens.map.close() : flight.screens.hideAll(); flight.screens.hideAll(); flight.paused = true;');
  }
  if (!only || 'radar'.includes(only)) {
    await b.eval(`(() => { const f = flight; f.start('air'); f.hud.show(); f.paused = false; })()`);
    await b.sleep(2500);
    await b.shot(`${out}/${String(n++).padStart(2, '0')}-radar.png`);
    await b.eval('flight.paused = true; flight.hud.hide()');
  }
  if (!only || 'hangar'.includes(only)) {
    await b.eval('flight.paused = false; flight.openHangar("fly")');
    await b.sleep(1500);
    await b.eval(`(() => { const l = flight.hangar.setup.livery; Object.assign(l, { body: 'sky', accent: 'acid', pattern: 'tips', number: 4012, insignia: 'roundel' }); flight.hangar._repaint(); })()`);
    await b.sleep(900);
    await b.shot(`${out}/${String(n++).padStart(2, '0')}-hangar.png`);
    await b.eval('flight.hangar.close(false); flight.screens.hideAll(); flight.paused = true;');
  }

  // Z-fighting: the approach to a runway from low, from 3 km and from 10 km, hiding
  // the aircraft and everything on the airport but its pavement, rendered twice with
  // the camera a metre apart. The fraction of sampled pavement pixels that change a
  // lot is the flicker; plain ground on the same plateau is the control.
  if (!only || 'zfight'.includes(only)) {
    for (const id of ['meridian-intl', 'pinecrest']) {
      const a = await apInfo(id);
      for (const [d, h, tag] of [[700, 35, 'low'], [3000, 250, '3km'], [10000, 1000, '10km']]) {
        await place(a.x + Math.sin(a.h) * d, h, a.z - Math.cos(a.h) * d, (a.h * 180) / Math.PI, 70);
        await b.eval(`(() => { flight.aircraft.root.visible = false; const g = flight.mesh.airportViews.get('${id}').group; g.children.forEach((c, i) => { c.visible = i === 0; }); })()`);
        await settle();
        await b.sleep(500);
        const r = JSON.parse(await b.eval(`(() => {
          const f = flight, sc = f.scene, gl = sc.renderer.getContext(), cam = sc.camera, org = f.mesh.origin;
          const A = f.world.airports.byId.get('${id}'), L = A.layout, w = { x: 0, z: 0 }, pts = [];
          for (const p of L.pave) for (const [fu, fv] of [[0.2, 0.5], [0.5, 0.5], [0.8, 0.5], [0.5, 0.2], [0.5, 0.8]]) {
            A.toWorld(p.u0 + (p.u1 - p.u0) * fu, p.v0 + (p.v1 - p.v0) * fv, w);
            pts.push([w.x - org.ox, A.base, w.z - org.oz, 'pave']);
          }
          for (const fu of [0.15, 0.3, 0.45, 0.6, 0.75, 0.9]) for (const dv of [-60, -90, -120]) {
            A.toWorld(L.length * fu, dv, w);
            pts.push([w.x - org.ox, A.base, w.z - org.oz, 'ground']);
          }
          const grab = () => {
            f.render(1, 1 / 60);
            const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, buf = new Uint8Array(W * H * 4);
            gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
            return { buf, W, H };
          };
          const first = grab();
          cam.updateMatrixWorld();
          const proj = [];
          for (const [x, y, z, k] of pts) {
            const v = new cam.position.constructor(x, y, z).project(cam);
            if (v.z < -1 || v.z > 1 || Math.abs(v.x) > 0.95 || Math.abs(v.y) > 0.95) continue;
            proj.push([Math.round((v.x * 0.5 + 0.5) * first.W), Math.round((v.y * 0.5 + 0.5) * first.H), k]);
          }
          f.physics.x += 1;
          f.aircraft.updateVisual(1, 1 / 60, org.ox, org.oz);
          const second = grab(), stat = { pave: { n: 0, c: 0 }, ground: { n: 0, c: 0 } };
          for (const [px, py, k] of proj) for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
            const i = ((py + dy) * first.W + (px + dx)) * 4;
            if (i < 0 || i + 3 >= first.buf.length) continue;
            const q = Math.abs(first.buf[i] - second.buf[i]) + Math.abs(first.buf[i + 1] - second.buf[i + 1]) + Math.abs(first.buf[i + 2] - second.buf[i + 2]);
            stat[k].n++; if (q > 90) stat[k].c++;
          }
          const pct = (t) => (t.n ? +(100 * t.c / t.n).toFixed(2) : null);
          return JSON.stringify({ pave: pct(stat.pave), ground: pct(stat.ground), n: stat.pave.n });
        })()`));
        console.log(`zfight ${id.padEnd(14)} ${tag.padEnd(5)} pavement ${r.pave}% of ${r.n} sampled pixels changed (ground control ${r.ground}%)`);
        if (r.n && r.pave > (r.ground ?? 0) + 3) { console.error(`the pavement of ${id} flickers from ${tag}`); failed = true; }
      }
    }
  }

  // The coast, the mountains, the high view, the horizon.
  const coast = areas.find((a) => a.biome === 'coast');
  if (coast) { await place(coast.x, 500, coast.z - 5000, 0, 200); await shot(`${n++}-coast-view`, 'the coast from 700 m'); }
  const snow = areas.find((a) => a.biome === 'snow');
  if (snow) { await place(snow.x - 6000, 700, snow.z - 6000, heading(6000, 6000), 200); await shot(`${n++}-mountains`, 'toward the mountains'); }
  await place(0, 9000, 0, 0, 250);
  await shot(`${n++}-high`, 'from 9 km up');
  await place(0, 60, -1200, 0, 200);
  await shot(`${n++}-low-pass`, '60 m over the home field');

  // A rebase must be invisible. Let the frame settle (car meshes are built a frame
  // at a time, the eye adapts), draw it twice to see how much a frame differs from
  // itself, move the origin a kilometre and more, draw it again, and compare.
  if (!only || 'rebase'.includes(only)) {
    const tr = coast || areas[0];
    await place(tr.x, 250, tr.z - 1200, 0, 120);
    await settle();
    const diff = JSON.parse(await b.eval(`(() => {
      const f = flight, sc = f.scene, gl = sc.renderer.getContext();
      const grab = () => { f.render(1, 1 / 60); const px = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4); gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, px); return px; };
      for (let i = 0; i < 90; i++) f.render(1, 1 / 60);
      const compare = (a, c) => { let big = 0, sum = 0; for (let i = 0; i < a.length; i += 4) { const d = Math.max(Math.abs(a[i] - c[i]), Math.abs(a[i + 1] - c[i + 1]), Math.abs(a[i + 2] - c[i + 2])); sum += d; if (d > 3) big++; } return { big, mean: sum / (a.length / 4) }; };
      const a = grab(), same = grab();
      const o = f.mesh.origin, before = o.rebases;
      o.rebaseTo(o.ox + 1000, o.oz - 2000);
      const c = grab();
      return JSON.stringify({ rebased: o.rebases - before, pixels: a.length / 4, baseline: compare(a, same), moved: compare(same, c), origin: [o.ox, o.oz] });
    })()`));
    console.log(`rebase                   moved the origin ${diff.rebased} time, to ${diff.origin.join(', ')}: ${diff.moved.big} of ${diff.pixels} pixels differ by more than 3 levels (a frame against itself: ${diff.baseline.big}; mean difference ${diff.moved.mean.toFixed(4)} against ${diff.baseline.mean.toFixed(4)})`);
    // A real shift of the world would change every edge in the picture, several
    // per cent of it; what is left is the sun's shadow edges landing a texel
    // differently when the numbers they are made from change by a kilometre.
    if (diff.moved.big > diff.baseline.big + diff.pixels * 0.005) { console.error('a rebase changed the picture'); failed = true; }
  }

  // The pause card, with the view distance slider.
  await b.eval('flight.paused = false; flight.openPause();');
  await b.sleep(600);
  if (!only || 'pause'.includes(only)) await b.shot(`${out}/${n}-pause.png`);
  await b.eval('flight.resume(); flight.exit();');
} catch (e) {
  console.error('look failed:', e.message);
  failed = true;
}

const bad = b.console.filter((l) => /^(error|warning|EXCEPTION)/i.test(l) && !/vite/i.test(l));
if (bad.length) { console.error('The page logged:\n  ' + bad.join('\n  ')); failed = true; }
console.log(failed ? 'LOOK FAILED' : `looked: screenshots in ${out}, the console is clean`);
await b.close();
process.exit(failed ? 1 : 0);
