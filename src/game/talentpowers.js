// Effects for situational talents (flags set in data/talents.js): kill rewards,
// low-health and time-of-day bonuses, longer meals.
import { G } from '../core/globals.js';
import { MOD_PROVIDERS, KILL_HOOKS, UPDATE_HOOKS } from './hooks.js';
import { registerCondition, isDay } from './conditions.js';
import { ITEMS } from '../data/items.js';
import { traitOnKill } from '../combat/weaponTraits.js';

const hunters = (game) => {
  const p = game.player;
  let n = 0;
  for (const a of G.actors) if (a.team === 'enemy' && a.aggro && !a.dead && a.target === p && !a.dummy && !a.illusion) n++;
  return n;
};

// conditions that change which bonuses apply
registerCondition((game) => (game.player.mods.adrenaline ? (game.player.hp < game.player.maxHp * 0.35 ? 'low' : 'ok') : ''));
registerCondition((game) => {
  const m = game.player.mods;
  if (!m.nightstalker && !m.sunBlessed) return '';
  return isDay(game) ? 'day' : 'night';
});
registerCondition((game) => (game.player.mods.deepDiver ? (game.inRift ? 'rift' : 'surface') : ''));
registerCondition((game) => (game.player.mods.lastStand ? (hunters(game) >= 3 ? 'stand' : 'calm') : ''));

MOD_PROVIDERS.push((player) => {
  const game = G.game;
  const m = player.mods || {};
  if (!game || !game.world || !player.ch) return null;
  const out = {};
  const add = (k, v) => (out[k] = (out[k] || 0) + v);
  if (m.adrenaline && player.hp < player.maxHp * 0.35) {
    add('speed', 0.12);
    add('physDmg', 0.08);
    add('mantraDmg', 0.08);
  }
  const day = isDay(game);
  if (m.nightstalker && !day) {
    add('physDmg', 0.08);
    add('mantraDmg', 0.08);
    add('stealth', 0.2);
  }
  if (m.sunBlessed && day) {
    add('mantraDmg', 0.08);
    add('etherRegen', 0.1);
  }
  if (m.deepDiver && game.inRift) {
    add('physDmg', 0.08);
    add('mantraDmg', 0.08);
    add('sanityResist', 0.15);
  }
  if (m.lastStand && game.player === player && hunters(game) >= 3) {
    add('physDmg', 0.1);
    add('mantraDmg', 0.1);
    add('physResist', 0.08);
  }
  return out;
});

KILL_HOOKS.push((game, e) => {
  const p = game.player;
  if (!p || p.dead || p.knocked) return;
  traitOnKill(p); // the weapon's own kill reward (combat/weaponTraits.js)
  const m = p.mods;
  if (m.bloodthirst) p.heal(p.maxHp * 0.06);
  if (m.etherSiphon) p.ether += 15;
  if (m.etherHunter) p.ether += 20;
});

// Treasure Sense: an unopened chest within 25 m chimes once.
let senseT = 0;
const sensed = new Set();
export function senseTreasure(game, dt) {
  const p = game.player;
  if (!p || !p.mods.treasureSense || !game.world || !game.world.chests) return;
  senseT -= dt;
  if (senseT > 0) return;
  senseT = 0.5;
  for (const c of game.world.chests) {
    if (c.opened || sensed.has(c.def.id)) continue;
    const at = c.mesh.position;
    if (Math.hypot(at.x - p.pos.x, at.z - p.pos.z) > 25 || Math.abs(at.y - p.pos.y) > 12) continue;
    sensed.add(c.def.id);
    G.audio.play('bell', { pos: at, pitch: 2.2, vol: 0.5 });
    G.ui.toast('Treasure Sense: a chest is near.', 'good');
  }
}
UPDATE_HOOKS.push(senseTreasure);
export function resetTreasureSense() {
  sensed.clear();
  senseT = 0;
}

// Gourmand: double the duration of meal buffs the moment they are applied.
const MEAL_BUFFS = new Set(Object.values(ITEMS).filter((it) => it.buff && (it.type === 'food' || it.type === 'drink')).map((it) => it.buff.id));
UPDATE_HOOKS.push((game) => {
  const p = game.player;
  if (!p || !p.mods.gourmand) return;
  for (const b of p.buffs) {
    if (!MEAL_BUFFS.has(b.id) || b.gourmand) continue;
    b.gourmand = true;
    b.t *= 2;
  }
});
