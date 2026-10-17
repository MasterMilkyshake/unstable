// Procedural weapon meshes. Blades extend along the hand's local +Z axis.
import * as THREE from 'three';
import { ENCHANTS } from '../data/weapons.js';

function m(color, o = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    flatShading: true,
    roughness: o.roughness ?? 0.45,
    metalness: o.metalness ?? 0.6,
    emissive: o.emissive || '#000000',
    emissiveIntensity: o.ei ?? 1,
  });
}

function part(geo, material, x, y, z) {
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

export function buildWeaponMesh(def, enchant) {
  const g = new THREE.Group();
  const spec = def.mesh || {};
  const L = spec.length || 1;
  const glow = spec.glow || (enchant && ENCHANTS[enchant] ? ENCHANTS[enchant].color : null);
  const bladeMat = m(spec.blade || '#cccccc', { emissive: glow || '#000000', ei: spec.glow ? 0.9 : glow ? 0.35 : 0 });
  const guardMat = m(spec.guard || '#555555', { metalness: 0.5 });
  const handleMat = m(spec.handle || '#3a2a20', { metalness: 0, roughness: 0.9 });
  const tip = new THREE.Object3D();
  const base = new THREE.Object3D();
  let twoHanded = false;

  switch (spec.kind) {
    case 'dagger': {
      g.add(part(new THREE.CylinderGeometry(0.03, 0.03, 0.16, 6).rotateX(Math.PI / 2), handleMat, 0, 0, -0.02));
      g.add(part(new THREE.BoxGeometry(0.14, 0.04, 0.04), guardMat, 0, 0, 0.07));
      if (spec.wavy) {
        for (let i = 0; i < 4; i++) {
          const seg = part(new THREE.BoxGeometry(0.05, 0.012, L / 4 + 0.02), bladeMat, Math.sin(i * 1.7) * 0.015, 0, 0.09 + (i + 0.5) * (L / 4));
          seg.rotation.y = Math.cos(i * 1.7) * 0.25;
          g.add(seg);
        }
      } else {
        g.add(part(new THREE.BoxGeometry(0.05, 0.012, L), bladeMat, 0, 0, 0.09 + L / 2));
      }
      base.position.set(0, 0, 0.1);
      tip.position.set(0, 0, 0.09 + L);
      break;
    }
    case 'rapier': {
      g.add(part(new THREE.CylinderGeometry(0.028, 0.028, 0.2, 6).rotateX(Math.PI / 2), handleMat, 0, 0, -0.03));
      const cup = part(new THREE.SphereGeometry(0.08, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), guardMat, 0, 0, 0.08);
      cup.rotation.x = Math.PI / 2;
      g.add(cup);
      g.add(part(new THREE.BoxGeometry(0.022, 0.01, L), bladeMat, 0, 0, 0.1 + L / 2));
      base.position.set(0, 0, 0.12);
      tip.position.set(0, 0, 0.1 + L);
      break;
    }
    case 'katana': {
      g.add(part(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 6).rotateX(Math.PI / 2), handleMat, 0, 0, -0.06));
      g.add(part(new THREE.CylinderGeometry(0.07, 0.07, 0.02, 10).rotateX(Math.PI / 2), guardMat, 0, 0, 0.1));
      const n = 4;
      let z = 0.11;
      let y = 0;
      for (let i = 0; i < n; i++) {
        const segL = L / n;
        const a = 0.04 * (i + 1);
        const seg = part(new THREE.BoxGeometry(0.012, 0.045, segL + 0.01), bladeMat, 0, y + Math.sin(a) * segL * 0.5, z + segL / 2);
        seg.rotation.x = -a;
        g.add(seg);
        z += Math.cos(a) * segL;
        y += Math.sin(a) * segL;
      }
      base.position.set(0, 0, 0.13);
      tip.position.set(0, y, z);
      break;
    }
    case 'greatsword': {
      twoHanded = true;
      g.add(part(new THREE.CylinderGeometry(0.035, 0.035, 0.45, 6).rotateX(Math.PI / 2), handleMat, 0, 0, -0.08));
      g.add(part(new THREE.BoxGeometry(0.4, 0.07, 0.07), guardMat, 0, 0, 0.16));
      g.add(part(new THREE.BoxGeometry(0.15, 0.025, L), bladeMat, 0, 0, 0.2 + L / 2));
      const pt = part(new THREE.ConeGeometry(0.075, 0.2, 4).rotateX(Math.PI / 2), bladeMat, 0, 0, 0.2 + L + 0.09);
      pt.scale.set(1, 0.33, 1);
      g.add(pt);
      base.position.set(0, 0, 0.22);
      tip.position.set(0, 0, 0.25 + L);
      break;
    }
    case 'greataxe': {
      twoHanded = true;
      g.add(part(new THREE.CylinderGeometry(0.035, 0.04, L, 6).rotateX(Math.PI / 2), handleMat, 0, 0, L / 2 - 0.35));
      g.add(part(new THREE.BoxGeometry(0.4, 0.03, 0.45), bladeMat, 0.22, 0, L - 0.5));
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.035, 0.62), bladeMat);
      edge.position.set(0.43, 0, L - 0.5);
      g.add(edge);
      g.add(part(new THREE.BoxGeometry(0.08, 0.08, 0.14), guardMat, 0, 0, L - 0.5));
      base.position.set(0.1, 0, L - 0.6);
      tip.position.set(0.46, 0, L - 0.5);
      break;
    }
    case 'hammer': {
      twoHanded = true;
      g.add(part(new THREE.CylinderGeometry(0.035, 0.04, L, 6).rotateX(Math.PI / 2), handleMat, 0, 0, L / 2 - 0.35));
      g.add(part(new THREE.BoxGeometry(0.28, 0.28, 0.5), bladeMat, 0, 0, L - 0.4));
      g.add(part(new THREE.BoxGeometry(0.32, 0.32, 0.06), guardMat, 0, 0, L - 0.62));
      g.add(part(new THREE.BoxGeometry(0.32, 0.32, 0.06), guardMat, 0, 0, L - 0.18));
      base.position.set(0, 0, L - 0.6);
      tip.position.set(0, 0, L - 0.15);
      break;
    }
    case 'spear': {
      twoHanded = true;
      g.add(part(new THREE.CylinderGeometry(0.03, 0.03, L, 6).rotateX(Math.PI / 2), handleMat, 0, 0, L / 2 - 0.6));
      const head = part(new THREE.ConeGeometry(0.07, 0.38, 4).rotateX(Math.PI / 2), bladeMat, 0, 0, L - 0.6 + 0.18);
      head.scale.set(1, 0.35, 1);
      g.add(head);
      g.add(part(new THREE.CylinderGeometry(0.045, 0.045, 0.06, 6).rotateX(Math.PI / 2), guardMat, 0, 0, L - 0.62));
      base.position.set(0, 0, L - 0.9);
      tip.position.set(0, 0, L - 0.6 + 0.37);
      break;
    }
    case 'scythe': {
      twoHanded = true;
      g.add(part(new THREE.CylinderGeometry(0.03, 0.035, L, 6).rotateX(Math.PI / 2), handleMat, 0, 0, L / 2 - 0.4));
      g.add(part(new THREE.BoxGeometry(0.08, 0.08, 0.12), guardMat, 0, 0, L - 0.42));
      // curved blade: segments sweeping out to +x and back toward the grip
      let px = 0.04;
      let pz = L - 0.4;
      for (let i = 0; i < 6; i++) {
        const a = 0.15 + i * 0.22;
        const seg = 0.2;
        const nx = px + Math.cos(a) * seg;
        const nz = pz - Math.sin(a) * seg * 0.55;
        const s2 = part(new THREE.BoxGeometry(seg + 0.02, 0.018, 0.07 - i * 0.008), bladeMat, (px + nx) / 2, 0, (pz + nz) / 2);
        s2.rotation.y = Math.atan2(-(nz - pz), nx - px);
        g.add(s2);
        px = nx;
        pz = nz;
      }
      base.position.set(0.05, 0, L - 0.42);
      tip.position.set(px, 0, pz);
      break;
    }
    case 'club': {
      g.add(part(new THREE.CylinderGeometry(0.03, 0.035, 0.3, 6).rotateX(Math.PI / 2), handleMat, 0, 0, -0.02));
      // enchant glow lives only on the spikes so a glowing head doesn't bloom into a lamp
      const headMat = m(spec.blade || '#7a7a7a', { metalness: 0.5, roughness: 0.5 });
      g.add(part(new THREE.CylinderGeometry(0.05, 0.04, L, 7).rotateX(Math.PI / 2), handleMat, 0, 0, L / 2 + 0.1));
      g.add(part(new THREE.CylinderGeometry(0.11, 0.09, 0.26, 8).rotateX(Math.PI / 2), headMat, 0, 0, L + 0.02));
      if (spec.spikes) {
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          const sp = part(new THREE.ConeGeometry(0.03, 0.12, 4), glow ? bladeMat : guardMat, Math.cos(a) * 0.12, Math.sin(a) * 0.12, L + 0.02);
          sp.rotation.z = a - Math.PI / 2;
          g.add(sp);
        }
      }
      base.position.set(0, 0, 0.3);
      tip.position.set(0, 0, L + 0.12);
      break;
    }
    case 'lance': {
      twoHanded = true;
      g.add(part(new THREE.CylinderGeometry(0.035, 0.035, 0.6, 6).rotateX(Math.PI / 2), handleMat, 0, 0, -0.05));
      g.add(part(new THREE.CylinderGeometry(0.16, 0.05, 0.22, 8).rotateX(Math.PI / 2), guardMat, 0, 0, 0.32));
      const cone = part(new THREE.ConeGeometry(0.11, L, 8).rotateX(Math.PI / 2), bladeMat, 0, 0, 0.42 + L / 2);
      g.add(cone);
      base.position.set(0, 0, 0.5);
      tip.position.set(0, 0, 0.42 + L);
      break;
    }
    case 'fist':
      break;
    case 'sword':
    default: {
      g.add(part(new THREE.CylinderGeometry(0.03, 0.03, 0.22, 6).rotateX(Math.PI / 2), handleMat, 0, 0, -0.02));
      g.add(part(new THREE.SphereGeometry(0.04, 6, 4), guardMat, 0, 0, -0.14));
      g.add(part(new THREE.BoxGeometry(0.26, 0.05, 0.05), guardMat, 0, 0, 0.1));
      g.add(part(new THREE.BoxGeometry(0.07, 0.016, L), bladeMat, 0, 0, 0.13 + L / 2));
      const pt = part(new THREE.ConeGeometry(0.035, 0.12, 4).rotateX(Math.PI / 2), bladeMat, 0, 0, 0.13 + L + 0.05);
      pt.scale.set(1, 0.3, 1);
      g.add(pt);
      base.position.set(0, 0, 0.15);
      tip.position.set(0, 0, 0.15 + L);
      break;
    }
  }
  g.add(tip);
  g.add(base);
  return { group: g, tip, base, twoHanded, glow, bladeMat };
}

export function buildGauntlet(def) {
  const color = (def.mesh && def.mesh.color) || '#8a7a6a';
  const glow = def.mesh && def.mesh.glow;
  const mat = m(color, { metalness: def.mesh && def.mesh.color === '#8a7a6a' ? 0 : 0.5, roughness: 0.6 });
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.12, 0.13), mat);
  b.castShadow = true;
  g.add(b);
  if (glow) {
    const knuckle = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, 0.05), m(glow, { emissive: glow, ei: 1.2 }));
    knuckle.position.set(0, 0.0, 0.065);
    g.add(knuckle);
  }
  const wrap = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.12), mat);
  wrap.position.y = 0.09;
  g.add(wrap);
  return g;
}
