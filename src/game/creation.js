// The attunement chosen at character creation (data/origins.js): a bonus in it, mana awakened,
// its first mantra known and on the hotbar. 'random' picks one of the five; anything else
// (or 'none') leaves the character attunement-less for Sage Ilvar to awaken later.
import { ATTUNE_ATTRS } from '../data/stats.js';
import { MANTRAS } from '../data/mantras.js';
import { START_ATTUNEMENT } from '../data/origins.js';

export function resolveAttunement(choice, rnd = Math.random) {
  if (choice === 'random') return ATTUNE_ATTRS[Math.floor(rnd() * ATTUNE_ATTRS.length) % ATTUNE_ATTRS.length];
  return ATTUNE_ATTRS.includes(choice) ? choice : null;
}

export function applyStartingAttunement(ch, choice, rnd) {
  const a = resolveAttunement(choice, rnd);
  if (!a) return null;
  ch.attrs[a] = (ch.attrs[a] || 0) + START_ATTUNEMENT.bonus;
  ch.startAttune = a;
  ch.manaUnlocked = true;
  const id = START_ATTUNEMENT.mantra[a];
  if (MANTRAS[id] && !ch.mantras[id]) {
    ch.mantras[id] = { stars: 0 };
    const free = ch.hotbar.findIndex((x, i) => i > 0 && i < 8 && !x);
    if (free > 0) ch.hotbar[free] = { type: 'mantra', id };
  }
  return a;
}
