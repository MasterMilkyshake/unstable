// Watch hands held at Redwake camps (docs/agent/WORLD_LIFE_PLAN.md, task 10: "rescuing a
// faction's captives raises standing"), run by game/worldLife.js's director. Bound, they kneel by
// the camp's stake (NPCs, shown while the encounter is up); cut loose, they are Watch hands
// (guards) who follow whoever freed them and fight any Redwake still about; brought within
// reach of a Watch post, they go in, and their rescuer is paid in standing. A guest may free
// them: the guest's [E] asks the host ('wevq'), who frees them with the guest as rescuer.
import * as THREE from 'three';
import { G } from '../core/globals.js';
import { START_HOOKS } from './hooks.js';
import { CAPTIVE_CAMPS, WATCH_POSTS, LIFE_TIMING } from '../data/factionLife.js';
import { NPC } from '../entities/npc.js';
import { KINDS, LIFE, reward, players, nearestPlayer, spawnSquad, alive } from './worldLife.js';

const now = () => G.time || 0;
const freedAt = new Map(); // camp id -> when its captives were last brought in
const WATCH_LOOK = { skin: '#c8956a', hair: '#3a2a1a', outfit: { main: '#9aa3ad', trim: '#2a4a7a', pants: '#2a3a5a', boots: '#2a2a2e' } };
const spot = (camp, i) => {
  const a = (i / camp.count) * Math.PI - Math.PI / 2;
  return [camp.at[0] + Math.sin(a) * 1.3, camp.at[1] + Math.cos(a) * 1.3, a + Math.PI];
};
const bound = (camp) => LIFE.active.some((e) => e.kind === 'captives' && e.def === camp && e.state === 'bound') || LIFE.guest.has('cap:' + camp.id);

// The kneeling captives, there from the start and shown only while bound; and the stake's [E].
START_HOOKS.push((game) => {
  if (game._captives) return;
  game._captives = true;
  for (const camp of CAPTIVE_CAMPS) {
    for (let i = 0; i < camp.count; i++) {
      const [x, z, yaw] = spot(camp, i);
      game.npcs.push(new NPC({ id: `captive_${camp.id}_${i}`, name: 'Watch hand', title: 'Bound', x, z, yaw, look: WATCH_LOOK, sit: true, when: () => bound(camp) }));
    }
    const y = game.world.groundAt(camp.at[0], camp.at[1], 400);
    game.world.addInteract({
      id: 'stake_' + camp.id, kind: 'life_cart', pos: new THREE.Vector3(camp.at[0], y + 1, camp.at[1]), radius: 3,
      label: 'Cut the captives loose', enabled: () => bound(camp),
      use: () => askFree(game, camp),
    });
  }
});

function askFree(game, camp) {
  if (game.net && game.net.isGuest) return G.net.send({ t: 'wevq', to: game.net.hostId, free: camp.id });
  const ev = LIFE.active.find((e) => e.kind === 'captives' && e.def === camp && e.state === 'bound');
  if (ev) free(game, ev, game.player);
}
(G.netHandlers ||= {}).wevq = (m, net) => {
  if (!net.isHost || !G.game || !m.free) return;
  const ev = LIFE.active.find((e) => e.kind === 'captives' && e.def.id === m.free && e.state === 'bound');
  const who = net.avatars.get(m.from);
  if (ev && who) free(G.game, ev, who);
};

export function free(game, ev, who) {
  const camp = ev.def;
  ev.state = 'freed';
  ev.rescuer = who;
  ev.members = [];
  for (let i = 0; i < camp.count; i++) {
    const [x, z, yaw] = spot(camp, i);
    ev.members.push(...spawnSquad(game, ['watch_guard'], x, z, yaw, { ev }));
  }
  reward(game, who, { toast: 'Cut loose, the Watch hands stagger up: "Get us to a Watch post."', kind: 'quest' });
  G.audio?.play('chest', { pos: new THREE.Vector3(camp.at[0], game.world.groundAt(camp.at[0], camp.at[1], 400), camp.at[1]), vol: 0.4 });
}

KINDS.captives = {
  retry: 20,
  start(game) {
    const T = LIFE_TIMING.captives;
    for (const camp of CAPTIVE_CAMPS) {
      if (now() - (freedAt.get(camp.id) ?? -1e9) < T.day) continue;
      const { d } = nearestPlayer(game, camp.at[0], camp.at[1]);
      // within reach, but not watching the stake when they are tied to it
      if (d > T.near || d < 90) continue;
      return { def: camp, state: 'bound', members: [] };
    }
    return null;
  },
  tick(game, ev, dt) {
    const camp = ev.def;
    const { d } = nearestPlayer(game, camp.at[0], camp.at[1]);
    if (ev.state === 'bound') return d > 400 || now() - ev.t0 > 900;
    const live = alive(ev);
    if (ev.state === 'freed') {
      if (!live.length) {
        reward(game, ev.rescuer, { toast: 'The Watch hands you cut loose are dead.', kind: 'bad' });
        return true;
      }
      const q = players(game).find((o) => o.actor === ev.rescuer);
      if (!q) return nearestD(game, live[0]) > 400;
      const r = ev.rescuer.pos;
      // they keep a few paces behind their rescuer (an idle guard walks to its home)
      if ((ev.followT = (ev.followT || 0) - dt) <= 0) {
        ev.followT = 1;
        const yaw = ev.rescuer.yaw ?? 0;
        live.forEach((e, i) => {
          const side = i % 2 ? 1.4 : -1.4, back = 3 + Math.floor(i / 2) * 1.6;
          const hx = r.x - Math.sin(yaw) * back + Math.cos(yaw) * side, hz = r.z - Math.cos(yaw) * back - Math.sin(yaw) * side;
          e.home.set(hx, game.world.groundAt(hx, hz, r.y + 3), hz);
        });
      }
      // at a Watch post, with them close behind
      const post = WATCH_POSTS.find(([x, z]) => Math.hypot(r.x - x, r.z - z) < 25);
      if (post && live.every((e) => Math.hypot(e.pos.x - post[0], e.pos.z - post[1]) < 32)) {
        ev.state = 'home';
        ev.homeAt = now();
        freedAt.set(camp.id, now());
        const lvl = game.ch.level || 1;
        reward(game, ev.rescuer, { rep: [['watch', 8]], silver: 30 + 6 * lvl, xp: 80 + 20 * lvl, toast: `The Watch takes its own back from ${camp.name}, and thanks you for them.`, stat: 'rescues', save: true });
      }
      return false;
    }
    // home: they go in
    return now() - ev.homeAt > 3;
  },
};
const nearestD = (game, a) => nearestPlayer(game, a.pos.x, a.pos.z).d;
