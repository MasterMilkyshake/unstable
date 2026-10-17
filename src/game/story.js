// The story runtime: quest markers for every step, polled objectives, chapters that wait for
// the player's Power, and the choice at the Anchor's Seat.
import * as THREE from 'three';
import { G } from '../core/globals.js';
import { START_HOOKS, UPDATE_HOOKS, ACTIONS } from './hooks.js';
import { QUESTS } from '../data/quests.js';
import { MAIN_CHAIN, ENDINGS } from '../data/story.js';
import { NPCS, SPAWNERS, LOCATIONS, STRUCTURES } from '../data/world.js';
import { LORE_BY_ID } from '../data/lore.js';
import { stageObjectives } from './quests.js';
import { escapeHtml } from '../core/util.js';

// Dialogue asks whether a great foe has fallen (data/npcs.js).
ACTIONS.bossDefeated = (type) => !!(G.game && G.game.ch && G.game.ch.bossesDefeated.includes(type));

// reach objectives name a location; resolve it once (positions are placed at load)
for (const def of Object.values(QUESTS)) {
  for (const st of def.stages || []) {
    for (const o of st.objectives || [st]) {
      if (o.type !== 'reach' || !o.loc) continue;
      const l = LOCATIONS.find((x) => x.name === o.loc);
      if (!l) {
        console.warn('[story] unknown location', o.loc);
        continue;
      }
      o.x = l.x;
      o.z = l.z;
      o.r ||= Math.min(l.r, 60);
    }
  }
}

const isRift = (x) => x > 3000;
const npcPos = (id) => {
  const n = NPCS.find((x) => x.id === id);
  return n ? { x: n.x, z: n.z } : null;
};
const spawnerPos = (type, from) => {
  let best = null;
  let bd = Infinity;
  for (const s of SPAWNERS) {
    if (![].concat(type).includes(s.type)) continue;
    const d = from ? Math.hypot(s.x - from.x, s.z - from.z) + (isRift(s.x) !== isRift(from.x) ? 1e5 : 0) : 0;
    if (d < bd) {
      bd = d;
      best = { x: s.x, z: s.z };
    }
  }
  return best;
};
const CORE_BEARERS = ['warlord', 'frost_warden', 'cinder_colossus'];

// Where one objective wants the player to go.
function objectiveTarget(ch, o, p) {
  switch (o.type) {
    case 'talk':
      return npcPos(o.npc);
    case 'flag': {
      if (o.npc) return npcPos(o.npc);
      if (o.at) {
        const st = STRUCTURES.find((x) => x.type === o.at);
        return st ? { x: st.x, z: st.z } : null;
      }
      return o.x !== undefined ? { x: o.x, z: o.z } : null;
    }
    case 'boss':
      return spawnerPos(o.boss, p);
    case 'kill':
      return spawnerPos(o.target, p);
    case 'lore': {
      const l = LORE_BY_ID[o.lore];
      return l ? { x: l.x, z: l.z } : null;
    }
    case 'reach':
      return o.x !== undefined ? { x: o.x, z: o.z } : null;
    case 'realm':
      if (o.realm === 'rift' && !G.game.inRift) return crownSluice();
      return null;
    case 'any':
      for (const x of o.of) {
        const t = objectiveTarget(ch, x, p);
        if (t) return t;
      }
      return null;
    case 'collect':
      if (o.item === 'fracture_core') {
        const left = CORE_BEARERS.filter((b) => !(ch.bossesDefeated || []).includes(b));
        return left.length ? spawnerPos(left, p) : null;
      }
      return o.x !== undefined ? { x: o.x, z: o.z } : null;
    default:
      return null;
  }
}

// The surface's one door down is the sluice under Meridian's drydock (death is the other).
function crownSluice() {
  const s = STRUCTURES.find((x) => x.type === 'crown_sluice');
  return s ? { x: s.x, z: s.z, label: 'The Crown Sluice' } : null;
}
// The Rift's living exit is the Ascent.
function riftExit() {
  return { x: 6000, z: 5988, label: 'The Ascent' };
}

// The quest whose step the compass follows: the one you track, else the current chapter.
export function focusQuest(ch) {
  if (ch.trackedQuest && ch.quests[ch.trackedQuest] && ch.quests[ch.trackedQuest].state !== 'done') return ch.trackedQuest;
  for (const id of MAIN_CHAIN) {
    const q = ch.quests[id];
    if (q && q.state !== 'done') return id;
  }
  return null;
}

export function questMarkerFor(game, id) {
  const ch = game.ch;
  const p = game.player && game.player.pos;
  const def = QUESTS[id];
  const q = ch.quests[id];
  if (!def || !q || !p) return null;
  let target = null;
  if (q.state === 'ready') target = npcPos(def.turnIn);
  else {
    const objs = def.stages ? stageObjectives(def, q.stage) : def.objectives;
    for (let i = 0; i < objs.length && !target; i++) {
      if (def.stages && game.quests._objDone(id, objs[i], i)) continue;
      target = objectiveTarget(ch, objs[i], p);
    }
  }
  if (!target) return null;
  // a step in the other realm: point at the way there
  if (isRift(target.x) && !game.inRift) return crownSluice();
  if (!isRift(target.x) && game.inRift) return riftExit();
  return target;
}

ACTIONS.questMarker = () => {
  const game = G.game;
  if (!game || !game.ch) return null;
  const id = focusQuest(game.ch);
  return id ? questMarkerFor(game, id) : null;
};
ACTIONS.trackQuest = (id) => {
  const ch = G.game.ch;
  ch.trackedQuest = ch.trackedQuest === id ? null : id;
  G.ui.refreshQuests();
};

// ---------------------------------------------------------------- the chain moves on
// Chapters that wait for a minimum Power start once the player grows into them.
function advanceChain(game) {
  const ch = game.ch;
  for (let i = 1; i < MAIN_CHAIN.length; i++) {
    const id = MAIN_CHAIN[i];
    const prev = MAIN_CHAIN[i - 1];
    if (ch.quests[id] || ch.quests[prev]?.state !== 'done') continue;
    // a veteran who finished the old storyline replays the new chapters in order, one at a time
    if (MAIN_CHAIN.slice(0, i).some((p) => ch.quests[p]?.state !== 'done')) continue;
    const def = QUESTS[id];
    if (QUESTS[prev].next !== id) continue;
    if (def.minLevel && ch.level < def.minLevel) continue;
    game.quests.start(id);
    return;
  }
}

let pollT = 0;
UPDATE_HOOKS.push((game, dt) => {
  if (!game.ch || !game.player || game.transitioning) return;
  pollT -= dt;
  if (pollT > 0) return;
  pollT = 0.5;
  game.quests.onPosition(game.player.pos);
  advanceChain(game);
});

START_HOOKS.push((game, ch) => {
  ch.flags ||= {};
  ensureSeat(game);
});

// ---------------------------------------------------------------- the Anchor's Seat
let seatAdded = false;
function ensureSeat(game) {
  if (seatAdded) return;
  const throne = STRUCTURES.find((s) => s.type === 'throne');
  if (!throne) return;
  seatAdded = true;
  const y = game.world.groundAt(throne.x, throne.z, 400);
  game.world.addInteract({
    id: 'anchor_seat', kind: 'seat', pos: new THREE.Vector3(throne.x, y + 1.5, throne.z), radius: 5,
    label: "The Anchor's Seat",
    enabled: () => !!(game.ch && (game.ch.bossesDefeated || []).includes('hollow_duke') && !game.ch.flags.ending_chosen),
    use: () => openSeat(game),
  });
}

function openSeat(game) {
  const ui = game.ui;
  const ch = game.ch;
  const opts = Object.entries(ENDINGS).map(([key, e]) => `<button class="btn wide" data-end="${key}"><b>${escapeHtml(e.title)}</b><br><span class="muted">${escapeHtml(e.choice)}</span></button>`).join('');
  const el = ui.openModal('seat', `<div class="panel" style="width:560px"><h2>THE ANCHOR'S SEAT</h2>
    <p style="font-style:italic">The Duke is ash. The seat is empty, and the chain that ran to it hums in the stone, waiting for a hand. Whatever you do here, the coast will feel it.</p>
    ${opts}<div class="divider"></div><button class="btn wide" data-a="close">Not yet</button></div>`, { pauses: true });
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-end]');
    if (b) {
      const key = b.dataset.end;
      const end = ENDINGS[key];
      ch.flags.ending = key;
      ch.flags.ending_chosen = true;
      ch.titles ||= [];
      if (!ch.titles.includes(end.titleReward)) ch.titles.push(end.titleReward);
      const rep = { break: { watch: 20, ministry: -10, enclave: -30 }, seal: { ministry: 30, watch: 5, enclave: -20 }, claim: { enclave: 40, watch: -25, ministry: -25 } }[key];
      for (const [f, n] of Object.entries(rep)) if (ACTIONS.addRep) ACTIONS.addRep(f, n);
      ui.closeModal();
      ui.banner(end.title.toUpperCase(), end.titleReward);
      G.audio.play('bell');
      game.quests.onFlag('ending_chosen');
      game.save();
    }
    if (e.target.closest('[data-a="close"]')) ui.closeModal();
  });
}

ACTIONS.endingText = () => {
  const ch = G.game && G.game.ch;
  const e = ch && ch.flags && ENDINGS[ch.flags.ending];
  return e ? e.text : null;
};

// ---------------------------------------------------------------- faction seats on the map
// The seats of power, drawn on the chart in each faction's colour (on top of other markers).
const SEATS = [
  { loc: "Keepers' Terrace", fallback: 'Saltreach Town', icon: '⚑', color: '#9ab8e8', label: 'The Regent' },
  { loc: 'Fort Meridian', icon: '⚑', color: '#e05a5a', label: 'The Enclave' },
  { loc: 'The Sounding House', icon: '⚑', color: '#b8bce8', label: 'The Ministry' },
];
const prevMarkers = ACTIONS.mapMarkers;
ACTIONS.mapMarkers = (region) => {
  const out = prevMarkers ? prevMarkers(region) || [] : [];
  if (region && region.rift) return out;
  for (const s of SEATS) {
    const l = LOCATIONS.find((x) => x.name === s.loc) || LOCATIONS.find((x) => x.name === s.fallback);
    if (l) out.push({ x: l.x + 14, z: l.z + 14, icon: s.icon, color: s.color, label: s.label, size: 14 });
  }
  return out;
};
