// Rift research runtime: pickups, glyph sequence, low-sanity secrets.
import { G } from '../core/globals.js';
import { ACTIONS, UPDATE_HOOKS, START_HOOKS } from './hooks.js';
import '../data/riftResearch.js';
import { INVESTIGATIONS } from '../data/chronicle.js';
import { investigationState } from './chronicle.js';
import { THIN_LORE, THIN_CHEST } from '../data/thinMind.js';

const GLYPH_ORDER = ['breath', 'burden', 'break', 'bell'];
const VAULT_CHEST = 'c_rift_vault';

export function riftResearchProgress(ch) {
  let found = 0;
  let total = 0;
  for (const id of ['rift_research', 'impossible_rooms', 'the_underside', 'the_ascent']) {
    const inv = INVESTIGATIONS.find((e) => e.id === id);
    if (!inv) continue;
    found += investigationState(ch, inv).found.length;
    total += inv.evidence.length;
  }
  return { found, total };
}

function thinMind() {
  const p = G.player;
  const ch = G.game && G.game.ch;
  if (!p || !ch) return false;
  return ch.sanity / Math.max(1, p.maxSanity) < 0.35;
}

function gateSecrets(world) {
  if (!world || world._riftResearchGated) return;
  world._riftResearchGated = true;
  for (const tab of world.loreTablets || []) {
    if (!THIN_LORE.has(tab.lore.id)) continue;
    if (tab.group) tab.group.visible = false;
    const prev = tab.interaction && tab.interaction.enabled;
    if (tab.interaction) tab.interaction.enabled = () => thinMind() && (!prev || prev());
  }
  for (const it of world.interactables) {
    if (it.id === THIN_CHEST) {
      const prev = it.enabled;
      it.enabled = () => thinMind() && (!prev || prev());
    }
    if (it.id === VAULT_CHEST) {
      const prev = it.enabled;
      it.enabled = () => !!(G.game?.ch?.flags?.rift_vault_unsealed) && (!prev || prev());
    }
  }
}

START_HOOKS.push((game) => {
  game.ch.flags ||= {};
  game.ch.flags.rift_glyph ||= [];
  gateSecrets(game.world);
});

UPDATE_HOOKS.push((game) => {
  const world = game.world;
  if (!world) return;
  gateSecrets(world);
  const thin = thinMind();
  for (const tab of world.loreTablets || []) {
    if (THIN_LORE.has(tab.lore.id) && tab.group) tab.group.visible = thin;
  }
  const archive = world.chests.find((c) => c.def.id === THIN_CHEST);
  if (archive) archive.mesh.visible = thin;
  for (const pk of world.rift?.pickups || []) {
    const taken = !!(game.ch.flags && game.ch.flags[`took_${pk.id}`]);
    pk.group.visible = !taken;
  }
});

ACTIONS.takeRiftPickup = (id, item) => {
  const game = G.game;
  if (!game) return;
  game.ch.flags ||= {};
  if (game.ch.flags[`took_${id}`]) return;
  game.ch.flags[`took_${id}`] = true;
  game.giveItem(item, 1);
  const pk = game.world.rift?.pickups?.find((p) => p.id === id);
  if (pk) pk.group.visible = false;
  game.quests.onItem();
  game.save();
};

ACTIONS.journalPrefix = (ch, tab) => {
  if (tab !== 'investigations' && tab !== 'chronicle' && tab !== 'records') return '';
  const { found, total } = riftResearchProgress(ch);
  return `<article class="lore-entry"><h3 class="lt">Rift Research</h3><div class="lp">A living wound, still staffed</div><div class="chronicle-text">
    <p>Evidence recovered across the Rift investigations, including the Ascent.</p>
    <div class="investigation-progress"><span>${found} / ${total} records</span><progress aria-label="Rift research" value="${found}" max="${Math.max(1, total)}"></progress></div>
    <p class="muted">Read camp journals, carvings and the thin archive. The last account answers what the Rift is, and why the islands shattered.</p>
  </div></article>`;
};

ACTIONS.traceRiftGlyph = (id, title) => {
  const game = G.game;
  if (!game) return;
  const ch = game.ch;
  ch.flags ||= {};
  ch.flags.rift_glyph ||= [];
  if (ch.flags.rift_vault_unsealed) {
    G.ui.toast('The vault already remembers the night.');
    return;
  }
  const step = ch.flags.rift_glyph;
  if (id === GLYPH_ORDER[step.length]) {
    step.push(id);
    G.audio.play('quest', { vol: 0.7 });
    if (step.length === 4) {
      ch.flags.rift_vault_unsealed = true;
      game.quests.onFlag();
      G.ui.banner('THE VAULT REMEMBERS', 'Breath. Burden. Break. Bell.');
    } else {
      G.ui.toast(`${title} accepts the sequence (${step.length}/4).`, 'quest');
    }
  } else if (id === GLYPH_ORDER[0]) {
    ch.flags.rift_glyph = ['breath'];
    G.audio.play('quest', { vol: 0.45 });
    G.ui.toast('Breath. The sequence begins again.', 'quest');
  } else {
    ch.flags.rift_glyph = [];
    G.ui.toast(`${title} is out of order. The night resets.`, 'bad');
  }
  game.save();
};
