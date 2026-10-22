// Canvas adapter for the same vector strokes used on physical cockpit panels.
import {drawInstrument} from '../flight/InstrumentDrawing.js';
export class FlightInstrumentView {
 constructor(parent,type,w=320,h=280){
  this.type=type;this.w=w;this.h=h;this.canvas=document.createElement('canvas');
  this.canvas.className=`fhud-instrument fhud-display-${type}`;this.canvas.setAttribute('role','img');
  this.ctx=this.canvas.getContext('2d');parent.append(this.canvas);this.px=0;
 }
 rect(x,y,w,h,c){this.ctx.fillStyle=c;this.ctx.fillRect(x,y,w,h);}
 poly(p,c){if(!p.length)return;const g=this.ctx;g.fillStyle=c;g.beginPath();g.moveTo(...p[0]);for(let i=1;i<p.length;i++)g.lineTo(...p[i]);g.closePath();g.fill();}
 line(x0,y0,x1,y1,c,width=1){const g=this.ctx;g.strokeStyle=c;g.lineWidth=width;g.beginPath();g.moveTo(x0,y0);g.lineTo(x1,y1);g.stroke();}
 terrain(cache,x,z,range,w,h,ox=0,oy=0){
  const r=cache.raster,g=this.ctx;g.save();g.beginPath();g.rect(ox,oy,w,h);g.clip();
  g.imageSmoothingEnabled=true;
  g.drawImage(cache.canvas,ox+w/2+(x-r.size/2)*w/range,oy+h/2+(z-r.size/2)*w/range,r.size*w/range,r.size*w/range);g.restore();
 }
 update(d){
  const width=this.canvas.getBoundingClientRect().width;if(!width)return;
  const px=Math.round(width*Math.min(window.devicePixelRatio||1,1.5));
  if(px!==this.px){this.px=px;this.canvas.width=px;this.canvas.height=Math.round(px*this.h/this.w);}
  const g=this.ctx;g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,this.canvas.width,this.canvas.height);
  g.setTransform(this.canvas.width/this.w,0,0,this.canvas.height/this.h,0,0);
  drawInstrument(this,this.type,d,this.w,this.h);this.last=d;
  this.canvas.setAttribute('aria-label',`${this.type}: airspeed ${d.speed} ${d.speedUnit}, altitude ${d.height} ${d.heightUnit}, heading ${d.headingDeg}. ${d.warning||''}`);
 }
}
