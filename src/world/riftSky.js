// Rift sky overlay: inverted horizon, void below, aurora, and a sanity-aware grade.
// Leaves src/world/sky.js alone so surface sky work can land without colliding.
import * as THREE from 'three';
import { G } from '../core/globals.js';
import { clamp, lerp } from '../core/util.js';
import { setAtmosphere } from './fog.js';

const FOG_OK = new THREE.Color('#3b3650');
const FOG_WRONG = new THREE.Color('#2a5a60');
const UP = new THREE.Vector3(0, 1, 0);
const _fog = new THREE.Color();
const SEA = new THREE.Color('#6a7ad0');

// The Rift's air. Distance fog swallows the far castles into layered silhouettes; a height haze
// lies in the low basin so the ruins stand in it and the towers rise out of it. Values are read
// from sky.tune each frame (tweakable from the console as __unstable.world.rift.sky.tune).
export const RIFT_FOG = {
  color: '#3b3650', // a cold slate violet: lamps and daylight read warm against it
  near: 18, far: 380, // riftCeiling clamps far to 260-440 and near to >= 12
  base: 5, falloff: 0.085, density: 0.022, opacity: 0.8, scatter: 0.14, // basin haze, thin by ~30 m up
  exposure: 1.0,
};

export function buildRiftSky(world, low) {
  const uniforms = {
    uTime: { value: 0 },
    uRift: { value: 0 },
    uWrong: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    transparent: true,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * p;
        gl_Position.z = gl_Position.w * 0.9998;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uRift, uWrong;
      varying vec3 vDir;
      float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      void main() {
        if (uRift < 0.01) discard;
        vec3 d = normalize(vDir);
        float y = d.y;
        vec3 voidCol = vec3(0.03, 0.012, 0.07);
        vec3 horCol = mix(vec3(0.42, 0.16, 0.62), vec3(0.95, 0.62, 0.38), uWrong);
        vec3 topCol = mix(vec3(0.10, 0.05, 0.22), vec3(0.18, 0.42, 0.46), uWrong);
        float down = smoothstep(0.08, -0.75, y);
        float up = smoothstep(-0.08, 0.55, y);
        vec3 col = mix(horCol, voidCol, down);
        col = mix(col, topCol, up);
        // inverted sun hanging in the void
        vec3 invSun = normalize(vec3(0.18, -0.9, 0.22));
        float isd = max(dot(d, invSun), 0.0);
        col += mix(vec3(0.95, 0.62, 0.95), vec3(1.0, 0.78, 0.42), uWrong) * pow(isd, 70.0) * (1.1 + uWrong);
        col += vec3(0.55, 0.35, 0.85) * pow(isd, 12.0) * 0.18;
        // the far rim glows where sea-light pools in the haze: broad, never a drawn line
        float seam = exp(-pow((y - 0.06) * 6.0, 2.0));
        col += mix(vec3(0.36, 0.30, 0.70), vec3(0.95, 0.70, 0.42), uWrong) * seam * (0.16 + 0.4 * uWrong);
        // light falling through the sea overhead
        col += vec3(0.20, 0.32, 0.55) * smoothstep(0.2, 0.95, y) * 0.5;
        // aurora / inverted weather
        float ang = atan(d.z, d.x);
        float aur = sin(ang * 4.0 + y * 11.0 - uTime * 0.18);
        float band = smoothstep(0.35, 0.92, aur) * (1.0 - down);
        col += mix(vec3(0.35, 0.55, 1.0), vec3(0.35, 1.0, 0.85), uWrong) * band * (0.10 + 0.32 * uWrong);
        // void motes
        vec3 cell = floor(d * 90.0);
        float h = hash(cell + 3.0);
        col += vec3(0.65, 0.85, 1.0) * step(0.996, h) * (0.35 + 0.65 * uWrong) * uRift;
        // beautiful-wrong channel swap
        col = mix(col, vec3(col.g * 1.15, col.b * 0.9, col.r * 1.2), uWrong * 0.42);
        gl_FragColor = vec4(col * uRift * 0.55, uRift * 0.42);
      }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1400, low ? 20 : 32, low ? 12 : 18), mat);
  dome.frustumCulled = false;
  dome.renderOrder = -9;
  dome.name = 'rift_sky';
  world.scene.add(dome);

  return { dome, uniforms, exposure: 1, tune: { ...RIFT_FOG } };
}

// `air` is the haze of the place the camera is in (rift.js): it stands in for the basin's own
// colour so the castles and the rim each keep theirs.
export function updateRiftSky(sky, dt, camera, inRift, wrong, air = null) {
  const r = sky.uniforms.uRift.value;
  const target = inRift ? 1 : 0;
  sky.uniforms.uRift.value = clamp(r + (target > r ? dt : -dt) * 1.8, 0, 1);
  sky.uniforms.uWrong.value = lerp(sky.uniforms.uWrong.value, inRift ? wrong : 0, 1 - Math.exp(-3 * dt));
  sky.uniforms.uTime.value += dt;
  sky.dome.position.copy(camera.position);
  const on = sky.uniforms.uRift.value > 0.01;
  sky.dome.visible = on && !sky.hideDome;

  const scene = sky.dome.parent;
  const renderer = G.renderer;
  if (!scene || !scene.fog) return;
  if (on) {
    // sky.js resets the fog every frame, so blend by how far into the Rift we are.
    const k = sky.uniforms.uRift.value;
    const T = sky.tune || RIFT_FOG;
    const fog = _fog.copy(air || _fog.set(T.color || FOG_OK)).lerp(FOG_WRONG, wrong);
    scene.fog.color.lerp(fog, k);
    scene.fog.near = lerp(scene.fog.near, lerp(T.near, 10, wrong), k);
    scene.fog.far = lerp(scene.fog.far, lerp(T.far, 170, wrong), k);
    // Ground haze in the basin: ruins stand in it, the Ascent and the citadel rise out of it.
    setAtmosphere({
      base: T.base,
      falloff: T.falloff,
      density: T.density * (1 + wrong * 0.8),
      opacity: T.opacity * k,
      sunDir: UP,
      sunColor: SEA,
      scatter: T.scatter,
    });
    if (renderer) {
      const want = lerp(T.exposure, 1.4, wrong);
      renderer.toneMappingExposure = lerp(renderer.toneMappingExposure, want, 0.15);
    }
  } else if (renderer && Math.abs(renderer.toneMappingExposure - 1) > 0.01) {
    renderer.toneMappingExposure = lerp(renderer.toneMappingExposure, 1, 0.12);
  }
}
