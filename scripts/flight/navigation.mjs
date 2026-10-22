// Actual-control navigation, storage recovery, overshoot and fixed-clock invariance.
export default async function run({check,H,DT,makeInput}){
 const {FlightRoute,normalizeTrip}=await import(H.R+'flight/FlightRoute.js');
 const {F22,B737}=await import(H.R+'data/aircraft.js');
 const A=await import('../lib/airliner-harness.mjs');
 const {Loop}=await import(H.R+'core/Loop.js');
 const trip={version:1,origin:{x:0,z:0,label:'Start'},points:[{x:0,z:8000,label:'One'},{x:-6000,z:14000,label:'Two'},{x:-14000,z:14000,label:'End'}]};
 console.log('\nPart C navigation');
 const {World}=await import(H.R+'world/World.js'),{mapMarkers}=await import(H.R+'world/MapData.js');
 const world=new World([]),markers=mapMarkers(world);
 check(world.airports.list.every(a=>{const m=markers.find(m=>m.id===a.id),c=a.toWorld(a.length/2,0,{});return m.x===c.x&&m.z===c.z;}),'map runways use actual transformed midpoints rather than threshold/platform centres');
 check([null,{version:2,points:[]},{...trip,points:[{x:NaN,z:0}]},{...trip,points:[{x:1e10,z:0}]},{...trip,points:[trip.origin]}].every(v=>normalizeTrip(v).points.length===0),'invalid/version/duplicate/out-of-world trips recover safely');
 let r=new FlightRoute(trip);r.activate({x:-9000,z:14050});check(r.leg===3,'activation intercepts nearest forward leg without returning to origin');
 r=new FlightRoute({...trip,origin:null});r.activate({x:400,z:200});check(r.path[0].x===400&&r.path[0].z===200,'live origin is captured only at activation');
 r=new FlightRoute(trip);r.activate({x:0,z:0});r.update(0,8500,0);check(r.leg===1,'low speed does not advance parked guidance');
 r.activate({x:0,z:0});r.update(0,8500,200);check(r.leg===2,'swept waypoint crossing advances after overshoot');
 r.activate({x:0,z:0});r.update(6000,8500,200);check(r.leg===1,'remote endpoint-plane crossing does not skip a waypoint');
 r.activate({x:0,z:0});r.update(2000,3000,200);check(r.heading>0&&r.heading<.66,'left-of-leg intercept steers east with bounded correction');
 r=new FlightRoute(trip);const kept=JSON.stringify(r.record());r.edit(trip.points[0],trip.points);check(JSON.stringify(r.record())===kept&&r.notice.includes('trip kept'),'invalid origin edit preserves existing trip with a reason');
 const old=r.record();r.reset();check(!r.usable&&JSON.stringify(r.record())===JSON.stringify(old),'reset cancels guidance and preserves saved trip');
 for(const def of[F22,B737]){
  const once=(fps)=>{
   const {p,inp}=A.inAir(def,{h:3000,casKt:def===F22?300:230,payload:def===B737?A.payloadFor(B737,62000,.5):undefined});
   H.run(p,inp,2);const ap=new A.Autopilot(def),cmd=makeInput({analog:false}),route=new FlightRoute(trip);route.activate(p);ap.engage(p);ap.followRoute(route);
   let steps=0,maxBank=0,maxAlt=0;
   const loop=new Loop({step:dt=>{if(steps>=420*120)return;route.update(p.x,p.z,p.tas);ap.step(dt,p,inp,cmd);p.step(dt,cmd,H.field);maxBank=Math.max(maxBank,Math.abs(p.attitude().bank));maxAlt=Math.max(maxAlt,Math.abs(p.y-3000));steps++;},render:null});
   while(steps<420*120)loop.advance(1/fps);
   return {p,ap,route,maxBank,maxAlt};
  };
  const a=once(60);console.log(def.id,JSON.stringify({complete:a.route.complete,leg:a.route.leg,mode:a.ap.mode,x:a.p.x,z:a.p.z,alt:a.maxAlt,bank:a.maxBank}));
  check(a.route.complete&&a.ap.mode==='Hold'&&a.ap.on&&!a.p.crashed&&!a.p.stalled&&a.maxAlt<120&&a.maxBank<a.ap.cfg.bankMax*1.2,`${def.id}: actual controls finish three lateral legs and transition to Hold, altitude/bank bounded`);
  for(const fps of[30,144]){const b=once(fps);check(a.p.x===b.p.x&&a.p.z===b.p.z&&a.p.qw===b.p.qw&&a.route.leg===b.route.leg,`${def.id}: Route at ${fps} Hz is identical to 60 Hz`);}
  const temp=new FlightRoute(trip);temp.activate(a.p,1);a.ap.followRoute(temp);a.ap.hdg=.3;const chosenAlt=a.ap.alt,chosenSpd=a.ap.spd;const input=makeInput({apAlt:1,apHdg:1,apSpd:1});a.ap.step(DT,a.p,input,makeInput({}));check(Math.abs(Math.sin(a.ap.hdg-temp.heading))<1e-12&&a.ap.alt>chosenAlt&&a.ap.spd>chosenSpd,`${def.id}: Route adjusts pilot altitude/speed and owns heading selection`);
  const alt=a.ap.alt,spd=a.ap.spd;a.ap.followRoute(a.route);a.ap.disengage();check(!a.ap.on&&a.ap.mode==='Off'&&alt===a.ap.alt&&spd===a.ap.spd,`${def.id}: cancel leaves pilot targets and disengages`);
 }
}
