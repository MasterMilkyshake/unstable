// Content validator: checks every cross-reference between the data files so a typo in
// one table can't become a runtime crash. Run with: node tools/validate-content.mjs
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const src = (p) => path.join(root, 'src', p);
const load = (p) => import(url.pathToFileURL(src(p)).href);

const errors = [];
const warns = [];
const err = (m) => errors.push(m);
const warn = (m) => warns.push(m);

const { WEAPONS, WEAPON_CLASSES, ENCHANTS, RARITY_COLORS, WEAPON_TRAITS } = await load('data/weapons.js');
const { ITEMS, OUTFITS, RECIPES } = await load('data/items.js');
const { MANTRAS, MANTRA_TYPES } = await load('data/mantras.js');
const { TALENTS, TALENT_CATS } = await load('data/talents.js');
const { ENEMIES } = await load('data/enemies.js');
const { QUESTS } = await load('data/quests.js');
const { SHOPS, DIALOGUES } = await load('data/npcs.js');
const { TRINKETS, TRINKET_SLOTS, TRINKET_DROPS, JEWELER_STOCK, JEWELER_CRAFTS } = await load('data/trinkets.js');
const { VOWS } = await load('data/vows.js');
const { LORE, BESTIARY_NOTES } = await load('data/lore.js');
const world = await load('data/world.js');
// The Rift's catalogues push into world.js's tables when loaded, as the game does.
await load('data/rift.js');
await load('data/riftResearch.js');
await load('data/riftSites.js');
// The overworld's points of adventure push their records into world.js's tables when loaded.
await load('data/adventure.js');
await load('data/dungeons.js');
const { ATTACKS, STANCE_FOR_CLASS } = await load('entities/anims.js');
const { ATTRS, ELEMENTS } = await load('data/stats.js');
const { TRIALS, MARK_SHOP } = await load('data/arena.js');
const { CATCH } = await load('data/fishing.js');
const { FORAGE } = await load('world/forage.js');

// behaviors / builders / mesh kinds are read from source text
const runtime = fs.readFileSync(src('combat/mantraRuntime.js'), 'utf8');
const BEHAVIORS = new Set([...runtime.matchAll(/^ {2}([a-zA-Z]+)\(c, m/gm)].map((m) => m[1]));
const creatures = fs.readFileSync(src('entities/creatures.js'), 'utf8');
const builderBlock = creatures.slice(creatures.indexOf('const BUILDERS = {'), creatures.indexOf('const ANIMATORS = {'));
const MODELS = new Set(['humanoid', ...[...builderBlock.matchAll(/^ {2}([a-zA-Z]+)\(c/gm)].map((m) => m[1])]);
const meshSrc = fs.readFileSync(src('entities/weaponMesh.js'), 'utf8');
const MESH_KINDS = new Set([...meshSrc.matchAll(/case '([a-z]+)':/g)].map((m) => m[1]));

const itemOk = (id) => !!ITEMS[id];
const anyOk = (id) => ITEMS[id] || WEAPONS[id] || OUTFITS[id];
// a mantra's element: an attribute it scales with, or a damage type (a vow's bleed bell)
const ELS = new Set([...Object.keys(ATTRS), ...Object.keys(ELEMENTS), 'phys', 'support']);
const NPC_IDS = new Set([...world.NPCS.map((n) => n.id), ...Object.keys(DIALOGUES)]);

// ---------------- weapons
for (const [cls, c] of Object.entries(WEAPON_CLASSES)) {
  for (const a of c.combo) if (!ATTACKS[a]) err(`weapon class ${cls}: combo anim '${a}' missing in anims ATTACKS`);
  if (c.crit && !ATTACKS[c.crit.anim]) err(`weapon class ${cls}: crit anim '${c.crit.anim}' missing`);
  if (c.comboDmg.length !== c.combo.length) warn(`weapon class ${cls}: comboDmg length differs from combo`);
  if (!STANCE_FOR_CLASS[cls]) err(`weapon class ${cls}: no STANCE_FOR_CLASS entry`);
}
for (const [id, w] of Object.entries(WEAPONS)) {
  if (!WEAPON_CLASSES[w.cls]) err(`weapon ${id}: unknown class '${w.cls}'`);
  if (w.enchant && !ENCHANTS[w.enchant]) err(`weapon ${id}: unknown enchant '${w.enchant}'`);
  if (!RARITY_COLORS[w.rarity]) err(`weapon ${id}: unknown rarity '${w.rarity}'`);
  if (w.mesh && w.mesh.kind && !MESH_KINDS.has(w.mesh.kind)) warn(`weapon ${id}: mesh kind '${w.mesh.kind}' falls back to sword`);
  for (const k in w.scaling || {}) if (!ATTRS[k]) err(`weapon ${id}: scaling on unknown attribute '${k}'`);
  // handling (data/weapons.js weaponFeel) and the trait of a rare or named weapon
  for (const [k, lo, hi] of [['reach', -0.3, 0.6], ['speed', 0.85, 1.12], ['chip', 0, 0.3], ['pen', 0, 0.35], ['weight', 0.1, 12]]) {
    if (!Number.isFinite(w[k])) err(`weapon ${id}: no ${k}`);
    else if (w[k] < lo || w[k] > hi) err(`weapon ${id}: ${k} ${w[k]} outside ${lo}..${hi}`);
  }
  if (w.trait && !WEAPON_TRAITS[w.trait]) err(`weapon ${id}: unknown trait '${w.trait}'`);
  if (!w.trait && ['rare', 'epic', 'legendary'].includes(w.rarity) && !w.hidden) err(`weapon ${id}: a ${w.rarity} weapon needs a trait`);
}
// ---------------- mantras
for (const [id, m] of Object.entries(MANTRAS)) {
  if (!BEHAVIORS.has(m.behavior)) err(`mantra ${id}: unknown behavior '${m.behavior}'`);
  if (m.anim && !ATTACKS[m.anim]) err(`mantra ${id}: unknown anim '${m.anim}'`);
  if (!ELS.has(m.el)) err(`mantra ${id}: unknown element '${m.el}'`);
  if (!MANTRA_TYPES[m.type]) err(`mantra ${id}: unknown type '${m.type}'`);
  if (m.vow && !VOWS[m.vow] && !['bell', 'resonance'].includes(m.vow)) err(`mantra ${id}: unknown vow '${m.vow}'`);
  if (m.bell && !ENEMIES[m.bell]) err(`mantra ${id}: bell boss '${m.bell}' is not an enemy`);
}
// ---------------- talents & vows
// every talent flag is read somewhere in the game's code, and every exclusion names a talent
const codeText = (() => {
  const out = [];
  const walk = (d) => {
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, f.name);
      if (f.isDirectory()) walk(p);
      else if (f.name.endsWith('.js') && !p.endsWith(path.join('data', 'talents.js'))) out.push(fs.readFileSync(p, 'utf8'));
    }
  };
  walk(src(''));
  return out.join('\n');
})();
for (const [id, t] of Object.entries(TALENTS)) {
  for (const f of t.flags || []) if (!codeText.includes(`.${f}`) && !codeText.includes(`'${f}'`)) err(`talent ${id}: flag '${f}' is read nowhere`);
  for (const x of t.excludes || []) if (!TALENTS[x]) err(`talent ${id}: excludes unknown talent '${x}'`);
}
for (const [id, t] of Object.entries(TALENTS)) {
  if (!TALENT_CATS.includes(t.cat)) err(`talent ${id}: category '${t.cat}' not in TALENT_CATS`);
  if (t.vow && !VOWS[t.vow]) err(`talent ${id}: unknown vow '${t.vow}'`);
}
for (const [id, v] of Object.entries(VOWS)) {
  for (const t of v.talents || []) if (!TALENTS[t]) err(`vow ${id}: talent '${t}' missing`);
  for (const m of v.mantras || []) if (!MANTRAS[m]) err(`vow ${id}: mantra '${m}' missing`);
}
// ---------------- enemies
const ROLES = ['melee', 'ranged', 'support', 'skirmisher', 'bruiser', 'monster'];
for (const [id, e] of Object.entries(ENEMIES)) {
  // group roles (entities/tactics.js)
  if (e.role && !ROLES.includes(e.role)) err(`enemy ${id}: unknown role '${e.role}'`);
  if ((e.role === 'ranged' || e.role === 'support') && !(Array.isArray(e.keep) && e.keep[0] < e.keep[1])) err(`enemy ${id}: a ${e.role} foe needs keep [near, far]`);
  if (e.role === 'ranged' && !e.ranged && !(e.attacks || []).some((a) => a.type === 'projectile')) err(`enemy ${id}: a ranged foe needs a ranged attack`);
  if (e.role === 'support' && !e.support) err(`enemy ${id}: a support foe needs support actions`);
  for (const pid of e.pattern || []) if (!(e.attacks || []).some((a) => a.id === pid)) err(`enemy ${id}: pattern step '${pid}' is not one of its attacks`);
  if (!MODELS.has(e.model)) err(`enemy ${id}: unknown model '${e.model}'`);
  if (e.model === 'humanoid' && e.weapon && !WEAPONS[e.weapon]) err(`enemy ${id}: unknown weapon '${e.weapon}'`);
  for (const m of e.mantras || []) if (!MANTRAS[m]) err(`enemy ${id}: unknown mantra '${m}'`);
  for (const d of e.drops || []) {
    if (d.outfit) { if (!OUTFITS[d.outfit]) err(`enemy ${id}: drop outfit '${d.outfit}' missing`); }
    else if (d.weapon) { if (!WEAPONS[d.id]) err(`enemy ${id}: drop weapon '${d.id}' missing`); }
    else if (!itemOk(d.id)) err(`enemy ${id}: drop item '${d.id}' missing`);
  }
  if (e.outfitDrop && !OUTFITS[e.outfitDrop]) err(`enemy ${id}: outfitDrop '${e.outfitDrop}' missing`);
  if (e.summons && !ENEMIES[e.summons.type]) err(`enemy ${id}: summons '${e.summons.type}' missing`);
  const ids = [...(e.attacks || []), ...(e.specials || [])].map((a) => a.id);
  const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
  if (dup.length) err(`enemy ${id}: duplicate attack ids ${dup.join(', ')} (LAN replays attacks by id)`);
  for (const a of [...(e.attacks || []), ...(e.specials || [])]) if (a.type === 'mantra' && !MANTRAS[a.mantra]) err(`enemy ${id}: attack mantra '${a.mantra}' missing`);
  // a boss chooses a special only with the player inside its reach (Enemy.chooseAttack)
  for (const sp of e.specials || []) if (sp.type !== 'buff' && !(sp.range > 0) && !(sp.radius > 0)) err(`enemy ${id}: special ${sp.id} has neither range nor radius, so it can never be chosen`);
}
// ---------------- quests
for (const [id, q] of Object.entries(QUESTS)) {
  const objs = q.objectives || [];
  for (const st of q.stages || []) objs.push(...(st.objectives || [st]));
  for (const o of objs) {
    if (o.type === 'kill') for (const t of [].concat(o.target)) if (!ENEMIES[t]) err(`quest ${id}: kill target '${t}' missing`);
    if (o.type === 'collect' && !itemOk(o.item)) err(`quest ${id}: collect item '${o.item}' missing`);
    if (o.type === 'talk' && o.npc && !NPC_IDS.has(o.npc)) warn(`quest ${id}: talk npc '${o.npc}' not found`);
  }
  if (q.turnIn && !NPC_IDS.has(q.turnIn)) warn(`quest ${id}: turnIn npc '${q.turnIn}' not found`);
  const r = q.rewards || {};
  for (const [it] of r.items || []) if (!itemOk(it)) err(`quest ${id}: reward item '${it}' missing`);
  for (const w of r.weapons || []) if (!WEAPONS[w]) err(`quest ${id}: reward weapon '${w}' missing`);
  for (const o of r.outfits || []) if (!OUTFITS[o]) err(`quest ${id}: reward outfit '${o}' missing`);
  for (const t of r.trinkets || []) if (!TRINKETS[t]) err(`quest ${id}: reward trinket '${t}' missing`);
}
// ---------------- shops, trinkets, recipes
for (const [id, s] of Object.entries(SHOPS)) {
  for (const w of s.weapons || []) if (!WEAPONS[w]) err(`shop ${id}: weapon '${w}' missing`);
  for (const o of s.outfits || []) if (!OUTFITS[o]) err(`shop ${id}: outfit '${o}' missing`);
  for (const it of s.items || []) if (!itemOk(it)) err(`shop ${id}: item '${it}' missing`);
}
for (const [id, t] of Object.entries(TRINKETS)) {
  if (!TRINKET_SLOTS[t.slot]) err(`trinket ${id}: unknown slot '${t.slot}'`);
  for (const k in t.craft || {}) if (!itemOk(k)) err(`trinket ${id}: craft material '${k}' missing`);
}
for (const [e, list] of Object.entries(TRINKET_DROPS)) {
  if (!ENEMIES[e]) err(`trinket drops: enemy '${e}' missing`);
  for (const d of list) if (!TRINKETS[d.id]) err(`trinket drops ${e}: trinket '${d.id}' missing`);
}
for (const id of [...JEWELER_STOCK, ...JEWELER_CRAFTS]) if (!TRINKETS[id]) err(`jeweler: trinket '${id}' missing`);
for (const r of RECIPES) {
  if (!itemOk(r.id)) err(`recipe: result '${r.id}' missing`);
  for (const k in r.needs) if (!itemOk(k) && k !== 'waterskin_charge') err(`recipe ${r.id}: ingredient '${k}' missing`);
}
// ---------------- world
for (const s of world.SPAWNERS) if (!ENEMIES[s.type]) err(`spawner at ${s.x},${s.z}: unknown enemy '${s.type}'`);
for (const c of world.CHESTS) {
  for (const [it] of c.loot.items || []) if (!itemOk(it)) err(`chest ${c.id}: item '${it}' missing`);
  if (c.loot.weapon && !WEAPONS[c.loot.weapon]) err(`chest ${c.id}: weapon '${c.loot.weapon}' missing`);
}
const chestIds = world.CHESTS.map((c) => c.id);
for (const d of chestIds.filter((x, i) => chestIds.indexOf(x) !== i)) err(`duplicate chest id '${d}' (saves track opened chests by id)`);
for (const i of world.ISLANDS) if (!world.BIOME_MOOD[i.biome]) warn(`island ${i.id}: biome '${i.biome}' has no BIOME_MOOD`);
// ---------------- systems tables
for (const k in FORAGE) if (!itemOk(FORAGE[k].item)) err(`forage ${k}: item '${FORAGE[k].item}' missing`);
for (const [pool, table] of Object.entries(CATCH)) for (const [, it] of table) if (!itemOk(it)) err(`fishing ${pool}: item '${it}' missing`);
for (const t of TRIALS) for (const w of t.waves) for (const e of w) if (!ENEMIES[e]) err(`crucible ${t.id}: enemy '${e}' missing`);
for (const r of MARK_SHOP) if (!(r.kind === 'trinket' ? TRINKETS[r.id] : r.kind === 'weapon' ? WEAPONS[r.id] : ITEMS[r.id])) err(`mark shop: ${r.kind} '${r.id}' missing`);
for (const k in BESTIARY_NOTES) if (!ENEMIES[k]) warn(`bestiary note for unknown enemy '${k}'`);
const loreIds = LORE.map((l) => l.id);
for (const d of loreIds.filter((x, i) => loreIds.indexOf(x) !== i)) err(`duplicate lore id '${d}'`);

const counts = `${Object.keys(WEAPONS).length} weapons, ${Object.keys(WEAPON_CLASSES).length} classes, ${Object.keys(MANTRAS).length} mantras, ${Object.keys(TALENTS).length} talents, ${Object.keys(ENEMIES).length} enemies, ${Object.keys(QUESTS).length} quests, ${Object.keys(ITEMS).length} items, ${Object.keys(OUTFITS).length} outfits, ${Object.keys(TRINKETS).length} trinkets, ${Object.keys(VOWS).length} vows, ${world.ISLANDS.length} islands, ${world.SPAWNERS.length} spawners`;
console.log(`content: ${counts}`);
for (const w of warns) console.log('warn  ', w);
for (const e of errors) console.log('ERROR ', e);
console.log(errors.length ? `\n${errors.length} error(s), ${warns.length} warning(s)` : `\nOK - no errors, ${warns.length} warning(s)`);
process.exit(errors.length ? 1 : 0);
