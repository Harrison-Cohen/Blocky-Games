// Procedural 737NG CFM56-7B installation. Open intake, rounded lip, recessed fan,
// flattened lower cowl, separate core exhaust and swept pylon. No textures.
import * as THREE from 'three';
import { fin, mesh } from '../AircraftBuilder.js';

const N = 48;
// Surface of revolution with the installed nacelle's flattened lower edge.
// Profiles may return inward from the lip, making an open duct instead of an end cap.
function tube(profile, flat = -0.76) {
  const pos = [], idx = [];
  for (const [z, r, cy = 0.06] of profile) for (let k = 0; k <= N; k++) {
    const a = k / N * Math.PI * 2;
    pos.push(r * Math.cos(a), Math.max(flat, cy + r * Math.sin(a)), z);
  }
  for(let i=0;i<profile.length-1;i++)for(let k=0;k<N;k++) {
    const a=i*(N+1)+k,b=a+1,c=a+N+1,d=c+1;
    idx.push(a,b,c,b,d,c);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();
  // The duplicated meridian vertices have the same smooth normal.
  const normal=g.attributes.normal;
  for(let i=0;i<profile.length;i++) {
    const a=i*(N+1),b=a+N;
    const v=new THREE.Vector3(normal.getX(a)+normal.getX(b),normal.getY(a)+normal.getY(b),normal.getZ(a)+normal.getZ(b)).normalize();
    normal.setXYZ(a,v.x,v.y,v.z);normal.setXYZ(b,v.x,v.y,v.z);
  }
  return g;
}

function fanBlades() {
  const pos=[],idx=[];
  const stations=[[0.18,0,0.11],[0.36,0.08,0.11],[0.58,0.19,0.10],[0.76,0.30,0.085]];
  for(let b=0;b<24;b++) {
    for(const[r,a,w]of stations)for(const side of[-1,1]) {
      const ang=a+side*w+b/24*Math.PI*2;
      pos.push(Math.sin(ang)*r,Math.cos(ang)*r,0.05*Math.sin(r*3)+side*0.04);
    }
    // One batched fan mesh; gaps separate the swept blades.
    for(let i=0;i<3;i++){const a=b*8+i*2;idx.push(a,a+1,a+2,a+1,a+3,a+2);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();return g;
}

export function buildCFM56({own,engineMat,hubMat,fanMat,dark,black,accent,rings}) {
  const group=new THREE.Group(); group.name='cfm56-installation';
  const add=(geo,mat,name)=>{const m=mesh(own(geo),mat);m.name=name;group.add(m);return m;};
  add(tube([[-0.75,0.68],[0,0.88],[1.0,0.98],[2.25,1.0],[2.85,0.96]]),engineMat,'cfm56-cowl');
  add(tube([[2.85,0.96],[3.02,0.94],[3.10,0.90],[3.08,0.85],[2.97,0.81]],-0.76),hubMat,'cfm56-lip');
  add(tube([[2.97,0.81],[2.65,0.79],[2.15,0.78]],-0.69),dark,'cfm56-inlet');
  const back=add(new THREE.CircleGeometry(0.78,N),black,'cfm56-fan-shadow');back.position.set(0,0.06,2.12);
  const fan=new THREE.Group();fan.name='cfm56-fan';fan.position.set(0,0.06,2.15);group.add(fan);
  fan.add(mesh(own(fanBlades()),fanMat));
  const spinner=mesh(own(new THREE.ConeGeometry(0.19,0.38,24)),hubMat);
  spinner.rotation.x=Math.PI/2;spinner.position.z=0.16;fan.add(spinner);
  add(tube([[-1.65,0.28],[-1.35,0.36],[-0.75,0.47],[0.05,0.52]]),hubMat,'cfm56-core');
  const exit=add(new THREE.CircleGeometry(0.28,32),black,'cfm56-exhaust');exit.rotation.y=Math.PI;exit.position.set(0,0.06,-1.66);
  const plug=add(new THREE.ConeGeometry(0.18,0.75,24),dark,'cfm56-plug');plug.rotation.x=-Math.PI/2;plug.position.set(0,0.06,-1.76);
  // An annular aft closure, not a cap across the inlet.
  add(tube([[-0.74,0.47],[-0.75,0.68]]),dark,'cfm56-bypass-exit');
  add(fin([[-1.6,0.72],[-1.9,1.06],[0.2,1.06],[1.2,0.95]],0.30,0.035),engineMat,'cfm56-pylon');
  if(rings) {
    add(tube([[2.30,1.014],[2.55,1.001]],-0.774),accent,'cfm56-paint-forward');
    add(tube([[0.10,0.904],[0.40,0.934]],-0.774),accent,'cfm56-paint-aft');
  }
  return{group,fan};
}
