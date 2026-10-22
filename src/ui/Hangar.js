// The Hangar: switch aircraft, repair, paint, load and tune, and watch the result
// turn on a turntable while you do.
//
// It is built the way the Garage is (the same hard-edged panels, the same
// classes, one list of fields that the keyboard, a gamepad and the mouse all
// walk, Save and Discard pinned under it), and does for an aircraft what the
// Garage does for a car. Its list is in tabs (Aircraft, Repair, Paint, Livery,
// Loadout, Tuning) changed with Q and E, a pad's bumpers, a click, or Left and
// Right on the strip that Up from the first row lands on; a tab with nothing in it
// for this aircraft is left out. It is built in JS rather than in index.html so the car
// game's markup is untouched.
//
// What it edits is the aircraft's SETUP (data/loadouts.js): the livery, the
// loadout, the tuning and the damage. They are kept apart (core/HangarStore.js),
// and Save hands all four back. Nothing here reaches the physics; FlightGame
// applies the result.
//
// The preview is a real Aircraft, posed on its gear, repainted through the same
// buildAircraft the game flies, so there is no second description of what the
// aircraft looks like.

import { Aircraft } from '../flight/Aircraft.js';
import { Turntable } from './Turntable.js';
import { TabBar } from './Tabs.js';
import { hexToCss } from '../data/palette.js';
import { HANGAR } from '../data/tuning.js';
import {
  LIVERY_PAINTS, liveryOptions, TAIL_NUMBER_MAX, TAIL_NUMBER_DIGITS,
  hangarOptions, normalizeSetup, defaultTune, payloadMass,
} from '../data/loadouts.js';

const G = 9.80665;

const isDigitKey = (code) => /^(Digit|Numpad)[0-9]$/.test(code);
const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const clone = (o) => JSON.parse(JSON.stringify(o));

const TABS = [
  { id: 'aircraft', name: 'Aircraft' },
  { id: 'repair', name: 'Repair' },
  { id: 'paint', name: 'Paint' },
  { id: 'livery', name: 'Livery' },
  { id: 'loadout', name: 'Loadout' },
  { id: 'tuning', name: 'Tuning' },
];
const round = (v, places = 3) => Math.round(v * 10 ** places) / 10 ** places;

export class Hangar {
  constructor(uiRoot, renderer) {
    this.root = el('section', 'garage hangar');
    this.root.hidden = true;
    this.root.innerHTML = `
      <div class="garage-panel">
        <header class="garage-head">
          <h1>Hangar</h1>
          <p class="garage-sub">Each aircraft keeps its own paint, load and tuning.</p>
        </header>
        <div class="garage-tabs"></div>
        <ul class="garage-rows"></ul>
        <div class="garage-actions">
          <button type="button" class="garage-btn garage-btn-primary">Save aircraft</button>
          <button type="button" class="garage-btn">Discard changes</button>
          <button type="button" class="garage-btn" hidden>Keep editing</button>
        </div>
        <p class="garage-hint"></p>
      </div>
      <aside class="garage-card">
        <p class="garage-card-kicker"></p>
        <h2 class="garage-car-name"></h2>
        <p class="garage-car-blurb"></p>
        <dl class="garage-car-stats"></dl>
        <p class="garage-card-note"></p>
      </aside>`;
    uiRoot.append(this.root);
    const q = (s) => this.root.querySelector(s);
    this.panelEl = q('.garage-panel');
    this.cardEl = q('.garage-card');
    this.rowsEl = q('.garage-rows');
    this.hintEl = q('.garage-hint');
    this.nameEl = q('.garage-car-name');
    this.blurbEl = q('.garage-car-blurb');
    this.kickerEl = q('.garage-card-kicker');
    this.statsEl = q('.garage-car-stats');
    this.noteEl = q('.garage-card-note');
    this.actionsEl = q('.garage-actions');
    this.buttons = [...this.root.querySelectorAll('.garage-btn')];
    this.turntable = new Turntable(renderer);
    this.tabBar = new TabBar(q('.garage-tabs'), (i) => this._setTab(i, true));
    this.tabs = TABS;
    this.tabAt = 0;
    this.tab = TABS[0].id;
    this.tabFocus = false; // the focus is on the tab strip, not on a row

    this.visible = false;
    this.defs = [];
    this.def = null;
    this.setups = {};
    this.display = null;
    this.index = 0;
    this.button = 0;
    this.onClose = null;
    this._note = null;
    this._elapsed = 0;
    this._itemsFor = null;

    this.buttons.forEach((b, k) => b.addEventListener('click', () => {
      this._focus(this.fields.length - 1);
      this.button = k;
      this._activate();
    }));
    this._defaultHint = 'Up and down pick a setting, left and right change it. Enter repairs immediately. Q and E change tab. Esc discards paint, load and tuning.';
    this._onKeyDown = this._onKeyDown.bind(this);
  }

  get setup() { return this.setups[this.def.id]; }

  // --- the list ------------------------------------------------------------------

  _items() {
    const o = hangarOptions(this.def.id);
    return [
      { tab: 'aircraft', key: 'aircraft', label: 'Aircraft', kind: 'select' },
      ...o.damage.map((p) => ({ tab: 'repair', key: `damage.${p.id}`, label: p.name, kind: 'repair', part: p.id })),
      { tab: 'repair', key: 'repairAll', label: 'Repair everything', kind: 'link' },
      { tab: 'paint', key: 'body', label: 'Body', kind: 'swatch' },
      { tab: 'paint', key: 'accent', label: 'Accent', kind: 'swatch' },
      { tab: 'livery', key: 'pattern', label: 'Pattern', kind: 'select' },
      { tab: 'livery', key: 'number', label: 'Tail number', kind: 'number' },
      { tab: 'livery', key: 'insignia', label: 'Insignia', kind: 'select' },
      ...o.loadout.map((it) => ({ tab: 'loadout', key: `loadout.${it.id}`, label: it.name, kind: 'stepper', item: it })),
      ...o.tune.map((k) => ({ tab: 'tuning', key: `tune.${k.id}`, label: k.name, kind: 'stepper', knob: k })),
      { tab: 'tuning', key: 'stockTune', label: 'Put the tuning back to stock', kind: 'link' },
      { key: 'actions', kind: 'buttons' },
    ];
  }

  _buildRows() {
    this.items = this._items();
    this.fields = this.items.filter((it) => !it.section);
    // Only the tabs that have something on them for this aircraft.
    this.tabs = TABS.filter((t) => this.items.some((it) => it.tab === t.id));
    this.tabAt = Math.max(0, this.tabs.findIndex((t) => t.id === this.tab));
    this.tab = this.tabs[this.tabAt].id;
    this.tabBar.setTabs(this.tabs.map((t) => t.name));
    this.rowsEl.replaceChildren();
    this.rowEls = [];
    for (const it of this.items) {
      if (it.kind === 'buttons') { this.rowEls.push(this.actionsEl); continue; }
      const li = el('li');
      if (it.section) {
        li.className = 'garage-section';
        li.textContent = it.section;
        this.rowsEl.append(li);
        continue;
      }
      li.className = `garage-row garage-row-${it.kind}`;
      const label = el('span', 'garage-label', it.label);
      li.append(label);
      if (it.kind === 'select' || it.kind === 'stepper') {
        li.classList.add('hangar-stepper-row');
        const box = el('div', 'garage-field garage-stepper');
        const step = (d, sign, name) => {
          const b = el('button', 'garage-step', sign);
          b.type = 'button';
          b.tabIndex = -1;
          b.setAttribute('aria-label', `${name} ${it.label.toLowerCase()}`);
          b.addEventListener('click', (e) => { e.stopPropagation(); this._focus(this.fields.indexOf(it)); this._step(d); });
          return b;
        };
        const text = el('span', 'garage-value-text');
        box.append(step(-1, '−', 'Less'), text, step(1, '+', 'More'));
        li.append(box);
        li._text = text;
      } else if (it.kind === 'swatch') {
        li.classList.add('hangar-swatch-row');
        const name = el('small', 'hangar-paint-name');
        label.append(name);
        const box = el('div', 'garage-field hangar-swatches');
        const stockName = liveryOptions(this.def.id).stockName;
        li._sw = LIVERY_PAINTS.map((p) => {
          const b = el('button', 'garage-swatch');
          b.type = 'button';
          b.tabIndex = -1;
          const name = p.id === 'stock' ? stockName : p.name;
          b.title = name;
          b.style.background = hexToCss(p.hex);
          b.setAttribute('aria-label', name);
          b.addEventListener('click', (e) => { e.stopPropagation(); this._focus(this.fields.indexOf(it)); this._setKey(it.key, p.id); });
          box.append(b);
          return b;
        });
        li.append(box);
        li._name = name;
      } else if (it.kind === 'number') {
        const box = el('input', 'garage-input garage-number');
        box.type = 'text';
        box.inputMode = 'numeric';
        box.maxLength = TAIL_NUMBER_DIGITS;
        box.placeholder = 'None';
        box.autocomplete = 'off';
        box.spellcheck = false;
        box.setAttribute('aria-label', it.label);
        box.addEventListener('input', () => this._typedNumber());
        li.append(box);
        li._input = box;
        this.numberInput = box;
      } else if (it.kind === 'repair') {
        const box = el('div', 'garage-field hangar-repair');
        const bar = el('span', 'hangar-bar');
        const fill = el('i');
        bar.append(fill);
        const text = el('span', 'garage-value-text');
        box.append(bar, text);
        li.append(box);
        li._fill = fill;
        li._text = text;
      } else if (it.kind === 'link') {
        label.classList.add('garage-link');
      }
      li.addEventListener('click', (e) => this._click(it, e));
      this.rowsEl.append(li);
      this.rowEls.push(li);
    }
  }

  // --- values --------------------------------------------------------------------

  _options(key) {
    if (key === 'aircraft') return this.defs.map((d) => ({ id: d.id, name: d.name }));
    if (key === 'pattern') return liveryOptions(this.def.id).patterns;
    if (key === 'insignia') return liveryOptions(this.def.id).insignia;
    if (key === 'body' || key === 'accent') return LIVERY_PAINTS;
    return [];
  }

  _get(key) {
    if (key === 'aircraft') return this.def.id;
    return this.setup.livery[key];
  }

  _setKey(key, id) {
    if (key === 'aircraft') {
      if (id !== this.def.id) this._switch(this.defs.find((d) => d.id === id));
      return;
    }
    this.setup.livery[key] = id;
    this._repaint();
  }

  // The preview is built again from the livery, a few milliseconds once per change.
  _repaint() {
    this.display.setLivery(this.setup.livery);
    this._paint();
  }

  _switch(def) {
    this.def = def;
    this.statEls = null;
    this._buildRows();
    this._makeDisplay();
    this._focus(0);
    this._paint();
  }

  _makeDisplay() {
    if (this.display) this.display.dispose();
    const d = new Aircraft(this.def, this.setup.livery);
    // Stood on its wheels (the lowest tyre is this far below the centre of mass) and
    // turning about the middle of its length rather than its centre of mass.
    const stand = -Math.min(...this.def.gear.wheels.map((w) => w.pos[1]));
    const zs = this.def.gear.hull.map((h) => h.pos[2]);
    const middle = (Math.max(...zs) + Math.min(...zs)) / 2;
    d.physics.reset({ x: 0, y: stand, z: 0, heading: 0, gear: 1, throttle: 0 });
    d.updateVisual(1, 0, 0, middle);
    this.display = d;
    this.turntable.show(d.root, {
      span: Math.hypot(this.def.length, this.def.span),
      height: this.def.height,
    });
  }

  // The figures on the card, for the aircraft as set up: the same sums the physics
  // does, so what it says is what it flies at. A fighter's are thrust and wing loading; an
  // airliner's add the landing speed, and the mass says so when it is over the maximum.
  _figures() {
    const d = this.def, s = this.setup;
    const kg = (v) => `${Math.round(v).toLocaleString('en-US')} kg`;
    const hasAb = d.engines.some((e) => e.ab > e.dry);
    const mass = d.emptyMass + payloadMass(d, s.loadout) + d.fuelCapacity * HANGAR.startFuel;
    const thrust = d.engines.reduce((a, e) => a + e.ab, 0) * s.tune.power;
    const stockMass = d.emptyMass + d.payload + d.fuelCapacity * HANGAR.startFuel;
    const stockThrust = d.engines.reduce((a, e) => a + e.ab, 0);
    const airliner = d.role === 'airliner';
    const rows = [
      { label: 'Empty mass', v: d.emptyMass, stock: d.emptyMass, show: kg, ref: d.maxTakeoffMass },
      { label: `Mass, ${Math.round(HANGAR.startFuel * 100)}% fuel`, v: mass, stock: stockMass, show: kg, ref: d.maxTakeoffMass,
        over: mass > d.maxTakeoffMass * 1.0005 || (d.maxZeroFuelMass > 0 && d.emptyMass + payloadMass(d, s.loadout) > d.maxZeroFuelMass * 1.0005) },
      { label: hasAb ? 'Thrust, afterburner' : 'Thrust', v: thrust, stock: stockThrust, show: (v) => `${(v / 1000).toFixed(0)} kN`, ref: stockThrust * 1.25 },
      { label: 'Thrust to weight', v: thrust / (mass * G), stock: stockThrust / (stockMass * G), show: (v) => v.toFixed(2), ref: airliner ? 0.45 : 1.8 },
      { label: 'Wing loading', v: mass / d.refArea, stock: stockMass / d.refArea, show: (v) => `${Math.round(v)} kg/m²`, ref: d.maxTakeoffMass / d.refArea },
      { label: 'Load limit', v: d.gLimit, stock: d.gLimit, show: (v) => `${v} g`, ref: airliner ? 4 : 12 },
    ];
    // The approach speed scales with the square root of the mass (the lift is the weight).
    const v30 = d.figures && d.figures.vref30;
    if (v30) {
      const vref = (m) => v30.value * Math.sqrt(Math.min(m, d.maxLandingMass || m) / v30.mass);
      rows.splice(4, 0, { label: 'Landing speed, flaps 30', v: vref(mass), stock: vref(stockMass), show: (v) => `${Math.round(v)} kt`, ref: 190 });
    }
    return rows;
  }

  _paint() {
    const s = this.setup, o = hangarOptions(this.def.id);
    this.tabBar.mark(this.tabAt, this.tabFocus);
    this.fields.forEach((it, i) => {
      const li = this.rowEls[i];
      li.classList.toggle('focused', i === this.index && !this.tabFocus);
      if (it.kind !== 'buttons') li.hidden = !this._shown(it);
      if (it.kind === 'select') {
        const opt = this._options(it.key).find((x) => x.id === this._get(it.key));
        li._text.textContent = opt ? opt.name : '';
      } else if (it.kind === 'swatch') {
        const id = s.livery[it.key];
        li._sw.forEach((b, k) => b.classList.toggle('on', LIVERY_PAINTS[k].id === id));
        li._name.textContent = id === 'stock' ? liveryOptions(this.def.id).stockName : (LIVERY_PAINTS.find((p) => p.id === id)?.name ?? '');
      } else if (it.kind === 'number') {
        const text = s.livery.number == null ? '' : String(s.livery.number);
        if (document.activeElement !== li._input) li._input.value = text;
      } else if (it.kind === 'repair') {
        const h = s.damage[it.part];
        li._fill.style.width = `${Math.round(h * 100)}%`;
        li._fill.classList.toggle('worn', h < 0.999);
        li._text.textContent = h >= 0.999 ? 'Sound' : `${Math.round(h * 100)}%`;
        li.classList.toggle('stock', h >= 0.999);
      } else if (it.kind === 'link') {
        const stock = it.key === 'repairAll'
          ? o.damage.every((p) => s.damage[p.id] >= 0.999)
          : o.tune.every((k) => s.tune[k.id] === 1);
        li.classList.toggle('stock', stock);
      } else if (it.kind === 'stepper') {
        if (it.item) {
          const v = s.loadout[it.item.id];
          li._text.textContent = String(v);
          li.classList.toggle('tuned', v !== it.item.default);
        } else {
          const v = s.tune[it.knob.id];
          li._text.textContent = `${Math.round(v * 100)}%`;
          li.classList.toggle('tuned', v !== 1);
        }
      }
    });
    const onButtons = this.fields[this.index].kind === 'buttons' && !this.tabFocus;
    this.buttons.forEach((b, k) => b.classList.toggle('focused', onButtons && k === this.button));

    this.kickerEl.textContent = { fighter: 'Fighter', airliner: 'Airliner', helicopter: 'Helicopter' }[this.def.role] || 'Aircraft';
    this.nameEl.textContent = this.def.name;
    this.blurbEl.textContent = this.def.blurb;
    if (!this.statEls) {
      this.statsEl.replaceChildren();
      this.statEls = this._figures().map(() => {
        const row = el('div', 'garage-stat');
        const dt = el('dt');
        const dd = el('dd');
        const bar = el('span', 'garage-stat-bar');
        const fill = el('i');
        bar.append(fill);
        row.append(dt, dd, bar);
        this.statsEl.append(row);
        return { row, dt, dd, fill };
      });
    }
    this._figures().forEach((f, k) => {
      const e = this.statEls[k];
      e.dt.textContent = f.label;
      e.dd.textContent = f.show(f.v);
      e.row.classList.toggle('tuned', Math.abs(f.v - f.stock) > 1e-6 * Math.max(1, Math.abs(f.stock)));
      e.row.classList.toggle('over', !!f.over);
      e.fill.style.width = `${Math.min(100, Math.max(3, (100 * f.v) / f.ref)).toFixed(1)}%`;
    });
    this.noteEl.textContent = this.def.role === 'airliner'
      ? 'Highlighted figures differ from the aircraft as fitted. Passengers and cargo are weight. Over the maximum takeoff mass, or over the maximum zero fuel mass (what it weighs with empty tanks), the mass is shown in yellow: it still flies, but the runway it needs is no longer the one it was fitted to. Fuel is not refilled here.'
      : 'Highlighted figures differ from the aircraft as fitted. Missiles, rounds and flares are carried as weight; there is nothing to fire them with until the weapons arrive. Fuel is not refilled here.';
    this.hintEl.textContent = this._note ? this._note.text : this._defaultHint;
  }

  // --- moving and editing ---------------------------------------------------------

  _shown(it) { return it.kind === 'buttons' || it.tab === this.tab; }

  _focus(i) {
    i = (i + this.fields.length) % this.fields.length;
    const it = this.fields[i];
    if (!this._shown(it)) this._setTab(this.tabs.findIndex((t) => t.id === it.tab), false);
    this.tabFocus = false;
    this.index = i;
    if (this.fields[i].kind === 'number') {
      this.numberInput.focus({ preventScroll: true });
      this.numberInput.select();
    } else if (document.activeElement === this.numberInput) {
      this.numberInput.blur();
    }
    this.rowEls[i].scrollIntoView({ block: 'nearest' });
  }

  // The stops of the focus in this tab: the tab strip (-1), its rows, and the buttons,
  // in a ring.
  _move(d) {
    const stops = [-1];
    this.fields.forEach((it, i) => { if (this._shown(it)) stops.push(i); });
    const at = stops.indexOf(this.tabFocus ? -1 : this.index);
    const next = stops[(at + d + stops.length) % stops.length];
    if (next < 0) {
      if (document.activeElement === this.numberInput) this.numberInput.blur();
      this.tabFocus = true;
    } else this._focus(next);
    this._paint();
  }

  // Another tab, the focus on its first row (or kept on the strip).
  _setTab(t, onStrip = this.tabFocus) {
    t = (t + this.tabs.length) % this.tabs.length;
    if (document.activeElement === this.numberInput) this.numberInput.blur();
    this.tabAt = t;
    this.tab = this.tabs[t].id;
    this.index = this.fields.findIndex((it) => it.kind !== 'buttons' && this._shown(it));
    this.tabFocus = onStrip;
    this.rowsEl.scrollTop = 0;
    this._paint();
  }

  _step(d) {
    if (this.tabFocus) { this._setTab(this.tabAt + d, true); return; }
    const it = this.fields[this.index];
    const s = this.setup;
    if (it.kind === 'buttons') {
      const n = this.confirmSave ? 3 : 2;
      this.button = (this.button + d + n) % n;
    } else if (it.kind === 'select' || it.kind === 'swatch') {
      const opts = this._options(it.key);
      const at = opts.findIndex((o) => o.id === this._get(it.key));
      this._setKey(it.key, opts[(at + d + opts.length) % opts.length].id);
      return;
    } else if (it.kind === 'number') {
      const n = s.livery.number;
      s.livery.number = n == null ? (d > 0 ? 0 : null) : n + d < 0 ? null : Math.min(TAIL_NUMBER_MAX, n + d);
      this.numberInput.value = s.livery.number == null ? '' : String(s.livery.number);
      this._repaint();
      return;
    } else if (it.kind === 'stepper') {
      if (it.item) {
        s.loadout[it.item.id] = Math.min(it.item.max, Math.max(0, s.loadout[it.item.id] + d * it.item.step));
      } else {
        const cfg = HANGAR.tune[it.knob.id];
        s.tune[it.knob.id] = round(Math.min(cfg.max, Math.max(cfg.min, s.tune[it.knob.id] + d * cfg.step)));
      }
    }
    this._paint();
  }

  _typedNumber() {
    const box = this.numberInput;
    const digits = box.value.replace(/\D+/g, '').slice(0, TAIL_NUMBER_DIGITS);
    if (digits !== box.value) box.value = digits;
    this.setup.livery.number = digits ? Math.min(TAIL_NUMBER_MAX, Number(digits)) : null;
    this._repaint();
  }

  _repair(part) {
    const o = hangarOptions(this.def.id);
    const list = part ? [part] : o.damage.map((p) => p.id);
    let fixed = 0;
    for (const id of list) if (this.setup.damage[id] < 1) { this.setup.damage[id] = 1; fixed++; }
    if (fixed && this.onRepair) this.onRepair(this.def.id, this.setup.damage);
    this._say(fixed ? (part ? 'Repaired' : 'Everything repaired') : 'Nothing to repair');
  }

  _activate() {
    if (this.tabFocus) { this._move(1); this._paint(); return; }
    const it = this.fields[this.index];
    if (it.kind === 'buttons') {
      if (this.confirmSave) {
        if (this.button === 2) this._cancelDeparture();
        else this.close(this.button === 0, this.departure);
      } else if (this.departures) this._requestDeparture(this.button === 0 ? 'hangar' : 'runway');
      else this.close(this.button === 0);
    }
    else if (it.kind === 'repair') this._repair(it.part);
    else if (it.kind === 'link') {
      if (it.key === 'repairAll') this._repair(null);
      else {
        this.setup.tune = defaultTune(this.def.id);
        this._say('Tuning back to stock');
      }
    } else if (it.key === 'aircraft' && this.defs.length < 2) {
      this._say('There is only one aircraft so far');
    } else this._move(1);
    this._paint();
  }

  _click(it, e) {
    if (e.target.closest('button, input')) return;
    this._focus(this.fields.indexOf(it));
    if (it.kind === 'repair' || it.kind === 'link') this._activate();
    else this._paint();
  }

  // A short message in place of the hint.
  _say(text) {
    this._note = { text, until: this._elapsed + 2.4 };
    this._paint();
  }

  // --- open, close, input ----------------------------------------------------------

  // state: { defs, id, setups: { [id]: setup }, onClose(result) }. The result is
  // null for a discard, or { id, setups } for Save.
  open(state) {
    this.defs = state.defs;
    this.def = state.defs.find((d) => d.id === state.id) || state.defs[0];
    this.setups = {};
    for (const d of this.defs) this.setups[d.id] = normalizeSetup(d.id, clone(state.setups?.[d.id] || {}));
    this.onClose = state.onClose;
    this.departures = !!state.departures;
    this.confirmSave = false;
    this.departure = 'hangar';
    this._originalId = this.def.id;
    this._originalEdits = this._edits();
    this._departureButtons();
    this._defaultHint = this.departures
      ? 'Up and down pick a setting, left and right change it. Enter repairs immediately. Q and E change tab. Choose Leave hangar or Teleport to runway below; pending changes need Save or Discard.'
      : 'Up and down pick a setting, left and right change it. Enter repairs immediately. Q and E change tab. Esc discards paint, load and tuning.';
    this.onRepair = state.onRepair;
    this.visible = true;
    this.tab = TABS[0].id;
    this.tabFocus = false;
    this.index = 0;
    this.button = 0;
    this._note = null;
    this._elapsed = 0;
    this.statEls = null;
    this.root.hidden = false;
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    this._buildRows();
    this._makeDisplay();
    this._paint();
    this.rowsEl.scrollTop = 0;
    window.addEventListener('keydown', this._onKeyDown);
  }

  _edits() {
    return JSON.stringify(Object.fromEntries(Object.entries(this.setups).map(([id, s]) => [id, { livery: s.livery, loadout: s.loadout, tune: s.tune }])));
  }

  _departureButtons() {
    this.buttons[0].textContent = this.confirmSave ? 'Save changes and leave' : this.departures ? 'Leave hangar' : 'Save aircraft';
    this.buttons[1].textContent = this.confirmSave ? 'Discard changes and leave' : this.departures ? 'Teleport to runway' : 'Discard changes';
    this.buttons[2].hidden = !this.confirmSave;
  }

  _requestDeparture(mode) {
    this.departure = mode;
    if (this.def.id === this._originalId && this._edits() === this._originalEdits) this.close(false, mode);
    else {
      this.confirmSave = true;
      this.button = 0;
      this._departureButtons();
      this._focus(this.fields.length - 1);
      this._say(`Save or discard changes before ${mode === 'runway' ? 'moving to the runway' : 'leaving the hangar'}.`);
    }
  }

  _cancelDeparture() {
    this.confirmSave = false;
    this.button = 0;
    this._departureButtons();
    this._paint();
  }

  _back() {
    if (this.confirmSave) this._cancelDeparture();
    else if (this.departures) this._requestDeparture('hangar');
    else this.close(false);
  }

  close(save, departure = 'hangar') {
    if (!this.visible) return;
    this.visible = false;
    this.root.hidden = true;
    window.removeEventListener('keydown', this._onKeyDown);
    if (document.activeElement && this.root.contains(document.activeElement)) document.activeElement.blur();
    this.turntable.clear();
    if (this.display) { this.display.dispose(); this.display = null; }
    const result = save ? { id: this.def.id, setups: this.setups } : null;
    if (this.onClose) this.onClose(result, departure);
  }

  _onKeyDown(e) {
    if (!this.visible) return;
    const code = e.code;
    if (e.repeat && (code === 'Enter' || code === 'Space')) return;
    const is = (a, b) => code === a || code === b;
    // In the number box, digits and the editing keys type.
    if (document.activeElement === this.numberInput && (isDigitKey(code) || is('Backspace', 'Delete'))) return;
    if (is('ArrowUp', 'KeyW')) this._move(-1);
    else if (is('ArrowDown', 'KeyS')) this._move(1);
    else if (is('ArrowLeft', 'KeyA')) this._step(-1);
    else if (is('ArrowRight', 'KeyD')) this._step(1);
    else if (is('Enter', 'Space')) this._activate();
    else if (code === 'KeyQ') this._setTab(this.tabAt - 1);
    else if (code === 'KeyE') this._setTab(this.tabAt + 1);
    else if (code === 'Escape') this._back();
    else return;
    e.preventDefault();
  }

  // Gamepad edges, handed over by the game each frame.
  handlePad(menu) {
    if (!this.visible) return;
    if (menu.prev) this._setTab(this.tabAt - 1);
    if (menu.next) this._setTab(this.tabAt + 1);
    if (menu.up) this._move(-1);
    if (menu.down) this._move(1);
    if (menu.left) this._step(-1);
    if (menu.right) this._step(1);
    if (menu.confirm) this._activate();
    if (menu.back) this._back();
  }

  render(dt) {
    if (!this.visible) return;
    this._elapsed += dt;
    if (this._note && this._elapsed > this._note.until) {
      this._note = null;
      this._paint();
    }
    this.turntable.render(dt, this.panelEl, this.cardEl);
  }
}
