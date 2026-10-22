// One bounded triangle batch per physical display, including vector glyphs.
import * as THREE from 'three';
import {instrumentInk} from '../Materials.js';
import {drawInstrument} from '../../flight/InstrumentDrawing.js';
import {instrumentProfile} from '../../data/flightInstruments.js';
import {FLIGHT_INSTRUMENTS as I} from '../../data/tuning.js';
export class InstrumentSurface {
  constructor(spec){
    this.spec=spec;this.group=new THREE.Group();this.group.name=`instrument-${spec.id}`;
    this.group.position.set(...spec.pos);this.group.rotation.y=Math.PI;
    this.positions=new Float32Array(I.maxVertices*3);this.colors=new Float32Array(I.maxVertices*3);
    this.geometry=new THREE.BufferGeometry();
    this.geometry.setAttribute('position',new THREE.BufferAttribute(this.positions,3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('color',new THREE.BufferAttribute(this.colors,3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setDrawRange(0,0);this.mesh=new THREE.Mesh(this.geometry,instrumentInk());
    this.mesh.frustumCulled=false;this.group.add(this.mesh);this.count=0;this.layer=0;this._colors=new Map();this.updates=0;
  }
  vertex(x,y,c,z){
    if(this.count>=I.maxVertices)throw new Error(`Instrument vertex budget exceeded: ${this.spec.id}`);
    const n=this.count++*3,w=this.spec.view[0],h=this.spec.view[1];
    this.positions[n]=(x/w-.5)*this.spec.size[0];this.positions[n+1]=(.5-y/h)*this.spec.size[1];this.positions[n+2]=z;
    let color=this._color;
    if(c!==this._colorKey){color=this._colors.get(c);if(!color){color=new THREE.Color(c);this._colors.set(c,color);}this._colorKey=c;this._color=color;}
    this.colors[n]=color.r;this.colors[n+1]=color.g;this.colors[n+2]=color.b;
  }
  poly(points,c){
    const z=++this.layer*0.0000001;
    // Accept either polygon winding; every triangle must face the seated pilot.
    let area=0;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];area+=a[0]*b[1]-b[0]*a[1];}
    for(let i=1;i<points.length-1;i++){
      this.vertex(...points[0],c,z);this.vertex(...points[area>=0?i+1:i],c,z);this.vertex(...points[area>=0?i:i+1],c,z);
    }
  }
  rect(x,y,w,h,c){
    if(w<=0||h<=0)return;const z=++this.layer*.0000001;
    this.vertex(x,y,c,z);this.vertex(x+w,y+h,c,z);this.vertex(x+w,y,c,z);
    this.vertex(x,y,c,z);this.vertex(x,y+h,c,z);this.vertex(x+w,y+h,c,z);
  }
  line(x0,y0,x1,y1,c,width=1){const l=Math.hypot(x1-x0,y1-y0);if(l<1e-8)return;const x=-(y1-y0)/l*width/2,y=(x1-x0)/l*width/2,z=++this.layer*.0000001;
    this.vertex(x0+x,y0+y,c,z);this.vertex(x1+x,y1+y,c,z);this.vertex(x1-x,y1-y,c,z);
    this.vertex(x0+x,y0+y,c,z);this.vertex(x1-x,y1-y,c,z);this.vertex(x0-x,y0-y,c,z);}
  update(d){
    this.count=0;this.layer=0;drawInstrument(this,this.spec.type,d,...this.spec.view);
    this.geometry.setDrawRange(0,this.count);
    for(const name of ['position','color']){const a=this.geometry.attributes[name];a.clearUpdateRanges();a.addUpdateRange(0,this.count*3);a.needsUpdate=true;}
    this.last=d;this.updates++;
  }
}
export function createInstrumentSet(def,mounts){
  const surfaces=[];
  for(const spec of instrumentProfile(def).panels){
    if(!mounts[spec.parent])continue;
    const s=new InstrumentSurface(spec);mounts[spec.parent].add(s.group);surfaces.push(s);
  }
  return{surfaces,elapsed:Infinity,update(d,dt=1/60){
    this.elapsed+=dt;if(this.elapsed<1/I.refreshHz&&this.units===d.units)return;
    this.elapsed=0;this.units=d.units;for(const s of surfaces)s.update(d);
  }};
}
