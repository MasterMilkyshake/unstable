// Ascent runtime: climb sanity pressure, landing flags, the summit exit.
// Does not touch the global 0.75/s drain formula.
import { G } from '../core/globals.js';
import { ACTIONS, UPDATE_HOOKS, START_HOOKS } from './hooks.js';
import '../data/riftSpire.js';
import { SPIRE, SPIRE_TIERS } from '../data/riftSpire.js';

function flags(game) {
  game.ch.flags ||= {};
  return game.ch.flags;
}

function onSpire(p) {
  return Math.hypot(p.pos.x - SPIRE.x, p.pos.z - SPIRE.z) < SPIRE.radius;
}

function markLandings(game) {
  const p = game.player;
  const f = flags(game);
  const ground = game.world.rift?.spire?.ground ?? game.world.terrain.heightAt(SPIRE.x, SPIRE.z);
  for (const t of SPIRE_TIERS) {
    const y = ground + t.h;
    if (Math.hypot(p.pos.x - t.x, p.pos.z - t.z) > t.r + 1.5) continue;
    if (p.pos.y < y - 0.8 || p.pos.y > y + 4.2) continue;
    // Standing on the summit is not the way out: the Wound is what sends you home.
    f[`rift_ascent_${t.id}`] = true;
  }
}

START_HOOKS.push((game) => {
  flags(game);
});

UPDATE_HOOKS.push((game, dt) => {
  const p = game.player;
  if (!p || !game.inRift || p.dead) return;
  markLandings(game);
  const pickups = game.world.rift?.spirePickups;
  if (pickups) {
    for (const pk of pickups) {
      const taken = !!game.ch.flags[`took_${pk.id}`];
      pk.group.visible = !taken;
    }
  }
  if (!onSpire(p)) return;
  const ground = game.world.rift?.spire?.ground ?? game.world.terrain.heightAt(SPIRE.x, SPIRE.z);
  const h = Math.max(0, p.pos.y - ground);
  if (h < 6) return;
  const t = Math.min(1, h / SPIRE.summitH);
  // Additive location pressure, over the Rift's own drain (game/riftBalance.js RIFT_SANITY_DRAIN).
  p.addSanity(-dt * (0.05 + t * 0.35)); // was 0.12 + 0.72 t: at the summit 0.5/s in all, five times the Rift's own
});

ACTIONS.finishAscent = (game) => {
  if (!game || !game.player) return;
  const f = flags(game);
  f.rift_ascent_conquered = true;
  f.rift_ascent_summit = true;
  game.quests.onFlag();
  game.save();
  G.audio.play('portal');
  game.ui.banner('THE WOUND OPENS');
  game.exitRift(false);
};

const prevMarkers = ACTIONS.mapMarkers;
ACTIONS.mapMarkers = (region) => {
  const out = prevMarkers ? prevMarkers(region) : [];
  out.push({ x: SPIRE.x, z: SPIRE.z, icon: '▲', label: 'The Ascent', color: '#e8c070', size: 18 });
  return out;
};
