// Repeatable entry, both headings and clearance against the airport's actual solids.
export default async function run({check,H}) {
  const {World}=await import(H.R+'world/World.js');
  const {FlightPlaces}=await import(H.R+'core/FlightPlaces.js');
  const {F22,B737}=await import(H.R+'data/aircraft.js');
  const {structureBoxes}=await import(H.R+'world/AirportStructures.js');
  const {Aircraft}=await import(H.R+'flight/Aircraft.js');
  const world=new World([]);
  console.log('\nExplicit Hangar visits and 737 exterior');
  for(const def of[F22,B737]) {
    const places=new FlightPlaces(world,def);
    let all=true,clear=true,compatible=0;
    for(const ap of places.list) {
      if(!places.eligible(ap,'hangar').ok)continue;compatible++;
      for(const zone of ap.layout.zones) {
        const into={...places.pose(ap,'hangar',{zone})}, out={...places.pose(ap,'hangar',{zone,outward:true})};
        const p={...into,vx:0,vz:0,onGround:true,crashed:false,throttle:0};
        all &&= places.availableHangar(p)===zone;
        for(let i=0;i<3;i++){places.update(10,p);all &&= places.availableHangar(p)===zone;}
        all &&= Math.abs(Math.abs(Math.atan2(Math.sin(out.heading-into.heading),Math.cos(out.heading-into.heading)))-Math.PI)<1e-10;
        for(const pose of[into,out]) {
          const loc=ap.toLocal(pose.x,pose.z,{}), rel=pose.heading-ap.heading;
          // Conservative horizontal aircraft footprint in the airport frame.
          for(const s of ap.layout.structures)for(const b of structureBoxes(s)) {
            const hu=def.span/2+1,hv=def.length/2+4;
            if(Math.abs(loc.u-b.u)<hu+b.w/2 && Math.abs(loc.v-b.v)<hv+b.d/2)clear=false;
          }
          all &&= Math.abs(Math.sin(rel))>0.999;
        }
        for(const bad of[{onGround:false},{vx:1},{throttle:0.5},{crashed:true}])all &&=places.availableHangar({...p,...bad})===null;
        all &&=places.availableHangar({...p,onGround:false,gear:{hullHit:0.01}})===zone;
      }
    }
    check(all && compatible>0,`${def.id}: repeat visits, 180 degree departure, all bay selections and entry guards`);
    check(clear,`${def.id}: entry/departure footprints clear every compatible airport's buildings`);
    places.setTeleportMode('hangar');check(places.teleportMode==='hangar',`${def.id}: Hangar is a valid stored map destination`);
  }
  const a=new Aircraft(B737);
  const engine=a.built.damageGroups.engineL[0];
  const lip=engine.getObjectByName('cfm56-lip'),fan=engine.getObjectByName('cfm56-fan');
  lip.geometry.computeBoundingBox();
  check(fan.position.z+0.4<lip.geometry.boundingBox.max.z,'737: fan and spinner are recessed behind the open lip');
  let torus=false,valid=true;
  a.built.body.traverse(o=>{torus ||= o.geometry?.type==='TorusGeometry';if(o.geometry)valid &&= Array.from(o.geometry.attributes.position.array).every(Number.isFinite);});
  check(!torus && valid,'737: floating torus badge removed, exterior geometry finite');
  a.physics.reset({y:1000,speed:100,gear:1});a.physics.damage.set('wingL',0);a.updateVisual(1,0);
  check(!engine.visible && a.built.damageGroups.engineR.every(o=>o.visible),'737: complete nacelle/pylon follows broken wing ownership');a.dispose();
}
