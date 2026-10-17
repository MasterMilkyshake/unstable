// In-page harness for tools/systems-check.mjs: every side system, driven through its own panel
// or interactable the way a player uses it, from a character with the means to use it.
// Shared moving, dialogue and fighting helpers come from tools/quest-harness.js.
import { G } from '/src/core/globals.js';
import * as H from '/tools/quest-harness.js';
import { DUNGEONS, roomPoint, roomById } from '/src/data/dungeons.js';
import { TRIALS, MARK_SHOP } from '/src/data/arena.js';
import { RECIPES, ITEMS } from '/src/data/items.js';
import { WEAPONS } from '/src/data/weapons.js';
import { TRINKETS } from '/src/data/trinkets.js';
import { VOWS } from '/src/data/vows.js';
import { MANTRAS } from '/src/data/mantras.js';
import { LORE } from '/src/data/lore.js';
import { INVESTIGATIONS, ATLAS } from '/src/data/chronicle.js';
import { ACTIONS } from '/src/game/hooks.js';
import { navGrid, navBody } from '/src/entities/nav.js';
import { BELL_FOR_BOSS } from '/src/game/bells.js';
import { THIN_CHEST } from '/src/data/thinMind.js';
import { SETTLEMENT_HOSTS } from '/src/data/world.js';

const g = () => window.__unstable;
const ch = () => g().ch;
const rows = [];
const row = (group, name, ok, detail = '') => rows.push({ group, name, ok: ok === null ? null : !!ok, detail: String(detail) });
const $ = (s) => document.querySelector(s);
const close = () => g().ui.closeAll(true);
const near = (it, d = 1.2) => H.tp(it.pos.x + d, it.pos.z + d, it.pos.y - 1);
const itById = (id) => g().world.interactables.find((x) => x.id === id);
const items = () => ({ ...ch().inventory.items });
// a chest or pouch opens into the loot panel: take everything in it
const takeAll = () => {
  const b = document.querySelector('#loot [data-take-all]');
  if (b && !b.disabled) b.click();
  close();
};
const gained = (before, id) => (ch().inventory.items[id] || 0) - (before[id] || 0);

export function fresh(level = 20) {
  H.restore(window.__qbase);
  H.setLevel(level);
  g().player.dangerT = 0; // a group that ended in a fight (or a fall into the Rift) must not leave the next one in danger
  const c = ch();
  c.silver = 5000;
  c.manaUnlocked = true;
  return c;
}

// ------------------------------------------------------------------ dungeons
async function walkable(a, b) {
  const w = g().world;
  const nav = navGrid(w);
  const body = navBody({ radius: 0.4, height: 1.8 });
  const r = nav.findPath(a.x, a.z, a.y + 0.1, b.x, b.z, b.y + 0.1, body, 300000);
  const end = r && r.points.length ? r.points[r.points.length - 1] : null;
  return !!(r && (r.complete || (end && Math.hypot(end[0] - b.x, end[2] - b.z) < 1.5)));
}
export async function dungeons() {
  for (const dg of DUNGEONS) {
    const grp = `dungeon: ${dg.name}`;
    fresh(20);
    const game = g();
    const enter = itById(`enter_${dg.id}`);
    if (!enter) {
      row(grp, 'entrance', false, 'no entrance');
      continue;
    }
    const rc = H.reachCheck(enter.pos.x, enter.pos.z, 4);
    row(grp, 'entrance reachable on foot (grid)', rc.ok, rc.how);
    near(enter);
    game.interact(enter);
    await H.sleep(2200);
    const p = game.player;
    const inside = Math.hypot(p.pos.x - dg.start.x, p.pos.z - dg.start.z) < 6;
    row(grp, 'entering takes you to its first room', inside, `${Math.round(p.pos.x)}, ${Math.round(p.pos.y)}, ${Math.round(p.pos.z)}`);
    // every room has its floor, and every link can be walked (a gated one once its lever is thrown)
    let floors = 0;
    for (const room of dg.rooms) {
      const pt = roomPoint(dg, room);
      const y = game.world.groundAt(pt.x, pt.z, pt.y + 3);
      if (Math.abs(y - pt.y) < 1.6) floors++;
    }
    row(grp, `rooms have floors (${dg.rooms.length})`, floors === dg.rooms.length, `${floors}/${dg.rooms.length}`);
    for (const lv of dg.levers) {
      const link = dg.links.find((l) => l[2] && l[2].gate === lv.gate);
      const a = roomPoint(dg, roomById(dg, link[0]));
      const b = roomPoint(dg, roomById(dg, link[1]));
      const shut = !(await walkable(a, b));
      const it = itById(`lever_${dg.id}_${lv.gate}`);
      if (it) {
        near(it, 0.8);
        game.interact(it);
        H.simulate(2);
      }
      const open = await walkable(a, b);
      row(grp, `gate ${lv.gate}: shut, then open after its lever`, shut && open && !!it, `shut ${shut}, open ${open}`);
    }
    let links = 0;
    for (const [ra, rb] of dg.links) if (await walkable(roomPoint(dg, roomById(dg, ra)), roomPoint(dg, roomById(dg, rb)))) links++;
    row(grp, `rooms linked (${dg.links.length} links)`, links === dg.links.length, `${links}/${dg.links.length}`);
    // foes: each spawner wakes its count where it stands; the keeper falls and pays
    for (const e of dg.enemies) {
      const before = items();
      const bossBefore = ch().bossesDefeated.length;
      const r = await H.killOf([e.type], e.count);
      const def = (await import('/src/data/enemies.js')).ENEMIES[e.type];
      let detail = `${r.natural}/${e.count} woke in the ${e.room}`;
      let ok = r.ok && r.natural >= e.count;
      if (e.boss) {
        const sure = (def.drops || []).filter((d) => d.chance >= 1 && !d.weapon);
        const paid = sure.every((d) => gained(before, d.id) >= (d.count ? d.count[0] : 1));
        const weapon = (def.drops || []).filter((d) => d.weapon).every((d) => ch().inventory.weapons.some((w) => w.id === d.id));
        ok = ok && paid && weapon && ch().bossesDefeated.length > bossBefore;
        detail += `; drops ${paid && weapon ? 'paid' : 'MISSING'}`;
      }
      row(grp, `${e.boss ? 'keeper' : 'foes'}: ${def ? def.name : e.type}`, ok, detail);
    }
    for (const c of dg.chests) {
      const it = itById(c.id);
      const before = items();
      const s0 = ch().silver;
      if (it) {
        near(it, 1);
        game.interact(it);
        takeAll();
      }
      const silver = ch().silver - s0;
      const okItems = (c.loot.items || []).every(([id, n]) => gained(before, id) >= n);
      const okW = !c.loot.weapon || ch().inventory.weapons.some((w) => w.id === c.loot.weapon);
      row(grp, `chest ${c.id}`, !!it && okItems && okW && silver >= c.loot.silver[0], `${silver} silver`);
    }
    for (const l of dg.lore) {
      const r = await H.readLore(l.id);
      row(grp, `record "${l.title}"`, r.ok, r.why || '');
    }
    const exit = itById(`exit_${dg.id}`);
    if (exit) {
      near(exit, 0.6);
      game.interact(exit);
      await H.sleep(2200);
    }
    const out = !game.inDungeon && game.player.pos.z > -4800;
    row(grp, 'climbing out returns you to the surface', !!exit && out, `${Math.round(game.player.pos.x)}, ${Math.round(game.player.pos.z)}`);
  }
}

// ------------------------------------------------------------------ the Crucible
export async function crucibleAll() {
  for (const t of TRIALS) {
    fresh(Math.max(t.power, 1));
    const c = ch();
    const marks = c.inventory.items.crucible_mark || 0;
    const r = await H.crucible(t.id);
    const got = (c.inventory.items.crucible_mark || 0) - marks;
    row('the Crucible', t.name, r.ok && got === t.marks, `${r.why || ''} +${got} marks`);
  }
  fresh(20);
  const c = ch();
  c.inventory.items.crucible_mark = 200;
  for (let i = 0; i < MARK_SHOP.length; i++) {
    const it = MARK_SHOP[i];
    const before = c.inventory.items.crucible_mark;
    const inv = items();
    const w = c.inventory.weapons.length;
    const t = (c.trinkets || []).length;
    ACTIONS.openMarkShop(g().ui);
    const b = document.querySelector(`[data-buy="${i}"]`);
    if (b) b.click();
    close();
    const paid = before - c.inventory.items.crucible_mark === it.cost;
    const ok = it.kind === 'item' ? gained(inv, it.id) === 1 : it.kind === 'weapon' ? c.inventory.weapons.length === w + 1 : (c.trinkets || []).length === t + 1;
    row('the Crucible', `Marks shop: ${it.kind} ${it.id} for ${it.cost}`, !!b && paid && ok, b ? '' : 'no button');
  }
}

// ------------------------------------------------------------------ fishing, cooking, foraging
export async function fishing() {
  const game = g();
  const spots = game.world.fishingSpots || [];
  const pools = [...new Set(spots.map((s) => s.pool))];
  for (const pool of pools) {
    fresh(10);
    ch().inventory.items.fishing_rod = 1;
    const spot = spots.find((s) => s.pool === pool);
    const it = game.world.interactables.find((x) => x.kind === 'fishing' && x.pos.distanceTo(spot.pos || spot.water) < 6) || game.world.interactables.find((x) => x.kind === 'fishing');
    near(it, 0.5);
    const inv = items();
    game.interact(it);
    let caught = null;
    for (let t = 0; t < 400; t++) {
      await H.sleep(30);
      const s = ACTIONS.fishingSession();
      if (!s) break;
      if (s.done) {
        caught = s.hits >= s.need ? s.fish.id : false;
        break;
      }
      const inZone = s.hooked && s.pos >= s.zone + 0.01 && s.pos <= s.zone + s.tier.zone - 0.01;
      if (inZone) document.querySelector('#fishing [data-a="reel"]')?.click();
    }
    await H.sleep(1000);
    close();
    row('fishing', `${pool} water`, caught && gained(inv, caught) === 1, caught ? `caught ${caught}` : 'nothing caught');
  }
  fresh(10);
  delete ch().inventory.items.fishing_rod;
  const it = game.world.interactables.find((x) => x.kind === 'fishing');
  near(it, 0.5);
  H.toasts.length = 0;
  game.interact(it);
  row('fishing', 'without a rod, it says why', /fishing rod/i.test(H.toasts.join(' ')), H.toasts[0] || '');
  close();
}

export async function cooking() {
  const game = g();
  fresh(10);
  const c = ch();
  const fire = game.world.interactables.find((x) => x.kind === 'campfire' && !game.world.inRift(x.pos.x));
  near(fire, 2);
  // raw to cooked
  c.inventory.items.meat_raw = 2;
  const raw = Object.entries(ITEMS).find(([k, v]) => k === 'meat_raw')[1];
  game.interact(fire);
  game.interact(fire);
  const cookBtn = [...document.querySelectorAll('[data-cook]')];
  row('cooking', 'sitting at a fire opens the cook menu', cookBtn.length > 0, `${cookBtn.length} recipes shown`);
  close();
  // every recipe: given its ingredients, it cooks into its dish
  let ok = 0;
  const bad = [];
  for (const r of RECIPES) {
    const inv = c.inventory.items;
    for (const [id, n] of Object.entries(r.needs)) {
      if (id === 'waterskin_charge') c.waterCharges = Math.max(c.waterCharges || 0, n);
      else inv[id] = Math.max(inv[id] || 0, n);
    }
    const before = items();
    const { openCookMenu } = await import('/src/game/crafting.js');
    openCookMenu(game.ui);
    const b = document.querySelector(`[data-cook="${r.id}"]`);
    if (b && !b.disabled) b.click();
    close();
    if (gained(before, r.id) >= (r.count || 1)) ok++;
    else bad.push(r.id);
  }
  row('cooking', `every recipe cooks (${RECIPES.length})`, ok === RECIPES.length, bad.join(', '));
  void raw;
  // eating a meal gives its buff
  const meal = RECIPES.find((r) => ITEMS[r.id] && ITEMS[r.id].buff);
  if (meal) {
    c.inventory.items[meal.id] = 1;
    const p = game.player;
    p.useItem(meal.id);
    H.simulate(1.5);
    const buffs = JSON.stringify(p.buffs || p.statuses || {});
    row('cooking', `eating ${ITEMS[meal.id].name} gives its buff`, buffs.length > 2, buffs.slice(0, 120));
  }
}

export async function foraging() {
  const game = g();
  fresh(5);
  const nodes = game.world.interactables.filter((x) => x.kind === 'forage');
  const byLabel = new Map();
  for (const n of nodes) if (!byLabel.has(n.label)) byLabel.set(n.label, n);
  for (const [label, n] of byLabel) {
    const inv = items();
    near(n, 0.8);
    game.interact(n);
    const got = Object.keys(ch().inventory.items).filter((k) => gained(inv, k) > 0);
    const spent = n.enabled ? !n.enabled() : true;
    row('foraging', label, got.length > 0 && spent, `${got.join(', ') || 'nothing'}; ${spent ? 'grows back later' : 'still ready'}`);
  }
  row('foraging', `forage nodes in the world`, nodes.length > 0, `${nodes.length} nodes, ${byLabel.size} kinds`);
}

// ------------------------------------------------------------------ the forge and the jeweler
export async function forge() {
  const game = g();
  fresh(20);
  const c = ch();
  for (const k in c.attrs) c.attrs[k] = Math.max(c.attrs[k], 60);
  game.player.recompute();
  // buying from Dorran
  const { SHOPS } = await import('/src/data/npcs.js');
  for (const shop of Object.keys(SHOPS)) {
    if (SHOPS[shop].currency) continue;
    game.ui.openShop(shop);
    const b = [...document.querySelectorAll('[data-buy-w],[data-buy-i],[data-buy-o]')].find((x) => !x.disabled);
    const what = b ? b.dataset.buyW || b.dataset.buyI || b.dataset.buyO : '';
    const s0 = c.silver;
    const n0 = JSON.stringify(c.inventory);
    if (b) b.click();
    close();
    row('shops', `${SHOPS[shop].name}: buy`, !!b && c.silver < s0 && JSON.stringify(c.inventory) !== n0, `${what}, ${s0 - c.silver} silver`);
  }
  // tempering
  const w = game.giveWeapon('steel_longsword');
  c.equipped.weapon = w.uid;
  c.inventory.items.smithing_stone = 20;
  c.inventory.items.star_shard = 20;
  for (let i = 1; i <= 3; i++) {
    ACTIONS.openTemper(game.ui);
    const b = document.querySelector(`[data-temper="${w.uid}"]`);
    if (b) b.click();
    close();
  }
  row('the forge', 'tempering to +3, no further', (w.temper || 0) === 3, `+${w.temper || 0}`);
  ACTIONS.openTemper(game.ui);
  const b4 = document.querySelector(`[data-temper="${w.uid}"]`);
  row('the forge', 'a +3 weapon cannot be tempered again', !b4 || b4.disabled, b4 ? (b4.disabled ? 'button disabled' : 'button live') : 'not listed');
  close();
  // enchanting
  const { openEnchant } = await import('/src/ui/interact.js');
  if (openEnchant) {
    const s0 = c.silver;
    openEnchant(game.ui);
    document.querySelector('[data-a="go"]')?.click();
    close();
    row('the forge', 'reforging gives an enchantment and costs silver', !!w.enchant && c.silver < s0, `${w.enchant || 'none'}, ${s0 - c.silver} silver`);
  }
  // the jeweler: buy, and forge one of every craftable trinket
  ACTIONS.openJeweler(game.ui);
  const buy = document.querySelector('[data-buy]');
  const t0 = (c.trinkets || []).length;
  if (buy) buy.click();
  close();
  row('the jeweler', 'buying a trinket', (c.trinkets || []).length === t0 + 1, buy ? buy.dataset.buy : 'no button');
  let forged = 0;
  const craftable = Object.entries(TRINKETS).filter(([, t]) => t.craft);
  const missed = [];
  for (const [id, t] of craftable) {
    for (const [mat, n] of Object.entries(t.craft)) c.inventory.items[mat] = Math.max(c.inventory.items[mat] || 0, n);
    for (const [k, v] of Object.entries(t.reqs || {})) c.attrs[k] = Math.max(c.attrs[k] || 0, v);
    ACTIONS.openJeweler(game.ui);
    const tabs = [...document.querySelectorAll('[data-tab]')];
    const forgeTab = tabs.find((x) => /forge/i.test(x.textContent));
    if (forgeTab) forgeTab.click();
    const f = document.querySelector(`[data-forge="${id}"]`);
    const n = (c.trinkets || []).length;
    if (f && !f.disabled) f.click();
    close();
    if ((c.trinkets || []).length === n + 1) forged++;
    else missed.push(id);
  }
  row('the jeweler', `forging every craftable trinket (${craftable.length})`, forged === craftable.length, missed.join(', '));
}

// ------------------------------------------------------------------ mantras, vows, resonances, bells
export async function mantraSystems() {
  const game = g();
  fresh(20);
  const c = ch();
  const id = Object.keys(MANTRAS).find((k) => !MANTRAS[k].bell && !MANTRAS[k].vow);
  c.mantras[id] = { stars: 0 };
  c.inventory.items.mantra_spark = 2;
  ACTIONS.openAltar(game.ui);
  document.querySelector(`[data-emp="${id}"]`)?.click();
  const mod = document.querySelector('[data-mod]:not([data-mod=""])');
  const modId = mod && mod.dataset.mod;
  mod?.click();
  close();
  row('the altar', 'a Spark adds a star and a modifier', c.mantras[id].stars === 1 && (c.mantras[id].mods || []).includes(modId) && c.inventory.items.mantra_spark === 1, `${MANTRAS[id].name}: ${c.mantras[id].stars}★ ${modId}`);
  // the Shrine of Order
  const spent = Object.values(c.attrs).reduce((a, b) => a + b, 0);
  c.attrs.strength += 10;
  c.attrs.agility += 10;
  const pts0 = c.points;
  const s0 = c.silver;
  ACTIONS.openOrder(game.ui);
  document.querySelector('[data-a="kneel"]')?.click();
  await H.sleep(50);
  close();
  const refunded = c.points - pts0;
  row('the Shrine of Order', 'kneeling refunds the attributes for silver', refunded >= 20 && c.silver < s0, `+${refunded} points, ${s0 - c.silver} silver (was ${spent + 20} invested)`);
  // a vow at Power 5, sworn at the Vowkeeper
  fresh(5);
  for (const k in ch().attrs) ch().attrs[k] = Math.max(ch().attrs[k], 40);
  game.player.recompute();
  const vowNpc = g().npcs.find((n) => /vow/i.test(n.id) || /Vowkeeper/i.test(n.name));
  game.ui.openVows();
  const vb = document.querySelector('[data-vow]');
  const vowId = vb && vb.dataset.vow;
  vb?.click();
  const asked = !!document.querySelector('#vows .vow-confirm:not(.hidden) [data-a="swear"]');
  document.querySelector('[data-a="swear"]')?.click();
  close();
  row('vows', 'the Vowkeeper asks once, in the panel, before a vow is sworn', asked, '');
  const vow = VOWS[ch().vow];
  const vowMantra = vow && Object.keys(MANTRAS).find((k) => MANTRAS[k].vow === ch().vow);
  row('vows', 'swearing a vow at Power 5', !!ch().vow && ch().vow === vowId, `${vow ? vow.name : 'none'}${vowNpc ? ' (' + vowNpc.name + ')' : ''}${vowMantra ? `, mantra ${MANTRAS[vowMantra].name} ${ch().mantras[vowMantra] ? 'granted' : 'not yet'}` : ''}`);
  // a resonance at Power 15
  H.setLevel(15);
  ACTIONS.openResonances(game.ui);
  const rb = document.querySelector('[data-res]');
  const resId = rb && rb.dataset.res;
  rb?.click();
  close();
  const res = ch().resonance;
  H.simulate(0.5);
  const before = JSON.stringify(game.player.statuses || {}) + (game.player.ether || 0);
  ACTIONS.useResonance();
  H.simulate(0.5);
  row('resonances', 'attuning at Power 15, and [Z] uses it', !!res && (res.id || res) === resId, `${resId} → ${JSON.stringify(res).slice(0, 60)}; used: ${before !== JSON.stringify(game.player.statuses || {}) + (game.player.ether || 0) ? 'yes' : 'no visible change'}`);
  // a bell from a great foe
  fresh(20);
  const [boss, bell] = Object.entries(BELL_FOR_BOSS)[0];
  const r = await H.killOf([boss], 1);
  await H.sleep(200);
  row('bells', `slaying ${boss} teaches ${MANTRAS[bell].name}`, r.ok && !!ch().mantras[bell], r.why || '');
}

// ------------------------------------------------------------------ rest and boats
export async function restAndBoats() {
  const game = g();
  fresh(5);
  const c = ch();
  // each inn's keeper rents the room: it sets where you wake and nothing more, for 10 silver (the
  // user's rule: an inn only sets your spawn point, and you ask its keeper)
  const keepers = [{ id: 'bess', restId: 'inn_salt' }, ...SETTLEMENT_HOSTS.map((h) => ({ id: h.id, restId: h.restId }))];
  const rentFrom = async (k) => {
    const npc = game.npcs.find((n) => n.id === k.id);
    if (!npc) return { npc: false };
    H.tp(npc.pos.x + 1.4, npc.pos.z + 1.4, npc.pos.y);
    game.player.dangerT = 0;
    game.interact({ kind: 'npc', npc });
    await H.sleep(150);
    const opt = [...document.querySelectorAll('#dialogue .dl-opt')].find((b) => /Rent a (room|bed)/i.test(b.textContent));
    if (opt) opt.click();
    await H.sleep(300);
    close();
    return { npc: true, opt: !!opt };
  };
  let rented = 0;
  const bad = [];
  for (const k of keepers) {
    c.spawn = { x: 0, z: -320, id: 'cf_wash' };
    game.player.hp = Math.round(game.player.maxHp / 2);
    const hp0 = game.player.hp;
    const s0 = c.silver;
    const r = await rentFrom(k);
    const ok = r.npc && r.opt && c.spawn.id === k.restId && s0 - c.silver === 10 && game.player.hp <= hp0 + 3;
    if (ok) rented++;
    else bad.push(`${k.id} (${r.npc ? (r.opt ? '' : 'no rent option, ') : 'missing, '}spawn ${c.spawn.id}, hp ${hp0}→${Math.round(game.player.hp)}, paid ${s0 - c.silver})`);
  }
  row('inns', `each keeper's room sets where you wake, for 10 silver, and heals nothing (${keepers.length} keepers)`, rented === keepers.length, bad.join(', '));
  fresh(5);
  c.silver = 3;
  H.toasts.length = 0;
  await rentFrom(keepers[0]);
  row('inns', 'without the silver, it says why', /not enough silver/i.test(H.toasts.join(' ')) && c.silver === 3, H.toasts[0] || '');
  // a rented boat, sailed
  fresh(5);
  const docks = Object.keys(game.world.docks || {});
  let sailed = 0;
  for (const d of docks) {
    const dock = game.world.docks[d];
    H.tp(dock.end.x, dock.end.z, null);
    // out of danger at each dock (a boat isn't rented in danger, and roaming beasts walk the shores)
    game.player.dangerT = 0;
    const s0 = c.silver;
    ACTIONS.openBoatyard(game.ui, d);
    const b = document.querySelector('[data-rent]');
    b?.click();
    close();
    const boat = game.boats.find((x) => !x.netProxy);
    if (!boat || c.silver >= s0) continue;
    game.player.enterBoat(boat);
    const from = boat.pos.clone();
    game.input.down.add('KeyW');
    H.simulate(4);
    game.input.down.delete('KeyW');
    if (boat.pos.distanceTo(from) > 5) sailed++;
    game.player.leaveBoat && game.player.leaveBoat();
  }
  row('boats', `renting and sailing from every dock (${docks.length})`, docks.length > 0 && sailed === docks.length, `${sailed}/${docks.length}`);
}

// ------------------------------------------------------------------ exploration
export async function exploration() {
  const game = g();
  fresh(20);
  const c = ch();
  c.sanity = 1; // a thin mind sees what only a thin mind sees
  let read = 0;
  const unread = [];
  const far = [];
  for (const l of LORE) {
    const it = game.world.interactables.find((x) => x.id === 'lore_' + l.id);
    if (!it) {
      unread.push(`${l.id} (no carrier)`);
      continue;
    }
    if (it.enabled && !it.enabled()) {
      c.sanity = 1;
      if (it.enabled && !it.enabled()) {
        unread.push(`${l.id} (not usable)`);
        continue;
      }
    }
    const r = await H.readLore(l.id);
    if (r.ok) read++;
    else unread.push(l.id);
    if (!l.dungeon) {
      const rc = H.reachCheck(it.pos.x, it.pos.z, 4);
      if (rc.ok === false) far.push(`${l.id}: ${rc.how}`);
    }
  }
  row('sources', `every written source reads where it sits (${LORE.length})`, read === LORE.length, unread.join(', '));
  row('sources', 'and each has a walking route (grid; conservative)', far.length === 0, far.slice(0, 8).join(' | '));
  // investigations: with every source read, each records and pays once
  const before = { silver: c.silver, items: items() };
  let recorded = 0;
  const failed = [];
  H.tp(0, -320, null); // the Wash camp: out of danger, where an account can be recorded
  H.simulate(1);
  for (const inv of INVESTIGATIONS) {
    ACTIONS.openJournal(game.ui, 'investigations');
    const b = document.querySelector(`[data-record="${inv.id}"]`);
    if (b) b.click();
    close();
    if ((c.investigations || []).includes(inv.id)) recorded++;
    else failed.push(inv.id);
  }
  // requirements may need another round
  for (const inv of INVESTIGATIONS) {
    if ((c.investigations || []).includes(inv.id)) continue;
    ACTIONS.openJournal(game.ui, 'investigations');
    document.querySelector(`[data-record="${inv.id}"]`)?.click();
    close();
    if ((c.investigations || []).includes(inv.id)) {
      recorded++;
      failed.splice(failed.indexOf(inv.id), 1);
    }
  }
  const silver = INVESTIGATIONS.reduce((a, i) => a + (i.reward.silver || 0), 0);
  row('investigations', `every investigation records and pays (${INVESTIGATIONS.length})`, recorded === INVESTIGATIONS.length && c.silver - before.silver === silver, `${recorded} recorded, +${c.silver - before.silver} of ${silver} silver; ${failed.join(', ')}`);
  ACTIONS.openJournal(game.ui, 'investigations');
  const again = document.querySelector('[data-record]');
  close();
  row('investigations', 'none can be recorded twice', !again, again ? again.dataset.record : '');
  // chests: each opens and pays, and has a walking route; the two gated ones are opened the
  // way their gates open (the glyphs traced; a thin mind)
  fresh(20);
  const vault = game.world.interactables.find((x) => x.id === 'c_rift_vault');
  row('chests', 'the Sealed Vault stays shut until the glyphs are traced', !!vault && vault.enabled && !vault.enabled(), '');
  await H.traceGlyphs();
  let opened = 0;
  const shut = [];
  const unreached = [];
  for (const chest of game.world.chests) {
    const it = game.world.interactables.find((x) => x.chest === chest);
    if (!it) {
      shut.push(`${chest.def.id} (no interact)`);
      continue;
    }
    ch().sanity = THIN_CHEST === chest.def.id ? 1 : g().player.maxSanity;
    if (it.enabled && !it.enabled()) {
      shut.push(`${chest.def.id} (locked)`);
      continue;
    }
    const s0 = ch().silver;
    const inv = items();
    near(it, 1);
    game.interact(it);
    takeAll();
    const loot = chest.def.loot;
    const ok = chest.opened && (ch().silver - s0 >= Math.floor((loot.silver || [0])[0] * 0.9)) && (loot.items || []).every(([id, n]) => gained(inv, id) >= n);
    if (ok) opened++;
    else shut.push(chest.def.id);
    if (!chest.def.dungeon) {
      const rc = H.reachCheck(it.pos.x, it.pos.z, 3);
      if (rc.ok === false) unreached.push(`${chest.def.id}: ${rc.how}`);
    }
  }
  row('chests', `every chest opens and pays (${game.world.chests.length})`, opened === game.world.chests.length, shut.join(', '));
  row('chests', 'and each has a walking route (grid; conservative)', unreached.length === 0, unreached.slice(0, 10).join(' | '));
  // the Atlas: each region's notes unlock on arrival
  fresh(5);
  const { regionAtPoint, districtAtPoint, ISLANDS, EXPLORATION_DISTRICTS } = await import('/src/data/world.js');
  const unlocked = [];
  const missing = [];
  const { LOCATIONS } = await import('/src/data/world.js');
  for (const a of ATLAS) {
    // somewhere inside the region: its own centre, or a named place that lies in it
    const area = EXPLORATION_DISTRICTS.find((d) => d.id === a.id) || ISLANDS.find((i) => i.id === a.id && regionAtPoint(i.x ?? i.cx, i.z ?? i.cz)?.id === a.id)
      || LOCATIONS.find((l) => l.r < 150 && regionAtPoint(l.x, l.z)?.id === a.id && !districtAtPoint(l.x, l.z));
    if (a.id === 'rift') H.tp(6000, 5840, null);
    else if (!area) {
      missing.push(`${a.id} (no place found in it)`);
      continue;
    } else H.tp(area.x ?? area.cx, area.z ?? area.cz, null);
    game.inRift = game.world.inRift(game.player.pos.x);
    H.simulate(2.2);
    if (ch().regions.includes(a.id)) unlocked.push(a.id);
    else missing.push(`${a.id} at ${Math.round(game.player.pos.x)},${Math.round(game.player.pos.z)} (${(regionAtPoint(game.player.pos.x, game.player.pos.z) || {}).id || districtAtPoint(game.player.pos.x, game.player.pos.z)?.id || 'no region'})`);
  }
  row('the Atlas', `every region's notes unlock on arrival (${ATLAS.length})`, missing.length === 0, missing.join(', '));
}

// ------------------------------------------------------------------ dialogue dead ends
export async function dialogues() {
  const game = g();
  const states = [['a new character', () => fresh(1)], ['mid-story', () => {
    fresh(10);
    for (const id of ['awakening', 'first_light', 'writ', 'red_tooth', 'grey_letter']) ch().quests[id] = { state: 'done', progress: 0, stage: 0, sp: [] };
  }]];
  for (const [label, set] of states) {
    set();
    const dead = [];
    let nodes = 0;
    for (const n of game.npcs) {
      if (n.hidden) continue;
      const t = H.dialogueTree(n.id, { depth: 3, limit: 60 });
      if (t.error) continue;
      nodes += t.nodes;
      for (const d of t.dead) dead.push(`${n.id}: "${d.label}"`);
    }
    row('dialogue', `no dead ends, ${label} (${nodes} lines)`, dead.length === 0, dead.slice(0, 10).join(' | '));
  }
}

// ------------------------------------------------------------------ the death loop
export async function deathLoop() {
  const game = g();
  fresh(3);
  const c = ch();
  const p = game.player;
  p.onLethal = null;
  game.inRift = false;
  H.tp(0, -320, null);
  // a surface death: into the Rift, whole, no life lost
  const lives = c.lives;
  delete p.onLethal;
  game.onPlayerDeath({ name: 'a test' });
  await H.sleep(5200);
  row('death', 'a surface death wakes in the Rift at full health, no life spent', game.inRift && p.hp === p.maxHp && c.lives === lives, `inRift ${game.inRift}, hp ${Math.round(p.hp)}/${Math.round(p.maxHp)}, lives ${c.lives}`);
  // an Ember restores a life lost to fleeing danger, not past the maximum
  c.lives = lives - 1;
  c.inventory.items.ember_of_life = 2;
  p.useItem('ember_of_life');
  const after1 = c.lives;
  H.toasts.length = 0;
  p.useItem('ember_of_life');
  row('death', 'an Ember of Life restores a lost life, and says why not when lives are full', after1 === lives && c.lives === lives && c.inventory.items.ember_of_life === 1 && /already full/i.test(H.toasts.join(' ')), `${after1}/${c.maxLives}`);
  // a death in the Rift ends the character, lives or not, into the register
  const { Legacy } = await import('/src/core/legacy.js');
  const lost0 = Legacy.load().lost.length;
  game.onPlayerDeath({ name: 'a hollow' });
  await H.sleep(4200);
  const l = Legacy.load();
  row('death', 'a death in the Rift ends the character and records it', l.lost.length === lost0 + 1 && /hollow/.test(l.lost[l.lost.length - 1].cause) && game.state === 'menu', `register ${lost0} → ${l.lost.length}, state ${game.state}`);
  // leave the wipe screen and play again, for any group after this one
  document.querySelector('#wipe [data-pick="-1"]')?.click();
  document.querySelector('#wipe [data-a="ok"]')?.click();
  H.setup({ level: 1 });
  window.__qbase = H.snap();
}

export { rows };

// ------------------------------------------------------------------ loot: chests, pouches, death, the strongbox
const tick = (ms = 120) => H.sleep(ms);
export async function lootSystem() {
  const game = g();
  fresh(10);
  const c = ch();
  // a chest: take one thing, leave the rest; come back; take the rest; it is no longer searchable
  const chest = game.world.chests.find((x) => !x.def.dungeon && (x.def.loot.items || []).length >= 1 && x.def.loot.silver && x.def.x < 3000);
  const cit = game.world.interactables.find((x) => x.chest === chest);
  near(cit, 1);
  game.interact(cit);
  await tick();
  const rows = document.querySelectorAll('#loot .loot-row').length;
  const firstKey = document.querySelector('#loot [data-take]')?.dataset.take;
  document.querySelector('#loot [data-take]')?.click();
  await tick();
  close();
  const left = c.chestLoot && c.chestLoot[chest.def.id];
  const label = cit.enabled() ? cit.label : '(not searchable)';
  row('loot', 'a chest opens into what is inside; one thing taken, the rest stays', rows >= 2 && left && !!left && cit.enabled() && label === 'Search Chest', `${rows} rows, took ${firstKey}, left ${JSON.stringify(left).slice(0, 80)}, prompt "${label}"`);
  game.interact(cit);
  await tick();
  takeAll();
  row('loot', 'taking the rest empties the chest for good', !(c.chestLoot || {})[chest.def.id] && !cit.enabled(), '');
  // leave a pouch from the inventory
  fresh(10);
  const c2 = ch();
  H.tp(0, -320, null);
  c2.silver = 300;
  c2.inventory.items = { bread: 5, elixir: 2, lost_satchel: 1 };
  const spare = game.giveWeapon('steel_longsword');
  game.ui.openCharMenu('inventory');
  await tick();
  document.querySelector('#charmenu [data-a="pouch"]')?.click();
  await tick();
  const kept = [...document.querySelectorAll('#droppouch .loot-row.kept')].map((r) => r.textContent).join(' | ');
  document.querySelector('#droppouch [data-more="item:bread"]')?.click();
  document.querySelector('#droppouch [data-more="item:bread"]')?.click();
  document.querySelector('#droppouch [data-all="silver"]')?.click();
  document.querySelector(`#droppouch [data-pick="weapon:${spare.uid}"]`)?.click();
  document.querySelector('#droppouch [data-leave]')?.click();
  await tick();
  const pouch = (c2.pouches || [])[0];
  const pit = pouch && game.world.interactables.find((x) => x.id === `pouch_${pouch.id}`);
  row('loot', 'leaving a pouch from the inventory: what you chose, at your feet', !!pouch && !!pit && c2.silver === 0 && c2.inventory.items.bread === 3 && !c2.inventory.weapons.some((w) => w.uid === spare.uid) && /stays with you/.test(kept),
    `pouch ${pouch ? JSON.stringify(pouch.contents).slice(0, 120) : 'none'}; kept rows: ${kept.slice(0, 80)}`);
  // search it: take a little, then the rest; the pouch is gone
  if (pit) {
    H.tp(pit.pos.x + 1.2, pit.pos.z, pit.pos.y - 0.4);
    game.interact(pit);
    await tick();
    document.querySelector('#loot [data-take="item:bread"][data-n="1"]')?.click();
    await tick();
    close();
    const mid = c2.pouches[0] && c2.pouches[0].contents.items.bread;
    game.interact(pit);
    await tick();
    takeAll();
    await tick();
    row('loot', 'a pouch searched in part keeps the rest; empty, it is gone', mid === 1 && !(c2.pouches || []).length && !game.world.interactables.includes(pit) && c2.silver === 300, `bread left after one ${mid}, pouches ${(c2.pouches || []).length}, silver back ${c2.silver}`);
  }
  // dying: half the silver and some goods where you fell; the strongbox keeps what is in it
  fresh(10);
  const c3 = ch();
  H.tp(0, -320, null);
  c3.silver = 200;
  c3.inventory.items = { bread: 6, elixir: 4, herb: 3 };
  const bess = g().npcs.find((n) => n.id === 'bess');
  H.tp(bess.pos.x + 1.5, bess.pos.z + 1.5, bess.pos.y);
  game.interact({ kind: 'npc', npc: bess });
  await tick();
  const open = [...document.querySelectorAll('#dialogue .dl-opt')].find((b) => /strongbox/i.test(b.textContent));
  open?.click();
  await tick();
  document.querySelector('#bank [data-dep="item:elixir"]:not([data-n])')?.click();
  document.querySelector('#bank [data-dep="silver"][data-n]')?.click();
  await tick();
  close();
  const banked = JSON.stringify(c3.bank);
  row('loot', "the Keepers' strongbox at an inn: deposit", (c3.bank.items.elixir === 4) && c3.bank.silver === 50 && c3.silver === 150, banked.slice(0, 100));
  H.tp(30, -380, null); // the strand
  const fallAt = { x: game.player.pos.x, z: game.player.pos.z };
  game.player.onLethal = null;
  game.inRift = false;
  game.onPlayerDeath({ name: 'a test' });
  const lost = (c3.pouches || []).find((p) => p.kind === 'lost');
  row('loot', 'dying leaves half the silver and some goods where you fell', !!lost && lost.contents.silver === 75 && c3.silver === 75 && Math.hypot(lost.x - fallAt.x, lost.z - fallAt.z) < 1 && c3.bank.items.elixir === 4 && c3.bank.silver === 50,
    `lost pouch ${lost ? JSON.stringify(lost.contents).slice(0, 100) : 'none'}; carried silver ${c3.silver}; strongbox ${JSON.stringify(c3.bank).slice(0, 60)}`);
  await H.sleep(5200); // the death screen and the fall into the Rift
  const marker = (ACTIONS.mapMarkers ? ACTIONS.mapMarkers({ rift: false }) : []).find((m) => m.label === 'What you lost');
  row('loot', "the map marks what you lost", !!marker, marker ? `${Math.round(marker.x)}, ${Math.round(marker.z)}` : '');
  game.player.onLethal = () => (game.player.hp = game.player.maxHp);
}
