// What a container holds (a chest, a pouch on the ground, the bank), and moving things between
// it and a character's inventory. Pure: no scene, no UI. game/loot.js and game/bank.js use it,
// and core/migrate.js cleans stored contents with it.
//   contents = { silver, items: { id: n }, weapons: [{ uid, id, enchant, temper }], trinkets: [{ uid, id, pips }] }
// An entry's key: 'silver', 'item:<id>', 'weapon:<uid>' or 'trinket:<uid>'.
import { ITEMS } from '../data/items.js';
import { WEAPONS, ENCHANTS } from '../data/weapons.js';
import { TRINKETS } from '../data/trinkets.js';
import { LOOT } from '../data/loot.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const count = (v) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
let uidN = 0;
const newUid = (p) => p + Date.now().toString(36) + (uidN++).toString(36) + Math.floor(Math.random() * 1e4).toString(36);

export const emptyContents = () => ({ silver: 0, items: {}, weapons: [], trinkets: [] });

// Unknown ids and bad values dropped, the shape restored.
export function cleanContents(c) {
  const out = emptyContents();
  if (!isObj(c)) return out;
  out.silver = count(c.silver);
  if (isObj(c.items)) for (const [id, n] of Object.entries(c.items)) if (ITEMS[id] && count(n)) out.items[id] = count(n);
  for (const w of Array.isArray(c.weapons) ? c.weapons : []) {
    if (!isObj(w) || !WEAPONS[w.id] || WEAPONS[w.id].bare) continue;
    const x = { uid: typeof w.uid === 'string' ? w.uid : newUid('w'), id: w.id, enchant: ENCHANTS[w.enchant] ? w.enchant : null };
    if (count(w.temper)) x.temper = Math.min(3, count(w.temper));
    out.weapons.push(x);
  }
  for (const t of Array.isArray(c.trinkets) ? c.trinkets : []) {
    if (!isObj(t) || !TRINKETS[t.id]) continue;
    const x = { uid: typeof t.uid === 'string' ? t.uid : newUid('t'), id: t.id };
    if (Array.isArray(t.pips)) x.pips = t.pips.filter((p) => isObj(p) && typeof p.mod === 'string' && Number.isFinite(p.v));
    out.trinkets.push(x);
  }
  return out;
}

export function contentsEmpty(c) {
  return !c || (!count(c.silver) && !Object.keys(c.items || {}).length && !(c.weapons || []).length && !(c.trinkets || []).length);
}

const weaponName = (w) => (WEAPONS[w.id] ? WEAPONS[w.id].name : w.id) + (w.temper ? ` +${w.temper}` : '');
const trinketName = (t) => (TRINKETS[t.id] ? TRINKETS[t.id].name : t.id) + (t.pips && t.pips.length ? ' ✦' : '');

// Every entry of a container, as a list a panel can draw.
export function entriesOf(c) {
  const out = [];
  if (!c) return out;
  if (count(c.silver)) out.push({ key: 'silver', kind: 'silver', n: count(c.silver), name: 'Silver', icon: '◉' });
  for (const [id, n] of Object.entries(c.items || {})) out.push({ key: `item:${id}`, kind: 'item', id, n, name: ITEMS[id] ? ITEMS[id].name : id, icon: (ITEMS[id] && ITEMS[id].icon) || '•', desc: ITEMS[id] ? ITEMS[id].desc : '' });
  for (const w of c.weapons || []) out.push({ key: `weapon:${w.uid}`, kind: 'weapon', id: w.id, n: 1, name: weaponName(w), icon: '🗡️', thing: w, rarity: WEAPONS[w.id] && WEAPONS[w.id].rarity });
  for (const t of c.trinkets || []) out.push({ key: `trinket:${t.uid}`, kind: 'trinket', id: t.id, n: 1, name: trinketName(t), icon: '💍', thing: t, rarity: TRINKETS[t.id] && TRINKETS[t.id].rarity });
  return out;
}
export const slotsUsed = (c) => Object.keys(c.items || {}).length + (c.weapons || []).length + (c.trinkets || []).length;

// Take an entry (or n of a stack, or n silver) out of a container. Returns what was taken as a
// small contents object, or null when it is no longer there.
export function takeEntry(c, key, n = Infinity) {
  if (!c || typeof key !== 'string') return null;
  const got = emptyContents();
  if (key === 'silver') {
    const k = Math.min(count(c.silver), n === Infinity ? Infinity : count(n));
    if (!k) return null;
    c.silver -= k;
    got.silver = k;
    return got;
  }
  const [kind, id] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)];
  if (kind === 'item') {
    const have = count(c.items[id]);
    const k = Math.min(have, n === Infinity ? have : count(n));
    if (!k) return null;
    c.items[id] = have - k;
    if (!c.items[id]) delete c.items[id];
    got.items[id] = k;
    return got;
  }
  const list = kind === 'weapon' ? c.weapons : kind === 'trinket' ? c.trinkets : null;
  if (!list) return null;
  const i = list.findIndex((x) => x.uid === id);
  if (i < 0) return null;
  (kind === 'weapon' ? got.weapons : got.trinkets).push(list.splice(i, 1)[0]);
  return got;
}

// Pour one contents object into another (a container or a fresh one).
export function addContents(into, c) {
  into.silver = count(into.silver) + count(c.silver);
  for (const [id, n] of Object.entries(c.items || {})) into.items[id] = count(into.items[id]) + count(n);
  into.weapons.push(...(c.weapons || []));
  into.trinkets.push(...(c.trinkets || []));
  return into;
}

// Why an entry of the character's inventory can't leave it, or null if it can.
export function keepReason(ch, key) {
  if (key.startsWith('item:')) {
    const id = key.slice(5);
    if (!ITEMS[id]) return 'Unknown.';
    if (ITEMS[id].type === 'quest' || LOOT.keep.includes(id)) return `${ITEMS[id].name} stays with you.`;
    return null;
  }
  if (key.startsWith('weapon:')) return ch.equipped && ch.equipped.weapon === key.slice(7) ? 'Unequip it first.' : null;
  if (key.startsWith('trinket:')) return Object.values(ch.gear || {}).includes(key.slice(8)) ? 'Take it off first.' : null;
  return null;
}

// What a character carries that could leave its inventory, as entries.
export function carried(ch) {
  const inv = ch.inventory || {};
  return entriesOf({ silver: ch.silver, items: inv.items || {}, weapons: inv.weapons || [], trinkets: ch.trinkets || [] }).map((e) => ({ ...e, keep: keepReason(ch, e.key) }));
}

// Take things out of a character's inventory into a contents object (to drop or to bank).
// picks: [{ key, n }]. Things that must stay are skipped and listed in `refused`.
export function takeFromInventory(ch, picks) {
  const inv = ch.inventory;
  const view = { silver: ch.silver, items: inv.items, weapons: inv.weapons, trinkets: ch.trinkets || (ch.trinkets = []) };
  const out = emptyContents();
  const refused = [];
  for (const { key, n } of picks) {
    const why = keepReason(ch, key);
    if (why) {
      refused.push(why);
      continue;
    }
    const got = takeEntry(view, key, n ?? Infinity);
    if (got) addContents(out, got);
  }
  ch.silver = view.silver;
  // waterskins carry their own charges
  if (out.items.waterskin) ch.waterCharges = Math.min(ch.waterCharges || 0, (inv.items.waterskin || 0) * 4);
  return { contents: out, refused };
}

// The share of what a character carries that it leaves where it dies (data/loot.js): part of its
// silver, a few of its stacks, perhaps a spare weapon and a loose trinket. Never anything
// equipped, worn, banked or kept. `rand` is injectable for tests.
export function deathShare(ch, rand = Math.random) {
  const D = LOOT.death;
  const picks = [];
  const silver = Math.floor(count(ch.silver) * D.silverShare);
  if (silver) picks.push({ key: 'silver', n: silver });
  const stacks = Object.keys(ch.inventory.items || {}).filter((id) => !keepReason(ch, `item:${id}`));
  for (let i = stacks.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [stacks[i], stacks[j]] = [stacks[j], stacks[i]];
  }
  for (const id of stacks.slice(0, D.maxStacks)) {
    const have = count(ch.inventory.items[id]);
    picks.push({ key: `item:${id}`, n: Math.max(1, Math.round(have * D.itemShare)) });
  }
  const spare = (ch.inventory.weapons || []).filter((w) => !keepReason(ch, `weapon:${w.uid}`));
  if (spare.length && rand() < D.weaponChance) picks.push({ key: `weapon:${spare[Math.floor(rand() * spare.length)].uid}` });
  const loose = (ch.trinkets || []).filter((t) => !keepReason(ch, `trinket:${t.uid}`));
  if (loose.length && rand() < D.trinketChance) picks.push({ key: `trinket:${loose[Math.floor(rand() * loose.length)].uid}` });
  return picks;
}

export { newUid };
