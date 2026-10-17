// Weapons with identity (task 3): each weapon's own reach, swing speed, posture damage, chip
// through a block, armour pierce and weight, shared with enemy weapons; and the one trait of every
// rare or named weapon, each tested by what it does.
import test from 'node:test';
import assert from 'node:assert/strict';
import { G, Actor, arena, player, enemy, pinRandom } from './support/arena.js';

const { WEAPONS, WEAPON_CLASSES, WEAPON_TRAITS, weaponFeel, weightEffects, weaponFeelText } = await import('../src/data/weapons.js');
const { applyHit, meleeTargets } = await import('../src/combat/combat.js');
const { traitSwingMul, traitOnKill } = await import('../src/combat/weaponTraits.js');
const { weaponRows, BAND } = await import('../tools/weapon-balance.mjs');

const AXES = ['reach', 'speed', 'posture', 'chip', 'pen', 'weight'];

// a foe that never fights back, `z` m ahead, facing the player
function bag(z = 2, o = {}) {
  const a = new Actor({ team: 'enemy', hp: 5000, posture: o.posture ?? 5000, level: 5, resist: o.resist });
  a.pos.set(o.x || 0, 0, z);
  a.yaw = o.yaw ?? Math.PI;
  a.grounded = true;
  G.actors.push(a);
  return a;
}
const hitWith = (p, tgt, def = {}) => applyHit(p, tgt, Object.assign(p.buildHit(Object.assign({ dmgMul: 1 }, def), tgt), { from: p.pos.clone() }));
const lost = (tgt, def, p) => {
  const hp0 = tgt.hp;
  hitWith(p, tgt, def);
  return hp0 - tgt.hp;
};
const armed = (weapon, o = {}) => {
  arena(o);
  return player({ weapon, attrs: { strength: 0 } });
};

// ---------------------------------------------------------------- the axes
test('no two weapons of a class handle alike on every axis; every value is in range', () => {
  const byClass = {};
  for (const [id, w] of Object.entries(WEAPONS)) (byClass[w.cls] ||= []).push([id, weaponFeel(w)]);
  for (const [cls, list] of Object.entries(byClass)) {
    for (let i = 0; i < list.length; i++) {
      const [id, f] = list[i];
      assert.ok(f.reach >= -0.3 && f.reach <= 0.6, `${id} reach ${f.reach}`);
      assert.ok(f.speed >= 0.85 && f.speed <= 1.12, `${id} speed ${f.speed}`);
      assert.ok(f.chip >= 0 && f.chip <= 0.3, `${id} chip ${f.chip}`);
      assert.ok(f.pen >= 0 && f.pen <= 0.35, `${id} pierce ${f.pen}`);
      assert.ok(f.weight > 0 && f.weight <= 12, `${id} weight ${f.weight}`);
      for (let j = i + 1; j < list.length; j++) {
        const [id2, g] = list[j];
        assert.ok(AXES.some((k) => f[k] !== g[k]), `${cls}: ${id} and ${id2} handle the same`);
      }
    }
  }
});

test('every rare or better weapon has one trait, commons and uncommons none; every trait is used and described', () => {
  const used = new Set();
  for (const [id, w] of Object.entries(WEAPONS)) {
    const special = ['rare', 'epic', 'legendary'].includes(w.rarity) && !w.hidden;
    if (special) assert.ok(WEAPON_TRAITS[w.trait], `${id} (${w.rarity}) has a trait`);
    else assert.equal(w.trait, undefined, `${id} (${w.rarity}) has none`);
    if (w.trait) {
      assert.ok(!used.has(w.trait), `${w.trait} on one weapon only`);
      used.add(w.trait);
    }
  }
  for (const [id, t] of Object.entries(WEAPON_TRAITS)) {
    assert.ok(used.has(id), `${id} is on a weapon`);
    assert.ok(t.name && t.desc.length > 10, `${id} is described`);
  }
  assert.match(weaponFeelText(WEAPONS.kestrel_blade), /speed 108%.*Kestrel's Feint/);
});

test('reach: a longsword reaches a foe a bronze sword does not', () => {
  const cls = WEAPON_CLASSES.sword;
  const reaches = (weapon) => {
    const p = armed(weapon);
    const foe = bag(cls.range + 0.42 + 0.1); // just past the class's reach
    p.startCombo();
    return meleeTargets(p, p.atk.def.range, p.atk.def.arc).includes(foe);
  };
  assert.equal(reaches('steel_longsword'), true, 'reach +0.2 m');
  assert.equal(reaches('bronze_sword'), false, 'reach -0.1 m');
});

test('swing speed: a cutlass winds up faster than a bronze sword; a heavier class is slower still', () => {
  const p = armed('cutlass');
  p.startCombo();
  const a = p.atk.def.windup;
  const q = armed('bronze_sword');
  q.startCombo();
  assert.ok(a < q.atk.def.windup, `${a.toFixed(3)} < ${q.atk.def.windup.toFixed(3)}`);
  assert.ok(Math.abs(q.atk.def.windup / a - WEAPONS.cutlass.speed) < 1e-9);
});

test('chip: a blocked greataxe still bites; a rapier does nothing through a guard', (t) => {
  pinRandom(t, 0.99);
  const p = armed('woodcutter_axe');
  const foe = bag(2);
  foe.blocking = true;
  const lostAxe = lost(foe, {}, p);
  assert.ok(lostAxe > 0, `the axe chips ${lostAxe.toFixed(2)}`);
  const q = armed('duelist_rapier');
  const foe2 = bag(2);
  foe2.blocking = true;
  assert.equal(lost(foe2, {}, q), 0);
});

test('pierce: against armour, a high-pierce weapon loses less of its damage', (t) => {
  pinRandom(t, 0.99);
  const ratio = (weapon) => {
    const p = armed(weapon);
    const bare = lost(bag(2), {}, p);
    const plated = lost(bag(2, { resist: { phys: 0.4 } }), {}, p);
    return plated / bare;
  };
  const club = ratio('oak_club'); // pierce 0
  const maul = ratio('bonebreaker'); // pierce 0.25
  assert.ok(Math.abs(club - 0.6) < 0.01, `no pierce: armour takes 40% (${club.toFixed(3)})`);
  assert.ok(Math.abs(maul - (1 - 0.4 * 0.75)) < 0.01, `pierce 25% of the armour (${maul.toFixed(3)})`);
});

test('weight: a maul slows the walk and the roll, a dagger quickens them', () => {
  const light = armed('riftglass_dirk');
  const heavy = armed('magma_maul');
  assert.ok(light.speedBase > heavy.speedBase * 1.05, `${light.speedBase.toFixed(2)} vs ${heavy.speedBase.toFixed(2)} m/s`);
  assert.ok(heavy.derived.dodgeCd > light.derived.dodgeCd + 0.1);
  const fx = weightEffects(12);
  assert.ok(fx.roll < 1 && fx.move < 1 && fx.rollCd > 0);
  assert.deepEqual(weightEffects(2).roll, 1);
});

test('enemy weapons share the handling: reach and speed in their swings, chip and pierce in their blows', () => {
  arena();
  player();
  const e = enemy('peacekeeper', 0, 3); // a cutlass
  const d = e.humanoidM1(0);
  assert.ok(Math.abs(d.range - (WEAPON_CLASSES.sword.range + WEAPONS.cutlass.reach)) < 1e-9);
  const h = e.buildHit(d, G.player);
  assert.equal(h.chip, WEAPONS.cutlass.chip);
  assert.equal(h.pen, WEAPONS.cutlass.pen);
  const k = enemy('enclave_captain', 2, 3); // an iron greatsword
  assert.ok(k.humanoidM1(0).windup > d.windup);
});

// ---------------------------------------------------------------- balance
test('balance: every weapon\'s M1 damage per second is within 20% of its rarity\'s mean (bare fists aside)', () => {
  const out = weaponRows().filter((x) => x.id !== 'fists' && Math.abs(x.vsTier) > BAND);
  assert.deepEqual(out.map((x) => `${x.id} ${(x.vsTier * 100).toFixed(0)}% of the ${x.rarity} mean`), []);
});

test('balance: trimming a weapon leaves the foes who wield it hitting as hard as before', () => {
  arena();
  player();
  // the Brigand Brute's Woodcutter's Greataxe went from 22 to 19 damage (dmgMul 0.8 to 0.93)
  const e = enemy('brigand_brute', 0, 3);
  const h = e.buildHit(e.humanoidM1(0), G.player);
  assert.ok(Math.abs(h.dmg / (22 * 0.8 * e.levelMul) - 1) < 0.01, `${h.dmg.toFixed(2)} a blow`);
});

// ---------------------------------------------------------------- the traits, one by one
const TRAIT_TESTS = {
  undertow: (t) => {
    pinRandom(t, 0.99);
    const p = armed('wavecutter_kris');
    const foe = bag();
    foe.applyStatus('bleed', 1, p);
    hitWith(p, foe);
    assert.equal(foe.statuses.bleed.stacks, 2, 'one more stack on a bleeding foe');
  },
  ebb: () => {
    const p = armed('driftsteel_katana');
    p.dodgeStartT = G.time - 0.5;
    p.startCombo();
    const fast = p.atk.def.windup;
    p.cancelAttack();
    p.combo = 0;
    p.dodgeStartT = G.time - 3;
    p.startCombo();
    assert.ok(Math.abs(p.atk.def.windup / fast - 1.2) < 1e-9, 'a fifth faster out of a roll');
  },
  shatterhead: (t) => {
    pinRandom(t, 0.99);
    const p = armed('bonebreaker');
    const foe = bag(2, { posture: 10 });
    foe.blocking = true;
    assert.equal(hitWith(p, foe), 'guardbreak');
    assert.ok(Math.abs(foe.stunT - 2.2) < 1e-9, `broken for 2.2 s (${foe.stunT})`);
  },
  sentry: () => {
    const p = armed('hightoll_glaive');
    const cls = WEAPON_CLASSES.spear;
    for (let i = 0; i < cls.combo.length; i++) {
      p.startCombo();
      if (i < cls.combo.length - 1) assert.equal(p.atk.def.arc, cls.arc);
      else {
        assert.equal(p.atk.def.arc, cls.arc + 40);
        assert.ok(Math.abs(p.atk.def.range - (cls.range + WEAPONS.hightoll_glaive.reach + 0.5)) < 1e-9);
      }
      p.cancelAttack();
    }
  },
  kindling: (t) => {
    pinRandom(t, 0.99);
    const p = armed('ember_gauntlets');
    const foe = bag();
    for (let i = 0; i < 3; i++) hitWith(p, foe);
    assert.ok(!foe.statuses.burn);
    hitWith(p, foe);
    assert.ok(foe.statuses.burn, 'the fourth hit in a row burns');
  },
  moonlit: (t) => {
    pinRandom(t, 0.99);
    const day = lost(bag(), {}, armed('moonveil_katana'));
    const night = lost(bag(), {}, armed('moonveil_katana', { night: true }));
    assert.ok(Math.abs(night / day - 1.12) < 1e-6);
  },
  static: (t) => {
    pinRandom(t, 0.99);
    const p = armed('stormneedle');
    const plain = lost(bag(), {}, p);
    const foe = bag();
    foe.statuses.shock = { t: 5 };
    assert.ok(Math.abs(lost(foe, {}, p) / plain - 1.25) < 1e-6);
  },
  breakwater: () => {
    const block = (weapon) => {
      const p = armed(weapon);
      p.blocking = true;
      const att = bag(-2);
      att.yaw = 0;
      p.yaw = Math.PI;
      applyHit(att, p, { dmg: 10, posture: 20, kind: 'melee', from: att.pos.clone() });
      return p.posture;
    };
    assert.ok(Math.abs(block('tidebreaker') / block('iron_greatsword') - 0.7) < 1e-6);
  },
  rime_bite: (t) => {
    pinRandom(t, 0.99);
    const p = armed('glacier_cleaver');
    const plain = lost(bag(), {}, p);
    const foe = bag();
    foe.statuses.chill = { stacks: 30, t: 5 };
    assert.ok(Math.abs(lost(foe, {}, p) / plain - 1.15) < 1e-6);
  },
  kestrel: () => {
    const p = armed('kestrel_blade');
    p.startCombo();
    G.input.mPressed[2] = true;
    p.update(1 / 30);
    assert.ok(p.atk === null && Math.abs(p.feintCd - 0.7) < 0.05, `feint ready again in ${p.feintCd.toFixed(2)} s`);
  },
  thin_air: (t) => {
    pinRandom(t, 0.99);
    const p = armed('riftglass_dirk');
    const front = lost(bag(2), {}, p);
    const back = lost(bag(2, { yaw: 0 }), {}, p);
    assert.ok(Math.abs(back / front - 1.4) < 1e-6);
  },
  oathbound: () => {
    const p = armed('drowned_greatsword');
    p.startCombo();
    assert.ok(!p.atk.def.hyperarmor);
    p.cancelAttack();
    p.hp = p.maxHp * 0.3;
    p.startCombo();
    assert.ok(p.atk.def.hyperarmor, 'below 40% health');
  },
  molten: (t) => {
    pinRandom(t, 0.99);
    const p = armed('magma_maul');
    const plain = lost(bag(), {}, p);
    const foe = bag();
    foe.statuses.burn = { t: 5, dps: 0 };
    assert.ok(Math.abs(lost(foe, {}, p) - plain - 6) < 1e-6, 'a 6 fire burst on top');
  },
  rootgrip: (t) => {
    pinRandom(t, 0.99);
    const p = armed('mossbound_spear');
    const foe = bag();
    hitWith(p, foe, { running: true });
    assert.ok(foe.stunT >= 0.7);
    const foe2 = bag();
    hitWith(p, foe2);
    assert.ok(foe2.stunT < 0.7, 'only running attacks');
  },
  gnaw: (t) => {
    pinRandom(t, 0.99);
    const p = armed('thresher_fang');
    const foe = bag();
    const hits = [];
    for (let i = 0; i < 8; i++) {
      const hp0 = foe.hp;
      hitWith(p, foe); // applyHit tells the wielder (onDealtHit), which keeps the stacks
      hits.push(hp0 - foe.hp);
    }
    assert.ok(Math.abs(hits[1] / hits[0] - 1.05) < 1e-6);
    assert.ok(Math.abs(hits[7] / hits[0] - 1.25) < 1e-6, 'up to 25%');
    const other = bag(2, { x: 1 });
    const hp0 = other.hp;
    hitWith(p, other);
    assert.ok(Math.abs((hp0 - other.hp) / hits[0] - 1.25) < 1e-6, 'the stacks were on the old foe');
    const hp1 = other.hp;
    hitWith(p, other);
    assert.ok(Math.abs((hp1 - other.hp) / hits[0] - 1.05) < 1e-6, 'and start again on the new one');
  },
  old_king: (t) => {
    pinRandom(t, 0.99);
    const p = armed('primal_knuckles');
    const foe = bag(2, { posture: 10 });
    foe.blocking = true;
    assert.equal(hitWith(p, foe), 'guardbreak');
    assert.ok(foe.stunT >= 2.3 - 1e-9 && foe.push.length() > 3, 'knocked off its feet');
  },
  toll_of_souls: () => {
    const p = armed('lanternless_scythe');
    p.ether = 0;
    p.ch.sanity = 50;
    traitOnKill(p);
    assert.equal(p.ether, 10);
    assert.equal(p.ch.sanity, 56);
  },
  crowd: (t) => {
    pinRandom(t, 0.99);
    const p = armed('champions_gladius');
    const foe = bag();
    const first = lost(foe, {}, p);
    const second = lost(foe, {}, p);
    assert.ok(Math.abs(second / first - 1.03) < 1e-6);
    p.onDamaged(foe, 5);
    assert.ok(Math.abs(lost(foe, {}, p) / first - 1) < 1e-6, 'struck: the favour is gone');
  },
  bramble: () => {
    const p = armed('witchthorn_rapier');
    const att = bag(2);
    p.yaw = 0;
    p.parryT = 0.2;
    att.atk = { phase: 'active', def: {} };
    assert.equal(applyHit(att, p, { dmg: 10, posture: 10, kind: 'melee', from: att.pos.clone() }), 'parried');
    assert.ok(att.statuses.bleed && att.statuses.bleed.stacks >= 2);
  },
  grave_toll: () => {
    const p = armed('gravewarden_scythe');
    p.ether = 0;
    p.hp = 10;
    traitOnKill(p);
    assert.equal(p.ether, 8);
    assert.ok(p.hp > 10);
  },
  discipline: () => {
    const parried = (weapon) => {
      const p = armed(weapon);
      const att = bag(2);
      p.yaw = 0;
      p.parryT = 0.2;
      att.atk = { phase: 'active', def: {} };
      applyHit(att, p, { dmg: 10, posture: 20, kind: 'melee', from: att.pos.clone() });
      return att.posture;
    };
    assert.ok(Math.abs(parried('warden_mace') / parried('spiked_mace') - 1.5) < 1e-6);
  },
  charge: (t) => {
    pinRandom(t, 0.99);
    const p = armed('meridian_lance');
    assert.equal(traitSwingMul(p, { running: true }), 1.3);
    assert.equal(traitSwingMul(p, {}), 1);
    assert.ok(Math.abs(lost(bag(), { running: true }, p) / lost(bag(), {}, p) - 1.3) < 1e-6);
  },
  last_toll: (t) => {
    pinRandom(t, 0.99);
    const p = armed('toll_hammer');
    const behind = bag(-1.8, { yaw: 0 });
    const cls = WEAPON_CLASSES.hammer;
    for (let i = 0; i < cls.combo.length - 1; i++) {
      p.startCombo();
      p.cancelAttack();
    }
    p.startCombo();
    for (let s = 0; s < 30 && p.atk; s++) p.baseUpdate(1 / 30);
    assert.ok(behind.hp < 5000, 'the shockwave reached the foe behind');
  },
  notch: () => {
    const p = armed('kaelens_ruin');
    const v = p.speedBase;
    traitOnKill(p);
    assert.ok(p.speedBase > v * 1.1, 'quickened');
    assert.ok(p.buffs.some((b) => b.id === 'notch' && b.t === 3));
  },
  heart_ice: (t) => {
    pinRandom(t, 0.99);
    const p = armed('frostfang');
    const foe = bag();
    foe.statuses.chill = { stacks: 30, t: 5 };
    hitWith(p, foe, { crit: true });
    assert.ok(foe.statuses.freeze, 'frozen');
    const foe2 = bag();
    hitWith(p, foe2, { crit: true });
    assert.ok(!foe2.statuses.freeze, 'only a chilled foe');
  },
  core_fire: (t) => {
    pinRandom(t, 0.99);
    const p = armed('cinderbrand');
    const foe = bag(2);
    const near = bag(3, { x: 1.5 });
    const far = bag(9);
    hitWith(p, foe, { crit: true });
    assert.ok(near.hp < 5000 && near.statuses.burn, 'the burst burns the foe beside');
    assert.equal(far.hp, 5000);
  },
  lightning_rod: (t) => {
    pinRandom(t, 0.99);
    const p = armed('stormpiercer');
    const foe = bag(2);
    const a = bag(4);
    const b = bag(3, { x: 3 });
    const c = bag(2, { x: -5 });
    const far = bag(12);
    hitWith(p, foe, { crit: true });
    const struck = [a, b, c].filter((x) => x.hp < 5000).length;
    assert.equal(struck, 2, 'two foes nearby');
    assert.equal(far.hp, 5000);
  },
  hollow_gaze: () => {
    const p = armed('hollow_crown');
    const foe = bag();
    hitWith(p, foe, { crit: true });
    assert.ok(foe.statuses.blind);
  },
};

for (const id of Object.keys(WEAPON_TRAITS)) {
  test(`trait ${id} (${WEAPON_TRAITS[id].name}): ${WEAPON_TRAITS[id].desc}`, (t) => {
    assert.ok(TRAIT_TESTS[id], `a test for ${id}`);
    TRAIT_TESTS[id](t);
  });
}

test('traits marked for the player alone do nothing in an enemy\'s hands; the rest do', (t) => {
  pinRandom(t, 0.99);
  arena();
  const p = player();
  p.yaw = Math.PI;
  const duke = enemy('hollow_duke', 0, 2); // Hollowed Gaze: foes too
  duke.yaw = 0;
  applyHit(duke, p, Object.assign(duke.buildHit(Object.assign(duke.humanoidCrit(), { crit: true }), p), { from: duke.pos.clone() }));
  assert.ok(p.statuses.blind, 'the Hollow Duke\'s critical blinds');
  const warden = enemy('frost_warden', 0, -2); // Heart-Ice: the player's alone
  warden.yaw = Math.PI;
  p.iframes = 0;
  p.statuses.chill = { stacks: 50, t: 5 };
  applyHit(warden, p, Object.assign(warden.buildHit(Object.assign(warden.humanoidCrit(), { crit: true }), p), { from: warden.pos.clone() }));
  assert.ok(!p.statuses.freeze, 'the Frost Warden does not freeze you outright');
});
