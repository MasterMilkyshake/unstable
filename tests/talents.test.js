// Talents that change play (task 4): every talent reworked from a number bump into a behaviour
// does what its card says, and exclusions keep breaking combinations apart.
import test from 'node:test';
import assert from 'node:assert/strict';
import { G, THREE, Actor, arena, player, enemy, step, pinRandom, DT } from './support/arena.js';

const { TALENTS, talentExcluded } = await import('../src/data/talents.js');
const { applyHit } = await import('../src/combat/combat.js');
const { COMBAT } = await import('../src/combat/rules.js');
const { ACTIONS } = await import('../src/game/hooks.js');
const { senseTreasure, resetTreasureSense } = await import('../src/game/talentpowers.js');

// The 45 talents reworked into behaviours this round.
const REWORKED = [
  'seafarer', 'thick_skin', 'sharp_reflexes', 'deep_breath', 'treasure_sense', 'hearty_appetite',
  'bull_rush', 'bone_crusher', 'titan_grip', 'crushing_blows', 'heavy_hands',
  'bulwark', 'iron_posture', 'stonewall', 'iron_lungs', 'juggernaut',
  'cats_grace', 'quickstep', 'wall_runner', 'evasive', 'blitz',
  'efficient_casting', 'overflow', 'focused_mind', 'arcane_mastery',
  'resolve', 'clear_head', 'intimidate', 'rallying_spirit', 'presence',
  'flurry_master', 'lightning_reflexes', 'balanced_stance', 'blade_dancer', 'heavy_momentum',
  'firewalker', 'conflagration', 'winter_coat', 'glacial_core', 'static_charge', 'conductor',
  'tailwind', 'windrunner', 'shroud', 'dusk_shroud',
];

// A character holding `ids`, with `o.weapon` if given, at the origin facing +z.
function holding(ids, o = {}) {
  const ctx = arena(o);
  const p = player({ weapon: o.weapon, attrs: o.attrs });
  p.ch.talents = [...ids];
  p.recompute();
  p.hp = p.maxHp;
  return Object.assign(ctx, { p });
}
function bag(z = 2, o = {}) {
  const a = new Actor({ team: o.team || 'enemy', hp: 5000, posture: o.posture ?? 5000, level: o.level || 5 });
  a.pos.set(o.x || 0, 0, z);
  a.yaw = o.yaw ?? Math.PI;
  a.grounded = true;
  G.actors.push(a);
  return a;
}
const swingAt = (att, tgt, extra = {}) => applyHit(att, tgt, Object.assign({ dmg: 20, posture: 20, kind: 'melee', element: 'phys', from: att.pos.clone() }, extra));
// the same scenario with and without the talent, through `measure(p)`
function compare(id, measure, o = {}) {
  const without = measure(holding([], o).p);
  const withIt = measure(holding([id], o).p);
  return [withIt, without];
}

const TESTS = {
  seafarer: () => {
    const [a, b] = compare('seafarer', (p) => {
      p.swimming = true;
      p.grounded = false;
      G.input.pressed.add('Space');
      p.update(DT);
      return p.vel.y;
    });
    assert.ok(a > b + 2, `out of the water at ${a.toFixed(1)} m/s against ${b.toFixed(1)}`);
  },
  thick_skin: () => {
    const [a, b] = compare('thick_skin', (p) => {
      p.applyStatus('burn', 1, null);
      const t0 = p.statuses.burn.t;
      p.updateStatuses(0.5);
      return t0 - p.statuses.burn.t;
    });
    assert.ok(Math.abs(a / b - 2) < 1e-9, 'burns wear off twice as fast');
  },
  sharp_reflexes: () => {
    const [a, b] = compare('sharp_reflexes', (p) => {
      G.input.pressed.add('KeyF');
      p.update(DT);
      return p.parryCd;
    });
    assert.ok(Math.abs(b - a - 0.3) < 0.05, `the missed parry is ready ${(b - a).toFixed(2)} s sooner`);
  },
  deep_breath: () => {
    const [a, b] = compare('deep_breath', (p) => {
      p.sitting = true;
      p.ch.sanity = 10;
      p.ether = 0;
      p.survival(1);
      p.update(1 / 30);
      return [p.ch.sanity, p.ether];
    });
    assert.ok((a[0] - 10) / (b[0] - 10) > 2.9, 'sanity three times as fast');
    assert.ok(a[1] / b[1] > 2.9, 'and ether');
  },
  treasure_sense: () => {
    const sense = (ids) => {
      const { p } = holding(ids);
      resetTreasureSense();
      let chimes = 0;
      G.ui = { toast: () => chimes++ };
      G.game.world = G.world;
      G.world.chests = [
        { def: { id: 'near' }, opened: false, mesh: { position: new THREE.Vector3(10, 0, 10) } },
        { def: { id: 'far' }, opened: false, mesh: { position: new THREE.Vector3(60, 0, 0) } },
        { def: { id: 'open' }, opened: true, mesh: { position: new THREE.Vector3(3, 0, 0) } },
      ];
      senseTreasure(G.game, 1);
      senseTreasure(G.game, 1);
      return chimes;
    };
    assert.equal(sense(['treasure_sense']), 1, 'one chime, for the near closed chest, once');
    assert.equal(sense([]), 0);
  },
  hearty_appetite: () => {
    const [a, b] = compare('hearty_appetite', (p) => {
      p.ch.inventory.items.stew = 1;
      p.hp = 10;
      G.input.down.add('KeyW');
      p.useItem('stew');
      const hp = p.hp;
      step(0.5);
      return [p.speed, hp];
    });
    assert.ok(Math.abs(a[0] / b[0] - 0.75 / 0.4) < 0.1, `eats at a walk (${a[0].toFixed(1)} against ${b[0].toFixed(1)} m/s)`);
    assert.ok(a[1] - 10 > (b[1] - 10) * 1.09, 'and the food heals more');
  },
  bull_rush: () => {
    const [a, b] = compare('bull_rush', (p) => {
      const foe = bag();
      foe.blocking = true;
      swingAt(p, foe, { running: true });
      return [foe.posture, foe.push.length()];
    });
    assert.ok(Math.abs(a[0] / b[0] - 1.5) < 1e-9, '50% more posture');
    assert.ok(a[1] > b[1] + 3, 'and a shove');
  },
  bone_crusher: () => {
    const [a, b] = compare('bone_crusher', (p) => {
      const foe = bag(2, { posture: 10 });
      foe.blocking = true;
      swingAt(p, foe);
      return foe.stunT;
    });
    assert.ok(Math.abs(a - b - 0.4) < 1e-9);
  },
  titan_grip: () => {
    const [a, b] = compare('titan_grip', (p) => [p.weightFx.roll, p.derived.dodgeCd], { weapon: 'magma_maul' });
    assert.equal(a[0], 1, 'the maul does not shorten the roll');
    assert.ok(b[0] < 1 && a[1] < b[1]);
  },
  crushing_blows: () => {
    const [a, b] = compare('crushing_blows', (p) => {
      const foe = bag(2, { posture: 100 });
      foe.blocking = true;
      foe.posture = 60;
      return swingAt(p, foe, { crit: true, posture: 5 });
    });
    assert.equal(a, 'guardbreak');
    assert.equal(b, 'blocked');
  },
  heavy_hands: () => {
    const [a, b] = compare('heavy_hands', (p) => {
      p.slideT = 0.5;
      p.startCombo();
      return p.atk.def.launch;
    });
    assert.ok(Math.abs((a * a) / (b * b) - 1.25) < 1e-9, 'a quarter higher');
    // the slam's landing staggers foes beside the chaser
    const { p } = holding(['heavy_hands']);
    const near = bag(1.5, { x: 1 });
    p.pos.y = 2;
    p.grounded = false;
    p.chase = { target: near, t: 0.5, rise: 0.1, hits: 2 };
    p.startCombo();
    assert.ok(p.atk.def.chaseSlam);
    for (let i = 0; i < 30 && p.atk; i++) {
      p.baseUpdate(DT);
      p.physics(DT);
    }
    assert.ok(near.posture > 0 && near.stunT > 0, 'staggered where you landed');
  },
  bulwark: () => {
    const [a, b] = compare('bulwark', (p) => {
      p.blocking = true;
      p.yaw = Math.PI;
      const att = bag(-2, { yaw: 0 });
      const hp = p.hp;
      swingAt(att, p, { chip: 0.2, element: 'ember' });
      return hp - p.hp;
    });
    assert.equal(a, 0, 'no chip through the guard');
    assert.ok(b > 0);
  },
  iron_posture: () => {
    const [a, b] = compare('iron_posture', (p) => {
      p.blocking = true;
      p.posture = 40;
      p.postureIdle = 2;
      p.baseUpdate(0.5);
      return p.posture;
    });
    assert.ok(a < 40 && b === 40, 'recovers behind a block');
  },
  stonewall: () => {
    const [a, b] = compare('stonewall', (p) => {
      p.blocking = true;
      p.yaw = 0;
      const att = bag(0, { x: 2 }); // 90 degrees to the side
      const r = swingAt(att, p, { knockback: 8, launch: 6 });
      return [r, p.push.length(), p.vel.y];
    });
    assert.equal(a[0], 'blocked', 'a 180-degree guard');
    assert.equal(b[0], 'hit');
    assert.ok(a[1] === 0 && a[2] === 0, 'not moved');
  },
  iron_lungs: () => {
    const [a, b] = compare('iron_lungs', (p) => {
      p.sprinting = true;
      p.ch.hunger = 50;
      p.survival(10);
      return 50 - p.ch.hunger;
    });
    assert.ok(Math.abs(b / a - 1.6) < 1e-6, 'sprinting no longer hungry work');
  },
  juggernaut: () => {
    const [a, b] = compare('juggernaut', (p) => {
      p.startCombo();
      return [p.interrupt(0.3), p.interrupt(0.45)];
    });
    assert.deepEqual(a, [false, true], 'a light blow does not stop the swing; a heavy one does');
    assert.equal(b[0], true);
  },
  cats_grace: () => {
    const [a, b] = compare('cats_grace', (p) => {
      p.fallStart = 20;
      p.pos.y = 0;
      p.dodgeStartT = G.time - 0.2;
      p.onLand(20);
      return p.hp === p.maxHp;
    });
    assert.equal(a, true, 'the roll took the fall');
    assert.equal(b, false);
  },
  quickstep: () => {
    const [a, b] = compare('quickstep', (p) => {
      G.input.pressed.add('KeyQ');
      p.update(DT);
      const cd = p.dodgeCd;
      p.rollCancel();
      return p.dodgeCd - cd;
    });
    assert.equal(a, 0);
    assert.ok(Math.abs(b - COMBAT.rollCancel.cooldown) < 1e-9);
  },
  wall_runner: () => {
    const [a, b] = compare('wall_runner', (p) => {
      G.world.colliders.addBox({ x: 0, z: 1.2, w: 4, d: 0.6, y0: 0, y1: 8 });
      p.grounded = false;
      p.pos.y = 0.5;
      p.wallHop();
      return p.vel.y;
    });
    assert.ok(Math.abs((a * a) / (b * b) - 1.4) < 1e-9, '40% higher');
  },
  evasive: (t) => {
    pinRandom(t, 0.99);
    const [a, b] = compare('evasive', (p) => {
      G.input.pressed.add('KeyQ');
      p.update(DT);
      p.onEvade(null);
      const foe = bag();
      const hp = foe.hp;
      applyHit(p, foe, Object.assign(p.buildHit({ dmgMul: 1 }, foe), { from: p.pos.clone() }));
      return hp - foe.hp;
    });
    assert.ok(Math.abs(a / b - 1.3) < 1e-6);
  },
  blitz: () => {
    const [a, b] = compare('blitz', (p) => {
      G.input.down.add('KeyW');
      step(0.6);
      G.input.pressed.add('KeyC');
      step(DT);
      return p.slideT;
    });
    assert.ok(a > 0.9, `slid from a run (${a.toFixed(2)} s left)`);
    assert.equal(b, 0, 'not without');
  },
  efficient_casting: () => {
    const [a, b] = compare('efficient_casting', (p) => {
      p.ether = 0;
      p.onDealtHit(bag(), 10, { kind: 'mantra', mantra: 'ember_bolt' });
      return p.ether;
    });
    assert.equal(a, 3);
    assert.equal(b, 0);
  },
  overflow: () => {
    const cast = (p) => {
      G.game.getAim = () => ({ dir: new THREE.Vector3(0, 0, 1), point: new THREE.Vector3(0, 0, 10), target: null });
      p.ch.manaUnlocked = true;
      p.ch.attrs.ember = 20;
      p.ch.mantras.ember_bolt = { stars: 0 };
      p.ch.hotbar[1] = { type: 'mantra', id: 'ember_bolt' };
      p.ether = p.maxEther;
      p.tryCast(1);
      const first = p.maxEther - p.ether;
      p.cooldowns.ember_bolt = 0;
      p.cancelAttack();
      const e0 = p.ether;
      p.tryCast(1);
      return [first, e0 - p.ether];
    };
    const [a, b] = compare('overflow', cast);
    assert.equal(a[0], 0, 'free at full ether');
    assert.ok(a[1] > 0, 'paid for once it is not full');
    assert.ok(b[0] > 0);
  },
  focused_mind: () => {
    const [a, b] = compare('focused_mind', (p) => {
      p.startAttack({ type: 'cast', windup: 0.5, active: 0.1, recovery: 0.2 });
      return p.interrupt(0.3);
    });
    assert.equal(a, false, 'the wind-up holds');
    assert.equal(b, true);
  },
  arcane_mastery: () => {
    const [a, b] = compare('arcane_mastery', (p) => {
      const foe = bag();
      foe.statuses.burn = { t: 5, dps: 0 };
      const hp = foe.hp;
      applyHit(p, foe, { dmg: 20, kind: 'mantra', mantra: 'ember_bolt', element: 'ember', from: p.pos.clone() });
      return hp - foe.hp;
    });
    // the talent's +12% mantra damage is in the caster's power, not in this raw hit
    assert.ok(Math.abs(a / b - 1.2) < 1e-6);
  },
  resolve: () => {
    const { p } = holding(['resolve']);
    p.guardBreak(null);
    assert.ok(p.stunned);
    assert.equal(p.dodge(), true, 'rolled out of the broken guard');
    assert.ok(!p.guardBroken);
    p.dodgeCd = 0;
    p.dodgeT = 0;
    p.guardBreak(null);
    assert.equal(p.dodge(), false, 'not again within 20 s');
    const q = holding([]).p;
    q.guardBreak(null);
    assert.equal(q.dodge(), false);
  },
  clear_head: () => {
    const [a, b] = compare('clear_head', (p) => {
      p.applyStatus('blind', 1, null);
      return p.statuses.blind.t;
    });
    assert.ok(Math.abs(a / b - 0.5) < 1e-9);
  },
  intimidate: (t) => {
    pinRandom(t, 0.5);
    const [a, b] = compare('intimidate', (p) => {
      p.ch.level = 10;
      const e = enemy('brigand', 0, 3);
      e.target = p;
      e.onAttackDone({});
      return e.ai.atkCd;
    });
    assert.ok(Math.abs(a / b - 1.3) < 1e-9);
  },
  rallying_spirit: () => {
    const [a, b] = compare('rallying_spirit', (p) => {
      p.ether = 0;
      p.hp = p.maxHp * 0.2;
      p.onDamaged(bag(), 5);
      const first = p.ether;
      p.onDamaged(bag(), 5);
      return [first, p.ether];
    });
    assert.equal(a[0], 25);
    assert.equal(a[1], 25, 'once a minute');
    assert.equal(b[0], 0);
  },
  presence: () => {
    const [a, b] = compare('presence', (p) => {
      const foe = bag(1.5);
      foe.knocked = true;
      foe.finish = function () {
        this.gripped = true;
      };
      p.hp = 50;
      p.tryGrip();
      let t = 0;
      while (!foe.gripped && t < 2) {
        p.update(DT);
        t += DT;
      }
      return [t, p.hp];
    });
    assert.ok(a[0] < b[0] * 0.7, `finished in ${a[0].toFixed(2)} s against ${b[0].toFixed(2)}`);
    assert.ok(a[1] > b[1], 'and healed');
  },
  flurry_master: () => {
    const [a, b] = compare('flurry_master', (p) => {
      p.startCombo();
      p.cancelAttack();
      G.input.pressed.add('KeyQ');
      step(0.9); // the roll (0.36 s) and more: past the 0.75 s a string waits
      return p.combo;
    });
    assert.equal(a, 1, 'the string goes on after the roll');
    assert.equal(b, 0);
  },
  lightning_reflexes: () => {
    const [a, b] = compare('lightning_reflexes', (p) => {
      p.startCombo();
      G.input.mPressed[2] = true;
      p.update(DT);
      return p.feintCd;
    });
    assert.ok(Math.abs(a / b - 0.6) < 0.05);
  },
  balanced_stance: () => {
    const [a, b] = compare('balanced_stance', (p) => {
      p.startCombo();
      p.atk.held = 0.3;
      return p.buildHit(p.atk.def, null).posture;
    });
    assert.ok(Math.abs(a / b - 1.25) < 1e-9);
  },
  blade_dancer: () => {
    const [a, b] = compare('blade_dancer', (p) => {
      G.input.pressed.add('KeyQ');
      step(0.25);
      G.input.mPressed[0] = true;
      p.update(DT);
      return !!p.atk;
    });
    assert.equal(a, true, 'a swing out of the roll');
    assert.equal(b, false);
  },
  heavy_momentum: () => {
    const [a, b] = compare('heavy_momentum', (p) => {
      const w = [];
      for (let i = 0; i < 3; i++) {
        p.startCombo();
        w.push(p.atk.def.windup);
        p.cancelAttack();
      }
      return w;
    }, { weapon: 'iron_greatsword' });
    assert.ok(Math.abs(a[1] / b[1] - 0.92) < 1e-9 && Math.abs(a[2] / b[2] - 0.92 * 0.92) < 1e-9);
    assert.equal(a[0], b[0]);
  },
  firewalker: () => {
    const [a, b] = compare('firewalker', (p) => {
      G.world.hazards.push({ x: 0, z: 0, r: 2, y: 0, dps: 20, element: 'ember' });
      const hp = p.hp;
      p.hazards(1);
      return hp - p.hp;
    });
    assert.equal(a, 0);
    assert.ok(b > 0);
  },
  conflagration: () => {
    const [a, b] = compare('conflagration', (p) => {
      const dying = enemy('brigand', 0, 4);
      const near = enemy('brigand', 2, 4);
      dying.applyStatus('burn', 1, p);
      dying.die(p);
      return !!near.statuses.burn;
    });
    assert.equal(a, true);
    assert.equal(b, false);
  },
  winter_coat: () => {
    const [a, b] = compare('winter_coat', (p) => {
      for (let i = 0; i < 8; i++) p.applyStatus('chill', 2, null);
      return !!p.statuses.freeze;
    });
    assert.equal(a, false);
    assert.equal(b, true);
  },
  glacial_core: () => {
    const [a, b] = compare('glacial_core', (p) => {
      const foe = bag(2);
      const near = bag(3, { x: 1.5 });
      foe.statuses.freeze = { t: 2 };
      swingAt(p, foe);
      return !!near.statuses.chill;
    });
    assert.equal(a, true);
    assert.equal(b, false);
  },
  static_charge: () => {
    const [a, b] = compare('static_charge', (p) => {
      p.startCombo();
      p.applyStatus('shock', 1, null);
      return !!p.atk;
    });
    assert.equal(a, true, 'shock does not stop you');
    assert.equal(b, false);
  },
  conductor: () => {
    const real = ACTIONS.weatherState;
    ACTIONS.weatherState = () => ({ rain: 0.8 });
    try {
      const [a, b] = compare('conductor', (p) => {
        const foe = bag();
        const hp = foe.hp;
        applyHit(p, foe, { dmg: 20, kind: 'mantra', mantra: 'lightning_strike', element: 'storm', from: p.pos.clone() });
        return hp - foe.hp;
      });
      assert.ok(Math.abs(a / b - 1.15) < 1e-6);
    } finally {
      ACTIONS.weatherState = real;
    }
  },
  tailwind: () => {
    const [a, b] = compare('tailwind', (p) => {
      p.grounded = false;
      p.pos.y = 5;
      p.fallStart = 30;
      p.dodge();
      return p.fallStart;
    });
    assert.equal(a, 5, 'the fall starts again from the roll');
    assert.equal(b, 30);
  },
  windrunner: () => {
    const [a, b] = compare('windrunner', (p) => {
      p.sprinting = true;
      p.yaw = Math.PI;
      const att = bag(4);
      const hp = p.hp;
      applyHit(att, p, { dmg: 20, kind: 'proj', projectile: { deflect() {}, kill() {} }, from: att.pos.clone() });
      return hp - p.hp;
    });
    assert.ok(Math.abs(a / b - 0.7) < 1e-6);
  },
  shroud: () => {
    const [a, b] = compare('shroud', (p) => {
      const foe = enemy('brigand', 0, 2);
      foe.yaw = Math.PI;
      const hp = foe.hp;
      applyHit(p, foe, { dmg: 20, kind: 'melee', from: p.pos.clone() });
      const first = hp - foe.hp;
      const hp2 = foe.hp;
      foe.stunT = 0;
      applyHit(p, foe, { dmg: 20, kind: 'melee', from: p.pos.clone() });
      return [first, hp2 - foe.hp];
    });
    assert.ok(Math.abs(a[0] / b[0] - 1.4) < 1e-6, 'the first blow on an unaware foe');
    assert.ok(Math.abs(a[1] / b[1] - 1) < 1e-6, 'not once it has seen you');
  },
  dusk_shroud: () => {
    const [a, b] = compare('dusk_shroud', (p) => {
      const foe = enemy('brigand', 0, 3);
      foe.applyStatus('blind', 1, p);
      return foe.statuses.blind.t;
    });
    assert.ok(Math.abs(a / b - 1.5) < 1e-9);
  },
};

for (const id of REWORKED) {
  test(`talent ${TALENTS[id].name}: ${TALENTS[id].desc}`, (t) => {
    assert.ok(TESTS[id], `${id} has a test`);
    TESTS[id](t);
  });
}

test('at least half of the old number-bump talents now change play, and each reworked card names its behaviour in a flag', () => {
  for (const id of REWORKED) assert.ok(TALENTS[id].flags && TALENTS[id].flags.length, `${id} carries a behaviour`);
  const pure = Object.values(TALENTS).filter((t) => !t.vow && !(t.flags && t.flags.length)).length;
  assert.ok(pure <= 33, `${pure} talents are still numbers only`);
  assert.ok(REWORKED.length >= 36);
});

test('exclusions: a talent is not offered beside one it excludes, either way round', () => {
  for (const [a, b] of [['evasive', 'ghost_step'], ['rallying_spirit', 'second_wind'], ['juggernaut', 'colossus']]) {
    assert.equal(talentExcluded(a, [b]), true, `${a} with ${b}`);
    assert.equal(talentExcluded(b, [a]), true, `${b} with ${a}`);
  }
  assert.equal(talentExcluded('evasive', ['quickstep']), false);
  for (const t of Object.values(TALENTS)) for (const x of t.excludes || []) assert.ok(TALENTS[x], `${x} exists`);
});

test('every category has a behaviour among its picks', () => {
  const cats = {};
  for (const t of Object.values(TALENTS)) if (!t.vow) (cats[t.cat] ||= []).push(t);
  for (const [cat, list] of Object.entries(cats)) assert.ok(list.some((t) => t.flags && t.flags.length), `${cat}`);
});
