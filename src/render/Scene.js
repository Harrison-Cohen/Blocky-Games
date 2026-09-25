// Renderer and lighting. Everything that makes one track look like a different
// place from another comes out of that track's own palette, so this file has no
// colors of its own.

import * as THREE from 'three';
import { WORLD, GRAPHICS } from '../data/tuning.js';
import { PostFX } from './PostFX.js';
import { Sky } from './Sky.js';
import { TrackLights } from './TrackLights.js';

const TMP_DIR = new THREE.Vector3();

export class Scene {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    // The spec's cap. Integrated GPUs fall off a cliff above this.
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, WORLD.maxPixelRatio));
    this.renderer.shadowMap.enabled = true;
    // PCFSoftShadowMap is deprecated as of three r185 and falls back to this
    // anyway, with a console warning. Ask for it directly.
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    // ACES filmic tone mapping. Without it a bright flank and a specular
    // highlight both clip to pure white and the smooth bodywork loses the
    // shape the highlight was there to describe. Exposure compensates for the
    // midtone darkening ACES applies. Set the exposure to 0 to switch it off.
    if (WORLD.toneMappingExposure > 0) {
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = WORLD.toneMappingExposure;
    }

    this.scene = new THREE.Scene();
    // Near plane at 0.2 m rather than 0.1: the far plane now reaches the sky
    // dome, and depth precision is set by the ratio of the two.
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.2, GRAPHICS.skyRadius + 200);

    // One hemisphere light for bounce, one directional for shape and shadow.
    // Two lights is all a flat-shaded world needs.
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
    this.scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(0xffffff, 2.0);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(WORLD.shadowMapSize, WORLD.shadowMapSize);
    this.sun.shadow.bias = -0.0009;
    this.sun.shadow.normalBias = 0.03;
    this.sun.shadow.radius = GRAPHICS.shadowSoftness;
    const r = WORLD.shadowRadius;
    const cam = this.sun.shadow.camera;
    cam.left = -r; cam.right = r; cam.top = r; cam.bottom = -r;
    cam.near = 1; cam.far = 400;
    cam.updateProjectionMatrix();
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    this.sunDir = { x: -0.45, y: 1.0, z: 0.35 };
    this.trackGroup = null;

    this.sky = new Sky();
    this.scene.add(this.sky.group);
    this.scene.add(this.sky.cloudGroup);
    this.trackLights = new TrackLights(this.scene);

    // Dynamic resolution. renderScale multiplies the pixel ratio; see
    // _adaptResolution.
    this.renderScale = 1;
    this._rs = { time: 0, frames: 0, sum: 0, good: 0, hold: 2, raisedAt: -1, clock: 0 };
    this.post = GRAPHICS.postFX ? new PostFX(this.renderer, this.scene, this.camera) : null;

    this._onResize = this._onResize.bind(this);
    window.addEventListener('resize', this._onResize);
    this._onResize();
  }

  // Swap in a track: its geometry, its light, its horizon. Called once per
  // track load, so it also tears down whatever was there before.
  setTrack(track, mesh) {
    this.trackData = track.data;
    if (this.trackGroup) {
      this.scene.remove(this.trackGroup);
      this.trackGroup = null;
    }
    const p = track.palette;
    this.scene.background = new THREE.Color(p.sky);
    // Fog color matches the horizon exactly, so scenery fades instead of popping.
    const fog = track.data.fog || { near: WORLD.fogNear, far: WORLD.fogFar };
    this.scene.fog = new THREE.Fog(p.fog ?? p.sky, fog.near, fog.far);
    this.camera.far = Math.max(fog.far + 400, GRAPHICS.skyRadius + 200);
    this.camera.updateProjectionMatrix();

    // The hemisphere fill defaults to the sky, which is right for a daylight
    // track and wrong for a night one: there the sky is nearly black, so the
    // fill contributes nothing and the player's own car goes dark. A track can
    // name the colour of its ambient separately from the colour of its horizon.
    this.hemi.color.setHex(p.hemiSky ?? p.sky);
    this.hemi.groundColor.setHex(p.hemiGround ?? p.ground);
    this.hemi.intensity = track.data.hemiIntensity ?? 1.0;

    this.sun.color.setHex(p.sun ?? 0xffffff);
    this.sun.intensity = track.data.sunIntensity ?? 2.0;
    const d = track.data.sunDirection || this.sunDir;
    this.sunDir = d;

    this.scene.add(mesh.group);
    this.trackGroup = mesh.group;

    this.sky.setTrack(track, d);
    this.trackLights.setTrack(mesh.lights);
    if (this.post) this.post.setTrack(track.data);
    // The first frames on a new track compile shaders and are slow for a
    // reason that has nothing to do with resolution. Do not judge them.
    this._rs.hold = 2;
  }

  // A new graphics level, live. Everything that read GRAPHICS or WORLD when it
  // was built is built again: the post chain, the sun's shadow map, the lamp
  // pool and the scenery's optional shadows. The first frames after it
  // compile shaders, so the resolution governor is told to ignore them.
  applyGraphics(mesh) {
    if (this.post) this.post.dispose();
    this.post = GRAPHICS.postFX ? new PostFX(this.renderer, this.scene, this.camera) : null;
    if (this.post && this.trackData) this.post.setTrack(this.trackData);
    // Without the post chain nothing adapts the exposure, so it goes back to
    // the track's own rather than staying wherever the eye had it.
    if (!this.post && WORLD.toneMappingExposure > 0) {
      this.renderer.toneMappingExposure = WORLD.toneMappingExposure;
    }
    const sh = this.sun.shadow;
    sh.mapSize.set(WORLD.shadowMapSize, WORLD.shadowMapSize);
    sh.radius = GRAPHICS.shadowSoftness;
    if (sh.map) { sh.map.dispose(); sh.map = null; }
    if (mesh) {
      mesh.applyShadows();
      this.trackLights.setTrack(mesh.lights);
    }
    this.renderScale = 1;
    this.settle();
    this._onResize();
  }

  // Everything that follows the car or the camera, once per rendered frame.
  frame(x, y, z, dt) {
    this._adaptResolution(dt);
    if (this.post) this.post.adapt(dt);
    this.fitShadowTo(x, y, z);
    this.sky.update(this.camera.position, dt);
    // Lamps are handed out around a point ahead of the camera, not at it: the
    // pools of light that matter are the ones you are driving into, not the
    // ones behind you.
    this.camera.getWorldDirection(TMP_DIR);
    const c = this.camera.position;
    this.trackLights.update(c.x + TMP_DIR.x * 30, c.y, c.z + TMP_DIR.z * 30);
  }

  // The shadow camera is small and tight so the map stays crisp. That means it
  // has to be dragged along with the car every frame, and its projection
  // rebuilt, or shadows silently vanish as you drive away from the origin.
  fitShadowTo(x, y, z) {
    this.sun.target.position.set(x, y, z);
    this.sun.target.updateMatrixWorld();
    const d = this.sunDir;
    this.sun.position.set(x + d.x * 90, y + d.y * 90, z + d.z * 90);
    this.sun.shadow.camera.updateProjectionMatrix();
  }

  // Hold the frame rate by trading pixels. The frame is fill bound -- measured
  // on a MacBook Air, every effect here costs in proportion to the pixel count
  // -- so frame time goes with the square of this scale, and the correction
  // for a slow second is the square root of how far over it was.
  //
  // It steps down at once, because a slow frame is felt immediately. It steps
  // up slowly, a little at a time, only after several seconds with room to
  // spare; and if a step up is followed straight away by a step down, it stops
  // trying for twenty seconds, so it settles instead of hunting.
  _adaptResolution(dt) {
    const rs = this._rs;
    if (!GRAPHICS.dynamicResolution || !this.drawable || !(dt > 0)) return;
    rs.clock += dt;
    if (rs.hold > 0) { rs.hold -= dt; return; }
    // A single long frame is a hitch -- a shader compiling, a car being built,
    // the garbage collector -- not a sign that there are too many pixels.
    // Counting it would drop the resolution for half a minute over one frame.
    if (dt > 0.1) return;
    rs.time += dt; rs.sum += dt; rs.frames++;
    if (rs.time < 1) return;
    const avg = rs.sum / rs.frames;
    rs.time = 0; rs.sum = 0; rs.frames = 0;

    const budget = 1 / GRAPHICS.targetFps;
    let next = this.renderScale;
    if (avg > budget * 1.08) {
      next = this.renderScale * Math.sqrt(budget / avg) * 0.97;
      rs.good = 0;
      // Straight back down after going up: that step was one too far.
      if (rs.raisedAt >= 0 && rs.clock - rs.raisedAt < 3) rs.hold = 20;
    } else if (avg < budget * 1.03) {
      rs.good++;
      if (rs.good >= 4 && this.renderScale < 1) {
        next = this.renderScale * 1.07;
        rs.good = 0;
        rs.raisedAt = rs.clock;
      }
    } else {
      rs.good = 0;
    }
    next = Math.min(1, Math.max(GRAPHICS.minRenderScale, next));
    if (Math.abs(next - this.renderScale) < 0.01) return;
    this.renderScale = next;
    this._onResize();
  }

  // Ignore frame times for a moment: something is about to cause a hitch that
  // says nothing about resolution, like building a field of cars.
  settle(seconds = 2) {
    this._rs.hold = Math.max(this._rs.hold, seconds);
  }

  _onResize() {
    // Floored at 1: some browsers report a window of zero before the first real
    // layout, and a render target of zero size is an incomplete framebuffer
    // that fails every draw until the next resize comes along.
    // A window with no area -- hidden, or not laid out yet -- is not drawn to
    // at all. Sizing everything to one pixel instead is not enough: the bloom
    // pass halves its target five times over, and half of one pixel rounds to
    // a render target of zero size that fails every draw.
    this.drawable = window.innerWidth > 0 && window.innerHeight > 0;
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    const base = Math.min(window.devicePixelRatio || 1, WORLD.maxPixelRatio);
    this.renderer.setPixelRatio(base * (this.renderScale ?? 1));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.post) this.post.setSize(w, h, this.renderer.getPixelRatio());
  }

  render(dt = 0) {
    if (!this.drawable) return;
    if (this.post) this.post.render(dt);
    else this.renderer.render(this.scene, this.camera);
  }

  // Another camera like the main one, for the other half of a split screen.
  makeCamera() {
    return this.camera.clone();
  }

  // Split screen: views[0] in the top half, views[1] in the bottom, each with
  // the sun's shadow fitted to its own car. views: [{ camera, x, y, z }].
  //
  // The post chain draws one camera to the whole canvas, so a split screen
  // renders straight to the canvas without it: no ambient occlusion or bloom,
  // tone mapped the way the Low graphics level is.
  renderSplit(views, dt = 0) {
    if (!this.drawable) return;
    this._adaptResolution(dt);
    const r = this.renderer;
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    const top = Math.floor(h / 2);
    r.setScissorTest(true);
    views.forEach((v, k) => {
      const cam = v.camera;
      // Viewports count from the bottom left.
      const y = k === 0 ? h - top : 0;
      const vh = k === 0 ? top : h - top;
      const aspect = w / vh;
      if (Math.abs(cam.aspect - aspect) > 1e-4) { cam.aspect = aspect; cam.updateProjectionMatrix(); }
      this.fitShadowTo(v.x, v.y, v.z);
      this.sky.update(cam.position, k === 0 ? dt : 0);
      r.setViewport(0, y, w, vh);
      r.setScissor(0, y, w, vh);
      r.render(this.scene, cam);
    });
    r.setScissorTest(false);
    r.setViewport(0, 0, w, h);
  }

  // Back to one view: the main camera's own aspect again.
  endSplit() {
    this._onResize();
  }

  // Build every shader the scene can need now, hidden objects included,
  // rather than the first time each one comes into view: a shader built
  // mid-lap stalls that frame, by a quarter of a second on Copper Flats.
  // Programs already built cost nothing here, so calling it again is cheap.
  prewarm() {
    this.renderer.compile(this.scene, this.camera);
  }

  add(obj) { this.scene.add(obj); }

  dispose() {
    window.removeEventListener('resize', this._onResize);
    if (this.post) this.post.dispose();
    this.trackLights.dispose();
    this.renderer.dispose();
  }
}
