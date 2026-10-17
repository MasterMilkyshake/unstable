// Vows and Resonances (task 5): each of the nine Vows and five Resonances plays as a build of its
// own. Each test swears the oath (or attunes the resonance) and checks what defines it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { G, THREE, Actor, arena, player, enemy, step, pinRandom, DT } from './support/arena.js';

const { VOWS } = await import('../src/data/vows.js');
const { MANTRAS } = await import('../src/data/mantras.js');
const { applyHit } = await import('../src/combat/combat.js');
const { COMBAT } = await import('../src/combat/rules.js');
const { KILL_HOOKS } = await import('../src/game/hooks.js');
await import('../src/game/vowpowers.js');
await import('../src/game/talentpowers.js');
const { RESONANCES, useResonance } = await import('../src/game/resonance.js');

// The Vowkeeper's oath, as ui/interact.js swears it.
function swear(id, o = {}) {
  arena(o);
  const p = player({ weapon: o.weapon, attrs: o.attrs });
  const ch = p.ch;
  const v = VOWS[id];
  ch.level = 6;
  ch.vow = id;
  for (const t of v.talents) if (!ch.talents.includes(t)) ch.talents.push(t);
  for (const m of v.mantras) {
    ch.mantras[m] = { stars: 0 };
    ch.hotbar[2] = { type: 'mantra', id: m };
  }
  if (v.bonusPicks) ch.talentPicks += v.bonusPicks;
  G.game.world = G.world;
  G.game.getAim = () => ({ dir: new THREE.Vector3(0, 0, 1), point: new THREE.Vector3(0, 0, 10), target: null });
  p.recompute();
  p.hp = p.maxHp;
  p.ether = p.maxEther;
  return p;
}
function bag(z = 2, o = {}) {
  const a = new Actor({ team: 'enemy', hp: 5000, posture: o.posture ?? 5000, level: 5 });
  a.pos.set(o.x || 0, 0, z);
  a.yaw = o.yaw ?? Math.PI;
  a.grounded = true;
  G.actors.push(a);
  return a;
}
const lost = (p, foe, def = {}) => {
  const hp = foe.hp;
  applyHit(p, foe, Object.assign(p.buildHit(Object.assign({ dmgMul: 1 }, def), foe), { from: p.pos.clone() }));
  return hp - foe.hp;
};
// the vow's mantra casts (ether spent, an attack begun)
function castsVowMantra(p) {
  const id = p.ch.hotbar[2].id;
  const e0 = p.ether;
  p.tryCast(2);
  assert.ok(p.atk, `${MANTRAS[id].name} is cast`);
  assert.ok(p.ether < e0 || MANTRAS[id].ether === 0, 'and paid for');
}

const VOW_TESTS = {
  hollow: (t) => {
    pinRandom(t, 0.99);
    const p = swear('hollow');
    assert.equal(p.ch.talentPicks, 2, 'two extra talent picks');
    const plain = player();
    assert.ok(p.derived.etherRegen > plain.derived.etherRegen * 1.14);
    castsVowMantra(p);
  },
  galeblade: (t) => {
    pinRandom(t, 0.99);
    const p = swear('galeblade');
    assert.ok(p.mods.doubleJump && p.mods.airDodge);
    const foe = enemy('brigand', 0, 2);
    foe.yaw = Math.PI;
    // a fist critical lifts (launch 8): for a Galeblade that opens the chase too
    applyHit(p, foe, Object.assign(p.buildHit({ dmgMul: 1, launch: 8 }, foe), { from: p.pos.clone() }));
    assert.ok(foe.launched && p.chaseTarget === foe, 'any lift opens the air chase');
    castsVowMantra(p);
  },
  silence: (t) => {
    pinRandom(t, 0.99);
    const p = swear('silence');
    p.ch.manaUnlocked = true;
    p.ch.mantras.ember_bolt = { stars: 0 };
    p.ch.hotbar[3] = { type: 'mantra', id: 'ember_bolt' };
    const e0 = p.ether;
    p.tryCast(3);
    assert.ok(!p.atk && p.ether === e0, 'attunement mantras are closed');
    const foe = bag();
    const first = lost(p, foe);
    p.onDealtHit(foe, first, { kind: 'melee' });
    p.onDealtHit(foe, first, { kind: 'melee' });
    assert.ok(lost(p, foe) > first * 1.05, 'Mayhem builds');
    castsVowMantra(p);
  },
  seer: () => {
    const p = swear('seer');
    assert.ok(Math.abs(p.derived.parryWindow - (COMBAT.parry.window + 0.06)) < 1e-9);
    G.input.pressed.add('KeyF');
    p.update(DT);
    assert.ok(Math.abs(p.parryCd - COMBAT.parry.missCooldown * 0.5) < 0.05, `a missed parry back in ${p.parryCd.toFixed(2)} s`);
    p.applyStatus('blind', 1, null);
    assert.ok(!p.statuses.blind, 'never blinded');
    p.hp = 50;
    p.onParry(null);
    assert.ok(p.hp > 50, 'a parry heals');
    castsVowMantra(p);
  },
  arc: () => {
    const p = swear('arc');
    p.blocking = true;
    p.yaw = Math.PI;
    const att = bag(-4, { yaw: 0 });
    const r = applyHit(att, p, { dmg: 20, posture: 30, kind: 'proj', projectile: { kill() {}, deflect() {} }, from: att.pos.clone() });
    assert.equal(r, 'blocked');
    assert.equal(p.posture, 0, 'a blocked projectile costs no posture');
    castsVowMantra(p);
  },
  dawn: (t) => {
    pinRandom(t, 0.99);
    const day = swear('dawn');
    const dayHit = lost(day, bag());
    const night = swear('dawn', { night: true });
    const nightHit = lost(night, bag());
    assert.ok(Math.abs(dayHit / nightHit - 1.12) < 0.02, 'stronger while the sun is up');
    castsVowMantra(day);
  },
  abyss: (t) => {
    pinRandom(t, 0.99);
    const p = swear('abyss');
    const surface = lost(p, bag());
    G.game.inRift = true;
    p.recompute();
    assert.ok(lost(p, bag()) > surface * 1.14, 'stronger in the Rift');
    p.ch.sanity = p.maxSanity * 0.5;
    const before = p.mods.physDmg;
    p.recompute();
    assert.ok(p.mods.physDmg > before, 'and as sanity slips');
    castsVowMantra(p);
  },
  contract: (t) => {
    pinRandom(t, 0.99);
    const p = swear('contract');
    G.game.player = p;
    G.game.ch = p.ch;
    for (const f of KILL_HOOKS) f(G.game, bag());
    for (const f of KILL_HOOKS) f(G.game, bag());
    const b = p.buffs.find((x) => x.id === 'bounty');
    assert.ok(b && b.stacks === 2, 'kills stack a bounty');
    castsVowMantra(p);
  },
  blades: () => {
    const p = swear('blades');
    p.startCrit();
    const cls = p.weaponClass();
    assert.ok(Math.abs(p.critCd - cls.crit.cd * 0.75) < 1e-9, 'criticals recharge 25% faster');
    assert.ok(p.derived.critDmg >= 1.2);
    p.cancelAttack();
    castsVowMantra(p);
  },
};

for (const id of Object.keys(VOWS)) {
  test(`Vow ${VOWS[id].name}: ${VOWS[id].perks.join('; ')}`, (t) => {
    assert.ok(VOW_TESTS[id], `a test for ${id}`);
    VOW_TESTS[id](t);
  });
}

// ---------------------------------------------------------------- resonances
function attune(id) {
  arena();
  const p = player();
  p.ch.level = 15;
  p.ch.resonance = { id, cd: 0 };
  G.game.player = p;
  G.game.ch = p.ch;
  G.game.world = G.world;
  G.game.getAim = () => ({ dir: new THREE.Vector3(0, 0, 1), point: new THREE.Vector3(0, 0, 10), target: null });
  p.recompute();
  return p;
}
const RES_TESTS = {
  ardour: () => {
    const p = attune('ardour');
    const foe = bag();
    applyHit(p, foe, Object.assign(p.buildHit({ dmgMul: 1, running: true }, foe), { from: p.pos.clone() }));
    assert.ok(foe.statuses.burn, 'a running attack sets the foe alight');
  },
  tacet: (t) => {
    pinRandom(t, 0.99);
    const p = attune('tacet');
    const watching = bag();
    watching.target = p;
    const elsewhere = bag(2, { x: 0.5 });
    elsewhere.target = bag(9);
    assert.ok(Math.abs(lost(p, elsewhere) / lost(p, watching) - 1.15) < 1e-6);
  },
  rhythm: () => {
    const p = attune('rhythm');
    p.ether = 0;
    p.onParry(null);
    assert.equal(p.ether, 8);
  },
  sanguine: () => {
    const p = attune('sanguine');
    const foe = bag();
    p.hp = 10;
    p.onDealtHit(foe, 100, { kind: 'melee' });
    const plain = p.hp - 10;
    foe.statuses.bleed = { stacks: 1, t: 5 };
    p.hp = 10;
    p.onDealtHit(foe, 100, { kind: 'melee' });
    assert.ok(Math.abs((p.hp - 10) / plain - 3) < 1e-6, 'three times from a bleeding foe');
  },
  updraft: () => {
    const p = attune('updraft');
    const foe = enemy('brigand', 0, 2);
    foe.liftOff(8);
    p.onDealtHit(foe, 5, { kind: 'melee', upper: true, launch: 11 });
    assert.equal(p.chaseWin, COMBAT.launch.chaseWindow * 2);
  },
};
for (const id of Object.keys(RESONANCES)) {
  test(`Resonance ${RESONANCES[id].name}: ${RESONANCES[id].passiveText}`, (t) => {
    assert.ok(RES_TESTS[id], `a test for ${id}`);
    RES_TESTS[id](t);
    // and its voice on [Z]
    const p = G.player;
    p.cancelAttack();
    p.stunT = 0;
    p.hp = p.maxHp;
    useResonance(G.game);
    assert.ok(p.atk && p.ch.resonance.cd > 0, `${RESONANCES[id].name} sings`);
  });
}
