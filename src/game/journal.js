// Evidence discoveries, reward claims, and the Journal [J].
import { G } from '../core/globals.js';
import { ACTIONS, KILL_HOOKS } from './hooks.js';
import { LORE, LORE_BY_ID, BESTIARY_NOTES } from '../data/lore.js';
import { INVESTIGATIONS } from '../data/chronicle.js';
import { discoveryChanges, investigationState, recordInvestigation } from './chronicle.js';
import { journalContent, rewardText } from '../ui/journalContent.js';
import { escapeHtml } from '../core/util.js';
import { openPanel } from '../ui/panel.js';
import { guideHtml } from '../ui/guide.js';

function ensure(ch) {
  ch.lore ||= [];
  ch.bestiary ||= {};
  ch.investigations ||= [];
  return ch;
}

KILL_HOOKS.push((game, e) => {
  const ch = ensure(game.ch);
  ch.bestiary[e.type] = (ch.bestiary[e.type] || 0) + 1;
});

ACTIONS.readLore = (id) => {
  const game = G.game;
  const ch = ensure(game.ch);
  const l = LORE_BY_ID[id];
  if (!l) return;
  const isNew = !ch.lore.includes(id);
  let changes = { chapters: [], ready: [] };
  if (isNew) {
    const before = { ...ch, lore: [...ch.lore] };
    ch.lore.push(id);
    changes = discoveryChanges(before, ch);
    G.player.addXp((40 + ch.level * 6) * (G.player.mods.lorekeeper ? 3 : 1));
    G.audio.play('quest', { vol: 0.6 });
    if (LORE.every((entry) => ch.lore.includes(entry.id))) G.ui.banner('LOREKEEPER', 'You have read every tablet in the isles.');
    game.save();
  }
  const related = INVESTIGATIONS.filter((entry) => entry.evidence.includes(id));
  openPanel(G.ui, 'lore', {
    width: 660,
    render: () => `<h2>${escapeHtml(l.title.toUpperCase())}</h2><div class="lore-entry"><div class="lp">${escapeHtml(l.place.toUpperCase())}</div><div class="lx">${escapeHtml(l.text)}</div></div>
      ${changes.chapters.length ? `<p class="good">Chronicle reconstructed: ${changes.chapters.map((entry) => escapeHtml(entry.title)).join(' · ')}</p>` : ''}
      ${changes.ready.length ? `<p class="good">Investigation ready to record: ${changes.ready.map((entry) => escapeHtml(entry.title)).join(' · ')}</p>` : ''}
      ${related.length ? `<p class="muted">Evidence for: ${related.map((entry) => escapeHtml(entry.title)).join(' · ')}</p>` : ''}
      <div class="row-flex"><span class="muted">${isNew ? 'Recorded' : 'Already recorded'} · ${LORE.filter((entry) => ch.lore.includes(entry.id)).length}/${LORE.length}</span><span class="space"></span><button class="btn" data-journal="investigations">Investigate</button><button class="btn" data-a="close">Close</button></div>`,
    onClick: (e) => {
      if (e.target.closest('[data-journal]')) openJournal(G.ui, related.length ? 'investigations' : 'chronicle');
    },
  });
};

// The Guide renders here; every other section comes from ui/journalContent.js.
function sectionHtml(ch, state) {
  if (state.tab === 'guide') return guideHtml(state.query);
  const extra = ACTIONS.journalPrefix ? ACTIONS.journalPrefix(ch, state.tab, state.query) : '';
  return extra + journalContent(ch, state.tab, state.query);
}

export function openJournal(ui, tab = 'atlas') {
  const ch = ensure(ui.game.ch);
  const state = { tab, query: '' };
  const render = () => {
    const ready = INVESTIGATIONS.filter((entry) => investigationState(ch, entry).status === 'ready').length;
    const tabs = [['story', 'Story'], ['standing', 'Standing'], ['chronicle', 'Chronicle'], ['atlas', 'Atlas'], ['investigations', `Investigations${ready ? ` (${ready})` : ''}`], ['lore', `Sources ${LORE.filter((entry) => ch.lore.includes(entry.id)).length}/${LORE.length}`], ['bestiary', 'Bestiary'], ['records', 'Records'], ['guide', 'Guide']];
    return `<div class="journal-heading"><div class="lp">CHARTS · RUMORS · DISCOVERIES</div><h2>WAYFARER’S JOURNAL</h2><p class="muted">Find a harbor. Learn its roads. Venture beyond the walls.</p></div>
      <nav class="tabs-x" aria-label="Journal sections">${tabs.map(([key, name]) => `<button class="btn small ${state.tab === key ? 'primary' : ''}" aria-pressed="${state.tab === key}" data-tab="${key}">${name}</button>`).join('')}</nav>
      <label class="journal-search">Search this section<input type="search" data-search placeholder="Search names, places, or recovered text…" value="${escapeHtml(state.query)}" autocomplete="off"></label>
      <div class="scroll" tabindex="0" aria-label="Journal entries">${sectionHtml(ch, state)}</div>
      <div class="divider"></div><div class="row-flex"><span class="muted"><kbd>J</kbd> to close · Discoveries belong to this character</span><span class="space"></span><button class="btn" data-a="close">Close</button></div>`;
  };
  const panel = openPanel(ui, 'journal', {
    width: 860,
    render,
    onClick: (e, rerender) => {
      const trackButton = e.target.closest('[data-track]');
      if (trackButton) {
        ACTIONS.trackQuest && ACTIONS.trackQuest(trackButton.dataset.track);
        rerender();
        return;
      }
      const tabButton = e.target.closest('[data-tab]');
      if (tabButton) {
        state.tab = tabButton.dataset.tab;
        state.query = '';
        rerender();
        panel.el.querySelector('.scroll').scrollTop = 0;
      }
      const recordButton = e.target.closest('[data-record]');
      if (!recordButton) return;
      if (ui.game.player.inDanger) return ui.toast('Find safety before recording an account.', 'bad');
      const entry = recordInvestigation(ch, recordButton.dataset.record);
      if (!entry) return;
      const reward = entry.reward;
      ui.game.player.addSilver(reward.silver || 0);
      for (const [id, count] of reward.items || []) ui.game.giveItem(id, count);
      ui.game.player.addXp(reward.xp || 0);
      G.audio.play('quest');
      ui.banner(entry.titleReward ? 'TITLE EARNED' : 'ACCOUNT RECORDED', entry.titleReward || entry.title);
      ui.toast(rewardText(reward), 'quest');
      ui.game.save();
      rerender();
    },
  });
  panel.el.addEventListener('input', (event) => {
    if (!event.target.matches('[data-search]')) return;
    state.query = event.target.value;
    const scroll = panel.el.querySelector('.scroll');
    scroll.innerHTML = sectionHtml(ch, state);
    scroll.scrollTop = 0;
  });
}
ACTIONS.openJournal = (ui, tab) => openJournal(ui || G.ui, tab);
