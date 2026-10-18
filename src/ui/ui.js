// UI controller: HUD, toasts, banners, overlays, enemy bars and modal screens.
import * as THREE from 'three';
import { G } from '../core/globals.js';
import { MANTRAS } from '../data/mantras.js';
import { ITEMS } from '../data/items.js';
import { QUESTS } from '../data/quests.js';
import { NPCS, SPAWNERS } from '../data/world.js';
import { placedPoint } from '../data/worldPlacement.js';
import { xpForLevel } from '../data/stats.js';
import { fitLabels } from './fitText.js';
import { angleDiff, clamp, escapeHtml } from '../core/util.js';
import * as Screens from './screens.js';
import * as CharMenu from './charmenu.js';
import * as Interact from './interact.js';
import { openLan, lanExposed } from './lan.js';
import { ACTIONS } from '../game/hooks.js';
import { bindLabel } from '../core/input.js';

const $ = (sel, root = document) => root.querySelector(sel);
// The HUD is refreshed every frame, but a value written to the DOM dirties style and layout
// even when it has not changed, so writes go through these and only reach the DOM on change.
const setStyle = (el, prop, v) => {
  const w = el.__w || (el.__w = {});
  if (w[prop] !== v) {
    w[prop] = v;
    el.style[prop] = v;
  }
};
const setVar = (el, name, v) => {
  const w = el.__w || (el.__w = {});
  if (w[name] !== v) {
    w[name] = v;
    el.style.setProperty(name, v);
  }
};
const setText = (el, v) => {
  v = String(v);
  if (el.textContent !== v) el.textContent = v;
};
const setClass = (el, v) => {
  if (el.className !== v) el.className = v;
};
const blurFocus = () => {
  const ae = document.activeElement;
  if (ae && ae !== document.body && ae.blur) ae.blur();
};

// A hotbar slot's name: a long word (LONGSWORD) gets a smaller face rather than a break.
function slotLabel(name) {
  const longest = Math.max(...String(name).split(/\s+/).map((w) => w.length));
  return `<div class="lbl${longest > 8 ? ' long' : ''}">${escapeHtml(name)}</div>`;
}

export class UI {
  constructor(game) {
    this.game = game;
    this.modal = null;
    this.suppressPause = false;
    this.toastEl = $('#toasts');
    this.screens = $('#screens');
    this.hud = $('#hud');
    this.vig = {
      dmg: $('#vignette .dmg'), low: $('#vignette .low'), sanity: $('#vignette .sanity'), blind: $('#vignette .blind'), knock: $('#vignette .knock'),
    };
    this.dmgT = 0;
    this.blindT = 0;
    this.bannerT = 0;
    this.areaT = 0;
    this.bars = [];
    this.worldUI = $('#world-ui');
    for (let i = 0; i < 12; i++) {
      const el = document.createElement('div');
      el.className = 'ebar hidden';
      el.innerHTML = '<div class="nm"></div><div class="hp"><b></b><i></i></div><div class="po"><i></i></div>';
      this.worldUI.appendChild(el);
      this.bars.push({ el, nm: el.querySelector('.nm'), hp: el.querySelector('.hp > i'), lag: el.querySelector('.hp > b'), po: el.querySelector('.po > i'), key: '', actor: null });
    }
    this.buildHUD();
    // the compass width is read once and again after a resize, never in the frame loop
    this.measureCompass();
    window.addEventListener('resize', () => this.measureCompass());
    G.input.onKey = (e) => this.onKey(e);
    // every panel that wants input keeps the cursor: no lock is taken while one is open
    G.input.canLock = () => !this.modal && this.game.state === 'playing';
    this.screens.addEventListener('click', () => G.audio.init());
    $('#game').addEventListener('click', () => {
      G.audio.init();
      if (this.game.state === 'playing' && !this.modal) G.input.requestLock();
    });
  }

  // ---------------------------------------------------------------- HUD
  buildHUD() {
    this.hud.innerHTML = `
      <div id="crosshair"></div>
      <div id="hud-tl"><div id="lives"></div><div id="danger" class="hidden">DANGER</div><div id="wanted" class="hidden"></div><div id="hud-time"></div></div>
      <div id="compass"></div><div id="area-small"></div>
      <div id="boss-bar" class="hidden"><div class="nm"></div><div class="tt"></div><div class="bar hp"><b></b><i></i></div><div class="bar posture"><i></i></div></div>
      <div id="quest-tracker"></div>
      <div id="hud-bl">
        <div id="statuses"></div>
        <div class="who"><span class="nm"></span><span class="pw"></span></div>
        <div class="bar posture" id="b-posture"><i></i></div>
        <div class="bar hp" id="b-hp"><b></b><i></i><span></span></div>
        <div class="bar ether" id="b-ether"><i></i><span></span></div>
        <div class="bar xp" id="b-xp" style="height:3px;opacity:.7"><i style="background:linear-gradient(90deg,#6a5a9a,#c8a8ff)"></i></div>
      </div>
      <div id="rest-card" class="hidden"></div>
      <div id="crit-ind"><span id="ci-crit" class="hidden"></span></div>
      <div id="tip" class="hidden"></div>
      <div id="captions" aria-live="polite"></div>
      <div id="hotbar"></div>
      <div id="hud-br">
        <div class="silver"></div>
        <div class="row" title="Hunger"><div class="bar hunger"><i></i></div></div>
        <div class="row" title="Thirst"><div class="bar water"><i></i></div></div>
        <div class="row" id="san-row" title="Sanity"><div class="bar sanity"><i></i></div></div>
      </div>
      <div id="prompt" class="hidden"></div>
      <div id="toasts"></div>
      <div id="banner"><div class="t"></div><div class="line"></div><div class="s"></div></div>
      <div id="area-banner"></div>
      <div id="click-resume" class="hidden">CLICK TO RESUME CONTROL</div>
    `;
    this.toastEl = $('#toasts');
    this.el = {
      lives: $('#lives'), danger: $('#danger'), wanted: $('#wanted'), time: $('#hud-time'), compass: $('#compass'), area: $('#area-small'),
      boss: $('#boss-bar'), quests: $('#quest-tracker'),
      statuses: $('#statuses'), name: $('#hud-bl .who .nm'), power: $('#hud-bl .who .pw'),
      posture: $('#b-posture'), postureFill: $('#b-posture > i'),
      hpFill: $('#b-hp > i'), hpLag: $('#b-hp > b'), hpText: $('#b-hp > span'),
      etherFill: $('#b-ether > i'), etherText: $('#b-ether > span'), xpFill: $('#b-xp > i'),
      hotbar: $('#hotbar'), silver: $('#hud-br .silver'), hunger: $('#hud-br .hunger > i'), water: $('#hud-br .water > i'),
      sanRow: $('#san-row'), sanity: $('#hud-br .sanity > i'), prompt: $('#prompt'), banner: $('#banner'), areaBanner: $('#area-banner'),
      resume: $('#click-resume'), critInd: $('#ci-crit'),
    };
    // compass ticks
    const ticks = [];
    const names = { 0: 'N', 45: 'NW', 90: 'W', 135: 'SW', 180: 'S', 225: 'SE', 270: 'E', 315: 'NE' };
    for (let d = 0; d < 360; d += 15) {
      const major = names[d] !== undefined;
      const el = document.createElement('div');
      el.className = 'tick' + (major ? '' : ' minor');
      el.textContent = major ? names[d] : '|';
      this.el.compass.appendChild(el);
      ticks.push({ el, yaw: (d * Math.PI) / 180 });
    }
    this.compassTicks = ticks;
    this.questTick = document.createElement('div');
    this.questTick.className = 'tick q';
    this.el.compass.appendChild(this.questTick);
    this.allyTicks = [];
  }

  // The compass's CSS width (520 px, 400 px in a narrow window), from its computed style: that
  // needs no layout, even while the HUD is hidden. Reading clientWidth in the first frame after
  // the HUD appeared forced a layout of the whole HUD inside that frame (about 17-30 ms).
  measureCompass() {
    this._compassW = parseFloat(getComputedStyle(this.el.compass).width) || 520;
  }

  // Behind the menus the HUD is veiled (visibility: hidden), not removed (display: none): it is
  // laid out at boot, so the frame play begins in has no 30 ms layout of the whole HUD.
  showHUD() {
    this.hud.classList.remove('veiled');
    this.closeAll();
    Screens.hideMainMenu(this);
  }
  hideHUD() {
    this.hud.classList.add('veiled');
    setStyle(this.el.posture, 'visibility', 'hidden'); // set visible in play, it would show through the veil
    $('#hint') && $('#hint').classList.add('hidden');
    this.setKnocked(false);
    this.hideBoss();
    for (const b of this.bars) b.el.classList.add('hidden');
    for (const k in this.vig) setStyle(this.vig[k], 'opacity', 0);
  }

  refreshHotbar() {
    const p = G.player;
    if (!p) return;
    const ch = p.ch;
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
    let html = '';
    for (let i = 0; i < 10; i++) {
      const e = ch.hotbar[i];
      let inner = '';
      let cls = 'slot';
      if (i === 0 || (e && e.type === 'weapon')) {
        // the weapon slot always holds something, bare fists at least; lit while raised
        inner = slotLabel(p.weaponItem() ? p.weaponItemDef().name : 'Fists');
        cls += p.armed ? ' el-phys sel' : ' empty';
      } else if (e && e.type === 'mantra' && MANTRAS[e.id]) {
        const m = MANTRAS[e.id];
        inner = `${slotLabel(m.name)}<div class="cd" data-cd="${e.id}" style="--p:0%"></div><div class="cdt" data-cdt="${e.id}"></div>`;
        cls += ' el-' + m.el;
      } else if (e && e.type === 'item' && ITEMS[e.id]) {
        const it = ITEMS[e.id];
        const n = e.id === 'waterskin' ? ch.waterCharges || 0 : ch.inventory.items[e.id] || 0;
        inner = `${slotLabel(it.name)}<span class="n">${n}</span>`;
        if (!n) cls += ' empty';
      }
      if (i > 0 && p.selected === i) cls += ' sel';
      html += `<div class="${cls}"><span class="k">${keys[i]}</span>${inner}</div>`;
    }
    this.el.hotbar.innerHTML = html;
    fitLabels(this.el.hotbar);
    this._cdEls = [...this.el.hotbar.querySelectorAll('[data-cd]')];
    this.hotbarSel = p.selected;
    this.hotbarSig = this._hotbarSig();
  }
  _hotbarSig() {
    const p = G.player;
    const ch = p.ch;
    return JSON.stringify(ch.hotbar) + p.selected + p.armed + ch.equipped.weapon + JSON.stringify(ch.inventory.items) + ch.waterCharges;
  }

  refreshQuests() {
    if (!this.game.ch) return;
    const list = this.game.quests.active().slice(0, 4);
    this.el.quests.innerHTML = list.map((q) => `<div class="q ${q.ready ? 'ready' : ''}"><div class="t">${escapeHtml(q.name)}</div><div class="o">${escapeHtml(q.text)}</div></div>`).join('');
  }

  questTarget() {
    const ch = this.game.ch;
    if (!ch) return null;
    // the story system marks the tracked quest's current step
    const staged = ACTIONS.questMarker && ACTIONS.questMarker();
    if (staged) return staged;
    const p = G.player;
    let best = null;
    for (const id in ch.quests) {
      const q = this.game.quests.get(id);
      if (q.state === 'done') continue;
      const def = QUESTS[id];
      if (!def || def.stages) continue;
      const o = def.objectives[0];
      let pos = null;
      if (q.state === 'ready' || o.type === 'talk' || o.type === 'flag') {
        const npcId = q.state === 'ready' ? def.turnIn : o.npc || def.turnIn;
        const n = NPCS.find((x) => x.id === npcId);
        if (n && o.type !== 'flag') pos = { x: n.x, z: n.z };
      } else if (o.type === 'kill') {
        let bd = Infinity;
        for (const s of SPAWNERS) if (o.target.includes(s.type) && (s.x > 3000) === this.game.inRift) {
          const d = Math.hypot(s.x - p.pos.x, s.z - p.pos.z);
          if (d < bd) {
            bd = d;
            pos = { x: s.x, z: s.z };
          }
        }
      } else if (o.type === 'collect') {
        // where each is found, in authored coordinates (data/worldPlacement.js places them)
        const src = { lost_satchel: [840, 78], wolf_pelt: [-730, 830], ember_glass: [700, 820], fracture_core: null, rift_shard: [5960, 5960] }[o.item];
        if (src) { const [x, z] = placedPoint(...src); pos = { x, z }; }
      }
      if (pos && (pos.x > 3000) === this.game.inRift) {
        best = pos;
        break;
      }
    }
    return best;
  }

  // By a fire the HUD goes quiet (style.css body.seated) and a small card says what the seat
  // offers. It follows Player.sitting, so standing up by any means restores the HUD.
  seatedHud() {
    const p = G.player, seated = !!(p && p.sitting && !p.dead && !p.boat && G.game && G.game.state === 'playing');
    if (seated === this._seated) return;
    this._seated = seated;
    document.body.classList.toggle('seated', seated);
    const card = document.getElementById('rest-card');
    if (!card) return;
    card.classList.toggle('hidden', !seated);
    if (seated) card.innerHTML = `<div class="rc-t">Resting by the fire</div><div class="rc-l">Health and sanity return while you sit. The game is kept.</div><div class="rc-k"><b>${escapeHtml(bindLabel('interact'))}</b> Cook &ensp; <b>${escapeHtml(bindLabel('menu'))}</b> Attributes &ensp; Move to stand</div>`;
  }

  update(dt) {
    this.seatedHud();
    // overlays timers
    this.dmgT = Math.max(0, this.dmgT - dt * 2.5);
    // Settings → Reduce flashing dims the screen's flashes to a third
    const dim = G.settings && G.settings.reduceFlashing ? 0.33 : 1;
    setStyle(this.vig.dmg, 'opacity', this.dmgT * dim);
    if (this.blindT > 0) {
      this.blindT -= dt;
      setStyle(this.vig.blind, 'opacity', clamp(this.blindT, 0, 1) * dim);
    } else setStyle(this.vig.blind, 'opacity', 0);
    if (this.bannerT > 0) {
      this.bannerT -= dt;
      if (this.bannerT <= 0) this.el.banner.classList.remove('on');
    }
    if (this.areaT > 0) {
      this.areaT -= dt;
      if (this.areaT <= 0) this.el.areaBanner.classList.remove('on');
    }
    const p = G.player;
    if (this.game.state !== 'playing' || !p) return;
    const ch = p.ch;

    // (not while a lock just asked for is still being granted, so closing a panel doesn't flash it)
    const asking = G.input.lockAsked && performance.now() - G.input.lockAsked < 700;
    this.el.resume.classList.toggle('hidden', !!(G.input.locked || this.modal || p.dead || asking));

    // left cluster
    setText(this.el.name, ch.name);
    setText(this.el.power, `POWER ${ch.level}`);
    const hpf = clamp(p.hp / p.maxHp, 0, 1);
    setStyle(this.el.hpFill, 'width', hpf * 100 + '%');
    setStyle(this.el.hpLag, 'width', hpf * 100 + '%');
    setText(this.el.hpText, `${Math.ceil(p.hp)} / ${p.maxHp}`);
    setStyle(this.el.etherFill, 'width', (ch.ether / p.maxEther) * 100 + '%');
    setText(this.el.etherText, `${Math.floor(ch.ether)}`);
    const pf = p.posture / p.maxPosture;
    setStyle(this.el.posture, 'visibility', pf > 0.01 || p.blocking ? 'visible' : 'hidden');
    setStyle(this.el.postureFill, 'width', pf * 100 + '%');
    this.el.posture.classList.toggle('broken', !!p.guardBroken);
    setStyle(this.el.xpFill, 'width', (ch.level >= 20 ? 100 : (ch.xp / xpForLevel(ch.level)) * 100) + '%');
    // banked XP full (Player.gainXp): the bar glows so the cap is seen before XP is lost
    const xpFull = ch.level + 1 < 20 && ch.xpBank >= xpForLevel(ch.level + 1);
    if (this._xpFull !== xpFull) {
      this._xpFull = xpFull;
      const bar = this.el.xpFill && this.el.xpFill.parentElement;
      if (bar) {
        bar.classList.toggle('capped', xpFull);
        bar.title = xpFull ? 'XP full: invest your points at a campfire to rise, or further XP is lost.' : '';
      }
    }

    // statuses & buffs
    const st = [];
    for (const k in p.statuses) {
      const s = p.statuses[k];
      const label = k === 'bleed' ? `BLEED ×${s.stacks}` : k === 'chill' ? `CHILL ${Math.round(s.stacks)}%` : k.toUpperCase();
      st.push(`<span class="st ${k}">${label}</span>`);
    }
    for (const b of p.buffs) st.push(`<span class="st buff">${b.id.replace(/_/g, ' ').toUpperCase()} ${Math.ceil(b.t)}s</span>`);
    if (p.mayhem > 0) st.push(`<span class="st bleed">MAYHEM ×${p.mayhem}</span>`);
    const sh = st.join('');
    if (sh !== this._stHtml) {
      this.el.statuses.innerHTML = sh;
      this._stHtml = sh;
    }

    // no standing crit/dodge hints; only a broken foe's critical window is called out
    const broken = p.brokenTarget();
    setClass(this.el.critInd, broken ? 'ready window' : 'hidden');
    if (broken) setText(this.el.critInd, `BROKEN: ${bindLabel('crit')} FOR A CRITICAL`);

    // hotbar
    if (this._hotbarSig() !== this.hotbarSig) this.refreshHotbar();
    for (const el of this._cdEls || this.el.hotbar.querySelectorAll('[data-cd]')) {
      const id = el.dataset.cd;
      const m = MANTRAS[id];
      const cd = p.cooldowns[id] || 0;
      const total = m.cd * p.derived.mantraCdMul;
      setVar(el, '--p', cd > 0 ? (cd / total) * 100 + '%' : '0%');
      const t = el.nextElementSibling;
      if (t) setText(t, cd > 0 ? Math.ceil(cd) : '');
    }

    // right cluster
    setText(this.el.silver, `${ch.silver} silver`);
    setStyle(this.el.hunger, 'width', ch.hunger + '%');
    setStyle(this.el.water, 'width', ch.water + '%');
    const showSan = this.game.inRift || ch.sanity < p.maxSanity - 1;
    setStyle(this.el.sanRow, 'display', showSan ? '' : 'none');
    setStyle(this.el.sanity, 'width', (ch.sanity / p.maxSanity) * 100 + '%');

    // lives & danger
    let lh = '';
    for (let i = 0; i < ch.maxLives; i++) lh += `<span class="life ${i < ch.lives ? '' : 'lost'}">◆</span>`;
    if (lh !== this._lh) {
      this.el.lives.innerHTML = lh;
      this._lh = lh;
    }
    this.el.danger.classList.toggle('hidden', !p.inDanger);
    const wanted = ACTIONS.wantedText ? ACTIONS.wantedText() : null;
    this.el.wanted.classList.toggle('hidden', !wanted);
    if (wanted && this.el.wanted.textContent !== wanted) this.el.wanted.textContent = wanted;
    if (p.inDanger) setText(this.el.danger, `DANGER ${Math.ceil(p.dangerT)}`);
    const tod = this.game.world.sky.time;
    const hh = Math.floor(tod * 24);
    const mm = Math.floor((tod * 24 - hh) * 60);
    setText(this.el.time, this.game.inRift ? '— : —' : `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);

    // vignettes
    setStyle(this.vig.low, 'opacity', hpf < 0.25 && !p.knocked ? (0.25 - hpf) * 3 : 0);
    const sanF = ch.sanity / p.maxSanity;
    setStyle(this.vig.sanity, 'opacity', sanF < 0.6 ? (0.6 - sanF) * 1.5 : 0);
    setStyle(this.vig.knock, 'opacity', p.knocked ? 1 : 0);

    // compass
    const yaw = this.game.camYaw;
    const cw = this._compassW || 520;
    const pxPerRad = cw / (Math.PI * 0.9);
    const mid = cw / 2;
    for (const t of this.compassTicks) {
      const d = angleDiff(yaw, t.yaw);
      const x = mid - d * pxPerRad;
      setStyle(t.el, 'left', x + 'px');
      setStyle(t.el, 'display', Math.abs(d) < Math.PI * 0.5 ? '' : 'none');
    }
    const qt = this.questTarget();
    if (qt) {
      const qy = Math.atan2(qt.x - p.pos.x, qt.z - p.pos.z);
      const d = angleDiff(yaw, qy);
      const dist = Math.hypot(qt.x - p.pos.x, qt.z - p.pos.z);
      setStyle(this.questTick, 'display', Math.abs(d) < Math.PI * 0.5 ? '' : 'none');
      setStyle(this.questTick, 'left', mid - d * pxPerRad + 'px');
      setText(this.questTick, `◆ ${Math.round(dist)}m`);
    } else setStyle(this.questTick, 'display', 'none');
    const allies = G.net && G.net.active ? [...G.net.avatars.values()].filter((a) => a.netPos) : [];
    while (this.allyTicks.length < allies.length) {
      const t = document.createElement('div');
      t.className = 'tick ally';
      this.el.compass.appendChild(t);
      this.allyTicks.push(t);
    }
    this.allyTicks.forEach((t, i) => {
      const a = allies[i];
      if (!a || (a.pos.x > 3000) !== this.game.inRift) {
        setStyle(t, 'display', 'none');
        return;
      }
      const d = angleDiff(yaw, Math.atan2(a.pos.x - p.pos.x, a.pos.z - p.pos.z));
      setStyle(t, 'display', Math.abs(d) < Math.PI * 0.5 ? '' : 'none');
      setStyle(t, 'left', mid - d * pxPerRad + 'px');
      setText(t, `● ${a.name.split(' ')[0]} ${Math.round(a.pos.distanceTo(p.pos))}m`);
    });
    setText(this.el.area, (this.game.areaName || '').toUpperCase());

    // boss
    const boss = this.game.bossActive;
    if (boss) {
      const f = clamp(boss.hp / boss.maxHp, 0, 1);
      setStyle(this.el.boss.querySelector('.hp > i'), 'width', f * 100 + '%');
      setStyle(this.el.boss.querySelector('.hp > b'), 'width', f * 100 + '%');
      setStyle(this.el.boss.querySelector('.posture > i'), 'width', (boss.posture / boss.maxPosture) * 100 + '%');
    }

    this.updateEnemyBars();
  }

  updateEnemyBars() {
    const p = G.player;
    const cam = G.camera;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const list = [];
    for (const a of G.actors) {
      if (a === p || a.dead || a.dummy && a.hp >= a.maxHp - 1 || a === this.game.bossActive) continue;
      if (a.illusion) continue;
      const d = a.pos.distanceTo(p.pos);
      if (a.isRemote) {
        if (d < 80) list.push([a, d - 1000]); // friends first
        continue;
      }
      if (d > 32) continue;
      if (!a.aggro && a.hp >= a.maxHp && a.posture <= 0 && !a.knocked && !a.dummy) continue;
      list.push([a, d]);
    }
    list.sort((x, y) => x[1] - y[1]);
    const want = [];
    for (let i = 0; i < list.length && want.length < this.bars.length; i++) want.push(list[i][0]);
    const wantSet = new Set(want);
    for (const b of this.bars) if (b.actor && !wantSet.has(b.actor)) b.actor = null;
    const v = new THREE.Vector3();
    const paint = (b, a) => {
      v.set(a.pos.x, a.pos.y + a.height + 0.45, a.pos.z).project(cam);
      if (v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1) {
        b.el.classList.add('hidden');
        return;
      }
      b.el.classList.remove('hidden');
      setStyle(b.el, 'transform', `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px) translate(-50%, -100%)`);
      const key = a.name + a.level + (a.knocked ? 'k' : '') + (a.isRemote ? 'r' : '') + (a.guardBroken ? 'b' : '');
      if (b.key !== key) {
        b.key = key;
        if (a.isRemote) b.nm.innerHTML = a.knocked ? `${escapeHtml(a.name)} — <span class="lv">KNOCKED</span>` : '';
        else if (a.knocked) b.nm.innerHTML = `${escapeHtml(a.name)} — <span class="lv">KNOCKED [B]</span>`;
        else if (a.guardBroken) b.nm.innerHTML = `${escapeHtml(a.name)} — <span class="broken">BROKEN</span>`;
        else b.nm.innerHTML = escapeHtml(a.name);
        b.el.classList.toggle('knocked', !!a.knocked);
        b.el.classList.toggle('ally', !!a.isRemote);
      }
      const hp = clamp(a.hp / a.maxHp, 0, 1) * 100 + '%';
      setStyle(b.hp, 'width', hp);
      if (b.lag) setStyle(b.lag, 'width', hp);
      setStyle(b.po, 'width', clamp(a.posture / a.maxPosture, 0, 1) * 100 + '%');
    };
    for (const a of want) {
      let b = this.bars.find((x) => x.actor === a);
      if (!b) b = this.bars.find((x) => !x.actor);
      if (!b) break;
      b.actor = a;
      paint(b, a);
    }
    for (const b of this.bars) if (!b.actor) b.el.classList.add('hidden');
  }

  setPrompt(text) {
    const el = this.el.prompt;
    if (!text || this.modal) {
      el.classList.add('hidden');
      return;
    }
    const k = text.includes('[B]') ? 'B' : 'E';
    const t = text.replace(' [B]', '');
    const html = `<kbd>${k}</kbd>${escapeHtml(t)}`;
    if (el.innerHTML !== html) el.innerHTML = html;
    el.classList.remove('hidden');
  }

  showBoss(e) {
    this.el.boss.classList.remove('hidden');
    this.el.boss.querySelector('.nm').textContent = e.name.toUpperCase();
    this.el.boss.querySelector('.tt').textContent = e.spec.title || '';
  }
  hideBoss() {
    this.el && this.el.boss && this.el.boss.classList.add('hidden');
  }

  // ---------------------------------------------------------------- feedback
  toast(msg, kind = '') {
    const el = document.createElement('div');
    el.className = 'toast ' + kind;
    el.textContent = msg;
    this.toastEl.appendChild(el);
    while (this.toastEl.children.length > 6) this.toastEl.firstChild.remove();
    setTimeout(() => el.classList.add('out'), 3600);
    setTimeout(() => el.remove(), 4100);
  }

  // Big labels show their main line only (the user's rule, 2026-10-16): a fact that sat under
  // one goes in a toast at its caller. The second argument is ignored, so older calls still work.
  banner(title, _sub = '', time = 4) {
    const b = this.el.banner;
    b.querySelector('.t').textContent = title;
    b.querySelector('.s').textContent = '';
    b.classList.add('on');
    this.bannerT = time;
    this.el.areaBanner.classList.remove('on');
    this.areaT = 0;
  }

  areaBanner(name) {
    this.el.areaBanner.textContent = name.toUpperCase();
    this.el.areaBanner.classList.add('on');
    this.areaT = 3.2;
  }

  damageFlash(i) {
    this.dmgT = Math.min(1, this.dmgT + 0.35 + i);
  }
  flashBlind(t) {
    this.blindT = t;
  }
  // The knocked overlay is gone (the systems session's rule: no struggle, no giving in); the
  // vignette alone shows it. Kept so an older caller does nothing.
  setKnocked() {}
  flashCrosshair() {
    const el = $('#crosshair');
    if (!el) return;
    el.classList.add('hit');
    clearTimeout(this._xh);
    this._xh = setTimeout(() => el.classList.remove('hit'), 90);
  }

  fade(mid, hold = 0.6) {
    const f = $('#fade');
    f.classList.add('on');
    setTimeout(() => {
      try {
        mid && mid();
      } catch (e) {
        console.error(e);
      }
      setTimeout(() => f.classList.remove('on'), hold * 1000);
    }, 550);
  }

  // ---------------------------------------------------------------- modals
  openModal(id, html, opts = {}) {
    this.closeAll(true);
    const el = document.createElement('div');
    el.id = id;
    el.className = 'screen ' + (opts.dim === false ? '' : 'dim');
    el.innerHTML = html;
    this.screens.appendChild(el);
    const closable = opts.closable !== false;
    this.modal = { id, el, pauses: !!opts.pauses, closable, onClose: opts.onClose, toggleKey: opts.toggleKey || null, confirmKey: !!opts.confirmKey };
    const panel = el.querySelector('.panel');
    if (panel && closable && !opts.noX) {
      const x = document.createElement('button');
      x.className = 'modal-x';
      x.title = 'Close (Esc)';
      x.textContent = '✕';
      x.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.modal && this.modal.el === el) this.closeModal();
      });
      panel.appendChild(x);
    }
    // clicking the dimmed backdrop closes the panel
    if (closable && opts.dim !== false) {
      el.addEventListener('mousedown', (e) => {
        if (e.target === el && this.modal && this.modal.el === el) this.closeModal();
      });
    }
    blurFocus();
    $('#hint') && $('#hint').classList.add('hidden');
    G.input.exitLock();
    G.input.clear();
    if (opts.sound !== false) G.audio.play('uiOpen');
    return el;
  }

  closeModal(relock = true) {
    if (!this.modal) return;
    const m = this.modal;
    this.modal = null;
    m.el.remove();
    blurFocus();
    if (m.onClose) {
      try {
        m.onClose();
      } catch (e) {
        console.error(e);
      }
    }
    if (relock && this.game.state === 'playing' && !this.modal) G.input.requestLock();
    if (G.audio && G.audio.ready) G.audio.play('uiBack', { gap: 0.08 });
  }

  closeAll(silent = false) {
    if (this.modal) {
      const m = this.modal;
      this.modal = null;
      m.el.remove();
      if (m.onClose && !silent) m.onClose();
    }
  }

  isOpen() {
    return !!this.modal;
  }
  isPaused() {
    if (G.net && G.net.active) return false; // the shared world never pauses
    return !!(this.modal && this.modal.pauses);
  }

  // Returns true when the key was consumed by the UI.
  onKey(e) {
    const m = this.modal;
    if (m) {
      if (e.code === 'Escape' && m.closable) {
        this.closeModal();
        return true;
      }
      if (e.code === 'Tab' && m.closable && m.id !== 'creation') {
        this.closeModal();
        return true;
      }
      if (m.toggleKey && e.code === m.toggleKey && m.closable) {
        this.closeModal();
        return true;
      }
      if (e.code === 'KeyM' && m.id === 'map') {
        this.closeModal();
        return true;
      }
      if (m.id === 'dialogue' && /^Digit[1-9]$/.test(e.code)) {
        const btn = m.el.querySelectorAll('.dl-opt')[Number(e.code.slice(5)) - 1];
        if (btn) btn.click();
      }
      if (m.id === 'dialogue' && (e.code === 'Space' || e.code === 'KeyE')) {
        const btns = m.el.querySelectorAll('.dl-opt');
        if (btns.length === 1) btns[0].click();
      }
      // Enter takes a panel's one primary button (E too on a card that asks for nothing else)
      if (e.code === 'Enter' || e.code === 'NumpadEnter' || (e.code === 'KeyE' && m.confirmKey)) {
        const primary = [...m.el.querySelectorAll('button.primary')].filter((b) => !b.disabled);
        if (primary.length === 1 && !(document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName))) primary[0].click();
      }
      return true; // while a panel is open, keys belong to the panel
    }
    if (this.game.state === 'playing' && e.code === 'Escape' && !G.input.locked) {
      this.openPause();
      return true;
    }
    return false;
  }

  // delegations
  showMainMenu() {
    Screens.showMainMenu(this);
  }
  openPause() {
    Screens.openPause(this);
  }
  deathScreen(title, sub, time, then) {
    Screens.deathScreen(this, title, sub, time, then);
  }
  showWipe(info) {
    Screens.showWipe(this, info);
  }
  showVictory() {
    Screens.showVictory(this);
  }
  openCharMenu(tab) {
    CharMenu.open(this, tab);
  }
  openDialogue(npc) {
    Interact.openDialogue(this, npc);
  }
  openShop(id) {
    Interact.openShop(this, id);
  }
  openFerry(dock) {
    Interact.openFerry(this, dock);
  }
  openCampfire(it) {
    Interact.openCampfire(this, it);
  }
  openAltar() {
    Interact.openAltar(this);
  }
  openBoard() {
    Interact.openBoard(this);
  }
  openVows() {
    Interact.openVows(this);
  }
  openMap() {
    Interact.openMap(this);
  }
  openLan(fromMenu = false) {
    openLan(this, fromMenu);
  }
  showCreation(slot) {
    Screens.openCreation(this, slot);
  }
  openDropPanel() {
    if (ACTIONS.openDropPanel) ACTIONS.openDropPanel(this);
  }
  openSlots(mode) {
    Screens.openSlots(this, mode);
  }
  // The session's state shows in the Multiplayer panel only; the HUD keeps no corner text for it.
  lanExposed() {
    return lanExposed();
  }
  refreshLan() {
    if (this.modal && this.modal.id === 'lan' && this._lanRerender) this._lanRerender();
  }
}
