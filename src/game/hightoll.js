// Hightoll's bell (world/hightoll.js hangs it in the Toll Tower). The castellan rang it at the
// hours and at evening so the north road would know the post stood; he still does. It tolls
// when someone comes into the Bridge Court to face him, rings out when he gives up his guard
// at the last, and tolls a last time when he falls. After that it hangs still.
import { G } from '../core/globals.js';
import { UPDATE_HOOKS, KILL_HOOKS } from './hooks.js';

const BOSS = 'castellan';
// how far the bell carries: the Wash hears it faintly, the court can feel it
const HEAR = 900;

export function tollBell(game, strength = 0.35, pitch = 1) {
  const h = game?.world?.hightoll;
  if (!h) return false;
  h.toll(strength);
  const lp = game.player?.pos;
  const d = lp ? lp.distanceTo(h.bell) : 0;
  if (d > HEAR) return true;
  game.audio?.play('toll', { vol: Math.min(1, 1.1 / (1 + (d / 140) ** 2)) * (0.6 + strength), pitch, gap: 0.5 });
  if (d < 140 && G.vfx) G.vfx.addShake(0.12 + strength * 0.25);
  return true;
}

const state = { fight: null, raged: false, lastSky: null, pending: [] };

function peals(game, n, gap, strength, pitch = 1) {
  for (let i = 0; i < n; i++) state.pending.push({ t: i * gap, strength, pitch });
}

UPDATE_HOOKS.push((game, dt) => {
  if (!game.world?.hightoll || !game.ch) return;
  for (const p of state.pending) p.t -= dt;
  while (state.pending.length && state.pending[0].t <= 0) {
    const p = state.pending.shift();
    tollBell(game, p.strength, p.pitch);
  }
  const boss = game.bossActive && game.bossActive.type === BOSS ? game.bossActive : null;
  if (boss !== state.fight) {
    state.fight = boss;
    state.raged = false;
    if (boss) peals(game, 1, 0, 0.3);
  }
  if (boss && !state.raged && boss.enraged) {
    state.raged = true;
    peals(game, 3, 1.1, 0.6, 0.94);
    G.ui?.toast('The bell of Hightoll is ringing.', 'bad');
  }
  // at evening, while the post is kept, the castellan rings the bell
  const sky = game.world.sky;
  if (sky && typeof sky.time === 'number') {
    const was = state.lastSky;
    state.lastSky = sky.time;
    const kept = !(game.ch.bossesDefeated || []).includes(BOSS);
    if (kept && was != null && was < 0.75 && sky.time >= 0.75) peals(game, 3, 2.4, 0.3);
  }
});

KILL_HOOKS.push((game, e) => {
  if (e.type !== BOSS) return;
  state.pending.length = 0;
  peals(game, 1, 1.2, 0.8, 0.86);
  setTimeout(() => G.ui?.toast('The bell of Hightoll falls still.', 'good'), 4200);
});
