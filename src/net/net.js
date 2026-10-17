// LAN co-op client.
//
// Authority model:
//  - The HOST's game owns the world: enemies, bosses, spawners, enemy projectiles.
//  - Every player owns their own character (movement, defense, HP, inventory).
//  - Guests see enemies as "proxies" (Enemy instances with AI disabled) driven by
//    host snapshots + attack events. Their hits on proxies are sent to the host,
//    which applies them and replies with the outcome. Enemy hits on a guest are
//    forwarded to that guest, whose game resolves parry/block/dodge locally.
import * as THREE from 'three';
import { G } from '../core/globals.js';
import { RemotePlayer, PF } from '../entities/remotePlayer.js';
import { applyHit, netHitFeedback } from '../combat/combat.js';
import { traitOnParry } from '../combat/weaponTraits.js';
import { Boat } from '../entities/boat.js';

const STATE_INTERVAL = 1 / 20;
const SNAP_INTERVAL = 1 / 12;
const RELEVANCE = 230;

export const EF = { dead: 1, knocked: 2, aggro: 4, blocking: 8, stunned: 16, enraged: 32, guardBroken: 64 };
const SF = { burn: 1, chill: 2, freeze: 4, shock: 8, bleed: 16, blind: 32 };
const HIT_KEYS = ['dmg', 'posture', 'element', 'unparryable', 'unblockable', 'knockback', 'launch', 'status', 'kind', 'crit', 'heavy', 'sanity', 'stun', 'noInterrupt', 'statusPower', 'mantra', 'finisher',
  // the systems round: the uppercut and air string, weapon handling and traits, running attacks
  'launcher', 'upper', 'spike', 'running', 'chip', 'pen', 'trait'];
const r2 = (v) => Math.round(v * 100) / 100;
// The talent and resonance flags of a guest that the host reads: in resolving the guest's blows,
// and in its enemies' AI towards the guest's avatar (stealth, intimidate). tests/lan-systems.test.js
// checks this against the code that reads them.
export const GUEST_MODS = ['exploit', 'shatterpoint', 'ignition', 'burnDur', 'chillPower', 'shockDur', 'bleedDmg', 'stealth', 'backstab', 'bullRush',
  'crushingBlows', 'boneCrusher', 'arcaneMastery', 'conductor', 'shroud', 'tacet', 'glacialCore', 'conflagration', 'duskShroud', 'intimidate'];

export class Net {
  constructor(game) {
    this.game = game;
    this.ws = null;
    this.status = 'offline'; // offline | connecting | online
    this.role = null;
    this.id = null;
    this.hostId = null;
    this.avatars = new Map(); // peerId -> RemotePlayer
    this.proxies = new Map(); // netId -> Enemy (guest only)
    this.stateT = 0;
    this.snapT = 0;
    this.lastInfo = '';
    this.netBoats = new Map(); // `${ownerPeer}:${boatId}` -> proxy Boat
    this.sentBoats = new Map(); // our boats as last broadcast (to announce dockings after disposal)
  }

  get active() {
    return this.status === 'online';
  }
  get isHost() {
    return this.active && this.role === 'host';
  }
  get isGuest() {
    return this.active && this.role === 'guest';
  }
  get playerCount() {
    return this.active ? this.avatars.size + 1 : 1;
  }

  // ------------------------------------------------------------ connection
  connect(role) {
    if (this.ws) this.disconnect(true);
    const p = this.game.player;
    const name = p ? p.ch.name : 'Wanderer';
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${proto}://${location.host}/lan?role=${role}&name=${encodeURIComponent(name)}`;
    this.role = role;
    this.status = 'connecting';
    this.failReason = null;
    let ws;
    try {
      ws = new WebSocket(url);
    } catch (e) {
      this.status = 'offline';
      G.ui.toast("Couldn't open a LAN connection.", 'bad');
      return;
    }
    this.ws = ws;
    ws.onmessage = (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch (_) {
        return;
      }
      try {
        this.onMessage(msg);
      } catch (e) {
        this.game.reportError('network', e);
      }
    };
    ws.onclose = () => {
      if (this.ws === ws) this.onClosed();
    };
    ws.onerror = () => {};
    clearTimeout(this.connectTimer);
    this.connectTimer = setTimeout(() => {
      if (this.ws === ws && this.status === 'connecting') ws.close();
    }, 6000);
    G.ui.refreshLan && G.ui.refreshLan();
  }

  disconnect(silent = false) {
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      try {
        ws.close();
      } catch (_) {
        /* ignore */
      }
    }
    if (!silent && this.active) G.ui.toast('Left the LAN game.');
    this.cleanup();
  }

  onClosed() {
    const was = this.status;
    this.ws = null;
    if (this.failReason) G.ui.toast(this.failReason, 'bad');
    else if (was === 'connecting') G.ui.toast("Couldn't reach the LAN server. The host must start the game with `npm run lan`.", 'bad');
    else if (was === 'online') G.ui.toast('Disconnected from the LAN game.', 'bad');
    this.cleanup();
  }

  cleanup() {
    const wasGuest = this.role === 'guest' && this.status === 'online';
    clearTimeout(this.connectTimer);
    for (const a of this.avatars.values()) this.removeActor(a);
    this.avatars.clear();
    for (const pr of this.proxies.values()) this.removeActor(pr);
    this.proxies.clear();
    for (const key of [...this.netBoats.keys()]) this.removeNetBoat(key);
    for (const b of this.game.boats) if (b.occupants) b.occupants.forEach((o, i) => o && o.isRemote && (b.occupants[i] = null));
    this.status = 'offline';
    this.role = null;
    this.id = null;
    this.hostId = null;
    if (wasGuest) this.game.onLeaveGuestMode();
    G.ui.refreshLan && G.ui.refreshLan();
  }

  removeActor(a) {
    const i = G.actors.indexOf(a);
    if (i >= 0) G.actors.splice(i, 1);
    a.removeFromScene();
    if (this.game.bossActive === a) this.game.endBoss(a, false);
  }

  send(msg) {
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(msg));
  }

  // ------------------------------------------------------------ identity
  myInfo() {
    const p = this.game.player;
    if (!p) return null;
    const ch = p.ch;
    const it = p.weaponItem();
    const m = p.mods || {};
    const mods = {};
    for (const k of GUEST_MODS) if (m[k]) mods[k] = m[k];
    let ext;
    try {
      ext = this.game.netExt ? this.game.netExt() : undefined; // systems may attach small per-player data
    } catch (_) {
      ext = undefined;
    }
    return {
      name: ch.name, race: ch.race, look: ch.look, level: ch.level, outfit: ch.equipped.outfit, vow: ch.vow,
      weapon: { id: it ? it.id : 'fists', enchant: p.weaponEnchant() }, mods, ext,
    };
  }

  sendHello(to = null, reply = false) {
    const info = this.myInfo();
    if (!info) return;
    this.lastInfo = JSON.stringify(info);
    const msg = { t: 'hello', info, reply };
    if (to !== null) msg.to = to;
    this.send(msg);
  }

  // Called when equipment/stats change; only sends when something visible changed.
  sendInfo() {
    if (!this.active) return;
    const info = this.myInfo();
    if (!info) return;
    const s = JSON.stringify(info);
    if (s === this.lastInfo) return;
    this.lastInfo = s;
    this.send({ t: 'info', info });
  }

  // ------------------------------------------------------------ inbound
  onMessage(m) {
    switch (m.t) {
      case 'welcome':
        this.id = m.id;
        this.hostId = m.hostId;
        this.status = 'online';
        clearTimeout(this.connectTimer);
        if (this.role === 'guest') {
          this.game.onEnterGuestMode();
          const host = (m.peers || []).find((p) => p.id === m.hostId);
          G.ui.banner('CO-OP'); // banners show their title alone; the rest is a toast
          G.ui.toast(`You joined ${host ? host.name : 'the host'}'s world.`, 'good');
        } else {
          this.game.onEnterHostMode();
          G.ui.banner('CO-OP');
          G.ui.toast('You are hosting. Friends on your network can join now.', 'good');
        }
        this.sendHello();
        G.audio.play('bell', { vol: 0.5 });
        G.ui.refreshLan && G.ui.refreshLan();
        break;
      case 'error':
        this.failReason = m.msg;
        break;
      case 'join':
        G.ui.toast(`${m.name} joined the game.`, 'good');
        break;
      case 'hello':
        this.onHello(m);
        break;
      case 'info': {
        const a = this.avatars.get(m.from);
        if (a) a.applyInfo(m.info);
        break;
      }
      case 'leave': {
        for (const key of [...this.netBoats.keys()]) if (key.startsWith(m.id + ':')) this.removeNetBoat(key);
        const a = this.avatars.get(m.id);
        if (a) for (const b of this.game.boats) if (b.leave && !b.netProxy) b.leave(a);
        if (a) {
          this.removeActor(a);
          this.avatars.delete(m.id);
        }
        if (m.id !== this.id) G.ui.toast(`${m.name || 'A player'} left the game.`);
        G.ui.refreshLan && G.ui.refreshLan();
        break;
      }
      case 'hostLeft':
        if (this.isGuest) {
          G.ui.toast('The host left. Your world is your own again.', 'bad');
          this.disconnect(true);
        }
        break;
      case 'ps': {
        const a = this.avatars.get(m.from);
        if (a) a.applyState(m.s);
        break;
      }
      case 'atk': {
        const a = this.avatars.get(m.from);
        if (a) a.playAttack(m);
        break;
      }
      case 'cast': {
        const a = this.avatars.get(m.from);
        if (a) a.playCast(m, this);
        break;
      }
      case 'anim': {
        const a = this.avatars.get(m.from);
        if (a) a.playAnim(m);
        break;
      }
      case 'roll': {
        const a = this.avatars.get(m.from);
        if (a) a.roll(m.d);
        break;
      }
      case 'rollX': {
        // a roll cut short with F
        const a = this.avatars.get(m.from);
        if (a && a.model && a.model.anim) a.model.anim.roll = null;
        break;
      }
      case 'hold': {
        // a flourish: the avatar's swing waits at the top of its wind-up while the player holds it
        const a = this.avatars.get(m.from);
        if (a && a.atk) a.atk.hold = !!m.on;
        break;
      }
      // ---- boats (each player owns the boats they sail; others see proxies)
      case 'boats':
        this.applyBoats(m);
        break;
      case 'board':
        this.onBoardRequest(m);
        break;
      case 'boatDock': {
        const key = `${m.from}:${m.b}`;
        const b = this.netBoats.get(key);
        if (b) {
          b.dockPos = new THREE.Vector3().fromArray(m.d);
          this.removeNetBoat(key);
        }
        break;
      }
      case 'boardNo':
        this.onBoardRejected(m);
        break;
      case 'unboard':
        this.onUnboard(m);
        break;
      // ---- world (host -> guests)
      case 'snap':
        if (this.isGuest && m.from === this.hostId) this.applySnapshot(m);
        break;
      case 'eatk':
        if (this.isGuest) this.onEnemyAttack(m);
        break;
      case 'eanim':
        if (this.isGuest) this.onEnemyAnim(m);
        break;
      case 'kill':
        if (this.isGuest) this.onKill(m);
        break;
      case 'hitRes':
        if (this.isGuest) this.onHitResult(m);
        break;
      case 'hitYou':
        this.onHitYou(m);
        break;
      case 'gripped': {
        const p = this.game.player;
        if (p && p.knocked && !p.dead) p.getGripped(this.proxies.get(m.e) || this.fakeAttacker(null));
        break;
      }
      // ---- guest -> host
      case 'hit':
        if (this.isHost) this.onGuestHit(m);
        break;
      case 'parry':
        if (this.isHost) this.onGuestParry(m);
        break;
      case 'grip':
        if (this.isHost) this.onGuestGrip(m);
        break;
      default:
        // messages a game system registered for itself: G.netHandlers[type](msg, net)
        if (G.netHandlers && G.netHandlers[m.t]) G.netHandlers[m.t](m, this);
        break;
    }
  }

  onHello(m) {
    let a = this.avatars.get(m.from);
    if (!a) {
      a = new RemotePlayer(m.from, m.info);
      this.avatars.set(m.from, a);
      G.actors.push(a);
    } else a.applyInfo(m.info);
    if (!m.reply) this.sendHello(m.from, true);
    G.ui.refreshLan && G.ui.refreshLan();
  }

  // ------------------------------------------------------------ helpers
  enemyById(id) {
    if (id == null || id < 0) return null;
    if (this.isGuest) return this.proxies.get(id) || null;
    for (const a of G.actors) if (a.netId === id && !a.netProxy) return a;
    return null;
  }

  playerById(id) {
    if (id == null || id < 0) return null;
    if (id === this.id) return this.game.player;
    return this.avatars.get(id) || null;
  }

  // id that identifies an actor to other machines: enemies by netId, players by peer id
  targetId(t) {
    if (!t) return -1;
    if (t === this.game.player) return this.id;
    if (t.isRemote) return t.peerId;
    return -1;
  }

  serAim(aim) {
    if (!aim) return null;
    let tg = null;
    const t = aim.target;
    if (t && t.netId != null) tg = { e: t.netId };
    else if (t) tg = { p: this.targetId(t) };
    return { d: aim.dir.toArray().map(r2), p: aim.point ? aim.point.toArray().map(r2) : null, tg };
  }

  deAim(a, caster) {
    const dir = a && a.d ? new THREE.Vector3().fromArray(a.d) : new THREE.Vector3(Math.sin(caster.yaw), 0, Math.cos(caster.yaw));
    const point = a && a.p ? new THREE.Vector3().fromArray(a.p) : caster.pos.clone().addScaledVector(dir, 10);
    let target = null;
    if (a && a.tg) target = a.tg.e != null ? this.enemyById(a.tg.e) : this.playerById(a.tg.p);
    return { dir, point, target };
  }

  serHit(h) {
    const o = {};
    for (const k of HIT_KEYS) if (h[k] !== undefined && h[k] !== null) o[k] = h[k];
    if (h.projectile) {
      o.kind = 'proj';
      o.proj = true;
    }
    return o;
  }

  fakeAttacker(pos) {
    const p = pos ? new THREE.Vector3().fromArray(pos) : this.game.player.pos.clone().add(new THREE.Vector3(0, 0, 2));
    return {
      name: 'Something', team: 'enemy', level: 1, mods: {}, pos: p, yaw: 0, radius: 0.5, height: 1.8,
      center: () => p.clone().add(new THREE.Vector3(0, 1, 0)), getParried() {}, onDealtHit() {},
    };
  }

  // ------------------------------------------------------------ local events -> network
  localAttack(d) {
    if (!this.active) return;
    if (d.mantra) {
      const c = this.game.player._lastCast;
      this.send({ t: 'cast', m: d.mantra, stars: c ? c.stars : 0, aim: this.serAim(c && c.aim) });
      return;
    }
    this.send({
      t: 'atk', a: d.anim, w: r2(d.windup), ac: r2(d.active), r: r2(d.recovery), range: d.range, arc: d.arc, hits: d.hits || 1,
      unp: !!d.unparryable, unb: !!d.unblockable, crit: !!d.crit, sound: d.sound, pitch: d.pitch, shock: d.shockwave || 0, fl: d.flourish ? 1 : 0,
    });
  }

  localEvent(msg) {
    if (this.active) this.send(msg);
  }

  // A local hit landed on a proxy (guest): the host decides what it did.
  sendHit(att, tgt, h) {
    if (att !== this.game.player) return;
    const from = h.from || att.pos;
    this.send({ t: 'hit', to: this.hostId, e: tgt.netId, h: this.serHit(h), f: [r2(from.x), r2(from.y), r2(from.z)] });
  }

  // Host: one of our enemies hit a remote player; their game resolves it.
  forwardHit(att, tgt, h) {
    const from = h.from || att.pos;
    this.send({
      t: 'hitYou', to: tgt.peerId, e: att.netId != null ? att.netId : -1, h: this.serHit(h),
      f: [r2(from.x), r2(from.y), r2(from.z)], ap: att.pos ? [r2(att.pos.x), r2(att.pos.y), r2(att.pos.z)] : null,
    });
  }

  enemyAttack(e, def) {
    if (!this.isHost || e.netId == null || !def.netKey) return;
    this.send({ t: 'eatk', e: e.netId, k: def.netKey, tg: this.targetId(e.target) });
  }

  enemyAnim(e, a, extra = {}) {
    if (!this.isHost || e.netId == null) return;
    this.send(Object.assign({ t: 'eanim', e: e.netId, a }, extra));
  }

  enemyDied(e, killer) {
    if (!this.isHost || e.netId == null) return;
    this.send({ t: 'kill', e: e.netId, g: !!e.gripped, k: this.targetId(killer) });
  }

  // ------------------------------------------------------------ host handlers
  onGuestHit(m) {
    const av = this.avatars.get(m.from);
    const en = this.enemyById(m.e);
    let res = 'none';
    let dmg = 0;
    if (av && en && !en.dead) {
      const hp0 = en.hp;
      const h = Object.assign({}, m.h, { fromNet: true, from: new THREE.Vector3().fromArray(m.f) });
      res = applyHit(av, en, h);
      dmg = Math.max(0, hp0 - Math.max(0, en.hp));
    }
    this.send({
      t: 'hitRes', to: m.from, e: m.e, r: res, d: Math.round(dmg * 10) / 10, lifted: !!(en && en.launched),
      h: { kind: m.h.kind, element: m.h.element, crit: m.h.crit, heavy: m.h.heavy, mantra: m.h.mantra, posture: m.h.posture, upper: m.h.upper, launch: m.h.launch },
    });
  }

  onGuestParry(m) {
    const av = this.avatars.get(m.from);
    const en = this.enemyById(m.e);
    if (!en || en.dead || !av) return;
    const c = en.center();
    G.vfx.sparks(c, null, '#fff2c0', 16);
    G.audio.play('parry', { pos: en.pos });
    en.getParried(av, m.po ? { posture: m.po } : null);
    traitOnParry(av, en, m.po ? { posture: m.po } : null); // the guest's weapon answers the parried blow (Bramble, Discipline)
  }

  onGuestGrip(m) {
    const av = this.avatars.get(m.from);
    const en = this.enemyById(m.e);
    if (en && en.knocked && !en.dead) en.finish(av || null);
  }

  // ------------------------------------------------------------ guest handlers
  applySnapshot(m) {
    const sky = this.game.world.sky;
    if (typeof m.time === 'number' && Math.abs(sky.time - m.time) > 0.002) sky.time = m.time;
    const seen = new Set();
    for (const row of m.e || []) {
      const id = row[0];
      seen.add(id);
      let pr = this.proxies.get(id);
      if (pr && !G.actors.includes(pr)) {
        this.proxies.delete(id);
        pr = null;
      }
      if (!pr) {
        if (row[10] & EF.dead) continue;
        pr = this.game.spawnProxy(row[1], id, row[2], row[3], row[4]);
        if (!pr) continue;
        this.proxies.set(id, pr);
      }
      pr.netSnap(row, this);
    }
    for (const [id, pr] of this.proxies) {
      if (!seen.has(id)) {
        this.removeActor(pr);
        this.proxies.delete(id);
      }
    }
  }

  onEnemyAttack(m) {
    const pr = this.proxies.get(m.e);
    if (pr) pr.playNetAttack(m.k, this.playerById(m.tg));
  }

  onEnemyAnim(m) {
    const pr = this.proxies.get(m.e);
    if (!pr || pr.dead || !pr.model) return;
    if (m.a === 'hold') {
      // an enemy's flourish: hold its replayed swing at the top for as long as the host's holds
      if (pr.atk) pr.atk.holdFor = m.h || 0.25;
    } else if (m.a === 'call') G.audio.play('roar', { pos: pr.pos, pitch: 1.5, vol: 0.5 });
    else if (m.a === 'feint') {
      pr.cancelAttack();
      pr.model.flash && pr.model.flash('#c8d8ff', 0.35, 0.12);
      G.audio.play('dodge', { pos: pr.pos, vol: 0.35, pitch: 1.4 });
    } else if (m.a === 'parry' && pr.model.play) pr.model.play('parry', { windup: 0.06, active: 0.12, recovery: 0.2 });
    else if (m.a === 'roll' && pr.model.anim) pr.model.anim.startRoll(m.d || 'l', 0.4);
    else if (m.a === 'grip') {
      if (pr.model.anim) pr.model.anim.play('grip', { windup: 0.6, active: 0.2, recovery: 0.5 });
      else pr.model.play('bite', { windup: 0.6, active: 0.2, recovery: 0.5 });
    }
  }

  onKill(m) {
    const pr = this.proxies.get(m.e);
    if (!pr) return;
    pr.gripped = !!m.g;
    pr.markNetDead();
    this.game.onEnemyKilled(pr, m.k === this.id ? this.game.player : null);
    if (this.game.bossActive === pr) this.game.endBoss(pr, true);
  }

  onHitResult(m) {
    const p = this.game.player;
    const pr = this.proxies.get(m.e);
    if (!p || !pr) return;
    netHitFeedback(p, pr, m.r, m.d, m.h || {});
    if (m.r === 'parried' && m.h && m.h.kind === 'melee') p.getParried(pr, m.h);
    // fromHost: the host's word that this blow lifted the foe (it opens the air chase)
    if (m.r === 'hit' && m.d > 0) p.onDealtHit(pr, m.d, Object.assign({}, m.h, { fromHost: !!m.lifted }));
  }

  onHitYou(m) {
    const p = this.game.player;
    if (!p || p.dead || this.game.state !== 'playing') return;
    const att = this.proxies.get(m.e) || this.fakeAttacker(m.ap);
    const h = Object.assign({}, m.h, { fromNet: true, from: new THREE.Vector3().fromArray(m.f) });
    applyHit(att, p, h);
  }

  // ------------------------------------------------------------ per frame
  update(dt) {
    if (!this.active) return;
    const game = this.game;
    const p = game.player;
    if (p && game.state === 'playing') {
      this.stateT -= dt;
      if (this.stateT <= 0) {
        this.stateT = STATE_INTERVAL;
        this.send({ t: 'ps', s: this.playerState(p) });
        this.sendInfo();
        if (this.avatars.size) this.sendBoats();
      }
    }
    if (this.isHost && this.avatars.size) {
      this.snapT -= dt;
      if (this.snapT <= 0) {
        this.snapT = SNAP_INTERVAL;
        this.sendSnapshot();
      }
    }
    for (const b of this.netBoats.values()) {
      if (!b.netTarget) continue;
      const tg = b.netTarget;
      const d = Math.hypot(tg.x - b.pos.x, tg.z - b.pos.z);
      const k = d > 25 ? 1 : 1 - Math.exp(-10 * dt);
      b.pos.x += (tg.x - b.pos.x) * k;
      b.pos.z += (tg.z - b.pos.z) * k;
      let dy = tg.yaw - b.yaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      b.yaw += dy * k;
      b.speed = tg.speed;
    }
    if (this.isGuest && p) {
      // boss bar for proxies fighting near us
      for (const pr of this.proxies.values()) {
        if (pr.aggro && !pr.dead && pr.target === p && pr.pos.distanceTo(p.pos) < 30) p.refreshDanger(8);
        if (!pr.boss) continue;
        const near = pr.pos.distanceTo(p.pos) < 70;
        if (pr.aggro && !pr.dead && near && game.bossActive !== pr) game.startBoss(pr);
        else if (game.bossActive === pr && (!pr.aggro || !near) && !pr.dead) game.endBoss(pr, false);
      }
    }
  }

  // ------------------------------------------------------------ boats
  occupantId(o) {
    if (!o) return -1;
    if (o === this.game.player) return this.id;
    if (o.isRemote) return o.peerId;
    return -2; // a non-player occupant (ferry captain)
  }

  sendBoats() {
    const rows = [];
    const now = new Map();
    for (const b of this.game.boats) {
      if (b.netProxy || !b.occupants) continue;
      now.set(b.id, b);
      rows.push([b.id, b.type, r2(b.pos.x), r2(b.pos.z), r2(b.yaw), r2(b.speed || 0), b.occupants.map((o) => this.occupantId(o))]);
    }
    // a ferry that just docked and was disposed: tell passengers where to step off
    for (const [id, b] of this.sentBoats) {
      if (!now.has(id) && b.dockPos) this.send({ t: 'boatDock', b: id, d: [r2(b.dockPos.x), r2(b.dockPos.y), r2(b.dockPos.z)] });
    }
    this.sentBoats = now;
    this.send({ t: 'boats', b: rows });
  }

  applyBoats(m) {
    const seen = new Set();
    const p = this.game.player;
    for (const [id, type, x, z, yaw, speed, occ] of m.b || []) {
      const key = `${m.from}:${id}`;
      seen.add(key);
      let b = this.netBoats.get(key);
      if (!b) {
        b = new Boat(new THREE.Vector3(x, 0, z), yaw, type);
        b.netProxy = true;
        b.netOwner = m.from;
        b.netBoatId = id;
        this.netBoats.set(key, b);
        this.game.boats.push(b);
      }
      b.netTarget = { x, z, yaw, speed };
      // occupants as the owner sees them; keep our own seat while our request is in flight
      const mine = p && p.boat === b ? b.occupants.indexOf(p) : -1;
      const pending = mine >= 0 && performance.now() - (b.boardAt || 0) < 2000;
      const confirmed = occ.includes(this.id);
      for (let i = 0; i < b.occupants.length; i++) {
        const o = occ[i];
        b.occupants[i] = o === -1 || o === undefined ? null : o === this.id ? p : o === -2 ? { isCaptain: true } : this.avatars.get(o) || { isRemote: true, peerId: o };
      }
      if (mine >= 0 && !confirmed) {
        if (pending && !b.occupants[mine]) b.occupants[mine] = p;
        else if (!pending) {
          p.leaveBoat();
          G.ui.toast('There was no room aboard.', 'bad');
        }
      }
    }
    for (const key of [...this.netBoats.keys()]) if (key.startsWith(m.from + ':') && !seen.has(key)) this.removeNetBoat(key);
  }

  removeNetBoat(key) {
    const b = this.netBoats.get(key);
    if (!b) return;
    const p = this.game.player;
    if (p && p.boat === b) {
      const docked = !!b.dockPos || Math.abs(b.speed || 0) < 1.5;
      const seat = b.occupants.indexOf(p);
      p.leaveBoat();
      if (b.dockPos) {
        // step onto the dock next to the owner (spread passengers a little)
        const pos = b.dockPos.clone().add(new THREE.Vector3((seat % 3) - 1, 0, ((seat / 3) | 0) * 0.8));
        pos.y = Math.max(this.game.world.groundAt(pos.x, pos.z, pos.y + 3), pos.y);
        p.pos.copy(pos);
        p.vel.set(0, 0, 0);
        p.fallStart = pos.y;
        p.swimming = false;
      }
      G.ui.toast(docked ? 'You disembark.' : 'Your ride is gone. Swim!', docked ? '' : 'bad');
    }
    this.netBoats.delete(key);
    const i = this.game.boats.indexOf(b);
    if (i >= 0) this.game.boats.splice(i, 1);
    b.dispose();
  }

  // first free passenger seat (the helm stays with the owner)
  passengerSeat(b) {
    for (let i = 1; i < b.occupants.length; i++) if (!b.occupants[i]) return i;
    return -1;
  }

  requestBoard(b, seat) {
    b.boardAt = performance.now();
    this.send({ t: 'board', to: b.netOwner, b: b.netBoatId, seat });
  }

  // owner side
  onBoardRequest(m) {
    const av = this.avatars.get(m.from);
    const b = this.game.boats.find((x) => !x.netProxy && x.id === m.b);
    if (!av || !b || !b.board) return this.send({ t: 'boardNo', to: m.from, b: m.b });
    let seat = m.seat >= 1 && !b.occupants[m.seat] ? m.seat : this.passengerSeat(b);
    if (seat < 0 || !b.board(av, seat)) return this.send({ t: 'boardNo', to: m.from, b: m.b });
    G.ui.toast(`${av.name} came aboard.`);
    this.sendBoats();
  }

  onBoardRejected(m) {
    const p = this.game.player;
    const b = this.netBoats.get(`${m.from}:${m.b}`);
    if (p && b && p.boat === b) {
      p.leaveBoat();
      G.ui.toast('There was no room aboard.', 'bad');
    }
  }

  onUnboard(m) {
    const av = this.avatars.get(m.from);
    const b = this.game.boats.find((x) => !x.netProxy && x.id === m.b);
    if (av && b && b.leave) b.leave(av);
  }

  playerState(p) {
    let f = 0;
    if (p.grounded) f |= PF.grounded;
    if (p.swimming) f |= PF.swimming;
    if (p.climbing) f |= PF.climbing;
    if (p.slideT > 0) f |= PF.sliding;
    if (p.blocking) f |= PF.blocking;
    if (p.charging) f |= PF.charging;
    if (p.knocked) f |= PF.knocked;
    if (p.dead) f |= PF.dead;
    if (p.stunned) f |= PF.stunned;
    if (p.sitting || p.boat) f |= PF.sit;
    if (p.boat) f |= PF.boat;
    if (p.stealth > 0) f |= PF.stealth;
    if (!p.armed) f |= PF.handsDown;
    return [
      r2(p.pos.x), r2(p.pos.y), r2(p.pos.z), r2(p.yaw), r2(p.speed || 0), r2(p.vel.y), f,
      Math.round(p.hp), p.maxHp, Math.round(p.posture), p.maxPosture, p.ch.level, p.boat ? r2(p.boat.yaw) : 0,
    ];
  }

  sendSnapshot() {
    const guests = [...this.avatars.values()].filter((a) => a.netPos);
    const rows = [];
    for (const a of G.actors) {
      if (a.team === 'player' || a.team === 'npc' || a.isRemote || a.netId == null || a.localOnly || a.dummy || a.netProxy) continue;
      let near = false;
      for (const g of guests) {
        const dx = g.pos.x - a.pos.x;
        const dz = g.pos.z - a.pos.z;
        if (dx * dx + dz * dz < RELEVANCE * RELEVANCE) {
          near = true;
          break;
        }
      }
      if (!near) continue;
      let fl = 0;
      if (a.dead) fl |= EF.dead;
      if (a.knocked) fl |= EF.knocked;
      if (a.aggro) fl |= EF.aggro;
      if (a.blocking) fl |= EF.blocking;
      if (a.stunned) fl |= EF.stunned;
      if (a.enraged) fl |= EF.enraged;
      if (a.guardBroken) fl |= EF.guardBroken;
      let sf = 0;
      for (const k in a.statuses) sf |= SF[k] || 0;
      rows.push([
        a.netId, a.type, r2(a.pos.x), r2(a.pos.y), r2(a.pos.z), r2(a.yaw), Math.round(a.hp), Math.round(a.maxHp),
        Math.round(a.posture), Math.round(a.maxPosture), fl, a.level, sf, a.statuses.bleed ? a.statuses.bleed.stacks : 0,
        this.targetId(a.target),
      ]);
    }
    this.send({ t: 'snap', time: r2(this.game.world.sky.time * 1000) / 1000, e: rows });
  }
}

export { SF };
