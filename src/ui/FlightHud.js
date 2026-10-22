// Aircraft-themed external instruments and service messages. Physical cockpit
// panels read the same snapshot and remain live when this overlay is hidden.
import {FlightInstrumentView} from './FlightInstrumentDraw.js';
import {instrumentProfile} from '../data/flightInstruments.js';
import {FLIGHT_INSTRUMENTS as I} from '../data/tuning.js';
const el=(tag,cls,parent)=>{const e=document.createElement(tag);e.className=cls;parent.append(e);return e;};
export class FlightHud {
 constructor(parent){
  this.root=el('div','fhud fhud-instrumented',parent);this.root.hidden=true;this.units='aviation';
  this.views={primary:new FlightInstrumentView(this.root,'primary'),navigation:new FlightInstrumentView(this.root,'navigation'),
    engines:new FlightInstrumentView(this.root,'engines'),systems:new FlightInstrumentView(this.root,'systems',400,200),
    hud:new FlightInstrumentView(this.root,'hud',320,240)};
  this.zoomEl=el('div','fhud-map-zoom',this.root);
  for(const [label,dir]of[['Map zoom in',-1],['Map zoom out',1]]){const b=el('button','',this.zoomEl);b.type='button';b.textContent=label;b.onclick=()=>this.onRange?.(dir);}
  this.warnEl=el('div','fhud-warn',this.root);this.warnEl.setAttribute('role','status');
  this.noteEl=el('div','fhud-note',this.root);this.noteEl.hidden=true;
  this.resetEl=el('div','fhud-reset',this.root);this.resetEl.hidden=true;
  this.camEl=el('div','fhud-cam',this.root);this.camEl.hidden=true;
  this.placeEl=el('div','fhud-place',this.root);this.placeEl.hidden=true;
  // Text damage mirror retained for assistive inspection and the existing regression API.
  this.damageEl=el('div','fhud-damage fhud-text-mirror',this.root);
  this._cache={};this._noteUntil=0;this._camUntil=0;this.elapsed=Infinity;
 }
 configure(def){this.profile=instrumentProfile(def);this.root.dataset.profile=this.profile.id;this.elapsed=Infinity;this._cache={};}
 show(){this.root.hidden=false;this.elapsed=Infinity;}
 hide(){this.root.hidden=true;}
 get visible(){return !this.root.hidden;}
 setUnits(u){this.units=u;this.elapsed=Infinity;}
 _set(k,node,v){if(this._cache[k]===v)return;this._cache[k]=v;node.textContent=v;}
 note(text,seconds=3){this.noteEl.textContent=text;this.noteEl.hidden=false;this._noteUntil=performance.now()+seconds*1000;}
 clearNote(){this.noteEl.hidden=true;this._noteUntil=0;}
 cameraName(name){this.camEl.textContent=`Camera: ${name}`;this.camEl.hidden=false;this._camUntil=performance.now()+1800;}
 update(d,dt=1/60){
  if(this.root.hidden)return;
  const now=performance.now();
  if(!this.noteEl.hidden&&now>this._noteUntil)this.noteEl.hidden=true;
  if(!this.camEl.hidden&&now>this._camUntil)this.camEl.hidden=true;
  this.root.classList.toggle('fhud-cockpit',!!d.interior);
  this.root.classList.toggle('fhud-fighter-first',d.profile.kind==='fighter'&&!!d.firstPerson);
  this._set('warn',this.warnEl,d.warning);this.warnEl.classList.toggle('alert',d.warningLevel===2);
  this._set('damage',this.damageEl,d.damageRows.filter(p=>p.health<1).map(p=>`${p.label} ${Math.round(p.health*100)}%`).join('\n'));
  this.damageEl.classList.toggle('critical',d.damageLevel===2);
  this._set('place',this.placeEl,d.where);this.placeEl.hidden=!d.where;
  this.resetEl.hidden=d.resetProgress<=.02;
  if(!this.resetEl.hidden)this._set('reset',this.resetEl,`Back to the hangar ${Math.round(d.resetProgress*100)}%`);
  const mode=`${d.interior}/${d.firstPerson}/${d.units}`;this.elapsed+=dt;
  if(this.elapsed<1/I.refreshHz&&mode===this._mode)return;
  this.elapsed=0;this._mode=mode;this.last=d;
  for(const v of Object.values(this.views)){
   const show=!d.interior&&(v.type==='hud'?d.profile.kind==='fighter'&&d.firstPerson:!(v.type==='primary'&&d.profile.kind==='fighter'&&d.firstPerson));
   v.canvas.hidden=!show;if(show)v.update(d);
  }
 }
}
