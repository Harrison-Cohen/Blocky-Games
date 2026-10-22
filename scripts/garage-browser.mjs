// The Garage and the Hangar's tabs driven with real key presses and clicks in a real
// Chrome (an isolated profile, never your saves): the tab strip, Q and E, Up and
// Down through the rows and onto the strip, Left and Right on the strip, the Stats
// table that picks a car, a dropdown still opening on a tab, Save returning the
// car, the Hangar's tabs, and a clean console. Needs a dev server.
//
//   npm run dev                              (in another terminal)
//   node scripts/garage-browser.mjs [url]

import { launch } from './lib/browser.mjs';
const b = await launch({ url: process.argv[2] || 'http://localhost:5173', width: 1440, height: 900, port: 9420 });
let ok = 0, bad = 0;
const check = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); c ? ok++ : bad++; };
const press = async (code) => { await b.key('keyDown', code); await b.key('keyUp', code); await b.sleep(90); };
const q = (js) => b.eval(js);
const shown = (root) => q(`[...document.querySelectorAll('${root} .garage-row')].filter((e) => !e.hidden).map((e) => e.querySelector('.garage-label').textContent.replace(/\\s+/g, ' ').trim())`);
const tab = (root) => q(`document.querySelector('${root} .garage-tab.on').textContent`);
const focused = (root) => q(`(document.querySelector('${root} .garage-row.focused .garage-label') || document.querySelector('${root} .garage-btn.focused') || {}).textContent || (document.querySelector('${root} .garage-tabs.focused') ? '[tabs]' : '')`);
try {
  await b.sleep(2500);
  await q('game.openGarage(() => {}); 0'); await b.sleep(500);
  const G = '.garage:not(.hangar)';
  check(JSON.stringify(await q(`[...document.querySelectorAll('${G} .garage-tab')].map((e) => e.textContent)`)) === '["Car","Paint","Parts","Gearbox","Stats"]', 'the Garage has five tabs');
  check(await tab(G) === 'Car', 'it opens on the Car tab');
  check(await focused(G) === 'Chassis', 'with the cursor on Chassis');
  check(JSON.stringify(await shown(G)) === '["Chassis","Speedometer","Graphics"]', 'the Car tab shows only its three rows');
  await press('KeyE');
  check(await tab(G) === 'Paint' && (await shown(G)).length === 5, 'E opens the Paint tab with its five rows');
  check(await focused(G) === 'Preset', 'the cursor is on its first row');
  await press('KeyE'); await press('KeyE'); await press('KeyE');
  check(await tab(G) === 'Stats', 'E three more times reaches Stats');
  await press('KeyE');
  check(await tab(G) === 'Car', 'E wraps round to Car');
  await press('KeyQ');
  check(await tab(G) === 'Stats', 'Q wraps back to Stats');
  await press('KeyQ'); await press('KeyQ'); await press('KeyQ'); await press('KeyQ'); // Car
  // the strip
  await press('ArrowUp');
  check(await focused(G) === '[tabs]', 'Up from the first row lands on the tab strip');
  await press('ArrowRight');
  check(await tab(G) === 'Paint', 'Right on the strip changes tab');
  await press('ArrowLeft'); await press('ArrowLeft');
  check(await tab(G) === 'Stats', 'Left on the strip wraps');
  await press('ArrowRight');
  await press('ArrowDown');
  check(await focused(G) === 'Chassis', 'Down from the strip goes into the first row');
  await press('ArrowUp'); await press('ArrowUp');
  check(await focused(G) === 'Save car', 'Up from the strip wraps to the buttons');
  await press('ArrowDown');
  check(await focused(G) === '[tabs]', 'Down from the buttons lands on the strip');
  await press('ArrowDown');
  // a dropdown on a tab
  await press('Enter');
  check(await q(`!!game.garage.list`), 'Enter on Chassis opens its dropdown');
  await press('Escape');
  check(await q(`!game.garage.list && game.garage.visible`), 'Esc closes it, not the garage');
  // paint tab, stepping a colour changes the car
  await press('KeyE'); await press('ArrowDown');
  const p0 = await q('game.garage.car.primary');
  await press('ArrowRight');
  check(await q('game.garage.car.primary') !== p0, 'Right on Primary changes the paint');
  await press('ArrowLeft');
  // parts tab, the number box
  await press('KeyE');
  check(JSON.stringify(await shown(G)) === '["Livery","Wheel style","Spoiler","Roof item","Headlights","Driver number"]', 'the Parts tab shows its six rows');
  // gearbox tab
  await press('KeyE');
  const gb = await shown(G);
  check(gb[0] === 'Gearbox' && gb.includes('Final drive') && gb.includes('First gear runs to') && gb.at(-1).startsWith('Put the gearbox'), 'the Gearbox tab holds the mode, the tune and the reset');
  // stats
  await press('KeyE');
  check(await tab(G) === 'Stats' && (await shown(G)).length === 7, 'the Stats tab lists all seven cars');
  check(await q('document.querySelectorAll(".garage-carval.best").length') >= 6, 'the best of each column is marked');
  const id0 = await q('game.garage.chassisId');
  await press('ArrowDown');
  const id1 = await q('game.garage.chassisId');
  check(id1 !== id0 && await q('document.querySelector(".garage-car-name").textContent') === await q('game.garage.chassis.name'), 'Down on the Stats table picks the next car and the card follows');
  await press('ArrowDown');
  check(await q('game.garage.chassisId') !== id1, 'and the next');
  await q('document.querySelectorAll(".garage-row-carrow")[0].click(); 0'); await b.sleep(100);
  check(await q('game.garage.chassisId') === id0, 'a click on a row picks that car');
  // mouse on tabs
  await q('document.querySelectorAll(".garage:not(.hangar) .garage-tab")[1].click(); 0'); await b.sleep(100);
  check(await tab(G) === 'Paint' && await focused(G) === '[tabs]', 'a click on a tab opens it with the focus on the strip');
  // pad edges
  await q('game.garage.handlePad({ next: true }); 0');
  check(await tab(G) === 'Parts', 'the pad\'s right bumper changes tab');
  await q('game.garage.handlePad({ prev: true }); game.garage.handlePad({ prev: true }); 0');
  check(await tab(G) === 'Car', 'and the left bumper');
  // save
  let saved = null;
  await q('window.__saved = null; game.garage.onClose = (r) => { window.__saved = r; }; 0');
  await press('ArrowUp'); // the strip, so Up lands on the buttons
  await press('Enter');
  saved = await q('window.__saved && { chassis: window.__saved.chassis, has: !!window.__saved.cars }');
  check(saved && saved.has && !await q('game.garage.visible'), 'Save car returns the cars and closes');
  // the Hangar
  await q('game.onFly()'); await b.sleep(300);
  await q('flight.openHangar("fly"); 0'); await b.sleep(500);
  const H = '.hangar';
  check(JSON.stringify(await q(`[...document.querySelectorAll('${H} .garage-tab')].map((e) => e.textContent)`)) === '["Aircraft","Repair","Paint","Livery","Loadout","Tuning"]', 'the Hangar has six tabs');
  check(await tab(H) === 'Aircraft' && JSON.stringify(await shown(H)) === '["Aircraft"]', 'it opens on Aircraft with one row');
  await press('KeyE');
  check(await tab(H) === 'Repair' && (await shown(H)).length === 8, 'E opens Repair: seven parts and Repair everything');
  await press('KeyE'); await press('KeyE'); await press('KeyE');
  check(await tab(H) === 'Loadout' && (await shown(H)).length >= 1, 'Loadout holds its steppers');
  await press('KeyE');
  check(await tab(H) === 'Tuning' && (await shown(H)).at(-1).startsWith('Put the tuning'), 'Tuning ends with the reset');
  await press('ArrowUp');
  check(await focused(H) === '[tabs]', 'Up from the first row lands on the Hangar strip');
  await press('ArrowLeft');
  check(await tab(H) === 'Loadout', 'Left on the strip changes tab');
  await q('flight.hangar._focus(flight.hangar.fields.findIndex((f) => f.key === "body")); 0');
  check(await tab(H) === 'Paint', 'focusing a field on another tab opens that tab');
  await q('flight.hangar.handlePad({ next: true }); 0');
  check(await tab(H) === 'Livery', 'the right bumper changes the Hangar tab');
  await q('flight.hangar._focus(flight.hangar.fields.length - 1); flight.hangar._paint(); 0');
  check((await focused(H)) === 'Save aircraft', 'the Save button is always reachable');
  const errs = b.console.filter((l) => /^(error|warning|EXCEPTION)/i.test(l) && !/vite/i.test(l));
  check(errs.length === 0, 'the console is clean' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
} catch (e) { console.log('ERROR', e.message); bad++; } finally { console.log(`\n${ok} ok, ${bad} failed`); await b.close(); process.exit(bad ? 1 : 0); }
