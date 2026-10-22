// The map: a full-screen picture of the world, drawn from the world's own data
// (src/world/MapData.js), with every airport and every race track on it, the
// aircraft, and a list of the airports by how far they are. Pick one and teleport
// to it, on its apron, on its runway or in the air above it.
//
//   mouse    wheel zooms (about the pointer), drag pans, click picks a place
//   keys     up and down (or W and S) pick an airport, left and right (or A and D)
//            the kind of start, Enter teleports, Esc or M closes
//   pad      the d-pad picks and chooses the start, A teleports, B or Start closes
//
// The picture is made a few milliseconds a frame the first time the map opens
// (the flight game calls `tick`), then kept.

import { MAP } from '../data/tuning.js';
import {flightMapCache} from '../world/FlightMapCache.js';
import {mapX,mapY,mapLine} from './FlightMapView.js';
import {FLIGHT_NAV as NAV} from '../data/tuning.js';
import { distanceIn, altitudeIn } from '../flight/Units.js';

const css = (hex) => `#${hex.toString(16).padStart(6, '0')}`;
const KIND = { major: 'Major airport', military: 'Air base', regional: 'Regional airport', strip: 'Airstrip', heliport: 'Heliport' };
const MODES = [['apron', 'On the apron'], ['runway', 'On the runway'], ['air', 'In the air'], ['hangar', 'At the hangar']];
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const fmt = (v) => Math.round(v).toLocaleString('en-US');

export class MapScreen {
  constructor(root) {
    this.icon = 'delta';          // the aircraft's silhouette: 'delta' or 'airliner' (the game sets it)
    this.el = document.createElement('section');
    this.el.className = 'map-screen';
    this.el.hidden = true;
    this.el.innerHTML = `
      <aside class="map-side">
        <h1>Map</h1>
        <p class="map-sub"></p>
        <button type="button" class="map-plan-toggle">Plan a trip</button>
        <div class="map-planner" hidden></div>
        <ul class="map-list"></ul>
        <div class="map-detail"></div>
        <div class="map-modes"></div>
        <button type="button" class="map-go"></button>
        <button type="button" class="map-close">Close the map</button>
        <p class="map-hint">Up and down choose an airport, left and right the start, Enter teleports, Esc closes. Wheel zooms, drag pans.</p>
      </aside>
      <div class="map-view"><canvas class="map-canvas"></canvas><div class="map-status"></div></div>`;
    root.append(this.el);
    this.sub = this.el.querySelector('.map-sub');
    this.listEl = this.el.querySelector('.map-list');
    this.detailEl = this.el.querySelector('.map-detail');
    this.modesEl = this.el.querySelector('.map-modes');
    this.goEl = this.el.querySelector('.map-go');
    this.canvas = this.el.querySelector('.map-canvas');
    this.statusEl = this.el.querySelector('.map-status');
    this.ctx = this.canvas.getContext('2d');
    this.plannerEl=this.el.querySelector('.map-planner');
    this.planToggle=this.el.querySelector('.map-plan-toggle');
    this.planToggle.onclick=()=>this._planning(!this.planning);
    this.canvas.tabIndex=0;this.canvas.setAttribute('aria-label','World map');
    this.visible = false;

    this.raster = null;
    this.off = null;            // the picture as a canvas
    this.view = { x: 0, z: 0, zoom: 1 };
    this.items = [];            // the airports, nearest first
    this.sel = 0;
    this.mode = 'apron';
    this.hover = null;
    this._dirty = true;
    this._drag = null;
    this._w = 0; this._h = 0;

    this.modeBtns = MODES.map(([id, label]) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'map-mode'; b.textContent = label;
      b.addEventListener('click', () => this._setMode(id));
      this.modesEl.append(b);
      return b;
    });
    this.goEl.addEventListener('click', () => this._teleport());
    this.el.querySelector('.map-close').addEventListener('click', () => { if (this.respawn) { this.hide(); this.ctx0.onExit(); } else this.close(); });
    this.canvas.addEventListener('wheel', (e) => { e.preventDefault(); this._zoomAt(e, e.deltaY < 0 ? 1 : -1); }, { passive: false });
    this.canvas.addEventListener('pointerdown', (e) => this._down(e));
    this.canvas.addEventListener('pointermove', (e) => this._move(e));
    this.canvas.addEventListener('pointerup', (e) => this._up(e));
    this.canvas.addEventListener('pointerleave', () => { if (this.hover) { this.hover = null; this._dirty = true; } });
    this._onKey = this._onKey.bind(this);
    this._onResize = () => { this._dirty = true; };
  }

  // ctx: { world, places, state() -> { x, z, heading }, units, onClose, onTeleport(airport, mode) }
  open(ctx) {
    this.ctx0 = ctx;
    const w = ctx.world;
    this.world = w;
    this.cache=flightMapCache(w);this.raster=this.cache.raster;this.off=this.cache.canvas;
    this._built=this.raster.row>0;this._revision=-1;
    this.respawn = !!ctx.respawn;
    this.mode = this.respawn ? 'hangar' : ctx.places.teleportMode;
    this.planToggle.hidden=this.respawn||!ctx.route;this.planning=false;this.plannerEl.hidden=true;this.planToggle.textContent='Plan a trip';this.listEl.hidden=false;this.detailEl.hidden=false;this.goEl.hidden=false;
    this.candidate={x:ctx.state().x,z:ctx.state().z,label:'Map point'};this.stopIndex=0;this.planFocus=0;
    this.el.querySelector('h1').textContent = this.respawn ? 'Choose a respawn airport' : 'Map';
    this.modesEl.hidden = this.respawn;
    this.el.querySelector('.map-close').textContent = this.respawn ? 'Back to the title' : 'Close the map';
    this.el.querySelector('.map-hint').textContent = this.respawn
      ? 'Up/down choose an airport. Enter or pad A/Start respawns at its hangar apron. Esc/B opens the exit choices. Wheel zooms, drag pans.'
      : 'Up and down choose an airport, left and right the start, Enter teleports, Esc closes. Wheel zooms, drag pans.';
    const me = ctx.state();
    // The airports, nearest first.
    this.items = [...w.airports.list].sort((a, b) => Math.hypot(a.px - me.x, a.pz - me.z) - Math.hypot(b.px - me.x, b.pz - me.z));
    const selected = this.respawn ? ctx.places.nearestEligible(me.x, me.z, 'hangar') : ctx.places.last;
    this.sel = Math.max(0, this.items.indexOf(selected));
    this.view.x = me.x; this.view.z = me.z; this.view.zoom = 2;
    this._buildList();
    this._select(this.sel, false);
    this.el.hidden = false;
    this.visible = true;
    this._dirty = true;
    window.addEventListener('keydown', this._onKey);
    window.addEventListener('resize', this._onResize);
  }

  close() {
    if (!this.visible) return;
    this.hide();
    if (this.ctx0.onClose) this.ctx0.onClose();
  }

  hide() {
    if (!this.visible) return;
    this.visible = false;
    this.el.hidden = true;
    window.removeEventListener('keydown', this._onKey);
    window.removeEventListener('resize', this._onResize);
  }

  // Once a frame while open: build the picture a little at a time, draw what changed.
  tick() {
    if (!this.visible) return;
    if(this._revision!==this.cache.revision){this.off=this.cache.canvas;this._revision=this.cache.revision;this._built=this.raster.row>0;this._dirty=true;}
    this.statusEl.hidden=this.raster.row===this.raster.n;
    this.statusEl.textContent=`Drawing the map ${Math.round(100*this.raster.row/this.raster.n)}%`;
    if (this._dirty) { this._dirty = false; this._draw(); }
  }

  handlePad(m) {
    if (!this.visible) return;
    if (this.planning) {
      if(m.back&&this._cursorFocus()){this.cursorMode=false;this._planFocus(0);return;}
      if(m.back||m.start){this.close();return;}
      if(this._cursorFocus()){
        if(m.left)this._cursorMove(-1,0);if(m.right)this._cursorMove(1,0);
        if(m.up)this._cursorMove(0,-1);if(m.down)this._cursorMove(0,1);
        if(m.confirm)this._addCandidate();
      }else{
        if(m.up)this._planFocus(-1);if(m.down)this._planFocus(1);
        if(m.left)this._planFocus(-1);if(m.right)this._planFocus(1);
        if(m.confirm)this.planButtons[this.planFocus]?.click();
      }
      return;
    }
    // Tab to the planner button with keyboard, or open it with pad left+right menu focus.
    if(document.activeElement===this.planToggle&&m.down){this.planToggle.blur();this._select(0,false);return;}
    if(m.confirm&&document.activeElement===this.planToggle){this.planToggle.click();return;}
    if(m.up&&this.sel===0&&!this.respawn&&this.ctx0.route){this.planToggle.focus();return;}
    if (m.up) this._select(this.sel - 1);
    if (m.down) this._select(this.sel + 1);
    if (m.left) this._shiftMode(-1);
    if (m.right) this._shiftMode(1);
    if (m.confirm || (this.respawn && m.start)) this._teleport();
    if (m.back || (!this.respawn && m.start)) this.close();
  }

  _planning(on){
    if(this.respawn||!this.ctx0.route)return;
    this.planning=on;this.plannerEl.hidden=!on;this.listEl.hidden=on;this.detailEl.hidden=on;this.modesEl.hidden=on;this.goEl.hidden=on;
    this.planToggle.textContent=on?'Teleport options':'Plan a trip';
    this.el.querySelector('.map-hint').textContent=on?'Trip editing never moves the aircraft. Up/down or pad navigate buttons, Enter/A chooses. Tab cycles focus. Map cursor: arrows/pad move, Enter/A adds, Escape/B leaves cursor. Click map to choose a point. Last stop is destination.':'Up/down choose airport, left/right start, Enter teleports. Tab to Plan a trip. Pad: Up above first airport, A opens planner.';
    if(on){this._planner();this.planFocus=0;this._planFocus(0);}this._dirty=true;
  }
  _changed(){this.ctx0.onTripChange?.();this._planner();this._dirty=true;}
  _edit(origin,points){this.ctx0.route.edit(origin,points);this._changed();}
  _planner(){
    const route=this.ctx0.route,t=route.trip;this.plannerEl.replaceChildren();this.planButtons=[];
    const info=document.createElement('p');info.className='map-trip-status';
    info.textContent=`${t.origin?'Origin: '+t.origin.label:'Origin: live position at activation'}. ${route.active?'Active leg '+route.leg+'/'+(route.path.length-1):route.complete?'Trip complete':'Visual guidance until Route AP selected'}. ${route.notice||''}`;this.plannerEl.append(info);
    const button=(label,fn,cls='')=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.className=cls;b.onclick=fn;b.onfocus=()=>{this.planFocus=this.planButtons.indexOf(b);};this.planButtons.push(b);this.plannerEl.append(b);return b;};
    button('Use live origin',()=>this._edit(null,t.points));
    button('Use selected point as origin',()=>this._edit(this.candidate,t.points));
    const selected=document.createElement('p');selected.className='map-candidate';selected.textContent='Selected: '+this.candidate.label;this.plannerEl.append(selected);
    button('Move map cursor',()=>{this.cursorMode=true;this.canvas.focus();this._dirty=true;});
    button('Add selected point as destination',()=>this._addCandidate());
    button('Add selected airport',()=>{const a=this.items[this.sel];this.candidate={x:a.px,z:a.pz,label:a.name,airport:a.id};this._addCandidate();});
    this.stopIndex=Math.max(0,Math.min(this.stopIndex,t.points.length-1));
    t.points.forEach((p,i)=>{
      const airport=p.airport&&this.world.airports.list.find(a=>a.id===p.airport),ok=airport?this.ctx0.places.eligible(airport,'runway'):null;
      button(`${i===this.stopIndex?'Selected: ':''}${i+1}. ${p.label}${i===t.points.length-1?' (destination)':''}${ok&&!ok.ok?' (cannot land: '+ok.why+')':''}`,()=>{this.stopIndex=i;this.view.x=p.x;this.view.z=p.z;this._planner();this._dirty=true;},'map-trip-stop');
    });
    const change=(fn)=>{const pts=t.points.map(p=>({...p}));fn(pts);this._edit(t.origin,pts);};
    button('Move selected stop up',()=>{if(this.stopIndex>0)change(p=>{const i=this.stopIndex;[p[i-1],p[i]]=[p[i],p[i-1]];this.stopIndex--;});});
    button('Move selected stop down',()=>{if(this.stopIndex<t.points.length-1)change(p=>{const i=this.stopIndex;[p[i],p[i+1]]=[p[i+1],p[i]];this.stopIndex++;});});
    button('Delete selected stop',()=>change(p=>p.splice(this.stopIndex,1)));
    button('Reverse trip',()=>{if(!t.points.length)return;const pts=[t.origin||{...this.ctx0.state(),label:'Current position'},...t.points].reverse();this._edit(pts.shift(),pts);});
    button('Activate trip',()=>{this.ctx0.onTripChange?.();route.activate(this.ctx0.state());this._changed();});
    button('Activate leg ending at selected stop',()=>{this.ctx0.onTripChange?.();route.activate(this.ctx0.state(),this.stopIndex+1);this._changed();});
    button('Cancel guidance',()=>{route.reset();this._changed();});
    button('Clear trip',()=>this._edit(null,[]));
    button('Navigation zoom in',()=>this.ctx0.onRange?.(-1));button('Navigation zoom out',()=>this.ctx0.onRange?.(1));
    button('Teleport options',()=>this._planning(false));
    this.planFocus=Math.min(this.planFocus,this.planButtons.length-1);
  }
  _planFocus(dir){this.planFocus=(this.planFocus+dir+this.planButtons.length)%this.planButtons.length;this.planButtons[this.planFocus].focus();}
  _cursorFocus(){return this.cursorMode&&document.activeElement===this.canvas;}
  _cursorMove(dx,dy){const ppm=this._ppm();this.candidate={x:clamp(this.candidate.x-dx*24/ppm,-this.world.cfg.size/2,this.world.cfg.size/2),z:clamp(this.candidate.z-dy*24/ppm,-this.world.cfg.size/2,this.world.cfg.size/2),label:'Map point'};this.view.x=this.candidate.x;this.view.z=this.candidate.z;this._dirty=true;}
  _addCandidate(){
    const t=this.ctx0.route.trip,prev=t.points.at(-1)||t.origin;
    if(t.points.length>=NAV.maxPoints||(prev&&Math.hypot(prev.x-this.candidate.x,prev.z-this.candidate.z)<NAV.minLeg)){this.ctx0.route.notice='Point too close or trip is full';this._planner();return;}
    this._edit(t.origin,[...t.points,{...this.candidate}]);
  }

  // --- the list and the detail --------------------------------------------------------------
  _buildList() {
    const me = this.ctx0.state(), units = this.ctx0.units;
    this.listEl.replaceChildren();
    this.items.forEach((a, i) => {
      const li = document.createElement('li');
      li.className = 'map-item';
      const d = distanceIn(Math.hypot(a.px - me.x, a.pz - me.z), units);
      li.innerHTML = '<span class="map-name"></span><span class="map-meta"></span>';
      li.querySelector('.map-name').textContent = a.name;
      const eligible = this.ctx0.places.eligible(a, this.mode);
      li.classList.toggle('map-ineligible', this.respawn && !eligible.ok);
      const size = a.isHeliport ? 'helipad' : `${fmt(a.length)} by ${a.layout.width} m`;
      li.querySelector('.map-meta').textContent = `${KIND[a.tier]}, ${size}, ${d.value.toFixed(d.value < 10 ? 1 : 0)} ${d.unit}${this.respawn ? eligible.ok ? ', available' : ', ' + eligible.why : ''}`;
      li.addEventListener('click', () => this._select(i));
      this.listEl.append(li);
    });
  }

  _select(i, centre = true) {
    this.sel = (i + this.items.length) % this.items.length;
    [...this.listEl.children].forEach((li, k) => li.classList.toggle('focused', k === this.sel));
    const li = this.listEl.children[this.sel];
    if (li && li.scrollIntoView) li.scrollIntoView({ block: 'nearest' });
    const a = this.items[this.sel];
    if (centre) { this.view.x = a.px; this.view.z = a.pz; this.view.zoom = Math.max(this.view.zoom, 6); }
    this._detail();
    this._dirty = true;
  }

  _setMode(id) {
    if (this.respawn) return;
    this.mode = id;
    this.ctx0.places.setTeleportMode(id);
    this._detail();
  }

  _shiftMode(d) {
    if (this.respawn) return;
    const i = MODES.findIndex(([id]) => id === this.mode);
    this._setMode(MODES[(i + d + MODES.length) % MODES.length][0]);
  }

  _detail() {
    const a = this.items[this.sel], me = this.ctx0.state(), units = this.ctx0.units;
    const ok = this.ctx0.places.eligible(a, this.mode);
    const d = distanceIn(Math.hypot(a.px - me.x, a.pz - me.z), units);
    const brg = ((Math.round((Math.atan2(-(a.px - me.x), a.pz - me.z) * 180) / Math.PI) % 360) + 360) % 360;
    const el = altitudeIn(a.base, units);
    const L = a.layout;
    const rwy = a.isHeliport ? 'Helipad' : `Runway ${L.designators.map((n) => String(n).padStart(2, '0')).join(' and ')}, ${fmt(L.length)} m by ${L.width} m`;
    this.detailEl.replaceChildren();
    const row = (t, cls = '') => { const p = document.createElement('p'); p.className = cls; p.textContent = t; this.detailEl.append(p); };
    row(a.name, 'map-detail-name');
    row(`${KIND[a.tier]}. ${rwy}.`);
    row(`${fmt(el.value)} ${el.unit} above the sea, ${d.value.toFixed(d.value < 10 ? 1 : 0)} ${d.unit} away on ${String(brg).padStart(3, '0')}, ${L.zones.length} hangar ${L.zones.length === 1 ? 'bay' : 'bays'}.`);
    if (!ok.ok) row(`${ok.why} for the ${this.ctx0.defName || 'aircraft'}: pick another start.`, 'map-detail-off');
    this.modeBtns.forEach((b, i) => {
      b.classList.toggle('on', MODES[i][0] === this.mode);
      const e = this.ctx0.places.eligible(a, MODES[i][0]);
      b.classList.toggle('off', !e.ok);
    });
    this.goEl.textContent = `${this.respawn ? 'Respawn at' : 'Teleport to'} ${a.name}`;
    this.goEl.disabled = !ok.ok;
    this.goEl.classList.toggle('off', !ok.ok);
    this.sub.textContent = this.respawn ? this.ctx0.reason : `${this.items.length} airports, ${this.world.areas.list.length} race tracks`;
  }

  _teleport() {
    const a = this.items[this.sel];
    if (!this.ctx0.places.eligible(a, this.mode).ok) return;
    if (this.respawn) {
      // A stale destination rejected by the spawn guard must leave the list usable.
      if (this.ctx0.onTeleport(a, this.mode) !== false) this.hide();
      else this._detail();
    } else {
      this.hide();
      this.ctx0.onTeleport(a, this.mode);
    }
  }

  // --- the view --------------------------------------------------------------------------------
  _ppm() { return (Math.min(this._w, this._h) * this.view.zoom) / this.world.cfg.size; }

  // World to the canvas, in css pixels: east is to the right (-x), north up (+z).
  _sx(x) { return mapX(x,this.view.x,this._w/this._ppm(),this._w); }
  _sy(z) { return mapY(z,this.view.z,this._w/this._ppm(),this._h,this._w); }

  _zoomAt(e, dir) {
    const rect = this.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const ppm0 = this._ppm();
    // The world point under the pointer stays under it.
    const wx = this.view.x - (mx - this._w / 2) / ppm0, wz = this.view.z - (my - this._h / 2) / ppm0;
    this.view.zoom = clamp(this.view.zoom * (dir > 0 ? MAP.zoomStep : 1 / MAP.zoomStep), MAP.minZoom, MAP.maxZoom);
    const ppm1 = this._ppm();
    this.view.x = wx + (mx - this._w / 2) / ppm1;
    this.view.z = wz + (my - this._h / 2) / ppm1;
    this._clamp();
    this._dirty = true;
  }

  _clamp() {
    const half = this.world.cfg.size / 2;
    this.view.x = clamp(this.view.x, -half, half);
    this.view.z = clamp(this.view.z, -half, half);
  }

  _down(e) {
    this.canvas.setPointerCapture(e.pointerId);
    this._drag = { x: e.clientX, y: e.clientY, vx: this.view.x, vz: this.view.z, moved: false };
  }

  _move(e) {
    const rect = this.canvas.getBoundingClientRect();
    if (this._drag) {
      const dx = e.clientX - this._drag.x, dy = e.clientY - this._drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) this._drag.moved = true;
      const ppm = this._ppm();
      this.view.x = this._drag.vx + dx / ppm;
      this.view.z = this._drag.vz + dy / ppm;
      this._clamp();
      this._dirty = true;
      return;
    }
    const h = this._pick(e.clientX - rect.left, e.clientY - rect.top);
    if (h !== this.hover) { this.hover = h; this._dirty = true; this.canvas.style.cursor = h ? 'pointer' : ''; }
  }

  _up(e) {
    const d = this._drag;
    this._drag = null;
    if (!d || d.moved) return;
    const rect = this.canvas.getBoundingClientRect();
    const h = this._pick(e.clientX - rect.left, e.clientY - rect.top);
    if(this.planning){
      const mx=e.clientX-rect.left,my=e.clientY-rect.top;
      this.candidate=h?{x:h.x,z:h.z,label:h.name,airport:h.kind==='airport'?h.id:''}:{x:this.view.x-(mx-this._w/2)/this._ppm(),z:this.view.z-(my-this._h/2)/this._ppm(),label:'Map point'};
      this._planner();this._dirty=true;return;
    }
    if (h) {
      // A track picks its own airstrip.
      const id = h.kind === 'airport' ? h.id : `strip-${h.id}`;
      const i = this.items.findIndex((a) => a.id === id);
      if (i >= 0) this._select(i, false);
    }
  }

  // The place under a point: an airport or a track, within a few pixels.
  _pick(mx, my) {
    let best = null, bd = 14;
    for (const m of this._places()) {
      const d = Math.hypot(this._sx(m.x) - mx, this._sy(m.z) - my);
      if (d < bd) { bd = d; best = m; }
    }
    return best;
  }

  _places() {
    return this.cache.markers;
  }

  _onKey(e) {
    if (!this.visible) return;
    const c = e.code;
    if(c==='Tab')return;
    if(!this.planning&&e.target?.tagName==='BUTTON'&&(c==='Enter'||c==='Space')){e.preventDefault();e.target.click();return;}
    if(this.planning){
      if(this._cursorFocus()){
        if(c==='Escape'){this.cursorMode=false;this._planFocus(0);}
        else if(c==='ArrowLeft'||c==='KeyA')this._cursorMove(-1,0);
        else if(c==='ArrowRight'||c==='KeyD')this._cursorMove(1,0);
        else if(c==='ArrowUp'||c==='KeyW')this._cursorMove(0,-1);
        else if(c==='ArrowDown'||c==='KeyS')this._cursorMove(0,1);
        else if(c==='Enter'||c==='Space')this._addCandidate();else return;
      }else if(c==='Escape'||c==='KeyM')this.close();
      else if(c==='ArrowUp'||c==='KeyW')this._planFocus(-1);
      else if(c==='ArrowDown'||c==='KeyS')this._planFocus(1);
      else if(c==='Enter'||c==='Space'){if(e.target?.tagName==='BUTTON')e.target.click();else this.planButtons[this.planFocus]?.click();}
      else return;
      e.preventDefault();return;
    }
    if (c === 'ArrowUp' || c === 'KeyW') this._select(this.sel - 1);
    else if (c === 'ArrowDown' || c === 'KeyS') this._select(this.sel + 1);
    else if (c === 'ArrowLeft' || c === 'KeyA') this._shiftMode(-1);
    else if (c === 'ArrowRight' || c === 'KeyD') this._shiftMode(1);
    else if (c === 'Enter' || c === 'Space') this._teleport();
    else if (c === 'Escape' || c === 'KeyM') this.close();
    else if (c === 'Equal' || c === 'NumpadAdd') { this.view.zoom = clamp(this.view.zoom * MAP.zoomStep, MAP.minZoom, MAP.maxZoom); this._dirty = true; }
    else if (c === 'Minus' || c === 'NumpadSubtract') { this.view.zoom = clamp(this.view.zoom / MAP.zoomStep, MAP.minZoom, MAP.maxZoom); this._dirty = true; }
    else return;
    e.preventDefault();
  }

  // --- drawing -----------------------------------------------------------------------------------
  _draw() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(rect.width)), h = Math.max(1, Math.round(rect.height));
    if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(h * dpr)) {
      this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr);
      this.canvas.style.width = `${w}px`; this.canvas.style.height = `${h}px`;
    }
    this._w = w; this._h = h;
    const g = this.ctx;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#0e1a2b';
    g.fillRect(0, 0, w, h);
    const half = this.world.cfg.size / 2, ppm = this._ppm();
    if (this._built) {
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = 'high';
      g.drawImage(this.off, this._sx(half), this._sy(half), this.world.cfg.size * ppm, this.world.cfg.size * ppm);
    }
    // The edge of the world.
    g.strokeStyle = 'rgba(237, 237, 231, 0.3)';
    g.lineWidth = 1;
    g.strokeRect(this._sx(half), this._sy(half), this.world.cfg.size * ppm, this.world.cfg.size * ppm);

    const adapter={line:(x,y,xx,yy,c,width)=>{g.strokeStyle=c;g.lineWidth=width;g.beginPath();g.moveTo(x,y);g.lineTo(xx,yy);g.stroke();}};
    for(const pts of this.cache.tracks)for(let i=1;i<pts.length;i++)mapLine(adapter,this._sx(pts[i-1].x),this._sy(pts[i-1].z),this._sx(pts[i].x),this._sy(pts[i].z),'#edede7',1,w,h);
    const route=this.ctx0.route,path=route?.path.length?route.path:route?[route.trip.origin||this.ctx0.state(),...route.trip.points]:[];
    for(let i=1;i<path.length;i++)mapLine(adapter,this._sx(path[i-1].x),this._sy(path[i-1].z),this._sx(path[i].x),this._sy(path[i].z),route.active&&route.leg===i?'#f5c518':'#ff92e0',3,w,h);
    path.forEach((p,i)=>{const x=this._sx(p.x),y=this._sy(p.z);g.fillStyle='#0e1a2b';g.fillRect(x-8,y-8,16,16);g.fillStyle='#ff92e0';g.font='12px Martian Mono';g.textAlign='center';g.fillText(String(i),x,y+4);});
    if(this.planning){const x=this._sx(this.candidate.x),y=this._sy(this.candidate.z);g.strokeStyle='#f5c518';g.lineWidth=2;g.strokeRect(x-8,y-8,16,16);}
    const sel = this.items[this.sel], me = this.ctx0.state();
    const labelAll = this.view.zoom >= MAP.labelZoom;
    g.font = '600 12px Archivo, sans-serif';
    g.textBaseline = 'middle';
    const label = (text, x, y, color = '#edede7') => {
      const tw = g.measureText(text).width;
      g.fillStyle = 'rgba(14, 26, 43, 0.85)';
      g.fillRect(x + 9, y - 9, tw + 10, 18);
      g.fillStyle = color;
      g.textAlign = 'left';
      g.fillText(text, x + 14, y);
    };
    // The line to the chosen airport.
    if (sel && !this.planning) {
      g.strokeStyle = 'rgba(245, 197, 24, 0.7)'; g.setLineDash([5, 5]); g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(this._sx(me.x), this._sy(me.z)); g.lineTo(this._sx(sel.px), this._sy(sel.pz)); g.stroke();
      g.setLineDash([]);
    }
    for (const m of this._places()) {
      const x = this._sx(m.x), y = this._sy(m.z);
      if (x < -40 || y < -40 || x > w + 40 || y > h + 40) continue;
      if (m.kind === 'track') {
        g.fillStyle = css(MAP.track);
        g.strokeStyle = '#0e1a2b'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(x, y - 7); g.lineTo(x + 7, y); g.lineTo(x, y + 7); g.lineTo(x - 7, y); g.closePath(); g.stroke(); g.fill();
        if (labelAll || this.hover === m) label(m.name, x, y, css(MAP.track));
      } else {
        const isSel = sel && sel.id === m.id;
        const wid = { major: 4.5, military: 4, regional: 3.5, strip: 3, heliport: 3 }[m.tier];
        if (m.pad) {
          g.fillStyle = css(MAP.airport); g.strokeStyle = '#0e1a2b'; g.lineWidth = 2;
          g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.stroke(); g.fill();
          g.fillStyle = '#0e1a2b'; g.font = '700 9px Archivo, sans-serif'; g.textAlign = 'center'; g.fillText('H', x, y + 0.5);
          g.font = '600 12px Archivo, sans-serif';
        } else {
          // The runway, the way it points, as long as it is at this zoom (never under 10 px).
          const L = Math.max(10, m.length * ppm), a = m.heading;
          const dx = Math.sin(a) * L / 2, dy = -Math.cos(a) * L / 2;
          g.lineCap = 'round';
          g.strokeStyle = '#0e1a2b'; g.lineWidth = wid + 3;
          g.beginPath(); g.moveTo(x - dx, y - dy); g.lineTo(x + dx, y + dy); g.stroke();
          g.strokeStyle = css(MAP.airport); g.lineWidth = wid;
          g.beginPath(); g.moveTo(x - dx, y - dy); g.lineTo(x + dx, y + dy); g.stroke();
        }
        if (isSel) {
          g.strokeStyle = css(MAP.aircraft); g.lineWidth = 2;
          g.beginPath(); g.arc(x, y, 13, 0, Math.PI * 2); g.stroke();
        }
        if (labelAll || isSel || this.hover === m || m.tier === 'major') label(m.name, x, y, isSel ? css(MAP.aircraft) : '#edede7');
      }
    }
    // The aircraft: a triangle pointing the way it points.
    {
      const x = this._sx(me.x), y = this._sy(me.z), a = me.heading;
      g.save();
      g.translate(x, y); g.rotate(a);
      g.fillStyle = css(MAP.aircraft); g.strokeStyle = '#0e1a2b'; g.lineWidth = 2;
      g.beginPath();
      if (this.icon === 'airliner') {
        // A tube with swept wings and a tailplane.
        g.moveTo(0, -12); g.lineTo(2, -8); g.lineTo(2, -2); g.lineTo(11, 4); g.lineTo(11, 6); g.lineTo(2, 3);
        g.lineTo(2, 8); g.lineTo(5, 11); g.lineTo(5, 12); g.lineTo(0, 11); g.lineTo(-5, 12); g.lineTo(-5, 11);
        g.lineTo(-2, 8); g.lineTo(-2, 3); g.lineTo(-11, 6); g.lineTo(-11, 4); g.lineTo(-2, -2); g.lineTo(-2, -8);
      } else {
        g.moveTo(0, -11); g.lineTo(7, 9); g.lineTo(0, 5); g.lineTo(-7, 9);
      }
      g.closePath(); g.stroke(); g.fill();
      g.restore();
    }
    // North, and the scale.
    g.fillStyle = 'rgba(14, 26, 43, 0.85)'; g.fillRect(w - 44, 14, 30, 30);
    g.fillStyle = css(MAP.track); g.font = '700 14px Archivo, sans-serif'; g.textAlign = 'center'; g.fillText('N', w - 29, 30);
    const metres = [1000, 2000, 5000, 10000, 20000, 50000].find((m) => m * ppm >= 70) || 50000;
    const bar = metres * ppm;
    g.fillStyle = 'rgba(14, 26, 43, 0.85)'; g.fillRect(14, h - 40, bar + 56, 26);
    g.fillStyle = '#edede7'; g.fillRect(24, h - 31, bar, 3);
    g.font = '600 11px Martian Mono, monospace'; g.textAlign = 'left';
    const sc = distanceIn(metres, this.ctx0.units);
    g.fillText(`${Math.round(sc.value)} ${sc.unit}`, 24 + bar + 8, h - 28);
    this._h = h;
  }
}
