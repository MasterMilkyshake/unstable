// World container: terrain, water, sky, structures, vegetation, colliders,
// interactables, dynamic lights, chests and temporary walls.
import * as THREE from 'three';
import { G } from '../core/globals.js';
import { Terrain } from './terrain.js';
import { Water } from './water.js';
import { Sky } from './sky.js';
import { Colliders } from './colliders.js';
import { buildStructures, buildVegetation, cullPastFog, fogCullable, mat } from './props.js';
import { buildForage } from './forage.js';
import { buildLandmarks } from './landmarks.js';
import { buildRiftscape } from './riftscape.js';
import { buildRift } from './rift.js';
import { buildCliffs } from './cliffs.js';
import { buildBeauty } from './beauty.js';
import { buildGreatBridge } from './greatBridge.js';
import { buildHightoll } from './hightoll.js';
import { buildCarrierLines } from './ziplines.js';
import { buildLedges } from './ledges.js';
import { buildNearGrass, updateNearGrass, setNearGrassQuality } from './nearGrass.js';
import { buildWildlife } from './wildlife.js';
import { buildAdventure } from './adventure.js';
import { buildDungeons } from './dungeons.js';
import { mergeStatic } from './merge.js';
import { THIN_LORE, THIN_CHEST } from '../data/thinMind.js';
import { LOCATIONS, CHESTS, ISLANDS, BIOME_MOOD, islandDist, islandAtPoint } from '../data/world.js';
import { hypot } from '../core/util.js';

const LIGHT_POOL = 4;
// Lights carried by actors: the player's rim and fill, a watchman's lantern.
const LENT_LIGHTS = 3;
const _lentPos = new THREE.Vector3();

export class World {
  constructor(scene) {
    this.scene = scene;
    this.terrain = new Terrain();
    this.colliders = new Colliders();
    this.interactables = [];
    this.lightSources = [];
    this.lentLights = [];
    this.animated = [];
    this.hazards = [];
    this.docks = {};
    this.dummySpots = [];
    this.projectileBlockers = [];
    this.chests = [];
    this.walls = [];
    this.time = 0;
    this.lightTimer = 0;
  }

  build() {
    const scene = this.scene;
    this.terrain.build(scene);
    this.water = new Water(scene);
    this.sky = new Sky(scene);
    // Footprints that scatter (trees, grass, forage) must stay off; later passes add to it.
    const exclusions = (this.exclusions = buildStructures(this));
    // Camps, carts, fires and lairs settle before records, chests and NPCs read their places.
    buildAdventure(this, exclusions);
    for (const c of CHESTS) exclusions.push({ x: c.x, z: c.z, r: 3 });
    buildLandmarks(this, exclusions);
    this.beauty = buildBeauty(this, exclusions);
    buildGreatBridge(this, exclusions);
    buildHightoll(this, exclusions);
    buildCarrierLines(this, exclusions);
    // the ledge-built world's climbing lines and hidden stairs (data/ledges.js)
    buildLedges(this, exclusions);
    buildRiftscape(this, exclusions);
    buildRift(this, exclusions);
    // Dungeons: their rooms out past the map's southern edge, their ways down on the surface.
    buildDungeons(this, exclusions);
    // The lecterns, notices, letters and carved stones that carry lore are set down one by one
    // (and some moved again by later builders); settled, they bake into the static batches,
    // all but the ones a thinned mind alone sees, which are shown and hidden.
    mergeStatic(scene, (this.loreTablets || []).filter((t) => t.group && !THIN_LORE.has(t.lore.id)).map((t) => t.group));
    this.cliffCount = buildCliffs(this, exclusions);
    this.vegetation = buildVegetation(scene, this.terrain, this.colliders, exclusions);

    buildNearGrass(this, G.settings?.quality || 'high');
    buildForage(this, exclusions);
    buildWildlife(this);

    // Static scenery that should vanish together once the fog has swallowed it, so a far
    // island never leaves its houses floating on the horizon without the ground under them.
    this.fogCulled = [...this.vegetation, ...this.terrain.islands.map((isl) => fogCullable(isl.mesh))];
    for (const o of scene.children) if (o.name === 'merged_static' || o.name === 'cliffs') this.fogCulled.push(fogCullable(o));

    // light pool
    this.pool = [];
    for (let i = 0; i < LIGHT_POOL; i++) {
      const l = new THREE.PointLight('#ffaa55', 0, 12, 2);
      scene.add(l);
      this.pool.push(l);
    }
    for (let i = 0; i < LENT_LIGHTS; i++) this._addLentLight();

    // chests: the lids swing open; the rest bakes into the static batches
    for (const c of CHESTS) this._buildChest(c);
    mergeStatic(scene, this.chests.filter((c) => c.def.id !== THIN_CHEST).map((c) => c.mesh));
  }

  _buildChest(c) {
    const y = c.y ?? this.terrain.heightAt(c.x, c.z);
    const g = new THREE.Group();
    g.position.set(c.x, y, c.z);
    g.rotation.y = Math.atan2(-c.x, -c.z);
    const wood = mat('#6a4424');
    const band = mat('#c8a040', { metalness: 0.7, roughness: 0.35 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.6, 0.7), wood);
    base.position.y = 0.3;
    base.castShadow = true;
    g.add(base);
    const lidPivot = new THREE.Group();
    lidPivot.userData.dynamic = true; // opens
    lidPivot.position.set(0, 0.6, -0.35);
    g.add(lidPivot);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.25, 0.72), wood);
    lid.position.set(0, 0.12, 0.35);
    lid.castShadow = true;
    lidPivot.add(lid);
    for (const x of [-0.4, 0.4]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.62, 0.74), band);
      b.position.set(x, 0.31, 0);
      g.add(b);
    }
    this.scene.add(g);
    const chest = { def: c, mesh: g, lid: lidPivot, opened: false };
    this.chests.push(chest);
    this.colliders.addBox({ x: c.x, z: c.z, w: 1.1, d: 0.8, y0: y - 1, y1: y + 0.6, rot: g.rotation.y });
    this.addInteract({ id: c.id, kind: 'chest', pos: new THREE.Vector3(c.x, y + 0.5, c.z), radius: 2.6, label: 'Open Chest', chest, enabled: () => !chest.opened });
  }

  resetChests() {
    for (const c of this.chests) {
      c.opened = false;
      c.lid.rotation.x = 0;
    }
  }

  setChestOpened(id, anim = false) {
    const c = this.chests.find((x) => x.def.id === id);
    if (!c) return;
    c.opened = true;
    if (!anim) c.lid.rotation.x = -1.9;
    else {
      let t = 0;
      this.animated.push((time, dt) => {
        if (t >= 1) return;
        t = Math.min(1, t + (dt || 0.016) * 2.5);
        c.lid.rotation.x = -1.9 * t;
      });
    }
  }

  // night: how much brighter the light reads after dark (street lamps against a black sky);
  // a fire indoors burns the same at any hour.
  addLight(pos, color, intensity, distance, flicker = false, priority = 1, night = 1.6) {
    this.lightSources.push({ pos, color: new THREE.Color(color), intensity, distance, flicker, priority, night });
  }

  // Three.js builds the number of lights into every lit shader, so a light joining or leaving
  // the scene at runtime recompiles every material on screen, a stall of seconds. Lights an
  // actor carries are therefore in the scene from the start: one is lent to a holder (a model
  // root) and carried to it before each render, and lies dark when its holder is hidden, has
  // left the scene or has given it back.
  _addLentLight() {
    const light = new THREE.PointLight('#ffffff', 0, 10, 2);
    light.castShadow = false;
    this.scene.add(light);
    const slot = { light, holder: null, offset: new THREE.Vector3(), intensity: null };
    this.lentLights.push(slot);
    return slot;
  }

  // intensity: held while lent (a lantern); null leaves it to the borrower each frame.
  lendLight(holder, offset, color, distance, decay, intensity = null) {
    const slot = this.lentLights.find((s) => !s.holder) || this._addLentLight();
    slot.holder = holder;
    slot.offset.copy(offset);
    slot.intensity = intensity;
    const l = slot.light;
    l.color.set(color);
    l.distance = distance;
    l.decay = decay;
    l.intensity = intensity ?? 0;
    return l;
  }

  returnLight(light) {
    const slot = this.lentLights.find((s) => s.light === light);
    if (!slot) return;
    slot.holder = null;
    light.intensity = 0;
  }

  // Everything lent to a holder that is leaving the scene comes back at once, so the next
  // holder (a new player in the same frame) finds it free.
  releaseLights(holder) {
    for (const s of this.lentLights) if (s.holder === holder) this.returnLight(s.light);
  }

  placeLentLights() {
    for (const s of this.lentLights) {
      const l = s.light;
      if (!s.holder) {
        l.intensity = 0;
        continue;
      }
      let shown = true;
      let o = s.holder;
      for (; o.parent; o = o.parent) if (!o.visible) shown = false;
      if (o !== this.scene) {
        this.returnLight(l); // its holder has left the scene
        continue;
      }
      if (!shown) {
        l.intensity = 0;
        continue;
      }
      if (s.intensity != null) l.intensity = s.intensity;
      s.holder.updateWorldMatrix(true, false);
      l.position.copy(_lentPos.copy(s.offset).applyMatrix4(s.holder.matrixWorld));
    }
  }

  addEmitter(e) {
    G.vfx.emitters.push(e);
  }

  addInteract(it) {
    this.interactables.push(it);
    return it;
  }

  groundAt(x, z, maxY = 1e4) {
    return Math.max(this.terrain.heightAt(x, z), this.colliders.groundAt(x, z, maxY));
  }

  inRift(x) {
    return x > 3000;
  }

  locationAt(x, z) {
    let best = null;
    for (const l of LOCATIONS) {
      const d = hypot(x - l.x, z - l.z);
      if (d < l.r && (!best || l.r < best.r)) best = l;
    }
    return best;
  }

  islandAt(x, z) {
    const hit = islandAtPoint(x, z, 1.25);
    return hit ? hit.island : null;
  }

  // Biome of the sub-region at (x, z): an island's zone when inside one, else its biome.
  biomeAt(x, z) {
    const isl = this.islandAt(x, z);
    if (!isl) return null;
    let best = isl.biome;
    let bw = 0.5;
    for (const zn of isl.zones || []) {
      if (zn.sink) continue;
      const t = hypot(x - zn.x, z - zn.z) / zn.r;
      if (t < bw) {
        bw = t;
        best = zn.biome;
      }
    }
    return best;
  }

  moodAt(x, z) {
    const b = this.biomeAt(x, z);
    return b ? BIOME_MOOD[b] || 'calm' : 'calm';
  }

  surfaceAt(x, z, y = 0) {
    if (y < 0.15) return 'water';
    const h = this.terrain.heightAt(x, z);
    if (h < 0.35) return 'water';
    const isl = this.islandAt(x, z);
    if (!isl) return h < 1.2 ? 'sand' : 'dirt';
    // the Ashen Spire's cone and lava fields lie on Thornwood's continent
    const zone = this.biomeAt(x, z);
    if (zone === 'volcanic' || zone === 'ashfield') return 'ash';
    switch (isl.biome) {
      case 'beach':
        return 'sand';
      case 'snow':
        return h > isl.maxH * 0.35 ? 'snow' : 'stone';
      case 'volcanic':
        return 'ash';
      case 'marsh':
        return h < 2.2 ? 'wet' : 'dirt';
      case 'rift':
        return 'rift';
      case 'forest':
      case 'jungle':
        return 'dirt';
      case 'meadow':
        if (isl.id === 'saltreach' && hypot(x - isl.cx, z - isl.cz) < 80) return 'stone';
        return h < 2 ? 'sand' : 'grass';
      default:
        return 'grass';
    }
  }

  isDeepOcean(x, z) {
    if (x > 3000) return false;
    const h = this.terrain.heightAt(x, z);
    if (h > -10) return false;
    for (const i of ISLANDS) if (islandDist(i, x, z) < 1.4) return false;
    return true;
  }

  spawnIceWall(pos, yaw, w, h, dur, team) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, 0.9),
      new THREE.MeshStandardMaterial({ color: '#cfefff', transparent: true, opacity: 0.8, roughness: 0.1, emissive: '#3a8ac8', emissiveIntensity: 0.35, flatShading: true })
    );
    m.position.set(pos.x, pos.y + h / 2 - 0.3, pos.z);
    m.rotation.y = yaw;
    m.castShadow = true;
    this.scene.add(m);
    const col = this.colliders.addBox({ x: pos.x, z: pos.z, w, d: 0.9, y0: pos.y - 1, y1: pos.y + h - 0.3, rot: yaw, climbable: true });
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    const blocker = {
      team,
      contains: (p) => {
        const dx = p.x - pos.x;
        const dz = p.z - pos.z;
        const lx = dx * cos - dz * sin;
        const lz = dx * sin + dz * cos;
        return Math.abs(lx) < w / 2 && Math.abs(lz) < 0.7 && p.y > pos.y - 0.5 && p.y < pos.y + h;
      },
    };
    this.projectileBlockers.push(blocker);
    const wall = { m, col, blocker, t: dur, h };
    this.walls.push(wall);
    m.scale.y = 0.01;
    G.vfx.burst(m.position, 'rime', 30, { speed: 6 });
  }

  setNearGrassQuality(quality) {
    setNearGrassQuality(this, quality);
  }

  update(dt, center) {
    this.time += dt;
    const t = this.time;
    for (const fn of this.animated) fn(t, dt);
    const cam = G.game?.camera;
    if (cam) {
      updateNearGrass(this, cam, center);
      cullPastFog(this.fogCulled, cam, this.scene.fog.far);
    }

    for (let i = this.walls.length - 1; i >= 0; i--) {
      const w = this.walls[i];
      w.t -= dt;
      w.m.scale.y = Math.min(1, w.m.scale.y + dt * 6);
      if (w.t <= 0) {
        this.scene.remove(w.m);
        w.m.geometry.dispose();
        w.m.material.dispose();
        this.colliders.remove(w.col);
        this.projectileBlockers.splice(this.projectileBlockers.indexOf(w.blocker), 1);
        G.vfx.burst(w.m.position, 'rime', 30, { speed: 6 });
        this.walls.splice(i, 1);
      }
    }

    // assign nearest light sources to the pool
    this.lightTimer -= dt;
    if (this.lightTimer <= 0) {
      this.lightTimer = 0.4;
      const sorted = this.lightSources
        .map((s) => ({ s, d: s.pos.distanceToSquared(center) / (s.priority || 1) }))
        .filter((x) => x.d < 120 * 120)
        .sort((a, b) => a.d - b.d)
        .slice(0, LIGHT_POOL);
      this.pool.forEach((l, i) => {
        const e = sorted[i];
        l.userData.src = e ? e.s : null;
        if (e) {
          l.position.copy(e.s.pos);
          l.color.copy(e.s.color);
          l.distance = e.s.distance;
        }
      });
    }
    const night = this.sky.isNight() || G.game.inRift;
    for (const l of this.pool) {
      const s = l.userData.src;
      if (!s) {
        l.intensity = 0;
        continue;
      }
      const base = s.intensity * (night ? s.night ?? 1.6 : 0.7);
      l.intensity = s.flicker ? base * (0.8 + Math.sin(t * 13 + s.pos.x) * 0.1 + Math.random() * 0.15) : base;
    }
  }
}
