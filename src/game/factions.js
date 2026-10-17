// Faction standing, wanted status and guard hostility.
// Guards (team 'guard', see entities/enemy.js) ask ACTIONS.guardHostile whether to fight a
// player; standing changes run on the attacker's own machine (LAN-safe), and a friend's
// standing reaches the host through game.netExt.
import { G } from '../core/globals.js';
import { START_HOOKS, UPDATE_HOOKS, ACTIONS } from './hooks.js';
import { FACTIONS, HATED, RESTRICTED, REP, RIVALS, TIER_REWARDS, TIERS, tierOf } from '../data/factions.js';
import { OUTFITS } from '../data/items.js';
import { TRINKETS } from '../data/trinkets.js';

export function ensureStanding(ch) {
  ch.rep ||= {};
  for (const f in FACTIONS) if (typeof ch.rep[f] !== 'number') ch.rep[f] = 0;
  ch.wanted ||= {};
  ch.flags ||= {};
  return ch;
}

// Story-driven open war (set by the main storyline).
export function atWar(ch, f) {
  return !!(ch.flags && ch.flags[`war_${f}`]);
}

const standingOf = (p) => {
  if (!p) return null;
  if (p === G.player) return G.game.ch;
  if (p.isRemote) return p.netExt && p.netExt.fx;
  return null;
};

ACTIONS.guardHostile = (guard, p) => {
  const st = standingOf(p);
  const f = guard.faction;
  if (!st || !f) return false;
  if ((st.wanted?.[f] || 0) > 0) return true;
  if ((st.rep?.[f] ?? 0) <= HATED) return true;
  if (st.war?.[f] || (st.flags && st.flags[`war_${f}`])) return true;
  return false;
};

// A change of standing, and its rivals' share the other way (data/factions.js RIVALS), on one
// toast. Returns the changes made, faction to amount.
export function addRep(ch, f, n, quiet = false) {
  ensureStanding(ch);
  if (!FACTIONS[f] || !n) return {};
  const changes = { [f]: n };
  for (const [r, k] of Object.entries(RIVALS[f] || {})) {
    const m = Math.round(n * k);
    if (m && FACTIONS[r]) changes[r] = m;
  }
  const crossed = [];
  for (const [g, m] of Object.entries(changes)) {
    const before = tierOf(ch.rep[g]).name;
    ch.rep[g] = Math.max(-100, Math.min(100, ch.rep[g] + m));
    const after = tierOf(ch.rep[g]).name;
    if (before !== after) crossed.push([g, after, m]);
  }
  if (!quiet && G.ui) {
    const sign = (m) => (m > 0 ? '+' : '−') + Math.abs(m);
    const rivals = Object.entries(changes).filter(([g]) => g !== f).map(([g, m]) => `${FACTIONS[g].short} ${sign(m)}`);
    G.ui.toast(`${FACTIONS[f].name}: ${sign(n)} standing${rivals.length ? ` · ${rivals.join(' · ')}` : ''}`, n > 0 ? 'good' : 'bad');
    for (const [g, after, m] of crossed) G.ui.toast(`You are now ${after} with ${FACTIONS[g].short}.`, m > 0 ? 'quest' : 'bad');
  }
  if (crossed.some(([, , m]) => m > 0)) standingRewards(ch);
  return changes;
}

// The Honored's and the Exalted's rewards, each sent once (a flag per faction and tier), to
// whoever has reached the tier: on a rise, and at the start of play for one reached before.
const tierMin = (name) => TIERS.find((t) => t.name === name).min;
export function standingRewards(ch, game = G.game) {
  ensureStanding(ch);
  const sent = [];
  for (const [f, r] of Object.entries(TIER_REWARDS)) {
    for (const [tier, name] of [['honored', 'Honored'], ['exalted', 'Exalted']]) {
      const flag = `${tier}_${f}`;
      if (ch.flags[flag] || ch.rep[f] < tierMin(name)) continue;
      const give = r[tier];
      // the outfits and trinkets are agent/release's rows: a build without them keeps the gift
      // for when they exist
      if ((give.outfit && !OUTFITS[give.outfit]) || (give.trinket && !TRINKETS[give.trinket])) continue;
      ch.flags[flag] = true;
      if (give.outfit && game?.giveOutfit) game.giveOutfit(give.outfit);
      if (give.trinket && ACTIONS.giveTrinket) ACTIONS.giveTrinket(give.trinket);
      if (give.title) {
        ch.titles ||= [];
        if (!ch.titles.includes(give.title)) ch.titles.push(give.title);
      }
      sent.push([f, tier]);
      if (G.ui) G.ui.toast(tier === 'honored'
        ? `A courier from ${FACTIONS[f].short} finds you: their colours, and a token, for one they honour.`
        : `${FACTIONS[f].name} name you ${give.title}.`, 'quest');
    }
  }
  return sent;
}

ACTIONS.addRep = (f, n) => G.game && G.game.ch && addRep(G.game.ch, f, n);

export function markWanted(ch, f, secs) {
  ensureStanding(ch);
  const was = (ch.wanted[f] || 0) > 0;
  ch.wanted[f] = Math.min(600, Math.max(ch.wanted[f] || 0, secs));
  if (!was && G.ui) {
    G.ui.toast(`${FACTIONS[f].name} marks you as WANTED.`, 'bad');
    G.audio && G.audio.play('bell', { vol: 0.5 });
  }
}

export function fineFor(ch, f) {
  return Math.round(FACTIONS[f].fineBase + ch.level * 6 + Math.max(0, -ch.rep[f]) * 2);
}

// Pay off a faction's wanted mark and lift standing out of 'hated'.
export function payFine(ch, f) {
  ensureStanding(ch);
  const cost = fineFor(ch, f);
  if (ch.silver < cost) return false;
  ch.silver -= cost;
  ch.wanted[f] = 0;
  if (ch.rep[f] < -9) ch.rep[f] = -9;
  G.audio && G.audio.play('coin');
  G.ui && G.ui.toast(`Fine paid to ${FACTIONS[f].short}: ${cost} silver. Your record is cleared.`, 'good');
  return true;
}

// ---------------------------------------------------------------- hooks
START_HOOKS.push((game, ch) => {
  ensureStanding(ch);
  standingRewards(ch, game);
  if (!game._factionExt) {
    game._factionExt = true;
    const prev = game.netExt;
    game.netExt = () => {
      const c = game.ch;
      const base = prev ? prev() : {};
      if (!c) return base;
      const war = {};
      for (const f in FACTIONS) if (atWar(c, f)) war[f] = 1;
      const wanted = {};
      for (const f in c.wanted || {}) if (c.wanted[f] > 0) wanted[f] = Math.ceil(c.wanted[f]);
      return { ...base, fx: { rep: c.rep, wanted, war } };
    };
  }
});

// Striking a guard: a wanted mark and a dent in standing (rate limited per guard).
ACTIONS.onHitGuard = (guard, attacker) => {
  if (attacker !== G.player || !guard.faction) return;
  const ch = G.game.ch;
  const now = G.time;
  if (now - (guard._lastRepHit || -99) < 3) return;
  guard._lastRepHit = now;
  addRep(ch, guard.faction, REP.hitGuard, true);
  markWanted(ch, guard.faction, 150);
};

ACTIONS.onActorKilled = (e, killer) => {
  const p = G.player;
  const ch = G.game.ch;
  if (!p || !ch) return;
  const mine = killer === p || e.lastAttacker === p;
  if (e.team === 'guard' && e.faction && mine) {
    addRep(ch, e.faction, REP.killGuard);
    markWanted(ch, e.faction, 360);
    return;
  }
  // helping guards against a monster earns a little trust
  if (e.team === 'enemy' && mine) {
    for (const a of G.actors) {
      if (a.team === 'guard' && !a.dead && a.faction && a.target === e && a.pos.distanceTo(e.pos) < 20) {
        if ((ch._helpT || 0) < G.time) {
          ch._helpT = G.time + 20;
          addRep(ch, a.faction, REP.defendGuard, true);
        }
        break;
      }
    }
  }
};

// Wanted marks fade; restricted grounds warn, then mark trespassers.
let trespass = { zone: null, t: 0 };
UPDATE_HOOKS.push((game, dt) => {
  const ch = game.ch;
  const p = game.player;
  if (!ch || !p) return;
  ensureStanding(ch);
  for (const f in ch.wanted) if (ch.wanted[f] > 0) ch.wanted[f] = Math.max(0, ch.wanted[f] - dt);
  if (game.inRift || p.dead) return;
  let inZone = null;
  for (const z of RESTRICTED) {
    if (Math.hypot(p.pos.x - z.x, p.pos.z - z.z) > z.r) continue;
    const ok = ch.rep[z.faction] >= z.minRep || (z.papers && ch.flags.registryPapers && !atWar(ch, z.faction)) || (z.guestFlag && ch.flags[z.guestFlag]);
    if (!ok && !(ch.wanted[z.faction] > 0) && !atWar(ch, z.faction)) inZone = z;
  }
  if (inZone !== trespass.zone) {
    trespass = { zone: inZone, t: 0 };
    if (inZone) G.ui.toast(`You are trespassing in ${inZone.name}. Leave, or ${FACTIONS[inZone.faction].short} will treat you as an enemy.`, 'bad');
  } else if (inZone) {
    trespass.t += dt;
    if (trespass.t > 7) {
      markWanted(ch, inZone.faction, 180);
      trespass = { zone: null, t: 0 };
    }
  }
});

ACTIONS.wantedText = () => {
  const ch = G.game && G.game.ch;
  if (!ch || !ch.wanted) return null;
  let best = null;
  for (const f in ch.wanted) if (ch.wanted[f] > 0 && (!best || ch.wanted[f] > ch.wanted[best])) best = f;
  if (best) {
    const s = Math.ceil(ch.wanted[best]);
    return `WANTED · ${FACTIONS[best].short.toUpperCase()} ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }
  for (const f in FACTIONS) if (atWar(ch, f)) return `AT WAR · ${FACTIONS[f].short.toUpperCase()}`;
  return null;
};

// Dialogue helpers (merged into the NPC dialogue api by game/realm.js).
export function factionDialogueApi(game) {
  const ch = game.ch;
  return {
    rep: (f) => ensureStanding(ch).rep[f] ?? 0,
    addRep: (f, n) => addRep(ch, f, n),
    standing: (f) => tierOf(ensureStanding(ch).rep[f] ?? 0).name,
    wanted: (f) => (ensureStanding(ch).wanted[f] || 0) > 0,
    fine: (f) => fineFor(ensureStanding(ch), f),
    payFine: (f) => payFine(ch, f),
    atWar: (f) => atWar(ch, f),
  };
}

export { FACTIONS, tierOf };
