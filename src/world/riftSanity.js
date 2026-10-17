// Sanity visuals layered on the existing hallucination spawns.
// As the mind goes, the Rift grows more beautiful and more wrong: color twist,
// breathing geometry, and phantom silhouettes. Combat and death rules stay put.
import * as THREE from 'three';
import { G } from '../core/globals.js';
function makePhantom() {
  const m = new THREE.MeshStandardMaterial({
    color: '#140c20',
    emissive: '#6a40c8',
    emissiveIntensity: 0.55,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    flatShading: true,
    roughness: 0.88,
  });
  const g = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.85, 0.3), m);
  torso.position.y = 1.2;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.36, 0.32), m);
  head.position.y = 1.82;
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.75, 0.28), m);
  legs.position.y = 0.4;
  g.add(torso, head, legs);
  g.visible = false;
  return { group: g, mat: m, home: new THREE.Vector3(), ph: Math.random() * 10 };
}

export function buildRiftSanity(world, state) {
  const n = state.low ? 0 : 10;
  const phantoms = [];
  for (let i = 0; i < n; i++) {
    const p = makePhantom();
    world.scene.add(p.group);
    phantoms.push(p);
  }
  state.phantoms = phantoms;
  state.wrong = 0;
}

export function updateRiftSanity(world, state, dt, center, inRift) {
  const p = G.player;
  const ch = G.game && G.game.ch;
  let wrong = 0;
  if (inRift && p && ch) {
    const max = Math.max(1, p.maxSanity || 100);
    wrong = 1 - Math.max(0, Math.min(1, ch.sanity / max));
  }
  state.wrong += (wrong - state.wrong) * (1 - Math.exp(-3 * dt));
  const w = state.wrong;
  const t = world.time;

  if (state.floaters) {
    for (const f of state.floaters) {
      const mesh = f.mesh;
      const wk = f.wk ?? 1;
      mesh.position.y = f.base.y + Math.sin(t * 0.18 + f.ph) * (f.amp + w * 2.2 * wk);
      mesh.rotation.y += f.spin * dt * (1 + w * 1.8);
      if (w > 0.25) {
        const dx = Math.sin(t * 0.27 + f.ph) * w * 1.4 * wk;
        const dz = Math.cos(t * 0.23 + f.ph) * w * 1.4 * wk;
        const nearWalk = Math.hypot(f.base.x - 6000, f.base.z - 5830) < 120;
        const k = nearWalk ? 0.35 : 1;
        mesh.position.x = f.base.x + dx * k;
        mesh.position.z = f.base.z + dz * k;
      }
    }
  }

  if (state.landmarkAnim) {
    for (const a of state.landmarkAnim) {
      if (a.cloth) a.cloth.rotation.y = Math.sin(t * 1.4) * (0.18 + w * 0.35);
      if (a.shard) {
        a.shard.rotation.y = t * 0.35;
        a.shard.position.y = 7.4 + Math.sin(t * 0.6) * (0.25 + w * 0.8);
      }
    }
  }

  const sky = world.sky;
  if (sky && sky.hemi && inRift) {
    const hemi = 1.0 + w * 0.35;
    sky.hemi.intensity = Math.max(sky.hemi.intensity, hemi);
  }

  const phantoms = state.phantoms || [];
  const show = inRift && w > 0.35 && p;
  for (let i = 0; i < phantoms.length; i++) {
    const ph = phantoms[i];
    const live = show && w > 0.35 + i * 0.05;
    ph.group.visible = live;
    if (!live) {
      ph.mat.opacity = 0;
      continue;
    }
    if (!ph.home.x || Math.hypot(ph.group.position.x - p.pos.x, ph.group.position.z - p.pos.z) > 28) {
      const a = Math.random() * Math.PI * 2;
      const r = 8 + Math.random() * 16;
      ph.home.set(p.pos.x + Math.cos(a) * r, 0, p.pos.z + Math.sin(a) * r);
      ph.home.y = world.groundAt(ph.home.x, ph.home.z, p.pos.y + 8);
    }
    const sway = Math.sin(t * 0.7 + ph.ph);
    ph.group.position.set(ph.home.x + sway * 0.4, ph.home.y, ph.home.z + Math.cos(t * 0.5 + ph.ph) * 0.3);
    ph.group.rotation.y = Math.atan2(p.pos.x - ph.group.position.x, p.pos.z - ph.group.position.z);
    ph.group.scale.setScalar(1 + w * 0.15 + Math.sin(t * 2 + ph.ph) * 0.04);
    ph.mat.opacity = (w - 0.3) * 0.55 * (0.55 + 0.45 * Math.sin(t * 1.6 + ph.ph));
    ph.mat.emissiveIntensity = 0.4 + w * 1.1;
  }
}
