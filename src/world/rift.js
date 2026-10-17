// Rift orchestrator. Builds the underworld's look, landmarks and sanity layer
// without rewriting sky.js, landmarks.js or data/world.js.
import * as THREE from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { G } from '../core/globals.js';
import { smoothstep } from '../core/util.js';
import { buildRiftCity } from './riftCity.js';
import { buildRiftSky, updateRiftSky } from './riftSky.js';
import { buildRiftVistas } from './riftVistas.js';
import { buildRiftLandmarks } from './riftLandmarks.js';
import { buildRiftSanity, updateRiftSanity } from './riftSanity.js';
import { buildRiftCamps } from './riftCamps.js';
import { buildRiftMysteries, updateRiftMysteries } from './riftMysteries.js';
import { buildRiftSpire, updateRiftSpire } from './riftSpire.js';
import { buildRiftCeiling, updateRiftCeiling } from './riftCeiling.js';
import { buildAscentLifts, updateAscentLifts } from './ascentLifts.js';
import { buildRiftCastles, updateRiftCastles } from './riftCastles.js';
import { buildRiftOmens, updateRiftOmens } from './riftOmens.js';
import { buildRiftRock } from './riftRock.js';
import { buildRiftFloor } from './riftFloor.js';
import { buildRiftKingdom } from './riftKingdom.js';
import '../data/rift.js';
import '../data/riftResearch.js';
import '../data/riftSpire.js';
import '../data/riftSites.js';

// Where a camera is, whatever the player's state: the Rift's basin or the surface.
// The look below follows the camera, so a debug camera (or a frame between transitions) never
// shows the surface sky in the dark.
export const inRiftView = (p) => !!p && p.x > 3000;

// A pass in front of the bloom that drops non-finite pixels and clamps the rest under what a
// half-float target holds, so one bad sample can never be spread into a black tile.
const SanitizeShader = {
  uniforms: { tDiffuse: { value: null }, uTexel: { value: new THREE.Vector2(1 / 1280, 1 / 720) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform vec2 uTexel; varying vec2 vUv;
    bool bad(vec4 c){ return any(isnan(c)) || any(isinf(c)); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      if (bad(c)) {
        vec4 n = texture2D(tDiffuse, vUv + vec2(uTexel.x, 0.0));
        if (bad(n)) n = texture2D(tDiffuse, vUv - vec2(uTexel.x, 0.0));
        if (bad(n)) n = texture2D(tDiffuse, vUv + vec2(0.0, uTexel.y));
        if (bad(n)) n = vec4(0.0, 0.0, 0.0, 1.0);
        c = n;
      }
      gl_FragColor = clamp(c, vec4(0.0), vec4(256.0));
    }`,
};
function guardBloom(composer) {
  if (!composer || composer.passes.some((p) => p.name === 'rift_sanitize')) return;
  const pass = new ShaderPass(SanitizeShader);
  pass.name = 'rift_sanitize';
  const at = composer.passes.findIndex((p) => p.constructor && /Bloom/.test(p.constructor.name));
  composer.insertPass(pass, at > 0 ? at : 1);
  const resize = composer.setSize.bind(composer);
  composer.setSize = (w, h) => {
    resize(w, h);
    pass.uniforms.uTexel.value.set(1 / Math.max(1, w), 1 / Math.max(1, h));
  };
}

// The Rift's air is not one colour: each place keeps its own haze, eased in by distance, and
// the open void past the rim goes darker and colder.
const AIRS = [
  { x: 6000, z: 6168, r: 95, color: '#332a40' }, // the Chainward: plum dark
  { x: 5800, z: 6116, r: 80, color: '#2b3446' }, // the Garrison: cold steel
  { x: 6258, z: 5962, r: 80, color: '#2e2b42' }, // the Bastion: deep violet
  { x: 6000, z: 5830, r: 70, color: '#47465a' }, // the arrival shelf, under the Wash's daylight
];
const BASIN = new THREE.Color('#3b3650');
const RIM = new THREE.Color('#24213a');
const _air = new THREE.Color();
const _tmp = new THREE.Color();
// the surface bounce (G.settings.bounceLight, off by default): a sandy ground by day, the dark
// sea's blue by night, at most this strong
const BOUNCE_DAY = new THREE.Color('#a39272'), BOUNCE_NIGHT = new THREE.Color('#34405a'), SURFACE_BOUNCE = 0.42;
function airAt(p, out) {
  out.copy(BASIN);
  const d = Math.hypot(p.x - 6000, p.z - 6000);
  out.lerp(RIM, smoothstep(210, 330, d));
  for (const a of AIRS) {
    const w = 1 - smoothstep(a.r * 0.4, a.r, Math.hypot(p.x - a.x, p.z - a.z));
    if (w > 0) out.lerp(_tmp.set(a.color), w * 0.75);
  }
  return out;
}

export function buildRift(world, exclusions) {
  const low = !!(G.settings && G.settings.quality === 'low');
  const state = { low, wrong: 0 };
  // The surface's scatter (props.js) would strew lone boulders and dead trees over the basin
  // with nothing to explain them. The Rift dresses its own ground (riftFloor.js). This exclusion
  // covers it while the vegetation is placed and shrinks to nothing once it has been
  // (world.vegetation is set), so forage still grows there.
  exclusions.push({ x: 6000, z: 6000, get r() { return world.vegetation ? 0 : 440; } });
  exclusions.push({ x: 7000, z: 7000, get r() { return world.vegetation ? 0 : 300; } });
  state.sky = buildRiftSky(world, low);
  buildRiftVistas(world, state);
  buildRiftLandmarks(world, exclusions, state);
  buildRiftCamps(world, exclusions, state);
  buildRiftMysteries(world, exclusions, state);
  buildRiftCity(world, exclusions);
  buildRiftSpire(world, exclusions, state);
  buildRiftCeiling(world, exclusions, state);
  buildAscentLifts(world, exclusions, state);
  // The castles first, the omens that hang from them, then the kingdom's walls and roads that
  // tie them together, the ground's own dressing, and rock in the ground they all left free.
  buildRiftCastles(world, exclusions, state);
  buildRiftOmens(world, exclusions, state);
  buildRiftKingdom(world, exclusions, state);
  buildRiftFloor(world, exclusions, state);
  buildRiftRock(world, exclusions, state);
  buildRiftSanity(world, state);
  if (state.spirePickups) state.pickups = (state.pickups || []).concat(state.spirePickups);

  if (G.game && G.game.composer) guardBloom(G.game.composer);

  // The floor gives back a little of the light that falls on it: without it every underside
  // (the crown's corbels, bridges, the hanging halls, overhangs) is a hole of pure black.
  const bounce = new THREE.DirectionalLight('#4a4460', 0);
  bounce.position.set(0.2, -1, 0.35);
  bounce.castShadow = false;
  world.scene.add(bounce, bounce.target);
  state.bounce = bounce;

  const playerRim = new THREE.PointLight('#9eb8ff', 0, 16, 1.6);
  playerRim.castShadow = false;
  world.scene.add(playerRim);
  state.playerRim = playerRim;

  const orig = world.sky.update.bind(world.sky);
  world.sky.update = (dt, center, camera, inRift) => {
    const cam = camera && camera.position;
    const below = inRift || inRiftView(cam);
    orig(dt, center, camera, below);
    if (playerRim) {
      if (inRift && center) {
        playerRim.position.set(center.x + 0.35, center.y + 1.15, center.z + 0.55);
        playerRim.intensity = 0.72;
      } else {
        playerRim.intensity = 0;
      }
    }
    if (below) {
      world.sky.sun.intensity = Math.max(world.sky.sun.intensity, 1.9);
      world.sky.hemi.intensity = Math.max(world.sky.hemi.intensity, 1.0);
      world.sky.hemi.groundColor.lerp(_tmp.set('#3e2c62'), 0.4);
    }
    if (below) {
      bounce.intensity = 0.55 * world.sky.riftBlend;
      bounce.color.set('#4a4460');
      bounce.position.set(0.2, -1, 0.35);
    } else if (G.settings?.bounceLight) {
      // P6, off by default, for the user to judge: on the surface the same light is the ground
      // giving back the sun, from below and from the side the sun is not, so the faces it misses
      // (walls in shade, tree-crown undersides, overhangs) keep their form instead of going black
      const sky = world.sky, d = sky.sunDir, night = 1 - Math.min(1, Math.max(0, (d.y + 0.2) / 0.25));
      const hl = Math.hypot(d.x, d.z) || 1;
      bounce.position.set(-d.x / hl, -0.45, -d.z / hl);
      bounce.color.copy(BOUNCE_DAY).lerp(BOUNCE_NIGHT, night);
      bounce.intensity = SURFACE_BOUNCE * sky.light * (1 - sky.weather.dark * 0.4);
    } else bounce.intensity = 0;
    updateRiftSky(state.sky, dt, camera, below, state.wrong, cam ? airAt(cam, _air) : null);
    // Below, the horizon is only haze and the void under it goes dark: the dome takes the
    // fog's colour at the horizon (sanity tint and all) and near-black below it.
    const r = world.sky.riftBlend;
    if (r > 0 && world.scene.fog) {
      const u = world.sky.uniforms, f = world.scene.fog.color;
      u.uHor.value.lerp(f, r);
      u.uBottom.value.lerp(_tmp.set('#141120'), r);
      u.uTop.value.lerp(_tmp.set('#1b1816'), r);
      if (u.uFog) u.uFog.value.lerp(f, r);
    }
    if (below || state.sky.uniforms.uRift.value > 0.01) {
      updateRiftSanity(world, state, dt, center, inRift);
      updateRiftMysteries(state, dt);
      updateRiftCeiling(state, dt);
      updateAscentLifts(state, dt);
      updateRiftSpire(state, dt);
      updateRiftCastles(state, dt);
      updateRiftOmens(state, dt);
    }
  };
  world.rift = state;
}
