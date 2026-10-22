// Render the real Web Audio graph offline. Signal checks are not listening tests.
import {launch} from '../lib/browser.mjs';
const b=await launch({url:process.argv[2]||'http://localhost:5186',port:9372});
let count=0;
const check=(ok,s)=>{if(!ok)throw Error(s);console.log('ok '+s);count++;};
try{
 const result=await b.eval(`(async()=>{
  const {FlightAudio}=await import('/src/core/FlightAudio.js'),{F22,B737}=await import('/src/data/aircraft.js');
  const rows=[];
  for(const def of[F22,B737])for(const mode of['idle','power','cabin','burner','shutdown','one-engine','warning']){
   const ctx=new OfflineAudioContext(1,72000,24000),master=ctx.createGain();master.connect(ctx.destination);
   const audio=new FlightAudio({ctx,master,ready:true});audio.setAircraft(def);
   const n=mode==='idle'?0:1,dead=mode==='shutdown';
   const engines=[0,1].map((_,i)=>({n:dead?0:n,running:!dead,health:dead||mode==='one-engine'&&i===0?0:1,abLevel:mode==='burner'&&def===F22?1:0}));
   let booms=0;audio._boom=()=>booms++;
   audio.update({engines,spool:n,ab:1,fuelOk:!dead,speed:0,cockpit:mode==='cabin',boom:true,stallWarn:mode==='warning',dt:1/60});
   const buffer=await ctx.startRendering(),v=buffer.getChannelData(0);let sum=0,peak=0,diff=0;
   for(let i=24000;i<v.length;i++){sum+=v[i]*v[i];peak=Math.max(peak,Math.abs(v[i]));diff+=(v[i]-v[i-1])**2;}
   const whine=audio.whines.map(v=>({pitch:v.osc.frequency.value,gain:v.gain.gain.value,wave:v.osc.type}));
   rows.push({id:def.id,mode,rms:Math.sqrt(sum/(v.length-24000)),peak,high:Math.sqrt(diff/(v.length-24000)),booms,whine,lfo:!!audio.swellA||!!audio.flickerA});
  }
  return rows;
 })()`);
 for(const row of result)console.log(JSON.stringify(row));
 for(const id of['f22','b737']){
  const row=m=>result.find(r=>r.id===id&&r.mode===m),p=row('power'),c=row('cabin');
  check(p.rms>row('idle').rms*1.5,`${id}: real spool raises broad engine energy`);
  check(c.rms<p.rms*.65&&c.high<p.high*.6,`${id}: pilot viewpoint attenuates and filters engines`);
  check(row('shutdown').peak<.00001,`${id}: stopped/failed engines decay to silence`);
  check(row('one-engine').rms<p.rms*.8,`${id}: failed engine removes its voice`);
  check(result.filter(r=>r.id===id).every(r=>Number.isFinite(r.rms)&&r.peak<1&&!r.lfo),`${id}: finite unclipped audio without repeating engine LFOs`);
  check(c.booms===0&&p.booms===1,`${id}: boom suppressed in pilot views, retained in external presentation`);
  check(row('warning').high>p.high,`${id}: useful warning spectrum retained`);
 }
 check(result.find(r=>r.id==='f22'&&r.mode==='burner').rms>result.find(r=>r.id==='f22'&&r.mode==='power').rms,'F-22 burner follows actual individual-engine burner state');
 check(result.find(r=>r.id==='b737'&&r.mode==='power').whine[0].wave!==result.find(r=>r.id==='f22'&&r.mode==='power').whine[0].wave,'aircraft have distinct fan/turbine harmonic profiles');
 const bad=b.console.filter(l=>/^(error|warning|EXCEPTION)/i.test(l)&&!/vite/i.test(l));if(bad.length)throw Error(bad.join('\n'));
 console.log(count+' C audio signal checks passed; no listening or sound-authenticity claim');
}finally{await b.close();}
