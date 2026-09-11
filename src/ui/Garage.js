// The garage: pick a chassis, paint it, and watch the result turn on a
// turntable while you do.
//
// The preview is the real car. It is built by the same `buildCar` the game
// drives, from the same config object that gets saved, so there is no second
// description of what a car looks like that could drift out of step with the
// first. Changing a setting rebuilds the mesh -- a few milliseconds, once per
// change, and nothing is cached that could go stale.
//
// It renders into the game's own canvas with its own scene and camera, so the
// track keeps existing behind it and closing the garage is instant.
//
// Every chassis keeps its own car. Picking a chassis here brings up that car's
// paint and parts; Save car writes all five, and the dashboard settings, at
// once. Colour presets are a library rather than a setting, so saving or
// deleting one takes effect straight away.
//
// Navigation is one list of fields. Up and down move between them. Enter (A on
// a pad) opens a field's dropdown, where up and down preview each option live
// and Enter takes it; left and right step a closed field straight through its
// options. The driver number is a real text box. The two buttons share the
// last row, with left and right between them. All of it works from the
// keyboard or a gamepad without a cursor, and the mouse works on all of it too.

import * as THREE from 'three';
import { buildCar, mountHeight } from '../game/CarBuilder.js';
import { flat } from '../render/Materials.js';
import { PAINTS, hexToCss } from '../data/palette.js';
import { CHASSIS } from '../data/cars.js';
import {
  LIVERIES, WHEEL_STYLES, SPOILERS, ROOF_ITEMS, HEADLIGHT_COLORS, COLOUR_PRESETS,
  NUMBER_MIN, NUMBER_MAX, NUMBER_DIGITS, PRESET_NAME_MAX, USER_PRESET_MAX,
  normalizeCar, carAppearance, paintOf, presetFor, normalizePresets,
} from '../data/customization.js';
import { SPEEDO_STYLES, normalizeSpeedo, toMph } from './Speedo.js';

// Radians per second. Slow enough to read the car, fast enough that you do not
// wait for the far side to come round.
const TURN_RATE = 0.42;

// Automatic or manual. Not cosmetic -- in manual the player's gear decides the
// drive -- which is why it lives here rather than in customization.js, whose
// values may never reach the physics.
export const GEARBOX_MODES = [
  { id: 'auto', name: 'Automatic' },
  { id: 'manual', name: 'Manual' },
];

// The list, top to bottom. Sections are headings; everything else takes focus.
const ITEMS = [
  { section: 'Car' },
  { key: 'chassis', label: 'Chassis', kind: 'select' },
  { section: 'Paint' },
  { key: 'preset', label: 'Preset', kind: 'select' },
  { key: 'primary', label: 'Primary', kind: 'select' },
  { key: 'secondary', label: 'Secondary', kind: 'select' },
  { key: 'wheelColor', label: 'Wheel colour', kind: 'select' },
  { key: 'savePreset', label: 'Save these colours as a preset', kind: 'savePreset' },
  { section: 'Parts' },
  { key: 'livery', label: 'Livery', kind: 'select' },
  { key: 'wheelStyle', label: 'Wheel style', kind: 'select' },
  { key: 'spoiler', label: 'Spoiler', kind: 'select' },
  { key: 'roofItem', label: 'Roof item', kind: 'select' },
  { key: 'headlight', label: 'Headlights', kind: 'select' },
  { key: 'number', label: 'Driver number', kind: 'number' },
  { section: 'Dashboard' },
  { key: 'speedo', label: 'Speedometer', kind: 'select' },
  { key: 'gearbox', label: 'Gearbox', kind: 'select' },
  { key: 'actions', kind: 'buttons' },
];
const FIELDS = ITEMS.filter((it) => !it.section);

// The chassis card. Each stat has a bar against the biggest of the five, so
// the cars compare at a glance; the figure beside it is the real value.
const STATS = [
  { label: 'Top speed', get: (c) => toMph(c.topSpeed), show: (v) => `${Math.round(v)} mph` },
  { label: 'Power', get: (c) => c.power, show: (v) => `${(v / 1000).toFixed(1)} kN` },
  { label: 'Grip front / rear', get: (c) => (c.gripFront + c.gripRear) / 2,
    show: (v, c) => `${c.gripFront.toFixed(2)} / ${c.gripRear.toFixed(2)}` },
  { label: 'Steering lock', get: (c) => c.steerRate, show: (v) => `${Math.round((v * 180) / Math.PI)}°` },
  { label: 'Downforce', get: (c) => c.downforce, show: (v) => v.toFixed(1) },
  { label: 'Grip off road', get: (c) => c.offroadGrip, show: (v) => v.toFixed(2) },
  { label: 'Mass', get: (c) => c.mass, show: (v) => `${v} kg` },
  { label: 'Centre of mass', get: (c) => c.centerOfMassHeight, show: (v) => `${v.toFixed(2)} m` },
];

const isDigitKey = (code) => /^(Digit|Numpad)[0-9]$/.test(code);

export class Garage {
  constructor(uiRoot, renderer) {
    this.renderer = renderer;
    this.el = uiRoot.querySelector('.garage');
    this.panelEl = this.el.querySelector('.garage-panel');
    this.cardEl = this.el.querySelector('.garage-card');
    this.rowsEl = this.el.querySelector('.garage-rows');
    this.nameEl = this.el.querySelector('.garage-car-name');
    this.blurbEl = this.el.querySelector('.garage-car-blurb');
    this.statsEl = this.el.querySelector('.garage-car-stats');
    this.buttons = [...this.el.querySelectorAll('.garage-btn')];

    this.visible = false;
    this.index = 0;       // into FIELDS
    this.button = 0;      // which of the two buttons, on the last row
    this.list = null;     // the open dropdown, if there is one
    this.naming = false;  // typing a new preset's name
    this.cars = {};
    for (const c of CHASSIS) this.cars[c.id] = normalizeCar({ chassis: c.id });
    this.chassisId = CHASSIS[0].id;
    this.prefs = { speedo: normalizeSpeedo(null), manual: false };
    this.presets = [];
    this._note = null;
    this._elapsed = 0;
    this.onClose = null;
    this.onPresets = null;

    this._buildScene();
    this._buildRows();
    this._buildStats();
    this.buttons.forEach((b, k) => b.addEventListener('click', () => {
      this._focus(FIELDS.length - 1);
      this.button = k;
      this._activate();
    }));

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onPointerDown = this._onPointerDown.bind(this);
  }

  get car() { return this.cars[this.chassisId]; }

  // --- the turntable -------------------------------------------------------

  _buildScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b141f);
    // The studio floor fades into the backdrop rather than ending at an edge.
    this.scene.fog = new THREE.Fog(0x0b141f, 16, 46);

    // Lit harder than the track, and from the front, because this is the one
    // place the car is meant to be looked at rather than driven.
    const hemi = new THREE.HemisphereLight(0xbcd0e4, 0x1b2634, 0.9);
    this.scene.add(hemi);
    const key = new THREE.DirectionalLight(0xfff0dc, 1.15);
    key.position.set(4, 7, 6);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0x8fb4d8, 0.45);
    fill.position.set(-6, 3, -4);
    this.scene.add(fill);

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);

    const floor = new THREE.Mesh(new THREE.CircleGeometry(60, 48), flat(0x0e1926));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.19;
    this.scene.add(floor);

    // The turntable, and a ring around it so the car is not floating on black.
    // Both are unit sized and scaled to the car in _rebuild, because a disc
    // that fits the truck swallows the open-wheeler.
    this.disc = new THREE.Mesh(new THREE.CylinderGeometry(0.94, 1, 0.16, 44), flat(0x1b2836));
    this.disc.position.y = -0.08;
    this.scene.add(this.disc);
    this.ring = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.09, 0.05, 44), flat(0xff7a1a));
    this.ring.position.y = -0.155;
    this.scene.add(this.ring);

    this.turntable = new THREE.Group();
    this.scene.add(this.turntable);
    this._rebuild();
  }

  _rebuild() {
    if (this.built) {
      this.turntable.remove(this.built.root);
      this.built.root.traverse((n) => { if (n.geometry) n.geometry.dispose(); });
      // The tail lamp material is this preview's own rather than a cached one,
      // and this runs on every change in the garage. Nothing else frees it.
      this.built.brakeLight.dispose();
    }
    const chassis = CHASSIS.find((c) => c.id === this.chassisId) ?? CHASSIS[0];
    this.chassis = chassis;
    this.built = buildCar(chassis, carAppearance(this.car));

    // Stand it on the turntable. The root is the suspension mount plane and
    // the wheels hang below it, so both need placing or the car floats.
    const mh = mountHeight(chassis);
    this.built.root.position.y = mh;
    for (const w of this.built.wheels) w.position.y = chassis.wheelRadius - mh;
    this.turntable.add(this.built.root);

    // The car turns, so what has to fit is its longest silhouette, which is
    // the diagonal of its footprint. Framing off body length alone crops it
    // every time it comes round to three quarters on.
    this._span = Math.hypot(chassis.bodyLength, chassis.bodyWidth);
    this._focusY = mh * 0.5 + chassis.bodyHeight * 0.45;
    const pad = this._span * 0.70;
    this.disc.scale.set(pad, 1, pad);
    this.ring.scale.set(pad, 1, pad);
  }

  // --- the list ------------------------------------------------------------

  _buildRows() {
    this.rowsEl.replaceChildren();
    this.rowEls = [];
    for (const it of ITEMS) {
      if (it.kind === 'buttons') {
        this.rowEls.push(this.el.querySelector('.garage-actions'));
        continue;
      }
      const li = document.createElement('li');
      if (it.section) {
        li.className = 'garage-section';
        li.textContent = it.section;
        this.rowsEl.append(li);
        continue;
      }
      li.className = `garage-row garage-row-${it.kind}`;
      const label = document.createElement('span');
      label.className = 'garage-label';
      label.textContent = it.label;
      li.append(label);

      if (it.kind === 'select') {
        // A button so it reads as one to assistive tech, but out of the tab
        // order: focus is this list's own concept, not the browser's.
        const field = document.createElement('button');
        field.type = 'button';
        field.tabIndex = -1;
        field.className = 'garage-field';
        const chips = document.createElement('span');
        chips.className = 'garage-chips';
        const text = document.createElement('span');
        text.className = 'garage-value-text';
        const caret = document.createElement('span');
        caret.className = 'garage-caret';
        field.append(chips, text, caret);
        const list = document.createElement('div');
        list.className = 'garage-list';
        list.hidden = true;
        li.append(field, list);
        li._chips = chips;
        li._text = text;
        li._list = list;
      } else if (it.kind === 'number') {
        const box = document.createElement('input');
        box.type = 'text';
        box.inputMode = 'numeric';
        box.maxLength = NUMBER_DIGITS;
        box.className = 'garage-input garage-number';
        box.autocomplete = 'off';
        box.spellcheck = false;
        box.setAttribute('aria-label', it.label);
        box.addEventListener('input', () => this._typedNumber());
        // An emptied box goes back to the number the car still has.
        box.addEventListener('blur', () => { box.value = String(this.car.number); });
        li.append(box);
        this.numberInput = box;
      } else if (it.kind === 'savePreset') {
        label.classList.add('garage-link');
        const name = document.createElement('input');
        name.type = 'text';
        name.maxLength = PRESET_NAME_MAX;
        name.className = 'garage-input garage-name';
        name.placeholder = 'Preset name';
        name.autocomplete = 'off';
        name.spellcheck = false;
        name.setAttribute('aria-label', 'Preset name');
        name.hidden = true;
        const save = document.createElement('button');
        save.type = 'button';
        save.className = 'garage-mini';
        save.textContent = 'Save preset';
        save.hidden = true;
        // Keep the caret in the name box while the button is pressed.
        save.addEventListener('pointerdown', (e) => e.preventDefault());
        save.addEventListener('click', (e) => { e.stopPropagation(); this._savePreset(name.value); });
        li.append(name, save);
        li._label = label;
        this.nameInput = name;
        this.nameSave = save;
      }

      li.addEventListener('click', (e) => this._click(it, e));
      this.rowsEl.append(li);
      this.rowEls.push(li);
    }
  }

  _buildStats() {
    this.statsEl.replaceChildren();
    this.statEls = STATS.map((s) => {
      const row = document.createElement('div');
      row.className = 'garage-stat';
      const dt = document.createElement('dt');
      dt.textContent = s.label;
      const dd = document.createElement('dd');
      const bar = document.createElement('span');
      bar.className = 'garage-stat-bar';
      const fill = document.createElement('i');
      bar.append(fill);
      row.append(dt, dd, bar);
      this.statsEl.append(row);
      return { dd, fill, max: Math.max(...CHASSIS.map((c) => s.get(c))) || 1 };
    });
  }

  // --- values --------------------------------------------------------------

  _options(key) {
    switch (key) {
      case 'chassis': return CHASSIS.map((c) => ({ id: c.id, name: c.name }));
      case 'preset': return [
        ...COLOUR_PRESETS.map((p) => ({ id: p.id, name: p.name, paints: p })),
        ...this.presets.map((p) => ({ id: p.id, name: p.name, paints: p, user: true })),
      ];
      case 'primary': case 'secondary': case 'wheelColor': return PAINTS;
      case 'livery': return LIVERIES;
      case 'wheelStyle': return WHEEL_STYLES;
      case 'spoiler': return SPOILERS;
      case 'roofItem': return ROOF_ITEMS;
      case 'headlight': return HEADLIGHT_COLORS;
      case 'speedo': return SPEEDO_STYLES;
      case 'gearbox': return GEARBOX_MODES;
      default: return [];
    }
  }

  _get(key) {
    if (key === 'chassis') return this.chassisId;
    if (key === 'preset') {
      const p = presetFor(this.car, this.presets);
      return p ? p.id : null;
    }
    if (key === 'speedo') return this.prefs.speedo;
    if (key === 'gearbox') return this.prefs.manual ? 'manual' : 'auto';
    return this.car[key];
  }

  _set(key, id) {
    if (key === 'chassis') this.chassisId = id;
    else if (key === 'preset') {
      const opt = this._options('preset').find((o) => o.id === id);
      if (opt) Object.assign(this.car, paintOf(opt.paints));
    } else if (key === 'speedo') this.prefs.speedo = id;
    else if (key === 'gearbox') this.prefs.manual = id === 'manual';
    else this.car[key] = id;
    if (key !== 'speedo' && key !== 'gearbox') this._rebuild();
    this._paint();
  }

  // Swatches for an option: one for a paint or a lens, three for a preset.
  _fillChips(chips, o) {
    chips.replaceChildren();
    const paints = o && o.paints ? paintOf(o.paints) : null;
    const hexes = paints ? Object.values(paints).map((id) => PAINTS.find((p) => p.id === id)?.hex)
      : o && o.hex != null ? [o.hex] : [];
    for (const h of hexes) {
      if (h == null) continue;
      const sw = document.createElement('i');
      sw.className = 'garage-swatch';
      sw.style.background = hexToCss(h);
      chips.append(sw);
    }
    chips.hidden = chips.childElementCount === 0;
  }

  _paint() {
    FIELDS.forEach((it, i) => {
      const el = this.rowEls[i];
      el.classList.toggle('focused', i === this.index);
      if (it.kind === 'select') {
        const id = this._get(it.key);
        const opt = this._options(it.key).find((o) => o.id === id);
        el._text.textContent = opt ? opt.name : 'Custom';
        // The preset field always shows the car's own three paints.
        this._fillChips(el._chips, it.key === 'preset' ? { paints: this.car } : opt);
      } else if (it.kind === 'number') {
        if (document.activeElement !== this.numberInput) this.numberInput.value = String(this.car.number);
      } else if (it.kind === 'savePreset') {
        el._label.textContent = this._note ? this._note.text : it.label;
        el._label.hidden = this.naming;
        el.classList.toggle('naming', this.naming);
      }
    });
    const onButtons = FIELDS[this.index].kind === 'buttons';
    this.buttons.forEach((b, k) => b.classList.toggle('focused', onButtons && k === this.button));

    const c = this.chassis;
    this.nameEl.textContent = c.name;
    this.blurbEl.textContent = c.blurb;
    STATS.forEach((s, k) => {
      const v = s.get(c), el = this.statEls[k];
      el.dd.textContent = s.show(v, c);
      el.fill.style.width = `${Math.max(3, (100 * v) / el.max).toFixed(1)}%`;
    });
  }

  // --- moving and editing ----------------------------------------------------

  _focus(i) {
    i = (i + FIELDS.length) % FIELDS.length;
    if (this.list && this.list.index !== i) this._closeList(false);
    if (this.naming && FIELDS[i].kind !== 'savePreset') this._endNaming();
    this.index = i;
    // Landing on the number puts the caret in it with the number selected, so
    // typing replaces it, the way the old row took digits.
    if (FIELDS[i].kind === 'number') {
      this.numberInput.focus({ preventScroll: true });
      this.numberInput.select();
    } else if (document.activeElement === this.numberInput) {
      this.numberInput.blur();
    }
    this.rowEls[i].scrollIntoView({ block: 'nearest' });
  }

  _move(d) {
    this._focus(this.index + d);
    this._paint();
  }

  _step(d) {
    const it = FIELDS[this.index];
    if (it.kind === 'buttons') {
      this.button = d < 0 ? 0 : 1;
      this._paint();
    } else if (it.kind === 'number') {
      this.car.number = Math.min(NUMBER_MAX, Math.max(NUMBER_MIN, this.car.number + d));
      this.numberInput.value = String(this.car.number);
      this._rebuild();
      this._paint();
    } else if (it.kind === 'select') {
      const opts = this._options(it.key);
      const at = opts.findIndex((o) => o.id === this._get(it.key));
      const next = at < 0 ? (d > 0 ? 0 : opts.length - 1) : (at + d + opts.length) % opts.length;
      this._set(it.key, opts[next].id);
    }
  }

  _typedNumber() {
    const box = this.numberInput;
    const digits = box.value.replace(/\D+/g, '').slice(0, NUMBER_DIGITS);
    if (digits !== box.value) box.value = digits;
    // An empty box keeps the old number until there is a new one.
    if (!digits) return;
    this.car.number = Math.min(NUMBER_MAX, Math.max(NUMBER_MIN, Number(digits)));
    this._rebuild();
    this._paint();
  }

  // pad: a gamepad cannot type, so a preset it saves gets a name made up.
  _activate(pad = false) {
    const it = FIELDS[this.index];
    if (it.kind === 'select') this._openList();
    else if (it.kind === 'number') this._move(1);
    else if (it.kind === 'savePreset') {
      if (pad) this._savePreset('');
      else this._startNaming();
    } else if (it.kind === 'buttons') this.close(this.button === 0);
  }

  _click(it, e) {
    if (e.target.closest('.garage-list')) return; // the options take their own clicks
    const i = FIELDS.indexOf(it);
    const wasOpen = this.list && this.list.index === i;
    this._focus(i);
    if (it.kind === 'select') {
      if (wasOpen) this._closeList(false);
      else this._openList();
    } else if (it.kind === 'savePreset' && !this.naming && !e.target.closest('input, button')) {
      this._startNaming();
    }
    this._paint();
  }

  // --- the dropdown ----------------------------------------------------------

  _openList() {
    const it = FIELDS[this.index];
    const li = this.rowEls[this.index];
    const options = this._options(it.key);
    const current = this._get(it.key);
    this.list = {
      index: this.index,
      key: it.key,
      options,
      at: Math.max(0, options.findIndex((o) => o.id === current)),
      // What goes back if the list is closed without taking anything.
      undo: it.key === 'preset' ? paintOf(this.car) : current,
      el: li._list,
    };
    li._list.hidden = false;
    li.classList.add('open');
    this._renderList();
    this._scrollList();
    document.addEventListener('pointerdown', this._onPointerDown, true);
  }

  _renderList() {
    const L = this.list;
    L.el.replaceChildren();
    L.optEls = [];
    let group = null;
    L.options.forEach((o, k) => {
      if (L.key === 'preset') {
        const g = o.user ? 'Yours' : 'Presets';
        if (g !== group) {
          const h = document.createElement('div');
          h.className = 'garage-list-head';
          h.textContent = g;
          L.el.append(h);
          group = g;
        }
      }
      const row = document.createElement('div');
      row.className = 'garage-option';
      const chips = document.createElement('span');
      chips.className = 'garage-chips';
      this._fillChips(chips, o);
      const name = document.createElement('span');
      name.className = 'garage-option-name';
      name.textContent = o.name;
      row.append(chips, name);
      if (o.user) {
        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'garage-mini';
        del.textContent = 'Delete';
        del.addEventListener('click', (e) => { e.stopPropagation(); L.at = k; this._deletePreset(); });
        row.append(del);
      }
      row.addEventListener('click', (e) => {
        e.stopPropagation();
        L.at = k;
        this._set(L.key, o.id);
        this._closeList(true);
      });
      L.el.append(row);
      L.optEls.push(row);
    });
    if (L.key === 'preset' && !this.presets.length) {
      const p = document.createElement('p');
      p.className = 'garage-list-note';
      p.textContent = 'Presets you save show up here.';
      L.el.append(p);
    }
    this._markList();
  }

  _markList() {
    const L = this.list;
    L.optEls.forEach((r, k) => r.classList.toggle('hl', k === L.at));
  }

  _scrollList() {
    const r = this.list && this.list.optEls[this.list.at];
    if (r) r.scrollIntoView({ block: 'nearest' });
  }

  // Moving through an open list previews each option on the car as you go.
  _listMove(d) {
    const L = this.list;
    L.at = (L.at + d + L.options.length) % L.options.length;
    this._set(L.key, L.options[L.at].id);
    this._markList();
    this._scrollList();
  }

  _closeList(keep) {
    const L = this.list;
    if (!L) return;
    this.list = null;
    L.el.hidden = true;
    L.el.replaceChildren();
    this.rowEls[L.index].classList.remove('open');
    document.removeEventListener('pointerdown', this._onPointerDown, true);
    if (!keep) {
      if (L.key === 'preset') {
        Object.assign(this.car, L.undo);
        this._rebuild();
      } else if (L.undo != null && this._get(L.key) !== L.undo) {
        this._set(L.key, L.undo);
      }
    }
    this._paint();
  }

  // A click anywhere outside the open field and its list closes it unchanged.
  _onPointerDown(e) {
    if (!this.list) return;
    if (this.rowEls[this.list.index].contains(e.target)) return;
    this._closeList(false);
  }

  // --- colour presets ----------------------------------------------------------

  _suggestName() {
    const taken = new Set(this.presets.map((p) => p.name));
    let n = this.presets.length + 1;
    while (taken.has(`My colours ${n}`)) n++;
    return `My colours ${n}`;
  }

  // Why a preset cannot be saved right now, or null if it can.
  _presetBlocked() {
    const existing = presetFor(this.car, this.presets);
    if (existing) return `These colours are already ${existing.name}`;
    if (this.presets.length >= USER_PRESET_MAX) return 'Delete a preset to make room';
    return null;
  }

  _startNaming() {
    const blocked = this._presetBlocked();
    if (blocked) { this._say(blocked); return; }
    this.naming = true;
    this.nameInput.hidden = false;
    this.nameSave.hidden = false;
    this.nameInput.value = this._suggestName();
    this.nameInput.focus({ preventScroll: true });
    this.nameInput.select();
    this._paint();
  }

  _endNaming() {
    if (!this.naming) return;
    this.naming = false;
    this.nameInput.hidden = true;
    this.nameSave.hidden = true;
    if (document.activeElement === this.nameInput) this.nameInput.blur();
    this._paint();
  }

  _savePreset(name) {
    const blocked = this._presetBlocked();
    this._endNaming();
    if (blocked) { this._say(blocked); return; }
    const clean = String(name ?? '').trim().slice(0, PRESET_NAME_MAX) || this._suggestName();
    const preset = { id: `u${Date.now().toString(36)}`, name: clean, ...paintOf(this.car) };
    this.presets = normalizePresets([...this.presets, preset]);
    if (this.onPresets) this.onPresets(this.presets);
    this._say(`Saved as ${clean}`);
  }

  _deletePreset() {
    const L = this.list;
    if (!L || L.key !== 'preset') return;
    const o = L.options[L.at];
    if (!o || !o.user) return;
    this.presets = this.presets.filter((p) => p.id !== o.id);
    if (this.onPresets) this.onPresets(this.presets);
    L.options = this._options('preset');
    L.at = Math.min(L.at, L.options.length - 1);
    this._renderList();
    this._scrollList();
    this._paint();
  }

  // A short message in place of the save row's label.
  _say(text) {
    this._note = { text, until: this._elapsed + 2.4 };
    this._paint();
  }

  // --- open, close, input --------------------------------------------------

  // state: { chassis, cars: { [chassisId]: car }, speedo, manual, presets }
  open(state) {
    this.cars = {};
    for (const c of CHASSIS) this.cars[c.id] = normalizeCar({ ...(state.cars?.[c.id] || {}), chassis: c.id });
    this.chassisId = CHASSIS.some((c) => c.id === state.chassis) ? state.chassis : CHASSIS[0].id;
    this.prefs = { speedo: normalizeSpeedo(state.speedo), manual: !!state.manual };
    this.presets = normalizePresets(state.presets);
    this.visible = true;
    this.index = 0;
    this.button = 0;
    this.list = null;
    this.naming = false;
    this.nameInput.hidden = true;
    this.nameSave.hidden = true;
    this._note = null;
    this._elapsed = 0;
    this.turntable.rotation.y = -0.6;
    this.el.hidden = false;
    // Whatever had focus behind the garage (the volume slider, say) lets go.
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    this._rebuild();
    this._paint();
    this.rowsEl.scrollTop = 0;
    window.addEventListener('keydown', this._onKeyDown);
  }

  close(save) {
    if (!this.visible) return;
    this._closeList(true);
    this._endNaming();
    this.visible = false;
    this.el.hidden = true;
    window.removeEventListener('keydown', this._onKeyDown);
    if (document.activeElement && this.el.contains(document.activeElement)) document.activeElement.blur();
    const result = save
      ? { chassis: this.chassisId, cars: this.cars, speedo: this.prefs.speedo, manual: this.prefs.manual }
      : null;
    if (this.onClose) this.onClose(result);
  }

  _onKeyDown(e) {
    if (!this.visible) return;
    const code = e.code;
    const is = (a, b) => code === a || code === b;

    // The preset name box takes every key but these.
    if (this.naming && document.activeElement === this.nameInput) {
      if (code === 'Enter') this._savePreset(this.nameInput.value);
      else if (code === 'Escape') this._endNaming();
      else if (is('ArrowUp', 'ArrowDown')) { this._endNaming(); this._move(code === 'ArrowUp' ? -1 : 1); }
      else return;
      e.preventDefault();
      return;
    }

    if (this.list) {
      if (is('ArrowUp', 'KeyW')) this._listMove(-1);
      else if (is('ArrowDown', 'KeyS')) this._listMove(1);
      else if (is('Enter', 'Space')) this._closeList(true);
      else if (code === 'Escape') this._closeList(false);
      else if (is('Delete', 'Backspace')) this._deletePreset();
      else return;
      e.preventDefault();
      return;
    }

    // In the number box, digits and the editing keys type.
    if (document.activeElement === this.numberInput &&
        (isDigitKey(code) || is('Backspace', 'Delete'))) return;

    if (is('ArrowUp', 'KeyW')) this._move(-1);
    else if (is('ArrowDown', 'KeyS')) this._move(1);
    else if (is('ArrowLeft', 'KeyA')) this._step(-1);
    else if (is('ArrowRight', 'KeyD')) this._step(1);
    else if (is('Enter', 'Space')) this._activate();
    else if (is('Escape', 'KeyG')) this.close(false);
    else return;
    e.preventDefault();
  }

  // Gamepad edges, handed over by the game each frame.
  handlePad(menu) {
    if (!this.visible) return;
    if (this.list) {
      if (menu.up) this._listMove(-1);
      if (menu.down) this._listMove(1);
      if (menu.confirm) this._closeList(true);
      else if (menu.back) this._closeList(false);
      else if (menu.alt) this._deletePreset();
      return;
    }
    if (this.naming) {
      if (menu.confirm) this._savePreset(this.nameInput.value);
      else if (menu.back) this._endNaming();
      return;
    }
    if (menu.up) this._move(-1);
    if (menu.down) this._move(1);
    if (menu.left) this._step(-1);
    if (menu.right) this._step(1);
    if (menu.confirm) this._activate(true);
    if (menu.back) this.close(false);
  }

  render(dt) {
    if (!this.visible) return;
    this._elapsed += dt;
    this.turntable.rotation.y += TURN_RATE * dt;
    if (this._note && this._elapsed > this._note.until) {
      this._note = null;
      this._paint();
    }

    // Same source of truth Scene uses, rather than asking the renderer: at
    // construction, before the first resize event, some browsers report a
    // window of zero and the renderer is sized to match. A camera with an
    // aspect of 0 renders the clear colour and nothing else.
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    const aspect = w / h;
    if (this.camera.aspect !== aspect) {
      this.camera.aspect = aspect;
      this.camera.updateProjectionMatrix();
    }

    // Pull back until the car fits both ways, then a little further, and look
    // slightly down at it. Across the frame what has to fit is the footprint
    // diagonal, since the car turns; up the frame it is only the car's height,
    // and fitting the LENGTH vertically is what left the open-wheeler sitting
    // tiny in a screen full of empty turntable.
    const vHalf = Math.tan((this.camera.fov * Math.PI) / 360);
    const dist = Math.max(this._span * 0.80 / (vHalf * aspect),
      (this.chassis.bodyHeight + 0.7) * 0.62 / vHalf) + 1.1;

    // The car sits in the middle of the open space between the settings panel
    // and the chassis card, wherever the layout has put them.
    const left = this.panelEl.getBoundingClientRect().right;
    const right = this.cardEl.getBoundingClientRect().left;
    const offset = right > left + 100 ? ((left + right) * 0.5 - w * 0.5) / (w * 0.5) : 0;
    const shift = offset * dist * vHalf * aspect * 0.9;
    this.camera.position.set(-shift, this._focusY + dist * 0.23, dist * 0.96);
    this.camera.lookAt(-shift, this._focusY, 0);

    this.renderer.render(this.scene, this.camera);
  }
}
