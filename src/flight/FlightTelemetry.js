// One read-only render snapshot for physical instruments and the screen HUD.
// Physics stays SI. No renderer, storage writes or control commands here.
import {speedIn,altitudeIn,climbIn,distanceIn} from './Units.js';
import {displayHeading,instrumentProfile} from '../data/flightInstruments.js';
import {FLIGHT_DAMAGE as D,FLIGHT_INSTRUMENTS as I} from '../data/tuning.js';
const DEG=180/Math.PI;
const short={wingL:'Wing L',wingR:'Wing R',engineL:'Engine L',engineR:'Engine R',tail:'Tail',gear:'Gear',fuselage:'Hull'};
export function createFlightTelemetry(def) {
  return {engines:def.engines.map(()=>({spool:0,flow:0,thrust:0,health:1})),
    damageRows:def.damage.map(p=>({id:p.id,label:short[p.id]||p.name,health:1})),
    nearest:{name:'',distance:0,bearing:0,compatible:true}, landmarks:[], profile:instrumentProfile(def)};
}
export function updateFlightTelemetry(d,p,ctx) {
  const def=p.def,a=p.attitude(), units=ctx.units||'aviation';
  d.units=units;d.profile=instrumentProfile(def);
  for(const k of ['cas','tas','mach','altitude','climb','alpha','beta','nz','throttle','abLevel','abFuel','abLocked','fuel','onGround','brake','parked','stalled','stallWarn','x','z'])d[k]=p[k];
  d.pitch=a.pitch;d.bank=a.bank;d.heading=a.heading;d.headingDeg=displayHeading(a.heading);
  d.agl=Math.max(0,ctx.world.agl(p.x,p.y,p.z)-1.5);
  d.gear=p.gearDown;d.flaps=p.flapPos;d.flapName=ctx.flapName;d.airbrake=p.airbrake;
  d.steer=p.gear.steerAngle;d.weightOnWheels=p.gear.weightOnWheels;
  d.ab=p.abLevel;d.fuelKg=p.fuel;d.fuel=p.fuel/def.fuelCapacity;
  d.hasBurner=def.engines.some(e=>e.ab>e.dry);d.gearLabel=d.gear>.97?'Down':d.gear<.03?'Up':'Transit';
  d.gearWarn=!p.onGround&&p.gearDown<.5&&d.agl<p.F.gearWarnAgl&&p.cas<p.F.gearWarnCas&&p.climb<3;
  const sp=speedIn(p.cas,units),al=altitudeIn(p.altitude,units),vs=climbIn(p.climb,units);
  d.speed=Math.round(sp.value);d.speedUnit=sp.unit;d.trueSpeed=Math.round(speedIn(p.tas,units).value);
  d.height=Math.round(al.value);d.heightUnit=al.unit;d.aboveGround=Math.round(altitudeIn(d.agl,units).value);
  d.verticalSpeed=Math.round(vs.value/(units==='metric'?1:50))*(units==='metric'?1:50);d.climbUnit=vs.unit;
  d.aoa=p.alpha*DEG;d.load=p.nz;d.resetProgress=ctx.resetProgress||0;d.where=ctx.where||'';
  d.ap=ctx.ap;d.apOn=!!ctx.ap?.on;d.apMode=d.apOn?(ctx.ap.mode||'Hold'):'Off';
  d.apAltitude=Math.round(altitudeIn(ctx.ap?.alt||0,units).value);
  d.apSpeed=Math.round(speedIn(ctx.ap?.spd||0,units).value);d.apHeading=displayHeading(ctx.ap?.hdg||0);
  d.damage=p.damage;d.damageLevel=0;
  for(let i=0;i<d.damageRows.length;i++){
    const row=d.damageRows[i];row.health=p.damage.get(row.id);
    if(row.health<D.fire)d.damageLevel=Math.max(d.damageLevel,2);
    else if(row.health<D.smoke)d.damageLevel=Math.max(d.damageLevel,1);
  }
  for(let i=0;i<d.engines.length;i++){
    const e=p.engines[i],out=d.engines[i];out.spool=e.n*100;out.flow=e.fuelFlow*3600;out.thrust=e.thrust/1000;out.health=e.health;
  }
  d.warning='';d.warningLevel=0;
  if(p.crashed){d.warning='Aircraft lost';d.warningLevel=2;}
  else if(p.stalled){d.warning='Stall';d.warningLevel=2;}
  else if(p.stallWarn){d.warning='Stall warning';d.warningLevel=1;}
  else if(d.agl<120&&p.climb< -12&&d.gear<.5){d.warning='Pull up';d.warningLevel=2;}
  else if(d.gearWarn){d.warning='Gear is up';d.warningLevel=2;}
  else if(d.damageLevel){d.warning=d.damageLevel===2?'Critical damage':'Damage caution';d.warningLevel=d.damageLevel;}
  else if(d.fuel<.05){d.warning='Fuel';d.warningLevel=1;}
  d.landmarks=ctx.landmarks||[];d.navRange=I.navRange;
  let nearest=null,nd=Infinity;
  for(const m of d.landmarks)if(m.kind==='airport'){
    const dist=Math.hypot(m.x-p.x,m.z-p.z);if(dist<nd){nd=dist;nearest=m;}
  }
  const n=d.nearest;
  n.name=nearest?.name||'No airport';n.metres=nearest?nd:0;
  n.bearing=nearest?displayHeading(Math.atan2(-(nearest.x-p.x),nearest.z-p.z)):0;
  n.distance=distanceIn(n.metres,units).value;n.unit=distanceIn(0,units).unit;
  n.compatible=!nearest||(!nearest.pad&&nearest.length>=(def.ground?.minRunway||0));
  return d;
}
