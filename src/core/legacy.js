// Legacy: what outlives a wiped character, shared by every slot. The lost (each
// wiped character), Remembrance (earned by its progress, spent at character creation) and one
// heirloom the lost character leaves at the Wash, which the next new character may claim once.
// It keeps its own localStorage key: Save.clearCharacter never touches it.
import { REMEMBRANCE, LEGACY_BOONS, REGISTER_LIMIT } from '../data/legacy.js';
import { MAIN_CHAIN } from '../data/story.js';
import { QUESTS } from '../data/quests.js';
import { ENEMIES } from '../data/enemies.js';
import { RACE_BY_ID } from '../data/races.js';
import { WEAPONS } from '../data/weapons.js';
import { TRINKETS } from '../data/trinkets.js';
import { DUNGEON_ENEMIES } from '../data/dungeons.js';
import { ADVENTURE_ENEMIES } from '../data/adventure.js';

const LEGACY_KEY = 'unstable.legacy.v1';
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const count = (v) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
const str = (v, d = '') => (typeof v === 'string' ? v : d);
// The twelve great foes: the bosses of the story and the open world. A dungeon's keeper and a
// field boss (data/adventure.js) are bosses but not great foes.
const greatFoe = (t) => !!(ENEMIES[t] && ENEMIES[t].boss && !DUNGEON_ENEMIES[t] && !ADVENTURE_ENEMIES[t]);
const greatFoesOf = (ch) => [...new Set((Array.isArray(ch.bossesDefeated) ? ch.bossesDefeated : []).filter(greatFoe))];

export function defaultLegacy() {
  return { remembrance: 0, earned: 0, lost: [], heirloom: null, pending: null };
}

// An heirloom: a weapon ({id, enchant, temper}) or a trinket ({id, pips}), as the character held it.
function cleanHeirloom(h) {
  if (!isObj(h) || (h.kind !== 'weapon' && h.kind !== 'trinket') || typeof h.id !== 'string') return null;
  const out = { kind: h.kind, id: h.id, name: str(h.name, h.id), from: str(h.from), at: count(h.at) };
  if (h.kind === 'weapon') {
    if (typeof h.enchant === 'string') out.enchant = h.enchant;
    if (count(h.temper)) out.temper = Math.min(3, count(h.temper));
  } else if (Array.isArray(h.pips)) out.pips = h.pips.filter((p) => isObj(p) && typeof p.mod === 'string' && Number.isFinite(p.v));
  return out;
}

function cleanEntry(e) {
  if (!isObj(e)) return null;
  return {
    id: str(e.id, 'l' + count(e.at)), name: str(e.name, 'Unnamed'), race: str(e.race), raceName: str(e.raceName),
    level: Math.max(1, count(e.level)), cause: str(e.cause), playtime: count(e.playtime), kills: count(e.kills),
    // chapters/chapter: the stored names from when the story was one chain; they now hold the
    // number of story threads taken up and the latest one's name
    chapters: count(e.chapters), chapter: str(e.chapter), foes: Array.isArray(e.foes) ? e.foes.filter((f) => typeof f === 'string') : [],
    earned: count(e.earned), at: count(e.at), slot: count(e.slot), heirloom: str(e.heirloom), claimedBy: str(e.claimedBy),
  };
}

// Any stored value of the wrong shape falls back to a safe default, field by field.
export function sanitizeLegacy(raw) {
  const l = defaultLegacy();
  if (!isObj(raw)) return l;
  l.remembrance = count(raw.remembrance);
  l.earned = Math.max(count(raw.earned), l.remembrance);
  l.lost = (Array.isArray(raw.lost) ? raw.lost : []).map(cleanEntry).filter(Boolean).slice(-REGISTER_LIMIT);
  l.heirloom = cleanHeirloom(raw.heirloom);
  if (isObj(raw.pending) && typeof raw.pending.entry === 'string' && Array.isArray(raw.pending.options)) {
    const options = raw.pending.options.map(cleanHeirloom).filter(Boolean);
    if (options.length) l.pending = { entry: raw.pending.entry, options };
  }
  return l;
}

// How far a character got: story threads taken up and finished, the last one in journal order.
export function storyProgress(ch) {
  const quests = isObj(ch.quests) ? ch.quests : {};
  let reached = 0;
  let done = 0;
  let furthest = '';
  for (const id of MAIN_CHAIN) {
    const q = quests[id];
    if (!q) continue;
    reached++;
    if (q.state === 'done') done++;
    const def = QUESTS[id];
    if (def) furthest = def.name;
  }
  return { reached, done, furthest };
}

export function remembranceFor(ch) {
  const r = REMEMBRANCE;
  const stats = isObj(ch.stats) ? ch.stats : {};
  const hours = Math.min(r.hourCap, Math.floor(count(stats.playtime) / 3600));
  return r.base + r.perPower * Math.max(0, count(ch.level) - 1) + r.perChapter * storyProgress(ch).done + r.perGreatFoe * greatFoesOf(ch).length + r.perHour * hours;
}

const weaponName = (w) => (WEAPONS[w.id] ? WEAPONS[w.id].name : w.id) + (w.temper ? ` +${w.temper}` : '');
const trinketName = (t) => (TRINKETS[t.id] ? TRINKETS[t.id].name : t.id);

// What a character could leave behind: every weapon but bare fists, every trinket.
export function heirloomOptions(ch) {
  const out = [];
  const inv = isObj(ch.inventory) ? ch.inventory : {};
  for (const w of Array.isArray(inv.weapons) ? inv.weapons : []) {
    if (!w || !WEAPONS[w.id] || WEAPONS[w.id].bare) continue;
    out.push(cleanHeirloom({ kind: 'weapon', id: w.id, enchant: w.enchant, temper: w.temper, name: weaponName(w) }));
  }
  for (const t of Array.isArray(ch.trinkets) ? ch.trinkets : []) {
    if (!t || !TRINKETS[t.id]) continue;
    out.push(cleanHeirloom({ kind: 'trinket', id: t.id, pips: t.pips, name: trinketName(t) }));
  }
  return out;
}

export const Legacy = {
  load() {
    try {
      const raw = localStorage.getItem(LEGACY_KEY);
      return sanitizeLegacy(raw ? JSON.parse(raw) : null);
    } catch (_) {
      return defaultLegacy();
    }
  },
  save(l) {
    try {
      localStorage.setItem(LEGACY_KEY, JSON.stringify(l));
      return true;
    } catch (_) {
      return false;
    }
  },

  // A character's last name-knot is spent: strike it in the register and pay its Remembrance.
  // Once per character (ch.legacyId), so a reload during the death screen can't pay twice.
  record(ch, cause, slot = 0) {
    if (!isObj(ch)) return null;
    const l = this.load();
    if (ch.legacyId) return l.lost.find((e) => e.id === ch.legacyId) || null;
    const at = Date.now();
    const stats = isObj(ch.stats) ? ch.stats : {};
    const prog = storyProgress(ch);
    const foes = greatFoesOf(ch);
    const entry = cleanEntry({
      id: 'l' + at.toString(36) + Math.floor(Math.random() * 1e6).toString(36), name: ch.name, race: ch.race,
      raceName: RACE_BY_ID[ch.race] ? RACE_BY_ID[ch.race].name : str(ch.race), level: ch.level, cause, playtime: stats.playtime,
      kills: stats.kills, chapters: prog.reached, chapter: prog.furthest, foes: foes.map((t) => ENEMIES[t].name),
      earned: remembranceFor(ch), at, slot,
    });
    ch.legacyId = entry.id;
    l.lost.push(entry);
    if (l.lost.length > REGISTER_LIMIT) l.lost.splice(0, l.lost.length - REGISTER_LIMIT);
    l.remembrance += entry.earned;
    l.earned += entry.earned;
    const options = heirloomOptions(ch).map((o) => ({ ...o, from: entry.name }));
    l.pending = options.length ? { entry: entry.id, options } : null;
    this.save(l);
    return entry;
  },

  // The choice on the wipe screen: one of the pending options (by index), or none.
  chooseHeirloom(index) {
    const l = this.load();
    if (!l.pending) return null;
    const pick = Number.isInteger(index) ? l.pending.options[index] : null;
    if (pick) {
      l.heirloom = { ...pick, at: Date.now() };
      const e = l.lost.find((x) => x.id === l.pending.entry);
      if (e) e.heirloom = pick.name;
    }
    l.pending = null;
    this.save(l);
    return pick || null;
  },

  // The heirloom waits for a character created after it was left, and only one may take it.
  claimState(ch) {
    const l = this.load();
    if (!l.heirloom) return { state: 'empty' };
    const started = isObj(ch && ch.stats) ? count(ch.stats.started) : 0;
    if (started < l.heirloom.at) return { state: 'older', heirloom: l.heirloom };
    return { state: 'ready', heirloom: l.heirloom };
  },
  claim(ch) {
    const st = this.claimState(ch);
    if (st.state !== 'ready') return null;
    const l = this.load();
    const h = l.heirloom;
    l.heirloom = null;
    const e = l.lost.slice().reverse().find((x) => x.name === h.from && x.heirloom === h.name && !x.claimedBy);
    if (e) e.claimedBy = str(ch.name);
    this.save(l);
    return h;
  },

  spend(cost) {
    const l = this.load();
    if (!(cost > 0) || l.remembrance < cost) return false;
    l.remembrance -= cost;
    this.save(l);
    return true;
  },
  boon(id) {
    return LEGACY_BOONS[id] || null;
  },
};

// A boon bought at creation, applied to the new character before it wakes.
export function applyBoon(ch, id) {
  const b = LEGACY_BOONS[id];
  if (!b || !isObj(ch)) return false;
  if (b.silver) ch.silver = (ch.silver || 0) + b.silver;
  const items = ch.inventory.items;
  for (const [item, n] of b.items || []) {
    items[item] = (items[item] || 0) + n;
    if (item === 'waterskin') ch.waterCharges = (ch.waterCharges || 0) + 4 * n;
  }
  ch.flags.boons = [...(ch.flags.boons || []), id];
  return true;
}
