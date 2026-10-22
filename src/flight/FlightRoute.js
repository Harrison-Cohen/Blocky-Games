// Pure absolute-coordinate trip and lateral guidance. Never moves an aircraft.
import {FLIGHT_NAV as N, OPEN_WORLD} from '../data/tuning.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const bearing=(dx,dz)=>Math.atan2(-dx,dz);
export function normalizePoint(p){
 if(!p||typeof p.x!=='number'||typeof p.z!=='number'||!Number.isFinite(p.x+p.z)||Math.abs(p.x)>OPEN_WORLD.size/2||Math.abs(p.z)>OPEN_WORLD.size/2)return null;
 return {x:p.x,z:p.z,label:typeof p.label==='string'?p.label.slice(0,64):'Map point',airport:typeof p.airport==='string'?p.airport.slice(0,64):''};
}
export function normalizeTrip(raw){
 const empty={version:1,origin:null,points:[]};
 if(!raw||raw.version!==1||!Array.isArray(raw.points)||raw.points.length>N.maxPoints)return empty;
 const origin=raw.origin===null?null:normalizePoint(raw.origin);
 if(raw.origin!==null&&!origin)return empty;
 const points=raw.points.map(normalizePoint);
 if(points.some(p=>!p))return empty;
 let prev=origin;
 for(const p of points){if(prev&&Math.hypot(p.x-prev.x,p.z-prev.z)<N.minLeg)return empty;prev=p;}
 return {version:1,origin,points};
}
export class FlightRoute {
 constructor(raw){this.trip=normalizeTrip(raw);this.reset();}
 reset(){this.active=false;this.complete=false;this.path=[];this.leg=1;this.distance=0;this.remaining=0;this.crossTrack=0;this.heading=0;this._previous=false;this.notice='';}
 record(){return normalizeTrip(this.trip);}
 edit(origin,points){const next=normalizeTrip({version:1,origin,points});if(points.length&&!next.points.length){this.notice='Invalid origin or stops too close; trip kept';return false;}this.trip=next;this.reset();return true;}
 get usable(){return this.active&&this.path.length>1&&this.leg<this.path.length;}
 activate(position,leg=null){
  this.reset();
  const origin=this.trip.origin||normalizePoint({...position,label:'Activation position'});
  if(!origin||!this.trip.points.length){this.notice='Add a destination first';return false;}
  this.path=[origin,...this.trip.points.map(p=>({...p}))];
  // A live origin already at the first stop must not create a zero-length leg.
  while(this.path.length>1&&Math.hypot(this.path[1].x-origin.x,this.path[1].z-origin.z)<N.minLeg)this.path.splice(1,1);
  if(this.path.length<2){this.notice='Destination is too close';return false;}
  let best=Infinity,chosen=1;
  for(let i=1;i<this.path.length;i++){
   const a=this.path[i-1],b=this.path[i],dx=b.x-a.x,dz=b.z-a.z,l2=dx*dx+dz*dz;
   const t=((position.x-a.x)*dx+(position.z-a.z)*dz)/l2;
   if(t>1&&i<this.path.length-1)continue;
   const dist=Math.hypot(position.x-a.x-clamp(t,0,1)*dx,position.z-a.z-clamp(t,0,1)*dz);
   if(dist<=best){best=dist;chosen=i;}
  }
  this.leg=Number.isInteger(leg)?clamp(leg,1,this.path.length-1):chosen;
  this.active=true;this._px=position.x;this._pz=position.z;this._previous=true;
  this.update(position.x,position.z,0);
  this.notice=`Active leg ${this.leg}: ${this.path[this.leg].label}`;return true;
 }
 update(x,z,speed){
  if(!this.usable)return;
  let a=this.path[this.leg-1],b=this.path[this.leg];
  let dx=b.x-a.x,dz=b.z-a.z,L=Math.hypot(dx,dz),ux=dx/L,uz=dz/L;
  let along=(x-a.x)*ux+(z-a.z)*uz,cross=(x-a.x)*uz-(z-a.z)*ux;
  const distance=Math.hypot(x-b.x,z-b.z);
  const oldAlong=(this._px-a.x)*ux+(this._pz-a.z)*uz;
  // Swept arrival, including a fast step through the cylinder or endpoint plane.
  const sx=x-this._px,sz=z-this._pz,sl2=sx*sx+sz*sz;
  const t=sl2?clamp(((b.x-this._px)*sx+(b.z-this._pz)*sz)/sl2,0,1):0;
  const swept=Math.hypot(this._px+t*sx-b.x,this._pz+t*sz-b.z);
  if(speed>=N.minSpeed&&(distance<N.arrival||(this._previous&&swept<N.arrival)||(oldAlong<L&&along>=L&&Math.abs(cross)<N.arrival*2))){
   this.heading=bearing(dx,dz);
   if(this.leg===this.path.length-1){this.active=false;this.complete=true;this.distance=this.remaining=0;this.notice='Route complete: Hold on final heading';return;}
   this.leg++;a=b;b=this.path[this.leg];dx=b.x-a.x;dz=b.z-a.z;L=Math.hypot(dx,dz);ux=dx/L;uz=dz/L;
   along=(x-a.x)*ux+(z-a.z)*uz;cross=(x-a.x)*uz-(z-a.z)*ux;
  }
  const ahead=Math.max(N.minLookAhead,speed*N.lookAhead);
  // Before/after a segment, aim at a point on it; on-leg use bounded cross-track correction.
  if(along<0||along>L){const t=clamp(along+ahead,0,L);this.heading=bearing(a.x+ux*t-x,a.z+uz*t-z);}
  else this.heading=bearing(dx,dz)+clamp(Math.atan2(cross,ahead),-N.maxIntercept,N.maxIntercept);
  this.crossTrack=cross;this.distance=Math.hypot(x-b.x,z-b.z);this.remaining=this.distance;
  for(let i=this.leg+1;i<this.path.length;i++)this.remaining+=Math.hypot(this.path[i].x-this.path[i-1].x,this.path[i].z-this.path[i-1].z);
  this._px=x;this._pz=z;this._previous=true;
 }
}
