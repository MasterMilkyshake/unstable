// LAN and the systems round: what a guest's character brings to the host. The host resolves a
// guest's blows and runs the enemies that face the guest's avatar, so every talent, resonance or
// gear flag it reads there has to travel in the guest's info (Net.myInfo, GUEST_MODS).
// tools/lan-check.mjs drives the moves themselves between two real browsers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { G, Actor, arena, player, enemy, pinRandom } from './support/arena.js';

const { Net, GUEST_MODS } = await import('../src/net/net.js');

const src = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');
const keys = (text, re) => [...text.matchAll(re)].map((m) => m[1]);

test('every flag the host reads from a guest attacker or avatar is sent in the guest\'s info', () => {
  const read = new Set([
    // hit resolution: the attacker's mods (combat.js names them `am` too), backstabs
    ...keys(src('combat/combat.js'), /\batt\.mods\.(\w+)/g),
    ...keys(src('combat/combat.js'), /\bam\.(\w+)/g),
    ...keys(src('combat/rules.js'), /\batt\.mods\.(\w+)/g),
    // ailments a blow lays on: the source's power over them
    ...keys(src('entities/actor.js'), /\bsrcMods\.(\w+)/g),
    // enemy AI towards its target, and a burn's source
    ...keys(src('entities/enemy.js'), /\b(?:src|t|p)\.mods\.(\w+)/g),
    ...keys(src('entities/enemy.js'), /\b(?:src|t|p)\.mods && \w+\.mods\.(\w+)/g),
  ]);
  assert.ok(read.size >= 15, `found ${read.size} flags; the patterns above no longer match the code`);
  const missing = [...read].filter((k) => !GUEST_MODS.includes(k));
  assert.deepEqual(missing, [], `the host reads ${missing.join(', ')} from a guest but the guest never sends it`);
});

test('a guest holding Intimidate makes the host\'s foes of lower Power wait longer, as alone', (t) => {
  pinRandom(t, 0.5);
  arena();
  const p = player();
  p.ch.talents = ['intimidate'];
  p.ch.level = 10;
  p.recompute();
  const info = Net.prototype.myInfo.call({ game: { player: p } });
  assert.equal(info.mods.intimidate, true);
  // the host's view of that guest: the avatar carries the info's level and mods (RemotePlayer.applyInfo)
  const avatar = new Actor({ team: 'player', name: info.name });
  avatar.level = info.level;
  avatar.mods = info.mods;
  const wait = (tgt) => {
    const e = enemy('brigand', 0, 3);
    e.target = tgt;
    e.onAttackDone({});
    const cd = e.ai.atkCd;
    e.despawn = true;
    G.actors.splice(G.actors.indexOf(e), 1);
    return cd;
  };
  const plain = new Actor({ team: 'player' });
  plain.level = info.level;
  assert.ok(Math.abs(wait(avatar) / wait(plain) - 1.3) < 1e-9);
});
