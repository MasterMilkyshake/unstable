import { CHRONICLE, INVESTIGATIONS, ATLAS, INVESTIGATION_BY_ID } from '../data/chronicle.js';
import { LORE, LORE_BY_ID, BESTIARY_NOTES } from '../data/lore.js';
import { ENEMIES } from '../data/enemies.js';
import { ITEMS } from '../data/items.js';
import { investigationState, hasEvidence } from '../game/chronicle.js';
import { escapeHtml as esc } from '../core/util.js';
import { QUESTS } from '../data/quests.js';
import { ACTS, MAIN_CHAIN } from '../data/story.js';
import { FACTIONS, tierOf } from '../data/factions.js';

const paragraphs = (texts) => texts.map((text) => `<p>${esc(text)}</p>`).join('');
const match = (query, ...texts) => texts.join(' ').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
const card = (title, subtitle, body, locked = false) => `<article class="lore-entry ${locked ? 'locked' : ''}"><h3 class="lt">${esc(title)}</h3><div class="lp">${esc(subtitle)}</div><div class="chronicle-text">${body}</div></article>`;

export function rewardText(reward) {
  return [reward.xp && `${reward.xp} XP`, reward.silver && `${reward.silver} silver`, ...(reward.items || []).map(([id, n]) => `${n} × ${ITEMS[id].name}`)].filter(Boolean).join(', ');
}

function evidenceList(ch, evidence) {
  return `<ul class="evidence-list">${evidence.map((id) => {
    const entry = LORE_BY_ID[id];
    const read = (ch.lore || []).includes(id);
    return `<li class="${read ? 'found' : ''}"><span aria-label="${read ? 'Recovered' : 'Missing'}">${read ? '✓' : '◇'}</span> ${esc(read ? entry.title : 'Unrecovered record')}<span class="muted">, ${esc(entry.place)}</span></li>`;
  }).join('')}</ul>`;
}

// ---- the story threads you have taken up, faction paths and standing
function storyTab(ch, query) {
  const parts = [];
  const statusOf = (id) => ch.quests[id]?.state || 'none';
  for (const act of ACTS) {
    const threads = MAIN_CHAIN.filter((id) => QUESTS[id].act === act.id);
    const rows = threads.map((id) => {
      const def = QUESTS[id];
      const st = statusOf(id);
      const q = ch.quests[id] || {};
      // threads appear once someone has offered and you have taken them up; nothing is shown locked
      if (st === 'none' || !match(query, def.name, act.subtitle, def.desc)) return '';
      const badge = st === 'done' ? '<span class="pill">Complete</span>' : st === 'ready' ? '<span class="pill gold">Return to turn in</span>' : '<span class="pill gold">Under way</span>';
      let steps = '';
      if (def.stages && st !== 'none') {
        steps = `<ol class="story-steps">${def.stages.map((stage, i) => {
          const done = st === 'done' || i < (q.stage || 0) || (st === 'ready');
          const now = st === 'active' && i === (q.stage || 0);
          return `<li class="${done ? 'found' : now ? 'now' : ''}">${done ? '✓' : now ? '◆' : '◇'} ${esc(i <= (q.stage || 0) || st === 'done' || st === 'ready' ? stage.text : 'Further steps unfold as you go')}</li>`;
        }).join('')}</ol>`;
      }
      const track = st === 'active' || st === 'ready' ? `<button class="btn small ${ch.trackedQuest === id ? 'primary' : ''}" data-track="${id}">${ch.trackedQuest === id ? 'Tracking' : 'Track'}</button>` : '';
      return `<article class="lore-entry"><h3 class="lt">${esc(def.name)} ${badge}</h3>
        <div class="lp">Suggested Power ${esc(def.power || '?')}</div>
        <div class="chronicle-text">${st !== 'none' ? `<p>${esc(def.desc)}</p>` : ''}${steps}${track}</div></article>`;
    }).join('');
    if (rows) parts.push(`<h3 class="act-title">${esc(act.subtitle)}</h3>${rows}`);
  }
  const paths = Object.entries(QUESTS).filter(([, d]) => d.path);
  const pathRows = paths.map(([id, def]) => {
    const st = statusOf(id);
    if (st === 'none' || !match(query, def.name, def.desc)) return '';
    const fac = FACTIONS[def.path];
    return `<article class="lore-entry"><h3 class="lt">${esc(def.name)} <span class="pill" style="color:${fac.color}">${esc(fac.short)}</span> ${st === 'done' ? '<span class="pill">Complete</span>' : ''}</h3><div class="chronicle-text"><p>${esc(def.desc)}</p>${st === 'active' || st === 'ready' ? `<button class="btn small ${ch.trackedQuest === id ? 'primary' : ''}" data-track="${id}">${ch.trackedQuest === id ? 'Tracking' : 'Track'}</button>` : ''}</div></article>`;
  }).join('');
  if (pathRows) parts.push(`<h3 class="act-title">Faction paths</h3>${pathRows}`);
  return parts.join('');
}

function standingTab(ch) {
  const rep = ch.rep || {};
  return Object.entries(FACTIONS).map(([id, f]) => {
    const v = rep[id] ?? 0;
    const tier = tierOf(v);
    const wanted = (ch.wanted?.[id] || 0) > 0;
    const war = !!(ch.flags && ch.flags[`war_${id}`]);
    const pct = Math.round(((v + 100) / 200) * 100);
    const status = war ? '<span class="pill bad">At war</span>' : wanted ? `<span class="pill bad">Wanted for ${Math.ceil(ch.wanted[id])} s more</span>` : '';
    return `<article class="lore-entry"><h3 class="lt" style="color:${f.color}">${esc(f.name)} ${status}</h3><div class="lp">${esc(f.home)}, <span style="color:${tier.color}">${esc(tier.name)}</span> (${v > 0 ? '+' : ''}${v})</div>
      <div class="standing-bar"><i style="width:${pct}%;background:${f.color}"></i></div>
      <div class="chronicle-text"><p>${esc(f.desc)}</p><p class="muted">Their guards fight anyone they hate (−50 or lower), anyone they have marked as wanted, and anyone at war with them. Striking a guard marks you; a fine paid to their officer clears it.</p></div></article>`;
  }).join('');
}

export function journalContent(ch, tab, query = '') {
  let entries = [];
  if (tab === 'story') return storyTab(ch, query) || '<p class="journal-empty">No threads yet. People around the coast will point you toward them; Old Wren, by the fire on the Wash, is a good place to ask.</p>';
  if (tab === 'standing') return standingTab(ch);
  if (tab === 'chronicle') {
    entries = CHRONICLE.map((entry) => {
      const unlocked = hasEvidence(ch, entry.evidence);
      // Never search unrevealed prose: even matching a secret can disclose it.
      if (!match(query, entry.title, entry.category, entry.subtitle, ...(unlocked ? entry.paragraphs : []))) return '';
      return card(entry.title, `${entry.category}, ${entry.subtitle}`, unlocked
        ? paragraphs(entry.paragraphs) + (entry.evidence.length ? `<details><summary>Sources</summary>${evidenceList(ch, entry.evidence)}</details>` : '')
        : `<p>Recover these sources to reconstruct this account.</p>${evidenceList(ch, entry.evidence)}`, !unlocked);
    });
  } else if (tab === 'investigations') {
    entries = INVESTIGATIONS.map((entry) => {
      const state = investigationState(ch, entry);
      const revealed = state.complete || state.status === 'recorded';
      if (!match(query, entry.title, entry.tier, entry.question, ...(revealed ? [entry.conclusion] : []))) return '';
      const status = { recorded: 'Recorded', ready: 'Ready to record', in_progress: 'In progress', undiscovered: 'Follow the evidence' }[state.status];
      return card(entry.title, `${entry.tier}, ${status}`, `<p>${esc(entry.question)}</p>
        <div class="investigation-progress"><span>${state.found.length} / ${entry.evidence.length} records recovered</span><progress aria-label="Evidence recovered" value="${state.found.length}" max="${entry.evidence.length}"></progress></div>
        ${evidenceList(ch, entry.evidence)}
        ${state.remaining.length ? `<p class="muted">Record first: ${state.remaining.map((id) => esc(INVESTIGATION_BY_ID[id].title)).join(', ')}.</p>` : ''}
        ${revealed ? `<div class="investigation-conclusion">${paragraphs([entry.conclusion])}</div>` : '<p class="muted">The conclusion will become available when every source and prerequisite is recovered.</p>'}
        <div class="investigation-reward">${esc(rewardText(entry.reward))}${entry.titleReward ? `<br>Title: ${esc(entry.titleReward)}` : ''}</div>
        ${state.status === 'recorded' ? '<span class="pill">Account recorded and reward claimed</span>' : `<button class="btn small ${state.status === 'ready' ? 'primary' : ''}" data-record="${entry.id}" ${state.status === 'ready' ? '' : 'disabled'}>Record account & claim reward</button>`}`);
    });
  } else if (tab === 'atlas') {
    entries = ATLAS.map((entry) => {
      const visited = (ch.regions || []).includes(entry.id);
      if (!match(query, entry.title, entry.subtitle, ...(visited ? [entry.history, entry.life, entry.danger, entry.route] : []))) return '';
      return card(entry.title, `${entry.subtitle}, Suggested Power ${entry.power}`, visited
        ? `<p class="atlas-arrival">${esc(entry.arrival)}</p>${[['History', entry.history], ['Daily life', entry.life], ['Threats', entry.danger], ['Routes & leads', entry.route]].map(([title, text]) => `<h4>${title}</h4><p>${esc(text)}</p>`).join('')}`
        : '<p>Reach this island to add its field notes. Suggested Power describes danger, not an entry requirement.</p>', !visited);
    });
  } else if (tab === 'lore') {
    entries = LORE.map((entry) => {
      const read = (ch.lore || []).includes(entry.id);
      if (!match(query, entry.place, ...(read ? [entry.title, entry.text] : []))) return '';
      return card(read ? entry.title : 'Unread tablet', entry.place, read ? `<p class="source-text">${esc(entry.text)}</p>` : '', !read);
    });
  } else if (tab === 'bestiary') {
    entries = Object.entries(BESTIARY_NOTES).map(([type, note]) => {
      const n = ch.bestiary?.[type] || 0;
      const enemy = ENEMIES[type];
      if (!enemy || !match(query, ...(n ? [enemy.name, enemy.title || '', note] : ['Unknown creature']))) return '';
      return card(n ? `${enemy.name}${enemy.title ? `, ${enemy.title}` : ''}` : 'Unknown creature', n ? `${enemy.boss ? 'GREAT FOE, ' : ''}SLAIN ${n}` : enemy.boss ? 'GREAT FOE' : 'CREATURE', n ? paragraphs([note]) : '', !n);
    });
  } else {
    const st = ch.stats || {};
    const minutes = Math.floor((st.playtime || 0) / 60);
    const rows = [
      ['Time in the isles', `${Math.floor(minutes / 60)}h ${minutes % 60}m`],
      ['Foes slain', st.kills || 0], ['Great foes vanquished', (ch.bossesDefeated || []).length],
      ['Times the Rift claimed you', st.deaths || 0], ['Lives remaining', `${ch.lives} / ${ch.maxLives}`],
      ['Fish caught', st.fishCaught || 0], ['Quests completed', Object.values(ch.quests || {}).filter((q) => q.state === 'done').length],
      ['Tablets read', `${LORE.filter((l) => (ch.lore || []).includes(l.id)).length} / ${LORE.length}`],
      ['Accounts reconstructed', `${CHRONICLE.filter((entry) => hasEvidence(ch, entry.evidence)).length} / ${CHRONICLE.length}`],
      ['Investigations recorded', `${INVESTIGATIONS.filter((entry) => (ch.investigations || []).includes(entry.id)).length} / ${INVESTIGATIONS.length}`],
      ['Regions visited', `${ATLAS.filter((entry) => (ch.regions || []).includes(entry.id)).length} / ${ATLAS.length}`],
      ['Creatures catalogued', `${Object.keys(ch.bestiary || {}).filter((key) => BESTIARY_NOTES[key]).length} / ${Object.keys(BESTIARY_NOTES).length}`],
      ['Titles earned', (ch.titles || []).join(', ') || 'None yet'],
    ];
    entries = rows.filter(([label, value]) => match(query, label, value)).map(([label, value]) => `<div class="shop-row"><div style="flex:1">${esc(label)}</div><div class="pr">${esc(String(value))}</div></div>`);
  }
  return entries.filter(Boolean).join('') || '<p class="journal-empty">No entries match this search. Unrecovered texts remain hidden.</p>';
}
