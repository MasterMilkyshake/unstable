// The economy from its tables: what a character earns in each band of Power (quests, kills,
// chests, investigations, the Crucible) against what it would buy there (gear its stats allow,
// tempering, enchanting, the Shrine, rooms and boats), every enemy drop and rate, where Embers
// of Life and Mantra Sparks come from, and how long food and water last.
//   node tools/economy-report.mjs [--json=out.json]
// Static: no game is run. Kill income assumes a share of each band's experience comes from kills
// (KILL_SHARE) at the band's typical enemy level; quests and chests are counted in full.
import { writeFileSync } from 'node:fs';

const root = new URL('../src/', import.meta.url);
const load = (p) => import(new URL(p, root));
const { ENEMIES } = await load('data/enemies.js');
await load('data/story.js');
await load('data/dungeons.js');
const { QUESTS } = await load('data/quests.js');
await load('data/riftSpire.js');
await load('data/riftResearch.js');
const { ITEMS, OUTFITS } = await load('data/items.js');
const { WEAPONS } = await load('data/weapons.js');
const { TRINKETS } = await load('data/trinkets.js');
const { SHOPS } = await load('data/npcs.js');
const { CHESTS } = await load('data/world.js');
const { INVESTIGATIONS } = await load('data/chronicle.js');
const { TRIALS, MARK_SHOP } = await load('data/arena.js');
const { BOATS } = await load('data/boats.js');
const { xpForLevel, START_POINTS, POINTS_PER_LEVEL } = await load('data/stats.js');
let ADV_SHOPS = {};
try {
  ADV_SHOPS = (await load('data/adventure.js')).ADVENTURE_SHOPS || {};
} catch (_) {
  /* optional */
}

const KILL_SHARE = 0.55;
const BANDS = [[1, 5], [6, 10], [11, 15], [16, 20]];
const bandOf = (lvl) => BANDS.findIndex(([a, b]) => lvl >= a && lvl <= b);
const out = { bands: [], drops: [], embers: [], sparks: [], survival: {}, notes: [] };
const mean = (r) => (Array.isArray(r) ? (r[0] + r[1]) / 2 : r || 0);
const powerOf = (q) => q.minLevel || Number(String(q.power || '').split(/[–-]/)[0]) || null;

// ---------------------------------------------------------------- income
const questBand = BANDS.map(() => ({ silver: 0, xp: 0, n: 0 }));
for (const q of Object.values(QUESTS)) {
  const r = q.rewards || {};
  // side quests carry no Power: place them by the level of what they send you to fight
  let lvl = powerOf(q);
  if (!lvl) {
    const objs = q.stages ? q.stages.flatMap((s) => s.objectives || [s]) : q.objectives || [];
    const foes = objs.flatMap((o) => (o.type === 'kill' ? [].concat(o.target) : o.type === 'boss' ? [o.boss] : [])).filter((t) => ENEMIES[t]);
    lvl = foes.length ? Math.round(foes.reduce((a, t) => a + ENEMIES[t].level, 0) / foes.length) : 8;
  }
  const b = questBand[Math.max(0, bandOf(Math.min(20, lvl)))];
  b.silver += r.silver || 0;
  b.xp += r.xp || 0;
  b.n++;
}
const foesAt = (lvl) => Object.entries(ENEMIES).filter(([, e]) => !e.boss && e.level && Math.abs(e.level - lvl) <= 2 && e.xp > 0);
const chestBand = BANDS.map(() => 0);
for (const c of CHESTS) chestBand[0] += 0; // chests are spread over the world: counted in total below
const chestSilver = CHESTS.reduce((a, c) => a + mean(c.loot && c.loot.silver), 0);
const invSilver = INVESTIGATIONS.reduce((a, i) => a + (i.reward.silver || 0), 0);
for (let i = 0; i < BANDS.length; i++) {
  const [a, b] = BANDS[i];
  let xpNeed = 0;
  for (let l = a; l <= b && l < 20; l++) xpNeed += xpForLevel(l);
  const mid = Math.round((a + b) / 2);
  const foes = foesAt(mid);
  const sPerXp = foes.length ? foes.reduce((s, [, e]) => s + mean(e.silver) / e.xp, 0) / foes.length : 0;
  const kills = Math.round((xpNeed * KILL_SHARE) / (foes.length ? foes.reduce((s, [, e]) => s + e.xp, 0) / foes.length : 1));
  const killSilver = Math.round(xpNeed * KILL_SHARE * sPerXp);
  out.bands.push({ band: `${a}-${b}`, xpNeed, kills, killSilver, questSilver: questBand[i].silver, quests: questBand[i].n, income: killSilver + questBand[i].silver });
}
out.bands.push({ band: 'anywhere', chestSilver: Math.round(chestSilver), chests: CHESTS.length, investigationSilver: invSilver, crucible: TRIALS.map((t) => `${t.name} ${t.silver - t.fee} net (Power ${t.power})`) });

// ---------------------------------------------------------------- prices by band
const points = (lvl) => START_POINTS + POINTS_PER_LEVEL * (lvl - 1);
const reqSum = (r) => Object.values(r || {}).reduce((a, b) => a + b, 0);
const shops = { ...SHOPS, ...ADV_SHOPS };
const sold = { weapons: new Set(), outfits: new Set(), items: new Set() };
for (const s of Object.values(shops)) {
  if (s.currency) continue;
  for (const w of s.weapons || []) sold.weapons.add(w);
  for (const o of s.outfits || []) sold.outfits.add(o);
  for (const i of s.items || []) sold.items.add(i);
}
for (let i = 0; i < BANDS.length; i++) {
  const [a, b] = BANDS[i];
  // gear a build can wield by the band's end, if it put about half its points where the gear asks
  const can = (r) => reqSum(r) <= points(b) * 0.5 && Object.values(r || {}).every((v) => v <= points(b) * 0.5) && reqSum(r) > (a === 1 ? -1 : points(a - 1) * 0.25);
  const w = [...sold.weapons].filter((id) => WEAPONS[id] && can(WEAPONS[id].reqs)).map((id) => WEAPONS[id].price || 0);
  const o = [...sold.outfits].filter((id) => OUTFITS[id] && can(OUTFITS[id].reqs)).map((id) => OUTFITS[id].price || 0);
  const t = Object.entries(TRINKETS).filter(([, x]) => x.price && can(x.reqs)).map(([, x]) => x.price);
  const top = (arr) => (arr.length ? Math.max(...arr) : 0);
  const kit = top(w) + top(o) + top(t);
  out.bands[i].prices = { bestWeapon: top(w), bestOutfit: top(o), bestTrinket: top(t), kit, respec: 60 + b * 25, enchant: 300 };
  out.bands[i].kitShare = out.bands[i].income ? Math.round((kit / out.bands[i].income) * 100) : null;
}
const neverSold = Object.entries(ITEMS).filter(([id, it]) => it.price > 0 && !sold.items.has(id)).map(([id]) => id);
out.notes.push(`items with a price but no shop selling them (sell value only): ${neverSold.length}`);
const unaffordable = [];
for (const [sid, s] of Object.entries(shops)) {
  if (s.currency) continue;
  for (const id of s.weapons || []) if (WEAPONS[id] && WEAPONS[id].price > 6000) unaffordable.push(`${sid}: ${id} ${WEAPONS[id].price}`);
  for (const id of s.outfits || []) if (OUTFITS[id] && OUTFITS[id].price > 6000) unaffordable.push(`${sid}: ${id} ${OUTFITS[id].price}`);
}
out.notes.push(`shop goods over 6000 silver: ${unaffordable.join(', ') || 'none'}`);
out.notes.push(`rooms 10 silver; boats ${Object.entries(BOATS).filter(([, b]) => b.rent).map(([k, b]) => `${k} ${b.rent}`).join(', ')}`);

// ---------------------------------------------------------------- drops
for (const [t, e] of Object.entries(ENEMIES)) {
  for (const d of e.drops || []) {
    const known = ITEMS[d.id] || WEAPONS[d.id] || OUTFITS[d.id] || TRINKETS[d.id];
    out.drops.push({ enemy: t, level: e.level, boss: !!e.boss, item: d.id, chance: d.chance, count: d.count || [1, 1], known: !!known, use: ITEMS[d.id] ? ITEMS[d.id].type : d.weapon ? 'weapon' : '' });
  }
}
const dead = out.drops.filter((d) => !d.known || d.chance <= 0);
out.notes.push(`drops of unknown items or at 0%: ${dead.map((d) => `${d.enemy}:${d.item}`).join(', ') || 'none'}`);
// items that nothing uses: no sale price, no quest, no recipe, no craft, not consumable
const usedBy = new Set();
for (const q of Object.values(QUESTS)) for (const o of q.stages ? q.stages.flatMap((s) => s.objectives || [s]) : q.objectives || []) if (o.item) usedBy.add(o.item);
for (const it of Object.values(ITEMS)) for (const k of Object.keys(it.recipe || {})) usedBy.add(k);
for (const t of Object.values(TRINKETS)) for (const k of Object.keys(t.craft || {})) usedBy.add(k);
const deadEnds = [...new Set(out.drops.filter((d) => ITEMS[d.item] && ITEMS[d.item].type === 'material' && !usedBy.has(d.item) && !(ITEMS[d.item].price > 0)).map((d) => d.item))];
out.notes.push(`dropped materials with no use and no sale value: ${deadEnds.join(', ') || 'none'}`);

// ---------------------------------------------------------------- embers and sparks
const sources = (id) => {
  const s = [];
  for (const d of out.drops) if (d.item === id) s.push(`drop ${d.enemy} ${Math.round(d.chance * 100)}%${d.boss ? ' (great foe)' : ''}`);
  for (const q of Object.entries(QUESTS)) for (const [i, n] of q[1].rewards?.items || []) if (i === id) s.push(`quest ${q[0]} ×${n}`);
  for (const c of CHESTS) for (const [i, n] of c.loot?.items || []) if (i === id) s.push(`chest ${c.id} ×${n}`);
  for (const [sid, sh] of Object.entries(shops)) if ((sh.items || []).includes(id)) s.push(`shop ${sid} ${sh.currency ? (sh.shardPrices || {})[id] + ' shards' : ITEMS[id].price + ' silver'}`);
  for (const m of MARK_SHOP) if (m.id === id) s.push(`Crucible ${m.cost} marks`);
  for (const i of INVESTIGATIONS) for (const [it, n] of i.reward.items || []) if (it === id) s.push(`investigation ${i.id} ×${n}`);
  return s;
};
out.embers = sources('ember_of_life');
out.sparks = sources('mantra_spark');

// ---------------------------------------------------------------- food and water
const food = Object.entries(ITEMS).filter(([, it]) => it.hunger || it.water).map(([id, it]) => ({ id, hunger: it.hunger || 0, water: it.water || 0, price: it.price || 0 }));
out.survival = {
  hungerMinutes: Math.round(100 / 0.055 / 60), waterMinutes: Math.round(100 / 0.075 / 60), exertedHunger: Math.round(100 / (0.055 * 1.6) / 60), exertedWater: Math.round(100 / (0.075 * 1.6) / 60),
  starvingHpPerMin: 0.8 * 60, riftSanityPerMin: 0.75 * 60,
  cheapest: food.filter((f) => f.price).map((f) => ({ ...f, silverPerHunger: f.hunger ? +(f.price / f.hunger).toFixed(2) : null, silverPerWater: f.water ? +(f.price / f.water).toFixed(2) : null })).sort((a, b) => (a.silverPerHunger ?? 99) - (b.silverPerHunger ?? 99)).slice(0, 6),
};

// ---------------------------------------------------------------- print
const pad = (s, n) => String(s).padEnd(n);
console.log('Power  xp to clear  kills  kill silver  quest silver (quests)  best weapon/outfit/trinket  kit  kit/income');
for (const b of out.bands.slice(0, 4)) console.log(`${pad(b.band, 6)} ${pad(b.xpNeed, 12)} ${pad(b.kills, 6)} ${pad(b.killSilver, 12)} ${pad(`${b.questSilver} (${b.quests})`, 22)} ${pad(`${b.prices.bestWeapon}/${b.prices.bestOutfit}/${b.prices.bestTrinket}`, 27)} ${pad(b.prices.kit, 5)} ${b.kitShare}%`);
const any = out.bands[4];
console.log(`anywhere: ${any.chests} chests ~${any.chestSilver} silver; investigations ${any.investigationSilver}; Crucible net: ${any.crucible.join('; ')}`);
console.log('\nEmbers of Life:\n  ' + out.embers.join('\n  '));
console.log('\nMantra Sparks:\n  ' + out.sparks.join('\n  '));
console.log(`\nfood lasts ${out.survival.hungerMinutes} min (${out.survival.exertedHunger} exerted), water ${out.survival.waterMinutes} min (${out.survival.exertedWater}); starving costs ${out.survival.starvingHpPerMin} HP/min; the Rift drains ${out.survival.riftSanityPerMin} sanity/min`);
console.log('cheapest food:', out.survival.cheapest.map((f) => `${f.id} ${f.price}s +${f.hunger}h +${f.water}w`).join(', '));
console.log('\nnotes:\n  ' + out.notes.join('\n  '));
const json = (process.argv.find((a) => a.startsWith('--json=')) || '').slice(7);
if (json) writeFileSync(json, JSON.stringify(out, null, 1));
