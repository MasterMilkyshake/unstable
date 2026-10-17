// The keepsake chest at the Wash camp: where a lost character's heirloom waits for the next new
// character, who may claim it once (core/legacy.js). Built at boot so the warm-up compiles it.
import * as THREE from 'three';
import { BOOT_HOOKS, START_HOOKS } from './hooks.js';
import { Legacy } from '../core/legacy.js';
import { KEEPSAKE_CHEST } from '../data/legacy.js';
import { WEAPONS, ENCHANTS } from '../data/weapons.js';
import { TRINKETS } from '../data/trinkets.js';
import { mat } from '../world/props.js';
import { openLoot, grant } from './loot.js';
import { emptyContents, newUid } from '../core/contents.js';

let chest = null;

function build(game) {
  const world = game.world;
  const { x, z } = KEEPSAKE_CHEST;
  const y = world.groundAt(x, z, 60);
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = Math.atan2(-x, -z) + 0.6;
  g.userData.dynamic = true; // its lid moves
  const wood = mat('#4e3a2a');
  const band = mat('#9aa4a8', { metalness: 0.6, roughness: 0.4 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.6), wood);
  base.position.y = 0.25;
  base.castShadow = true;
  g.add(base);
  const lid = new THREE.Group();
  lid.position.set(0, 0.5, -0.3);
  g.add(lid);
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.2, 0.62), wood);
  top.position.set(0, 0.1, 0.3);
  top.castShadow = true;
  lid.add(top);
  for (const bx of [-0.32, 0.32]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.52, 0.64), band);
    b.position.set(bx, 0.26, 0);
    g.add(b);
  }
  // a knot of pale cord tied round the lid: the register's mark for a name struck out
  const cord = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.025, 6, 14), mat('#d8d0bc'));
  cord.position.set(0, 0.21, 0.62);
  lid.add(cord);
  world.scene.add(g);
  world.colliders.addBox({ x, z, w: 0.9, d: 0.7, y0: y - 1, y1: y + 0.5, rot: g.rotation.y });
  chest = { group: g, lid, open: 0, target: 0 };
  world.animated.push((t, dt) => {
    if (chest.open === chest.target) return;
    const step = (dt || 0.016) * 2.5;
    chest.open = chest.target > chest.open ? Math.min(chest.target, chest.open + step) : Math.max(chest.target, chest.open - step);
    chest.lid.rotation.x = -1.7 * chest.open;
  });
  world.addInteract({
    id: 'keepsake_chest', kind: 'keepsake', pos: new THREE.Vector3(x, y + 0.5, z), radius: 2.4,
    label: 'Keepsake Chest', use: (gm) => open(gm),
  });
}

function heirloomName(h) {
  const d = h.kind === 'weapon' ? WEAPONS[h.id] : TRINKETS[h.id];
  return d ? h.name || d.name : null;
}

function open(game) {
  const ch = game.ch;
  if (!ch) return;
  const st = Legacy.claimState(ch);
  if (st.state === 'empty') {
    game.ui.toast(ch.flags.heirloom ? 'The chest is empty. You already took what was left for you.' : 'The chest is empty. What the lost leave behind waits here for the next to wash ashore.');
    return;
  }
  if (st.state === 'older') {
    game.ui.toast(`${st.heirloom.from || 'Someone'} left this for whoever washes ashore next, not for you.`);
    return;
  }
  const h = st.heirloom;
  if (!heirloomName(h)) {
    Legacy.claim(ch);
    game.ui.toast('Whatever was left here has rotted to nothing.', 'bad');
    return;
  }
  // what waits is shown like any chest's contents, and taken once
  const thing = h.kind === 'weapon'
    ? { uid: newUid('w'), id: h.id, enchant: ENCHANTS[h.enchant] ? h.enchant : null, ...(h.temper ? { temper: h.temper } : {}) }
    : { uid: newUid('t'), id: h.id, ...(h.pips && h.pips.length ? { pips: h.pips.map((p) => ({ ...p })) } : {}) };
  const box = emptyContents();
  (h.kind === 'weapon' ? box.weapons : box.trinkets).push(thing);
  openLoot(game, {
    id: 'keepsake',
    title: 'KEEPSAKE CHEST',
    note: `Left by ${h.from || 'one who came before'}, for whoever washed ashore next.`,
    contents: () => box,
    take: () => {
      if (!box.weapons.length && !box.trinkets.length) return false;
      if (!Legacy.claim(ch)) {
        game.ui.toast('Someone has taken it already.', 'bad');
        box.weapons.length = box.trinkets.length = 0;
        return false;
      }
      const got = { ...emptyContents(), weapons: box.weapons.splice(0), trinkets: box.trinkets.splice(0) };
      grant(game, got);
      ch.flags.heirloom = h.id;
      chest.target = 1;
      game.audio.play('chest', { pos: chest.group.position });
      game.ui.banner('AN HEIRLOOM', `${h.name}, left by ${h.from || 'one who came before'}.`, 3.5);
      game.save();
      return true;
    },
  });
}

BOOT_HOOKS.push(build);
START_HOOKS.push((game, ch) => {
  if (!chest) return;
  // closed while something waits for this character, open once there is nothing for it
  chest.target = chest.open = Legacy.claimState(ch).state === 'ready' ? 0 : 1;
  chest.lid.rotation.x = -1.7 * chest.open;
});
