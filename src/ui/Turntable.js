// A turntable for an aircraft: a studio scene of its own that renders straight
// into the game's canvas, as the Garage's does for a car, scaled to the size of
// what stands on it. (The Garage's is five metres across and its fog begins at
// sixteen, which would swallow a fighter; this one scales fog, floor, disc and
// camera to the aircraft it is given. The Garage itself is not touched.)
//
// show(root, { span, height }) puts a model on it. The model stands on y = 0 and
// is centred on the turntable's axis. render() turns it and frames it in the open
// space between the settings panel and the card, wherever the layout has put them.

import * as THREE from 'three';
import { flat } from '../render/Materials.js';
import { HANGAR } from '../data/tuning.js';

const BACKDROP = 0x0b141f;

export class Turntable {
  constructor(renderer) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(BACKDROP);
    this.scene.fog = new THREE.Fog(BACKDROP, 60, 200);

    // Lit harder than the world, and from the front: the one place the aircraft
    // is meant to be looked at rather than flown.
    this.scene.add(new THREE.HemisphereLight(0xbcd0e4, 0x1b2634, 0.9));
    const key = new THREE.DirectionalLight(0xfff0dc, 1.15);
    key.position.set(4, 7, 6);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0x8fb4d8, 0.45);
    fill.position.set(-6, 3, -4);
    this.scene.add(fill);

    this.camera = new THREE.PerspectiveCamera(HANGAR.fov, 1, 1, 800);

    // Unit sized and scaled to the aircraft in show().
    this.floor = new THREE.Mesh(new THREE.CircleGeometry(1, 48), flat(0x0e1926));
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.position.y = -0.19;
    this.scene.add(this.floor);
    this.disc = new THREE.Mesh(new THREE.CylinderGeometry(0.94, 1, 0.16, 44), flat(0x1b2836));
    this.disc.position.y = -0.08;
    this.scene.add(this.disc);
    this.ring = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.09, 0.05, 44), flat(0xd8c8a0));
    this.ring.position.y = -0.155;
    this.scene.add(this.ring);

    this.turn = new THREE.Group();
    this.scene.add(this.turn);
    this.model = null;
    this.span = 10;
    this.height = 3;
  }

  show(root, { span, height }) {
    this.clear();
    this.model = root;
    this.turn.add(root);
    this.span = span;
    this.height = height;
    const pad = span * 0.5;
    this.disc.scale.set(pad, 1, pad);
    this.ring.scale.set(pad, 1, pad);
    // The floor runs out past where the fog has swallowed it, so it never ends at
    // a visible edge.
    this.floor.scale.set(span * 14, span * 14, 1);
    this.scene.fog.near = span * 2.4;
    this.scene.fog.far = span * 8;
    this.camera.far = span * 20;
    this.camera.updateProjectionMatrix();
    this.turn.rotation.y = -0.6;
  }

  clear() {
    if (this.model) this.turn.remove(this.model);
    this.model = null;
  }

  render(dt, panelEl, cardEl) {
    this.turn.rotation.y += HANGAR.turnRate * dt;

    // The window, as Scene does it: the renderer can report a window of zero at
    // construction, and a camera with an aspect of zero draws nothing.
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    const aspect = w / h;
    if (this.camera.aspect !== aspect) {
      this.camera.aspect = aspect;
      this.camera.updateProjectionMatrix();
    }

    // Pull back until the aircraft fits the open space both ways. Across the frame
    // what has to fit is the footprint's diagonal, since it turns; up the frame it
    // is the height. The span here is that diagonal.
    const vHalf = Math.tan((this.camera.fov * Math.PI) / 360);
    const left = panelEl.getBoundingClientRect().right;
    const right = cardEl.getBoundingClientRect().left;
    const open = right > left + 100;
    const free = open ? (right - left) / w : 1;
    const offset = open ? ((left + right) * 0.5 - w * 0.5) / (w * 0.5) : 0;
    const room = HANGAR.fitRoom;
    const dist = (Math.max(this.span * 0.56 / (vHalf * aspect * free), (this.height + 1) * 0.62 / vHalf) + 1.1) * room;
    const shift = offset * dist * vHalf * aspect * 0.9;
    const focusY = this.height * 0.4;
    this.camera.position.set(-shift, focusY + dist * 0.2, dist * 0.96);
    this.camera.lookAt(-shift, focusY, 0);

    this.renderer.render(this.scene, this.camera);
  }
}
