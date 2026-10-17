import { WORLD_LAYOUT } from '../data/worldPlacement.js';
// Game orchestrator: rendering, camera, game states, spawning, interaction,
// death/Rift flow, travel, saving and the main loop.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { G } from '../core/globals.js';
import { Input, keyText } from '../core/input.js';
import { AudioSys } from '../core/audio.js';
import { Save } from '../core/save.js';
import { Legacy, applyBoon } from '../core/legacy.js';
import { VFX } from '../combat/vfx.js';
import { World } from '../world/world.js';
import { tryVistaPreview } from '../world/beauty.js';
import { Player } from '../entities/player.js';
import { Enemy } from '../entities/enemy.js';
import { spawnSpot } from '../world/spawnSpot.js';
import { NPC } from '../entities/npc.js';
import { Boat } from '../entities/boat.js';
import { updateProjectiles } from '../entities/projectile.js';
import { updateTimers, clearTimers } from '../combat/mantraRuntime.js';
import { Quests } from './quests.js';
import { UI } from '../ui/ui.js';
import { Net } from '../net/net.js';
import { runUpdateHooks, runStartHooks, runBootHooks, ACTIONS } from './hooks.js';
import { ENEMIES } from '../data/enemies.js';
import { NPCS, SPAWNERS, START_POS, RIFT_SPAWN, DEFAULT_RESPAWN, RIFT_ORIGIN, moodRegionAt, landNameAt } from '../data/world.js';
import { ITEMS, OUTFITS } from '../data/items.js';
import { WEAPONS, ENCHANTS } from '../data/weapons.js';
import { RACE_BY_ID } from '../data/races.js';
import { VOWS } from '../data/vows.js';
import { newAttrs, START_POINTS, ATTRS } from '../data/stats.js';
import { clamp, rand, randInt, chance, choice, uid, angleWrap, hypot } from '../core/util.js';
import { bodyRadius } from '../combat/combat.js';
import { cameraOrbit } from './cameraCollision.js';
import { Warmup } from './warmup.js';
import { applyStartingAttunement } from './creation.js';

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();

// three.js's render-list order, compared instead of subtracted: a sort comparator that
// returns a fractional difference allocates a number on every one of thousands of calls.
const order = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
function opaqueSort(a, b) {
  if (a.groupOrder !== b.groupOrder) return order(a.groupOrder, b.groupOrder);
  if (a.renderOrder !== b.renderOrder) return order(a.renderOrder, b.renderOrder);
  if (a.material.id !== b.material.id) return a.material.id - b.material.id;
  if (a.z !== b.z) return order(a.z, b.z);
  return a.id - b.id;
}
function transparentSort(a, b) {
  if (a.groupOrder !== b.groupOrder) return order(a.groupOrder, b.groupOrder);
  if (a.renderOrder !== b.renderOrder) return order(a.renderOrder, b.renderOrder);
  if (a.z !== b.z) return order(b.z, a.z);
  return a.id - b.id;
}

// Enemies built per rendered frame across every spawner. Waking a camp queues its enemies
// rather than building them all in one frame (arriving in the Rift wakes fifteen at once).
export const SPAWNS_PER_FRAME = 2;
// Render resolution by quality: Medium keeps bloom and the grade but draws fewer pixels than
// High and skips the water's reflection (world/water.js reflects only on High).
const PIXEL_RATIO = { low: 1, medium: 1.25, high: 1.5 };

export class Spawner {
  constructor(def, game) {
    this.def = def;
    this.game = game;
    this.alive = [];
    this.timer = 0;
    this.active = false;
    this.pending = 0; // enemies queued by waking, not yet built
  }
  get rift() {
    return this.def.x > 3000;
  }
  // points: positions of every player (local + LAN friends)
  update(dt, points) {
    let d = Infinity;
    for (const pp of points) d = Math.min(d, hypot(pp.x - this.def.x, pp.z - this.def.z));
    const ch = this.game.ch;
    if (this.def.boss && ch.bossesDefeated.includes(this.def.type)) return;
    // story-gated spawners (e.g. an occupation that only exists during one chapter)
    if (this.def.when && !this.def.when(ch)) {
      if (this.active) {
        for (const e of this.alive) if (!e.aggro) e.despawn = true;
        this.alive = this.alive.filter((e) => e.aggro);
        this.active = false;
        this.pending = 0;
      }
      return;
    }
    if (d < 150) {
      if (!this.active) {
        this.active = true;
        this.pending = Math.max(0, this.def.count - this.alive.length);
      }
      if (this.pending > 0) {
        if (this.game.spawnBudget > 0) {
          this.game.spawnBudget--;
          this.pending--;
          this.spawn();
        }
      } else if (this.alive.length < this.def.count && this.def.respawn > 0) {
        this.timer -= dt;
        if (this.timer <= 0 && d > 40) {
          this.timer = this.def.respawn;
          this.spawn();
        }
      }
    } else if (d > 230 && this.active) {
      for (const e of this.alive) if (!e.aggro) e.despawn = true;
      this.alive = this.alive.filter((e) => e.aggro);
      this.active = false;
      this.pending = 0;
    }
  }
  spawn() {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * this.def.radius;
    const perch = !!(ENEMIES[this.def.type] && ENEMIES[this.def.type].perch);
    const [x, y, z] = spawnSpot(G.world, this.def.x + Math.cos(a) * r, this.def.z + Math.sin(a) * r, perch, this.def.y);
    const e = this.game.spawnEnemy(this.def.type, new THREE.Vector3(x, y + 0.1, z), {
      spawner: this,
      // a camp may raise its foes to its own level (`def.level`: a high tier holds harder foes)
      scaleTo: Math.max(this.def.level || 0, this.rift && G.player ? G.player.level : 0),
      patrol: this.def.patrol, face: this.def.face,
    });
    this.alive.push(e);
  }
  onDeath(e) {
    this.alive = this.alive.filter((x) => x !== e);
    this.timer = this.def.respawn;
  }
}

export class Game {
  constructor(canvas) {
    G.game = this;
    this.canvas = canvas;
    this.settings = G.settings = Save.loadSettings();
    this._quality = this.settings.quality;
    this.state = 'loading';

    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }));
    r.setPixelRatio(Math.min(window.devicePixelRatio, PIXEL_RATIO[this.settings.quality] || 1.5));
    r.setSize(window.innerWidth, window.innerHeight);
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.setOpaqueSort(opaqueSort);
    r.setTransparentSort(transparentSort);
    G.renderer = r;

    this.scene = G.scene = new THREE.Scene();
    this.camera = G.camera = new THREE.PerspectiveCamera(this.settings.fov, window.innerWidth / window.innerHeight, 0.1, 5600);
    this.camera.position.set(0, 30, -60);

    this.composer = new EffectComposer(r);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.55, 0.5, 0.82);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.input = G.input = new Input(canvas);
    this.audio = G.audio = new AudioSys();
    this.audio.setVolumes({ master: this.settings.master, sfx: this.settings.sfx, music: this.settings.music });
    this.audio.setQuality(this.settings.quality);
    this.vfx = G.vfx = new VFX(this.scene);
    this.world = G.world = new World(this.scene);
    this.world.build();
    this.world.sky.viewDistance = this.settings.viewDistance;
    this.world.sky.setShadows(this.settings.shadows);
    if (this.world.beauty) {
      this.world.beauty.attachComposer(this.composer, this.bloom);
      this.world.beauty.setQuality(this.settings.quality, this.settings.viewDistance);
    }
    this.world.setNearGrassQuality?.(this.settings.quality);

    this.quests = new Quests(this);
    this.ui = G.ui = new UI(this);
    this.applyInterface();
    this.net = G.net = new Net(this);
    this.nextNetId = 1;
    this.pendingNet = null;

    this.npcs = [];
    this.spawners = SPAWNERS.map((d) => new Spawner(d, this));
    this.boats = [];
    this.player = null;
    this.ch = null;
    this.camYaw = Math.PI;
    this.camPitch = 0.25;
    this.camDist = 6;
    this.camPos = new THREE.Vector3();
    this.hitStopT = 0;
    this.saveT = 0;
    this.areaName = null;
    this.mood = 'menu';
    this.bossActive = null;
    this.inRift = false;
    this.sharkT = 5;
    this.hallucT = 15;
    this.last = performance.now();
    this.menuT = 0;

    window.addEventListener('resize', () => this.onResize());
    // If the GPU drops the WebGL context (driver reset, sleep, memory pressure) save and reload rather than freeze.
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      try {
        this.save(true);
      } catch (_) {
        /* ignore */
      }
      const l = document.createElement('div');
      l.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#000;color:#d6c496;font-family:Cinzel,Georgia,serif;letter-spacing:.2em;z-index:200';
      l.textContent = 'GRAPHICS RESET — YOUR PROGRESS WAS SAVED. RELOADING…';
      document.body.appendChild(l);
      setTimeout(() => location.reload(), 1800);
    });
    this.input.onLockChange = (locked) => {
      if (!locked && this.state === 'playing' && !this.ui.isOpen() && !this.ui.suppressPause) this.ui.openPause();
    };
    window.addEventListener('beforeunload', () => {
      if (this.state === 'playing' && this.player && !this.player.dead) {
        this.save(true);
        // a reload (or crash recovery) drops you straight back into your character
        try {
          sessionStorage.setItem('unstable.resume', JSON.stringify({ lan: this.net.active ? this.net.role : null, slot: Save.slot }));
        } catch (_) {
          /* ignore */
        }
      }
    });
    window.addEventListener('pointerdown', () => this.audio.init(), { once: false });
    window.addEventListener('keydown', () => this.audio.init(), { once: true });

    this.spawnNPCs();
    runBootHooks(this); // before the warm-up, so what they add is compiled behind the menu
    this.vfx.keepPrograms();
    this.warmup = new Warmup(this);
    this.warmup.start();
    this.state = 'menu';
    this.ui.showMainMenu();
    this.audio.setMood('menu');
    tryVistaPreview(this);
    let resume = null;
    try {
      resume = JSON.parse(sessionStorage.getItem('unstable.resume') || 'null');
      sessionStorage.removeItem('unstable.resume');
    } catch (_) {
      resume = null;
    }
    const resumeSlot = resume && Number.isInteger(resume.slot) ? resume.slot : Save.slot;
    if (resume && Save.hasCharacter(resumeSlot)) {
      this.pendingNet = resume.lan || null;
      if (this.continueGame(resumeSlot)) this.ui.toast('Resumed where you left off.', 'good');
    }
    requestAnimationFrame((t) => this.frame(t));
  }


  onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.vfx.add.points.material.uniforms.uScale.value = h * 0.7;
    this.vfx.norm.points.material.uniforms.uScale.value = h * 0.7;
  }

  applySettings() {
    const s = this.settings;
    const requality = this.warmup && this._quality !== s.quality;
    this._quality = s.quality;
    Save.saveSettings(s);
    this.audio.setVolumes({ master: s.master, sfx: s.sfx, music: s.music });
    this.audio.setQuality(s.quality);
    this.camera.fov = s.fov;
    this.camera.updateProjectionMatrix();
    this.world.sky.viewDistance = s.viewDistance;
    this.world.sky.setShadows(s.shadows);
    this.world.beauty?.setQuality(s.quality, s.viewDistance);
    this.world.setNearGrassQuality?.(s.quality);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, PIXEL_RATIO[s.quality] || 1.5));
    this.applyInterface();
    this.onResize();
    // post-processing and the plain canvas use different shaders: compile the other set
    if (requality) this.warmup.start();
  }

  // The interface's own settings: its scale (the HUD and menus zoom by it) and the compass's
  // width, read once after any change.
  applyInterface() {
    const s = this.settings;
    document.documentElement.style.setProperty('--ui-scale', String(s.uiScale || 1));
    this.ui && this.ui.measureCompass && this.ui.measureCompass();
  }

  controlsEnabled() {
    return this.state === 'playing' && !this.ui.isOpen();
  }

  // ------------------------------------------------------------ characters
  createCharacter({ name, race, look }) {
    const r = RACE_BY_ID[race];
    const attrs = newAttrs();
    for (const k in r.bonus) attrs[k] += r.bonus[k];
    const ch = {
      version: 1, worldLayout: WORLD_LAYOUT, name, race, look, level: 1, xp: 0, points: START_POINTS, attrs,
      talents: [], talentPicks: 0, mantraPicks: 0, mantras: {},
      hotbar: [{ type: 'weapon' }, null, null, null, null, null, null, null, { type: 'item', id: 'waterskin' }, { type: 'item', id: 'bread' }],
      armed: false, // fists down until [1] raises them
      inventory: { items: { bread: 3, waterskin: 1, apple: 2 }, weapons: [], outfits: ['rags'] },
      waterCharges: 4,
      equipped: { weapon: null, outfit: 'rags' },
      silver: 15,
      lives: 3, maxLives: 3,
      hp: 0, ether: 999, mana: 0, hunger: 100, water: 100, sanity: 999,
      manaUnlocked: false, vow: null,
      quests: {}, flags: {}, chestsOpened: [], bossesDefeated: [],
      spawn: Object.assign({}, DEFAULT_RESPAWN), pos: null, inRift: false,
      stats: { kills: 0, deaths: 0, playtime: 0, parries: 0, started: Date.now() },
      worldTime: 0.3,
    };
    return ch;
  }

  // A new character in a slot (the first empty one unless told), replacing whoever was there.
  // Boons bought with Remembrance at creation are paid for here, as the soul wakes.
  newGame(opts, slot = Save.firstEmptySlot() || Save.slot) {
    Save.use(slot);
    if (Save.hasCharacter(slot)) Save.clearCharacter(slot);
    const ch = this.createCharacter(opts);
    applyStartingAttunement(ch, opts.attunement);
    for (const id of opts.boons || []) {
      const b = Legacy.boon(id);
      if (b && id !== 'reroll' && Legacy.spend(b.cost)) applyBoon(ch, id);
    }
    this.startGame(ch, true);
  }

  // Continue a slot: the one played last unless told. A pending danger-quit penalty belongs
  // to that slot's character alone.
  continueGame(slot = Save.lastSlot() || Save.slot) {
    Save.use(slot);
    const data = Save.load(slot);
    if (!data || !data.character || data.character.wiped) return false;
    const ch = data.character;
    const quitPenalty = !!ch.dangerQuit;
    if (quitPenalty) {
      ch.dangerQuit = false;
      ch.lives -= 1;
    }
    if (ch.lives <= 0) {
      this.ch = ch;
      this.wipe(quitPenalty ? 'Fled from battle' : 'Lost in the Rift');
      return false;
    }
    // Consume a pending penalty before play resumes so it cannot be charged twice.
    if (quitPenalty) Save.save(data);
    this.startGame(ch, false);
    if (quitPenalty) this.ui.toast('You fled from danger. The Rift took a life as payment.', 'bad');
    return true;
  }

  startGame(ch, isNew) {
    const lanRole = this.pendingNet || (this.net.active ? this.net.role : null);
    this.pendingNet = null;
    if (this.net.ws) this.net.disconnect(true);
    this.ch = ch;
    clearTimers();
    // clear previous actors
    for (const a of G.actors) a.removeFromScene();
    G.actors.length = 0;
    for (const p of G.projectiles) p.kill(false);
    G.projectiles.length = 0;
    for (const s of this.spawners) {
      s.alive = [];
      s.active = false;
    }
    for (const b of this.boats) b.dispose();
    this.boats = [];
    this.bossActive = null;
    this.transitioning = false;

    const p = (this.player = G.player = new Player(ch));
    G.actors.push(p);
    if (ACTIONS.beforeStart) ACTIONS.beforeStart(this, ch, isNew); // e.g. move saved positions after a world-layout change
    const pos = ch.pos ? new THREE.Vector3(ch.pos.x, ch.pos.y, ch.pos.z) : new THREE.Vector3(START_POS.x, 0, START_POS.z);
    // The land can change shape between versions (world/landforms.js). A saved spot now deep
    // inside rock wakes at the last rest point, rather than on top of a cliff it cannot get
    // down from; one a shelf's height under new ground is lifted onto it, and one now in open
    // air above dry ground is set down on it.
    if (ch.pos && Number.isFinite(ch.pos.y) && !this.world.inRift(pos.x)) {
      const ground = this.world.groundAt(pos.x, pos.z, pos.y + 2);
      if (ground > pos.y + 12) {
        const sp = ch.spawn || DEFAULT_RESPAWN;
        const floor = Number.isFinite(sp.y) ? sp.y : this.world.terrain.heightAt(sp.x, sp.z);
        pos.set(sp.x, this.world.groundAt(sp.x, sp.z, floor + 2), sp.z);
      } else if (pos.y > ground + 3 && ground > 0) pos.y = ground;
    }
    pos.y = Math.max(pos.y, this.world.groundAt(pos.x, pos.z, pos.y + 2));
    p.pos.copy(pos);
    p.fallStart = pos.y;
    p.yaw = ch.yaw ?? 0;
    this.camYaw = p.yaw;
    this.inRift = this.world.inRift(p.pos.x);
    this.world.sky.time = ch.worldTime ?? 0.3;
    if (ch.ether > p.maxEther) ch.ether = p.maxEther;
    if (ch.sanity > p.maxSanity) ch.sanity = p.maxSanity;
    this.world.resetChests();
    for (const id of ch.chestsOpened) this.world.setChestOpened(id);
    for (const d of this.world.dummySpots) this.spawnEnemy('training_dummy', d.clone());

    this.state = 'playing';
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    this.ui.showHUD();
    this.ui.refreshHotbar();
    this.ui.refreshQuests();
    runStartHooks(this, ch, isNew);
    this.warmup.scan(); // the player, the weather and the dummies are new to the GPU
    this.areaName = null;
    this.input.requestLock();
    if (lanRole) this.net.connect(lanRole);
    if (isNew) {
      this.ui.banner('UNSTABLE');
      setTimeout(() => this.ui.toast(keyText('Speak with Old Wren by the campfire [{interact}]'), 'quest'), 2500);
      this.save();
    }
  }

  save(force = false) {
    if (!this.player || !this.ch || this.state !== 'playing') return;
    if (this.player.dead) return;
    this.player.snapshot();
    this.ch.worldTime = this.world.sky.time;
    this.ch.inRift = this.inRift;
    this.ch.dangerQuit = !!(force && this.player.inDanger);
    if (this.areaName) this.ch.place = this.areaName; // for the slot list
    Save.save({ version: 1, character: this.ch });
  }

  quitToMenu() {
    try {
      sessionStorage.removeItem('unstable.resume');
    } catch (_) {
      /* ignore */
    }
    this.save(true);
    this.net.disconnect(true);
    for (const a of G.actors) a.removeFromScene();
    G.actors.length = 0;
    this.player = G.player = null;
    this.ch = null;
    this.state = 'menu';
    this.ui.hideHUD();
    this.ui.closeAll();
    this.ui.showMainMenu();
    this.audio.setMood('menu');
    this.input.exitLock();
  }

  // ------------------------------------------------------------ spawning
  spawnEnemy(type, pos, opts = {}) {
    const e = new Enemy(type, pos, opts);
    if (!e.dummy && !e.localOnly) e.netId = this.nextNetId++;
    G.actors.push(e);
    return e;
  }

  // LAN guest: local replica of an enemy owned by the host
  spawnProxy(type, netId, x, y, z) {
    if (!ENEMIES[type]) return null;
    const e = new Enemy(type, new THREE.Vector3(x, y, z), { netProxy: true, netId });
    G.actors.push(e);
    return e;
  }

  // Every living player character: ours plus LAN friends.
  playerActors() {
    const out = [];
    if (this.player && !this.player.dead) out.push(this.player);
    for (const a of this.net.avatars.values()) if (!a.dead && a.netPos) out.push(a);
    return out;
  }

  onEnterHostMode() {
    for (const a of G.actors) if (a.team !== 'player' && a.team !== 'npc' && a.netId == null && !a.dummy && !a.localOnly && !a.netProxy) a.netId = this.nextNetId++;
  }

  // Joining someone else's world: their game owns the enemies now.
  onEnterGuestMode() {
    for (const a of G.actors) {
      if (a.team !== 'player' && a.team !== 'npc' && !a.isRemote && !a.dummy && !a.localOnly && !a.netProxy) a.despawn = true;
    }
    for (const s of this.spawners) {
      s.alive = [];
      s.active = false;
    }
    if (this.bossActive) this.endBoss(this.bossActive, false);
  }

  onLeaveGuestMode() {
    for (const s of this.spawners) {
      s.alive = [];
      s.active = false;
    }
    if (this.bossActive) this.endBoss(this.bossActive, false);
  }

  spawnNPCs() {
    for (const d of NPCS) this.npcs.push(new NPC(d));
  }

  // ------------------------------------------------------------ items
  giveItem(id, n = 1, silent = false) {
    if (WEAPONS[id] && !ITEMS[id]) return this.giveWeapon(id);
    const inv = this.ch.inventory.items;
    inv[id] = (inv[id] || 0) + n;
    if (id === 'waterskin') this.ch.waterCharges = (this.ch.waterCharges || 0) + 4 * n;
    if (!silent) this.ui.toast(`+ ${n > 1 ? n + ' ' : ''}${ITEMS[id] ? ITEMS[id].name : id}`, 'loot');
    this.quests.onItem(id);
    this.ui.refreshHotbar();
  }
  takeItem(id, n = 1) {
    const inv = this.ch.inventory.items;
    if ((inv[id] || 0) < n) return false;
    inv[id] -= n;
    if (inv[id] <= 0) delete inv[id];
    this.quests.onItem(id);
    this.ui.refreshHotbar();
    return true;
  }
  giveWeapon(id, enchant = null) {
    const item = { uid: 'w' + Date.now().toString(36) + uid(), id, enchant };
    this.ch.inventory.weapons.push(item);
    const w = WEAPONS[id];
    this.ui.toast(`+ ${w.name}`, 'loot');
    return item;
  }
  giveOutfit(id) {
    if (!this.ch.inventory.outfits.includes(id)) this.ch.inventory.outfits.push(id);
    this.ui.toast(`+ ${OUTFITS[id].name}`, 'loot');
  }

  // ------------------------------------------------------------ combat events
  onEnemyKilled(e, killer) {
    const p = this.player;
    if (!p || e.illusion || e.dummy) return;
    const s = e.spec;
    const near = p.pos.distanceTo(e.pos) < 60;
    if (!near && killer !== p) return;
    if (ACTIONS.onActorKilled) ACTIONS.onActorKilled(e, killer);
    // Credit a distinct boss before drops trigger quest checks, including ranged kills.
    if (s.boss && !this.ch.bossesDefeated.includes(e.type)) this.ch.bossesDefeated.push(e.type);
    const lvlDiff = p.level - e.level;
    const xpMul = clamp(1 - Math.max(0, lvlDiff - 3) * 0.15, 0.1, 1);
    p.addXp(s.xp * xpMul * (e.gripped ? 1.25 : 1));
    const silver = Math.round(rand(s.silver[0], s.silver[1] + 1) * p.derived.silverMul * (e.gripped ? 1.25 : 1));
    if (silver > 0) {
      p.addSilver(silver);
      this.ui.toast(`+ ${silver} silver`, 'silver');
      this.audio.play('coin', { vol: 0.5 });
    }
    for (const d of s.drops || []) {
      if (!chance(d.chance)) continue;
      const n = d.count ? randInt(d.count[0], d.count[1]) : 1;
      if (d.outfit) {
        if (!this.ch.inventory.outfits.includes(d.outfit)) this.giveOutfit(d.outfit);
      } else if (d.weapon) {
        const en = chance(0.25) ? choice(Object.keys(ENCHANTS)) : null;
        this.giveWeapon(d.id, WEAPONS[d.id].enchant ? null : en);
      } else this.giveItem(d.id, n);
    }
    if (s.outfitDrop) this.giveOutfit(s.outfitDrop);
    this.ch.stats.kills++;
    this.quests.onKill(e.type);
  }

  startBoss(e) {
    this.bossActive = e;
    this.ui.showBoss(e);
    this.audio.setScene({ boss: e.type, combatHeat: 1 });
    this.audio.play('roar', { pos: e.pos, pitch: 0.7 });
  }
  endBoss(e, killed) {
    if (this.bossActive !== e) return;
    this.bossActive = null;
    this.ui.hideBoss();
    this.mood = null;
    if (killed) {
      if (!this.ch.bossesDefeated.includes(e.type)) this.ch.bossesDefeated.push(e.type);
      this.ui.banner('FOE VANQUISHED');
      this.ui.toast(`${e.name} is vanquished.`, 'good');
      this.audio.play('bell');
      this.save();
    }
  }

  onFinalVictory() {
    setTimeout(() => this.ui.showVictory(), 2500);
  }

  hitStop(t) {
    this.hitStopT = Math.max(this.hitStopT, t);
  }

  // ------------------------------------------------------------ death / rift
  onPlayerDeath(src) {
    const p = this.player;
    const ch = this.ch;
    if (!p || !ch) return;
    const still = (fn) => () => {
      if (this.player === p && this.ch === ch && this.state === 'playing') fn();
    };
    ch.stats.deaths++;
    // part of what you carry stays where you fell, in a pouch anyone can search (game/loot.js);
    // a death in the Rift ends the character, so it keeps everything for the heirloom choice
    if (!this.inRift && ACTIONS.dropOnDeath) {
      try {
        ACTIONS.dropOnDeath(this);
      } catch (e) {
        console.error(e);
      }
    }
    this.audio.play('death');
    this.input.exitLock();
    this.ui.suppressPause = true;
    if (this.bossActive) {
      this.bossActive.dropAggro && this.bossActive.dropAggro();
    }
    if (!this.inRift) {
      this.ui.deathScreen('THE RIFT CLAIMS YOU', '', 3200, still(() => {
        this.transitioning = false;
        this.enterRift(true);
      }));
    } else {
      // A death in the Rift ends the character (the user's rule, 2026-10-16): the slot is emptied
      // and the character goes into the register before the death screen ends, so a reload can
      // neither recover it nor lose its legacy. Lives are spent only by fleeing in danger.
      ch.dangerQuit = false;
      const abyss = src && /abyss/i.test(src.name || '');
      const cause = abyss ? 'Claimed by the Abyss' : src ? `Slain by ${src.name}` : 'Lost in the Rift';
      this.loseCharacter(ch, cause);
      this.ui.deathScreen('YOUR LIGHT GOES OUT', '', 3500, still(() => this.wipe(cause)));
    }
  }

  enterRift(fromDeath = false) {
    if (this.transitioning || !this.player) return;
    this.transitioning = true;
    const p = this.player;
    const pos = new THREE.Vector3(RIFT_SPAWN.x + rand(-3, 3), 0, RIFT_SPAWN.z + rand(-3, 3));
    pos.y = this.world.groundAt(pos.x, pos.z, 200) + 0.2;
    this.ui.fade(() => {
      this.transitioning = false;
      if (this.player !== p || this.state !== 'playing') return;
      if (p.boat) p.leaveBoat();
      p.revive(pos, fromDeath ? 1 : p.hp / p.maxHp); // a surface death wakes here whole
      this.inRift = true;
      if (fromDeath) this.ch.sanity = p.maxSanity;
      this.camYaw = 0;
      this.areaName = null;
      this.ui.suppressPause = false;
      this.input.requestLock();
      this.audio.play('portal');
      this.ui.banner('THE RIFT');
      this.ui.toast(fromDeath ? 'Climb the Ascent to leave. Die here and the character is lost.' : 'The Ascent is the only door home.', fromDeath ? 'bad' : '');
      this.transitioning = false;
      this.save();
    });
  }

  exitRift(fromDeath = false) {
    if (this.transitioning || !this.player) return;
    this.transitioning = true;
    const p = this.player;
    const sp = this.ch.spawn || DEFAULT_RESPAWN;
    const anchored = Number.isFinite(sp.y);
    const pos = new THREE.Vector3(sp.x + (anchored ? 0 : rand(-1.5, 1.5)), 0, sp.z + (anchored ? 0 : rand(-1.5, 1.5)));
    const floor = anchored ? sp.y : this.world.terrain.heightAt(pos.x, pos.z) + 1;
    pos.y = this.world.groundAt(pos.x, pos.z, floor + 0.6) + 0.2;
    this.ui.fade(() => {
      this.transitioning = false;
      if (this.player !== p || this.state !== 'playing') return;
      p.revive(pos, fromDeath ? 1 : Math.max(0.3, p.hp / p.maxHp));
      if (!fromDeath) this.ch.stats.riftEscapes = (this.ch.stats.riftEscapes || 0) + 1;
      this.inRift = false;
      this.areaName = null;
      this.ui.suppressPause = false;
      this.input.requestLock();
      this.audio.play('portal');
      if (!fromDeath) this.ui.banner('THE SURFACE');
      this.transitioning = false;
      this.save();
    });
  }

  // The last name-knot is spent: the slot is emptied and the character goes into the register
  // of the lost (core/legacy.js), once.
  loseCharacter(ch, cause) {
    ch.wiped = true;
    Save.clearCharacter();
    return Legacy.record(ch, cause, Save.slot);
  }

  wipe(cause) {
    const ch = this.ch;
    const entry = this.loseCharacter(ch, cause);
    this.net.disconnect(true);
    this.pendingNet = null;
    for (const a of G.actors) a.removeFromScene();
    G.actors.length = 0;
    this.player = G.player = null;
    this.state = 'menu';
    this.ui.hideHUD();
    this.ui.showWipe({ name: ch.name, race: RACE_BY_ID[ch.race].name, level: ch.level, cause, kills: ch.stats.kills, entry });
    this.ch = null;
    this.ui.suppressPause = false;
  }

  // ------------------------------------------------------------ interaction
  findInteractable() {
    const p = this.player;
    if (!p || p.knocked || p.dead) return null;
    let best = null;
    let bd = Infinity;
    const consider = (obj, d) => {
      if (d < bd) {
        bd = d;
        best = obj;
      }
    };
    if (p.boat) return null;
    for (const n of this.npcs) {
      if (n.hidden) continue;
      const d = n.pos.distanceTo(p.pos);
      if (d < 3.2) consider({ kind: 'npc', npc: n, label: `Talk to ${n.name}` }, d);
    }
    for (const it of this.world.interactables) {
      if (it.enabled && !it.enabled()) continue;
      const d = it.pos.distanceTo(p.pos);
      if (d < it.radius) consider(it, d);
    }
    for (const b of this.boats) {
      const d = b.pos.distanceTo(p.pos);
      const seat = b.netProxy ? this.net.passengerSeat(b) >= 0 : b.freeSeat ? b.freeSeat() >= 0 : !b.driver;
      if (d < 4.5 && seat) consider({ kind: 'boat', boat: b, label: b.driver ? 'Board as Passenger' : 'Board Boat' }, d);
    }
    for (const a of G.actors) {
      if (a.knocked && !a.dead && (a.team === 'enemy' || a.team === 'guard')) {
        const d = a.pos.distanceTo(p.pos);
        if (d < 3) consider({ kind: 'grip', label: `Grip ${a.name} [B]`, passive: true }, d + 0.5);
      }
    }
    return best;
  }

  interact(it) {
    const p = this.player;
    const ch = this.ch;
    switch (it.kind) {
      case 'npc':
        this.quests.onTalk(it.npc.id);
        this.ui.openDialogue(it.npc);
        break;
      case 'well': {
        ch.water = 100;
        const skins = ch.inventory.items.waterskin || 0;
        ch.waterCharges = skins * 4;
        this.audio.play('drink', { pos: p.pos });
        this.ui.toast(skins ? 'You drink deeply and refill your waterskins.' : 'You drink deeply.', 'good');
        break;
      }
      case 'campfire':
        this.ui.openCampfire(it);
        break;
      case 'altar':
        this.ui.openAltar();
        break;
      case 'board':
        this.ui.openBoard();
        break;
      case 'bell':
        this.audio.play('bell', { pos: it.pos });
        this.ui.toast('The bell tolls across Saltreach.');
        break;
      case 'chest':
        this.openChest(it.chest);
        break;
      case 'rift_gate':
        this.exitRift(false);
        break;
      case 'boat':
        p.enterBoat(it.boat);
        this.ui.toast('W/S throttle · A/D steer · Shift to go fast · E to disembark');
        break;
      default:
        if (it.use) it.use(this, it);
        break;
    }
  }

  openChest(chest) {
    // what is inside is chosen from a panel (game/loot.js); the older take-all path stays below
    if (ACTIONS.openChestLoot) return ACTIONS.openChestLoot(chest);
    if (chest.opened) return;
    const loot = chest.def.loot;
    this.world.setChestOpened(chest.def.id, true);
    this.ch.chestsOpened.push(chest.def.id);
    this.audio.play('chest', { pos: chest.mesh.position });
    this.vfx.burst(chest.mesh.position.clone().add(new THREE.Vector3(0, 0.8, 0)), 'phys', 30, { color: '#ffd27a', speed: 5, up: 3 });
    const silver = Math.round(rand(loot.silver[0], loot.silver[1]) * this.player.derived.silverMul);
    if (silver) {
      this.player.addSilver(silver);
      this.ui.toast(`+ ${silver} silver`, 'silver');
    }
    for (const [id, n] of loot.items || []) this.giveItem(id, n);
    if (loot.weapon) this.giveWeapon(loot.weapon);
    this.save();
  }

  // An inn's room (a bed, or Old Wren's fire) sets where you wake if you fall, and that is all: no
  // sleep, no night passing, no healing (the user's call, 2026-10-16: as in Deepwoken). Nothing in
  // the Rift holds you, and nothing is settled in danger.
  rest(id, cost = 0) {
    const p = this.player;
    const ch = this.ch;
    if (p.inDanger) return this.ui.toast('Not while in danger.', 'bad');
    if (this.inRift) return this.ui.toast('Nothing in the Rift will hold you.', 'bad');
    if (cost && ch.silver < cost) return this.ui.toast('Not enough silver.', 'bad');
    ch.silver -= cost;
    const it = this.world.interactables.find((x) => x.id === id);
    const pos = it ? it.pos : p.pos;
    ch.spawn = { id, x: pos.x, y: pos.y, z: pos.z };
    this.ui.toast('You will wake here if you fall.', 'good');
    this.save();
  }

  cook() {
    const inv = this.ch.inventory.items;
    let cooked = 0;
    for (const id of Object.keys(inv)) {
      const it = ITEMS[id];
      if (it && it.cook) {
        const n = inv[id];
        delete inv[id];
        this.giveItem(it.cook, n, true);
        cooked += n;
      }
    }
    if (cooked) {
      this.audio.play('ember', { vol: 0.4 });
      this.ui.toast(`Cooked ${cooked} item${cooked > 1 ? 's' : ''}.`, 'good');
    } else this.ui.toast('You have nothing to cook.');
    this.ui.refreshHotbar();
  }

  // Dock teleports / booked ferry passage are gone — rent a boat and sail.
  travel(dockId) {
    this.ui.openFerry(dockId);
  }

  rentBoat(dockId) {
    const ch = this.ch;
    if (ch.silver < 20) return this.ui.toast('Not enough silver.', 'bad');
    const dock = this.world.docks[dockId];
    if (!dock) return;
    ch.silver -= 20;
    // replace our previous rental, but keep friends' synced boats
    for (const old of this.boats.filter((x) => !x.netProxy)) old.dispose();
    const pos = dock.end.clone().add(new THREE.Vector3(dock.dir.z * 3, 0, -dock.dir.x * 3));
    const b = new Boat(pos, dock.yaw);
    this.boats = [...this.boats.filter((x) => x.netProxy), b];
    this.audio.play('coin');
    this.ui.toast('Your boat is moored at the end of the dock.', 'good');
  }

  // Soft aim assist targets monsters, plus guards that are fighting us.
  isFoe(a) {
    return a.team === 'enemy' || (a.team === 'guard' && !!a.hostileTo && a.hostileTo(this.player));
  }

  // ------------------------------------------------------------ aiming
  getAim(range = 30) {
    const cam = this.camera;
    const p = this.player;
    const dir = cam.getWorldDirection(new THREE.Vector3());
    let target = null;
    let best = 0.12;
    for (const a of G.actors) {
      if (a === p || a.dead || a.knocked || !this.isFoe(a)) continue;
      const to = a.center(_v).sub(cam.position);
      const dist = a.pos.distanceTo(p.pos);
      if (dist > range + 4) continue;
      const ang = to.normalize().angleTo(dir);
      if (ang < best) {
        best = ang;
        target = a;
      }
    }
    let point = null;
    const th = this.world.terrain.raycast(cam.position, dir, 140, 1);
    const cd = this.world.colliders.raycast(cam.position.x, cam.position.y, cam.position.z, dir.x, dir.y, dir.z, 140);
    const dist = Math.min(th ? th.dist : Infinity, cd);
    if (dist < 140) point = cam.position.clone().addScaledVector(dir, dist);
    else point = cam.position.clone().addScaledVector(dir, this.camDist + range);
    const from = p.center(_v2);
    const aimDir = (target ? target.center() : point).clone().sub(from).normalize();
    return { dir: aimDir, point, target };
  }

  // Mouse look is applied once, before the simulation, so movement uses this frame's aim.
  readLook() {
    if (!(this.state === 'playing' && this.player && this.controlsEnabled())) return;
    const I = this.input;
    const s = this.settings;
    const sens = 0.0012 * (s.sensitivity || 1);
    this.camYaw -= I.dx * sens;
    this.camPitch += I.dy * sens * (s.invertY ? -1 : 1);
    this.camPitch = clamp(this.camPitch, -1.1, 1.25);
    this.camYaw = angleWrap(this.camYaw);
    if (I.wheel) this.camDist = clamp(this.camDist + I.wheel * 0.8, 2.2, 14);
    I.dx = 0;
    I.dy = 0;
    I.wheel = 0;
  }

  // ------------------------------------------------------------ camera
  updateCamera(dt) {
    const cam = this.camera;
    // debug free camera for screenshots: __unstable.debugCam = { pos: [x,y,z], look: [x,y,z] }
    if (this.debugCam) {
      cam.position.set(...this.debugCam.pos);
      cam.lookAt(...this.debugCam.look);
      return;
    }
    if (this.world.beauty?.preview && this.state !== 'playing') {
      this.world.beauty.applyPreview(cam);
      return;
    }
    if (this.state === 'playing' && this.player) {
      const p = this.player;
      const focus = _v.set(p.pos.x, p.pos.y + (p.boat ? 2.2 : 1.6), p.pos.z);
      if (p.knocked) focus.y -= 1;
      const fx = Math.sin(this.camYaw);
      const fz = Math.cos(this.camYaw);
      const cp = Math.cos(this.camPitch);
      const sp = Math.sin(this.camPitch);
      const dist = this.camDist * (p.boat ? 1.8 : 1);
      const side = 0.4; // over-the-right-shoulder offset; right vector = (-fz, 0, fx)
      const desired = _v2.set(focus.x - fx * cp * dist - fz * side, focus.y + sp * dist, focus.z - fz * cp * dist + fx * side);
      const orbit = cameraOrbit(this.world, focus, desired);
      const allowed = orbit.allowed;
      if (this._camAllowed == null || allowed < this._camAllowed) this._camAllowed = allowed;
      else this._camAllowed += (allowed - this._camAllowed) * (1 - Math.exp(-10 * dt));
      const target = focus.clone().addScaledVector(orbit.direction, Math.min(allowed, this._camAllowed));
      this.camPos.copy(target);
      cam.position.copy(target);
      const camD = cam.position.distanceTo(focus);
      if (p.model?.setOpacity && p.stealth <= 0) p.model.setOpacity(clamp((camD - 0.4) / 1.15, 0.18, 1));
      const so = Math.min(side, this._camAllowed * 0.1);
      cam.lookAt(focus.x - fz * so, focus.y, focus.z + fx * so);
    } else {
      // menu orbit
      this.menuT += dt * 0.03;
      const c = new THREE.Vector3(0, 8, 0);
      cam.position.set(Math.sin(this.menuT) * 95, 34 + Math.sin(this.menuT * 1.7) * 6, Math.cos(this.menuT) * 95);
      cam.lookAt(c);
    }
    const sh = this.vfx.shake;
    if (sh > 0) {
      const px = cam.position.x;
      const py = cam.position.y;
      const pz = cam.position.z;
      cam.position.x += (Math.random() - 0.5) * sh * 0.5;
      cam.position.y += (Math.random() - 0.5) * sh * 0.5;
      cam.position.z += (Math.random() - 0.5) * sh * 0.5;
      const col = this.world && this.world.colliders;
      if (col && col.pointInside(cam.position.x, cam.position.y, cam.position.z)) cam.position.set(px, py, pz);
    }
  }

  // ------------------------------------------------------------ main loop
  frame(now) {
    requestAnimationFrame((t) => this.frame(t));
    let realDt = (now - this.last) / 1000;
    this.last = now;
    if (!(realDt > 0)) realDt = 0.016;
    this.readLook();
    const paused = this.state === 'playing' && this.ui.isPaused();

    const guard = (name, fn) => {
      try {
        fn();
      } catch (e) {
        this.reportError(name, e);
      }
    };
    guard('simulation', () => {
      if (this.state === 'playing' && this.player && !paused) {
        // Catch up in fixed slices so a long frame slows the renderer, not the fight.
        const budget = Math.min(realDt, 0.25);
        const step = 1 / 30;
        let left = budget;
        let first = true;
        this.spawnBudget = SPAWNS_PER_FRAME; // per frame, so catch-up steps do not spawn in bursts
        while (left > 1e-4) {
          let dt = Math.min(step, left);
          left -= dt;
          if (this.hitStopT > 0) {
            this.hitStopT = Math.max(0, this.hitStopT - dt);
            dt *= 0.06;
          }
          G.dt = dt;
          G.time += dt;
          this.updatePlaying(dt);
          if (first) {
            this.input.swallowEdges();
            first = false;
          }
        }
      } else if (this.state === 'menu') {
        const dt = Math.min(realDt, 0.05);
        this.world.update(dt, this.camera.position);
        this.world.sky.update(dt * 4, this.camera.position, this.camera, false);
        this.world.beauty?.update(dt, this.camera, false, this.camera.position);
        for (const n of this.npcs) n.update(dt);
      }
    });
    const vis = Math.min(realDt, 0.1);
    guard('network', () => this.net && this.net.update(vis));
    guard('camera', () => this.updateCamera(vis));
    guard('effects', () => this.vfx.update(vis, this.camera));
    guard('water', () => {
      this.world.water.update(G.time, this.camera, this.world.sky.sunDir, this.world.sky.sun.color, this.world.sky.skyColor, this.world.sky.light);
      this.world.water.mesh.visible = !(this.inRift && this.state === 'playing');
      this.world.terrain.seabed.visible = this.world.water.mesh.visible;
    });
    guard('audio', () => this.audio.update(vis));
    guard('ui', () => this.ui.update(vis));
    guard('render', () => {
      this.world.placeLentLights();
      this.warmup.step(this.player ? this.player.pos : this.camera.position, vis);
      // low quality skips post-processing entirely (no bloom, rays or grade)
      if (this.settings.quality === 'low') this.renderer.render(this.scene, this.camera);
      else this.composer.render();
      this.warmup.endFrame();
    });
    this.input.endFrame();
  }

  // Errors never stop the loop; surface them (rate-limited) so they can be reported.
  reportError(where, e) {
    console.error(`[${where}]`, e);
    const now = performance.now();
    if (now - (this._lastErr || 0) > 8000) {
      this._lastErr = now;
      try {
        this.ui.toast(`Something went wrong (${where}): ${e && e.message ? e.message : e}`, 'bad');
      } catch (_) {
        /* ignore */
      }
    }
  }

  // Soft body collision between living actors (player included), weighted by size.
  separateActors(dt) {
    const list = G.actors;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (a.dead || a.flying || a.aquatic) continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (b.dead || b.flying || b.aquatic) continue;
        const dx = a.pos.x - b.pos.x;
        const dz = a.pos.z - b.pos.z;
        const min = bodyRadius(a) + bodyRadius(b);
        const d2 = dx * dx + dz * dz;
        if (d2 >= min * min || Math.abs(a.pos.y - b.pos.y) > 1.6) continue;
        let d = Math.sqrt(d2);
        let nx = dx / (d || 1);
        let nz = dz / (d || 1);
        if (d < 1e-4) {
          nx = 1;
          nz = 0;
          d = 0;
        }
        const overlap = min - d;
        const mass = (x) => (x.boss ? 8 : x === this.player ? 5 : x.radius * x.radius);
        const ma = mass(a);
        const mb = mass(b);
        const fixedA = a.knocked || a.dummy || a.isRemote || a.netProxy;
        const fixedB = b.knocked || b.dummy || b.isRemote || b.netProxy;
        const fa = fixedA ? 0 : fixedB ? 1 : mb / (ma + mb);
        const fb = fixedB ? 0 : fixedA ? 1 : ma / (ma + mb);
        const k = 1;
        const ax = nx * overlap * fa * k;
        const az = nz * overlap * fa * k;
        const bx = -nx * overlap * fb * k;
        const bz = -nz * overlap * fb * k;
        a.pos.x += ax;
        a.pos.z += az;
        b.pos.x += bx;
        b.pos.z += bz;
        const beforeA = a.pos.clone?.();
        const beforeB = b.pos.clone?.();
        if (this.world?.colliders) {
          this.world.colliders.resolve(a.pos, a.radius, a.height);
          this.world.colliders.resolve(b.pos, b.radius, b.height);
        }
        // The mesh was posed before the resolve; slide it with the body.
        if (a.model) {
          a.model.root.position.x += ax + (beforeA ? a.pos.x - beforeA.x : 0);
          a.model.root.position.z += az + (beforeA ? a.pos.z - beforeA.z : 0);
        }
        if (b.model) {
          b.model.root.position.x += bx + (beforeB ? b.pos.x - beforeB.x : 0);
          b.model.root.position.z += bz + (beforeB ? b.pos.z - beforeB.z : 0);
        }
      }
    }
  }

  // Debug helper: advance the simulation without rendering (used by automated tests).
  simulate(seconds, step = 1 / 60) {
    const n = Math.round(seconds / step);
    for (let i = 0; i < n; i++) {
      this.readLook();
      G.dt = step;
      G.time += step;
      this.spawnBudget = SPAWNS_PER_FRAME;
      if (this.state === 'playing' && this.player && !this.ui.isPaused()) this.updatePlaying(step);
      this.net.update(step);
      this.updateCamera(step);
      this.vfx.update(step, this.camera);
      this.ui.update(step);
      this.input.endFrame();
    }
  }

  // [E] uses what is in reach. Aboard a boat it is the player's own (leave the boat, as the
  // prompts say), so it is left for Player.update; before, this ate it and only Space left.
  useInteractKey() {
    const p = this.player;
    if (p.boat || !this.input.consume('interact')) return;
    const it = this.findInteractable();
    if (it && !it.passive) this.interact(it);
  }

  updatePlaying(dt) {
    const p = this.player;
    const I = this.input;
    this.ch.stats.playtime += dt;

    if (this.controlsEnabled()) {
      this.useInteractKey();
      if (I.consume('menu')) this.ui.openCharMenu();
      if (I.consume('map')) this.ui.openMap();
    }

    p.update(dt);
    const players = this.playerActors();
    const nearAnyone = (a) => {
      for (const q of players) if (Math.abs(a.pos.x - q.pos.x) < 160 && Math.abs(a.pos.z - q.pos.z) < 160) return true;
      return false;
    };
    for (let i = G.actors.length - 1; i >= 0; i--) {
      const a = G.actors[i];
      if (a === p) continue;
      const simulate = a.isRemote || a.netProxy || a.aggro || nearAnyone(a);
      if (simulate) a.update(dt);
      if (a.model) a.model.root.visible = Math.abs(a.pos.x - p.pos.x) < 160 && Math.abs(a.pos.z - p.pos.z) < 160;
      if (a.dead && !a.isRemote) {
        a.removeT -= dt;
        if (a.removeT <= 0) {
          a.removeFromScene();
          G.actors.splice(i, 1);
          continue;
        }
      }
      if (a.despawn) {
        a.removeFromScene();
        G.actors.splice(i, 1);
      }
    }
    this.separateActors(dt);
    runUpdateHooks(this, dt);
    for (const n of this.npcs) n.update(dt);
    for (const b of this.boats) b.update(dt);
    updateProjectiles(dt);
    updateTimers(dt);
    if (!this.net.isGuest) {
      const pts = players.map((q) => q.pos);
      if (!pts.length) pts.push(p.pos);
      for (const s of this.spawners) s.update(dt, pts);
    }
    this.world.update(dt, p.pos);
    this.world.sky.update(dt, p.pos, this.camera, this.inRift);
    this.world.beauty?.update(dt, this.camera, this.inRift, p.pos);

    // region / adaptive score
    const loc = this.world.locationAt(p.pos.x, p.pos.z);
    const isl = this.world.islandAt(p.pos.x, p.pos.z);
    // dry ground between named places goes by its region's name, not the open sea's
    const ashore = !this.inRift && isl && !p.boat && this.world.terrain.heightAt(p.pos.x, p.pos.z) > 0;
    const name = loc ? loc.name : this.inRift ? 'The Rift' : ashore ? landNameAt(p.pos.x, p.pos.z) : 'The Open Sea';
    if (name !== this.areaName) {
      if (this.ui.bannerT <= 0) this.ui.areaBanner(name);
      this.areaName = name;
    }
    let threat = 0;
    for (const a of G.actors) {
      if (!a.aggro || a.dead) continue;
      if (a.pos.distanceTo(p.pos) < 42) threat++;
    }
    let heat = 0;
    if (this.bossActive) heat = 1;
    else if (p.inDanger && threat > 0) {
      heat = clamp(0.32 + threat * 0.14 + (1 - p.hp / Math.max(1, p.maxHp)) * 0.38, 0, 1);
    }
    const region = isl && moodRegionAt(p.pos.x, p.pos.z);
    this.audio.setScene({
      island: isl && isl.id,
      region: region && region.id,
      biome: isl && isl.biome,
      inRift: this.inRift,
      night: this.world.sky.isNight(),
      combatHeat: heat,
      boss: this.bossActive ? this.bossActive.type : null,
      sanity: this.ch.sanity / Math.max(1, p.maxSanity),
    });

    // falling into the void of the Rift
    if (this.inRift && p.pos.y < -50 && !p.dead && !this.transitioning) {
      p.hp = 0;
      p.die(null);
    }
    // deep ocean predators
    this.sharkT -= dt;
    if (this.sharkT <= 0 && !this.net.isGuest) {
      this.sharkT = 6;
      for (const sw of players) {
        if (!sw.swimming || !this.world.isDeepOcean(sw.pos.x, sw.pos.z)) continue;
        const sharks = G.actors.filter((a) => a.type === 'gnashfin' && !a.dead && a.pos.distanceTo(sw.pos) < 60);
        if (sharks.length >= 2) continue;
        const a = Math.random() * Math.PI * 2;
        const pos = new THREE.Vector3(sw.pos.x + Math.cos(a) * 30, -0.35, sw.pos.z + Math.sin(a) * 30);
        const e = this.spawnEnemy('gnashfin', pos);
        e.setAggro(sw);
        if (sw === p) this.ui.toast('Something circles beneath you...', 'bad');
      }
      // (a world event's own sharks are its to dismiss: game/seaLife.js)
      for (const a of G.actors) if (a.type === 'gnashfin' && !a.netProxy && !a.lifeEvent && !players.some((q) => a.pos.distanceTo(q.pos) < 120)) a.despawn = true;
    }
    // hallucinations
    if (this.inRift && this.ch.sanity < p.maxSanity * 0.3) {
      this.hallucT -= dt;
      if (this.hallucT <= 0) {
        this.hallucT = rand(10, 18);
        const a = Math.random() * Math.PI * 2;
        const pos = new THREE.Vector3(p.pos.x + Math.cos(a) * 14, 0, p.pos.z + Math.sin(a) * 14);
        pos.y = this.world.groundAt(pos.x, pos.z, p.pos.y + 10);
        const e = this.spawnEnemy('hallucination', pos);
        e.setAggro(p);
        setTimeout(() => {
          if (!e.dead && G.actors.includes(e)) e.dispel();
        }, 15000);
        this.audio.play('whisper', { pos });
      }
    }

    // autosave
    this.saveT += dt;
    if (this.saveT > 30 && !p.inDanger && !p.dead && !p.knocked) {
      this.saveT = 0;
      this.save();
    }

    // interaction prompt
    const it = this.findInteractable();
    this.ui.setPrompt(it ? it.label : null);
  }
}

export { VOWS, ATTRS, RIFT_ORIGIN };
