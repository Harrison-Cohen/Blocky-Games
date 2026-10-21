// The flight HUD: speed, altitude, heading, an artificial horizon with a pitch
// ladder and the flight path marker, angle of attack, load factor, throttle,
// afterburner and fuel, gear and brakes, and the warnings.
//
// It owns no state. FlightGame hands it the aircraft's numbers once a frame.
// Every write to the DOM is guarded by a comparison against what is already
// there, because setting textContent to the value it already holds still costs
// a style recalculation, and this runs every frame.
//
// Same look as the rest: Martian Mono for numbers, Archivo for labels, hard
// edged ink panels with one accent rule, the timing colours for warnings.

import { FLIGHT_HUD as H } from '../data/tuning.js';
import { speedIn, altitudeIn, climbIn } from '../flight/Units.js';
import { Radar } from './Radar.js';

const DEG = 180 / Math.PI;
const fmt = (v) => Math.round(v).toLocaleString('en-US');

function el(tag, cls, parent, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  if (parent) parent.append(e);
  return e;
}

export class FlightHud {
  constructor(root) {
    this.root = el('div', 'fhud', root);
    this.root.hidden = true;
    this.units = 'aviation';

    // Speed, left.
    const sp = el('div', 'fhud-panel fhud-speed', this.root);
    el('span', 'fhud-label', sp, 'Airspeed');
    this.speedEl = el('span', 'fhud-big', sp, '0');
    this.speedUnit = el('span', 'fhud-unit', sp, 'kt');
    this.machEl = el('div', 'fhud-sub', sp, 'Mach 0.00');
    this.tasEl = el('div', 'fhud-sub', sp, 'True 0 kt');

    // Altitude, right.
    const al = el('div', 'fhud-panel fhud-alt', this.root);
    el('span', 'fhud-label', al, 'Altitude');
    this.altEl = el('span', 'fhud-big', al, '0');
    this.altUnit = el('span', 'fhud-unit', al, 'ft');
    this.climbEl = el('div', 'fhud-sub', al, 'Climb 0 fpm');
    this.aglEl = el('div', 'fhud-sub', al, 'Above ground 0 ft');

    // Heading, top.
    const hd = el('div', 'fhud-panel fhud-heading', this.root);
    el('span', 'fhud-label', hd, 'Heading');
    this.headEl = el('span', 'fhud-mid', hd, '000');

    // Engine, bottom centre.
    const en = el('div', 'fhud-panel fhud-engine', this.root);
    const row = (label) => {
      const r = el('div', 'fhud-row', en);
      el('span', 'fhud-label', r, label);
      const bar = el('div', 'fhud-bar', r);
      const fill = el('i', '', bar);
      return { fill, bar, r };
    };
    this.thr = row('Throttle');
    this.abBar = row('Burner');
    this.fuelBar = row('Fuel');
    const nums = el('div', 'fhud-nums', en);
    this.aoaEl = el('span', 'fhud-num', nums, 'AoA 0.0');
    this.gEl = el('span', 'fhud-num', nums, 'G 1.0');
    this.gearEl = el('span', 'fhud-num', nums, 'Gear down');
    // The systems an aircraft has: the flap lever and the spoilers, and the autopilot's targets.
    this.sysEl = el('div', 'fhud-nums fhud-sys', en);
    this.flapsEl = el('span', 'fhud-num', this.sysEl, 'Flaps up');
    this.brakeNameEl = el('span', 'fhud-num', this.sysEl, '');
    this.apEl = el('div', 'fhud-nums fhud-ap', en);
    this.apEl.hidden = true;
    // On the ground: the wheel brake, and the nose wheel's lock.
    this.groundEl = el('div', 'fhud-nums fhud-ground', en);
    this.brakeEl = el('span', 'fhud-num', this.groundEl, 'Brake 0%');
    this.steerEl = el('span', 'fhud-num', this.groundEl, 'Nose wheel 0');
    this.parkEl = el('span', 'fhud-num', this.groundEl, '');
    this.groundEl.hidden = true;

    // The warning, centre low.
    this.warnEl = el('div', 'fhud-warn', this.root);
    this.noteEl = el('div', 'fhud-note', this.root);
    this.resetEl = el('div', 'fhud-reset', this.root);
    this.camEl = el('div', 'fhud-cam', this.root);
    // The radar, top left.
    this.radar = new Radar(this.root);
    // Where it is: the airport, the runway or the apron.
    this.placeEl = el('div', 'fhud-place', this.root);
    this.placeEl.hidden = true;
    // Stopped in a hangar bay: the bar that fills until the Hangar opens.
    this.zoneEl = el('div', 'fhud-zone', this.root);
    el('span', 'fhud-zone-text', this.zoneEl, 'Hangar bay: hold still to open the hangar');
    this.zoneBar = el('i', '', el('div', 'fhud-bar', this.zoneEl));
    this.zoneEl.hidden = true;

    // The horizon: the full pitch ladder and flight path marker, which only
    // mean something looking down the nose (the cockpit), and a small
    // attitude indicator for the chase views, where the camera is not the nose.
    this.canvas = el('canvas', 'fhud-horizon', this.root);
    this.ctx = this.canvas.getContext('2d');
    this.adi = el('canvas', 'fhud-adi', this.root);
    this.adiCtx = this.adi.getContext('2d');
    this._size = 0;
    this._adiSize = 0;
    this._cache = {};
    this._noteUntil = 0;
    this._camUntil = 0;
  }

  // What the aircraft being flown has: a burner row only where there is an afterburner, a flap
  // readout only where there are flaps, and the name its airbrake goes by.
  configure(def) {
    const ab = def.engines.some((e) => e.ab > e.dry);
    this.abBar.r.hidden = !ab;
    this.hasFlaps = !!(def.flaps && def.flaps.detents.length > 1);
    this.flapsEl.hidden = !this.hasFlaps;
    this.airbrakeName = def.airbrakeName || 'Airbrake';
    this._cache = {};
  }

  show() { this.root.hidden = false; }
  hide() { this.root.hidden = true; }
  get visible() { return !this.root.hidden; }
  setUnits(u) { this.units = u; this._cache = {}; }

  _set(key, node, value) {
    if (this._cache[key] === value) return;
    this._cache[key] = value;
    node.textContent = value;
  }

  _fill(key, node, frac, cls) {
    const v = Math.round(Math.max(0, Math.min(1, frac)) * 200);
    const k = v + (cls || '');
    if (this._cache[key] === k) return;
    this._cache[key] = k;
    node.style.width = `${v / 2}%`;
    if (cls !== undefined) node.parentElement.className = `fhud-bar ${cls}`;
  }

  note(text, seconds = 3) {
    this.noteEl.textContent = text;
    this.noteEl.hidden = false;
    this._noteUntil = performance.now() + seconds * 1000;
  }

  cameraName(name) {
    this.camEl.textContent = `Camera: ${name}`;
    this.camEl.hidden = false;
    this._camUntil = performance.now() + 1800;
  }

  // d: { cas, tas, mach, altitude, agl, climb, heading, pitch, bank, alpha,
  //      beta, nz, throttle, ab, abFuel, abLocked, fuel, gear, onGround,
  //      stallWarn, stalled, stallAlpha, resetProgress, brake, airbrake }
  update(d) {
    if (this.root.hidden) return;
    const now = performance.now();
    if (!this.noteEl.hidden && now > this._noteUntil) this.noteEl.hidden = true;
    if (!this.camEl.hidden && now > this._camUntil) this.camEl.hidden = true;

    const sp = speedIn(d.cas, this.units);
    this._set('spd', this.speedEl, fmt(sp.value));
    this._set('spdu', this.speedUnit, sp.unit);
    this._set('mach', this.machEl, `Mach ${d.mach.toFixed(2)}`);
    const tas = speedIn(d.tas, this.units);
    this._set('tas', this.tasEl, `True ${fmt(tas.value)} ${tas.unit}`);

    const al = altitudeIn(d.altitude, this.units);
    this._set('alt', this.altEl, fmt(al.value));
    this._set('altu', this.altUnit, al.unit);
    const cl = climbIn(d.climb, this.units);
    const climbRound = Math.round(cl.value / (this.units === 'metric' ? 1 : 50)) * (this.units === 'metric' ? 1 : 50);
    this._set('climb', this.climbEl, `Climb ${climbRound > 0 ? '+' : ''}${fmt(climbRound)} ${cl.unit}`);
    const ag = altitudeIn(d.agl, this.units);
    this._set('agl', this.aglEl, `Above ground ${fmt(ag.value)} ${ag.unit}`);

    const hd = Math.round(d.heading * DEG) % 360;
    this._set('hdg', this.headEl, String(hd).padStart(3, '0'));

    this._fill('thr', this.thr.fill, d.throttle);
    this._fill('ab', this.abBar.fill, d.abFuel, d.abLocked ? 'warn' : d.ab > 0.5 ? 'hot' : '');
    this._fill('fuel', this.fuelBar.fill, d.fuel, d.fuel < 0.12 ? 'warn' : '');
    this._set('aoa', this.aoaEl, `AoA ${(d.alpha * DEG).toFixed(1)}`);
    this._set('g', this.gEl, `G ${d.nz.toFixed(1)}`);
    this._set('gear', this.gearEl, d.gear > 0.97 ? 'Gear down' : d.gear < 0.03 ? 'Gear up' : 'Gear moving');
    // The ground: only while the wheels carry the aircraft.
    const onWheels = d.onGround && d.weightOnWheels > 0.1;
    if (this.groundEl.hidden === onWheels) this.groundEl.hidden = !onWheels;
    if (onWheels) {
      this._set('brake', this.brakeEl, `Brake ${Math.round((d.brake || 0) * 100)}%`);
      this._set('steer', this.steerEl, `Nose wheel ${Math.round(Math.abs(d.steer || 0) * DEG)} ${d.steer > 0.02 ? 'left' : d.steer < -0.02 ? 'right' : ''}`.trim());
      this._set('park', this.parkEl, d.parked ? 'Parked' : '');
    }
    this.radar.update({ x: d.x, z: d.z, heading: d.heading, units: this.units });
    this._set('place', this.placeEl, d.where || '');
    this.placeEl.hidden = !d.where;
    // A bay: the bar fills while the aircraft stands still in it.
    const inBay = d.zone !== undefined && d.zone >= 0;
    if (this.zoneEl.hidden === inBay) this.zoneEl.hidden = !inBay;
    if (inBay) this._fill('zone', this.zoneBar, d.zone);
    this.gEl.classList.toggle('over', d.nz > 8.2 || d.nz < -3);

    // The flaps (the setting the panel is at, lit while it moves) and the spoilers.
    if (this.hasFlaps) {
      this._set('flaps', this.flapsEl, `Flaps ${d.flapName}`);
      this.flapsEl.classList.toggle('over', Math.abs(d.flaps - Math.round(d.flaps)) > 0.03);
    }
    this._set('brk', this.brakeNameEl, d.airbrake > 0.02 ? `${this.airbrakeName} ${Math.round(d.airbrake * 100)}%` : '');

    // The autopilot, with what it holds.
    const ap = d.ap;
    if (ap && ap.on) {
      if (this.apEl.hidden) this.apEl.hidden = false;
      const alt = altitudeIn(ap.alt, this.units), spd = speedIn(ap.spd, this.units);
      this._set('ap', this.apEl, [
        'AP',
        ap.altHold ? `ALT ${fmt(alt.value)} ${alt.unit}` : '',
        ap.hdgHold ? `HDG ${String(Math.round((((ap.hdg * DEG) % 360) + 360) % 360) % 360).padStart(3, '0')}` : '',
        ap.spdHold ? `SPD ${fmt(spd.value)} ${spd.unit}` : '',
      ].filter(Boolean).join('  '));
    } else if (!this.apEl.hidden) this.apEl.hidden = true;

    // The warning: the most urgent one.
    let warn = '', cls = '';
    if (d.stalled) { warn = 'Stall'; cls = 'alert'; }
    else if (d.stallWarn) { warn = 'Stall warning'; cls = 'warn'; }
    else if (d.agl < 120 && d.climb < -12 && d.gear < 0.5) { warn = 'Pull up'; cls = 'alert'; }
    else if (d.gearWarn) { warn = 'Gear is up'; cls = 'alert'; }
    else if (d.fuel < 0.05) { warn = 'Fuel'; cls = 'warn'; }
    this._set('warn', this.warnEl, warn);
    if (this._cache.warnCls !== cls) { this._cache.warnCls = cls; this.warnEl.className = `fhud-warn ${cls}`; }

    if (d.resetProgress > 0.02) {
      this._set('reset', this.resetEl, `Back to the hangar  ${Math.round(d.resetProgress * 100)}%`);
      this.resetEl.hidden = false;
    } else if (!this.resetEl.hidden) this.resetEl.hidden = true;

    this.canvas.hidden = !d.cockpit;
    this.adi.hidden = !!d.cockpit;
    if (d.cockpit) this._horizon(d); else this._attitude(d);
  }

  // The attitude indicator: a disc of sky and ground turned against the bank
  // and slid with the pitch, under a fixed aircraft symbol.
  _attitude(d) {
    const css = 148;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const px = Math.round(css * dpr);
    const c = this.adi;
    if (this._adiSize !== px) {
      this._adiSize = px;
      c.width = px; c.height = px;
      c.style.width = `${css}px`; c.style.height = `${css}px`;
    }
    const g = this.adiCtx;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, px, px);
    g.scale(dpr, dpr);
    const r = css / 2;
    g.save();
    g.translate(r, r);
    g.beginPath();
    g.arc(0, 0, r - 2, 0, Math.PI * 2);
    g.clip();
    const pxPerDeg = (r - 2) / 38;
    g.rotate(-d.bank);
    g.translate(0, d.pitch * DEG * pxPerDeg);
    g.fillStyle = '#3f78b8';
    g.fillRect(-r * 2, -r * 4, r * 4, r * 4);
    g.fillStyle = '#6a5440';
    g.fillRect(-r * 2, 0, r * 4, r * 4);
    g.strokeStyle = '#EDEDE7';
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(-r * 2, 0); g.lineTo(r * 2, 0); g.stroke();
    g.lineWidth = 1.5;
    g.font = '600 9px "Martian Mono", monospace';
    g.fillStyle = '#EDEDE7';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (let a = -90; a <= 90; a += 10) {
      if (a === 0) continue;
      const y = -a * pxPerDeg;
      const w = a % 30 === 0 ? 18 : 10;
      g.beginPath(); g.moveTo(-w, y); g.lineTo(w, y); g.stroke();
      if (a % 30 === 0) { g.fillText(String(Math.abs(a)), -w - 10, y); g.fillText(String(Math.abs(a)), w + 10, y); }
    }
    g.restore();
    // The ring and the aircraft symbol.
    g.save();
    g.translate(r, r);
    g.strokeStyle = '#0E1A2B';
    g.lineWidth = 4;
    g.beginPath(); g.arc(0, 0, r - 2, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = '#FF7A1A';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(-34, 0); g.lineTo(-12, 0); g.lineTo(0, 9); g.lineTo(12, 0); g.lineTo(34, 0);
    g.stroke();
    g.restore();
  }

  _horizon(d) {
    const c = this.canvas;
    const css = Math.min(window.innerWidth, window.innerHeight) * 0.62;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const px = Math.round(css * dpr);
    if (this._size !== px) {
      this._size = px;
      c.width = px; c.height = px;
      c.style.width = `${css}px`; c.style.height = `${css}px`;
    }
    const g = this.ctx;
    const S = px;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, S, S);
    g.save();
    g.translate(S / 2, S / 2);
    g.scale(dpr, dpr);
    const half = css / 2;
    const pxPerDeg = css / H.ladderSpan;

    // The horizon and ladder turn against the bank and slide with the pitch.
    g.save();
    g.rotate(-d.bank);
    const pitchDeg = d.pitch * DEG;
    g.translate(0, pitchDeg * pxPerDeg);
    g.lineWidth = 2;
    g.strokeStyle = 'rgba(237,237,231,0.92)';
    g.fillStyle = 'rgba(237,237,231,0.92)';
    g.font = '600 11px "Martian Mono", monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    // The horizon line, in the signal colour, with a gap at the centre.
    g.strokeStyle = '#FF7A1A';
    g.beginPath();
    g.moveTo(-half * 1.4, 0); g.lineTo(-half * 0.16, 0);
    g.moveTo(half * 0.16, 0); g.lineTo(half * 1.4, 0);
    g.stroke();
    g.strokeStyle = 'rgba(237,237,231,0.85)';
    for (let a = -90; a <= 90; a += H.ladderStep) {
      if (a === 0) continue;
      const y = -a * pxPerDeg;
      // Only the rungs near the view.
      if (Math.abs(y + pitchDeg * pxPerDeg) > half * 1.1) continue;
      const w = half * 0.2;
      g.beginPath();
      if (a > 0) {
        g.moveTo(-w, y); g.lineTo(-w * 0.35, y);
        g.moveTo(w * 0.35, y); g.lineTo(w, y);
        g.moveTo(-w, y); g.lineTo(-w, y + 5);
        g.moveTo(w, y); g.lineTo(w, y + 5);
      } else {
        g.setLineDash([5, 5]);
        g.moveTo(-w, y); g.lineTo(w, y);
        g.moveTo(-w, y); g.lineTo(-w, y - 5);
        g.moveTo(w, y); g.lineTo(w, y - 5);
      }
      g.stroke();
      g.setLineDash([]);
      g.fillText(String(Math.abs(a)), -w - 16, y);
      g.fillText(String(Math.abs(a)), w + 16, y);
    }
    g.restore();

    // Flight path marker: where the aircraft is going, against where it points.
    const fx = -d.beta * DEG * pxPerDeg;
    const fy = d.alpha * DEG * pxPerDeg;
    g.strokeStyle = '#34D17A';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(fx, fy, 7, 0, Math.PI * 2);
    g.moveTo(fx - 17, fy); g.lineTo(fx - 7, fy);
    g.moveTo(fx + 7, fy); g.lineTo(fx + 17, fy);
    g.moveTo(fx, fy - 7); g.lineTo(fx, fy - 15);
    g.stroke();

    // The aircraft: a fixed reference at the centre.
    g.strokeStyle = 'rgba(237,237,231,0.95)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(-26, 0); g.lineTo(-10, 0); g.lineTo(0, 8); g.lineTo(10, 0); g.lineTo(26, 0);
    g.stroke();
    g.restore();
  }
}
