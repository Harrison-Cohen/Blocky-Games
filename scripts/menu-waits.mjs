// How long each click leaves the screen waiting, in a real Chrome: the time until
// the game is ready again, the worst gap between two frames (a frozen screen), the
// long tasks on the main thread, and whether the loading panel showed and how
// opaque it got. A cold profile, so the first run of anything is a worst case.
//
//   npm run dev
//   node scripts/menu-waits.mjs [http://localhost:5173]
//
// Targets (MENU_REDESIGN_PLAN.md): no frame gap over 100 ms outside the panel,
// the panel shown for under a second, and a wait under MENU.loadingDelay shows
// no panel at all.

import { launch } from './lib/browser.mjs';

const game0 = (levels) => levels[Math.min(1, levels.length - 1)];
const b = await launch({ url: process.argv[2] || 'http://localhost:5173', width: 1440, height: 900, port: 9400 });
let bad = 0;
try {
  await b.sleep(2500);
  await b.eval(`(() => {
    window.__lt = [];
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push(+e.duration.toFixed(0)); }).observe({ type: 'longtask', buffered: false });
    window.__measure = (label, fn) => new Promise((resolve) => {
      window.__lt.length = 0;
      const panel = document.querySelector('.loading');
      const t0 = performance.now();
      let last = t0, maxGap = 0, calm = 0, peak = 0, shownMs = 0, started = false, ready = null;
      const tick = (t) => {
        const g = t - last; last = t;
        if (g > maxGap) maxGap = g;
        const o = panel.hidden ? 0 : +getComputedStyle(panel).opacity;
        if (o > peak) peak = o;
        if (o > 0.05) shownMs += g;
        if (g < 26) calm++; else calm = 0;
        if (started && ready === null) ready = t - t0;
        if (calm >= 12 || t - t0 > 25000) {
          resolve({ label, toReadyMs: +(ready ?? t - t0).toFixed(0), worstFrameGapMs: +maxGap.toFixed(0), panelPeak: +peak.toFixed(2), panelShownMs: +shownMs.toFixed(0), longTasks: window.__lt.slice() });
        } else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      Promise.resolve().then(fn).then(() => { started = true; }).catch((e) => resolve({ label, error: String(e).slice(0, 120) }));
    });
  })()`);
  const m = async (label, js) => {
    const r = await b.eval(`window.__measure(${JSON.stringify(label)}, async () => { ${js} })`, { timeout: 60000 });
    console.log(JSON.stringify(r));
    if (r.error || r.worstFrameGapMs > 100 && !r.panelPeak) bad++;
    await b.sleep(600);
  };
  const chassis = 'game.car.chassis';
  await m('car: time trial on a new track', `await game.startSession({ mode: 'trial', trackId: 'glacier-pass', chassisId: ${chassis}, trial: { pace: true, ghost: true } })`);
  await m('car: back to title', `game.leaveToTitle()`);
  await m('car: race (5 rivals)', `await game.startSession({ mode: 'race', trackId: 'harbor-nine', chassisId: ${chassis}, race: { laps: 1, opponents: 5, difficulty: 'club' } })`);
  await m('car: back to title', `game.leaveToTitle()`);
  await m('car: drag race', `await game.startSession({ mode: 'drag', trackId: 'drag-strip', chassisId: ${chassis}, drag: game.dragSettings })`);
  await m('car: back to title', `game.leaveToTitle()`);
  const levels = await b.eval(`import('/src/data/tuning.js').then((t) => t.GRAPHICS_LEVELS.map((l) => l.id))`);
  for (const id of [...levels, game0(levels)]) await m(`car: graphics ${id}`, `await game.changeGraphics(${JSON.stringify(id)})`);
  await m('car: open garage', `game.openGarage()`);
  await m('car: close garage', `game.closeGarage && game.closeGarage({ save: false })`);
  await m('car: track select', `game.openTrackSelect('race', 'Back', () => {})`);
  await m('FLY first time', `await game.onFly()`);
  for (const label of ['View distance', 'Detail', 'Time of day', 'Time of day']) {
    await m(`fly: ${label}`, `const row = flight.screens.fly.menu.rows.find((r) => r.label === ${JSON.stringify(label)}); row.step(1); await game.loading.whenIdle()`);
  }
  await m('fly: start on the apron', `await flight.go('apron')`);
  await m('fly: start airborne', `await flight.go('air')`);
  await m('fly: open map', `flight.openMap('pause')`);
  await m('fly: close map', `flight.screens.hideAll()`);
  await m('fly: open hangar', `flight.openHangar('fly')`);
  await m('fly: exit to the title', `flight.exit()`);
  await m('FLY second time', `await game.onFly()`);
  const errs = b.console.filter((l) => /^(error|warning|EXCEPTION)/i.test(l) && !/vite/i.test(l));
  console.log('console:', errs.length ? errs.slice(0, 5) : 'clean');
  if (errs.length) bad++;
} finally { await b.close(); }
process.exit(bad ? 1 : 0);
