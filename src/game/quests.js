// Quest state machine and rewards.
// A quest has either one objective (`objectives: [o]`, the classic form) or ordered `stages`.
// A stage is one objective, or `{ text, objectives: [...] }` whose objectives may be done in
// any order. Objective types:
//   kill {target, count}   collect {item, count, consume?}   talk {npc}   flag {flag}
//   boss {boss}            lore {lore}                       reach {x, z, r}
//   realm {realm: 'rift' | 'surface'}             quest {quest}   level {level}
//   any {of: [objective, ...]} — done when any one of them is
// State lives in ch.quests[id] = { state, progress, stage, sp: [per-objective progress], talked: {} }.
// Main-story quests carry `main: true` and chain into `next` when completed (data/story.js).
import { G } from '../core/globals.js';
import { QUESTS } from '../data/quests.js';
import { ITEMS } from '../data/items.js';
import { WEAPONS } from '../data/weapons.js';
import { OUTFITS } from '../data/items.js';
import { act, ACTIONS } from './hooks.js';
import { ENEMIES } from '../data/enemies.js';

// The objectives of the stage a quest is on (or its single classic objective).
export function stageObjectives(def, stage) {
  if (!def.stages) return def.objectives || [];
  const st = def.stages[Math.min(stage || 0, def.stages.length - 1)];
  return st ? st.objectives || [st] : [];
}

export class Quests {
  constructor(game) {
    this.game = game;
  }
  get ch() {
    return this.game.ch;
  }

  get(id) {
    const q = this.ch.quests[id];
    if (!q) return { state: 'none', progress: 0 };
    if (q.state === 'active' || q.state === 'ready') this._check(id);
    return this.ch.quests[id];
  }

  start(id, quiet = false) {
    const def = QUESTS[id];
    if (!def || this.ch.quests[id]) return;
    this.ch.quests[id] = { state: 'active', progress: 0, stage: 0, sp: [] };
    if (def.stages && def.stages[0].onEnter) this._enter(id, 0);
    this._check(id);
    G.audio.play('quest');
    if (!quiet) {
      if (def.main) {
        G.ui.banner(def.chapter ? `CHAPTER ${def.chapter}` : 'THE UNSTABLE TIDE');
        G.ui.toast(def.chapter ? `Chapter ${def.chapter}: ${def.name}` : def.name, 'quest');
      } else G.ui.toast(`New quest: ${def.name}`, 'quest');
    }
    G.ui.refreshQuests();
    this.game.save();
  }

  _enter(id, stage) {
    const st = QUESTS[id].stages[stage];
    if (st && st.onEnter) {
      try {
        st.onEnter(this.game);
      } catch (e) {
        console.error('[quest stage]', id, e);
      }
    }
  }

  // Whether one objective is satisfied. `i` indexes the objective inside its stage.
  _objDone(id, o, i) {
    const ch = this.ch;
    const q = ch.quests[id];
    q.sp ||= [];
    switch (o.type) {
      case 'kill':
        return (q.sp[i] || 0) >= o.count;
      case 'collect':
        q.sp[i] = Math.min(o.count, ch.inventory.items[o.item] || 0);
        return q.sp[i] >= o.count;
      case 'flag':
        return !!(ch.flags && ch.flags[o.flag]);
      case 'talk':
        return !!(q.talked && q.talked[o.npc]);
      case 'boss':
        return (ch.bossesDefeated || []).includes(o.boss);
      case 'lore':
        return (ch.lore || []).includes(o.lore);
      case 'reach':
        return !!(q.reached && q.reached[i]);
      case 'realm': {
        const p = G.player;
        if (!p) return false;
        const realm = this.game.inRift ? 'rift' : 'surface';
        return realm === o.realm;
      }
      case 'quest':
        return ch.quests[o.quest]?.state === 'done';
      case 'level':
        return ch.level >= o.level;
      case 'any':
        // satisfied by any one of several routes (e.g. holding the fragment, or having delivered it long ago)
        return o.of.some((x) => this._objDone(id, x, i));
      default:
        return false;
    }
  }

  // Classic single-objective quests keep their original progress fields.
  _classicDone(id) {
    const def = QUESTS[id];
    const q = this.ch.quests[id];
    const o = def.objectives[0];
    if (o.type === 'kill') return q.progress >= o.count;
    if (o.type === 'collect') {
      q.progress = Math.min(o.count, this.ch.inventory.items[o.item] || 0);
      return q.progress >= o.count && (def.requiredBosses || []).every((type) => (this.ch.bossesDefeated || []).includes(type));
    }
    if (o.type === 'flag') return !!this.ch.flags[o.flag];
    if (o.type === 'talk') return !!q.talked;
    if (o.type === 'boss' || o.type === 'lore' || o.type === 'quest' || o.type === 'level') return this._objDone(id, o, 0);
    return false;
  }

  // Advance through every finished stage; true when the whole quest is finished.
  _stagedDone(id) {
    const def = QUESTS[id];
    const q = this.ch.quests[id];
    q.stage ||= 0;
    // a pure travel step ("find Brigand Hold") is moot once the step after it is already done,
    // e.g. its guardian fell before the chapter began; nothing else is ever skipped
    const travelOnly = (k) => stageObjectives(def, k).every((o) => o.type === 'reach' || o.type === 'realm');
    const stateDone = (k) => stageObjectives(def, k).every((o, i) => ['boss', 'lore', 'collect', 'quest', 'level', 'any'].includes(o.type) && this._objDone(id, o, i));
    const skipTravel = () => {
      if (!travelOnly(q.stage)) return;
      let j = q.stage;
      while (j < def.stages.length - 1 && travelOnly(j)) j++;
      if (j > q.stage && stateDone(j)) {
        q.stage = j;
        q.sp = [];
        q.reached = {};
        q.talked = {};
      }
    };
    for (let guard = 0; guard < def.stages.length + 1; guard++) {
      skipTravel();
      const objs = stageObjectives(def, q.stage);
      const all = objs.every((o, i) => this._objDone(id, o, i));
      if (!all) return false;
      if (q.stage >= def.stages.length - 1) return true;
      const st = def.stages[q.stage];
      if (st.onDone) {
        try {
          st.onDone(this.game);
        } catch (e) {
          console.error('[quest stage]', id, e);
        }
      }
      q.stage++;
      q.sp = [];
      q.reached = {};
      q.talked = {};
      this._enter(id, q.stage);
      const next = def.stages[q.stage];
      if (G.ui && next) {
        G.ui.toast(`${def.name}: ${next.text}`, 'quest');
        G.audio.play('quest', { vol: 0.6 });
      }
    }
    return false;
  }

  _check(id) {
    const q = this.ch.quests[id];
    if (!q || q.state === 'done') return;
    const def = QUESTS[id];
    if (!def) return;
    const done = def.stages ? this._stagedDone(id) : this._classicDone(id);
    if (done && q.state === 'active') {
      q.state = 'ready';
      if (def.autoComplete) {
        this.complete(id);
        return;
      }
      G.ui.toast(`${def.name}: return to ${this.giverName(id)}`, 'quest');
      G.audio.play('quest');
      G.ui.refreshQuests();
    } else if (!done && q.state === 'ready') q.state = 'active';
  }

  giverName(id) {
    const npc = this.game.npcs.find((n) => n.id === QUESTS[id].turnIn);
    return npc ? npc.name : 'the quest giver';
  }

  complete(id) {
    const def = QUESTS[id];
    const q = this.ch.quests[id];
    if (!q) return;
    // re-verify: a stale 'ready' must still have its items and boss history
    if (q.state === 'active' || q.state === 'ready') {
      this._check(id);
      if (q.state === 'done') return;
    }
    if (q.state !== 'ready') return;
    // consume collected quest items (classic `consume`, or per-objective in stages)
    if (def.stages) {
      for (const st of def.stages) for (const o of st.objectives || [st]) if (o.type === 'collect' && (o.consume ?? def.consume)) this.game.takeItem(o.item, o.count);
    } else {
      const o = def.objectives[0];
      if (def.consume && o.type === 'collect') this.game.takeItem(o.item, o.count);
    }
    q.state = 'done';
    const r = def.rewards || {};
    const p = G.player;
    if (r.silver) {
      p.addSilver(r.silver);
      G.audio.play('coin');
    }
    for (const [it, n] of r.items || []) this.game.giveItem(it, n);
    for (const w of r.weapons || []) this.game.giveWeapon(w);
    for (const o2 of r.outfits || []) this.game.giveOutfit(o2);
    for (const t of r.trinkets || []) act('giveTrinket', t);
    for (const [f, n] of Object.entries(r.rep || {})) if (ACTIONS.addRep) ACTIONS.addRep(f, n);
    for (const [k, v] of Object.entries(r.flags || {})) this.ch.flags[k] = v;
    G.ui.banner(def.main ? 'CHAPTER COMPLETE' : 'QUEST COMPLETE');
    G.ui.toast(`${def.main ? 'Chapter complete' : 'Quest complete'}: ${def.name}${r.silver ? `  ·  +${r.silver} silver` : ''}`, 'quest');
    if (r.xp) p.addXp(r.xp);
    if (def.onComplete) {
      try {
        def.onComplete(this.game);
      } catch (e) {
        console.error('[quest complete]', id, e);
      }
    }
    if (def.final) this.game.onFinalVictory();
    // the story continues
    if (def.next && QUESTS[def.next] && !this.ch.quests[def.next]) {
      const nd = QUESTS[def.next];
      if (!nd.minLevel || this.ch.level >= nd.minLevel) setTimeout(() => this.game.ch === this.ch && this.start(def.next), 3500);
    }
    G.ui.refreshQuests();
    this.game.save();
  }

  // ---- event feeds
  _eachActive(fn) {
    for (const id in this.ch.quests) {
      const q = this.ch.quests[id];
      const def = QUESTS[id];
      if (!def || q.state !== 'active') continue;
      fn(id, q, def);
    }
  }

  onKill(type) {
    this._eachActive((id, q, def) => {
      if (def.stages) {
        stageObjectives(def, q.stage).forEach((o, i) => {
          if (o.type === 'kill' && [].concat(o.target).includes(type)) {
            q.sp ||= [];
            q.sp[i] = (q.sp[i] || 0) + 1;
          }
        });
        this._check(id);
      } else {
        const o = def.objectives[0];
        if (o.type === 'kill' && o.target.includes(type)) {
          q.progress = (q.progress || 0) + 1;
          this._check(id);
        }
      }
    });
    G.ui.refreshQuests();
  }

  onFlag() {
    for (const id in this.ch.quests) this._check(id);
    G.ui.refreshQuests();
  }

  onItem() {
    for (const id in this.ch.quests) if (this.ch.quests[id].state !== 'done') this._check(id);
    G.ui.refreshQuests();
  }

  onTalk(npcId) {
    this._eachActive((id, q, def) => {
      if (def.stages) {
        if (stageObjectives(def, q.stage).some((o) => o.type === 'talk' && o.npc === npcId)) {
          q.talked = { ...(q.talked || {}), [npcId]: true };
          this._check(id);
        }
      } else {
        const o = def.objectives[0];
        if (o.type === 'talk' && o.npc === npcId) {
          q.talked = true;
          this._check(id);
        }
      }
    });
  }

  // Polled by game/story.js: reach and realm objectives.
  onPosition(p) {
    this._eachActive((id, q, def) => {
      if (!def.stages) return;
      let hit = false;
      stageObjectives(def, q.stage).forEach((o, i) => {
        if (o.type === 'reach' && Math.hypot(p.x - o.x, p.z - o.z) < (o.r || 20)) {
          q.reached = { ...(q.reached || {}), [i]: true };
          hit = true;
        }
        if (o.type === 'realm' || o.type === 'level' || o.type === 'boss' || o.type === 'lore' || o.type === 'quest') hit = true;
      });
      if (hit) this._check(id);
    });
  }

  // Text for one objective, with a counter where it helps.
  objectiveText(id, o, i) {
    const q = this.ch.quests[id];
    let text = o.text || '';
    if (o.type === 'kill' || o.type === 'collect') text += ` (${Math.min((q.sp && q.sp[i]) || 0, o.count)}/${o.count})`;
    return text;
  }

  active() {
    const list = Object.keys(this.ch.quests)
      .filter((id) => this.ch.quests[id].state !== 'done' && QUESTS[id])
      .map((id) => {
        const def = QUESTS[id];
        const q = this.get(id);
        let text;
        if (def.stages) {
          const st = def.stages[Math.min(q.stage || 0, def.stages.length - 1)];
          const objs = st.objectives || [st];
          if (st.objectives) {
            const left = objs.map((o, i) => [o, i]).filter(([o, i]) => !this._objDone(id, o, i)).map(([o, i]) => this.objectiveText(id, o, i));
            text = `${st.text}${left.length ? ` — ${left.join(' · ')}` : ''}`;
          } else text = this.objectiveText(id, objs[0], 0) || st.text;
        } else {
          const o = def.objectives[0];
          text = o.text;
          if (o.type === 'kill' || o.type === 'collect') text += ` (${Math.min(q.progress || 0, o.count)}/${o.count})`;
          const missing = (def.requiredBosses || []).filter((type) => !(this.ch.bossesDefeated || []).includes(type));
          if (missing.length) text += ` · Still required: ${missing.map((type) => ENEMIES[type].name).join(', ')}`;
        }
        if (q.state === 'ready') text = `Return to ${this.giverName(id)}`;
        return { id, name: def.main && def.chapter ? `${def.chapter} · ${def.name}` : def.name, text, ready: q.state === 'ready', desc: def.desc, main: !!def.main, tracked: this.ch.trackedQuest === id };
      });
    // the tracked quest first, then the main story, then the rest
    return list.sort((a, b) => (b.tracked - a.tracked) || (b.main - a.main));
  }
}

export { ITEMS, WEAPONS, OUTFITS };
