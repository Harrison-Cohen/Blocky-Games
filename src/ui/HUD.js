// The in-race timing readout: lap counter, running lap time, best, live delta,
// sector flash and the minimap.
//
// This class owns no state of its own. It reads LapTimer and draws it. Every
// write to the DOM is guarded by a comparison against what is already there,
// because setting textContent to the value it already holds still costs a style
// recalculation, and this runs every frame.
//
// The minimap redraws only when the car has actually moved a pixel's worth, for
// the same reason.

import { formatTime, formatDelta } from '../game/LapTimer.js';

export class HUD {
  constructor(root) {
    this.el = root.querySelector('.lap-hud');
    this.numberEl = root.querySelector('.lap-number');
    this.currentEl = root.querySelector('.lap-current');
    this.bestEl = root.querySelector('.lap-best-time');
    this.deltaEl = root.querySelector('.lap-delta');
    this.flashEl = root.querySelector('.sector-flash');

    this.mapEl = root.querySelector('.minimap');
    this.canvas = root.querySelector('.minimap-canvas');
    this.ctx = this.canvas.getContext('2d');

    this._cur = '';
    this._best = '';
    this._delta = '';
    this._deltaClass = '';
    this._lap = '';
    this._flash = '';
    this._invalid = null;
    this._mapDrawn = false;
    this._carPx = -1;
    this._carPy = -1;
  }

  show() {
    this.el.hidden = false;
    this.mapEl.hidden = false;
  }

  hide() {
    this.el.hidden = true;
    this.mapEl.hidden = true;
    this.flashEl.hidden = true;
  }

  update(timer, track, physics) {
    // Lap number counts the lap you are ON, so it is one past the finished ones.
    const lapNo = String(timer.laps.length + 1);
    if (lapNo !== this._lap) { this.numberEl.textContent = lapNo; this._lap = lapNo; }

    const cur = timer.running ? formatTime(timer.lapTime) : '0:00.000';
    if (cur !== this._cur) { this.currentEl.textContent = cur; this._cur = cur; }

    const invalid = timer.running && timer.invalid;
    if (invalid !== this._invalid) {
      this.currentEl.classList.toggle('invalid', invalid);
      this._invalid = invalid;
    }

    const best = timer.best === null ? '--:--.---' : formatTime(timer.best);
    if (best !== this._best) { this.bestEl.textContent = best; this._best = best; }

    const delta = timer.delta === null ? '' : formatDelta(timer.delta);
    if (delta !== this._delta) { this.deltaEl.textContent = delta; this._delta = delta; }
    const dClass = timer.delta === null ? '' : timer.deltaColour;
    if (dClass !== this._deltaClass) {
      this.deltaEl.className = `lap-line lap-delta ${dClass}`;
      this._deltaClass = dClass;
    }

    const flash = timer.flash;
    const flashKey = flash ? `${flash.colour}|${flash.text}` : '';
    if (flashKey !== this._flash) {
      if (flash) {
        this.flashEl.textContent = flash.text;
        this.flashEl.className = `sector-flash ${flash.colour}`;
        this.flashEl.hidden = false;
      } else {
        this.flashEl.hidden = true;
      }
      this._flash = flashKey;
    }

    this._drawMinimap(track, physics);
  }

  _drawMinimap(track, p) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const mm = track.minimap;

    if (!this._mapDrawn || this._track !== track) {
      // Fit the whole circuit with a margin, preserving aspect so the shape on
      // the minimap is the shape of the road.
      const pad = 14;
      const spanX = mm.maxX - mm.minX || 1;
      const spanZ = mm.maxZ - mm.minZ || 1;
      this._scale = Math.min((w - pad * 2) / spanX, (h - pad * 2) / spanZ);
      this._ox = (w - spanX * this._scale) / 2 - mm.minX * this._scale;
      this._oy = (h - spanZ * this._scale) / 2 - mm.minZ * this._scale;
      this._track = track;
      this._mapDrawn = true;
      this._carPx = -1;
    }

    const px = p.x * this._scale + this._ox;
    const py = p.z * this._scale + this._oy;
    // Redrawing an unchanged minimap every frame is pure waste.
    if (Math.abs(px - this._carPx) < 0.5 && Math.abs(py - this._carPy) < 0.5) return;
    this._carPx = px;
    this._carPy = py;

    ctx.clearRect(0, 0, w, h);

    ctx.beginPath();
    const path = mm.path;
    for (let i = 0; i < path.length; i += 2) {
      const x = path[i] * this._scale + this._ox;
      const y = path[i + 1] * this._scale + this._oy;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = 'rgba(237, 237, 231, 0.55)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Start line marker, so the map tells you which way round it goes.
    const sIdx = track.startSample;
    ctx.beginPath();
    ctx.arc(track.px[sIdx] * this._scale + this._ox, track.pz[sIdx] * this._scale + this._oy,
      3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(237, 237, 231, 0.8)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(px, py, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = '#ff7a1a';
    ctx.fill();
  }
}
