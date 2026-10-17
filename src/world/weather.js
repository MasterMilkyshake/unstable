// Weather: biome-driven precipitation around the camera plus a slow weather cycle.
//   temperate islands & open sea: clear / rain / thunderstorm
//   snow: snowfall, sometimes a blizzard   rime (the Hush): flurries in the fog
//   volcanic: ash and rising embers
//   rift: drifting motes
// Feeds fog/light/lightning into the sky (sky.weather) and ambience into the audio.
import * as THREE from 'three';
import { G } from '../core/globals.js';
import { UPDATE_HOOKS, START_HOOKS, BOOT_HOOKS, ACTIONS } from '../game/hooks.js';
import { rand } from '../core/util.js';
import { SEA } from './water.js';

const BOX = { w: 46, h: 30, up: 7 }; // box around the camera, centered `up` meters above it

// What stands over each metre of ground (world.colliders): a drop below the top of anything
// built over its column is under a roof, an eave, a deck or a bridge, and is not drawn, so
// no room keeps rain or snow whether or not its builder marked it as a shelter. Columns are
// looked up once and kept (the colliders are static); a few hundred new ones are filled a
// frame, and until then a column counts as open.
const COVER_CELL = 1;
class Cover {
  constructor(colliders) {
    this.colliders = colliders;
    this.top = new Map();
    this.queue = [];
  }
  at(x, z) {
    const ix = Math.floor(x / COVER_CELL), iz = Math.floor(z / COVER_CELL), key = ix * 65536 + iz;
    const v = this.top.get(key);
    if (v !== undefined) return v;
    this.top.set(key, -Infinity);
    this.queue.push(key, ix, iz);
    return -Infinity;
  }
  fill(budget) {
    for (let i = 0; i < budget && this.queue.length; i++) {
      const iz = this.queue.pop(), ix = this.queue.pop(), key = this.queue.pop();
      this.top.set(key, this.colliders.topAt((ix + 0.5) * COVER_CELL, (iz + 0.5) * COVER_CELL));
    }
    if (this.top.size > 300000) { this.top.clear(); this.queue.length = 0; }
  }
}

function roundSprite() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.6)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// A field of particles kept in a box around the camera (world-anchored, wrapped).
class Field {
  constructor(scene, o) {
    this.o = o;
    this.n = o.count;
    const pos = new Float32Array(this.n * (o.lines ? 6 : 3));
    this.p = new Float32Array(this.n * 3);
    this.seed = new Float32Array(this.n);
    for (let i = 0; i < this.n; i++) {
      this.p[i * 3] = rand(-BOX.w / 2, BOX.w / 2);
      this.p[i * 3 + 1] = rand(-BOX.h / 2, BOX.h / 2) + BOX.up;
      this.p[i * 3 + 2] = rand(-BOX.w / 2, BOX.w / 2);
      this.seed[i] = Math.random() * 100;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.geo = geo;
    if (o.lines) {
      this.mat = new THREE.LineBasicMaterial({ color: o.color, transparent: true, opacity: 0, depthWrite: false, fog: true });
      this.obj = new THREE.LineSegments(geo, this.mat);
    } else {
      this.mat = new THREE.PointsMaterial({
        color: o.color, size: o.size, map: Field.sprite || (Field.sprite = roundSprite()), transparent: true, opacity: 0, depthWrite: false,
        blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending, sizeAttenuation: true, fog: !o.additive,
      });
      this.obj = new THREE.Points(geo, this.mat);
    }
    this.obj.frustumCulled = false;
    this.obj.visible = false;
    this.obj.renderOrder = 5;
    this.intensity = 0;
    this.target = 0;
    this.started = false;
    scene.add(this.obj);
  }
  update(dt, cam, wind, time, roofs = null, cover = null) {
    this.intensity += (this.target - this.intensity) * Math.min(1, dt * 0.4);
    const vis = this.intensity > 0.02;
    this.obj.visible = vis;
    if (!vis) return;
    const o = this.o;
    this.mat.opacity = o.opacity * this.intensity;
    const active = Math.floor(this.n * Math.min(1, this.intensity * 1.15));
    const P = this.p;
    const out = this.geo.attributes.position.array;
    // world-anchored: on first show, scatter the box around the camera
    if (!this.started) {
      this.started = true;
      for (let i = 0; i < this.n; i++) {
        P[i * 3] += cam.x;
        P[i * 3 + 1] += cam.y;
        P[i * 3 + 2] += cam.z;
      }
    }
    const hw = BOX.w / 2;
    const hh = BOX.h / 2;
    for (let i = 0; i < this.n; i++) {
      const k = i * 3;
      const s = this.seed[i];
      let x = P[k] + (wind.x + Math.sin(time * o.sway + s) * o.swayAmt) * dt;
      let y = P[k + 1] + o.vy * (0.75 + (s % 1) * 0.5) * dt;
      let z = P[k + 2] + (wind.z + Math.cos(time * o.sway * 0.8 + s) * o.swayAmt) * dt;
      // wrap around the camera
      if (x - cam.x > hw) x -= BOX.w;
      else if (x - cam.x < -hw) x += BOX.w;
      if (z - cam.z > hw) z -= BOX.w;
      else if (z - cam.z < -hw) z += BOX.w;
      if (y - cam.y - BOX.up > hh) y -= BOX.h;
      else if (y - cam.y - BOX.up < -hh) y += BOX.h;
      P[k] = x;
      P[k + 1] = y;
      P[k + 2] = z;
      // Sprites are world-sized: one drifting past the lens would fill the screen and bloom
      // into a white orb, so none comes nearer than four metres.
      const dx = x - cam.x, dy = y - cam.y, dz = z - cam.z;
      // Keep sprites off the lens, and nothing falls inside a roofed room (world.shelters) or
      // under anything built over it (world.colliders).
      const hide = i >= active || (!o.lines && dx * dx + dy * dy + dz * dz < 16) || (roofs && underRoof(roofs, x, y, z)) || (cover && y < cover.at(x, z)) ? -9999 : 0;
      if (o.lines) {
        const j = i * 6;
        out[j] = x;
        out[j + 1] = y + hide;
        out[j + 2] = z;
        out[j + 3] = x - wind.x * 0.03;
        out[j + 4] = y + o.len + hide;
        out[j + 5] = z - wind.z * 0.03;
      } else {
        out[k] = x;
        out[k + 1] = y + hide;
        out[k + 2] = z;
      }
    }
    this.geo.attributes.position.needsUpdate = true;
  }
}

// Rooms near the camera that keep the weather out (rotated boxes, see world/mason.js shelter()).
function underRoof(roofs, x, y, z) {
  for (const r of roofs) {
    if (y < r.y0 || y > r.y1) continue;
    const dx = x - r.x, dz = z - r.z;
    const lx = dx * r.cos - dz * r.sin, lz = dx * r.sin + dz * r.cos;
    if (Math.abs(lx) <= r.hw && Math.abs(lz) <= r.hd) return true;
  }
  return false;
}

const KIND_FOR_BIOME = { snow: 'snow', volcanic: 'ash', rift: 'motes' };

class Weather {
  constructor(scene) {
    const low = G.settings && G.settings.quality === 'low';
    const q = low ? 0.5 : 1;
    this.fields = {
      rain: new Field(scene, { count: Math.round(2600 * q), lines: true, color: '#c8d6e4', opacity: 0.6, vy: -30, len: 1.4, sway: 0, swayAmt: 0 }),
      // Flakes are a hand's width, and a shade under white so they never cross the bloom threshold.
      snow: new Field(scene, { count: Math.round(3600 * q), color: '#dde4ec', size: 0.14, opacity: 0.9, vy: -2.4, sway: 1.1, swayAmt: 0.7 }),
      ash: new Field(scene, { count: Math.round(1800 * q), color: '#9a948e', size: 0.13, opacity: 0.85, vy: -1.2, sway: 0.7, swayAmt: 0.5 }),
      embers: new Field(scene, { count: Math.round(420 * q), color: '#ff8a3a', size: 0.18, opacity: 1, additive: true, vy: 1.8, sway: 1.5, swayAmt: 0.8 }),
      motes: new Field(scene, { count: Math.round(700 * q), color: '#b89aff', size: 0.22, opacity: 0.9, additive: true, vy: 0.5, sway: 0.6, swayAmt: 0.7 }),
      drips: new Field(scene, { count: Math.round(900 * q), lines: true, color: '#b8a8ff', opacity: 0.4, vy: -14, len: 0.7, sway: 0, swayAmt: 0 }),
    };
    this.cycle = 'clear'; // temperate cycle: clear | rain | storm
    this.cycleT = rand(90, 200);
    this.snowStorm = false;
    this.wind = new THREE.Vector3(1.5, 0, 0.8);
    this.windTarget = this.wind.clone();
    this.boltT = rand(5, 12);
    this.time = 0;
    this.region = 'temperate';
    this.forced = null;
  }

  regionKind(game) {
    const p = game.player;
    if (!p) return 'temperate';
    const isl = game.world.islandAt(p.pos.x, p.pos.z);
    if (!isl) return 'temperate';
    const biome = game.world.biomeAt(p.pos.x, p.pos.z);
    // the Hush keeps its own fog under Frosthollow's snow: thin flurries, and its storms come in
    // as freezing fog rather than a blizzard
    if (biome === 'hush') return 'rime';
    // a sub-region keeps its own weather (the Ashen Spire's cone on Thornwood's continent)
    return KIND_FOR_BIOME[biome] || KIND_FOR_BIOME[isl.biome] || 'temperate';
  }

  update(game, dt) {
    this.time += dt;
    const cam = G.camera.position;
    const region = this.regionKind(game);
    this.region = region;
    // out on open water the weather turns sooner, and to squalls more often
    const p = game.player;
    const atSea = !!p && !game.inRift && !game.world.islandAt(p.pos.x, p.pos.z);
    // advance the weather cycle
    this.cycleT -= dt * (atSea ? 1.8 : 1);
    if (this.cycleT <= 0) {
      const r = Math.random();
      this.cycle = atSea ? (r < 0.4 ? 'clear' : r < 0.72 ? 'rain' : 'storm') : r < 0.58 ? 'clear' : r < 0.86 ? 'rain' : 'storm';
      this.snowStorm = Math.random() < 0.25;
      this.cycleT = rand(120, 300);
      this.windTarget.set(rand(-1, 1), 0, rand(-1, 1)).normalize().multiplyScalar(this.cycle === 'storm' ? rand(6, 10) : rand(1, 4));
    }
    const cycle = this.forced || this.cycle;
    this.wind.lerp(this.windTarget, Math.min(1, dt * 0.2));
    // the sea runs higher in rain and higher still in a storm (outside the Rift, whose sea is
    // the ceiling)
    const swell = game.inRift ? 1 : cycle === 'storm' ? 2.2 : cycle === 'rain' ? 1.35 : 1;
    SEA.swell += (swell - SEA.swell) * Math.min(1, dt * 0.15);
    // targets per field
    const t = { rain: 0, snow: 0, ash: 0, embers: 0, motes: 0, drips: 0 };
    let fog = 0;
    let dark = 0;
    let wind = 0;
    if (region === 'snow' || region === 'rime') {
      const blizzard = this.snowStorm || cycle === 'storm';
      const rime = region === 'rime';
      t.snow = blizzard ? (rime ? 0.6 : 1) : rime ? 0.22 : 0.45;
      fog = blizzard ? 0.75 : rime ? 0.3 : 0.15;
      dark = blizzard ? (rime ? 0.25 : 0.35) : 0;
      wind = blizzard ? (rime ? 0.7 : 1) : 0.35;
    } else if (region === 'ash') {
      t.ash = 0.8;
      t.embers = 0.8;
      fog = 0.4;
      dark = 0.22;
      wind = 0.25;
    } else if (region === 'motes') {
      // the Rift lies under the isles: a little dust in the light, water only at the falls
      t.motes = 0.12;
    } else if (cycle === 'rain') {
      t.rain = 0.55;
      fog = 0.3;
      dark = 0.3;
      wind = 0.3;
    } else if (cycle === 'storm') {
      t.rain = 1;
      fog = 0.55;
      dark = 0.65;
      wind = 0.8;
    }
    const underwater = cam.y < -0.6;
    // the shelters within reach of the particle box, refreshed a few times a second
    this.roofT = (this.roofT ?? 0) - dt;
    if (this.roofT <= 0) {
      this.roofT = 0.3;
      const reach = BOX.w * 0.75 + 30;
      this.roofs = (game.world.shelters || []).filter(r => Math.abs(r.x - cam.x) < reach + r.hw + r.hd && Math.abs(r.z - cam.z) < reach + r.hw + r.hd);
    }
    if (game.world.colliders && this.coverOf !== game.world.colliders) {
      this.coverOf = game.world.colliders;
      this.cover = new Cover(game.world.colliders);
    }
    let falling = false;
    for (const k in this.fields) {
      const f = this.fields[k];
      f.target = underwater ? 0 : t[k];
      const w = k === 'snow' && (this.snowStorm || cycle === 'storm') ? this.wind.clone().multiplyScalar(2.2) : this.wind;
      f.update(dt, cam, w, this.time, this.roofs?.length ? this.roofs : null, this.cover);
      falling ||= f.obj.visible;
    }
    if (falling) this.cover?.fill(300);
    const sky = game.world.sky;
    const k = Math.min(1, dt * 0.3);
    sky.weather.fog += (fog - sky.weather.fog) * k;
    sky.weather.dark += (dark - sky.weather.dark) * k;
    // lightning during thunderstorms
    if (region === 'temperate' && cycle === 'storm' && !game.inRift) {
      this.boltT -= dt;
      if (this.boltT <= 0) {
        this.boltT = rand(5, 16);
        // the whole sky lights up: a quarter as bright for those who asked for less flashing
        sky.weather.flash = rand(0.7, 1.2) * (G.settings?.reduceFlashing ? 0.25 : 1);
        const delay = rand(0.3, 2.2);
        setTimeout(() => G.audio && G.audio.play('thunder', { vol: 1.3 - delay * 0.25 }), delay * 1000);
      }
    }
    G.audio && G.audio.setWeather && G.audio.setWeather(this.fields.rain.intensity, Math.max(wind * 0.8, this.fields.rain.intensity * 0.4));
  }

  hide() {
    for (const k in this.fields) {
      this.fields[k].target = 0;
      this.fields[k].intensity = 0;
      this.fields[k].obj.visible = false;
    }
    if (G.audio && G.audio.setWeather) G.audio.setWeather(0, 0);
  }
}

let weather = null;
// Built at boot, hidden, so its rain, snow and mote materials are compiled behind the menu: built
// at the first start, they compiled in the first frames of play.
BOOT_HOOKS.push(() => {
  if (!weather) weather = new Weather(G.scene);
});
START_HOOKS.push(() => {
  if (!weather) weather = new Weather(G.scene);
});
UPDATE_HOOKS.push((game, dt) => {
  if (!weather) weather = new Weather(G.scene);
  weather.update(game, dt);
});
// hide when leaving play (menu orbit has no weather)
let lastState = null;
setInterval(() => {
  const g = G.game;
  if (!g || !weather) return;
  if (g.state !== 'playing' && lastState === 'playing') weather.hide();
  lastState = g.state;
}, 500);

ACTIONS.setWeather = (cycle) => {
  if (!weather) weather = new Weather(G.scene);
  weather.forced = cycle || null;
};
// the wind as it blows (the way it carries rain and sails, metres a second): boats run faster
// before it (entities/boat.js)
ACTIONS.wind = () => weather && weather.wind;
ACTIONS.weatherState = () => weather && { region: weather.region, cycle: weather.forced || weather.cycle, rain: weather.fields.rain.intensity, snow: weather.fields.snow.intensity };
