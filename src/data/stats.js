// Attributes, elements, leveling curve and derived-stat formulas.
import { COMBAT } from '../combat/rules.js';

export const ATTRS = {
  strength: { name: 'Strength', short: 'STR', cat: 'base', color: '#e0614f', desc: 'Raises physical damage, posture damage and lets you wield heavier gear.' },
  fortitude: { name: 'Fortitude', short: 'FTD', cat: 'base', color: '#d9a441', desc: 'Raises health and posture. Required for heavier armor.' },
  agility: { name: 'Agility', short: 'AGL', cat: 'base', color: '#5fd38d', desc: 'Raises movement speed and climbing; shortens dodge cooldown.' },
  intelligence: { name: 'Intelligence', short: 'INT', cat: 'base', color: '#5aa7ff', desc: 'Raises mantra damage.' },
  willpower: { name: 'Willpower', short: 'WLL', cat: 'base', color: '#b98cff', desc: 'Raises ether, ether regeneration and sanity.' },
  charisma: { name: 'Charisma', short: 'CHA', cat: 'base', color: '#ff8fc8', desc: 'Lowers prices and raises support mantra potency and healing received.' },
  heavy: { name: 'Heavy Weapon', short: 'HVY', cat: 'weapon', color: '#c97b4a', desc: 'Damage scaling for greatswords, greataxes and maces.' },
  medium: { name: 'Medium Weapon', short: 'MED', cat: 'weapon', color: '#c9b24a', desc: 'Damage scaling for swords, katanas and spears.' },
  light: { name: 'Light Weapon', short: 'LHT', cat: 'weapon', color: '#9fc94a', desc: 'Damage scaling for daggers, rapiers and fists.' },
  ember: { name: 'Emberweave', short: 'EMB', cat: 'attune', color: '#ff7a2f', desc: 'Attunement to living flame. Burns, eruptions, searing heat.' },
  rime: { name: 'Rimebind', short: 'RIM', cat: 'attune', color: '#8fd8ff', desc: 'Attunement to cold. Chills, freezes and walls of ice.' },
  storm: { name: 'Stormcall', short: 'STM', cat: 'attune', color: '#ffe14d', desc: 'Attunement to lightning. Shocks, chains and sky strikes.' },
  gale: { name: 'Galesong', short: 'GAL', cat: 'attune', color: '#a6ffd2', desc: 'Attunement to wind. Knockback, mobility and cutting air.' },
  umbra: { name: 'Umbracast', short: 'UMB', cat: 'attune', color: '#a274ff', desc: 'Attunement to shadow. Blinding, stealth and void.' },
};

export const BASE_ATTRS = ['strength', 'fortitude', 'agility', 'intelligence', 'willpower', 'charisma'];
export const WEAPON_ATTRS = ['heavy', 'medium', 'light'];
export const ATTUNE_ATTRS = ['ember', 'rime', 'storm', 'gale', 'umbra'];
export const ALL_ATTRS = [...BASE_ATTRS, ...WEAPON_ATTRS, ...ATTUNE_ATTRS];

export const ELEMENTS = {
  phys: { name: 'Physical', color: '#ffffff' },
  ember: { name: 'Fire', color: '#ff7a2f' },
  rime: { name: 'Ice', color: '#8fd8ff' },
  storm: { name: 'Lightning', color: '#ffe14d' },
  gale: { name: 'Wind', color: '#a6ffd2' },
  umbra: { name: 'Shadow', color: '#a274ff' },
  blood: { name: 'Bleed', color: '#e0243f' }, // bleeding: resisted, but not an attribute or an attunement
};

// What armour and resistance can hold off: the attunements' elements, and bleeding, which any
// edge can open (enchants, bites, thorns) though no attunement is sworn to it.
export const RESIST_ELEMENTS = [...ATTUNE_ATTRS, 'blood'];

export const MAX_LEVEL = 20;
export const POINTS_PER_LEVEL = 15;
export const START_POINTS = 12;
export const ATTR_CAP = 100;
export const ATTUNE_TOTAL_CAP = 120; // across all attunements

export function xpForLevel(level) {
  return Math.floor(110 * Math.pow(level, 1.42));
}

// Power is gated by investment: XP earns POINTS_PER_LEVEL points per Power, one at a time along
// xpForLevel, and Power rises when the last of those is invested (Player.invest). Every point a
// character has ever been given: the creation points, each Power's, and those earned toward the next.
export function totalPoints(ch) {
  return START_POINTS + (Math.max(1, ch.level || 1) - 1) * POINTS_PER_LEVEL + Math.max(0, ch.earned || 0);
}

export function newAttrs() {
  const a = {};
  for (const k of ALL_ATTRS) a[k] = 0;
  return a;
}

// Returns a merged modifier bag from talents, vow, race, outfit and buffs.
export function sumMods(sources) {
  const m = {};
  for (const src of sources) {
    if (!src) continue;
    for (const k in src) {
      const v = src[k];
      if (typeof v === 'number') m[k] = (m[k] || 0) + v;
      else if (v === true) m[k] = true;
    }
  }
  return m;
}

export function computeDerived(attrs, level, mods, raceScale = 1) {
  const a = attrs;
  const m = mods;
  const d = {};
  d.maxHp = Math.round((100 + a.fortitude * 2.2 + level * 6 + (m.maxHp || 0)) * (1 + (m.maxHpPct || 0)));
  d.maxPosture = Math.round(60 + a.fortitude * 0.7 + (m.maxPosture || 0));
  d.maxEther = Math.round(80 + a.willpower * 1.6 + level * 2 + (m.maxEther || 0));
  d.etherRegen = (1.6 + a.willpower * 0.035) * (1 + (m.etherRegen || 0));
  d.maxSanity = Math.round(100 + a.willpower * 0.6 + (m.maxSanity || 0));
  d.sanityDrain = Math.max(0.15, 1 - (m.sanityResist || 0));
  d.moveMul = (1 + a.agility * 0.0028 + (m.speed || 0)) * (raceScale > 1.05 ? 0.96 : 1);
  d.dodgeCd = Math.max(0.55, 1.7 * (1 - a.agility * 0.0035) * (1 - (m.dodgeCd || 0)));
  // Climbing by ledges (entities/player.js): catches and wall hops before the feet touch ground
  // again, the leap off a ledge (about 2.3 m) and a hop up a wall (about 1.1 m).
  d.latches = 3 + Math.floor(a.agility / 35) + (m.latches || 0);
  d.latchLeap = 11.8 * (1 + a.agility * 0.0015);
  d.wallHop = 8 * (1 + a.agility * 0.0015);
  d.mantraDmg = 1 + a.intelligence * 0.004 + (m.mantraDmg || 0);
  d.physDmg = 1 + (m.physDmg || 0);
  d.postureDmg = 1 + a.strength * 0.004 + (m.postureDmg || 0);
  d.physResist = Math.min(0.6, (m.physResist || 0));
  d.priceMul = Math.max(0.55, 1 - a.charisma * 0.003 - (m.discount || 0));
  d.sellMul = 0.35 + a.charisma * 0.002 + (m.sellBonus || 0);
  d.parryWindow = COMBAT.parry.window + (m.parryWindow || 0);
  d.healMul = 1 + (m.heal || 0) + a.charisma * 0.002;
  d.critDmg = 1 + (m.critDmg || 0);
  d.etherCostMul = Math.max(0.4, 1 - (m.etherCost || 0));
  d.mantraCdMul = Math.max(0.5, 1 - (m.mantraCd || 0));
  d.hungerMul = Math.max(0.3, 1 - (m.hungerRate || 0));
  d.xpMul = 1 + (m.xpGain || 0);
  d.silverMul = 1 + (m.silverGain || 0);
  d.swimSpeed = 1 + (m.swimSpeed || 0);
  return d;
}

// Weapon damage scaling: base * (1 + sum(scale_k * attr_k / 100))
export function weaponScaling(weapon, attrs) {
  let s = 1;
  for (const k in weapon.scaling || {}) s += (weapon.scaling[k] * (attrs[k] || 0)) / 100;
  return s;
}

export function meetsReqs(reqs, attrs, extra = {}) {
  if (!reqs) return true;
  for (const k in reqs) {
    if (k === 'anyOf') {
      if (!reqs.anyOf.some((r) => meetsReqs(r, attrs, extra))) return false;
    } else if (k === 'level') {
      if ((extra.level || 1) < reqs.level) return false;
    } else if (k === 'vow') {
      if (extra.vow !== reqs.vow) return false;
    } else if ((attrs[k] || 0) < reqs[k]) return false;
  }
  return true;
}

export function reqsText(reqs) {
  if (!reqs) return 'None';
  const parts = [];
  for (const k in reqs) {
    if (k === 'anyOf') parts.push('(' + reqs.anyOf.map(reqsText).join(' or ') + ')');
    else if (k === 'level') parts.push('Power ' + reqs.level);
    else if (k === 'vow') parts.push('Vow');
    else parts.push(`${ATTRS[k] ? ATTRS[k].short : k} ${reqs[k]}`);
  }
  return parts.join(', ') || 'None';
}
