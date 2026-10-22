// The flight menus and the map's trip planner by real key presses and clicks in a real
// Chrome (an isolated profile, never your saves): the Fly menu and the pause card in their
// groups with numbered choices, the controls chart on its Flying tab, the map's two tabs,
// the trip laid out as lettered stops with the legs between them, the search box (typing
// spaces and letters, Up and Down through the results, Enter to add), the buttons on a
// stop, Start route, and the crash menu. Needs a dev server.
//
//   npm run dev                              (in another terminal)
//   node scripts/flight/menus-browser.mjs [url] [outdir]

import { mkdirSync } from 'node:fs';
import { launch } from '../lib/browser.mjs';
const out = process.argv[3] || '/tmp/look-flight-menus';
mkdirSync(out, { recursive: true });
const b = await launch({ url: process.argv[2] || 'http://localhost:5173', width: 1440, height: 900, port: 9431 });
let ok = 0, bad = 0;
const check = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); c ? ok++ : bad++; };
const q = (js) => b.eval(js);
const run = (js) => b.eval(`${js}; 0`);
const press = async (code, text) => { await b.send('Input.dispatchKeyEvent', { type: 'keyDown', code, key: text || code, text, windowsVirtualKeyCode: code === 'Space' ? 32 : (text || 'A').toUpperCase().charCodeAt(0) }); await b.send('Input.dispatchKeyEvent', { type: 'keyUp', code, key: text || code }); await b.sleep(60); };
const type = async (str) => { for (const ch of str) await press(ch === ' ' ? 'Space' : `Key${ch.toUpperCase()}`, ch); };
const texts = (sel) => q(`[...document.querySelectorAll('${sel}')].filter((e) => !e.closest('[hidden]')).map((e) => e.textContent.trim())`);
try {
  await b.sleep(2500);
  await b.eval('game.onFly()');
  await b.sleep(400);
  check(JSON.stringify(await texts('.fly-screen .race-section')) === '["Fly","Setup","General","Flying"]', 'the Fly menu is in four groups');
  const nos = await texts('.fly-screen .race-no');
  check(nos.filter(Boolean).join(',') === '01,02,03,04,05,06,07', 'its seven choices are numbered 01 to 07');
  check(await q('document.querySelector(".fly-screen .race-row.focused .race-row-label").textContent') === 'Start on the apron', 'the cursor starts on the first start');
  await run('flight.screens.card.hidden = true'); // the first flight already shows it
  await run('flight.screens.fly.menu.index = flight.screens.fly.menu.rows.findIndex((r) => r.label === "Controls"); flight.screens.fly.menu.paint()');
  await b.key('keyDown', 'Enter'); await b.key('keyUp', 'Enter'); await b.sleep(200);
  check(await q('!flight.screens.card.hidden && document.querySelector(".flight-controls .cc-tab.on").textContent') === 'Flying', 'Controls shows the chart on its Flying tab');
  check(await q('document.querySelectorAll(".flight-controls .cc-table tbody tr").length') > 15, 'with a row for each action');
  await b.shot(`${out}/fly-menu.png`);
  await b.key('keyDown', 'Escape'); await b.key('keyUp', 'Escape'); await b.sleep(150);
  check(await q('flight.screens.card.hidden && flight.screens.fly.visible'), 'Esc puts the chart away and keeps the menu');
  // in the air, then pause
  await b.eval('flight.go("air")'); await b.eval('game.loading.whenIdle().then(() => 0)'); await b.sleep(300);
  await run('flight.openPause()'); await b.sleep(300);
  check(JSON.stringify(await texts('.flight-pause-screen .race-section')) === '["Flight","General","Flying"]', 'the pause card is in three groups');
  check((await texts('.flight-pause-screen .race-no')).filter(Boolean).join(',') === '01,02,03,04,05', 'its five choices are numbered');
  await b.shot(`${out}/pause.png`);
  await run('flight.resume()');
  // the map
  await run('flight.openMap("play")'); await b.sleep(1500);
  const M = '.map-screen';
  check(JSON.stringify(await texts(`${M} .garage-tab`)) === '["Airports","Plan a trip"]', 'the map has two tabs');
  check(await q('!document.querySelector(".map-airports").hidden && document.querySelector(".map-planner").hidden'), 'it opens on Airports');
  await q('flight.screens.map.planToggle.click(); 0'); await b.sleep(300);
  check(await q('flight.screens.map.planning && !document.querySelector(".map-planner").hidden && document.querySelector(".map-airports").hidden'), 'a click on Plan a trip opens the planner');
  check(await q('document.querySelector(".mp-chip-name").textContent') === 'F-22 Raptor' && /kt$/.test(await q('document.querySelector(".mp-chip-speed").textContent')), 'it shows the aircraft and the speed it plans at');
  check(JSON.stringify(await texts('.mp-pin')) === '["A"]' && /No stops yet/.test(await q('document.querySelector(".mp-summary").textContent')), 'an empty trip is just A, your position');
  // the search box, by real key presses
  await run('flight.screens.map.searchEl.focus()');
  await type('red');
  check(await q('flight.screens.map.searchEl.value') === 'red' && await q('flight.screens.map.found.length') >= 1, 'typing in the search box finds places');
  check(/Redwater/.test(await q('document.querySelector(".mp-result .mp-name").textContent')), 'Redwater Airport is the first result');
  check(await q('flight.screens.map.visible'), 'and the m in it did not close the map');
  await b.send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'Enter', key: 'Enter', windowsVirtualKeyCode: 13 }); await b.send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'Enter', key: 'Enter' }); await b.sleep(150);
  check(await q('flight.route.trip.points.length') === 1 && await q('flight.route.trip.points[0].label') === 'Redwater Airport', 'Enter adds the first result as a stop');
  check(JSON.stringify(await texts('.mp-pin')) === '["A","B"]' && (await texts('.mp-leg')).length === 1, 'the trip is now A and B with one leg between them');
  check(/^\d/.test((await texts('.mp-leg'))[0]) && /min/.test((await texts('.mp-leg'))[0]), 'the leg gives its distance and its time');
  check(await q('flight.screens.map.searchEl.value') === '', 'the box is empty again');
  await run('flight.screens.map.searchEl.focus()');
  await type('pine r');
  check(await q('flight.screens.map.searchEl.value') === 'pine r', 'a space types as a space in the box');
  await press('ArrowDown'); await press('ArrowUp');
  // the race track of that name is nearer, so it is the first result; the airstrip is the second
  await q('[...document.querySelectorAll(".mp-result")].find((e) => /Airstrip/.test(e.textContent)).click(); 0'); await b.sleep(150);
  check(await q('flight.route.trip.points.map((p) => p.label).join("|")') === 'Redwater Airport|Pine Ridge Airstrip', 'a click on a result adds it too');
  check(JSON.stringify(await texts('.mp-pin')) === '["A","B","C"]' && /2 stops/.test(await q('document.querySelector(".mp-summary").textContent')), 'three stops and the summary says two');
  await q('document.querySelectorAll(".mp-stop")[2].querySelector(".mp-mini[title*=up]").click(); 0'); await b.sleep(150);
  check(await q('flight.route.trip.points[0].label') === 'Pine Ridge Airstrip', 'the stop\'s own up button moves it up');
  await q('document.querySelectorAll(".mp-stop")[1].querySelector(".mp-mini[title*=Remove]").click(); 0'); await b.sleep(150);
  check(await q('flight.route.trip.points.length') === 1, 'and its remove button takes it out');
  await b.shot(`${out}/planner.png`);
  await q('[...document.querySelectorAll(".map-planner button")].find((x) => x.textContent === "Start route").click(); 0'); await b.sleep(150);
  check(await q('flight.route.active'), 'Start route starts the guidance');
  check(await q('!!document.querySelector(".mp-stop.next")'), 'and the stop being flown to is marked');
  await run('flight.screens.map.close(); flight.resume()');
  // the crash menu
  await run('flight.debugDamage("fuselage",0); flight.step(1/120); flight.openCrash()'); await b.sleep(600);
  check(await q('flight.screens.map.visible && flight.screens.map.respawn && document.querySelector(".map-tabs").hidden'), 'the crash map has no planner tab');
  await q('flight.screens.map.close(); 0'); await b.sleep(300);
  check((await texts('.flight-pause-screen .race-no')).filter(Boolean).join(',') === '01,02', 'the crash menu\'s two choices are numbered');
  const errs = b.console.filter((l) => /^(error|warning|EXCEPTION)/i.test(l) && !/vite/i.test(l));
  check(errs.length === 0, 'the console is clean' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
} catch (e) { console.log('ERROR', e.message); bad++; } finally { console.log(`\n${ok} ok, ${bad} failed`); await b.close(); process.exit(bad ? 1 : 0); }
