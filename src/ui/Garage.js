// The garage: pick a chassis, paint it, and watch the result turn on a
// turntable while you do.
//
// The preview is the real car. It is built by the same `buildCar` the game
// drives, from the same config object that gets saved, so there is no second
// description of what a car looks like that could drift out of step with the
// first. Changing a setting rebuilds the mesh -- a few milliseconds, once per
// keypress, and nothing is cached that could go stale.
//
// It renders into the game's own canvas with its own scene and camera, so the
// track keeps existing behind it and closing the garage is instant.
//
// Navigation is a single list: up and down move between settings, left and
// right change the one you are on, and the last two rows are the buttons. That
// shape is fully keyboard and gamepad navigable without a cursor, which is what
// the spec asks for, and it means there is exactly one focus concept to build.

import * as THREE from 'three';
import { buildCar, mountHeight } from '../game/CarBuilder.js';
import { flat } from '../render/Materials.js';
import { PAINTS, hexToCss } from '../data/palette.js';
import { CHASSIS } from '../data/cars.js';
import {
  LIVERIES, WHEEL_STYLES, SPOILERS, ROOF_ITEMS, HEADLIGHT_COLORS,
  NUMBER_MIN, NUMBER_MAX, normalizeCar, carAppearance,
} from '../data/customization.js';

// Radians per second. Slow enough to read the car, fast enough that you do not
// wait for the far side to come round.
const TURN_RATE = 0.42;

// How long after a digit is typed before the next one starts a new number.
const TYPE_WINDOW = 1.2;

const ROWS = [
  { key: 'chassis', label: 'Chassis', options: CHASSIS.map((c) => ({ id: c.id, name: c.name })) },
  { key: 'primary', label: 'Primary paint', options: PAINTS, swatch: true },
  { key: 'secondary', label: 'Secondary paint', options: PAINTS, swatch: true },
  { key: 'livery', label: 'Livery', options: LIVERIES },
  { key: 'wheelStyle', label: 'Wheels', options: WHEEL_STYLES },
  { key: 'wheelColor', label: 'Wheel colour', options: PAINTS, swatch: true },
  { key: 'spoiler', label: 'Spoiler', options: SPOILERS },
  { key: 'roofItem', label: 'Roof item', options: ROOF_ITEMS },
  { key: 'headlight', label: 'Headlights', options: HEADLIGHT_COLORS, swatch: true },
  { key: 'number', label: 'Driver number', number: true },
  { action: 'save', label: 'Save car' },
  { action: 'discard', label: 'Discard changes' },
];

export class Garage {
  constructor(uiRoot, renderer) {
    this.renderer = renderer;
    this.el = uiRoot.querySelector('.garage');
    this.rowsEl = this.el.querySelector('.garage-rows');
    this.nameEl = this.el.querySelector('.garage-car-name');
    this.blurbEl = this.el.querySelector('.garage-car-blurb');
    this.statsEl = this.el.querySelector('.garage-car-stats');

    this.visible = false;
    this.index = 0;
    this.car = normalizeCar(null);
    this._typedAt = -Infinity;
    this._elapsed = 0;
    this.onSave = null;
    this.onClose = null;

    this._buildScene();
    this._buildRows();

    this._onKeyDown = this._onKeyDown.bind(this);
  }

  // --- the turntable -------------------------------------------------------

  _buildScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b141f);

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
      // and this runs on every keypress in the garage. Nothing else frees it.
      this.built.brakeLight.dispose();
    }
    const chassis = CHASSIS.find((c) => c.id === this.car.chassis) ?? CHASSIS[0];
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
    this.rowEls = ROWS.map((row) => {
      const li = document.createElement('li');
      li.className = row.action ? 'garage-row garage-row-action' : 'garage-row';

      const label = document.createElement('span');
      label.className = 'garage-label';
      label.textContent = row.label;
      li.append(label);

      if (!row.action) {
        const value = document.createElement('span');
        value.className = 'garage-value';
        const swatch = document.createElement('i');
        swatch.className = 'garage-swatch';
        swatch.hidden = !row.swatch;
        const text = document.createElement('span');
        text.className = 'garage-value-text';
        const count = document.createElement('span');
        count.className = 'garage-count';
        value.append(swatch, text, count);
        li.append(value);
        li._swatch = swatch;
        li._text = text;
        li._count = count;
      }

      // Clicking works too. It is not the primary path -- the spec asks for a
      // menu that does not need a mouse -- but refusing the mouse would be
      // its own kind of wrong.
      li.addEventListener('click', () => {
        this.index = ROWS.indexOf(row);
        if (row.action) this._activate();
        else this._step(1);
        this._paint();
      });

      this.rowsEl.append(li);
      return li;
    });
  }

  _paint() {
    ROWS.forEach((row, i) => {
      const li = this.rowEls[i];
      li.classList.toggle('focused', i === this.index);
      if (row.action) return;

      if (row.number) {
        li._text.textContent = String(this.car.number);
        li._count.textContent = `${NUMBER_MIN} to ${NUMBER_MAX}`;
        return;
      }
      const idx = Math.max(0, row.options.findIndex((o) => o.id === this.car[row.key]));
      const opt = row.options[idx];
      li._text.textContent = opt.name;
      li._count.textContent = `${idx + 1} of ${row.options.length}`;
      if (row.swatch) li._swatch.style.background = hexToCss(opt.hex);
    });

    const c = this.chassis;
    this.nameEl.textContent = c.name;
    this.blurbEl.textContent = c.blurb;
    this.statsEl.replaceChildren();
    const stats = [
      ['Top speed', `${Math.round(c.topSpeed * 3.6)} km/h`],
      ['Power', `${(c.power / 1000).toFixed(1)} kN`],
      ['Mass', `${c.mass} kg`],
      ['Grip front / rear', `${c.gripFront.toFixed(2)} / ${c.gripRear.toFixed(2)}`],
      ['Steering lock', `${Math.round((c.steerRate * 180) / Math.PI)}°`],
      ['Downforce', c.downforce.toFixed(1)],
      ['Grip off road', c.offroadGrip.toFixed(2)],
      ['Centre of mass', `${c.centerOfMassHeight.toFixed(2)} m`],
    ];
    for (const [k, v] of stats) {
      const dt = document.createElement('dt');
      dt.textContent = k;
      const dd = document.createElement('dd');
      dd.textContent = v;
      this.statsEl.append(dt, dd);
    }
  }

  // --- editing -------------------------------------------------------------

  _step(delta) {
    const row = ROWS[this.index];
    if (!row || row.action) return;
    if (row.number) {
      const n = this.car.number + delta;
      this.car.number = n < NUMBER_MIN ? NUMBER_MAX : n > NUMBER_MAX ? NUMBER_MIN : n;
    } else {
      const list = row.options;
      const at = Math.max(0, list.findIndex((o) => o.id === this.car[row.key]));
      this.car[row.key] = list[(at + delta + list.length) % list.length].id;
    }
    this._rebuild();
    this._paint();
  }

  _typeDigit(d) {
    // Digits build a number while you keep typing and start a new one after a
    // pause, which is how every timing rig and pit board entry works.
    const fresh = this._elapsed - this._typedAt > TYPE_WINDOW;
    const next = fresh ? d : this.car.number * 10 + d;
    this.car.number = next > NUMBER_MAX ? d : Math.max(NUMBER_MIN, next);
    this._typedAt = this._elapsed;
    this._rebuild();
    this._paint();
  }

  _move(delta) {
    this.index = (this.index + delta + ROWS.length) % ROWS.length;
    this._typedAt = -Infinity;
    this._paint();
  }

  _activate() {
    const row = ROWS[this.index];
    if (row.action === 'save') this.close(true);
    else if (row.action === 'discard') this.close(false);
  }

  // --- open, close, input --------------------------------------------------

  open(car) {
    this.car = normalizeCar(car);
    this._saved = normalizeCar(car);
    this.visible = true;
    this.index = 0;
    this._elapsed = 0;
    this._typedAt = -Infinity;
    this.turntable.rotation.y = -0.6;
    this.el.hidden = false;
    this._rebuild();
    this._paint();
    window.addEventListener('keydown', this._onKeyDown);
  }

  close(save) {
    if (!this.visible) return;
    this.visible = false;
    this.el.hidden = true;
    window.removeEventListener('keydown', this._onKeyDown);
    const car = save ? normalizeCar(this.car) : this._saved;
    this.car = normalizeCar(car);
    if (save && this.onSave) this.onSave(car);
    if (this.onClose) this.onClose(car);
  }

  _onKeyDown(e) {
    if (!this.visible) return;
    const code = e.code;
    if (code === 'ArrowUp' || code === 'KeyW') this._move(-1);
    else if (code === 'ArrowDown' || code === 'KeyS') this._move(1);
    else if (code === 'ArrowLeft' || code === 'KeyA') this._step(-1);
    else if (code === 'ArrowRight' || code === 'KeyD') this._step(1);
    else if (code === 'Enter' || code === 'Space') this._activate();
    else if (code === 'Escape' || code === 'KeyG') this.close(false);
    else if (ROWS[this.index]?.number && /^Digit[0-9]$/.test(code)) {
      this._typeDigit(Number(code.slice(5)));
    } else return;
    e.preventDefault();
  }

  // Gamepad edges, handed over by the game each frame.
  handlePad(menu) {
    if (!this.visible) return;
    if (menu.up) this._move(-1);
    if (menu.down) this._move(1);
    if (menu.left) this._step(-1);
    if (menu.right) this._step(1);
    if (menu.confirm) this._activate();
    if (menu.back) this.close(false);
  }

  render(dt) {
    if (!this.visible) return;
    this._elapsed += dt;
    this.turntable.rotation.y += TURN_RATE * dt;

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

    // The settings list occupies the left of the screen, so the car sits right
    // of centre rather than behind the panel.
    const shift = aspect > 1.1 ? dist * 0.15 : 0;
    this.camera.position.set(-shift, this._focusY + dist * 0.23, dist * 0.96);
    this.camera.lookAt(-shift * 0.5, this._focusY, 0);

    this.renderer.render(this.scene, this.camera);
  }
}
