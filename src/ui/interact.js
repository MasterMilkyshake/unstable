import { placedPoint } from '../data/worldPlacement.js';
// In-world interaction screens: dialogue, shops, ferries, campfires, the mantra
// altar, notice board, vows, enchanting and the map.
import { G } from '../core/globals.js';
import { DIALOGUES, SHOPS } from '../data/npcs.js';
import { worldDialogue } from '../data/testimonies.js';
import { FERRY_NPCS, ISLANDS, REGIONS, LOCATIONS, STRUCTURES, NPCS, CHESTS, islandAtPoint } from '../data/world.js';
import { ITEMS, OUTFITS } from '../data/items.js';
import { WEAPONS, WEAPON_CLASSES, ENCHANTS, RARITY_COLORS, weaponDisplayName, weaponFeelText } from '../data/weapons.js';
import { MANTRAS, MAX_STARS } from '../data/mantras.js';
import { VOWS } from '../data/vows.js';
import { TALENTS } from '../data/talents.js';
import { meetsReqs, reqsText, ELEMENTS } from '../data/stats.js';
import { escapeHtml, choice } from '../core/util.js';
import { settledRuns } from '../world/wayfinding.js';
import { openCookMenu } from '../game/crafting.js';
import { ACTIONS } from '../game/hooks.js';
import { keyText } from '../core/input.js';

const $ = (s, r = document) => r.querySelector(s);

// ------------------------------------------------------------ dialogue
function makeApi(ui, npc) {
  const game = ui.game;
  const ch = game.ch;
  return {
    quest: (id) => game.quests.get(id),
    startQuest: (id) => game.quests.start(id),
    completeQuest: (id) => game.quests.complete(id),
    travel: (dock) => {
      // No dock teleport — send them to rent a boat instead.
      ui.closeModal();
      openFerry(ui, dock);
    },
    rest: (id, cost) => {
      ui.closeModal();
      game.rest(id, cost);
    },
    // sit at a nearby fire from a conversation (Old Wren's): step to its side, facing it, and
    // sit, the same as [E] there
    sitByFire: (id) => {
      ui.closeModal();
      const p = game.player;
      const it = game.world.interactables.find((x) => x.id === id);
      if (!it || Math.hypot(p.pos.x - it.pos.x, p.pos.z - it.pos.z) > 15) return ui.toast('The fire is too far off.', 'bad');
      const dx = p.pos.x - it.pos.x;
      const dz = p.pos.z - it.pos.z;
      const d = Math.hypot(dx, dz) || 1;
      const x = it.pos.x + (dx / d) * 1.6;
      const z = it.pos.z + (dz / d) * 1.6;
      p.pos.set(x, game.world.groundAt(x, z, it.pos.y + 2) + 0.05, z);
      p.vel.set(0, 0, 0);
      p.yaw = Math.atan2(it.pos.x - x, it.pos.z - z);
      openCampfire(ui, it);
    },
    openShop: (id) => openShop(ui, id),
    openFerry: (dock) => openFerry(ui, dock),
    rentBoat: (dock) => {
      ui.closeModal();
      game.rentBoat(dock);
    },
    unlockMana: () => {
      ch.manaUnlocked = true;
      G.player.recompute();
      ui.banner('ATTUNEMENT AWAKENED');
      ui.toast('You may now invest in attunements. Mantras draw on your ether.', 'good');
      G.audio.play('levelup');
      G.vfx.burst(G.player.center(), 'support', 50, { color: '#8fd0ff', speed: 6, up: 4 });
    },
    manaUnlocked: () => !!ch.manaUnlocked,
    level: () => ch.level,
    vow: () => ch.vow,
    vowName: () => (ch.vow ? VOWS[ch.vow].name : ''),
    openVows: () => openVows(ui),
    enchant: () => openEnchant(ui),
    // story flags, faction standing and choices (game/story.js, game/factions.js)
    ...(ACTIONS.dialogueApi ? ACTIONS.dialogueApi(ui, npc) : {}),
  };
}

export function openDialogue(ui, npc) {
  const api = makeApi(ui, npc);
  let fn = DIALOGUES[npc.id];
  if (!fn && FERRY_NPCS[npc.id]) fn = (a) => DIALOGUES.ferry(a, FERRY_NPCS[npc.id]);
  if (!fn) fn = () => ({ text: '...', options: [{ label: 'Farewell.' }] });
  const el = ui.openModal('dialogue', `<div class="panel"><div><span class="dl-name">${escapeHtml(npc.name)}</span><span class="dl-title">${escapeHtml(npc.def.title || '')}</span></div><div class="dl-text"></div><div class="dl-opts"></div></div>`, { dim: false });
  let typing = null;
  const show = (node) => {
    if (!node) return ui.closeModal();
    const textEl = $('.dl-text', el);
    const optsEl = $('.dl-opts', el);
    clearInterval(typing);
    let i = 0;
    const full = node.text || '';
    textEl.textContent = '';
    typing = setInterval(() => {
      i += 3;
      textEl.textContent = full.slice(0, i);
      if (i >= full.length) clearInterval(typing);
    }, 16);
    textEl.onclick = () => {
      clearInterval(typing);
      textEl.textContent = full;
    };
    optsEl.innerHTML = '';
    (node.options || [{ label: 'Farewell.' }]).forEach((o, idx) => {
      const b = document.createElement('button');
      b.className = 'btn dl-opt';
      b.innerHTML = `<span class="n">${idx + 1}</span>${escapeHtml(o.label)}`;
      b.onclick = () => {
        G.audio.play('ui');
        clearInterval(typing);
        if (o.do) o.do(api);
        const stillHere = ui.modal && ui.modal.el === el;
        if (!stillHere) return;
        if (o.next) show(typeof o.next === 'function' ? o.next(api) : o.next);
        else ui.closeModal();
      };
      optsEl.appendChild(b);
    });
  };
  const node = fn(api);
  const testimony = worldDialogue(npc.id, ui.game.ch);
  if (testimony) node.options = [...(node.options || []), { label: 'Ask about the world.', next: testimony }];
  show(node);
}

// ------------------------------------------------------------ shops
export function openShop(ui, id) {
  const shop = SHOPS[id];
  const game = ui.game;
  const p = G.player;
  const ch = game.ch;
  let mode = 'buy';
  const shardMode = shop.currency === 'rift_shard';
  const price = (base, itemId) => {
    if (shardMode) return shop.shardPrices[itemId] ?? OUTFITS[itemId]?.shardPrice ?? 99;
    return Math.max(1, Math.round(base * p.derived.priceMul));
  };
  const wallet = () => (shardMode ? ch.inventory.items.rift_shard || 0 : ch.silver);
  const curName = shardMode ? 'shards' : 'silver';
  const render = () => {
    let rows = '';
    if (mode === 'buy') {
      for (const wid of shop.weapons || []) {
        const w = WEAPONS[wid];
        const pr = price(w.price, wid);
        const cls = WEAPON_CLASSES[w.cls];
        rows += `<div class="shop-row"><div style="flex:1"><div class="nm" style="color:${RARITY_COLORS[w.rarity]}">${w.name}</div><div class="ds">${cls.label}, ${w.damage} dmg, ${w.desc}${w.reqs ? `, <span class="${meetsReqs(w.reqs, ch.attrs) ? '' : 'bad'}">req ${reqsText(w.reqs)}</span>` : ''}</div><div class="ds muted feel" style="font-size:12px">${escapeHtml(weaponFeelText(w))}</div></div><div class="pr ${wallet() < pr ? 'bad' : ''}">${pr} ${curName}</div><button class="btn small" data-buy-w="${wid}" ${wallet() < pr ? `disabled title="Not enough ${curName}"` : ''}>Buy</button></div>`;
      }
      for (const oid of shop.outfits || []) {
        const o = OUTFITS[oid];
        const pr = price(o.price, oid);
        const owned = ch.inventory.outfits.includes(oid);
        const res = Object.entries(o.resist).map(([k, v]) => `${ELEMENTS[k].name} ${Math.round(v * 100)}%`).join(', ');
        rows += `<div class="shop-row"><div style="flex:1"><div class="nm" style="color:${RARITY_COLORS[o.rarity]}">${o.name}</div><div class="ds">${Math.round(o.armor * 100)}% armor${res ? ', ' + res : ''}, ${o.desc}${o.reqs ? `, req ${reqsText(o.reqs)}` : ''}</div></div><div class="pr ${!owned && wallet() < pr ? 'bad' : ''}">${owned ? '—' : pr + ' ' + curName}</div><button class="btn small" data-buy-o="${oid}" ${owned ? 'disabled title="You own this already"' : wallet() < pr ? `disabled title="Not enough ${curName}"` : ''}>${owned ? 'Owned' : 'Buy'}</button></div>`;
      }
      for (const iid of shop.items || []) {
        const it = ITEMS[iid];
        const pr = price(it.price, iid);
        rows += `<div class="shop-row"><div style="flex:1"><div class="nm">${it.name}</div><div class="ds">${it.desc}</div></div><div class="pr ${wallet() < pr ? 'bad' : ''}">${pr} ${curName}</div><button class="btn small" data-buy-i="${iid}" ${wallet() < pr ? `disabled title="Not enough ${curName}"` : ''}>Buy</button></div>`;
      }
    } else {
      for (const [iid, n] of Object.entries(ch.inventory.items)) {
        const it = ITEMS[iid];
        if (!it || it.type === 'quest' || iid === 'rift_shard' && shardMode) continue;
        const pr = Math.max(1, Math.round((it.sell ?? it.price * 0.5) * (shardMode ? 0 : 1) * (it.sell ? 1 : p.derived.sellMul * 2)));
        if (shardMode) continue;
        rows += `<div class="shop-row"><div style="flex:1"><div class="nm">${it.name} <span class="muted">×${n}</span></div><div class="ds">${it.desc}</div></div><div class="pr">${pr} silver</div><button class="btn small" data-sell-i="${iid}">Sell</button></div>`;
      }
      for (const w of ch.inventory.weapons) {
        if (w.uid === ch.equipped.weapon || shardMode) continue;
        const def = WEAPONS[w.id];
        const pr = Math.max(1, Math.round(def.price * p.derived.sellMul));
        rows += `<div class="shop-row"><div style="flex:1"><div class="nm" style="color:${RARITY_COLORS[def.rarity]}">${escapeHtml(weaponDisplayName(w))}</div><div class="ds">${WEAPON_CLASSES[def.cls].label}, ${def.damage} dmg</div></div><div class="pr">${pr} silver</div><button class="btn small" data-sell-w="${w.uid}">Sell</button></div>`;
      }
      if (!rows) rows = `<div class="muted">${shardMode ? 'The Hollow Man does not buy. He only takes.' : 'Nothing to sell.'}</div>`;
    }
    return `<div class="panel" style="width:min(820px,calc(94 * var(--sw)))"><h2>${shop.name.toUpperCase()}</h2>
      <div class="row-flex" style="margin-bottom:10px"><button class="btn small ${mode === 'buy' ? 'primary' : ''}" data-mode="buy">Buy</button><button class="btn small ${mode === 'sell' ? 'primary' : ''}" data-mode="sell">Sell</button><span class="space"></span><span style="font-family:var(--display)">${wallet()} ${curName}</span></div>
      <div class="shop-list">${rows}</div><div class="divider"></div><div class="row-flex"><span class="space"></span><button class="btn" data-a="close">Leave</button></div></div>`;
  };
  const el = ui.openModal('shop', render());
  const pay = (n) => {
    if (shardMode) game.takeItem('rift_shard', n);
    else ch.silver -= n;
    G.audio.play('coin');
  };
  el.addEventListener('click', (e) => {
    const t = e.target;
    const m = t.closest('[data-mode]');
    if (m) mode = m.dataset.mode;
    const bw = t.closest('[data-buy-w]');
    if (bw) {
      const w = WEAPONS[bw.dataset.buyW];
      const pr = price(w.price, bw.dataset.buyW);
      if (wallet() >= pr) {
        pay(pr);
        game.giveWeapon(bw.dataset.buyW);
      }
    }
    const bo = t.closest('[data-buy-o]');
    if (bo) {
      const o = OUTFITS[bo.dataset.buyO];
      const pr = price(o.price, bo.dataset.buyO);
      if (wallet() >= pr) {
        pay(pr);
        game.giveOutfit(bo.dataset.buyO);
      }
    }
    const bi = t.closest('[data-buy-i]');
    if (bi) {
      const it = ITEMS[bi.dataset.buyI];
      const pr = price(it.price, bi.dataset.buyI);
      if (wallet() >= pr) {
        pay(pr);
        game.giveItem(bi.dataset.buyI, 1);
      }
    }
    const si = t.closest('[data-sell-i]');
    if (si) {
      const id = si.dataset.sellI;
      const it = ITEMS[id];
      const pr = Math.max(1, Math.round((it.sell ?? it.price * 0.5) * (it.sell ? 1 : p.derived.sellMul * 2)));
      if (game.takeItem(id, 1)) {
        if (id === 'waterskin') ch.waterCharges = Math.min(ch.waterCharges, (ch.inventory.items.waterskin || 0) * 4);
        ch.silver += pr;
        G.audio.play('coin');
      }
    }
    const sw = t.closest('[data-sell-w]');
    if (sw) {
      const i = ch.inventory.weapons.findIndex((w) => w.uid === sw.dataset.sellW);
      if (i >= 0) {
        const def = WEAPONS[ch.inventory.weapons[i].id];
        ch.silver += Math.max(1, Math.round(def.price * p.derived.sellMul));
        ch.inventory.weapons.splice(i, 1);
        G.audio.play('coin');
      }
    }
    if (t.closest('[data-a="close"]')) return ui.closeModal();
    if (ui.modal && ui.modal.el === el) {
      const top = t.closest('[data-mode]') ? 0 : (el.querySelector('.shop-list') || {}).scrollTop || 0; // keep your place in the wares
      el.innerHTML = render();
      const list = el.querySelector('.shop-list');
      if (list) list.scrollTop = top;
    }
  });
}

export function openEnchant(ui) {
  const p = G.player;
  const ch = ui.game.ch;
  const it = p.weaponItem();
  const cost = Math.round(300 * p.derived.priceMul);
  let msg;
  if (!it) msg = 'Bare fists cannot hold an enchantment.';
  else if (WEAPONS[it.id].enchant) msg = `${WEAPONS[it.id].name} already carries an enchantment that cannot be reforged.`;
  const el = ui.openModal('enchant', `<div class="panel" style="width:520px;text-align:center"><h2>REFORGE</h2>
    ${msg ? `<p>${msg}</p>` : `<p>Reforge <b class="gold">${escapeHtml(weaponDisplayName(it))}</b> with a random enchantment for <b>${cost} silver</b>?</p><p class="muted" style="font-size:14px">${Object.values(ENCHANTS).map((e) => `<span style="color:${e.color}">${e.name}</span>`).join(', ')}</p>`}
    <div class="divider"></div><div class="row-flex"><span class="space"></span><button class="btn" data-a="close">Leave</button>${msg ? '' : `<button class="btn primary" data-a="go" ${ch.silver < cost ? 'disabled' : ''}>Reforge</button>`}</div></div>`);
  el.addEventListener('click', (e) => {
    const a = e.target.closest('[data-a]');
    if (!a) return;
    if (a.dataset.a === 'close') return ui.closeModal();
    if (a.dataset.a === 'go' && ch.silver >= cost) {
      ch.silver -= cost;
      const opts = Object.keys(ENCHANTS).filter((k) => k !== it.enchant);
      it.enchant = choice(opts);
      p.refreshWeapon();
      p.recompute();
      G.audio.play('steel');
      G.audio.play('levelup', { vol: 0.5 });
      ui.toast(`Your weapon is now ${ENCHANTS[it.enchant].name}: ${ENCHANTS[it.enchant].desc}`, 'good');
      ui.closeModal();
      ui.game.save();
    }
  });
}

// ------------------------------------------------------------ ferry / dock
// Booked passage and dock teleports are gone — docks only rent boats you sail yourself.
export function openFerry(ui, dockId) {
  if (ACTIONS.openFerry && ACTIONS.openFerry(ui, dockId)) return;
  if (ACTIONS.openBoatyard && ACTIONS.openBoatyard(ui, dockId)) return;
  ui.toast('The boatyard is closed.');
}

// ------------------------------------------------------------ campfire
// Sit by the fire; cooking is optional. Walking away stands you up. Campfires never
// set the waking place: an innkeeper's room does, through game.rest().
export function openCampfire(ui, it) {
  const p = G.player;
  if (!p || p.dead || p.knocked) return;
  if (p.sitting) {
    openCookMenu(ui);
    return;
  }
  // no rest mid-fight (Deepwoken's rule): the seat heals and saves, so danger has to lapse first
  if (p.inDanger) {
    ui.toast(`You can't rest while in danger (${Math.ceil(p.dangerT || 0)}s).`, 'bad');
    return;
  }
  // Sitting down: face the flames, keep the game (a seat by a fire is a safe place to stop),
  // and the HUD steps back while the rest card (ui.js, body.seated) lists what a seat offers.
  // Moving or leaving the ground stands you up (Player.update).
  p.sitting = true;
  if (it && it.pos) p.yaw = Math.atan2(it.pos.x - p.pos.x, it.pos.z - p.pos.z);
  p.restFire = it && it.pos ? { x: it.pos.x, y: it.pos.y, z: it.pos.z } : null; // the camera frames rester and fire (game.js)
  if (ui.game && ui.game.save) ui.game.save();
  if (!growthAtRest(ui)) ui.toast('You sit by the fire.', 'good');
}

// Sitting by a fire is where you invest your points and assign trait points, as in Deepwoken (the systems session's
// ACTIONS.readyToRise and openRest; this does nothing in a build without them). Talent and mantra
// cards are chosen anywhere, and an inn only sets where you wake. A Power that waits opens at
// once; points that wait are named.
export function growthAtRest(ui) {
  const w = ACTIONS.readyToRise && ACTIONS.readyToRise();
  if (!w || !(w.rise || w.points > 0 || w.traits > 0)) return false;
  if (w.rise && ACTIONS.openRest) return !!ACTIONS.openRest(ui);
  ui.toast(keyText('Your growth waits: {menu} to invest while you sit here.'), 'good');
  return true;
}

// ------------------------------------------------------------ altar
export function openAltar(ui) {
  if (ACTIONS.openAltar && ACTIONS.openAltar(ui)) return; // spark/modifier altar (content system)
  const ch = ui.game.ch;
  const render = () => {
    const sparks = ch.inventory.items.mantra_spark || 0;
    const ids = Object.keys(ch.mantras);
    return `<div class="panel" style="width:640px"><h2>MANTRA ALTAR</h2>
      <p class="muted" style="text-align:center">Offer a Mantra Spark to empower a mantra: +15% power and 8% shorter cooldown per star. You hold <b class="gold">${sparks}</b> spark${sparks === 1 ? '' : 's'}.</p>
      <div class="shop-list">${ids.length ? ids.map((id) => {
        const st = ch.mantras[id].stars;
        return `<div class="shop-row"><div style="flex:1"><div class="nm">${MANTRAS[id].name} <span class="stars" style="color:#ffd27a">${'★'.repeat(st)}${'☆'.repeat(MAX_STARS - st)}</span></div></div><button class="btn small" data-emp="${id}" ${sparks < 1 || st >= MAX_STARS ? 'disabled' : ''}>${st >= MAX_STARS ? 'Max' : 'Empower'}</button></div>`;
      }).join('') : '<div class="muted">You know no mantras.</div>'}</div>
      <div class="divider"></div><div class="row-flex"><span class="space"></span><button class="btn" data-a="close">Leave</button></div></div>`;
  };
  const el = ui.openModal('altar', render());
  el.addEventListener('click', (e) => {
    const emp = e.target.closest('[data-emp]');
    if (emp && ui.game.takeItem('mantra_spark', 1)) {
      ch.mantras[emp.dataset.emp].stars++;
      G.audio.play('levelup');
      G.vfx.burst(G.player.center(), 'support', 40, { color: '#c8a8ff', speed: 5 });
      ui.toast(`${MANTRAS[emp.dataset.emp].name} grows stronger.`, 'good');
      ui.game.save();
      el.innerHTML = render();
      return;
    }
    if (e.target.closest('[data-a="close"]')) ui.closeModal();
  });
}

// ------------------------------------------------------------ notice board
export function openBoard(ui) {
  const notes = [
    ['BOUNTY', 'Red-bandana brigands are raiding the ferries from Thornwood. Report to Captain Hale at the Watch barracks.'],
    ['MISSING', 'A satchel of goods, taken by a gloomowl on the Thornwood road. Reward offered — ask Pell at the market.'],
    ['HELP WANTED', 'Shimmerfen fishers need the shoreline cleared. Find Moss at his landing.'],
    ['FURS', 'Hunter Brynja of Frosthollow pays well for rimefang pelts.'],
    ['SCHOLARSHIP', 'Scholar Ignis seeks assistance gathering samples on the Ashen Spire. Bring a strong stomach.'],
    ['WARNING', 'Do not swim far from shore. Things with teeth patrol the deep.'],
    ['TRAINING', 'Sage Ilvar teaches mana to those with spark enough (Power 2). The Vowkeeper waits on the northern perch for those ready to swear (Power 5).'],
  ];
  const el = ui.openModal('board', `<div class="panel" style="width:640px"><h2>NOTICE BOARD</h2>${notes.map(([t, s]) => `<div class="card" style="margin-bottom:8px"><div class="cc">${t}</div><div class="cd2">${s}</div></div>`).join('')}<div class="row-flex"><span class="space"></span><button class="btn" data-a="close">Close</button></div></div>`);
  el.addEventListener('click', (e) => e.target.closest('[data-a="close"]') && ui.closeModal());
}

// ------------------------------------------------------------ vows
export function openVows(ui) {
  const game = ui.game;
  const ch = game.ch;
  const p = G.player;
  const el = ui.openModal('vows', `<div class="panel" style="width:min(1100px,calc(96 * var(--sw)))"><h2>SWEAR A VOW</h2>
    <p class="muted" style="text-align:center">A Vow is permanent. It grants unique talents and a unique mantra.</p>
    <div class="card-grid">${Object.entries(VOWS).map(([id, v]) => {
      const ok = meetsReqs(v.reqs, ch.attrs, { level: ch.level });
      return `<div class="card vow-card ${ok ? 'pick' : 'locked'}" ${ok ? `data-vow="${id}"` : `data-vow-locked="${id}"`} style="border-color:${v.color}"><div class="cn" style="color:${v.color}">${v.name}</div><div class="lore">${v.lore}</div><ul class="perks">${v.perks.map((x) => `<li>${x}</li>`).join('')}</ul><div class="req">Requires ${reqsText(v.reqs)}</div></div>`;
    }).join('')}</div>
    <div class="divider"></div><div class="vow-confirm hidden"></div><div class="row-flex"><span class="space"></span><button class="btn" data-a="close">Not yet</button></div></div>`);
  const bar = el.querySelector('.vow-confirm');
  let pending = null;
  el.addEventListener('click', (e) => {
    const locked = e.target.closest('[data-vow-locked]');
    if (locked) {
      const v = VOWS[locked.dataset.vowLocked];
      ui.toast(`The ${v.name} asks for ${reqsText(v.reqs)}.`, 'bad');
      return;
    }
    const c = e.target.closest('[data-vow]');
    if (c) {
      // a vow is for good: ask once, in the panel
      pending = c.dataset.vow;
      const v = VOWS[pending];
      el.querySelectorAll('[data-vow]').forEach((x) => x.classList.toggle('on', x === c));
      bar.innerHTML = `<div>Swear the <b style="color:${v.color}">${v.name}</b>? A vow cannot be broken.</div><div class="row-flex" style="margin-top:8px"><span class="space"></span><button class="btn small" data-a="unsure">Not this one</button><button class="btn small primary" data-a="swear">Swear it</button></div>`;
      bar.classList.remove('hidden');
      return;
    }
    if (e.target.closest('[data-a="unsure"]')) {
      pending = null;
      bar.classList.add('hidden');
      el.querySelectorAll('[data-vow]').forEach((x) => x.classList.remove('on'));
      return;
    }
    if (e.target.closest('[data-a="swear"]') && pending) {
      const id = pending;
      const v = VOWS[id];
      ch.vow = id;
      for (const t of v.talents) if (!ch.talents.includes(t)) ch.talents.push(t);
      for (const m of v.mantras) {
        ch.mantras[m] = { stars: 0 };
        const free = ch.hotbar.findIndex((x, i) => i > 0 && i < 8 && !x);
        if (free > 0) ch.hotbar[free] = { type: 'mantra', id: m };
      }
      if (v.bonusPicks) ch.talentPicks += v.bonusPicks;
      p.recompute();
      ui.closeModal();
      ui.refreshHotbar();
      ui.banner(v.name.toUpperCase());
      G.audio.play('bell');
      G.vfx.burst(p.center(), 'support', 70, { color: v.color, speed: 8, up: 6 });
      game.save();
    }
    if (e.target.closest('[data-a="close"]')) ui.closeModal();
  });
}

// ------------------------------------------------------------ map
const mapCache = {};

// Which map to show, based on where the player is.
const MAP_REGIONS = {
  // span is world units across the map — larger = more zoomed out
  surface: { key: 'surface', title: 'THE SHATTERED ISLES', cx: 0, cz: 480, span: 4300, rift: false },
  rift: { key: 'rift', title: 'THE RIFT', cx: 6000, cz: 6000, span: 900, rift: true },
};
function mapRegionFor(pos, inRift) {
  if (!inRift) return MAP_REGIONS.surface;
  return MAP_REGIONS.rift;
}
const inRegion = (r, x, z) => Math.abs(x - r.cx) <= r.span / 2 && Math.abs(z - r.cz) <= r.span / 2;

function renderMapImage(region) {
  const key = region.key;
  if (mapCache[key]) return mapCache[key];
  const rift = region.rift;
  const S = 640;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(S, S);
  const t = G.world.terrain;
  const { span, cx, cz } = region;
  for (let py = 0; py < S; py++) {
    for (let px = 0; px < S; px++) {
      const x = cx + span / 2 - (px / S) * span;
      const z = cz + span / 2 - (py / S) * span;
      let h = t.heightAt(x, z);
      // Only the sea and real lakes are water on the chart. The fen's knee-deep meres are wet
      // ground inside the coast, and sand is for shores: low inland ground keeps its biome.
      let shore = true;
      if (!rift && h < 1.6 && h > -1.2) {
        const hit = islandAtPoint(x, z);
        if (hit && hit.d < 0.86 && h < 0) h = 0.05;
        shore = !hit || hit.d > 0.72;
      }
      let r, g, b;
      if (rift) {
        if (h < -30) [r, g, b] = [8, 4, 14];
        else {
          const k = Math.min(1, (h + 2) / 28);
          [r, g, b] = [50 + k * 70, 36 + k * 50, 70 + k * 90];
        }
      } else if (h < 0) {
        const d = Math.min(1, -h / 18);
        [r, g, b] = [101 - d * 25, 137 - d * 30, 143 - d * 28];
      } else {
        const bi = G.world.biomeAt(x, z) || 'meadow';
        const k = Math.min(1, h / 50);
        const base = { beach: [181, 173, 119], meadow: [136, 148, 96], forest: [103, 125, 80], marsh: [126, 141, 95], dunes: [196, 184, 132], snow: [217, 224, 217], tundra: [164, 175, 158], volcanic: [107, 96, 80], ashfield: [118, 114, 96], emberwood: [88, 104, 72], bastion: [158, 152, 111], highland: [151, 143, 100], farmland: [161, 161, 102], hush: [150, 158, 166], rock: [143, 143, 123], rift: [80, 60, 110], jungle: [93, 127, 79] }[bi] || [110, 160, 80];
        if (h < 1.6 && shore && bi !== 'volcanic' && bi !== 'snow') [r, g, b] = [214, 198, 150];
        else [r, g, b] = [base[0] + (200 - base[0]) * k * 0.5, base[1] + (200 - base[1]) * k * 0.5, base[2] + (200 - base[2]) * k * 0.5];
      }
      if (!rift) {
        // Engraved shore rings and directional relief make the coastline readable.
        const coast = h < 0 && (Math.abs(h + 1.5) < 0.6 || Math.abs(h + 6) < 0.55);
        const shade = h >= 0 ? Math.max(-20, Math.min(20, (h - t.heightAt(x + 5, z + 5)) * 2.1)) : 0;
        const grain = Math.sin(px * 12.989 + py * 78.233) * 1.7;
        r += shade + grain + (coast ? 25 : 0);
        g += shade + grain + (coast ? 25 : 0);
        b += shade + grain + (coast ? 20 : 0);
      }
      const i = (py * S + px) * 4;
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  mapCache[key] = { canvas: c, span, cx, cz, S };
  return mapCache[key];
}

export function openMap(ui) {
  const region = mapRegionFor(G.player && G.player.pos, ui.game.inRift);
  const rift = region.rift;
  const here = (x, z) => inRegion(region, x, z);
  const el = ui.openModal('map', `<div class="panel"><h2>${region.title}</h2><canvas id="map-canvas" width="640" height="640"></canvas><div class="muted" style="text-align:center;margin-top:6px;font-size:14px">◆ quest, ▲ you, ⚓ harbor, <kbd>M</kbd> to close</div></div>`);
  const cv = $('#map-canvas', el);
  const ctx = cv.getContext('2d');
  const m = renderMapImage(region);
  const W = cv.width;
  const toPx = (x, z) => [((m.cx + m.span / 2 - x) / m.span) * W, ((m.cz + m.span / 2 - z) / m.span) * W];
  const draw = () => {
    if (!ui.modal || ui.modal.el !== el) return;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(m.canvas, 0, 0, W, W);
    // Only town streets are drawn; the way between towns is found on foot.
    ctx.lineCap = 'round';
    for (const samples of G.world.pathSamples || []) {
      if (!samples.length || !here(samples[0].x, samples[0].z)) continue;
      for (const run of settledRuns(samples)) {
        ctx.beginPath();
        run.forEach((p, i) => { const [x, y] = toPx(p.x, p.z); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
        ctx.strokeStyle = '#484d38'; ctx.lineWidth = 2.2; ctx.stroke();
        ctx.strokeStyle = '#d8cba4'; ctx.lineWidth = 1.1; ctx.stroke();
      }
    }
    ctx.strokeStyle = '#c3c4a8'; ctx.lineWidth = 1;
    ctx.strokeRect(9, 9, W - 18, W - 18);
    ctx.textAlign = 'center';
    const placed = [];
    const clear = (x, y, w, h) => !placed.some(r => Math.abs(x - r.x) < (w + r.w) / 2 + 3 && Math.abs(y - r.y) < (h + r.h) / 2 + 3);
    const label = (name, x, y, big) => {
      ctx.font = big ? '600 17px Cinzel, Georgia, serif' : 'italic 11px Georgia, serif';
      const width = ctx.measureText(name).width, height = big ? 19 : 13;
      if (!big && !clear(x, y, width, height)) return;
      placed.push({ x, y, w: width, h: height });
      ctx.fillStyle = big ? '#f0ecd7' : '#eee6cd';
      ctx.strokeStyle = '#313d34'; ctx.lineWidth = big ? 3.8 : 2.6;
      ctx.strokeText(name, x, y); ctx.fillText(name, x, y);
    };
    for (const r of REGIONS) {
      if (!here(r.cx, r.cz)) continue;
      const authored = { thornwood: [1100, 200], shimmerfen: [-750, -440], frosthollow: [-1050, 1140], meridian: [850, -690] }[r.id];
      const center = authored ? placedPoint(...authored) : [r.cx, r.cz];
      const [x, y] = toPx(...center);
      const big = r.radius > 100;
      label(r.id === 'saltreach' ? 'Saltreach' : r.name, x, y - (big ? 20 : 12), big);
    }
    for (const l of LOCATIONS.filter(l => /Village|Landing|Cinderstead|Garrison$/.test(l.name))) {
      if (!here(l.x, l.z)) continue;
      const [x, y] = toPx(l.x, l.z);
      ctx.fillStyle = '#5f4938'; ctx.strokeStyle = '#dac5a0'; ctx.lineWidth = 1;
      for (const dx of [-5, 3]) {
        ctx.fillRect(x + dx, y - 4, 5, 6); ctx.strokeRect(x + dx, y - 4, 5, 6);
        ctx.beginPath(); ctx.moveTo(x + dx - 1, y - 4); ctx.lineTo(x + dx + 2.5, y - 8); ctx.lineTo(x + dx + 6, y - 4); ctx.closePath(); ctx.fill();
      }
      label(l.name, x, y + 16, false);
    }
    // A compact compass respects the game's +z north, +x west convention.
    ctx.save(); ctx.translate(W - 44, 47);
    ctx.strokeStyle = '#d6d6bb'; ctx.fillStyle = '#ede5c8'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, -15); ctx.lineTo(5, 0); ctx.lineTo(0, 17); ctx.lineTo(-5, 0); ctx.closePath(); ctx.stroke();
    ctx.font = '12px Georgia'; ctx.fillText('N', 0, -20); ctx.restore();
    ctx.font = '14px sans-serif';
    for (const s of STRUCTURES) {
      if (!here(s.x, s.z)) continue;
      const icon = s.type === 'dock' ? '⚓' : rift && s.type === 'campfire' && !s.hostile ? '🔥' : s.type === 'rift_gate' ? '⛩' : null;
      if (!icon) continue;
      const [x, y] = toPx(s.x, s.z);
      ctx.fillText(icon, x, y + 5);
    }
    let markers = [];
    try {
      markers = (ACTIONS.mapMarkers && ACTIONS.mapMarkers(region)) || [];
    } catch (e) {
      console.error(e);
    }
    for (const mk of markers) {
      if (!here(mk.x, mk.z)) continue;
      const [x, y] = toPx(mk.x, mk.z);
      ctx.font = (mk.size || 15) + 'px sans-serif';
      ctx.fillStyle = mk.color || '#fff';
      ctx.fillText(mk.icon, x, y + 5);
      if (mk.label) {
        // a marker's name goes below its icon, or above, beside it, or a line further out when
        // names already sit there, and then keeps later names clear of it. Where every place is
        // taken (a town's markers on the whole-world chart) the icon stands alone.
        ctx.font = 'italic 11px Georgia, serif';
        const w = ctx.measureText(mk.label).width;
        const spot = [[x, y + 18], [x, y - 12], [x + w / 2 + 11, y + 4], [x - w / 2 - 11, y + 4], [x, y + 31], [x, y - 25]]
          .find(([lx, ly]) => clear(lx, ly, w, 13));
        if (spot) {
          placed.push({ x: spot[0], y: spot[1], w, h: 13 });
          ctx.strokeStyle = 'rgba(0,0,0,0.8)';
          ctx.lineWidth = 3;
          ctx.strokeText(mk.label, spot[0], spot[1]);
          ctx.fillText(mk.label, spot[0], spot[1]);
        }
      }
    }
    // places you have found, by name
    const found = new Set(ui.game.ch?.discovered || []);
    for (const l of LOCATIONS) {
      if (!found.has(l.name) || l.r > 150 || !here(l.x, l.z) || /Village|Landing|Cinderstead|Garrison$/.test(l.name)) continue;
      const [x, y] = toPx(l.x, l.z);
      ctx.fillStyle = '#e8dcb8';
      ctx.beginPath();
      ctx.arc(x, y, 2.2, 0, Math.PI * 2);
      ctx.fill();
      label(l.name, x, y + 13, false);
    }
    const qt = ui.questTarget();
    if (qt && here(qt.x, qt.z)) {
      const [x, y] = toPx(qt.x, qt.z);
      ctx.fillStyle = '#ffd27a';
      ctx.font = '18px sans-serif';
      ctx.fillText('◆', x, y + 6);
      const step = ui.game.quests.active()[0];
      if (step) {
        ctx.font = 'italic 12px Georgia, serif';
        ctx.strokeStyle = 'rgba(0,0,0,0.85)';
        ctx.lineWidth = 3;
        const t = step.text.length > 48 ? step.text.slice(0, 46) + '…' : step.text;
        ctx.strokeText(t, x, y - 10);
        ctx.fillText(t, x, y - 10);
      }
    }
    if (G.net && G.net.active) {
      for (const a of G.net.avatars.values()) {
        if (!a.netPos || !here(a.pos.x, a.pos.z)) continue;
        const [x, y] = toPx(a.pos.x, a.pos.z);
        ctx.fillStyle = '#9fe0ff';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fill();
        ctx.font = '600 12px Cinzel, Georgia, serif';
        ctx.lineWidth = 3;
        ctx.strokeText(a.name, x, y - 10);
        ctx.fillText(a.name, x, y - 10);
      }
    }
    const p = G.player;
    if (p) {
      const [x, y] = toPx(p.pos.x, p.pos.z);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-ui.game.camYaw);
      ctx.fillStyle = '#ff5a5a';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(6, 7);
      ctx.lineTo(0, 3);
      ctx.lineTo(-6, 7);
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
      ctx.restore();
    }
    requestAnimationFrame(draw);
  };
  draw();
}

export { TALENTS, NPCS, CHESTS, ISLANDS };
