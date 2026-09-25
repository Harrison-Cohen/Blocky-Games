// Proves the CLAUDE.md invariant: handling must be identical at any frame rate.
// Feeds one identical input sequence through the real Loop at seven different
// frame rates and asserts the car ends in bit-identical state. Run: npm run check
import { fileURLToPath } from 'node:url';
const R = fileURLToPath(new URL('../src/', import.meta.url));
const { VehiclePhysics } = await import(R+'game/VehiclePhysics.js');
const { Track } = await import(R+'game/Track.js');
// Imported directly rather than through the registry: the registry uses
// import.meta.glob, which is a bundler feature and does not exist in Node.
const copperFlats = (await import(R+'data/tracks/copper-flats.js')).default;
const { getChassis } = await import(R+'data/cars.js');
const { SIM } = await import(R+'data/tuning.js');
const { Loop } = await import(R+'core/Loop.js');

// Run on the real track, so the spline ground query, the surface lookup and
// the barrier response are all part of what is being proved deterministic.
const ground = new Track(copperFlats);
const N=(t,b,s,h)=>({throttle:t,brake:b,steer:s,handbrake:h,steerIsAnalog:false,pedalsAreAnalog:false});
const TOTAL = 1440; // exactly 12 s of physics

// Input is a function of the PHYSICS step index, so every configuration feeds
// the model the identical input sequence. Any divergence is then real.
function inputForStep(n){
  const t = n / SIM.hz;
  // A stint that exercises everything: acceleration, braking, both steering
  // directions, a handbrake stab, and enough lateral input to reach a barrier.
  if(t<4) return N(1,0,0,0);
  if(t<5.2) return N(0,1,0.3,0);
  if(t<8) return N(0.8,0,-0.7,0);
  if(t<9) return N(0.4,0,1,1);
  return N(0.9,0,-0.4,0);
}

function runAt(fps, jitter, seed){
  const c=getChassis('mustang-gt');
  const v=new VehiclePhysics(c);
  const sp=ground.spawn();
  v.reset(sp.x, ground.sample(sp.x, sp.z).height + c.suspensionRest, sp.z, sp.yaw);
  for(let i=0;i<400;i++) v.step(1/SIM.hz, N(0,0,0,0), ground);
  let n=0;
  const loop=new Loop({ step:(d)=>{ if(n<TOTAL){ v.step(d, inputForStep(n), ground); n++; } }, render:null });
  // deterministic pseudo-random jitter so the comparison is fair
  let s=seed>>>0; const rnd=()=>{s=(s*1664525+1013904223)>>>0; return s/4294967296;};
  const frame=1/fps;
  let guard=0;
  while(n<TOTAL && guard++<200000){
    loop.advance(jitter ? frame*(0.55+rnd()*0.9) : frame);
  }
  return {v,n};
}

const ref=runAt(120,false,1);
console.log(`reference: 120 Hz, ${ref.n} physics steps, x=${ref.v.x.toFixed(6)} z=${ref.v.z.toFixed(6)} yaw=${ref.v.yaw.toFixed(6)}`);
let allOk=true;
for(const [fps,j,label] of [[60,false,'60 Hz'],[144,false,'144 Hz'],[30,false,'30 Hz'],[240,false,'240 Hz'],[75,false,'75 Hz'],[60,true,'60 Hz + jitter'],[45,true,'45 Hz + jitter']]){
  const {v,n}=runAt(fps,j,7);
  const d=Math.hypot(v.x-ref.v.x,v.y-ref.v.y,v.z-ref.v.z);
  const dy=Math.abs(v.yaw-ref.v.yaw);
  const ok = d===0 && dy===0;
  if(!ok) allOk=false;
  console.log(`${label.padEnd(16)} steps=${n}  pos delta ${d.toExponential(2)}  yaw delta ${dy.toExponential(2)}  ${ok?'IDENTICAL':'DIFFERS'}`);
}

// The other invariant this file exists to protect: cosmetic choices must not
// change how a car drives. Chassis is the only thing that touches the stats,
// so the same chassis under wildly different paint has to end the same stint
// in bit-identical state. Today that holds because the config never reaches
// VehiclePhysics at all -- which is exactly the property worth pinning down,
// because it is one careless argument away from not being true.
const { Vehicle } = await import(R+'game/Vehicle.js');
const { carAppearance, DEFAULT_CAR } = await import(R+'data/customization.js');

function runWith(car){
  const c=getChassis('mustang-gt');
  const veh=new Vehicle(c, carAppearance(car));
  const sp=ground.spawn();
  veh.physics.reset(sp.x, ground.sample(sp.x, sp.z).height + c.suspensionRest, sp.z, sp.yaw);
  for(let i=0;i<400;i++) veh.step(1/SIM.hz, N(0,0,0,0), ground);
  for(let n=0;n<TOTAL;n++) veh.step(1/SIM.hz, inputForStep(n), ground);
  return veh.physics;
}

const paintRef = runWith(DEFAULT_CAR);
const paintJobs = [
  { ...DEFAULT_CAR, primary:'lime', secondary:'violet', livery:'checker',
    wheelStyle:'knobby', wheelColor:'sand', spoiler:'wing', roofItem:'spare',
    headlight:'blue', number:88 },
  { ...DEFAULT_CAR, primary:'ink', secondary:'ink', livery:'split',
    wheelStyle:'deepdish', spoiler:'ducktail', roofItem:'lightbar', number:1 },
];
console.log('');
for(const car of paintJobs){
  const p=runWith(car);
  const d=Math.hypot(p.x-paintRef.x,p.y-paintRef.y,p.z-paintRef.z);
  const dy=Math.abs(p.yaw-paintRef.yaw);
  const ok = d===0 && dy===0;
  if(!ok) allOk=false;
  console.log(`${(car.livery+'/'+car.wheelStyle+'/'+car.spoiler).padEnd(28)} pos delta ${d.toExponential(2)}  yaw delta ${dy.toExponential(2)}  ${ok?'IDENTICAL':'DIFFERS'}`);
}

// --- reverse steers the way a car does -------------------------------------
//
// Held lock, rolling backwards: the car's PATH has to curve toward the side the
// wheel is turned, the same side it curves toward going forwards. The nose goes
// the other way, because when you reverse the tail leads.
//
// This is here because it was wrong, in a way no lap time would ever catch: the
// front slip angle was measured against |vLong|, so the front axle behaved as
// though the car were always going forwards, and reversing with the wheel to
// the right walked the car to the left.
console.log('');
const { CHASSIS } = await import(R + 'data/cars.js');
for (const chassis of CHASSIS) {
  for (const [name, wheel] of [['wheel left ', 1], ['wheel right', -1]]) {
    const veh = new Vehicle(chassis, carAppearance(DEFAULT_CAR));
    const sp = ground.spawn();
    veh.physics.reset(sp.x, ground.sample(sp.x, sp.z).height + chassis.suspensionRest,
      sp.z, sp.yaw);
    for (let i = 0; i < 120; i++) veh.step(1 / SIM.hz, N(0, 0, 0, 0), ground);
    const p = veh.physics;
    const yaw0 = p.yaw, x0 = p.x, z0 = p.z;
    const sy = Math.sin(yaw0), cy = Math.cos(yaw0);

    // Brake from a standstill is reverse. Hold it, and hold the lock, until the
    // car has actually gone somewhere. Measured at a fixed DISTANCE rather than
    // a fixed time: for the first metre the car is still pivoting about a point
    // behind it and its centre creeps the other way, and a 1900 kg truck is
    // still inside that first metre long after a 780 kg open-wheeler has left
    // it. A time limit tests how fast a car reverses, not which way it goes.
    // The distance is along the car's path, not straight back down its first
    // heading: at full lock a car that turns a circle under 10 m across goes
    // round it and never gets 5 m straight back.
    let along = 0, lateral = 0, steps = 0, travelled = 0;
    while (travelled < 5 && steps < 900) {
      veh.step(1 / SIM.hz, N(0, 0.7, wheel, 0), ground);
      steps++;
      travelled += p.speed / SIM.hz;
      along = (p.x - x0) * sy + (p.z - z0) * cy;
      lateral = (p.x - x0) * cy - (p.z - z0) * sy; // + is the car's left
    }

    // `steer` is pre-flip: +1 is the A key and turns left, and +x is the car's
    // left. Reversing, the path must go to the side the wheel is turned and the
    // NOSE must swing the other way, because the tail leads.
    const dyaw = p.yaw - yaw0;
    const pathOk = Math.sign(lateral) === Math.sign(wheel) && Math.abs(lateral) > 0.2;
    const noseOk = Math.sign(dyaw) === -Math.sign(wheel);
    const ok = travelled >= 5 && along < -1 && pathOk && noseOk;
    if (!ok) allOk = false;
    console.log(`${chassis.name.padEnd(14)} reversing, ${name}  -> path `
      + `${lateral > 0 ? 'LEFT ' : 'RIGHT'} ${Math.abs(lateral).toFixed(2)} m, nose `
      + `${dyaw > 0 ? 'left ' : 'right'} ${Math.abs(dyaw * 57.3).toFixed(0)} deg`
      + `   ${ok ? 'correct' : (along > -5 ? 'DID NOT REVERSE' : 'WRONG WAY')}`);
  }
}

// --- held lock at speed keeps turning the way it is steered ---------------
//
// Full keyboard lock at 162 km/h, held for three seconds. The nose has to keep
// turning toward the lock, and the front wheels have to stay pointed that way.
//
// This is here because it was wrong: the front went straight to its peak, the
// nose snapped round three times faster than the path could follow, the rear
// let go, and the steering limit swung the wheels onto the OTHER lock while the
// key was still held -- the car stopped turning, and even yawed the wrong way,
// with D down. STEERING.yawStability is what holds it.
console.log('');
const flat = {
  sample: () => ({ height: 0, normal: { x: 0, y: 1, z: 0 }, surface: 'tarmac', onTrack: true }),
  bounds: () => ({ lateral: 0, limit: 1e9, inwardX: 0, inwardZ: 0, onTrack: true }),
};
for (const chassis of CHASSIS) {
  for (const [name, key] of [['right (D)', -1], ['left (A) ', 1]]) {
    const p = new VehiclePhysics(chassis);
    p.reset(0, chassis.suspensionRest, 0, 0);
    for (let i = 0; i < 240; i++) p.step(1 / SIM.hz, N(0, 0, 0, 0), flat);
    p.vLong = 45;
    const yaw0 = p.yaw;
    let wrongYaw = 0, wrongWheel = 0;
    for (let i = 0; i < 3 * SIM.hz; i++) {
      p.step(1 / SIM.hz, N(p.vLong < 45 ? 0.6 : 0, 0, key, 0), flat);
      // `key` has the sign of the lock, so the product is negative only when
      // the car yaws, or the wheels point, the other way.
      if (p.yawRate * key < -0.03) wrongYaw += 1 / SIM.hz;
      if (p.steerAngleUsed * key < -0.01) wrongWheel += 1 / SIM.hz;
    }
    const turned = (p.yaw - yaw0) * key * 57.3;
    const ok = wrongYaw === 0 && wrongWheel === 0 && turned > 30;
    if (!ok) allOk = false;
    console.log(`${chassis.name.padEnd(14)} full lock ${name} at 162 km/h -> turned `
      + `${turned.toFixed(0)} deg, yawed the wrong way ${wrongYaw.toFixed(2)} s, wheels on `
      + `the wrong lock ${wrongWheel.toFixed(2)} s   ${ok ? 'correct' : 'WRONG'}`);
  }
}

console.log(allOk
  ? '\nPASS: handling is frame-rate invariant, unchanged by paint, and reverses correctly.'
  : '\nFAIL: handling is not invariant.');
process.exit(allOk?0:1);
