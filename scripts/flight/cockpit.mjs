// Window clearance and geometry validity at the actual pilot eye, without WebGL.
export default async function run({check,H}) {
  const THREE=await import('three');
  const {B737}=await import(H.R+'data/aircraft.js');
  const {Aircraft}=await import(H.R+'flight/Aircraft.js');
  const {buildNoseGeometry}=await import(H.R+'render/aircraft/b737Nose.js');
  console.log('\n737 nose and seated visibility');
  const g=buildNoseGeometry();
  check(Object.values(g).every(o=>Array.from(o.attributes.position.array).every(Number.isFinite) && o.index.count>0), 'two-piece nose, glass and seals have finite indexed geometry');
  const bounds=new THREE.Box3();
  for(const o of Object.values(g)){o.computeBoundingBox();bounds.union(o.boundingBox);o.dispose();}
  check(Math.abs(bounds.max.z-17.57)<1e-5 && bounds.min.z>=12.5999 && bounds.max.x<=1.8801 && bounds.max.y<=2.0101, 'nose stays within existing aircraft dimensions');
  const a=new Aircraft(B737); a.setInterior(true); a.root.updateMatrixWorld(true);
  const eye=new THREE.Vector3(...B737.cockpitView.eye);
  const ray=new THREE.Raycaster(); ray.layers.set(1);
  const clear=(v)=>{ray.set(eye,new THREE.Vector3(...v).normalize());return ray.intersectObject(a.root,true).filter(h=>h.distance>0.02).length===0;};
  check(clear([0,0,1]) && clear([0,-0.10,1]) && clear([0,0.12,1]), 'pilot sees straight ahead, above horizon and down toward runway through actual openings');
  check(clear([1,0,0.25]), 'left-seat pilot can look through the side window');
  check(a.built.body.getObjectByName('b737-nose-lower') && a.built.body.getObjectByName('b737-nose-deck'), 'lower nose and upper flight deck are separate meshes');
  check(B737.cockpitEye.every((v,i)=>v===B737.cockpitView.eye[i]), 'first person and cockpit use the same left-seat eye');
  a.dispose();
}
