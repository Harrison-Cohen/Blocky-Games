// The car game's menus driven with real key events in a real Chrome (an isolated
// profile, never your saves): the title's groups, numbers and pointer, the Controls
// chart and its tabs, the General settings, track select as a table, pause, and a
// clean console. Needs a dev server.
//
//   npm run dev                              (in another terminal)
//   node scripts/menu-browser.mjs [url]

import { launch } from './lib/browser.mjs';
const b = await launch({ url: process.argv[2] || 'http://localhost:5173', width: 1440, height: 900, port: 9404 });
let ok = 0, bad = 0;
const check = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); c ? ok++ : bad++; };
const press = async (code) => { await b.key('keyDown', code); await b.key('keyUp', code); await b.sleep(120); };
const q = (js) => b.eval(js);
try {
  await b.sleep(2500);
  check(await q('game.screen') === 'title', 'the game opens on the title');
  check(await q('document.querySelectorAll(".title-screen .race-row.focused .race-row-label")[0].textContent') === 'Time trial', 'the cursor starts on Time trial');
  check(await q('document.querySelector(".title-screen .race-row.focused .race-ptr").textContent') === '>', 'the focused line has the > pointer');
  check(JSON.stringify(await q('[...document.querySelectorAll(".title-screen .race-no")].map(e=>e.textContent).filter(Boolean)')) === '["01","02","03","04","05","06"]', 'six choices are numbered 01 to 06');
  check(await q('[...document.querySelectorAll(".title-screen .race-section")].map(e=>e.textContent).join(",")') === 'Play,Setup,General', 'the groups are Play, Setup, General');
  for (let i = 0; i < 5; i++) await press('ArrowDown');
  check(await q('document.querySelector(".title-screen .race-row.focused .race-row-label").textContent') === 'Controls', 'down five times lands on Controls (headings are skipped)');
  // A first launch already shows the chart beside the title; Enter toggles it.
  await press('Enter');
  if (await q('document.querySelector(".controls-card").hidden')) await press('Enter');
  check(await q('!document.querySelector(".controls-card").hidden'), 'Enter on Controls shows the chart');
  const tabNow = await q('game.controlsChart.tab');
  await press('ArrowRight');
  check(await q('game.controlsChart.tab') !== tabNow, 'Right on the Controls row flips the chart tab');
  await press('ArrowLeft');
  check(await q('game.controlsChart.tab') === tabNow, 'Left flips it back');
  await press('Escape');
  check(await q('document.querySelector(".controls-card").hidden') === true, 'Esc puts the chart away');
  await press('ArrowDown');
  check(await q('document.querySelector(".title-screen .race-row.focused .race-row-label").textContent') === 'Volume', 'down from Controls lands on Volume');
  const v0 = await q('game.sound.volume');
  await press('ArrowLeft');
  check(await q('game.sound.volume') < v0, 'Left on Volume lowers it');
  await press('ArrowRight'); await press('ArrowDown');
  check(await q('document.querySelector(".title-screen .race-row.focused .race-row-label").textContent') === 'Graphics', 'down lands on Graphics');
  const g0 = await q('game.graphicsLevel');
  await press('ArrowLeft'); await b.sleep(400);
  check(await q('game.graphicsLevel') !== g0, 'Left on Graphics changes the level');
  await press('ArrowRight'); await b.sleep(400);
  check(await q('game.graphicsLevel') === g0, 'Right puts it back');
  // track select by keyboard
  await press('ArrowUp'); await press('ArrowUp'); await press('ArrowUp'); await press('ArrowUp'); await press('ArrowUp'); await press('ArrowUp'); await press('ArrowUp'); // back to the top
  check(await q('document.querySelector(".title-screen .race-row.focused .race-row-label").textContent') === 'Time trial', 'up wraps back to the top');
  await press('ArrowDown'); await press('Enter'); await b.sleep(500);
  check(await q('game.screen') === 'tracks', 'Enter on Race opens track select');
  check(await q('document.querySelectorAll(".ts-track").length') === 5, 'five circuits are listed as a table');
  check(await q('document.querySelector(".ts-head .race-row-label").textContent') === 'Track', 'the table has its header line');
  await press('ArrowDown');
  check(await q('document.querySelector(".ts-name").textContent') === 'Harbor Nine', 'moving down picks the next track and updates the card');
  check(await q('document.querySelectorAll(".ts-bests li").length') === 7, 'the best laps chart lists all seven cars');
  await press('Escape'); await b.sleep(400);
  check(await q('game.screen') === 'title', 'Esc goes back to the title');
  // pause
  await press('Enter'); await b.sleep(400); // Time trial -> track select
  await press('ArrowDown'); // not needed; pick start row by keyboard
  await q('game.startSession({ mode: "trial", trackId: "copper-flats", chassisId: game.car.chassis, trial: { pace: true, ghost: true } }); 0');
  await b.sleep(900);
  await press('Escape'); await b.sleep(400);
  check(await q('game.screen') === 'pause', 'Esc pauses');
  check(await q('[...document.querySelectorAll(".pause-screen .race-no")].map(e=>e.textContent).filter(Boolean).join(",")') === '01,02,03,04,05', 'pause choices are numbered');
  check(await q('!document.querySelector(".controls-card").hidden && game.controlsChart.tab') === 'driving', 'pause shows the driving controls chart');
  await press('Escape'); await b.sleep(300);
  check(await q('game.screen') === null, 'Esc resumes');
  // loading: a click is answered at once, the keys do nothing while the panel is up,
  // and the game comes back running
  await q('game.leaveToTitle(); 0'); await b.sleep(500);
  await q('game.showTitle(3); 0'); await b.sleep(200);
  await press('Enter');
  check(await q('game.loading.busy') === true, 'Enter on Fly raises the loading panel on the same frame');
  check(await q('!document.querySelector(".loading").hidden'), 'the panel is in the page');
  await b.key('keyDown', 'Escape'); await b.key('keyUp', 'Escape');
  await b.sleep(2500);
  check(await q('flight.active === true && game.loading.busy === false'), 'Esc while loading did nothing; flight is up and the panel is down');
  check(await q('document.querySelector(".loading").hidden'), 'the panel is hidden afterwards');
  check(await q('game.loop.running'), 'the loop is running again');
  check(await q('!flight.screens.fly.el.hidden'), 'the Fly menu is up');
  await q('flight.exit(); 0'); await b.sleep(500);
  check(await q('game.screen') === 'title', 'leaving flight returns to the title');
  // a session started from track select by keyboard: loading, then the race
  await q('game.showTitle(1); 0'); await b.sleep(200);
  await press('Enter'); await b.sleep(400);
  await press('ArrowDown'); // the next track
  for (let i = 0; i < 30 && !(await q('!!document.querySelector(".track-select .race-row.focused.primary")')); i++) await press('ArrowDown');
  check(await q('!!document.querySelector(".track-select .race-row.focused.primary")'), 'the cursor reaches the Start button');
  const picked = await q('document.querySelector(".ts-name").textContent'); // the track the card shows is the one that starts
  await press('Enter');
  check(await q('game.loading.busy') === true, 'Enter on Start raises the loading panel');
  await q('game.loading.whenIdle().then(() => 0)');
  check(await q('!!game.race') && await q('game.track.data.name') === picked && await q('game.screen') === null, 'the race starts on the chosen track and the screens are gone');
  await b.sleep(400);
  check(await q('game.loop.running && document.querySelector(".loading").hidden'), 'the loop runs and the panel is down');
  const bad2 = b.console.filter((l) => /^(error|warning|EXCEPTION)/i.test(l) && !/vite/i.test(l));
  check(bad2.length === 0, 'the console is clean' + (bad2.length ? ': ' + bad2.slice(0, 3).join(' | ') : ''));
} finally { console.log(`\n${ok} ok, ${bad} failed`); await b.close(); process.exit(bad ? 1 : 0); }
