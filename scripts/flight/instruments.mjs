// Shared telemetry, coherent unit conversions, finite facing geometry and cleanup.
export default async function run({check,H,DT,makeInput,field}){
 const {F22,B737}=await import(H.R+'data/aircraft.js');
 const {Aircraft}=await import(H.R+'flight/Aircraft.js');
 const {createFlightTelemetry,updateFlightTelemetry}=await import(H.R+'flight/FlightTelemetry.js');
 const {speedIn,altitudeIn,climbIn}=await import(H.R+'flight/Units.js');
 const {instrumentProfile,displayHeading}=await import(H.R+'data/flightInstruments.js');
 const {FLIGHT_INSTRUMENTS:I}=await import(H.R+'data/tuning.js');
 const world={agl:(x,y,z)=>y};
 console.log('\nAircraft-specific working instruments');
 check(displayHeading(-.01)===359&&displayHeading(Math.PI*2)===0,'display headings wrap through north in both directions');
 let maximum=0;
 for(const def of[F22,B737]){
  const a=new Aircraft(def),p=a.physics,d=createFlightTelemetry(def);
  p.reset({y:3000,speed:200,heading:1.2,gear:0,throttle:.8});p.step(DT,makeInput({gearDown:false}),field);
  const ctx={world,units:'aviation',ap:{on:true,alt:3200,spd:190,hdg:1.3},flapName:'Up',landmarks:[{name:'Test airport',kind:'airport',x:0,z:5000,length:3500}],where:'Test airport'};
  let convert=true,finite=true,facing=true;
  const before=JSON.stringify([p.x,p.y,p.z,p.fuel,p.qx,p.qy,p.qz,p.qw,p.engines.map(e=>e.n),p.damage.record()]);
  for(const units of['aviation','mph','metric']){
   ctx.units=units;updateFlightTelemetry(d,p,ctx);
   convert &&= d.speed===Math.round(speedIn(p.cas,units).value)&&d.height===Math.round(altitudeIn(p.altitude,units).value)&&d.apSpeed===Math.round(speedIn(ctx.ap.spd,units).value);
   convert &&= d.speedUnit===speedIn(0,units).unit&&d.heightUnit===altitudeIn(0,units).unit&&d.climbUnit===climbIn(0,units).unit;
   for(const [pitch,bank]of[[0,0],[1.4,Math.PI],[-1.4,-Math.PI],[.3,.8]]){
    d.pitch=pitch;d.bank=bank;a.interior.instruments.elapsed=Infinity;a.interior.instruments.update(d);
    for(const s of a.interior.instruments.surfaces){
     maximum=Math.max(maximum,s.count);finite &&=s.count>0&&s.count<=I.maxVertices;
     const v=s.positions.subarray(0,s.count*3);finite &&=v.every(Number.isFinite)&&s.colors.subarray(0,s.count*3).every(Number.isFinite);
     for(let i=0;i<v.length;i+=9){const cross=(v[i+3]-v[i])*(v[i+7]-v[i+1])-(v[i+4]-v[i+1])*(v[i+6]-v[i]);if(cross< -1e-12)facing=false;}
     finite &&= !s.mesh.material.map&&s.group.layers.mask===2;
    }
   }
  }
  check(convert,`${def.id}: CAS, TAS/altitude units and AP targets use the shared conversion rules`);
  check(finite&&facing,`${def.id}: all physical panels finite, texture-free, within budget and facing the pilot`);
  check(before===JSON.stringify([p.x,p.y,p.z,p.fuel,p.qx,p.qy,p.qz,p.qw,p.engines.map(e=>e.n),p.damage.record()]),`${def.id}: display updates never mutate aircraft physics or damage`);
  updateFlightTelemetry(d,p,ctx);
  check(d.engines.every((e,i)=>e.spool===p.engines[i].n*100&&e.flow===p.engines[i].fuelFlow*3600&&e.thrust===p.engines[i].thrust/1000),`${def.id}: engine readouts reflect simulated spool, kg/h and kN without invented sensors`);
  p.damage.set('engineL',.2);updateFlightTelemetry(d,p,ctx);
  check(d.warning==='Critical damage'&&d.damageRows.find(r=>r.id==='engineL').health===.2,`${def.id}: cockpit and overlay snapshot share part health and warning severity`);
  p.stalled=true;updateFlightTelemetry(d,p,ctx);check(d.warning==='Stall',`${def.id}: stall warning takes priority over damage`);p.stalled=false;
  if(def===F22){a.setInterior(true);check(a.built.cockpitShell.every(o=>o.layers.mask===1),'F-22 cockpit recess stays clear of the exterior shell in overlay');a.setInterior(false);check(a.built.cockpitShell.every(o=>o.layers.mask===3),'F-22 shell returns to its original exterior layers outside Cockpit');}
  let disposed=0;for(const s of a.interior.instruments.surfaces)s.geometry.addEventListener('dispose',()=>disposed++);
  const count=a.interior.instruments.surfaces.length;a.dispose();check(disposed===count,`${def.id}: every instrument GPU buffer is disposed with its aircraft`);
 }
 const future={...F22,model:'future-aircraft',instrumentProfile:'unknown-profile'},a=new Aircraft(future);
 check(instrumentProfile(future).id==='generic'&&a.interior.instruments.surfaces.length===3,'unknown future aircraft receives documented working generic glass panels');a.dispose();
 console.log(`        peak instrument batch ${maximum} of ${I.maxVertices} vertices`);
}
