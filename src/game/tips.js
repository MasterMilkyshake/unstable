// First-time tips (data/tips.js): each shown once per profile, the first time it matters, in a
// card at the HUD's left that never pauses the game. Settings → Tips turns them off. Other
// systems can show one by id: ACTIONS.tip('contracts', { fields }).
import { G } from '../core/globals.js';
import { ACTIONS, UPDATE_HOOKS, START_HOOKS } from './hooks.js';
import { TIPS } from '../data/tips.js';
import { keyText } from '../core/input.js';
import { Legacy } from '../core/legacy.js';
import { escapeHtml, hypot } from '../core/util.js';

const SEEN_KEY = 'unstable.tips.v1';
const SHOW_S = 11; // how long a card stays up
const GAP_S = 3; // the quiet between two cards

function loadSeen() {
  try {
    const v = JSON.parse(localStorage.getItem(SEEN_KEY) || '[]');
    return new Set(Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
  } catch (_) {
    return new Set();
  }
}
let seen = loadSeen();
function markSeen(id) {
  seen.add(id);
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
  } catch (_) {
    /* ignore */
  }
}
export function resetTips() {
  seen = new Set();
  try {
    localStorage.removeItem(SEEN_KEY);
  } catch (_) {
    /* ignore */
  }
}

const TIP_COUNT = Object.keys(TIPS).length;
const queue = [];
let shown = null; // { id, t }
let gapT = 0;
let el = null;

function card() {
  if (!el) el = document.getElementById('tip');
  return el;
}
const on = () => !!(G.settings && G.settings.tipPopups);

// Queue a tip unless it has been seen; `fields` fill its {name} slots.
export function tip(id, fields = {}) {
  if (!TIPS[id] || seen.has(id) || queue.some((q) => q.id === id) || (shown && shown.id === id)) return false;
  queue.push({ id, fields });
  return true;
}
ACTIONS.tip = tip;

function render(t) {
  const def = TIPS[t.id];
  let text = escapeHtml(keyText(def.text, (k) => `\u0001${k}\u0002`));
  text = text.replace(/\u0001([^\u0002]*)\u0002/g, '<kbd>$1</kbd>');
  for (const [k, v] of Object.entries(t.fields)) text = text.split(`{${k}}`).join(escapeHtml(String(v)));
  const c = card();
  if (!c) return;
  c.innerHTML = `<div class="tip-t">${escapeHtml(def.title)}</div><div class="tip-x">${text}</div><div class="tip-f">The Journal's Guide <kbd>${escapeHtml(keyText('{journal}'))}</kbd> keeps every tip.</div>`;
  c.classList.remove('hidden');
  c.classList.add('on');
}
function hide() {
  const c = card();
  if (c) {
    c.classList.remove('on');
    c.classList.add('hidden');
  }
  shown = null;
  gapT = GAP_S;
}

// ---------------------------------------------------------------- when each matters
let checkT = 0;
let wallT = 0;
function watch(game, dt) {
  const p = game.player;
  const ch = game.ch;
  checkT -= dt;
  if (checkT > 0) return;
  checkT = 0.25;
  // a foe that has noticed you (once both are seen, no need to look)
  let foe = null;
  let down = null;
  if (!(seen.has('fight') && seen.has('grip'))) for (const a of G.actors) {
    if (a.dead || a.team !== 'enemy' || a.dummy) continue;
    const d = hypot(a.pos.x - p.pos.x, a.pos.z - p.pos.z);
    if (a.aggro && d < 25) foe = a;
    if (a.knocked && d < 8) down = a;
  }
  if (foe) {
    if (!ch.armed) tip('fists');
    tip('fight');
  }
  if (down) tip('grip', { who: down.name || 'Your foe' });
  if ((ch.stats.kills || 0) >= 1 && !p.inDanger) tip('moves');
  // the first hang, or the first time you're in the air against a wall
  if (!seen.has('ledge')) {
    if (p.climbing) tip('ledge');
    else if (!p.grounded && (wallT -= 0.25) <= 0) {
      wallT = 0.5;
      if (p.probeWall && p.probeWall()) tip('ledge');
    }
  }
  if (!seen.has('lines')) {
    for (const it of game.world.interactables) if (it.kind === 'zipline' && it.pos.distanceTo(p.pos) < 14) tip('lines');
    // a line's station (the world-life session's), where a new player first meets one
    for (const st of game.world.lineStations || []) {
      const at = st.pos || st;
      if (Number.isFinite(at.x) && hypot(at.x - p.pos.x, at.z - p.pos.z) < 14) tip('lines');
    }
  }
  const docks = game.world.docks;
  if (!seen.has('sail') && !p.boat && docks) {
    for (const k in docks) {
      const d = docks[k];
      if (d.end && hypot(d.end.x - p.pos.x, d.end.z - p.pos.z) < 12) tip('sail');
    }
  }
  if (ch.level >= 2 || (ch.earned || 0) > 0) tip('power');
  if (ch.talentPicks > 0 || ch.mantraPicks > 0) tip('picks');
  if (ch.hunger < 35 || ch.water < 35) tip('hunger', { need: ch.hunger < 35 && ch.water < 35 ? 'hungry and thirsty' : ch.hunger < 35 ? 'hungry' : 'thirsty' });
  if (game.inRift) tip('rift');
  if (ch.lives < ch.maxLives) tip('lifeLost', { lives: ch.lives, max: ch.maxLives });
  if (seen.has('lifeLost') || (ch.stats.playtime || 0) > 600) tip('slots');
  if (ch.level >= 5 && !ch.vow) tip('vow');
  if (ch.level >= 15 && ch.vow && !ch.resonance) tip('resonance');
  if ((ch.inventory.items.mantra_spark || 0) > 0) tip('spark');
  if ((ch.lore || []).length >= 1) tip('journal');
  if (ACTIONS.eventState && ACTIONS.eventState()) tip('worldEvents');
}

UPDATE_HOOKS.push((game, dt) => {
  if (!game.player || !game.ch || game.player.dead || game.transitioning) return;
  if (!shown && !queue.length && seen.size >= TIP_COUNT) return; // every tip seen
  if (!on()) {
    if (shown) hide();
    queue.length = 0;
    return;
  }
  watch(game, dt);
  if (shown) {
    shown.t -= dt;
    if (shown.t <= 0) hide();
    return;
  }
  gapT -= dt;
  if (gapT > 0 || !queue.length || game.ui.isOpen() || game.player.knocked) return;
  const next = queue.shift();
  if (seen.has(next.id)) return;
  markSeen(next.id);
  shown = { id: next.id, t: SHOW_S };
  render(next);
});

START_HOOKS.push((game, ch) => {
  queue.length = 0;
  if (shown) hide();
  gapT = 4; // after the waking banner
  const h = Legacy.claimState(ch);
  if (h.state === 'ready') tip('heirloom', { from: h.heirloom.from || 'One who came before' });
});
