// The dashboard, bottom right: speed and revs, in one of two faces the garage
// offers.
//
//   digital  a rectangular rev bar that runs into red at the redline, with the
//            gear and the speed in the same panel
//   classic  an analog rev counter and speedometer, side by side
//
// Speeds are miles per hour everywhere the player reads one; MPH below is the
// one conversion.
//
// Render time only, reading the Gearbox and the physics; nothing here reaches
// the car. The DOM is touched only when a shown value changes, and the classic
// dial faces are drawn once per chassis into an offscreen canvas, so a frame
// costs two needles and two numbers.

import { AUDIO } from '../data/tuning.js';
import { CSS } from '../data/palette.js';

export const MPH = 2.236936; // miles per hour in one metre per second
export const toMph = (ms) => ms * MPH;

export const SPEEDO_STYLES = [
  { id: 'digital', name: 'Digital' },
  { id: 'classic', name: 'Classic' },
];
export const DEFAULT_SPEEDO = 'digital';
export const normalizeSpeedo = (id) => (SPEEDO_STYLES.some((s) => s.id === id) ? id : DEFAULT_SPEEDO);

// Digital: segments in the rev bar, which spans idle-off to the redline, and
// the fraction of it from which the segments are red.
const SEGMENTS = 36;
const RED_FROM = 0.85;

// Classic: each dial's diameter and the gap between them, CSS px. The needle
// sweeps 270 degrees clockwise from bottom left, leaving the bottom of the
// dial for the readout.
const DIAL = 172;
const GAP = 14;
const SWEEP_FROM = Math.PI * 0.75;
const SWEEP = Math.PI * 1.5;
const ang = (t) => SWEEP_FROM + SWEEP * Math.min(1, Math.max(0, t));

const MONO = "'Martian Mono', ui-monospace, 'SF Mono', Menlo, monospace";
const SANS = "'Archivo', system-ui, -apple-system, 'Segoe UI', sans-serif";
const FACE = 'rgba(14, 26, 43, 0.92)';
const RIM = 'rgba(237, 237, 231, 0.28)';
const DIM = 'rgba(237, 237, 231, 0.6)';

export class Speedo {
  constructor(uiRoot) {
    this.el = uiRoot.querySelector('.speedo');
    this.modeEl = this.el.querySelector('.speedo-mode');
    this.digitalEl = this.el.querySelector('.speedo-digital');
    this.classicEl = this.el.querySelector('.speedo-classic');

    const bar = this.digitalEl.querySelector('.rev-bar');
    this.segs = [];
    for (let i = 0; i < SEGMENTS; i++) {
      const s = document.createElement('i');
      if (i >= Math.floor(SEGMENTS * RED_FROM)) s.className = 'red';
      bar.append(s);
      this.segs.push(s);
    }
    this.gearEl = this.digitalEl.querySelector('.digi-gear');
    this.speedEl = this.digitalEl.querySelector('.digi-speed');
    this.rpmEl = this.digitalEl.querySelector('.digi-rpm');

    this.canvas = this.classicEl.querySelector('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.face = document.createElement('canvas');

    this.style = DEFAULT_SPEEDO;
    this.voice = null;
    this._faceKey = '';
    this._reset();
    // The dial numbers are drawn once and cached. If that happened before the
    // mono face loaded, draw them again once it has.
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { this._faceKey = ''; this._reset(); });
  }

  setStyle(id) {
    this.style = normalizeSpeedo(id);
    this.digitalEl.hidden = this.style !== 'digital';
    this.classicEl.hidden = this.style !== 'classic';
    this._reset();
  }

  // The chassis sets the scales: its redline, and its top speed.
  setCar(voice, topSpeed) {
    this.voice = voice;
    // The rev counter reads a little past the redline, so the red zone has
    // somewhere to be; the speedometer runs to the next 20 above top speed.
    this.rpmMax = Math.ceil((voice.redline * 1.12) / 1000) * 1000;
    this.mphMax = Math.ceil((toMph(topSpeed) + 10) / 20) * 20;
    this._faceKey = '';
    this._reset();
  }

  _reset() {
    this._lit = 0;
    for (const s of this.segs) s.classList.remove('on');
    this._text = { gear: null, speed: null, rpm: null, mode: null, cue: null, limit: null };
    this._drawn = '';
  }

  // mph: road speed. rpm and gear: the Gearbox's. manual: the player is doing
  // the shifting, so the shift cue can show. limiting: on the rev limiter.
  update(mph, rpm, gear, manual, limiting) {
    const v = this.voice;
    if (!v) return;
    const t = this._text;
    const speed = Math.round(Math.abs(mph));
    const cue = manual && v.gears > 1 && rpm >= v.redline * AUDIO.shiftUp;
    const mode = manual ? 'Manual' : 'Auto';
    if (t.mode !== mode) { this.modeEl.textContent = mode; t.mode = mode; }
    if (t.cue !== cue) { this.el.classList.toggle('shift-cue', cue); t.cue = cue; }
    if (t.limit !== limiting) { this.el.classList.toggle('limit', limiting); t.limit = limiting; }
    if (this.style === 'classic') this._classic(speed, rpm, gear, cue);
    else this._digital(speed, rpm, gear);
  }

  _digital(speed, rpm, gear) {
    const t = this._text;
    const lit = Math.max(0, Math.min(SEGMENTS, Math.round((rpm / this.voice.redline) * SEGMENTS)));
    // Only the segments between the old count and the new one change.
    for (let i = Math.min(lit, this._lit); i < Math.max(lit, this._lit); i++) {
      this.segs[i].classList.toggle('on', i < lit);
    }
    this._lit = lit;
    if (t.gear !== gear) { this.gearEl.textContent = gear; t.gear = gear; }
    if (t.speed !== speed) { this.speedEl.textContent = String(speed); t.speed = speed; }
    // To the nearest 50, so the last digits are not a blur.
    const r = Math.round(rpm / 50) * 50;
    if (t.rpm !== r) { this.rpmEl.textContent = `${r.toLocaleString('en-US')} rpm`; t.rpm = r; }
  }

  _classic(speed, rpm, gear, cue) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const key = `${dpr}|${this.rpmMax}|${this.mphMax}|${this.voice.redline}`;
    if (key !== this._faceKey) {
      this._drawFace(dpr);
      this._faceKey = key;
      this._drawn = '';
    }
    const rpmT = rpm / this.rpmMax;
    const mphT = speed / this.mphMax;
    const sig = `${rpmT.toFixed(3)}|${speed}|${gear}|${cue}`;
    if (sig === this._drawn) return;
    this._drawn = sig;

    const c = this.ctx;
    const r = DIAL / 2;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    c.drawImage(this.face, 0, 0);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    this._needle(r, r, r, rpmT);
    this._needle(DIAL + GAP + r, r, r, mphT);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    // The gear sits in the rev counter, the speed in the speedometer, both in
    // the open bottom of the dial the needle never sweeps.
    c.font = `700 30px ${MONO}`;
    c.fillStyle = cue ? CSS.signal : CSS.offwhite;
    c.fillText(gear, r, r + r * 0.42);
    c.font = `700 24px ${MONO}`;
    c.fillStyle = CSS.signal;
    c.fillText(String(speed), DIAL + GAP + r, r + r * 0.42);
  }

  _needle(cx, cy, r, t) {
    const c = this.ctx;
    const a = ang(t), ca = Math.cos(a), sa = Math.sin(a);
    c.beginPath();
    c.moveTo(cx - ca * r * 0.14, cy - sa * r * 0.14);
    c.lineTo(cx + ca * r * 0.8, cy + sa * r * 0.8);
    c.lineWidth = 3;
    c.lineCap = 'butt';
    c.strokeStyle = CSS.signal;
    c.stroke();
    c.beginPath();
    c.arc(cx, cy, r * 0.07, 0, Math.PI * 2);
    c.fillStyle = CSS.offwhite;
    c.fill();
  }

  _drawFace(dpr) {
    const W = DIAL * 2 + GAP, H = DIAL;
    for (const cv of [this.face, this.canvas]) {
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
    }
    this.canvas.style.width = `${W}px`;
    this.canvas.style.height = `${H}px`;
    const g = this.face.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    const r = DIAL / 2;
    this._dial(g, r, r, r, this.rpmMax, 1000, 500, (v) => String(v / 1000), this.voice.redline, '×1000 rpm');
    this._dial(g, DIAL + GAP + r, r, r, this.mphMax, 20, 10, (v) => String(v), null, 'mph');
  }

  _dial(g, cx, cy, r, max, major, minor, label, redFrom, unit) {
    g.beginPath();
    g.arc(cx, cy, r - 1.5, 0, Math.PI * 2);
    g.fillStyle = FACE;
    g.fill();
    g.lineWidth = 2;
    g.strokeStyle = RIM;
    g.stroke();

    if (redFrom != null) {
      g.beginPath();
      g.arc(cx, cy, r * 0.855, ang(redFrom / max), ang(1));
      g.lineWidth = r * 0.07;
      g.lineCap = 'butt';
      g.strokeStyle = CSS.redline;
      g.stroke();
    }

    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `600 ${Math.round(r * 0.13)}px ${MONO}`;
    const n = Math.round(max / minor);
    for (let k = 0; k <= n; k++) {
      const v = k * minor;
      const isMajor = v % major === 0;
      const a = ang(v / max), ca = Math.cos(a), sa = Math.sin(a);
      const r0 = isMajor ? r * 0.74 : r * 0.8, r1 = r * 0.9;
      const red = redFrom != null && v >= redFrom;
      g.beginPath();
      g.moveTo(cx + ca * r0, cy + sa * r0);
      g.lineTo(cx + ca * r1, cy + sa * r1);
      g.lineWidth = isMajor ? 2.5 : 1.2;
      g.strokeStyle = red ? CSS.redline : CSS.offwhite;
      g.stroke();
      if (isMajor) {
        g.fillStyle = red ? CSS.redline : CSS.offwhite;
        g.fillText(label(v), cx + ca * r * 0.6, cy + sa * r * 0.6);
      }
    }

    g.font = `500 ${Math.round(r * 0.1)}px ${SANS}`;
    g.fillStyle = DIM;
    g.fillText(unit, cx, cy + r * 0.7);
  }
}
