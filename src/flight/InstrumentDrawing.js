import {drawMap} from '../ui/FlightMapView.js';
// Renderer-neutral vector instruments. The same geometry and glyph strokes feed
// cockpit triangles and external Canvas2D; there are no textures or fake sensor values.
import {instrumentScale} from '../data/flightInstruments.js';
import {distanceIn} from './Units.js';
import {FLIGHT_INSTRUMENTS as I} from '../data/tuning.js';
const DEG=180/Math.PI,TAU=Math.PI*2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// Five by seven vector glyphs. Rows are five-bit masks, drawn as horizontal runs.
const GLYPHS={
 '0':'0E11131519110E','1':'040C040404040E','2':'0E11010204081F','3':'1E01010E01011E','4':'02060A121F0202','5':'1F10101E01011E','6':'0E10101E11110E','7':'1F010204080808','8':'0E11110E11110E','9':'0E11110F01010E',
 A:'0E11111F111111',B:'1E11111E11111E',C:'0E11101010110E',D:'1E11111111111E',E:'1F10101E10101F',F:'1F10101E101010',G:'0E11101711110F',H:'1111111F111111',I:'0E04040404040E',J:'0702020212120C',K:'11121418141211',L:'1010101010101F',M:'111B1515111111',N:'11191513111111',O:'0E11111111110E',P:'1E11111E101010',Q:'0E11111115120D',R:'1E11111E141211',S:'0F10100E01011E',T:'1F040404040404',U:'1111111111110E',V:'11111111110A04',W:'11111115151B11',X:'11110A040A1111',Y:'11110A04040404',Z:'1F01020408101F',
 '-':'0000001F000000','+':'0004041F040400','.':'00000000000C0C',':':'000C0C000C0C00','/':'01010204081010','%':'19190204081313','?':'0E110102040004',' ':'00000000000000',
};
const GLYPH_RUNS=Object.fromEntries(Object.entries(GLYPHS).map(([char,bits])=>{
 const runs=[];
 for(let r=0;r<7;r++){const mask=parseInt(bits.slice(r*2,r*2+2),16);let start=-1;
  for(let c=0;c<=5;c++){const on=c<5&&(mask&(1<<(4-c)));if(on&&start<0)start=c;
   if(!on&&start>=0){runs.push([r,start,c-start]);start=-1;}}
 }return[char,runs];
}));
export function vectorText(s,text,x,y,size,color,align='left',max=Infinity){
 const value=String(text).toUpperCase().slice(0,Math.floor(max/(size*6/7))),adv=size*6/7;
 if(align==='center')x-=value.length*adv/2;else if(align==='right')x-=value.length*adv;
 for(const char of value){
  for(const [r,start,n]of GLYPH_RUNS[char]||GLYPH_RUNS['?'])s.rect(x+start*size/7,y+r*size/7,n*size/7*.95,size/7*.88,color);
  x+=adv;
 }
}
function text(s,v,x,y,size,c,align='left',max=Infinity){vectorText(s,v,x,y,size,c,align,max);}
function circle(s,x,y,r,c,width=1,start=0,end=TAU){
 const n=Math.max(8,Math.ceil(Math.abs(end-start)*r/8));let ax=x+Math.cos(start)*r,ay=y+Math.sin(start)*r;
 for(let i=1;i<=n;i++){const a=start+(end-start)*i/n,bx=x+Math.cos(a)*r,by=y+Math.sin(a)*r;s.line(ax,ay,bx,by,c,width);ax=bx;ay=by;}
}
function frame(s,x,y,w,h,c,l=1){s.line(x,y,x+w,y,c,l);s.line(x+w,y,x+w,y+h,c,l);s.line(x+w,y+h,x,y+h,c,l);s.line(x,y+h,x,y,c,l);}
function base(s,p,w,h,title){s.rect(0,0,w,h,p.ink);text(s,title,10,7,11,p.text);s.line(9,24,w-9,24,p.dim,1);}
function clip(points,x,y,w,h){
 let pts=points;
 for(let edge=0;edge<4;edge++){
  const out=[],at=q=>edge===0?q[0]-x:edge===1?x+w-q[0]:edge===2?q[1]-y:y+h-q[1];
  for(let i=0;i<pts.length;i++){
   const a=pts[i],b=pts[(i+1)%pts.length],da=at(a),db=at(b);
   if(da>=0)out.push(a);if((da>=0)!==(db>=0)){const t=da/(da-db);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}
  }pts=out;
 }
 return pts;
}
function horizon(s,d,p,x,y,w,h){
 const cx=x+w/2,cy=y+h/2,k=h/65,co=Math.cos(-d.bank),si=Math.sin(-d.bank);
 const tr=(a,b)=>[cx+a*co-(b+d.pitch*DEG*k)*si,cy+a*si+(b+d.pitch*DEG*k)*co];
 for(const [color,a,b]of[[p.sky,-h*8,0],[p.ground,0,h*8]]){
  const pts=clip([tr(-w*8,a),tr(w*8,a),tr(w*8,b),tr(-w*8,b)],x,y,w,h);if(pts.length>2)s.poly(pts,color);
 }
 // Clip the pitch ladder to its display window, including inverted attitudes.
 for(let angle=-90;angle<=90;angle+=10){
  const len=angle===0?w*.45:angle%20===0?w*.18:w*.1;
  const a=tr(-len,-angle*k),b=tr(len,-angle*k),seg=clipLine(a,b,x,y,w,h);
  if(seg)s.line(...seg,p.text,angle===0?2:1);
  if(angle&&angle%20===0){const pos=tr(-len-13,-angle*k);if(pos[0]>x+8&&pos[0]<x+w-20&&pos[1]>y+8&&pos[1]<y+h-15)text(s,Math.abs(angle),pos[0],pos[1]-4,8,p.text);}
 }
 s.line(cx-28,cy,cx-10,cy,p.amber,3);s.line(cx+10,cy,cx+28,cy,p.amber,3);s.line(cx-10,cy,cx,cy+5,p.amber,2);s.line(cx,cy+5,cx+10,cy,p.amber,2);
 const fx=clamp(cx-d.beta*DEG*k,x+10,x+w-10),fy=clamp(cy+d.alpha*DEG*k,y+8,y+h-8);
 circle(s,fx,fy,4,p.green,1);s.line(fx-10,fy,fx-4,fy,p.green);s.line(fx+4,fy,fx+10,fy,p.green);
 frame(s,x,y,w,h,p.dim);
}
function clipLine(a,b,x,y,w,h){
 let lo=0,hi=1;const dx=b[0]-a[0],dy=b[1]-a[1];
 for(const [p,q]of[[-dx,a[0]-x],[dx,x+w-a[0]],[-dy,a[1]-y],[dy,y+h-a[1]]]){
  if(Math.abs(p)<1e-10){if(q<0)return null;}else{const r=q/p;if(p<0)lo=Math.max(lo,r);else hi=Math.min(hi,r);if(lo>hi)return null;}
 }return[a[0]+lo*dx,a[1]+lo*dy,a[0]+hi*dx,a[1]+hi*dy];
}
function tape(s,value,step,x,y,w,h,p,side,selected){
 s.rect(x,y,w,h,'#172326');
 const mid=y+h/2,spacing=h/7;
 for(let n=Math.floor(value/step)-4;n<=Math.floor(value/step)+4;n++){
  const val=n*step,ty=mid+(value-val)/step*spacing;if(side==='left'&&val<0)continue;if(ty<y+7||ty>y+h-12)continue;
  text(s,val,x+(side==='left'?w-8:8),ty-4,10,p.text,side==='left'?'right':'left');
  s.line(side==='left'?x+w-5:x,ty,side==='left'?x+w:x+5,ty,p.text);
 }
 s.rect(x-2,mid-12,w+4,25,p.ink);frame(s,x-2,mid-12,w+4,25,p.text,1.5);
 text(s,Math.round(value),x+w/2,mid-8,Math.min(16,(w-4)/(String(Math.round(value)).length*6/7)),p.text,'center');
 if(selected!==null)text(s,selected,x+w/2,y-17,11,p.magenta,'center');
}
function primary(s,d,p){
 base(s,p,320,280,d.apOn?'AP '+d.apMode.toUpperCase():'Manual flight');
 const scale=instrumentScale(d.units);
 horizon(s,d,p,76,57,162,125);
 tape(s,d.speed,scale.speedStep,12,57,58,125,p,'left',d.apOn?d.apSpeed:null);
 tape(s,d.height,scale.altitudeStep,244,57,64,125,p,'right',d.apOn?d.apAltitude:null);
 text(s,'CAS '+d.speedUnit,12,188,10,p.text);text(s,d.heightUnit,305,188,10,p.text,'right');
 text(s,`M ${d.mach.toFixed(2)}`,12,208,12,p.text);text(s,`TAS ${d.trueSpeed}`,12,229,11,p.text);
 text(s,`V/S ${d.verticalSpeed}`,308,208,11,p.text,'right');text(s,d.climbUnit,308,225,9,p.dim,'right');
 text(s,`HDG ${String(d.headingDeg).padStart(3,'0')} TRU`,160,242,12,p.green,'center');
 text(s,`AGL ${d.aboveGround} ${d.heightUnit}`,160,262,10,p.text,'center');
 // Small VSI scale beside the attitude window.
 const v=clamp(d.climb,-30,30)/30*48;s.line(230,119,238,119-v,p.green,2);
}
function navigation(s,d,p){
 base(s,p,320,280,`Navigation  ${String(d.headingDeg).padStart(3,'0')} TRU`);
 const offset={terrain:s.terrain?(cache,x,z,range,w,h)=>s.terrain(cache,x,z,range,w,h,8,29):null,rect:(x,y,w,h,c)=>s.rect(x+8,y+29,w,h,c),line:(x,y,xx,yy,c,w)=>s.line(x+8,y+29,xx+8,yy+29,c,w),poly:(pts,c)=>s.poly(pts.map(([x,y])=>[x+8,y+29]),c)};
 drawMap(offset,d,304,190);
 text(s,'N',18,35,10,p.text);
 const range=distanceIn(d.navRange/4,d.units);text(s,`${range.value.toFixed(1)} ${range.unit}`,307,205,9,p.text,'right');
 if(d.route?.active||d.route?.complete){
  const r=d.route,dist=distanceIn(r.remaining,d.units);
  text(s,r.complete?'Trip complete':`Leg ${r.leg}/${r.path.length-1} ${r.path[r.leg].label}`,160,235,10,p.magenta,'center',298);
  text(s,`${dist.value.toFixed(1)} ${dist.unit} remaining  ${d.apMode}`,160,254,10,p.text,'center');
  return;
 }
 text(s,d.nearest.name,160,235,11,p.cyan,'center',298);
 text(s,`${d.nearest.distance.toFixed(1)} ${d.nearest.unit}  BRG ${String(d.nearest.bearing).padStart(3,'0')}`,160,254,11,p.text,'center');
 if(!d.nearest.compatible)text(s,'Runway incompatible',160,270,8,p.amber,'center');
}
function engines(s,d,p){
 base(s,p,320,280,'Engine status');
 for(let i=0;i<d.engines.length;i++){
  const e=d.engines[i],x=80+i*160,c=e.health<.3?p.red:p.text;
  text(s,i===0?'Left':'Right',x,34,11,p.text,'center');
  circle(s,x,91,37,p.dim,2,Math.PI*.7,Math.PI*2.3);
  for(let k=0;k<=10;k++){const a=Math.PI*.7+k/10*Math.PI*1.6;s.line(x+Math.cos(a)*32,91+Math.sin(a)*32,x+Math.cos(a)*37,91+Math.sin(a)*37,p.text);}
  const angle=Math.PI*.7+clamp(e.spool/100,0,1)*Math.PI*1.6;s.line(x,91,x+Math.cos(angle)*31,91+Math.sin(angle)*31,p.green,2);
  text(s,e.spool.toFixed(1),x,134,20,c,'center');text(s,'Spool %',x,159,10,p.dim,'center');
  text(s,`FF ${Math.round(e.flow)}`,x,184,12,p.text,'center');text(s,'kg/h',x,201,9,p.dim,'center');
  text(s,`${e.thrust.toFixed(1)} kN`,x,219,12,p.text,'center');
 }
 text(s,`Fuel ${Math.round(d.fuelKg)} kg`,160,244,13,d.fuel<.12?p.amber:p.text,'center');
 s.rect(20,266,280,6,p.dim);s.rect(20,266,280*clamp(d.fuel,0,1),6,p.green);
}
function systems(s,d,p){
 base(s,p,400,200,'Aircraft systems');
 const lines=[`Gear ${d.gearLabel}`,`Flaps ${d.flapName}`,`Speedbrake ${Math.round(d.airbrake*100)}%`,
  `Brake ${Math.round(d.brake*100)}% ${d.parked?'Park':''}`,`Steer ${(d.steer*DEG).toFixed(0)} deg`,
  `AoA ${d.aoa.toFixed(1)}  G ${d.load.toFixed(1)}`,`Lever ${Math.round(d.throttle*100)}%`];
 if(d.hasBurner)lines.push(`AB ${Math.round(d.ab*100)}% R ${Math.round(d.abFuel*100)}%${d.abLocked?' Lock':''}`);
 for(let i=0;i<lines.length;i++)text(s,lines[i],10,33+i*16,11,p.text,'left',180);
 d.damageRows.forEach((row,i)=>{
  const y=33+i*16,c=row.health<.3?p.red:row.health<1?p.amber:p.green;
  text(s,row.label,205,y,10,c);s.rect(282,y+2,55,6,p.dim);s.rect(282,y+2,55*row.health,6,c);text(s,Math.round(row.health*100)+'%',390,y,10,c,'right');
 });
 text(s,`${d.apOn?'AP '+d.apMode.toUpperCase():'AP OFF'} ${d.apOn?d.apSpeed+' / '+d.apHeading+' / '+d.apAltitude:''}`,205,149,9,p.green,'left',185);
 s.line(9,174,391,174,p.dim);text(s,d.warning||'Systems normal',200,181,12,d.warningLevel===2?p.red:d.warning?p.amber:p.green,'center',382);
}
function autopilot(s,d,p,w,h){
 const slim=h<80; s.rect(0,0,w,h,p.ink);text(s,d.apOn?'AP '+d.apMode.toUpperCase():'AP OFF',8,6,slim?10:13,p.green);
 const y=slim?26:52,size=slim?20:19;
 for(const [label,val,x]of[['SPD',d.apSpeed,w*.25],['HDG',String(d.apHeading).padStart(3,'0'),w*.52],['ALT',d.apAltitude,w*.8]]){
  text(s,label,x,slim?6:28,10,p.dim,'center');text(s,d.apOn?val:'---',x,y,size,d.apOn?p.magenta:p.dim,'center');
 }
}
function status(s,d,p){base(s,p,320,110,'Flight status');text(s,`AoA ${d.aoa.toFixed(1)} G ${d.load.toFixed(1)}`,10,34,16,p.text);text(s,d.warning||`Gear ${d.gearLabel}`,10,66,12,d.warning?p.amber:p.green,'left',300);text(s,`Fuel ${Math.round(d.fuel*100)}%`,10,91,11,p.text);}
function standby(s,d,p){
 s.rect(0,0,320,100,p.ink);horizon(s,d,p,120,10,80,78);circle(s,160,49,40,p.text,2);
 text(s,'CAS '+d.speedUnit,54,13,11,p.dim,'center');text(s,d.speed,54,38,24,p.text,'center');text(s,'ALT '+d.heightUnit,264,13,11,p.dim,'center');text(s,d.height,264,38,22,p.text,'center');
}
function hud(s,d,p){
 const c=p.green,cx=160,cy=118,k=180/I.hudPitchSpan;
 text(s,String(d.headingDeg).padStart(3,'0'),160,3,15,c,'center');text(s,'TRU',160,23,8,c,'center');
 for(let a=-80;a<=80;a+=10){const x=-d.bank,co=Math.cos(x),si=Math.sin(x),yy=(d.pitch*DEG-a)*k;
  for(const sign of[-1,1]){
   const ax=sign*20,bx=sign*(a===0?64:44);
   for(let dash=0;dash<(a<0?3:1);dash++){
    const start=a<0?ax+(bx-ax)*dash/3:ax,end=a<0?ax+(bx-ax)*(dash+.65)/3:bx;
    const seg=clipLine([cx+start*co-yy*si,cy+start*si+yy*co],[cx+end*co-yy*si,cy+end*si+yy*co],62,38,196,155);
    if(seg)s.line(...seg,c,a===0?2:1);
   }
  }
  if(a&&a%20===0){const x=cx+50*co-yy*si,y=cy+50*si+yy*co;if(x>68&&x<240&&y>42&&y<183)text(s,a,x,y-4,9,c);}

 }
 frame(s,3,98,60,27,c);text(s,d.speed,33,104,18,c,'center');text(s,d.speedUnit,30,131,9,c,'center');
 frame(s,253,98,64,27,c);text(s,d.height,285,105,16,c,'center');text(s,d.heightUnit,285,131,9,c,'center');
 s.line(cx-16,cy,cx-5,cy,c,2);s.line(cx+5,cy,cx+16,cy,c,2);
 const fx=clamp(cx-d.beta*DEG*k,75,245),fy=clamp(cy+d.alpha*DEG*k,48,186);circle(s,fx,fy,5,c);s.line(fx-13,fy,fx-5,fy,c);s.line(fx+5,fy,fx+13,fy,c);s.line(fx,fy-11,fx,fy-5,c);
 text(s,`M ${d.mach.toFixed(2)}`,5,168,11,c);text(s,`G ${d.load.toFixed(1)}`,5,187,11,c);text(s,`V/S ${d.verticalSpeed}`,315,168,10,c,'right');text(s,d.climbUnit,315,185,8,c,'right');
 text(s,d.warning||(d.apOn?'AP '+d.apMode.toUpperCase():''),160,208,13,d.warning?p.amber:c,'center',300);
 text(s,`AGL ${d.aboveGround} ${d.heightUnit}`,160,230,9,c,'center');
}
export function drawInstrument(s,type,d,w=320,h=280){
 const p=d.profile.palette;
 if(type==='primary')primary(s,d,p);else if(type==='navigation')navigation(s,d,p);
 else if(type==='engines')engines(s,d,p);else if(type==='systems')systems(s,d,p);
 else if(type==='autopilot')autopilot(s,d,p,w,h);else if(type==='status')status(s,d,p);
 else if(type==='standby')standby(s,d,p);else if(type==='hud')hud(s,d,p);
}
