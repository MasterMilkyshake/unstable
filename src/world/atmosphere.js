// Dramatic sky overlay, height / valley fog, drifting motes, god rays and
// biome color grading. Wraps the existing Sky so data/world.js and sky.js
// stay untouched for the parallel Wash / map work.
import * as THREE from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { clamp, lerp, smoothstep } from '../core/util.js';
import { BIOME_GRADE, TIME_GRADE, VALLEY_FOG } from '../data/vistas.js';
import { setAtmosphere } from './fog.js';

const _c = new THREE.Color();
const _c2 = new THREE.Color();
const _c3 = new THREE.Color();
const _v3 = new THREE.Vector3();
const _v2 = new THREE.Vector2();

// Weather owns snow and ash; elsewhere fireflies only come out where there is vegetation.
const NO_MOTES = new Set(['snow', 'tundra', 'volcanic', 'ashfield']);
const GREEN = new Set(['forest', 'emberwood', 'jungle', 'marsh', 'meadow', 'farmland']);
const NEUTRAL = { lift: [0, 0, 0], gain: [1, 1, 1], sat: 1, contrast: 1, temp: 0 };

const SKY_FRAG = /* glsl */ `
  uniform vec3 uTop; uniform vec3 uHor; uniform vec3 uBottom;
  uniform vec3 uSunDir; uniform vec3 uSunCol; uniform float uStars; uniform float uRift; uniform float uTime; uniform vec3 uRiftCol;
  uniform float uGod; uniform float uStorm; uniform float uDusk; uniform vec3 uFog; uniform float uCover;
  uniform vec4 uScatter; uniform vec3 uScatterCol;
  varying vec3 vDir;
  float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float n2(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    float a = hash(vec3(i, 1.7));
    float b = hash(vec3(i + vec2(1.0, 0.0), 1.7));
    float c = hash(vec3(i + vec2(0.0, 1.0), 1.7));
    float d = hash(vec3(i + vec2(1.0, 1.0), 1.7));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0; float a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * n2(p); p = p * 2.03 + 13.1; a *= 0.5; }
    return v;
  }
  void main() {
    vec3 d = normalize(vDir);
    float y = d.y;
    vec3 sunN = normalize(uSunDir);
    // With the sun low the horizon is warm only on its side; away from it the sky falls to
    // the haze colour, which is also what distant land fogs toward.
    float sunSide = dot(normalize(d.xz + vec2(1e-4)), normalize(sunN.xz + vec2(1e-4))) * 0.5 + 0.5;
    float lowSun = (1.0 - smoothstep(0.12, 0.6, sunN.y)) * (1.0 - uRift);
    vec3 hor = mix(uHor, mix(uFog, uHor, sunSide * sunSide), lowSun);
    // Below the horizon the dome is only ever seen past the end of the sea, so it is exactly
    // what the fogged sea fades to (fog.js: haze plus the sun's in-scatter): from altitude
    // the ocean runs out into haze, never into a band of another colour.
    vec3 under = uBottom + uScatterCol * pow(max(dot(d, uScatter.xyz), 0.0), 12.0) * uScatter.w;
    vec3 col = y > 0.0 ? mix(hor, uTop, pow(clamp(y, 0.0, 1.0), 0.55)) : mix(hor, under, smoothstep(0.0, 0.02, -y));

    // horizon haze — purple dusk / warm sunset bloom (surface only)
    float hz = exp(-max(y, 0.0) * 6.0);
    col += hor * hz * 0.12 * (1.0 - uRift);
    col += vec3(0.30, 0.12, 0.40) * uDusk * hz * 0.4;
    col += vec3(0.45, 0.16, 0.06) * uStorm * hz * 0.22 * sunSide;

    float sd = max(dot(d, sunN), 0.0);
    float sunH = smoothstep(-0.12, 0.28, sunN.y);
    float duskRay = mix(1.35, 0.25, clamp(sunN.y * 2.2, 0.0, 1.0));
    // A small, hot disc (bloom adds the corona) and a broad glow only when the sun is low.
    col += uSunCol * (pow(sd, 1400.0) * 3.2 + pow(sd, 36.0) * 0.12 * duskRay + pow(sd, 6.0) * 0.1 * max(duskRay - 0.25, 0.0)) * (1.0 - uRift);

    // God-ray streaks in the dome: only with the sun low enough to throw shafts through
    // haze, gone by mid-morning, and faint.
    float rayGate = uGod * (1.0 - smoothstep(0.05, 0.28, sunN.y)) * smoothstep(-0.1, 0.0, sunN.y);
    if (rayGate > 0.01 && uRift < 0.8) {
      float rays = 0.0;
      float ang = atan(d.z, d.x);
      for (int i = 0; i < 5; i++) {
        float fi = float(i);
        vec3 stepD = normalize(d + sunN * (0.04 + fi * 0.05));
        rays += pow(max(dot(stepD, sunN), 0.0), 18.0 + fi * 8.0);
      }
      float streak = pow(abs(sin(ang * 14.0 + fbm(d.xz * 3.0) * 4.0 - uTime * 0.08)), 6.0);
      float band = smoothstep(0.55, 0.05, abs(y - sunN.y * 0.35));
      col += uSunCol * rays * 0.03 * rayGate * duskRay;
      col += uSunCol * streak * band * pow(sd, 6.0) * 0.06 * rayGate * duskRay;
    }

    // Cloud deck: broken cumulus on a plane overhead (projected from the view ray, so there
    // is no seam where an angle wraps), thinning into stratus banks at the horizon, plus
    // high cirrus. Self-shadow comes from a second sample toward the sun: lit rims on the
    // sun side, dark undersides away from it, warm at golden hour, violet at dusk.
    if (y > -0.02 && uRift < 0.7) {
      float hy = max(y, 0.0);
      vec2 wind = vec2(uTime * 0.0045, uTime * 0.0016);
      vec2 p = d.xz / (hy + 0.12) * 0.55 + wind;
      vec2 warp = vec2(fbm(p * 0.7 + 3.1), fbm(p * 0.7 - 5.7)) - 0.5;
      vec2 q = p + warp * 0.9;
      float cover = mix(0.47, 0.3, uCover);
      float dens = smoothstep(cover, cover + 0.16, fbm(q));
      vec2 toSun = normalize(sunN.xz + vec2(1e-4)) * 0.22;
      float ahead = smoothstep(cover, cover + 0.16, fbm(q + toSun));
      float lit = clamp(0.55 + (dens - ahead) * 1.6, 0.0, 1.0);
      // stratus: long low banks hugging the horizon
      float bank = smoothstep(0.42, 0.7, fbm(vec2(p.x * 0.18, p.y * 0.9) + 11.0)) * (1.0 - smoothstep(0.03, 0.2, hy));
      // cirrus: broken wisps high in the dome. Only mildly stretched along the wind: long
      // streaks projected onto the dome fan out from the horizon like shafts of light.
      vec2 cq = q * 0.9 + vec2(13.0, -4.0);
      float wisp = fbm(vec2(cq.x * 0.8 + cq.y * 0.9, cq.y * 0.55 - cq.x * 0.2) * 1.4);
      float cir = smoothstep(0.6, 0.86, wisp) * smoothstep(0.42, 0.68, fbm(cq * 2.3 + 3.0))
        * smoothstep(0.12, 0.4, hy) * (1.0 - smoothstep(0.7, 0.95, hy)) * 0.24;
      float golden = clamp(uDusk + uStorm * 0.9, 0.0, 1.0);
      vec3 litCol = mix(vec3(1.0, 0.99, 0.96) + uSunCol * 0.08, uSunCol * 1.15 + vec3(0.12, 0.04, 0.0), golden);
      vec3 shadeCol = mix(hor * 0.78 + uTop * 0.12, mix(vec3(0.3, 0.22, 0.38), uTop * 0.9, 0.35), golden);
      litCol = mix(litCol, uTop * 1.6 + vec3(0.03, 0.035, 0.05), uStars);
      shadeCol = mix(shadeCol, uTop * 0.75, uStars);
      vec3 cloud = mix(shadeCol, litCol, lit) + uSunCol * pow(sd, 8.0) * dens * 0.35 * (1.0 - uStars);
      float a = clamp(dens * smoothstep(0.0, 0.08, hy) + bank * 0.75, 0.0, 1.0) * 0.82;
      // distant cloud sinks into the haze rather than ending in a hard aliasing band
      cloud = mix(cloud, hor, exp(-hy * 9.0) * 0.6);
      col = mix(col, cloud, a * (1.0 - uRift));
      col = mix(col, litCol, cir * (1.0 - a) * (1.0 - uRift));
    }

    // moon
    float md = max(dot(d, -sunN), 0.0);
    col += vec3(0.85, 0.9, 1.0) * pow(md, 1600.0) * 3.0 * uStars * (1.0 - uRift);

    if (uStars > 0.0 && y > 0.0) {
      vec3 cell = floor(d * 700.0);
      float h = hash(cell);
      float tw = 0.55 + 0.45 * sin(uTime * 3.0 + h * 50.0);
      col += vec3(0.9, 0.95, 1.0) * step(0.9992, h) * tw * uStars * smoothstep(0.0, 0.3, y) * 1.4;
      // milky band
      float milky = smoothstep(0.18, 0.0, abs(d.x * 0.35 + d.z * 0.25 - 0.05)) * smoothstep(0.02, 0.35, y);
      col += vec3(0.55, 0.62, 0.9) * milky * uStars * 0.12 * (0.6 + 0.4 * fbm(d.xz * 8.0));
    }

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

export const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uLift: { value: new THREE.Vector3() },
    uGain: { value: new THREE.Vector3(1, 1, 1) },
    uSat: { value: 1 },
    uContrast: { value: 1 },
    uVignette: { value: 0.22 },
    uTemp: { value: 0 },
    uTint: { value: new THREE.Color(1, 1, 1) },
    uTintAmt: { value: 0.12 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec3 uLift; uniform vec3 uGain; uniform vec3 uTint;
    uniform float uSat; uniform float uContrast; uniform float uVignette; uniform float uTemp; uniform float uTintAmt;
    varying vec2 vUv;
    void main() {
      vec4 tex = texture2D(tDiffuse, vUv);
      vec3 col = tex.rgb;
      col = col * uGain + uLift;
      col = (col - 0.5) * uContrast + 0.5;
      col.r += uTemp * 0.08;
      col.b -= uTemp * 0.07;
      float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(luma), col, uSat);
      col = mix(col, col * uTint, uTintAmt);
      float d = distance(vUv, vec2(0.5));
      col *= 1.0 - uVignette * smoothstep(0.35, 0.95, d);
      gl_FragColor = vec4(col, tex.a);
    }`,
};

export const GodRayShader = {
  uniforms: {
    tDiffuse: { value: null },
    uSunPos: { value: new THREE.Vector2(0.5, 0.7) },
    uStrength: { value: 0 },
    uDecay: { value: 0.94 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uSunPos;
    uniform float uStrength;
    uniform float uDecay;
    varying vec2 vUv;
    void main() {
      vec4 base = texture2D(tDiffuse, vUv);
      if (uStrength < 0.01) { gl_FragColor = base; return; }
      vec2 dir = uSunPos - vUv;
      float dist = length(dir);
      dir /= max(dist, 1e-4);
      vec3 acc = vec3(0.0);
      vec2 uv = vUv;
      float illum = 1.0;
      const int N = 12;
      for (int i = 0; i < N; i++) {
        uv += dir * 0.018;
        vec3 s = texture2D(tDiffuse, uv).rgb;
        float b = max(max(s.r, s.g), s.b);
        acc += s * step(0.78, b) * illum;
        illum *= uDecay;
      }
      float fall = exp(-dist * 2.4);
      gl_FragColor = vec4(base.rgb + acc * (uStrength * 0.045) * fall, base.a);
    }`,
};

// Runs first after the scene render, ahead of bloom. One NaN or infinite pixel (a degenerate
// normal, an overflow) is harmless on its own, but bloom's blur spreads it into a black tile
// across the screen; and an unbounded HDR value blooms into a white disc. Bad pixels take
// the mean of their finite neighbours, everything is held to a sane HDR ceiling.
export const SanitizeShader = {
  uniforms: { tDiffuse: { value: null }, uTexel: { value: new THREE.Vector2(1 / 1280, 1 / 720) }, uCeil: { value: 24 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform vec2 uTexel; uniform float uCeil;
    varying vec2 vUv;
    bool bad(vec4 c) { return any(isnan(c)) || any(isinf(c)); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      if (bad(c)) {
        vec4 sum = vec4(0.0); float n = 0.0;
        vec4 s0 = texture2D(tDiffuse, vUv + vec2(uTexel.x, 0.0)); if (!bad(s0)) { sum += s0; n += 1.0; }
        vec4 s1 = texture2D(tDiffuse, vUv - vec2(uTexel.x, 0.0)); if (!bad(s1)) { sum += s1; n += 1.0; }
        vec4 s2 = texture2D(tDiffuse, vUv + vec2(0.0, uTexel.y)); if (!bad(s2)) { sum += s2; n += 1.0; }
        vec4 s3 = texture2D(tDiffuse, vUv - vec2(0.0, uTexel.y)); if (!bad(s3)) { sum += s3; n += 1.0; }
        c = n > 0.0 ? sum / n : vec4(0.0, 0.0, 0.0, 1.0);
      }
      gl_FragColor = vec4(clamp(c.rgb, 0.0, uCeil), clamp(c.a, 0.0, 1.0));
    }`,
};

function timeBand(t) {
  if (t < 0.22 || t > 0.84) return 'night';
  if (t < 0.32) return 'dawn';
  if (t < 0.68) return 'day';
  if (t < 0.77) return 'sunset';
  return 'dusk';
}

function mixGrade(a, b, t) {
  const o = {};
  for (const k of ['sat', 'contrast', 'temp']) o[k] = lerp(a[k] ?? 1, b[k] ?? 1, t);
  o.lift = [0, 1, 2].map((i) => lerp((a.lift || [0, 0, 0])[i], (b.lift || [0, 0, 0])[i], t));
  o.gain = [0, 1, 2].map((i) => lerp((a.gain || [1, 1, 1])[i], (b.gain || [1, 1, 1])[i], t));
  o.tint = a.tint || '#ffffff';
  o.tintB = b.tint || a.tint || '#ffffff';
  o.tintT = t;
  return o;
}

export class Atmosphere {
  constructor(world) {
    this.world = world;
    this.scene = world.scene;
    this.sky = world.sky;
    this.quality = 'high';
    this.viewDistance = 1;
    this.gradePass = null;
    this.rayPass = null;
    this.low = false;
    this._patchSky();
    this._buildValleyFog();
    this._buildParticles();
  }

  _patchSky() {
    const sky = this.sky;
    const mat = sky.dome.material;
    mat.uniforms.uGod = { value: 1 };
    mat.uniforms.uStorm = { value: 0 };
    mat.uniforms.uDusk = { value: 0 };
    mat.uniforms.uFog = { value: new THREE.Color('#bcc4bc') };
    mat.uniforms.uCover = { value: 0 };
    mat.uniforms.uScatter = { value: new THREE.Vector4(0, 1, 0, 0) };
    mat.uniforms.uScatterCol = { value: new THREE.Color(0, 0, 0) };
    mat.fragmentShader = SKY_FRAG;
    mat.needsUpdate = true;
    sky.dome.geometry.dispose();
    sky.dome.geometry = new THREE.SphereGeometry(2800, 40, 20);
    const orig = sky.update.bind(sky);
    sky.update = (dt, center, camera, inRift) => {
      orig(dt, center, camera, inRift);
      this._afterSky(dt, center, camera, inRift);
    };
  }

  _afterSky(dt, center, camera, inRift) {
    const sky = this.sky;
    const t = sky.time;
    const r = sky.riftBlend;
    // The Rift is a separate agent's surface. Do not retint, re-fog, or
    // overlay god-rays / dusk punches once we are blending into it.
    const leaveRift = inRift || r > 0.35;
    const dusk = smoothstep(0.755, 0.79, t) * (1 - smoothstep(0.84, 0.9, t));
    const sunset = smoothstep(0.68, 0.72, t) * (1 - smoothstep(0.765, 0.8, t));
    sky.uniforms.uDusk.value = leaveRift ? 0 : dusk;
    sky.uniforms.uStorm.value = leaveRift ? 0 : (sunset * 0.65 + dusk * 0.4);
    // no shafts through falling snow or the Hush's fog wall
    const veiled = this._biome === 'snow' || this._biome === 'tundra' || this._biome === 'hush';
    sky.uniforms.uGod.value = leaveRift || veiled ? 0 : (this.low ? 0.25 : lerp(0.35, 1.15, sunset + dusk * 0.6));
    if (leaveRift) return;
    if (sunset + dusk > 0.2 && !sky.isNight()) sky.uniforms.uStars.value *= 0.12;

    // punchier dusk / sunset palettes on top of the stock keys
    const hor = sky.uniforms.uHor.value;
    const top = sky.uniforms.uTop.value;
    const fog = sky.scene.fog.color;
    if (dusk > 0.01) {
      hor.lerp(_c.set('#4a1e6a'), dusk * 0.35);
      top.lerp(_c.set('#1a1038'), dusk * 0.3);
      fog.lerp(_c.set('#3a2460'), dusk * 0.35);
    }
    if (sunset > 0.01) {
      // Only the sun's side burns; the haze away from it stays cool.
      hor.lerp(_c.set('#ff7a34'), sunset * 0.25);
      top.lerp(_c.set('#2a3068'), sunset * 0.2);
      sky.uniforms.uSunCol.value.lerp(_c.set('#ffb060'), sunset * 0.25);
    }
    if (sky.isNight()) fog.lerp(_c.set('#8aa0d8'), 0.2);

    // Clear midday: keep zenith saturated; do not let fog tint wash the whole dome grey.
    const wx = sky.weather || {};
    const clearDay = wx.dark < 0.08 && wx.fog < 0.12 && dusk + sunset < 0.05 && !sky.isNight();
    // storms close the cloud deck in; clear weather leaves it broken
    sky.uniforms.uCover.value = clamp((wx.dark || 0) * 1.4, 0, 1);
    if (clearDay) {
      top.lerp(_c.set('#2a528c'), 0.28);
      hor.lerp(_c.set('#a8b894'), 0.2);
      fog.lerp(_c.set('#7a8a78'), 0.18);
      sky.uniforms.uSunCol.value.lerp(_c.set('#ffe2b0'), 0.1);
    }

    // Stretch Sky's distances for the long vistas rather than replacing them: Sky's values
    // already carry weather and regional mist, and the densest mists (the Hush's wall of
    // grey) keep their own distance instead of being thinned out.
    const open = smoothstep(0.4, 0.8, sky.mist ? sky.mist.density : 1);
    const far = sky.scene.fog.far * lerp(1, clearDay ? 2 : 1.6, open) * (this.low ? 0.8 : 1);
    const near = sky.scene.fog.near * lerp(1, clearDay ? 0.75 : 1, open);
    sky.scene.fog.near = near;
    sky.scene.fog.far = far;
    this._fogFar = far;
    this._fogNear = near;
    sky.uniforms.uFog.value.copy(fog);
    sky.uniforms.uBottom.value.copy(fog);
  }

  _buildValleyFog() {
    // Flat mist discs used to sit at a fixed height and slice characters in half (and catch
    // shadows on their top face). Local haze is now a soft boost to analytic height fog
    // (fog.js) when the camera is near a valley — no hard plane, no shadow deck.
    this.valleyMat = null;
    this.valley = new THREE.Group();
    this.valley.name = 'valleyFog';
    this.valleyCenters = VALLEY_FOG.slice();
    this.scene.add(this.valley);
  }

  _buildParticles() {
    // Small, sparse motes that follow the player: pollen and dust by day, fireflies at
    // night. Snow, ash and embers belong to world/weather.js, so none of them here.
    const n = 420;
    const pos = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 140;
      pos[i * 3 + 1] = Math.random() * 18;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 140;
      seed[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    this.pMat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color('#fff4d0') },
        uSize: { value: 1 },
        uTime: { value: 0 },
        uAlpha: { value: 0 },
        uBlink: { value: 0 },
      },
      vertexShader: /* glsl */ `
        attribute float aSeed;
        uniform float uSize; uniform float uTime; uniform float uBlink;
        varying float vA;
        void main() {
          vec3 p = position;
          p.x += sin(uTime * (0.15 + aSeed * 0.3) + aSeed * 20.0) * 3.0;
          p.y += sin(uTime * (0.3 + aSeed * 0.2) + aSeed * 12.0) * 1.2;
          p.z += cos(uTime * (0.12 + aSeed * 0.3) + aSeed * 9.0) * 3.0;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float z = max(0.5, -mv.z);
          gl_PointSize = clamp(uSize * 60.0 / z, 0.0, 4.0);
          gl_Position = projectionMatrix * mv;
          float pulse = pow(max(0.0, sin(uTime * (1.2 + aSeed * 1.6) + aSeed * 40.0)), 3.0);
          // nothing lives close enough to the lens to bloom into a disc
          vA = (0.4 + 0.6 * aSeed) * mix(1.0, pulse, uBlink) * smoothstep(6.0, 12.0, z) * (1.0 - smoothstep(55.0, 75.0, z));
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; uniform float uAlpha;
        varying float vA;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c);
          if (d > 0.5) discard;
          float a = smoothstep(0.5, 0.1, d) * uAlpha * vA;
          if (a < 0.01) discard;
          gl_FragColor = vec4(uColor, a);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    });
    this.points = new THREE.Points(geo, this.pMat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 7;
    this.scene.add(this.points);
  }

  attachComposer(composer, bloom) {
    this.composer = composer;
    this.bloom = bloom;
    this.sanePass = new ShaderPass(SanitizeShader);
    composer.insertPass(this.sanePass, Math.max(0, composer.passes.indexOf(bloom)));
    const setSize = this.sanePass.setSize.bind(this.sanePass);
    this.sanePass.setSize = (w, h) => { setSize(w, h); this.sanePass.uniforms.uTexel.value.set(1 / Math.max(1, w), 1 / Math.max(1, h)); };
    this.sanePass.setSize(composer._width * composer._pixelRatio, composer._height * composer._pixelRatio);
    this.rayPass = new ShaderPass(GodRayShader);
    this.gradePass = new ShaderPass(GradeShader);
    // Both run after OutputPass, on tone-mapped sRGB: the grade's contrast pivot and lift
    // are display-space numbers, and on linear HDR they crush shadows to navy and clip
    // warm biomes to crimson.
    composer.addPass(this.rayPass);
    composer.addPass(this.gradePass);
    return this;
  }

  setQuality(quality, viewDistance) {
    this.quality = quality;
    this.low = quality === 'low';
    this.viewDistance = viewDistance ?? this.viewDistance;
    if (this.sky) this.sky.viewDistance = this.viewDistance;
    this.points.visible = !this.low;
    this.valley.visible = !this.low;
    if (this.bloom) this.bloom.enabled = !this.low;
    if (this.rayPass) this.rayPass.enabled = !this.low;
    if (this.gradePass) this.gradePass.enabled = true;
  }

  update(dt, camera, inRift, center) {
    const sky = this.sky;
    const r = sky.riftBlend;
    const leaveRift = inRift || r > 0.35;
    const band = timeBand(sky.time);
    const night = sky.isNight();
    const sunN = sky.sunDir;

    if (!leaveRift) {
      // Sea-level haze that thins with altitude; thickest and warmest with the sun low, so
      // the far isles stack up as paler layers and the peaks stand out of it.
      const sy = sunN.y;
      const golden = smoothstep(-0.12, 0.04, sy) * (1 - smoothstep(0.1, 0.4, sy));
      const dayAmt = smoothstep(-0.06, 0.22, sy);
      const mist = sky.mist && sky.mist.amt > 0 ? sky.mist.amt : 0;
      // Harbor / mere pools: thicken and lower the height fog when standing in a valley,
      // instead of drawing a hard mist plane through people's legs.
      let valley = 0;
      let valleyY = 1.2;
      const eye = center || camera.position;
      if (eye && !this.low) {
        for (const v of this.valleyCenters || []) {
          if (v.rift) continue;
          const d = Math.hypot(eye.x - v.x, eye.z - v.z) / Math.max(v.r, 1);
          if (d >= 1.2) continue;
          const w = (1 - d / 1.2) ** 1.15;
          if (w > valley) {
            valley = w;
            valleyY = v.y ?? 1.2;
          }
        }
      }
      const weatherFog = sky.weather.fog || 0;
      setAtmosphere({
        base: lerp(0, Math.max(0.2, valleyY - 0.8), valley),
        falloff: lerp(lerp(0.034, 0.026, golden), 0.07, valley),
        // Clear by day so the far isles keep their value steps; the haze thickens at golden hour.
        density: (lerp(0.0018, 0.0017, dayAmt) + golden * 0.0012 + mist * 0.002)
          * (1 + weatherFog * 1.5) * (1 + valley * 1.6),
        opacity: lerp(0.9, 0.95, valley),
        sunDir: sy > -0.08 ? sunN : _v3.copy(sunN).negate(),
        sunColor: _c3.copy(sky.uniforms.uSunCol.value).multiplyScalar(lerp(0.3, 1, dayAmt)),
        scatter: 0.12 + golden * 0.6,
      });
      const sc = sky.uniforms.uScatter?.value;
      if (sc) {
        const dir = sy > -0.08 ? sunN : _v3.copy(sunN).negate();
        sc.set(dir.x, dir.y, dir.z, 0.12 + golden * 0.6);
        sky.uniforms.uScatterCol.value.copy(_c3);
      }
    }

    if (this.valley) this.valley.visible = false;

    // Motes follow the local biome; weather already owns snow and volcanic ash.
    this._biomeT = (this._biomeT || 0) - dt;
    if (this._biomeT <= 0 && center) {
      this._biomeT = 0.5;
      this._biome = this.world.biomeAt ? this.world.biomeAt(center.x, center.z) : null;
    }
    const biome = this._biome;
    const showPoints = !leaveRift && !this.low && !!biome && !NO_MOTES.has(biome);
    if (this.points) this.points.visible = showPoints;
    if (showPoints) {
      const origin = center || camera.position;
      const u = this.pMat.uniforms;
      this.points.position.set(origin.x, origin.y - 3, origin.z);
      u.uTime.value += dt;
      if (night || band === 'dusk') {
        // fireflies: they pulse, so only a few are lit at once
        u.uColor.value.set('#c4dc7e');
        u.uAlpha.value = GREEN.has(biome) ? 0.7 : 0.25;
        u.uSize.value = 1.1;
        u.uBlink.value = 1;
      } else if (band === 'sunset' || band === 'dawn') {
        u.uColor.value.set('#ffd49a');
        u.uAlpha.value = 0.3;
        u.uSize.value = 0.85;
        u.uBlink.value = 0;
      } else {
        u.uColor.value.set('#fff6dc');
        u.uAlpha.value = 0.2;
        u.uSize.value = 0.75;
        u.uBlink.value = 0;
      }
      u.uAlpha.value *= 1 - clamp(sky.weather.dark * 1.5, 0, 1);
    }

    this._updateGrade(camera, leaveRift, center, band, dt);
    this._updateRays(camera, sunN, leaveRift, band);
  }

  _updateGrade(camera, leaveRift, center, band, dt = 1 / 60) {
    if (!this.gradePass) return;
    const u = this.gradePass.uniforms;
    // Target grade for this spot and hour, eased so crossing a biome edge never pops.
    let g = NEUTRAL;
    let tint = '#ffffff';
    let tintAmt = 0;
    let vignette = 0;
    if (!leaveRift) {
      const bg = BIOME_GRADE[this._biome] || BIOME_GRADE.sea;
      g = mixGrade(bg, TIME_GRADE[band] || TIME_GRADE.day, 0.5);
      tint = bg.tint || '#ffffff';
      tintAmt = 0.06;
      vignette = 0.18;
    }
    const k = Math.min(1, dt * 1.5);
    u.uLift.value.lerp(_v3.fromArray(g.lift), k);
    u.uGain.value.lerp(_v3.fromArray(g.gain), k);
    u.uSat.value = lerp(u.uSat.value, g.sat, k);
    u.uContrast.value = lerp(u.uContrast.value, g.contrast, k);
    u.uTemp.value = lerp(u.uTemp.value, g.temp, k);
    u.uTint.value.lerp(_c.set(tint), k);
    u.uTintAmt.value = lerp(u.uTintAmt.value, tintAmt, k);
    u.uVignette.value = lerp(u.uVignette.value, vignette, k);
  }

  _updateRays(camera, sunN, inRift, band) {
    if (!this.rayPass) return;
    if (this.low || inRift || sunN.y < -0.02) {
      this.rayPass.uniforms.uStrength.value = 0;
      return;
    }
    _v3.copy(sunN).multiplyScalar(800).add(camera.position);
    _v3.project(camera);
    _v2.set(_v3.x * 0.5 + 0.5, _v3.y * 0.5 + 0.5);
    const on = _v3.z < 1 && _v2.x > -0.2 && _v2.x < 1.2 && _v2.y > -0.2 && _v2.y < 1.2;
    // Shafts belong to a low sun; at midday the pass only smears the bright sky into a halo.
    const duskAmt = band === 'sunset' || band === 'dusk' ? 1 : band === 'dawn' ? 0.7 : 0;
    this.rayPass.uniforms.uSunPos.value.copy(_v2);
    this.rayPass.uniforms.uStrength.value = on ? duskAmt * (this.low ? 0 : 1) : 0;
  }
}
