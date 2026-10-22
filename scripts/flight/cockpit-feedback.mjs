// Regression checks from the user's two cockpit screenshots and power/shake feedback.
export default async function run({check,H,DT,makeInput,field}){
 const THREE=await import('three');
 const {F22,B737}=await import(H.R+'data/aircraft.js');
 const {Aircraft}=await import(H.R+'flight/Aircraft.js');
 const {FlightCamera}=await import(H.R+'render/FlightCamera.js');
 const {FlightInput}=await import(H.R+'core/FlightInput.js');
 const {buildNoseGeometry}=await import(H.R+'render/aircraft/b737Nose.js');
 const {createFlightTelemetry,updateFlightTelemetry}=await import(H.R+'flight/FlightTelemetry.js');
 console.log('\nCockpit screenshot feedback and quicker power response');
 const nav=Object.getOwnPropertyDescriptor(globalThis,'navigator'),win=globalThis.window;
 let pad=null;
 try{
  globalThis.window={localStorage:{getItem:()=>null}};
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{getGamepads:()=>pad?[pad]:[]}});
  const f=new FlightInput({});
  f._onMouseDown({button:2});f._onMouseMove({movementX:0,movementY:200});
  check(f.look.y<-.6,'right-mouse drag down looks down toward the lower panels');
  f._onMouseUp({button:2});f.look.y=0;f.mouseFlight=true;
  f._onMouseDown({button:1,preventDefault(){}});f._onMouseMove({movementX:40,movementY:200});
  check(f.look.y<-.6&&f._mouse.x===0&&f._mouse.y===0,'middle-button look in mouse flight moves the view without moving the virtual stick');
  f._onMouseUp({button:1});f.mouseFlight=false;f.look.y=0;
  pad={connected:true,mapping:'standard',axes:[0,0,0,.7],buttons:Array.from({length:17},(_,i)=>({pressed:i===11,value:i===11?1:0}))};
  f.poll(.1);check(f.look.y<0&&f.state.throttleRate===0,'held R3 with right stick down looks down without changing throttle');
 }finally{globalThis.window=win;if(nav)Object.defineProperty(globalThis,'navigator',nav);else delete globalThis.navigator;}
 const a=new Aircraft(B737);a.root.updateMatrixWorld(true);
 const nose=buildNoseGeometry(),mat=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
 const shell=Object.values(nose).map(g=>new THREE.Mesh(g,mat));shell.forEach(m=>m.updateMatrixWorld());
 const ray=new THREE.Raycaster(),v=new THREE.Vector3(),centre=new THREE.Vector3(),dir=new THREE.Vector3();
 let contained=true;
 for(const name of['b737-main-panel','b737-lower-bulkhead','b737-glareshield','b737-mode-control-housing']){
  const m=a.interior.group.getObjectByName(name),p=m.geometry.attributes.position;
  for(let i=0;i<p.count;i++){
   v.fromBufferAttribute(p,i).applyMatrix4(m.matrixWorld);centre.set(0,0,v.z);dir.copy(v).sub(centre);
   const length=dir.length();ray.set(centre,dir.normalize());const hit=ray.intersectObjects(shell,false)[0];
   contained&&=!!hit&&hit.distance>length+.002;
  }
 }
 check(contained,'737 panel, glareshield and mode-control housing fit inside the actual nose skin');
 a.dispose();Object.values(nose).forEach(g=>g.dispose());mat.dispose();
 const fighter=new Aircraft(F22),p=fighter.physics,d=createFlightTelemetry(F22);
 p.reset({y:12000,speed:450,gear:0});updateFlightTelemetry(d,p,{world:{agl:(x,y)=>y},units:'aviation',ap:{on:false},landmarks:[]});
 d.height=123456;d.verticalSpeed=-12345;d.warning='Critical damage';fighter.interior.instruments.update(d);
 fighter.root.updateMatrixWorld(true);
 const hud=fighter.interior.instruments.surfaces.find(s=>s.spec.type==='hud'),glass=fighter.interior.group.getObjectByName('f22-hud-glass');
 const inv=new THREE.Matrix4().copy(glass.matrixWorld).invert();let inside=true;
 for(let i=0;i<hud.count;i++){
  v.fromBufferAttribute(hud.geometry.attributes.position,i).applyMatrix4(hud.mesh.matrixWorld).applyMatrix4(inv);
  inside&&=Math.abs(v.x)<.17-.02&&Math.abs(v.y)<.13-.02;
 }
 check(inside,'F-22 HUD numerals, warnings and symbology fit on the glass with a visible border');fighter.dispose();
 const state={x:0,y:3000,z:0,qx:0,qy:0,qz:0,qw:1},look={x:0,y:0};
 for(const mode of[1,2,0]){
  const cameras=[0,1].map(()=>{const c=new FlightCamera(new THREE.PerspectiveCamera());c.mode=mode;c.cfg={...c.cfg};return c;});
  cameras[0].cfg.eyeShakeScale=cameras[0].cfg.eyeKickScale=1;
  for(const c of cameras){c.punch=6;c.update(state,340,3000,look,.26,[0,1.3,2.9],0,DT);}
  const expected=new THREE.Vector3(0,3001.3,2.9),base=cameras[0].camera,newCam=cameras[1].camera;
  if(mode!==0){
   check(Math.abs(newCam.position.distanceTo(expected)/base.position.distanceTo(expected)-.2)<1e-8,`${mode===1?'First person':'Cockpit'} positional shake is reduced by 80%`);
   const fov=mode===1?Math.max(cameras[1].fov,cameras[1].cfg.firstFov):cameras[1].cfg.cockpitFov;
   check(Math.abs((newCam.fov-fov)/(base.fov-fov)-.2)<1e-8,`${mode===1?'First person':'Cockpit'} Mach-1 field-of-view kick is reduced by 80%`);
  }else check(base.position.equals(newCam.position)&&base.fov===newCam.fov,'Chase effects keep their original amplitude');
 }
 for(const def of[F22,B737]){
  const results=[];
  for(const legacy of[true,false]){
   const p=new H.AircraftPhysics(def);
   if(legacy){p.F.throttleRate=def.id==='f22'?.35:.18;for(let i=0;i<p.engines.length;i++){p.engines[i].spoolUp=def.engines[i].spoolUp;p.engines[i].abUp=def.engines[i].abUp;}}
   p.reset({y:3000,speed:def.id==='f22'?150:100,throttle:0,gear:0,fuel:.5,pitch:.03});
   const inp=makeInput({throttleRate:1,ab:def.id==='f22'}),initial=p.tas;
   for(let n=0;n<1200;n++){H.altitudeHold(p,inp,3000);p.step(DT,inp,field);}
   results.push({gain:p.tas-initial,alt:p.y,crashed:p.crashed});
  }
  const [old,now]=results;
  check(!now.crashed&&now.gain>old.gain*1.12&&now.alt>=old.alt-10,`${def.id}: 10-second idle-to-power speed gain ${old.gain.toFixed(2)} -> ${now.gain.toFixed(2)} m/s without diving for the improvement`);
 }
}
