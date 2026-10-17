import { migrateWorldPosition } from '../data/worldPlacement.js';
// Save migration: keeps old characters loadable across game updates. Unknown content ids
// (from removed or renamed weapons, items, talents, mantras, quests, trinkets...) are dropped
// instead of crashing the game, and missing fields are filled with defaults.
import { WEAPONS } from '../data/weapons.js';
import { ITEMS, OUTFITS } from '../data/items.js';
import { TALENTS } from '../data/talents.js';
import { MANTRAS } from '../data/mantras.js';
import { QUESTS } from '../data/quests.js';
import { VOWS } from '../data/vows.js';
import { RACES, RACE_BY_ID } from '../data/races.js';
import { TRINKETS } from '../data/trinkets.js';
import { ALL_ATTRS, ATTUNE_ATTRS } from '../data/stats.js';
import { cleanContents, contentsEmpty } from './contents.js';

export const SAVE_VERSION = 6;

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v, d, lo = -Infinity, hi = Infinity) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
const int = (v, d, lo, hi) => Math.round(num(v, d, lo, hi));
const point = (v) => isObj(v) && Number.isFinite(v.x) && Number.isFinite(v.z);

// A stored value of the wrong shape (a corrupted or hand-edited save) is reset to what a new
// character has, field by field, so the character loads rather than breaking the game.
function repair(ch) {
  if (typeof ch.name !== 'string' || !ch.name.trim()) ch.name = 'Nameless';
  ch.name = ch.name.slice(0, 40);
  if (!isObj(ch.look)) ch.look = {};
  ch.level = int(ch.level, 1, 1, 20);
  ch.xp = num(ch.xp, 0, 0);
  ch.points = int(ch.points, 0, 0, 9999);
  ch.talentPicks = int(ch.talentPicks, 0, 0, 99);
  ch.mantraPicks = int(ch.mantraPicks, 0, 0, 99);
  ch.silver = int(ch.silver, 0, 0, 1e9);
  ch.maxLives = int(ch.maxLives, 3, 1, 9);
  ch.lives = int(ch.lives, ch.maxLives, 0, ch.maxLives);
  for (const k of ['hunger', 'water']) ch[k] = num(ch[k], 100, 0, 100);
  for (const k of ['hp', 'ether', 'sanity']) ch[k] = num(ch[k], 999, 0);
  ch.waterCharges = int(ch.waterCharges, 0, 0, 999);
  ch.worldTime = num(ch.worldTime, 0.3, 0, 1);
  if (ch.spawn != null && !point(ch.spawn)) ch.spawn = null;
  // a position that can't be read wakes the character at its rest point (or the Wash)
  if (ch.pos != null && !(point(ch.pos) && Number.isFinite(ch.pos.y))) ch.pos = null;
  if (!Number.isFinite(ch.yaw)) delete ch.yaw;
  for (const k of ['talents', 'chestsOpened', 'bossesDefeated', 'lore', 'regions', 'discovered', 'titles', 'investigations']) if (ch[k] != null && !Array.isArray(ch[k])) ch[k] = [];
  for (const k of ['quests', 'flags', 'mantras', 'rep', 'gear', 'traits']) if (ch[k] != null && !isObj(ch[k])) ch[k] = {};
  if (ch.trinkets != null && !Array.isArray(ch.trinkets)) ch.trinkets = [];
  if (!isObj(ch.inventory)) ch.inventory = {};
  if (!isObj(ch.inventory.items)) ch.inventory.items = {};
  for (const [id, n] of Object.entries(ch.inventory.items)) {
    const c = int(n, 0, 0, 1e6);
    if (c > 0) ch.inventory.items[id] = c;
    else delete ch.inventory.items[id];
  }
  if (!Array.isArray(ch.inventory.weapons)) ch.inventory.weapons = [];
  if (!Array.isArray(ch.inventory.outfits)) ch.inventory.outfits = [];
  if (isObj(ch.quests)) for (const id of Object.keys(ch.quests)) if (!isObj(ch.quests[id])) delete ch.quests[id];
  if (isObj(ch.mantras)) for (const id of Object.keys(ch.mantras)) if (!isObj(ch.mantras[id])) ch.mantras[id] = { stars: 0 };
  // containers: the strongbox, chests left half-looted, pouches in this character's world
  if (ch.bank != null) ch.bank = cleanContents(ch.bank);
  if (ch.chestLoot != null) {
    if (!isObj(ch.chestLoot)) ch.chestLoot = {};
    for (const id of Object.keys(ch.chestLoot)) {
      ch.chestLoot[id] = cleanContents(ch.chestLoot[id]);
      if (contentsEmpty(ch.chestLoot[id])) delete ch.chestLoot[id];
    }
  }
  if (ch.pouches != null) ch.pouches = (Array.isArray(ch.pouches) ? ch.pouches : []).filter((p) => isObj(p) && typeof p.id === 'string' && point(p)).map((p) => ({ ...p, contents: cleanContents(p.contents) })).filter((p) => !contentsEmpty(p.contents));
  if (!isObj(ch.stats)) ch.stats = {};
  for (const k of ['kills', 'deaths', 'playtime', 'parries']) ch.stats[k] = num(ch.stats[k], 0, 0);
  if (!Number.isFinite(ch.stats.started)) ch.stats.started = 0;
}

export function migrateCharacter(ch) {
  if (!ch || typeof ch !== 'object') return ch;
  repair(ch);
  migrateWorldPosition(ch);
  // Saves from the brief no-permadeath version have no life counters.
  // Preserve remaining lives and pending combat-quit penalties in older saves.
  if (!Number.isFinite(ch.maxLives)) ch.maxLives = 3;
  if (!Number.isFinite(ch.lives)) ch.lives = ch.maxLives;
  const dropped = [];
  const note = (what) => dropped.push(what);

  if (!RACE_BY_ID[ch.race]) {
    note(`race ${ch.race}`);
    ch.race = RACES[0].id;
  }
  ch.attrs = ch.attrs || {};
  for (const k of ALL_ATTRS) if (typeof ch.attrs[k] !== 'number') ch.attrs[k] = 0;
  if (ch.startAttune != null && !ATTUNE_ATTRS.includes(ch.startAttune)) delete ch.startAttune; // creation's attunement, if any
  ch.inventory = ch.inventory || {};
  ch.inventory.items = ch.inventory.items || {};
  ch.inventory.weapons = (ch.inventory.weapons || []).filter((w) => w && WEAPONS[w.id] || (note(`weapon ${w && w.id}`), false));
  for (const id of Object.keys(ch.inventory.items)) if (!ITEMS[id]) {
    note(`item ${id}`);
    delete ch.inventory.items[id];
  }
  ch.inventory.outfits = (ch.inventory.outfits || []).filter((o) => OUTFITS[o] || (note(`outfit ${o}`), false));
  if (!ch.inventory.outfits.includes('rags')) ch.inventory.outfits.unshift('rags');
  ch.equipped = ch.equipped || {};
  if (ch.equipped.weapon && !ch.inventory.weapons.some((w) => w.uid === ch.equipped.weapon)) ch.equipped.weapon = null;
  if (!OUTFITS[ch.equipped.outfit]) ch.equipped.outfit = 'rags';
  ch.talents = (ch.talents || []).filter((t) => TALENTS[t] || (note(`talent ${t}`), false));
  ch.mantras = ch.mantras || {};
  for (const id of Object.keys(ch.mantras)) if (!MANTRAS[id]) {
    note(`mantra ${id}`);
    delete ch.mantras[id];
  }
  if (ch.vow && !VOWS[ch.vow]) {
    note(`vow ${ch.vow}`);
    ch.vow = null;
  }
  ch.quests = ch.quests || {};
  for (const id of Object.keys(ch.quests)) if (!QUESTS[id]) {
    note(`quest ${id}`);
    delete ch.quests[id];
  }
  ch.hotbar = Array.isArray(ch.hotbar) ? ch.hotbar : [{ type: 'weapon' }];
  while (ch.hotbar.length < 10) ch.hotbar.push(null);
  ch.hotbar = ch.hotbar.map((e, i) => {
    if (i === 0) return { type: 'weapon' };
    if (!e) return null;
    if (e.type === 'mantra' && !ch.mantras[e.id]) return null;
    if (e.type === 'item' && !ITEMS[e.id]) return null;
    return e;
  });
  if (ch.trinkets) ch.trinkets = ch.trinkets.filter((t) => t && TRINKETS[t.id] || (note(`trinket ${t && t.id}`), false));
  if (ch.gear) for (const slot in ch.gear) if (ch.gear[slot] && !(ch.trinkets || []).some((t) => t.uid === ch.gear[slot])) ch.gear[slot] = null;
  ch.flags = ch.flags || {};
  // Mana charging is gone. Ilvar's trial is now to invest in an attunement; a mana already filled
  // for the old trial, or an attunement already invested in, passes it.
  if (ch.flags.manaFull || (ch.manaUnlocked && ATTUNE_ATTRS.some((k) => ch.attrs[k] > 0))) ch.flags.sageTrial = true;
  delete ch.mana;
  ch.chestsOpened = ch.chestsOpened || [];
  ch.bossesDefeated = ch.bossesDefeated || [];
  ch.stats = Object.assign({ kills: 0, deaths: 0, playtime: 0, parries: 0 }, ch.stats || {});
  ch.saveVersion = SAVE_VERSION;
  if (dropped.length) console.warn('[save] migrated character; dropped unknown content:', dropped.join(', '));
  return ch;
}
