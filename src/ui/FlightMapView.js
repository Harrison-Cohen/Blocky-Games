// Shared north-up transforms and renderer-neutral bounded map geometry.
import {FLIGHT_NAV as N} from '../data/tuning.js';
export const mapX=(x,cx,range,w)=>w/2+(cx-x)*w/range;
export const mapY=(z,cz,range,h,w=h)=>h/2+(cz-z)*w/range;
export const worldAt=(px,py,cx,cz,range,w,h)=>({x:cx-(px-w/2)*range/w,z:cz-(py-h/2)*range/w});
// Clip strokes so both physical panels and Canvas obey the same map bounds.
export function mapLine(s,x0,y0,x1,y1,c,width,w,h){
 let t0=0,t1=1;const dx=x1-x0,dy=y1-y0;
 for(const [p,q]of[[-dx,x0],[dx,w-x0],[-dy,y0],[dy,h-y0]]){
  if(p===0){if(q<0)return;}else{const t=q/p;if(p<0)t0=Math.max(t0,t);else t1=Math.min(t1,t);if(t0>t1)return;}
 }
 s.line(x0+dx*t0,y0+dy*t0,x0+dx*t1,y0+dy*t1,c,width);
}
export function drawMap(s,d,w,h){
 const cache=d.mapCache,range=d.navRange,x=wx=>mapX(wx,d.x,range,w),y=wz=>mapY(wz,d.z,range,h,w);
 s.rect(0,0,w,h,'#0e1a2b');
 if(cache){
  const r=cache.raster,n=N.terrainCells,cw=w/n,ch=h/n;
  if(s.terrain)s.terrain(cache,d.x,d.z,range,w,h);
  else {
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){
   const wx=d.x-((i+.5)*cw-w/2)*range/w,wz=d.z-((j+.5)*ch-h/2)*range/w;
   const px=Math.floor((r.size/2-wx)/r.cell),py=Math.floor((r.size/2-wz)/r.cell);
   if(px<0||py<0||px>=r.n||py>=r.row)continue;
   const k=(py*r.n+px)*4,c=`rgb(${r.rgba[k]},${r.rgba[k+1]},${r.rgba[k+2]})`;
   s.rect(i*cw,j*ch,cw+.1,ch+.1,c);
  }
  }
  for(const points of cache.tracks)for(let i=1;i<points.length;i++)mapLine(s,x(points[i-1].x),y(points[i-1].z),x(points[i].x),y(points[i].z),'#edede7',1,w,h);
 }
 for(const m of d.landmarks||[])if(m.kind==='airport'){
  const len=Math.max(m.length||200,range/w*4),dx=-Math.sin(m.heading||0)*len/2,dz=Math.cos(m.heading||0)*len/2;
  mapLine(s,x(m.x-dx),y(m.z-dz),x(m.x+dx),y(m.z+dz),'#65dbfa',2,w,h);
 }
 const route=d.route,path=route?.path.length?route.path:route?[route.trip.origin,...route.trip.points].filter(Boolean):[];
 for(let i=1;i<path.length;i++)mapLine(s,x(path[i-1].x),y(path[i-1].z),x(path[i].x),y(path[i].z),route.active&&i===route.leg?'#f5c518':'#ff92e0',2,w,h);
 for(let i=0;i<path.length;i++){
  const xx=x(path[i].x),yy=y(path[i].z);if(xx>4&&yy>4&&xx<w-4&&yy<h-4){s.rect(xx-3,yy-3,6,6,i===route.leg?'#f5c518':'#ff92e0');}
 }
 const cx=w/2,cy=h/2,si=Math.sin(d.heading),co=Math.cos(d.heading);
 const pt=(rx,ry)=>[cx+rx*co-ry*si,cy+rx*si+ry*co];
 s.poly([pt(0,-8),pt(5,6),pt(0,3),pt(-5,6)],'#34ff8a');
 s.line(8,h-10,8+w/4,h-10,'#edede7',2);
}
