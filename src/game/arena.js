// The Crucible: wave-survival trials in the Saltreach arena. Falling in the pit never costs
// your progress - the Pitmaster's healers drag you out. Clearing a trial pays silver and Crucible Marks.
import * as THREE from 'three';
import { G } from '../core/globals.js';
import { ACTIONS, UPDATE_HOOKS, act } from './hooks.js';
import { ENEMIES } from '../data/enemies.js';
import { ITEMS } from '../data/items.js';
import { WEAPONS } from '../data/weapons.js';
import { TRINKETS } from '../data/trinkets.js';
import { escapeHtml } from '../core/util.js';
import { openPanel } from '../ui/panel.js';
import { TRIALS, MARK_SHOP } from '../data/arena.js';

export { TRIALS, MARK_SHOP };

let run = null; // { trial, wave, alive:[], restT, state: 'countdown'|'fighting'|'rest'|'done' }
let hud = null;

function setHud(html) {
  if (!hud) {
    hud = document.createElement('div');
    hud.id = 'x-hud';
    document.body.appendChild(hud);
  }
  hud.innerHTML = html || '';
  hud.style.display = html ? '' : 'none';
}

function arenaPoint(angle, r) {
  const a = G.world.arena;
  const x = a.x + Math.sin(angle) * r;
  const z = a.z + Math.cos(angle) * r;
  return new THREE.Vector3(x, G.world.groundAt(x, z, a.y + 6) + 0.1, z);
}

function clearEnemies() {
  if (!run) return;
  for (const e of run.alive) if (!e.dead) e.despawn = true;
  run.alive = [];
}

function end(game, result) {
  const r = run;
  if (!r) return;
  clearEnemies();
  run = null;
  setHud(null);
  const p = game.player;
  const ch = game.ch;
  if (result === 'win') {
    const t = r.trial;
    p.addSilver(t.silver);
    game.giveItem('crucible_mark', t.marks, true);
    p.addXp(t.xp);
    ch.stats.crucible = ch.stats.crucible || {};
    ch.stats.crucible[t.id] = (ch.stats.crucible[t.id] || 0) + 1;
    ch.flags[`crucible_${t.id}`] = true;
    game.quests.onFlag(`crucible_${t.id}`);
    G.audio.play('bell');
    G.audio.play('crowd', { vol: 1.2 });
    G.ui.banner('TRIAL CLEARED', `${t.name} · +${t.silver} silver · +${t.marks} Crucible Mark${t.marks > 1 ? 's' : ''}`);
    game.save();
  } else if (result === 'fall') {
    // the healers drag you out without sending you to the Rift
    if (p.knocked) p.rise(0.35);
    for (const k in p.statuses) p.clearStatus(k);
    const a = G.world.arena;
    const out = arenaPoint(a.gap, a.r + 5);
    p.pos.copy(out);
    p.vel.set(0, 0, 0);
    p.iframes = 2;
    G.ui.banner('DEFEATED', 'The Pitmaster\'s healers drag you from the sand. The crowd jeers.');
    G.audio.play('knock');
  } else if (result === 'forfeit') {
    G.ui.toast('You left the ring. The trial is forfeit.', 'bad');
  }
}

function spawnWave(game) {
  const r = run;
  const list = r.trial.waves[r.wave];
  r.alive = [];
  list.forEach((type, i) => {
    if (!ENEMIES[type]) return;
    const ang = G.world.arena.gap + Math.PI + (i - (list.length - 1) / 2) * 0.6;
    const pos = arenaPoint(ang, G.world.arena.r * 0.6);
    G.vfx.pillar(pos, 'phys', 1.2, 4, 0.5);
    const e = game.spawnEnemy(type, pos, { scaleTo: r.trial.level });
    e.arena = true;
    e.setAggro(game.player);
    r.alive.push(e);
  });
  r.state = 'fighting';
  G.audio.play('roar', { pitch: 1.2, vol: 0.5 });
  G.ui.toast(`Wave ${r.wave + 1} of ${r.trial.waves.length}`, 'quest');
}

function startTrial(game, trial) {
  const p = game.player;
  const ch = game.ch;
  if (game.net && game.net.isGuest) return G.ui.toast('Only the host can start a Crucible trial.', 'bad');
  if (run) return G.ui.toast('A trial is already underway.', 'bad');
  if (ch.level < trial.power) return G.ui.toast(`The ${trial.name} needs Power ${trial.power}.`, 'bad');
  if (ch.silver < trial.fee) return G.ui.toast('Not enough silver for the entry fee.', 'bad');
  if (p.inDanger) return G.ui.toast("Catch your breath first - you're in danger.", 'bad');
  ch.silver -= trial.fee;
  G.audio.play('coin');
  G.ui.closeModal();
  G.ui.fade(() => {
    const a = G.world.arena;
    const pos = arenaPoint(a.gap, a.r * 0.45);
    p.pos.copy(pos);
    p.vel.set(0, 0, 0);
    p.yaw = a.gap + Math.PI;
    game.camYaw = p.yaw;
    p.hp = p.maxHp;
    p.ether = p.maxEther;
    p.posture = 0;
    run = { trial, wave: 0, alive: [], restT: 4, state: 'countdown' };
    G.ui.banner(trial.name.toUpperCase(), 'Five waves. The crowd is watching.');
    G.audio.play('bell', { vol: 0.7 });
  }, 0.8);
}

UPDATE_HOOKS.push((game, dt) => {
  const r = run;
  if (!r) return;
  const p = game.player;
  if (!p || game.state !== 'playing') return;
  const a = G.world.arena;
  if (p.dead) {
    clearEnemies();
    run = null;
    setHud(null);
    return;
  }
  if (p.knocked) return end(game, 'fall');
  if (Math.hypot(p.pos.x - a.x, p.pos.z - a.z) > a.r + 2.5) return end(game, 'forfeit');
  r.alive = r.alive.filter((e) => !e.dead && !e.despawn && G.actors.includes(e));
  if (r.state === 'countdown' || r.state === 'rest') {
    r.restT -= dt;
    if (r.restT <= 0) spawnWave(game);
  } else if (r.state === 'fighting' && r.alive.length === 0) {
    r.wave++;
    if (r.wave >= r.trial.waves.length) return end(game, 'win');
    r.state = 'rest';
    r.restT = 6;
    p.heal(p.maxHp * 0.15);
    G.audio.play('crowd', { vol: 0.8 });
    G.ui.toast('Wave cleared. Breathe.', 'good');
  }
  const status = r.state === 'fighting' ? `${r.alive.length} foe${r.alive.length === 1 ? '' : 's'} remain` : `Next wave in ${Math.ceil(r.restT)}`;
  setHud(`<div class="xh" style="color:${r.trial.color}">${escapeHtml(r.trial.name.toUpperCase())}</div><div class="arena-wave">WAVE ${Math.min(r.wave + 1, r.trial.waves.length)} / ${r.trial.waves.length}</div><div class="xh">${status}</div>`);
});

// ---------------------------------------------------------------- panels
ACTIONS.openCrucible = (ui = G.ui) => {
  const game = ui.game;
  const ch = game.ch;
  openPanel(ui, 'crucible', {
    width: 700,
    render: () => `<h2>THE CRUCIBLE</h2>
      <p class="muted" style="text-align:center;margin-top:0">Five waves per trial. Healers bring you back outside if you fall. You have <b class="gold">${ch.silver}</b> silver and <b class="gold">${ch.inventory.items.crucible_mark || 0}</b> marks.</p>
      <div class="shop-list">${TRIALS.map((t) => {
        const ok = ch.level >= t.power && ch.silver >= t.fee;
        const cleared = (ch.stats.crucible || {})[t.id] || 0;
        return `<div class="shop-row"><div class="ico" style="color:${t.color}">⚔</div><div style="flex:1"><div class="nm" style="color:${t.color}">${t.name}${cleared ? ` <span class="pill">cleared ×${cleared}</span>` : ''}</div>
          <div class="ds">Power ${t.power}+ · foes at Power ${t.level} · reward ${t.silver} silver, ${t.marks} mark${t.marks > 1 ? 's' : ''}, ${t.xp} xp</div>
          <div class="ds">${t.waves.map((w, i) => `${i + 1}: ${[...new Set(w)].map((x) => ENEMIES[x].name).join(', ')}`).join(' · ')}</div></div>
          <div class="pr ${ch.silver < t.fee ? 'bad' : ''}">${t.fee} silver</div><button class="btn small primary" data-trial="${t.id}" ${ok ? '' : `disabled title="${ch.level < t.power ? `Needs Power ${t.power}` : 'Not enough silver for the fee'}"`}>${ch.level < t.power ? `Power ${t.power}` : 'Enter'}</button></div>`;
      }).join('')}</div><div class="divider"></div><div class="row-flex"><span class="space"></span><button class="btn" data-a="close">Leave</button></div>`,
    onClick: (e) => {
      const b = e.target.closest('[data-trial]');
      if (b) startTrial(game, TRIALS.find((t) => t.id === b.dataset.trial));
    },
  });
};

ACTIONS.openMarkShop = (ui = G.ui) => {
  const game = ui.game;
  const ch = game.ch;
  const nameOf = (r) => (r.kind === 'trinket' ? TRINKETS[r.id].name : r.kind === 'weapon' ? WEAPONS[r.id].name : ITEMS[r.id].name);
  const iconOf = (r) => (r.kind === 'trinket' ? '💍' : r.kind === 'weapon' ? '🗡️' : ITEMS[r.id].icon);
  const descOf = (r) => (r.kind === 'trinket' ? TRINKETS[r.id].desc : r.kind === 'weapon' ? WEAPONS[r.id].desc : ITEMS[r.id].desc);
  openPanel(ui, 'markshop', {
    width: 700,
    render: () => {
      const marks = ch.inventory.items.crucible_mark || 0;
      return `<h2>VORN'S PRIZES</h2><p class="muted" style="text-align:center;margin-top:0">You hold <b class="gold">${marks}</b> Crucible Mark${marks === 1 ? '' : 's'}.</p>
        <div class="shop-list scroll">${MARK_SHOP.map((r, i) => {
          const owned = r.kind === 'trinket' && (ch.trinkets || []).some((t) => t.id === r.id);
          return `<div class="shop-row"><div class="ico">${iconOf(r)}</div><div style="flex:1"><div class="nm">${escapeHtml(nameOf(r))}</div><div class="ds">${escapeHtml(descOf(r))}</div></div><div class="pr ${!owned && marks < r.cost ? 'bad' : ''}">${r.cost} 🏅</div><button class="btn small" data-buy="${i}" ${owned ? 'disabled title="You own this already"' : marks < r.cost ? 'disabled title="Not enough Crucible Marks"' : ''}>${owned ? 'Owned' : 'Buy'}</button></div>`;
        }).join('')}</div><div class="divider"></div><div class="row-flex"><span class="space"></span><button class="btn" data-a="close">Leave</button></div>`;
    },
    onClick: (e, rerender) => {
      const b = e.target.closest('[data-buy]');
      if (!b) return;
      const r = MARK_SHOP[Number(b.dataset.buy)];
      if (!game.takeItem('crucible_mark', r.cost)) return;
      if (r.kind === 'trinket') act('giveTrinket', r.id);
      else if (r.kind === 'weapon') game.giveWeapon(r.id);
      else game.giveItem(r.id, 1);
      G.audio.play('coin');
      game.save();
      rerender();
    },
  });
};

ACTIONS.crucibleRun = () => run;
