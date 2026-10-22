// One world-owned time-sliced raster, shared even before opening the full map.
import {createRaster,renderRaster,mapMarkers} from './MapData.js';
import {MAP,FLIGHT_NAV as N} from '../data/tuning.js';
const caches=new WeakMap();
export function flightMapCache(world){
 let c=caches.get(world);if(!c){c=new FlightMapCache(world);caches.set(world,c);}return c;
}
export class FlightMapCache {
 constructor(world){
  this.world=world;this.raster=createRaster(MAP.resolution,world.cfg);this.revision=0;this.markers=mapMarkers(world);
  this.tracks=world.areas.list.map(a=>{
   const points=[];for(let i=0;i<a.track.count;i+=N.trackStride)points.push(a.toWorld(a.track.px[i],a.track.pz[i],{}));
   if(a.track.closed!==false&&points.length)points.push({...points[0]});return points;
  });
 }
 tick(){if(this.raster.row<this.raster.n){renderRaster(this.world,this.raster,Math.min(MAP.buildMs,N.cacheMs));this.revision++;}}
 get canvas(){
  if(!this._canvas){this._canvas=document.createElement('canvas');this._canvas.width=this._canvas.height=this.raster.n;this._ctx=this._canvas.getContext('2d');this._image=this._ctx.createImageData(this.raster.n,this.raster.n);}
  if(this._painted!==this.revision){this._image.data.set(this.raster.rgba);this._ctx.putImageData(this._image,0,0);this._painted=this.revision;}
  return this._canvas;
 }
}
