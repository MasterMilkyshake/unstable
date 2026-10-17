// Out-of-play screens: main menu, character creation, pause, settings, help,
// death and victory.
import * as THREE from 'three';
import { G } from '../core/globals.js';
import { ACTIONS } from '../game/hooks.js';
import { Save, SLOT_COUNT } from '../core/save.js';
import { CONTROLS, controlKeys, controlText, bindLabel } from '../core/input.js';
import { Legacy } from '../core/legacy.js';
import { LEGACY_BOONS } from '../data/legacy.js';
import { RACES, RACE_BY_ID, RARITY_WEIGHT, FIRST_NAMES, LAST_NAMES } from '../data/races.js';
import { ATTRS, ATTUNE_ATTRS } from '../data/stats.js';
import { MANTRAS } from '../data/mantras.js';
import { START_ATTUNEMENT } from '../data/origins.js';
import { HumanoidRig } from '../entities/rig.js';
import { OUTFITS } from '../data/items.js';
import { weightedChoice, choice, escapeHtml, randInt } from '../core/util.js';

const $ = (s, r = document) => r.querySelector(s);

// ------------------------------------------------------------ main menu
const ROMAN = ['', 'I', 'II', 'III'];
export function fmtPlaytime(sec) {
  const m = Math.floor((Number(sec) || 0) / 60);
  if (m < 1) return 'under a minute';
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}
const raceName = (id) => (RACE_BY_ID[id] ? RACE_BY_ID[id].name : 'Unknown');

export function showMainMenu(ui) {
  ui.game.pendingNet = null;
  let mm = $('#main-menu');
  if (!mm) {
    mm = document.createElement('div');
    mm.id = 'main-menu';
    mm.className = 'screen';
    ui.screens.appendChild(mm);
  }
  mm.classList.remove('hidden');
  const last = Save.lastSlot();
  const cont = last ? Save.summary(last) : null;
  const filled = Save.slots().filter(Boolean).length;
  const legacy = Legacy.load();
  mm.innerHTML = `
    <div class="title">UNSTABLE</div>
    <div class="menu-btns">
      ${cont ? `<button class="btn primary" data-a="continue">Continue<span class="cont-info">${escapeHtml(cont.name)} · ${raceName(cont.race)} · Power ${cont.level}</span></button>` : ''}
      ${filled ? `<button class="btn" data-a="load">Load<span class="cont-info">${filled} of ${SLOT_COUNT} slots</span></button>` : ''}
      <button class="btn ${cont ? '' : 'primary'}" data-a="new">New Game</button>
      ${legacy.lost.length ? `<button class="btn" data-a="register">Register of the Lost<span class="cont-info">${legacy.lost.length} ${legacy.lost.length === 1 ? 'name' : 'names'} · ${legacy.remembrance} Remembrance</span></button>` : ''}
      <button class="btn" data-a="lan">LAN Co-op</button>
      <button class="btn" data-a="settings">Settings</button>
      <button class="btn" data-a="help">How to Play</button>
    </div>
  `;
  mm.onclick = (e) => {
    const a = e.target.closest('[data-a]');
    if (!a) return;
    G.audio.init();
    G.audio.play('ui');
    switch (a.dataset.a) {
      case 'continue':
        hideMainMenu(ui);
        if (!ui.game.continueGame(last) && ui.game.state === 'menu' && !ui.modal) showMainMenu(ui);
        break;
      case 'load':
        openSlots(ui, 'load');
        break;
      case 'new':
        openSlots(ui, 'new');
        break;
      case 'register':
        openRegister(ui);
        break;
      case 'lan':
        ui.openLan(true);
        break;
      case 'settings':
        openSettings(ui, () => showMainMenu(ui));
        break;
      case 'help':
        openHelp(ui, () => showMainMenu(ui));
        break;
    }
  };
  // A wipe whose heirloom was never chosen (the page closed on the wipe screen) is finished first.
  if (legacy.pending && !ui.modal) showWipe(ui, null);
}

export function hideMainMenu(ui) {
  const mm = $('#main-menu');
  if (mm) mm.classList.add('hidden');
}

// What choosing a slot does: 'continue' it, 'begin' a new character there, 'confirm' first
// (a new character would replace someone), or nothing (an empty slot can't be loaded).
export function slotAction(mode, filled) {
  if (mode === 'new') return filled ? 'confirm' : 'begin';
  if (filled) return 'continue';
  return mode === 'lan' ? 'begin' : 'none';
}

// The three character slots. mode: 'load' (continue one), 'new' (start a character in one,
// confirming before a filled slot is replaced), 'lan' (bring a character into LAN co-op).
export function openSlots(ui, mode) {
  hideMainMenu(ui);
  const net = ui.game.pendingNet;
  let confirmSlot = null;
  const titles = { load: 'LOAD A CHARACTER', new: 'CHOOSE A SLOT', lan: 'BRING A CHARACTER' };
  const notes = {
    load: 'Each slot keeps its own character, backup and lives. Settings and the Register of the Lost are shared.',
    new: 'The new soul washes ashore in the slot you choose. Replacing a character erases its save and backup.',
    lan: 'Choose who joins the shared world. An empty slot starts a new character first.',
  };
  const row = (n, s) => {
    if (!s) {
      const can = mode !== 'load';
      return `<div class="slot-row empty"><div class="slot-n">${ROMAN[n]}</div><div class="slot-body"><div class="slot-name muted">Empty slot</div></div>
        ${can ? `<button class="btn small primary" data-slot="${n}">Begin here</button>` : ''}</div>`;
    }
    const verb = mode === 'new' ? 'Replace' : mode === 'lan' ? 'Bring' : 'Continue';
    return `<div class="slot-row"><div class="slot-n">${ROMAN[n]}</div><div class="slot-body">
        <div class="slot-name">${escapeHtml(s.name)}</div>
        <div class="slot-meta">${raceName(s.race)} · Power ${s.level}${s.place ? ` · ${escapeHtml(s.place)}` : ''}</div>
        <div class="slot-meta">${fmtPlaytime(s.playtime)} played · ${s.lives} of ${s.maxLives} ${s.maxLives === 1 ? 'life' : 'lives'}${s.dangerQuit ? ' · <span class="bad">fled in danger: a life is owed</span>' : ''}</div>
      </div><button class="btn small ${mode === 'new' ? 'danger' : 'primary'}" data-slot="${n}">${verb}</button></div>`;
  };
  const render = () => {
    const sums = Save.slots();
    let body = sums.map((s, i) => row(i + 1, s)).join('');
    if (confirmSlot) {
      const s = sums[confirmSlot - 1];
      body += `<div class="slot-confirm"><div>Replace <b class="gold">${escapeHtml(s.name)}</b>, ${raceName(s.race)} of Power ${s.level}? Their save and its backup are erased for good.</div>
        <div class="row-flex" style="margin-top:10px"><span class="space"></span><button class="btn small" data-a="keep">Keep them</button><button class="btn small danger" data-a="replace">Replace</button></div></div>`;
    }
    return `<h2>${titles[mode]}</h2><p class="muted slots-note">${notes[mode]}</p>${body}
      <div class="divider"></div><div class="row-flex"><button class="btn" data-a="back">Back</button><span class="space"></span></div>`;
  };
  let done = false; // closed by a choice, not by Esc or the ✕
  const close = () => {
    done = true;
    ui.closeModal(false);
  };
  const back = () => {
    close();
    showMainMenu(ui);
  };
  const el = ui.openModal('slots', `<div class="panel slots-panel">${render()}</div>`, { onClose: () => !done && showMainMenu(ui) });
  const begin = (n) => {
    close();
    ui.game.pendingNet = net;
    openCreation(ui, n);
  };
  el.addEventListener('click', (e) => {
    const t = e.target.closest('[data-slot],[data-a]');
    if (!t) return;
    G.audio.play('ui');
    if (t.dataset.a === 'back') return back();
    if (t.dataset.a === 'keep') {
      confirmSlot = null;
    } else if (t.dataset.a === 'replace') {
      return begin(confirmSlot);
    } else if (t.dataset.slot) {
      const n = Number(t.dataset.slot);
      const act = slotAction(mode, Save.hasCharacter(n));
      if (act === 'begin') return begin(n);
      if (act === 'confirm') confirmSlot = n;
      if (act === 'continue') {
        close();
        ui.game.pendingNet = net;
        if (!ui.game.continueGame(n) && ui.game.state === 'menu' && !ui.modal) showMainMenu(ui);
        return;
      }
    }
    // keep the panel (and its ✕); redraw what is in it
    const panel = el.querySelector('.panel');
    const x = panel.querySelector('.modal-x');
    panel.innerHTML = render();
    if (x) panel.appendChild(x);
  });
}

// Every character whose last name-knot was spent, newest first, and what the coast remembers.
export function openRegister(ui) {
  hideMainMenu(ui);
  const l = Legacy.load();
  const entries = l.lost.slice().reverse().map((e) => `<div class="lost-row">
      <div class="row-flex"><span class="lost-name">${escapeHtml(e.name)}</span><span class="space"></span><span class="gold lost-earned">+${e.earned} Remembrance</span></div>
      <div class="slot-meta">${escapeHtml(e.raceName || raceName(e.race))} · Power ${e.level} · <i>${escapeHtml(e.cause || 'Lost')}</i></div>
      <div class="slot-meta">${fmtPlaytime(e.playtime)} played · ${e.kills} foes felled · ${e.chapters} ${e.chapters === 1 ? 'chapter' : 'chapters'} reached${e.chapter ? ` (${escapeHtml(e.chapter)})` : ''}</div>
      <div class="slot-meta">Great foes slain: ${e.foes.length ? e.foes.map(escapeHtml).join(', ') : 'none'}</div>
      ${e.heirloom ? `<div class="slot-meta">Left <span class="gold">${escapeHtml(e.heirloom)}</span> at the Wash${e.claimedBy ? `, taken up by ${escapeHtml(e.claimedBy)}` : ''}</div>` : ''}
    </div>`).join('');
  const waiting = l.heirloom ? `<div class="slot-note"><span class="gold">${escapeHtml(l.heirloom.name)}</span>, left by ${escapeHtml(l.heirloom.from || 'one who came before')}, waits in the keepsake chest at the Wash for the next soul to wash ashore.</div>` : '';
  const el = ui.openModal('register', `<div class="panel register-panel"><h2>THE REGISTER OF THE LOST</h2>
    <p class="muted slots-note">When a tide-born dies in the Rift, or its last name-knot frays, Old Wren strikes the name in her blanket register. The coast keeps a little of what they did: Remembrance, spent when the next soul washes ashore.</p>
    <div class="row-flex register-total"><span>Remembrance <b class="gold">${l.remembrance}</b></span><span class="space"></span><span class="muted">${l.earned} earned in all</span></div>
    ${waiting}
    <div class="lost-list">${entries || '<div class="muted" style="text-align:center;margin:16px 0">No names have been struck.</div>'}</div>
    <div class="divider"></div><div class="row-flex"><button class="btn" data-a="back">Back</button><span class="space"></span></div></div>`, { onClose: () => showMainMenu(ui) });
  el.addEventListener('click', (e) => {
    if (e.target.closest('[data-a="back"]')) ui.closeModal(false);
  });
}

// ------------------------------------------------------------ character creation
function rollRace() {
  return weightedChoice(RACES, (r) => RARITY_WEIGHT[r.rarity]);
}

export function openCreation(ui, slot = Save.firstEmptySlot() || Save.slot) {
  hideMainMenu(ui);
  const st = {
    name: `${choice(FIRST_NAMES)} ${choice(LAST_NAMES)}`,
    race: rollRace(),
    rerolls: 2,
    bought: 0, // extra rerolls bought with Remembrance
    boons: new Set(), // boons to pay for as the soul wakes
    skin: 0, hair: 0, eyes: 0, hairStyle: randInt(0, 4), height: 1,
    attune: 'none', // the attunement this soul washes ashore with (data/origins.js)
  };
  st.skin = randInt(0, st.race.skin.length - 1);
  st.hair = randInt(0, st.race.hair.length - 1);
  const el = ui.openModal('creation', `<div class="panel"><div><canvas id="preview-canvas" width="380" height="520"></canvas></div><div id="cr-right"></div></div>`, { closable: false, onClose: () => preview.dispose() });

  // preview renderer
  const canvas = $('#preview-canvas', el);
  const preview = makePreview(canvas);

  const lookOf = () => ({
    skin: st.race.skin[st.skin],
    hair: st.race.hair[st.hair],
    eyes: st.race.eyes[st.eyes % st.race.eyes.length],
    hairStyle: st.hairStyle,
    height: st.height,
  });

  const rebuild = () => {
    const look = Object.assign({}, lookOf(), { features: st.race.features, outfit: OUTFITS.rags.colors, scale: (st.race.scale || 1) * st.height, glowEyes: !!st.race.features.glow });
    preview.setRig(new HumanoidRig(look));
  };

  // Remembrance, earned by the lost (core/legacy.js): shown once anyone has been lost.
  const legacyBlock = () => {
    const l = Legacy.load();
    if (!l.earned && !l.heirloom) return '';
    const committed = [...st.boons].reduce((n, id) => n + LEGACY_BOONS[id].cost, 0);
    const left = l.remembrance - committed;
    const rr = LEGACY_BOONS.reroll;
    const boon = (id) => {
      const b = LEGACY_BOONS[id];
      const on = st.boons.has(id);
      return `<button class="btn small ${on ? 'primary' : ''}" data-boon="${id}" title="${escapeHtml(on || left >= b.cost ? b.desc : `Not enough Remembrance: ${b.cost} needed`)}" ${on || left >= b.cost ? '' : 'disabled'}>${on ? '✓ ' : ''}${b.name} · ${b.cost}</button>`;
    };
    return `<h3>REMEMBRANCE · <span class="gold">${left}</span></h3>
      <div class="row-flex" style="flex-wrap:wrap;gap:8px">
        <button class="btn small" data-a="buyreroll" title="${escapeHtml(st.bought >= rr.max ? `At most ${rr.max} for one soul` : left < rr.cost ? `Not enough Remembrance: ${rr.cost} needed` : rr.desc)}" ${st.bought < rr.max && left >= rr.cost ? '' : 'disabled'}>${rr.name} · ${rr.cost}${st.bought ? ` (${st.bought}/${rr.max})` : ''}</button>
        ${boon('bundle')}${boon('ember')}
      </div>
      <div class="muted" style="font-size:13px;margin-top:4px">${['bundle', 'ember'].map((id) => `<b>${LEGACY_BOONS[id].name}.</b> ${LEGACY_BOONS[id].desc}`).join(' ')}</div>
      ${l.heirloom ? `<div class="muted" style="font-size:14px;margin-top:6px">An heirloom waits in the keepsake chest at the Wash: <span class="gold">${escapeHtml(l.heirloom.name)}</span>, left by ${escapeHtml(l.heirloom.from || 'one who came before')}.</div>` : ''}`;
  };

  // what the chosen attunement brings: a start in it, mana awakened, its first mantra
  const attuneNote = () => {
    if (st.attune === 'none') return 'Attunement-less. Sage Ilvar in Saltreach can awaken mana later (Power 2), and you invest in it yourself.';
    if (st.attune === 'random') return `One of the five, chosen as you wake: +${START_ATTUNEMENT.bonus} in it, awakened, and its first mantra known.`;
    const m = MANTRAS[START_ATTUNEMENT.mantra[st.attune]];
    return `${ATTRS[st.attune].desc} +${START_ATTUNEMENT.bonus} ${ATTRS[st.attune].name}, awakened from the start; you know ${m ? m.name : 'its first mantra'}.`;
  };

  const render = () => {
    const r = st.race;
    const bonus = Object.entries(r.bonus).map(([k, v]) => `<span class="chip">+${v} ${ATTRS[k].name}</span>`).join('');
    const sw = (arr, key) => arr.map((c, i) => `<div class="sw ${st[key] === i ? 'on' : ''}" data-sw="${key}" data-i="${i}" style="background:${c}"></div>`).join('');
    $('#cr-right', el).innerHTML = `
      <h2>A NEW SOUL WASHES ASHORE</h2>
      <h3>NAME</h3>
      <div class="row-flex"><input type="text" id="cr-name" maxlength="24" value="${escapeHtml(st.name)}"><button class="btn small" data-a="rname">Random</button></div>
      <h3>RACE</h3>
      <div class="race-card">
        <div class="row-flex"><span class="nm">${r.name.toUpperCase()}</span><span class="space"></span><span class="rar ${r.rarity}">${r.rarity.toUpperCase()}</span></div>
        <div class="bl">${r.blurb}</div>
        <div class="chips">${bonus}</div>
        <div style="margin-top:8px"><span class="gold" style="font-family:var(--display);font-size:13px">${r.passive.name}.</span> ${r.passive.desc}</div>
      </div>
      <div class="row-flex" style="margin-top:8px">
        <button class="btn small" data-a="reroll" ${st.rerolls <= 0 ? 'disabled' : ''}>Reroll Race (${st.rerolls} left)</button>
        <span class="space"></span><span class="muted" style="font-size:13px">Slot ${slot}</span>
      </div>
      <h3>ATTUNEMENT</h3>
      <div class="row-flex cr-attune">${['none', 'random', ...ATTUNE_ATTRS].map((k) => `<button class="btn small ${st.attune === k ? 'primary' : ''}" data-att="${k}" ${ATTRS[k] ? `style="color:${ATTRS[k].color}"` : ''}>${k === 'none' ? 'None' : k === 'random' ? 'Random' : ATTRS[k].name}</button>`).join('')}</div>
      <div class="muted cr-attune-note">${attuneNote()}</div>
      ${legacyBlock()}
      <div class="cr-looks">
        <div><h3>SKIN</h3><div class="swatches">${sw(r.skin, 'skin')}</div></div>
        <div><h3>HAIR</h3><div class="swatches">${sw(r.hair, 'hair')}</div></div>
        <div><h3>EYES</h3><div class="swatches">${sw(r.eyes, 'eyes')}</div></div>
      </div>
      <h3>HAIR STYLE</h3><div class="row-flex">${['Short', 'Long', 'Spiked', 'Bald', 'Tied'].map((n, i) => `<button class="btn small ${st.hairStyle === i ? 'primary' : ''}" data-hs="${i}">${n}</button>`).join('')}</div>
      <h3>BUILD</h3><input type="range" id="cr-h" min="0.92" max="1.08" step="0.01" value="${st.height}">
      <div class="cr-actions"><div class="divider"></div>
      <div class="row-flex"><button class="btn" data-a="back">Back</button><span class="space"></span><button class="btn primary" data-a="begin">Wake Up</button></div></div>
    `;
  };

  el.addEventListener('click', (e) => {
    const t = e.target.closest('[data-a],[data-sw],[data-hs],[data-boon],[data-att]');
    if (!t || t.disabled) return;
    G.audio.play('ui');
    if (t.dataset.att) {
      st.attune = t.dataset.att;
      render();
    } else if (t.dataset.boon) {
      const id = t.dataset.boon;
      if (st.boons.has(id)) st.boons.delete(id);
      else st.boons.add(id);
      render();
    } else if (t.dataset.sw) {
      st[t.dataset.sw] = Number(t.dataset.i);
      rebuild();
      render();
    } else if (t.dataset.hs) {
      st.hairStyle = Number(t.dataset.hs);
      rebuild();
      render();
    } else {
      const a = t.dataset.a;
      if (a === 'rname') {
        st.name = `${choice(FIRST_NAMES)} ${choice(LAST_NAMES)}`;
        render();
      } else if (a === 'buyreroll') {
        const rr = LEGACY_BOONS.reroll;
        const committed = [...st.boons].reduce((n, id) => n + LEGACY_BOONS[id].cost, 0);
        if (st.bought < rr.max && Legacy.load().remembrance - committed >= rr.cost && Legacy.spend(rr.cost)) {
          st.bought++;
          st.rerolls++;
        }
        render();
      } else if (a === 'reroll' && st.rerolls > 0) {
        st.rerolls--;
        let r;
        do r = rollRace();
        while (r.id === st.race.id);
        st.race = r;
        st.skin = randInt(0, r.skin.length - 1);
        st.hair = randInt(0, r.hair.length - 1);
        st.eyes = 0;
        G.audio.play('portal', { vol: 0.5 });
        rebuild();
        render();
      } else if (a === 'back') {
        ui.closeModal(false);
        showMainMenu(ui);
      } else if (a === 'begin') {
        const name = ($('#cr-name', el).value || '').trim() || st.name;
        const look = lookOf();
        ui.closeModal(false);
        ui.game.newGame({ name, race: st.race.id, look, boons: [...st.boons], attunement: st.attune }, slot);
      }
    }
  });
  el.addEventListener('input', (e) => {
    if (e.target.id === 'cr-h') {
      st.height = Number(e.target.value);
      rebuild();
    }
    if (e.target.id === 'cr-name') st.name = e.target.value;
  });
  render();
  rebuild();
}

function makePreview(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth || 380, canvas.clientHeight || 520, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(30, (canvas.clientWidth || 380) / (canvas.clientHeight || 520), 0.1, 50);
  cam.position.set(0, 1.25, 5.2);
  cam.lookAt(0, 1.0, 0);
  scene.add(new THREE.HemisphereLight('#dfe8ff', '#3a3028', 1.2));
  const key = new THREE.DirectionalLight('#fff0dd', 2.2);
  key.position.set(2, 4, 3);
  scene.add(key);
  const rim = new THREE.DirectionalLight('#7fa8ff', 1.4);
  rim.position.set(-3, 2, -3);
  scene.add(rim);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(1.2, 32).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#1a1a22' }));
  scene.add(floor);
  let rig = null;
  let alive = true;
  let last = performance.now();
  let yaw = 0.4;
  let drag = false;
  let lx = 0;
  canvas.addEventListener('pointerdown', (e) => {
    drag = true;
    lx = e.clientX;
  });
  window.addEventListener('pointerup', () => (drag = false));
  canvas.addEventListener('pointermove', (e) => {
    if (drag) {
      yaw += (e.clientX - lx) * 0.01;
      lx = e.clientX;
    }
  });
  const loop = (t) => {
    if (!alive) return;
    requestAnimationFrame(loop);
    const dt = Math.max(0, Math.min(0.05, (t - last) / 1000));
    last = t;
    if (!drag) yaw += dt * 0.35;
    if (rig) {
      rig.root.rotation.y = yaw;
      rig.update(dt, { speed: 0, grounded: true, weaponOut: false });
    }
    renderer.render(scene, cam);
  };
  requestAnimationFrame(loop);
  return {
    setRig(r) {
      if (rig) {
        scene.remove(rig.root);
        rig.dispose();
      }
      rig = r;
      rig.anim.setStance('none');
      scene.add(rig.root);
    },
    dispose() {
      alive = false;
      renderer.dispose();
    },
  };
}

// ------------------------------------------------------------ pause & settings
export function openPause(ui) {
  if (ui.game.state !== 'playing') return;
  const el = ui.openModal('pause', `<div class="panel" style="width:360px"><h2>PAUSED</h2>
    <button class="btn wide primary" data-a="resume">Resume</button>
    <button class="btn wide" data-a="char">Character <kbd>Tab</kbd></button>
    <button class="btn wide" data-a="map">Map <kbd>M</kbd></button>
    <button class="btn wide" data-a="lan">LAN Co-op${G.net && G.net.active ? ` <span class="muted">· ${G.net.playerCount} players</span>` : ''}</button>
    <button class="btn wide" data-a="settings">Settings</button>
    <button class="btn wide" data-a="help">How to Play</button>
    <div class="divider"></div>
    <button class="btn wide" data-a="quit">Save & Quit to Menu</button>
    ${G.player && G.player.inDanger ? '<div class="bad" style="font-size:14px;text-align:center;margin-top:6px">Quitting or reloading in danger costs a life.</div>' : ''}
    ${G.net && G.net.active ? '<div class="muted" style="font-size:13px;text-align:center;margin-top:6px">Co-op: the world keeps moving.</div>' : ''}
  </div>`, { pauses: true });
  const openedAt = performance.now();
  el.onclick = (e) => {
    const a = e.target.closest('[data-a]');
    if (!a) return;
    if (performance.now() - openedAt < 450) return; // swallow clicks that were meant as attacks
    G.audio.play('ui');
    switch (a.dataset.a) {
      case 'resume':
        ui.closeModal();
        break;
      case 'char':
        ui.openCharMenu();
        break;
      case 'map':
        ui.openMap();
        break;
      case 'lan':
        ui.openLan(false);
        break;
      case 'settings':
        openSettings(ui, () => openPause(ui));
        break;
      case 'help':
        openHelp(ui, () => openPause(ui));
        break;
      case 'quit':
        if (!a.dataset.armed) {
          a.dataset.armed = '1';
          a.textContent = 'Click again to Save & Quit';
          setTimeout(() => {
            if (a.isConnected) {
              delete a.dataset.armed;
              a.textContent = 'Save & Quit to Menu';
            }
          }, 3000);
          break;
        }
        ui.closeModal(false);
        ui.game.quitToMenu();
        break;
    }
  };
}

export function openSettings(ui, back) {
  const s = ui.game.settings;
  const slider = (k, n, mn, mx, stp) => `<div class="settings-row"><span>${n}</span><input type="range" data-k="${k}" min="${mn}" max="${mx}" step="${stp}" value="${s[k]}" aria-label="${n}"><span class="v" id="sv-${k}">${fmt(k, s[k])}</span></div>`;
  const check = (k, n, title) => `<label class="check" title="${escapeHtml(title || '')}"><input type="checkbox" data-c="${k}" ${s[k] ? 'checked' : ''}> ${n}</label>`;
  const fmt = (k, v) => (k === 'fov' ? Math.round(v) : k === 'uiScale' ? `${Math.round(v * 100)}%` : Number(v).toFixed(2));
  const q = (id, n) => `<button class="btn small ${s.quality === id ? 'primary' : ''}" data-q="${id}">${n}</button>`;
  const el = ui.openModal('settings', `<div class="panel settings-panel"><h2>SETTINGS</h2>
    <div class="settings-body">
      <h3>CONTROLS AND CAMERA</h3>
      ${slider('sensitivity', 'Mouse Sensitivity', 0.2, 3, 0.05)}
      ${slider('fov', 'Field of View', 55, 100, 1)}
      ${slider('cameraShake', 'Camera Shake', 0, 1.5, 0.05)}
      <div class="check-row">${check('invertY', 'Invert Y')}</div>
      <h3>SOUND</h3>
      ${slider('master', 'Master Volume', 0, 1, 0.05)}
      ${slider('sfx', 'Effects Volume', 0, 1, 0.05)}
      ${slider('music', 'Music Volume', 0, 1, 0.05)}
      <h3>GRAPHICS</h3>
      <div class="settings-row"><span>Quality</span><div class="row-flex">${q('high', 'High')}${q('medium', 'Medium')}${q('low', 'Low')}</div><span></span></div>
      <div class="muted settings-note">High: bloom, light shafts, water reflections. Medium: the same at a lower resolution, without reflections. Low: no post-processing, the fastest.</div>
      ${slider('viewDistance', 'View Distance', 0.5, 1.5, 0.05)}
      <div class="check-row">${check('shadows', 'Shadows')}${check('damageNumbers', 'Damage numbers')}</div>
      <div class="check-row">${check('bounceLight', 'Bounce light (experimental): lifts faces the sun misses', 'An experimental light from below that lifts the faces the sun misses. Off by default.')}</div>
      <h3>INTERFACE AND ACCESS</h3>
      ${slider('uiScale', 'Interface Size', 0.85, 1.3, 0.05)}
      <div class="check-row">${check('reduceFlashing', 'Reduce flashing and shake', 'Dims the screen\'s flashes and holds camera shake low.')}${check('soundCues', 'Sound cues', 'Short captions, with their direction, for the sounds that warn: a swing out of view, a roar, whispers, your heartbeat.')}${check('tips', 'Tips', 'Short explanations the first time each system matters. The Journal\'s Guide keeps them all.')}</div>
    </div>
    <div class="divider"></div>
    <div class="row-flex"><span class="muted" style="font-size:13px">Changes apply at once and are kept for every slot. Keys can't be rebound.</span><span class="space"></span><button class="btn primary" data-a="back">Back</button></div>
  </div>`, { pauses: true, onClose: null });
  el.addEventListener('input', (e) => {
    const k = e.target.dataset.k;
    if (k) {
      s[k] = Number(e.target.value);
      $('#sv-' + k, el).textContent = fmt(k, s[k]);
      ui.game.applySettings();
    }
  });
  el.addEventListener('change', (e) => {
    const c = e.target.dataset.c;
    if (c) {
      s[c] = e.target.checked;
      // reduced flashing also holds the camera's shake low
      if (c === 'reduceFlashing' && s.reduceFlashing && s.cameraShake > 0.3) {
        s.cameraShake = 0.3;
        const r = el.querySelector('[data-k="cameraShake"]');
        if (r) r.value = '0.3';
        $('#sv-cameraShake', el).textContent = fmt('cameraShake', 0.3);
      }
      ui.game.applySettings();
    }
  });
  el.addEventListener('click', (e) => {
    const qb = e.target.closest('[data-q]');
    if (qb) {
      s.quality = qb.dataset.q;
      ui.game.applySettings();
      el.querySelectorAll('[data-q]').forEach((b) => b.classList.toggle('primary', b.dataset.q === s.quality));
    }
    if (e.target.closest('[data-a="back"]')) {
      ui.closeModal(false);
      back && back();
    }
  });
}

export function openHelp(ui, back) {
  const k = (a) => `<kbd>${escapeHtml(bindLabel(a))}</kbd>`;
  const el = ui.openModal('help', `<div class="panel help-panel"><h2>HOW TO SURVIVE</h2>
    <div class="help-cols">
      <div class="help-grid">${CONTROLS.map((r) => `<span class="help-keys">${controlKeys(r).map((x) => `<kbd>${escapeHtml(x)}</kbd>`).join('<span class="plus">+</span>')}</span><span>${controlText(r, (x) => `<kbd>${escapeHtml(x)}</kbd>`)}</span>`).join('')}
      </div>
      <div class="help-notes">
        <p><b class="gold">Posture.</b> Blocking fills your posture bar. When it breaks you are stunned and helpless. Parries cost nothing and stagger the attacker.</p>
        <p><b class="gold">Red flashes</b> mark unparryable attacks: dodge them. <b style="color:#ffaa1a">Orange</b> marks unblockable ones.</p>
        <p><b class="gold">Power.</b> Experience earns investment points one at a time. Invest the fifteenth point earned since your last Power to rise to the next ${k('menu')}: each rise brings a talent, a mantra and a full heal.</p>
        <p><b class="gold">Mantras</b> cost ether. Learn them as you rise; empower them with Mantra Sparks at an altar.</p>
        <p><b class="gold">Death.</b> On the surface it drags you into the Rift, whole: go through the keep and out its north door, ride the stone lift to the summit and step through the Wound to get home. A death in the Rift ends the character for good. Quitting or reloading in danger costs one of your three lives; an Ember of Life restores one.</p>
        <p><b class="gold">The end of a character.</b> After a death in the Rift, or its last life, the character is gone. Its name goes into the Register of the Lost, it earns Remembrance for the souls who come after, and it may leave one heirloom at the Wash.</p>
        <p><b class="gold">Survive.</b> Eat and drink (a new character's hotbar keeps water on <kbd>9</kbd> and bread on <kbd>0</kbd>). Wells refill waterskins. Sit at a campfire to cook and to invest your points (lay one from three Sticks or a Firewood); only an innkeeper's room sets where you wake.</p>
        <p><b class="gold">Three save slots</b> each keep their own character. Settings and the Register are shared. More in the Journal's Guide ${k('journal')}.</p>
      </div>
    </div>
    <div class="divider"></div>
    <div class="row-flex"><span class="space"></span><button class="btn primary" data-a="back">Back</button></div></div>`, { pauses: true });
  el.addEventListener('click', (e) => {
    if (e.target.closest('[data-a="back"]')) {
      ui.closeModal(false);
      back && back();
    }
  });
}

// ------------------------------------------------------------ death screens
export function deathScreen(ui, title, sub, time, then) {
  ui.closeAll(true);
  const el = document.createElement('div');
  el.id = 'death';
  el.className = 'screen';
  el.innerHTML = `<div class="t">${title}</div>${sub ? `<div class="s">${sub}</div>` : ''}`;
  ui.screens.appendChild(el);
  requestAnimationFrame(() => el.classList.add('on'));
  setTimeout(() => {
    try {
      then && then();
    } catch (e) {
      console.error(e);
    }
    el.classList.remove('on');
    setTimeout(() => el.remove(), 1300);
  }, time);
}

// The end of a character: its line in the register, the Remembrance it earned, and the one
// heirloom it leaves at the Wash. info is null when an unfinished choice is picked up again.
export function showWipe(ui, info) {
  const l = Legacy.load();
  const entry = (info && info.entry) || (l.pending && l.lost.find((e) => e.id === l.pending.entry)) || null;
  const pending = l.pending && entry && l.pending.entry === entry.id ? l.pending : null;
  const name = entry ? entry.name : info ? info.name : '';
  const race = entry ? entry.raceName : info ? info.race : '';
  const level = entry ? entry.level : info ? info.level : 1;
  const cause = entry ? entry.cause : info ? info.cause : '';
  let pick = null;
  const options = () => (pending ? pending.options.map((o, i) => `<button class="btn small ${pick === i ? 'primary' : ''}" data-pick="${i}">${pick === i ? '✓ ' : ''}${escapeHtml(o.name)}<span class="muted"> · ${o.kind}</span></button>`).join('') : '');
  const heirloomBlock = () => (pending ? `<h3>LEAVE AN HEIRLOOM</h3>
      <p class="muted" style="margin:0 0 8px;font-size:14px">Choose one thing to leave in the keepsake chest at the Wash. The next new character, in any slot, may claim it once.</p>
      ${l.heirloom ? `<p class="muted" style="margin:0 0 8px;font-size:14px"><span class="gold">${escapeHtml(l.heirloom.name)}</span>, left by ${escapeHtml(l.heirloom.from || 'another')}, still waits there: your choice takes its place.</p>` : ''}
      <div class="heirloom-picks">${options()}<button class="btn small ${pick === -1 ? 'primary' : ''}" data-pick="-1">${pick === -1 ? '✓ ' : ''}Leave nothing</button></div>` : '');
  const stats = entry ? `<div class="stat-list" style="max-width:420px;margin:12px auto;text-align:left">
      <span class="k">Time played</span><span>${fmtPlaytime(entry.playtime)}</span>
      <span class="k">Foes felled</span><span>${entry.kills}</span>
      <span class="k">Chapters reached</span><span>${entry.chapters}${entry.chapter ? ` · ${escapeHtml(entry.chapter)}` : ''}</span>
      <span class="k">Great foes slain</span><span>${entry.foes.length ? entry.foes.map(escapeHtml).join(', ') : 'none'}</span>
    </div>
    <div class="gold" style="font-family:var(--display);letter-spacing:.08em">+${entry.earned} Remembrance <span class="muted">· ${l.remembrance} held</span></div>` : `<div class="muted">${info ? info.kills : 0} foes felled</div>`;
  const html = () => `<div class="panel wipe-panel" style="text-align:center"><h2>YOUR JOURNEY ENDS</h2>
    <div style="font-family:var(--display);font-size:26px;color:var(--gold-2);letter-spacing:.1em">${escapeHtml(name)}</div>
    <div class="muted">${escapeHtml(race)} · Power ${level}</div>
    <div style="margin:10px 0;font-style:italic">${escapeHtml(cause || '')}</div>
    ${stats}
    <div style="text-align:left">${heirloomBlock()}</div>
    <div class="divider"></div>
    <button class="btn primary" data-a="ok" ${pending && pick === null ? 'disabled title="Choose an heirloom, or leave nothing"' : ''}>Return</button></div>`;
  const el = ui.openModal('wipe', html(), { closable: false });
  el.addEventListener('click', (e) => {
    const p = e.target.closest('[data-pick]');
    if (p) {
      pick = Number(p.dataset.pick);
      G.audio.play('ui');
      el.innerHTML = html();
      return;
    }
    const ok = e.target.closest('[data-a="ok"]');
    if (ok && !ok.disabled) {
      if (pending) Legacy.chooseHeirloom(pick >= 0 ? pick : null);
      ui.closeModal(false);
      showMainMenu(ui);
      G.audio.setMood('menu');
    }
  });
}

export function showVictory(ui) {
  const ch = ui.game.ch;
  if (!ch) return;
  const ending = ACTIONS.endingText ? ACTIONS.endingText() : null;
  const el = ui.openModal('victory', `<div class="panel" style="width:620px;text-align:center"><h2>THE TIDE STILLS</h2>
    <p style="font-size:18px;font-style:italic">${escapeHtml(ending || 'The Hollow Duke is gone. The tides slow. For the first time since the sky cracked, the isles hold still — for now.')}</p>
    <div class="stat-list" style="max-width:340px;margin:12px auto">
      <span class="k">Name</span><span>${escapeHtml(ch.name)}</span>
      <span class="k">Power</span><span>${ch.level}</span>
      <span class="k">Foes felled</span><span>${ch.stats.kills}</span>
      <span class="k">Deaths</span><span>${ch.stats.deaths}</span>
      <span class="k">Time</span><span>${Math.round(ch.stats.playtime / 60)} min</span>
    </div>
    <div class="muted">Your story can continue. The world is still unstable.</div>
    <div class="divider"></div>
    <button class="btn primary" data-a="ok">Continue</button></div>`, { pauses: true });
  el.addEventListener('click', (e) => {
    if (e.target.closest('[data-a="ok"]')) ui.closeModal();
  });
}
