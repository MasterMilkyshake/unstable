// Situational vow powers: bonuses that depend on daylight, the Rift, sanity or kills.
// Static vow talent mods live in data/talents.js; this adds the conditional part.
import { G } from '../core/globals.js';
import { MOD_PROVIDERS, KILL_HOOKS } from './hooks.js';
import { registerCondition, isDay } from './conditions.js';

const BOUNTY_MAX = 5;

registerCondition(
  (game) => (game.ch.vow === 'dawn' ? (isDay(game) ? 'day' : 'night') : ''),
  (game, now) => G.ui.toast(now === 'day' ? 'The sun rises. Your Vow burns bright.' : 'The sun sets. Your Vow dims.', now === 'day' ? 'good' : ''),
);
registerCondition((game) => {
  if (game.ch.vow !== 'abyss') return '';
  const p = game.player;
  return `${game.inRift ? 'rift' : 'surface'}:${Math.floor((1 - game.ch.sanity / Math.max(1, p.maxSanity)) * 10)}`;
});

MOD_PROVIDERS.push((player) => {
  const ch = player.ch;
  const game = G.game;
  if (!ch || !ch.vow || !game || !game.world) return null;
  switch (ch.vow) {
    case 'dawn':
      if (!isDay(game)) return null;
      return { physDmg: 0.12, mantraDmg: 0.12, resist_ember: 0.2 };
    case 'abyss': {
      const missing = Math.floor((1 - (ch.sanity ?? player.maxSanity) / Math.max(1, player.maxSanity || 100)) * 10);
      const bonus = missing * 0.01 + (game.inRift ? 0.15 : 0);
      return { physDmg: bonus, mantraDmg: bonus, sanityResist: game.inRift ? 0.5 : 0 };
    }
    default:
      return null;
  }
});

KILL_HOOKS.push((game, e) => {
  const p = game.player;
  if (!p || !game.ch || game.ch.vow !== 'contract') return;
  const old = p.buffs.find((b) => b.id === 'bounty');
  const n = Math.min(BOUNTY_MAX, (old ? old.stacks : 0) + 1);
  if (old) p.buffs.splice(p.buffs.indexOf(old), 1);
  const b = p.addBuff('bounty', 30, { physDmg: 0.04 * n, mantraDmg: 0.04 * n, silverGain: 0.1 * n }, '#e04a4a');
  b.stacks = n;
  if (n === BOUNTY_MAX && (!old || old.stacks < BOUNTY_MAX)) G.ui.toast('Bounty x5 - the contract is fulfilled in blood.', 'good');
});
