// The Rift's pressure and its one way back (Deepwoken's Depths): sanity wears down slowly
// enough for a run of ten to fifteen minutes before it turns dangerous (the Ascent, ACTIONS in
// game/riftSpire.js, still adds its own), there is no resting back to health down there, and
// a kill gives back a share of the killer's health, more for a tougher foe.
import { clamp } from '../core/util.js';

// sanity lost per second anywhere in the Rift (was 0.75: 100 sanity gone in 2 min 13 s; now
// 30% is left after about 11 min 40 s and the last of it goes at 16 min 40 s)
export const RIFT_SANITY_DRAIN = 0.1;

// The share of max health a kill in the Rift gives back: 10% for the weakest, rising with the
// foe's health on a log scale to 25% for a 1000-health brute or any boss.
export const KILL_HEAL = { min: 0.1, max: 0.25, weakHp: 80, toughHp: 1000 };
export function killHealShare(foe) {
  if (!foe) return 0;
  if (foe.spec?.boss) return KILL_HEAL.max;
  const hp = Math.max(1, foe.maxHp || 0);
  const k = clamp(Math.log(hp / KILL_HEAL.weakHp) / Math.log(KILL_HEAL.toughHp / KILL_HEAL.weakHp), 0, 1);
  return KILL_HEAL.min + (KILL_HEAL.max - KILL_HEAL.min) * k;
}
