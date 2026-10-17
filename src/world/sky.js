// Sky dome, sun/moon lighting, fog and the day-night cycle.
import * as THREE from 'three';
import { lerp, smoothstep, clamp } from '../core/util.js';

// `hor` is the horizon on the sun's side; `fog` is the haze and the horizon away from it
// (fog.js adds the sun's in-scatter on top, so a far isle fades into the sky behind it).
// Warm key, cool sky fill: shadows always carry the zenith's blue.
// Night is moonlit, not black: a deep blue zenith over a paler horizon, and the moon (the key,
// opposite the sun) cool and bright enough to read the land by at eye height.
const KEYS = [
  { t: 0.0, top: '#081430', hor: '#26375e', fog: '#1d2b4b', sun: 0.0, hemi: 0.62, sunCol: '#93aaf0' },
  { t: 0.2, top: '#0d1a3c', hor: '#33416a', fog: '#24304f', sun: 0.0, hemi: 0.62, sunCol: '#9ab0ff' },
  { t: 0.25, top: '#2c4c8c', hor: '#f4a468', fog: '#8e8aa2', sun: 1.1, hemi: 0.5, sunCol: '#ffb070' },
  // Daylight: a deep zenith over a cool, clear horizon, and a warm key strong enough to
  // throw real shadows; the hemisphere fill stays low so shade keeps its depth.
  { t: 0.32, top: '#2d5fa8', hor: '#bccacb', fog: '#8c9ea6', sun: 2.3, hemi: 0.66, sunCol: '#ffd6a2' },
  { t: 0.5, top: '#2858a4', hor: '#a9bdcb', fog: '#899eac', sun: 2.45, hemi: 0.62, sunCol: '#ffe2b8' },
  { t: 0.68, top: '#2c5a9c', hor: '#c6c5ae', fog: '#90999a', sun: 2.35, hemi: 0.64, sunCol: '#ffd09a' },
  { t: 0.75, top: '#2c3c7a', hor: '#ff9c50', fog: '#8a7a94', sun: 1.25, hemi: 0.5, sunCol: '#ff9a4a' },
  { t: 0.8, top: '#121c42', hor: '#4e3a62', fog: '#2a2a4a', sun: 0.0, hemi: 0.58, sunCol: '#9ab0ff' },
  { t: 1.0, top: '#081430', hor: '#26375e', fog: '#1d2b4b', sun: 0.0, hemi: 0.62, sunCol: '#93aaf0' },
];

// The Rift is lit from the sea overhead: a cool key from above, violet haze, and nothing
// warm except what people lit (windows, lanterns), which is what makes those read.
// The fog sits just under the horizon's value so far ruins fade into it rather than going black.
const RIFT = { top: new THREE.Color('#101634'), hor: new THREE.Color('#36285e'), fog: new THREE.Color('#4c3a74'), sun: 2.0, hemi: 1.05, sunCol: new THREE.Color('#c9c6e0') };
const _depthCol = new THREE.Color();

const _a = new THREE.Color();
const _b = new THREE.Color();
const _moon = new THREE.Color('#a9bbff');
const _fillDir = new THREE.Vector3();

function sampleKeys(t) {
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1].t < t) i++;
  const k0 = KEYS[i];
  const k1 = KEYS[i + 1];
  const f = clamp((t - k0.t) / (k1.t - k0.t), 0, 1);
  const s = f * f * (3 - 2 * f);
  return {
    top: _a.set(k0.top).clone().lerp(_b.set(k1.top), s),
    hor: _a.set(k0.hor).clone().lerp(_b.set(k1.hor), s),
    fog: _a.set(k0.fog).clone().lerp(_b.set(k1.fog), s),
    sun: lerp(k0.sun, k1.sun, s),
    hemi: lerp(k0.hemi, k1.hemi, s),
    sunCol: _a.set(k0.sunCol).clone().lerp(_b.set(k1.sunCol), s),
  };
}

export class Sky {
  constructor(scene, renderer) {
    this.scene = scene;
    this.uniforms = {
      uTop: { value: new THREE.Color('#3a78d4') },
      uHor: { value: new THREE.Color('#cfe7f7') },
      uBottom: { value: new THREE.Color('#0d3a52') },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunCol: { value: new THREE.Color('#fff8ec') },
      uStars: { value: 0 },
      uRift: { value: 0 },
      uRiftCol: { value: new THREE.Color(0.35, 0.15, 0.6) },
      uTime: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          vec4 p = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * p;
          gl_Position.z = gl_Position.w * 0.99999;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uTop; uniform vec3 uHor; uniform vec3 uBottom;
        uniform vec3 uSunDir; uniform vec3 uSunCol; uniform float uStars; uniform float uRift; uniform float uTime; uniform vec3 uRiftCol;
        varying vec3 vDir;
        float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        void main() {
          vec3 d = normalize(vDir);
          float y = d.y;
          vec3 col = y > 0.0 ? mix(uHor, uTop, pow(clamp(y, 0.0, 1.0), 0.55)) : mix(uHor, uBottom, clamp(-y * 3.0, 0.0, 1.0));
          float sd = max(dot(d, normalize(uSunDir)), 0.0);
          col += uSunCol * (pow(sd, 1400.0) * 3.2 + pow(sd, 36.0) * 0.06) * (1.0 - uRift);
          // moon opposite the sun
          float md = max(dot(d, -normalize(uSunDir)), 0.0);
          col += vec3(0.85, 0.9, 1.0) * pow(md, 1600.0) * 3.0 * uStars * (1.0 - uRift);
          if (uStars > 0.0 && y > 0.0) {
            vec3 cell = floor(d * 700.0);
            float h = hash(cell);
            float tw = 0.55 + 0.45 * sin(uTime * 3.0 + h * 50.0);
            col += vec3(0.9, 0.95, 1.0) * step(0.9992, h) * tw * uStars * smoothstep(0.0, 0.3, y) * 1.4;
          }
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16), mat);
    this.dome.frustumCulled = false;
    this.dome.renderOrder = -10;
    scene.add(this.dome);

    this.sun = new THREE.DirectionalLight('#fff8ec', 2.5);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 1; sc.far = 400;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.6;
    scene.add(this.sun);
    scene.add(this.sun.target);

    this.hemi = new THREE.HemisphereLight('#cfe7ff', '#5a5040', 1.0);
    scene.add(this.hemi);
    // Shadowless counter-light from the sky opposite the key: gives walls in shade a lit
    // edge and their form. In the Rift it is the sea glow pooling at the far rim.
    this.fill = new THREE.DirectionalLight('#8aa4d8', 0.3);
    this.fill.castShadow = false;
    scene.add(this.fill);
    scene.add(this.fill.target);

    scene.fog = new THREE.Fog('#c3dbeb', 120, 900);
    this.time = 0.3;
    this.dayLength = 900; // seconds for a full day
    this.riftBlend = 0;
    // set by world/weather.js: fog 0..1 pulls the fog in, dark 0..1 dims the light, flash is lightning
    this.weather = { fog: 0, dark: 0, flash: 0 };
    this.viewDistance = 1;
    this.sunDir = new THREE.Vector3();
    this.light = 1;
    this.skyColor = new THREE.Color();
  }

  setShadows(on) {
    this.sun.castShadow = on;
  }

  isNight() {
    return this.time < 0.22 || this.time > 0.79;
  }

  update(dt, center, camera, inRift) {
    this.time = (this.time + dt / this.dayLength) % 1;
    this.riftBlend = clamp(this.riftBlend + (inRift ? dt : -dt) * 2, 0, 1);
    const k = sampleKeys(this.time);
    const r = this.riftBlend;
    this.uniforms.uRiftCol.value.setRGB(0.35, 0.15, 0.6);

    const ang = (this.time - 0.25) * Math.PI * 2;
    const dir = this.sunDir.set(Math.cos(ang), Math.sin(ang), 0.35).normalize();
    const above = dir.y > -0.05;
    const lightDir = above ? dir.clone() : dir.clone().negate();
    if (r > 0.5) lightDir.set(0.38, 0.84, 0.38).normalize();

    const top = k.top.clone().lerp(RIFT.top, r);
    const hor = k.hor.clone().lerp(RIFT.hor, r);
    const fog = k.fog.clone().lerp(RIFT.fog, r);
    this.uniforms.uTop.value.copy(top);
    this.uniforms.uHor.value.copy(hor);
    this.uniforms.uBottom.value.copy(fog).multiplyScalar(0.6);
    this.uniforms.uSunDir.value.copy(dir);
    this.uniforms.uSunCol.value.copy(k.sunCol);
    const night = 1 - smoothstep(-0.25, 0.0, dir.y);
    this.uniforms.uStars.value = Math.max(night, 0) * (1 - r);
    this.uniforms.uRift.value = r;
    this.uniforms.uTime.value += dt;

    const sunI = above ? k.sun : 0.95; // the moon
    const wx = this.weather;
    wx.flash = Math.max(0, wx.flash - dt * 6);
    this.sun.intensity = lerp(sunI, RIFT.sun, r) * (1 - wx.dark * 0.55 * (1 - r)) + wx.flash * 2.5;
    this.sun.color.copy(above ? k.sunCol : _moon).lerp(RIFT.sunCol, r);
    this.hemi.intensity = lerp(k.hemi, RIFT.hemi, r) * (1 - wx.dark * 0.35 * (1 - r)) + wx.flash * 1.5;
    this.hemi.color.copy(top).lerp(hor, 0.35).lerp(_b.set('#ffffff'), 0.3);
    // moonlit sky fill: the night zenith is too dark to light anything by itself
    const nightAmt = 1 - smoothstep(-0.2, 0.05, dir.y);
    if (nightAmt > 0) this.hemi.color.lerp(_b.set('#7088c4'), nightAmt * 0.75);
    // Below, the fill is the sea overhead.
    if (r > 0) this.hemi.color.lerp(_a.set('#9a96b8'), r);
    this.hemi.groundColor.set(r > 0.5 ? '#2a1a3a' : '#4a4436');
    if (r <= 0.5 && nightAmt > 0) this.hemi.groundColor.lerp(_b.set('#28303e'), nightAmt);
    this.light = clamp((this.sun.intensity * 0.35 + this.hemi.intensity * 0.65) / 1.6, 0.18, 1.2);

    // storms grey out the sky and fog
    if (wx.dark > 0 && r < 1) {
      const grey = _depthCol.set('#5a6470').multiplyScalar(this.light);
      fog.lerp(grey, wx.dark * 0.6 * (1 - r));
      this.uniforms.uTop.value.lerp(grey, wx.dark * 0.7 * (1 - r));
      this.uniforms.uHor.value.lerp(grey, wx.dark * 0.6 * (1 - r));
    }
    if (wx.flash > 0) {
      this.uniforms.uTop.value.lerp(_depthCol.set('#e8ecff'), Math.min(1, wx.flash) * 0.5);
      this.uniforms.uHor.value.lerp(_depthCol.set('#e8ecff'), Math.min(1, wx.flash) * 0.4);
    }
    // regional mist (set each frame by game/realm.js): tints the haze and pulls it closer
    const mist = this.mist;
    if (mist && mist.amt > 0 && r < 1) {
      const m = _depthCol.copy(mist.color).multiplyScalar(clamp(this.light * 1.05, 0.12, 1));
      fog.lerp(m, mist.amt * (1 - r));
      this.uniforms.uHor.value.lerp(m, mist.amt * 0.7 * (1 - r));
      this.uniforms.uBottom.value.copy(fog).multiplyScalar(0.6);
    }
    this.scene.fog.color.copy(fog);
    const vd = this.viewDistance;
    const fogK = (1 - wx.fog * 0.75 * (1 - r)) * (mist ? lerp(1, mist.density, 1 - r) : 1);
    this.scene.fog.near = lerp(70 * vd, 12, r) * fogK;
    this.scene.fog.far = lerp(760 * vd, 190, r) * (0.25 + 0.75 * fogK);
    this.skyColor.copy(hor);

    this.sun.position.copy(center).addScaledVector(lightDir, 160);
    this.sun.target.position.copy(center);
    const fd = _fillDir.set(-lightDir.x, 0.35, -lightDir.z);
    if (r > 0.5) fd.set(-0.55, 0.3, -0.6);
    fd.normalize();
    this.fill.position.copy(center).addScaledVector(fd, 100);
    this.fill.target.position.copy(center);
    const dayAmt = smoothstep(-0.05, 0.3, dir.y);
    this.fill.color.copy(top).lerp(_b.set('#ffffff'), 0.35).lerp(_a.set('#8a7ae8'), r);
    this.fill.intensity = lerp(lerp(0.24, 0.3, dayAmt), 0.85, r) * (1 - wx.dark * 0.4 * (1 - r));
    if (r < 0.5 && nightAmt > 0) this.fill.color.lerp(_b.set('#6c84c8'), nightAmt * 0.6);
    this.dome.position.copy(camera.position);
  }
}
