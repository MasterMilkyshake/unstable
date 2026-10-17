// Animated ocean surface that follows the camera, plus a matching CPU-side wave
// function for swimming/boats. Lakes and meres (the sink zones) lie still and, on high
// quality, mirror the world: near one, a camera reflected in the water plane renders the
// big silhouettes (terrain, sky, monuments, the Arches) at reduced size every other frame,
// and the still water mixes that in by fresnel. The open sea keeps its swell and sky sheen.
import * as THREE from 'three';
import { G } from '../core/globals.js';
import { ISLANDS } from '../data/world.js';

// Still water: every sink zone is a lake, a pool or a mere, and the fen's open water lies
// still too (its meres are cut into the ground, not zones): no sea swell rolls through a marsh.
const FEN_CALM = [{ x: -660, z: -330, r: 175 }, { x: -800, z: -470, r: 110 }];
const POOLS = [...ISLANDS.flatMap((i) => i.zones || []).filter((z) => z.sink && z.x < 3000), ...FEN_CALM].slice(0, 8);
const POOL_GLSL = /* glsl */ `
  uniform vec4 uPools[8];
  float stillness(vec2 p) {
    float w = 0.0;
    for (int i = 0; i < 8; i++) {
      vec4 c = uPools[i];
      if (c.z <= 0.0) break;
      vec2 d = p - c.xy;
      float ang = atan(d.y, d.x);
      // Match terrain sink warping: ellipse + angular wobble so still water follows a ragged shore.
      float wob = 0.16 * sin(ang * 3.0 + c.x * 0.02) + 0.10 * sin(ang * 5.0 - c.y * 0.03) + 0.08 * sin(ang * 2.0 + c.z);
      float e = length(vec2(d.x / 1.18, d.y * 1.18));
      float r = c.z * (1.0 + wob);
      w = max(w, 1.0 - smoothstep(r * 0.68, r * 1.05, e));
    }
    return w;
  }`;

const WAVES = [
  { dx: 0.958, dz: 0.287, f: 0.08, s: 1.1, a: 0.22 },
  { dx: -0.371, dz: 0.928, f: 0.11, s: 1.4, a: 0.15 },
  { dx: 0.707, dz: -0.707, f: 0.18, s: 1.9, a: 0.08 },
  { dx: -0.8, dz: -0.6, f: 0.27, s: 2.4, a: 0.04 },
  // two small off-axis swells so the sun's glint never settles into a diamond lattice
  { dx: 0.276, dz: -0.961, f: 0.143, s: 1.6, a: 0.05 },
  { dx: -0.951, dz: 0.309, f: 0.211, s: 2.1, a: 0.03 },
];

// How high the sea runs: 1 in fair weather, more in a squall (world/weather.js sets it). The
// shader's uSwell follows it, so a boat rides the same sea that is drawn.
export const SEA = { swell: 1 };

export function waveHeight(x, z, t) {
  let h = 0;
  for (const w of WAVES) h += w.a * Math.sin((w.dx * x + w.dz * z) * w.f + t * w.s);
  return h * SEA.swell;
}

const glslWaves = WAVES.map(
  (w) => `{ float ph = (${w.dx.toFixed(3)} * p.x + ${w.dz.toFixed(3)} * p.y) * ${w.f.toFixed(3)} + uTime * ${w.s.toFixed(3)};
     h += ${w.a.toFixed(3)} * sin(ph);
     g += ${w.a.toFixed(3)} * ${w.f.toFixed(3)} * cos(ph) * vec2(${w.dx.toFixed(3)}, ${w.dz.toFixed(3)}); }`
).join('\n');

export class Water {
  constructor(scene) {
    const size = 1600;
    const segs = 160;
    this.cell = size / segs;
    const geo = new THREE.PlaneGeometry(size, size, segs, segs);
    geo.rotateX(-Math.PI / 2);
    this.uniforms = THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 },
        uSwell: { value: 1 },
        uSunDir: { value: new THREE.Vector3(0.3, 0.8, 0.2).normalize() },
        uSunColor: { value: new THREE.Color('#fff4dc') },
        uDeep: { value: new THREE.Color('#0d3a52') },
        uShallow: { value: new THREE.Color('#1f7a8c') },
        uSky: { value: new THREE.Color('#bfe0f4') },
        uLight: { value: 1 },
        uRefl: { value: null },
        uReflMat: { value: new THREE.Matrix4() },
        uReflOn: { value: 0 },
        uPools: { value: Array.from({ length: 8 }, (_, i) => (POOLS[i] ? new THREE.Vector4(POOLS[i].x, POOLS[i].z, POOLS[i].r, 0) : new THREE.Vector4())) },
        uShore: { value: null },
        uShoreBox: { value: new THREE.Vector4(0, 0, 0, 0) },
        uCenter: { value: new THREE.Vector2() },
        uR: { value: size / 2 - this.cell },
      },
    ]);
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      fog: true,
      vertexShader: /* glsl */ `
        uniform float uTime;
        uniform float uSwell;
        uniform mat4 uReflMat;
        uniform vec2 uCenter;
        uniform float uR;
        varying vec3 vWorld;
        varying vec3 vN;
        varying vec4 vRefl;
        varying float vStill;
        ${POOL_GLSL}
        #include <fog_pars_vertex>
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vec2 p = wp.xz;
          float h = 0.0;
          vec2 g = vec2(0.0);
          ${glslWaves}
          h *= uSwell;
          g *= uSwell;
          // lakes lie nearly still, and the swell dies out before the fine mesh ends, so it
          // meets the flat far skirt without a seam
          vStill = stillness(p);
          float calm = (1.0 - 0.8 * vStill) * (1.0 - smoothstep(uR * 0.55, uR * 0.97, length(p - uCenter)));
          h *= calm;
          g *= calm;
          wp.y += h;
          vWorld = wp.xyz;
          vRefl = uReflMat * vec4(wp.xyz, 1.0);
          vN = normalize(vec3(-g.x, 1.0, -g.y));
          vec4 mvPosition = viewMatrix * wp;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        uniform vec3 uDeep;
        uniform vec3 uShallow;
        uniform vec3 uSky;
        uniform float uTime;
        uniform float uLight;
        uniform sampler2D uRefl;
        uniform float uReflOn;
        uniform sampler2D uShore;
        uniform vec4 uShoreBox;
        uniform vec2 uCenter;
        uniform float uR;
        float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
        float vnoise(vec2 p) {
          vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
        }
        varying vec3 vWorld;
        varying vec3 vN;
        varying vec4 vRefl;
        varying float vStill;
        #include <fog_pars_fragment>
        void main() {
          vec2 q = vWorld.xz;
          // the fine mesh is a disc and the far skirt a ring that starts where it ends: no
          // square corner and no doubled transparency where the two used to overlap
          float rr = length(q - uCenter);
          #ifdef SKIRT
            if (rr < uR) discard;
          #else
            if (rr > uR) discard;
          #endif
          // ripples are finer than a pixel far out and alias into a checkerboard: fade them
          float dist = length(cameraPosition - vWorld);
          float near = 1.0 - smoothstep(60.0, 260.0, dist);
          // ripples from drifting noise, not crossed sines: sines along the axes print a
          // diamond lattice into the sun's glint
          vec2 r1 = q * 0.55 + vec2(uTime * 0.31, uTime * 0.17), r2 = q * 1.45 - vec2(uTime * 0.23, -uTime * 0.37);
          float a1 = vnoise(r1), a2 = vnoise(r2);
          vec2 rg = vec2(vnoise(r1 + vec2(0.2, 0.0)) - a1, vnoise(r1 + vec2(0.0, 0.2)) - a1) * 0.35
                  + vec2(vnoise(r2 + vec2(0.2, 0.0)) - a2, vnoise(r2 + vec2(0.0, 0.2)) - a2) * 0.2;
          vec3 n = normalize(vN + near * (1.0 - 0.7 * vStill) * vec3(rg.x, 0.0, rg.y));
          vec3 v = (cameraPosition - vWorld) / max(dist, 1e-4);
          float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
          vec3 col = mix(uDeep, uShallow, clamp(0.3 + (vWorld.y + 0.3) * 0.8, 0.0, 1.0));
          col *= uLight;
          vec3 sea = mix(col, uSky, fres * 0.55);
          if (uReflOn > 0.5 && vStill > 0.001) {
            // the mirrored world, rippled by the surface normal
            vec2 ruv = vRefl.xy / max(vRefl.w, 1e-3) + n.xz * 0.04;
            vec3 refl = texture2D(uRefl, clamp(ruv, vec2(0.002), vec2(0.998))).rgb;
            // a stray NaN or overflow in the mirror would bloom into a black slab: drop it
            if (any(isnan(refl)) || any(isinf(refl))) refl = sea;
            refl = min(refl, vec3(6.0));
            col = mix(sea, mix(col, refl, clamp(0.2 + fres * 0.75, 0.0, 0.9)), vStill);
          } else {
            col = sea;
          }
          vec3 hv = normalize(uSunDir + v);
          float spec = pow(max(dot(n, hv), 0.0), mix(40.0, 140.0, near)) * mix(0.6, 1.8, near);
          col += uSunColor * spec;
          // crests where the swells meet; a slow cross-wave breaks up their diamond grid
          float breakup = 0.5 + 0.5 * sin(q.x * 0.137 - q.y * 0.091 + uTime * 0.6) * sin(q.y * 0.173 + q.x * 0.059 - uTime * 0.4);
          float crest = smoothstep(0.34, 0.47, vWorld.y) * breakup * (1.0 - smoothstep(80.0, 220.0, dist));
          col = mix(col, vec3(0.92, 0.96, 1.0) * max(uLight, 0.3), crest * 0.35);
          // Shallows and surf, from the shore map (the ground under the water, baked once):
          // the water clears and warms over sand, foam rims every shore and rolls in in bands.
          float alpha = 0.82 + fres * 0.15;
          vec2 suv = (q - uShoreBox.xy) * uShoreBox.zw;
          if (uShoreBox.z > 0.0 && suv.x > 0.0 && suv.y > 0.0 && suv.x < 1.0 && suv.y < 1.0) {
            float ground = texture2D(uShore, suv).r * 12.0 - 8.0;
            float depth = max(0.0, vWorld.y - ground);
            float shallow = 1.0 - smoothstep(0.0, 3.5, depth);
            col = mix(col, mix(uShallow * 1.35, vec3(0.62, 0.66, 0.52), 0.25) * max(uLight, 0.3), shallow * 0.45 * (1.0 - 0.6 * vStill));
            alpha = mix(alpha, 0.62, shallow * 0.7);
            float broken = vnoise(q * 0.35 + vec2(uTime * 0.05, -uTime * 0.03)) * 0.6 + vnoise(q * 1.3 - uTime * 0.2) * 0.4;
            float edge = 1.0 - smoothstep(0.02, 0.45, depth);
            float bands = smoothstep(0.62, 0.96, sin(depth * 4.2 - uTime * 1.7 + broken * 3.0)) * (1.0 - smoothstep(0.25, 1.7, depth));
            float foam = clamp(edge * (0.55 + 0.45 * broken) + bands * smoothstep(0.35, 0.7, broken), 0.0, 1.0) * (1.0 - 0.85 * vStill) * (1.0 - smoothstep(150.0, 420.0, dist));
            col = mix(col, vec3(0.9, 0.94, 0.95) * max(uLight, 0.32), foam * 0.85);
            alpha = max(alpha, foam);
          }
          gl_FragColor = vec4(col, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    // A coarse skirt carries the same sea out to the horizon: the fine mesh ends 800 m out,
    // and past it the long vistas showed the sky dome's lower band as a hard line.
    const skirtMat = mat.clone();
    skirtMat.uniforms = this.uniforms;
    skirtMat.defines = { SKIRT: 1 };
    const skirt = new THREE.Mesh(new THREE.RingGeometry(size / 2 - this.cell - 1, 4200, 96, 3).rotateX(-Math.PI / 2), skirtMat);
    skirt.frustumCulled = false;
    skirt.renderOrder = 1;
    this.mesh.add(skirt);
    scene.add(this.mesh);
  }

  update(t, camera, sunDir, sunColor, skyColor, light) {
    this.uniforms.uTime.value = t;
    this.uniforms.uSwell.value = SEA.swell;
    this._reflect(camera);
    if (sunDir) this.uniforms.uSunDir.value.copy(sunDir);
    if (sunColor) this.uniforms.uSunColor.value.copy(sunColor);
    if (skyColor) this.uniforms.uSky.value.copy(skyColor);
    this.uniforms.uLight.value = light;
    const c = this.cell;
    this.mesh.position.x = Math.round(camera.position.x / c) * c;
    this.mesh.position.z = Math.round(camera.position.z / c) * c;
    this.uniforms.uCenter.value.set(this.mesh.position.x, this.mesh.position.z);
    if (!this.uniforms.uShore.value) this._bakeShore();
  }

  // The ground under the sea around every surface isle, a few metres a texel: what the
  // shallows, the wet margin and the surf read their depth from.
  _bakeShore() {
    const terrain = G.world?.terrain;
    if (!terrain) return;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const i of terrain.islands) {
      if (i.cx > 3000) continue;
      x0 = Math.min(x0, i.x0); z0 = Math.min(z0, i.z0);
      x1 = Math.max(x1, i.x0 + i.sizeX); z1 = Math.max(z1, i.z0 + i.sizeZ);
    }
    if (!(x1 > x0)) return;
    const W = 1024, H = 800, data = new Uint8Array(W * H);
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < W; i++) {
        const h = terrain.heightAt(x0 + (i + 0.5) / W * (x1 - x0), z0 + (j + 0.5) / H * (z1 - z0));
        data[j * W + i] = Math.round(Math.max(0, Math.min(1, (h + 8) / 12)) * 255);
      }
    }
    const tex = new THREE.DataTexture(data, W, H, THREE.RedFormat, THREE.UnsignedByteType);
    tex.magFilter = tex.minFilter = THREE.LinearFilter;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    this.uniforms.uShore.value = tex;
    this.uniforms.uShoreBox.value.set(x0, z0, 1 / (x1 - x0), 1 / (z1 - z0));
  }

  // Render the world as seen from the camera mirrored in the sea plane (y = 0) into a small
  // target, clipped to what stands above the water. Shadows are reused from the main pass.
  _reflect(camera) {
    const r = G.renderer, scene = G.scene;
    const p = camera.position;
    const nearPool = POOLS.some((z) => Math.hypot(p.x - z.x, p.z - z.z) < z.r + REFL_RANGE);
    const on = !!(r && scene && G.world && this.mesh.visible && nearPool && G.settings?.quality === 'high' && p.y > 0.3 && G.settings?.reflections !== false);
    this.uniforms.uReflOn.value = on ? 1 : 0;
    if (!on) return;
    if (!this.rt) {
      this.rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: true });
      this.rt.texture.generateMipmaps = false;
      this.mirror = new THREE.PerspectiveCamera();
      this.mirror.layers.set(REFLECT_LAYER);
      this.uniforms.uRefl.value = this.rt.texture;
      markReflective(G.world, scene);
      this.reflScene = reflectionScene(scene);
      this.frame = 0;
    }
    // every other frame; the texture keeps the matrix it was rendered with
    if (this.frame++ % 2) return;
    r.getDrawingBufferSize(_size);
    const w = Math.max(64, Math.round(_size.x * REFL_SCALE)), h = Math.max(64, Math.round(_size.y * REFL_SCALE));
    if (this.rt.width !== w || this.rt.height !== h) this.rt.setSize(w, h);

    // mirror the eye and its gaze in the plane
    const m = this.mirror;
    camera.updateMatrixWorld();
    _eye.setFromMatrixPosition(camera.matrixWorld);
    _rot.extractRotation(camera.matrixWorld);
    _look.set(0, 0, -1).applyMatrix4(_rot).add(_eye);
    m.position.set(_eye.x, -_eye.y, _eye.z);
    m.up.set(0, 1, 0).applyMatrix4(_rot);
    m.up.y = -m.up.y;
    m.lookAt(_look.x, -_look.y, _look.z);
    m.near = camera.near;
    m.far = camera.far;
    m.updateMatrixWorld();
    m.projectionMatrix.copy(camera.projectionMatrix);
    this.uniforms.uReflMat.value.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1)
      .multiply(m.projectionMatrix).multiply(m.matrixWorldInverse);

    // oblique near plane on the water surface, so nothing below it reaches the mirror
    _plane.set(_up, -0.05).applyMatrix4(m.matrixWorldInverse);
    _clip.set(_plane.normal.x, _plane.normal.y, _plane.normal.z, _plane.constant);
    const e = m.projectionMatrix.elements;
    _q.set((Math.sign(_clip.x) + e[8]) / e[0], (Math.sign(_clip.y) + e[9]) / e[5], -1, (1 + e[10]) / e[14]);
    _clip.multiplyScalar(2 / _clip.dot(_q));
    e[2] = _clip.x;
    e[6] = _clip.y;
    e[10] = _clip.z + 1;
    e[14] = _clip.w;

    const target = r.getRenderTarget();
    const shadows = r.shadowMap.autoUpdate;
    this.mesh.visible = false;
    r.shadowMap.autoUpdate = false;
    r.setRenderTarget(this.rt);
    r.clear();
    r.render(this.reflScene, m);
    r.setRenderTarget(target);
    r.shadowMap.autoUpdate = shadows;
    this.mesh.visible = true;
  }
}

const REFL_SCALE = 0.3;
const REFL_RANGE = 400; // metres from a still water's edge
export const REFLECT_LAYER = 1;

// Only what reads in a reflection at a third of the screen's size: the ground, the sky, the
// monuments, the Arches and the merged town and cliff masonry, plus the lights that show it.
function markReflective(world, scene) {
  const roots = [world.sky?.dome, ...(world.terrain?.islands || []).map((i) => i.mesh), ...(world.monuments || []).map((m) => m.root), ...(world.greatBridge?.chunks || []).map((c) => c.root)];
  for (const o of scene.children) if (o.name === 'merged_static' || o.name === 'cliffs' || o.name.startsWith('monument')) roots.push(o);
  for (const root of roots) root?.traverse((o) => o.layers.enable(REFLECT_LAYER));
  scene.traverse((o) => {
    if (o.isLight) o.layers.enable(REFLECT_LAYER);
  });
}

// The mirror draws only what is on the reflection layer, but rendering the whole scene walks all
// of its thousands of objects to find them. This scene lists just the scene's top-level objects
// that hold something reflective, its lights and their targets, in the scene's own order (so the
// lights reach the shaders in the same order): the same things are drawn, with a far shorter walk.
// It only borrows them; they stay children of the scene.
function reflectionScene(scene) {
  const keep = new Set();
  const top = (o) => {
    while (o.parent && o.parent !== scene) o = o.parent;
    return o;
  };
  scene.traverse((o) => {
    if (o === scene) return;
    if (o.isLight || o.layers.isEnabled(REFLECT_LAYER)) keep.add(top(o));
    if (o.isLight && o.target) keep.add(top(o.target));
  });
  const mirror = new THREE.Scene();
  Object.defineProperty(mirror, 'fog', { get: () => scene.fog });
  mirror.children = scene.children.filter((c) => keep.has(c));
  return mirror;
}
const _size = new THREE.Vector2();
const _eye = new THREE.Vector3();
const _look = new THREE.Vector3();
const _rot = new THREE.Matrix4();
const _up = new THREE.Vector3(0, 1, 0);
const _plane = new THREE.Plane();
const _clip = new THREE.Vector4();
const _q = new THREE.Vector4();
