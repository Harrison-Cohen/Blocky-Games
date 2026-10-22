// Post-processing: the frame is rendered into an HDR target and finished here
// before it reaches the screen.
//
//   ambient occlusion   GTAO. The single biggest thing this adds to a world
//                       made of boxes: every box sitting on the ground gets a
//                       contact shadow where it meets it, every container stack
//                       darkens where it is stacked, and a wheel arch reads as a
//                       hole. Worked out at half resolution (GRAPHICS.aoScale):
//                       it is soft shading with no fine detail in it, and at
//                       full resolution it was half the frame on a MacBook Air.
//   bloom               Anything brighter than white spills light into the
//                       pixels around it. Materials opt in with `glow`, so a
//                       sodium lamp, a neon strip, a brake light and the sun
//                       bloom, and a sunlit white curb does not. Also at half
//                       resolution, since it is a blur.
//   metering            A 64 x 36 copy of the frame's brightness, read back
//                       without stalling the GPU, which drives the exposure:
//                       see adapt().
//   finish              Vignette, tone mapping and the conversion to sRGB, in
//                       one full-screen pass. As two passes the vignette alone
//                       cost two milliseconds at 2940 x 1912.
//
// Anti-aliasing is 4x MSAA on the scene target, because the renderer's own
// antialias flag only applies when drawing straight to the screen.
//
// None of this is a texture on a surface. Surfaces stay flat-shaded Lambert and
// the cars stay Phong; this only works on the finished image. The shader
// materials here are full-screen passes over that image, not materials on
// anything in the world, which is why they live here and not in Materials.js.
//
// The garage does not come through here. It draws its own scene straight to
// the canvas, and the renderer tone maps that the same way.

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { GRAPHICS, WORLD } from '../data/tuning.js';

const QUAD_VS = /* glsl */ `
  precision highp float;
  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  attribute vec3 position;
  attribute vec2 uv;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

// Vignette, tone mapping and sRGB in one pass. The same tone mapping three's
// OutputPass applies, from the same shader chunks, with the vignette folded in
// ahead of it rather than run as a pass of its own.
class FinishPass extends Pass {
  constructor(renderer) {
    super();
    const defines = {};
    if (renderer.toneMapping === THREE.ACESFilmicToneMapping) defines.ACES_FILMIC_TONE_MAPPING = '';
    if (renderer.outputColorSpace === THREE.SRGBColorSpace) defines.SRGB_TRANSFER = '';
    this.material = new THREE.RawShaderMaterial({
      name: 'Finish',
      defines,
      uniforms: {
        tDiffuse: { value: null },
        toneMappingExposure: { value: 1 },
        vignette: { value: GRAPHICS.vignette },
      },
      vertexShader: QUAD_VS,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform sampler2D tDiffuse;
        uniform float vignette;
        #include <tonemapping_pars_fragment>
        #include <colorspace_pars_fragment>
        varying vec2 vUv;
        void main() {
          gl_FragColor = texture2D(tDiffuse, vUv);
          vec2 d = vUv - 0.5;
          gl_FragColor.rgb *= 1.0 - vignette * smoothstep(0.2, 1.0, dot(d, d) * 2.0);
          #ifdef ACES_FILMIC_TONE_MAPPING
            gl_FragColor.rgb = ACESFilmicToneMapping(gl_FragColor.rgb);
          #endif
          #ifdef SRGB_TRANSFER
            gl_FragColor = sRGBTransferOETF(gl_FragColor);
          #endif
        }`,
    });
    this.quad = new FullScreenQuad(this.material);
  }

  render(renderer, writeBuffer, readBuffer) {
    this.material.uniforms.tDiffuse.value = readBuffer.texture;
    this.material.uniforms.toneMappingExposure.value = renderer.toneMappingExposure;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }

  dispose() {
    this.material.dispose();
    this.quad.dispose();
  }
}

// How bright the frame is, as a 64 x 36 grid of log-average luminance. Each
// cell averages sixteen taps over its patch of screen, in log space, so one
// white lamp head does not outvote a screen of dark road. Written as bytes:
// log2 luminance from -12 to +4, which is a sixteenth of a stop per step.
const METER_W = 64;
const METER_H = 36;
class MeterPass extends Pass {
  constructor() {
    super();
    this.needsSwap = false;
    this.target = new THREE.WebGLRenderTarget(METER_W, METER_H, { depthBuffer: false });
    this.material = new THREE.RawShaderMaterial({
      name: 'Meter',
      uniforms: {
        tDiffuse: { value: null },
        cell: { value: new THREE.Vector2(1 / METER_W, 1 / METER_H) },
      },
      vertexShader: QUAD_VS,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform sampler2D tDiffuse;
        uniform vec2 cell;
        varying vec2 vUv;
        void main() {
          float sum = 0.0;
          for (int i = 0; i < 4; i++) {
            for (int j = 0; j < 4; j++) {
              vec2 o = (vec2(float(i), float(j)) - 1.5) * 0.25 * cell;
              vec3 c = texture2D(tDiffuse, vUv + o).rgb;
              sum += log2(dot(c, vec3(0.2126, 0.7152, 0.0722)) + 0.0002);
            }
          }
          gl_FragColor = vec4(clamp((sum / 16.0 + 12.0) / 16.0, 0.0, 1.0), 0.0, 0.0, 1.0);
        }`,
    });
    this.quad = new FullScreenQuad(this.material);
  }

  render(renderer, writeBuffer, readBuffer) {
    this.material.uniforms.tDiffuse.value = readBuffer.texture;
    renderer.setRenderTarget(this.target);
    this.quad.render(renderer);
  }

  dispose() {
    this.target.dispose();
    this.material.dispose();
    this.quad.dispose();
  }
}

// Run a pass at a fraction of the composer's size. Both passes wrapped this way
// finish by drawing their result over the full-size frame, so the rest of the
// chain never knows.
function scaled(pass, scale) {
  const setSize = pass.setSize.bind(pass);
  pass.setSize = (w, h) => setSize(Math.max(1, Math.round(w * scale)), Math.max(1, Math.round(h * scale)));
  return pass;
}

// A second look at the same scene from another camera, drawn on top of the first with the depth
// buffer cleared: what the camera's layers show (layer 1: the inside of a cockpit and the aircraft's
// own body) is drawn with its own near and far planes, so a cockpit a metre from the eye sits in
// front of a world kilometres deep however the world's depth is spent. The scene's background is
// left out for the pass, or it would paint over the first one. Off until a view asks for it.
class OverlayPass extends Pass {
  constructor(scene, camera) {
    super();
    this.scene = scene;
    this.camera = camera;
    this.needsSwap = false;
    this.enabled = false;
  }

  render(renderer, writeBuffer, readBuffer) {
    const bg = this.scene.background;
    const auto = renderer.autoClear;
    this.scene.background = null;
    renderer.autoClear = false;
    renderer.setRenderTarget(this.renderToScreen ? null : readBuffer);
    renderer.clearDepth();
    renderer.render(this.scene, this.camera);
    renderer.autoClear = auto;
    this.scene.background = bg;
  }
}

export class PostFX {
  constructor(renderer, scene, camera, overlayCamera = null) {
    this.renderer = renderer;
    const size = renderer.getSize(new THREE.Vector2());
    const pr = renderer.getPixelRatio();
    const w = Math.max(1, size.x), h = Math.max(1, size.y);

    // HDR, so the bloom can tell a lamp from a white wall, and multisampled.
    const target = new THREE.WebGLRenderTarget(w * pr, h * pr, {
      type: THREE.HalfFloatType,
      samples: GRAPHICS.msaa,
    });
    this.composer = new EffectComposer(renderer, target);

    this.composer.addPass(new RenderPass(scene, camera));
    this.overlay = overlayCamera ? new OverlayPass(scene, overlayCamera) : null;
    if (this.overlay) this.composer.addPass(this.overlay);

    this.ao = null;
    if (GRAPHICS.ao) {
      this.ao = scaled(new GTAOPass(scene, camera, w * pr, h * pr), GRAPHICS.aoScale);
      this.ao.updateGtaoMaterial({
        radius: GRAPHICS.aoRadius,
        thickness: GRAPHICS.aoThickness,
        distanceExponent: 1,
        scale: 1,
        samples: GRAPHICS.aoSamples,
      });
      this.ao.updatePdMaterial({ samples: GRAPHICS.aoDenoiseSamples });
      this.ao.blendIntensity = GRAPHICS.aoIntensity;
      this.composer.addPass(this.ao);
    }

    this.bloom = scaled(new UnrealBloomPass(new THREE.Vector2(w, h),
      GRAPHICS.bloomStrength, GRAPHICS.bloomRadius, GRAPHICS.bloomThreshold), GRAPHICS.bloomScale);
    this.composer.addPass(this.bloom);

    // Metered after the bloom, so glare counts toward how bright it feels.
    this.meter = new MeterPass();
    this.composer.addPass(this.meter);

    this.finish = new FinishPass(renderer);
    this.composer.addPass(this.finish);

    this._reading = new Uint8Array(METER_W * METER_H * 4);
    this._pending = false;
    this._frame = 0;
    this._resetAdaptation();
    this.setSize(w, h, pr);
  }

  // A night circuit wants its lamps to bloom hard; a desert at noon wants
  // almost none, or every sunlit face flares. So the track says.
  setTrack(data) {
    const post = data.post || {};
    this.bloom.strength = post.bloom ?? GRAPHICS.bloomStrength;
    this.bloom.radius = post.bloomRadius ?? GRAPHICS.bloomRadius;
    this.bloom.threshold = post.bloomThreshold ?? GRAPHICS.bloomThreshold;
    if (this.ao) this.ao.blendIntensity = post.ao ?? GRAPHICS.aoIntensity;
    this._resetAdaptation();
  }

  _resetAdaptation() {
    // Log2 luminance, measured, reacting, and what counts as normal here.
    this._adapt = { measured: null, fast: null, normal: null, warm: 0 };
    this.exposureFactor = 1;
  }

  // Eye adaptation. The exposure dips when the frame is brighter than this
  // track normally is -- a tunnel's lit walls a metre from the camera, a lamp
  // overhead, your own headlights off a wall -- and comes back when it is not.
  // It never goes ABOVE the track's own exposure: a night circuit is dark on
  // purpose, and an exposure that brightened it to grey would undo that.
  //
  // It darkens quickly and recovers more slowly, as eyes do. Called once per
  // rendered frame; the measurement it works from arrives a few frames late,
  // which for something meant to feel like an eye is no loss.
  adapt(dt) {
    const a = this._adapt;
    if (a.measured !== null && GRAPHICS.adaptStrength > 0 && dt > 0) {
      if (a.fast === null) { a.fast = a.measured; a.normal = a.measured; }
      const rising = a.measured > a.fast;
      const tau = rising ? GRAPHICS.adaptTime : GRAPHICS.adaptTime * 2.5;
      a.fast += (a.measured - a.fast) * (1 - Math.exp(-dt / tau));
      // For the first moments on a track, "normal" follows the frame closely
      // rather than locking onto whatever the first reading happened to be.
      // Locked onto a dark first frame, everything after it counted as bright
      // and a daylight track sat at four fifths of its exposure for seconds.
      a.warm += dt;
      const normalTau = a.warm < 1.5 ? 0.3 : GRAPHICS.adaptNormal;
      a.normal += (a.measured - a.normal) * (1 - Math.exp(-dt / normalTau));
      const over = Math.max(0, a.fast - a.normal);   // stops brighter than normal
      this.exposureFactor = Math.max(GRAPHICS.adaptMin, Math.pow(2, -GRAPHICS.adaptStrength * over));
    } else {
      this.exposureFactor = 1;
    }
    if (WORLD.toneMappingExposure > 0) {
      this.renderer.toneMappingExposure = WORLD.toneMappingExposure * this.exposureFactor;
    }
  }

  // Read the meter back without waiting for it. The GPU finishes the frame in
  // its own time and the reading lands a frame or two later.
  _readMeter() {
    if (this._pending || ++this._frame % 4) return;
    this._pending = true;
    this.renderer.readRenderTargetPixelsAsync(this.meter.target, 0, 0, METER_W, METER_H, this._reading)
      .then((px) => {
        let sum = 0;
        for (let i = 0; i < METER_W * METER_H; i++) sum += px[i * 4];
        this._adapt.measured = (sum / (METER_W * METER_H)) / 255 * 16 - 12;
      })
      .catch(() => {})
      .finally(() => { this._pending = false; });
    // The readback goes through a pixel-pack buffer. Leave it bound and any
    // ordinary pixel read afterwards fails silently.
    const gl = this.renderer.getContext();
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
  }

  setSize(w, h, pixelRatio) {
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(w, h);
  }

  render(dt) {
    this.composer.render(dt);
    this._readMeter();
  }

  // The composer frees only its own two targets; the occlusion and bloom
  // passes own theirs, and a graphics level change throws this whole chain
  // away, so they are freed here or they leak.
  dispose() {
    this.composer.dispose();
    if (this.ao) this.ao.dispose();
    this.bloom.dispose();
    this.meter.dispose();
    this.finish.dispose();
  }
}
