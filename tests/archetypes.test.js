// Enemy variety and group play (task 6): one test per new archetype, and the group rules (turns,
// flanks, falling back and calling for help, ranged foes keeping back). Real Enemy AI on flat
// ground against a real Player who does not fight back (tests/support/arena.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { G, THREE, arena, player, enemy, step, pinRandom, DT } from './support/arena.js';

const { TACTICS } = await import('../src/entities/tactics.js');
const { canLaunch } = await import('../src/combat/rules.js');

// A player who stands and takes it (never dies), at the origin.
function standee() {
  arena();
  const p = player();
  p.update = function (dt) {
    this.hp = this.maxHp;
    this.iframes = 1; // blows land as evasions: the foes fight on, the test watches them
    this.baseUpdate(dt);
    this.physics(dt);
  };
  return p;
}
const foe = (type, x, z, p) => {
  const e = enemy(type, x, z);
  e.setAggro(p);
  return e;
};
const flat = (a, b) => Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z);

// ---------------------------------------------------------------- archetypes
test('Redwake Harpooner (ranged): keeps 8-15 m back and throws; steps away when you close in', () => {
  const p = standee();
  const h = foe('redwake_harpooner', 0, 12, p);
  let thrown = 0;
  step(6, () => {
    for (const pr of G.projectiles) if (pr.owner === h && !pr.seen) {
      pr.seen = true;
      thrown++;
    }
  });
  assert.ok(thrown >= 2, `threw ${thrown} harpoons`);
  assert.ok(flat(h, p) >= 7 && flat(h, p) <= 16, `kept its band (${flat(h, p).toFixed(1)} m)`);
  // walk right up to it: it backs off
  p.pos.set(h.pos.x, 0, h.pos.z - 3);
  step(2.5);
  assert.ok(flat(h, p) > 5, `stepped back to ${flat(h, p).toFixed(1)} m`);
});

test('Redwake Bonesetter (support): mends the most wounded of its side, rallies them, and a blow in the wind-up stops the mending', () => {
  const p = standee();
  const b = foe('redwake_bonesetter', 0, 9, p);
  const hurt = foe('brigand', 3, 6, p);
  hurt.hp = hurt.maxHp * 0.3;
  hurt.ai.atkCd = 99;
  let mended = false;
  let rallied = false;
  step(6, () => {
    hurt.ai.atkCd = 99;
    if (hurt.hp > hurt.maxHp * 0.45) mended = true;
    if (hurt.rallyMul() > 1) rallied = true;
  });
  assert.ok(mended, `mended the brigand (${Math.round(hurt.hp)}/${hurt.maxHp})`);
  assert.ok(rallied, 'and rallied it');
  assert.ok(flat(b, p) >= 5, 'from behind the line');

  // cut the next mending short
  hurt.hp = hurt.maxHp * 0.3;
  b.ai.cds.heal = 0;
  b.ai.atkCd = 0;
  let cut = false;
  step(3, () => {
    hurt.ai.atkCd = 99;
    if (b.atk && b.atk.def.netKey[1] === 'heal' && b.atk.phase === 'windup' && !cut) {
      b.interrupt(0.4);
      cut = true;
    }
  });
  assert.ok(cut, 'caught it winding up');
  assert.ok(hurt.hp <= hurt.maxHp * 0.3 + 1, 'and nothing was mended');
});

test('Redwake Skirmisher: waits for you to look away before it commits, then darts back out', (t) => {
  pinRandom(t, 0.5);
  const p = standee();
  const s = foe('redwake_skirmisher', 0, 2.6, p);
  p.yaw = 0; // facing it
  s.ai.atkCd = 0;
  let committedAt = null;
  step(2.5, (tt) => {
    if (s.atk && committedAt === null) committedAt = tt;
  });
  assert.ok(committedAt === null || committedAt > 1.4, `held off while watched (${committedAt})`);
  // look away: it strikes
  const s2 = foe('redwake_skirmisher', 0, -2.6, p);
  s2.ai.atkCd = 0;
  let struck = false;
  let endAt = null;
  let out = 0;
  step(3, () => {
    s.ai.atkCd = 99;
    if (s2.atk) struck = true;
    if (struck && !s2.atk && endAt === null) endAt = flat(s2, p);
    if (endAt !== null) out = Math.max(out, flat(s2, p) - endAt);
  });
  assert.ok(struck, 'struck at your back');
  assert.ok(out > 1, `and darted ${out.toFixed(1)} m back out`);
});

test('Redwake Breaker (bruiser): swings through light blows, charges from range, never launched, never flees', () => {
  const p = standee();
  const b = foe('redwake_breaker', 0, 2.8, p);
  b.startAttack(b.humanoidM1(0));
  assert.equal(b.interrupt(0.3), false, 'its swing goes on');
  assert.equal(canLaunch(b), false);
  b.cancelAttack();
  b.pos.set(0, 0, 8);
  b.ai.cds = {};
  let charged = false;
  for (let i = 0; i < 40 && !charged; i++) {
    const d = b.chooseAttack(8);
    if (d && d.netKey[1] === 'shoulder_charge') charged = true;
    b.ai.cds = {};
  }
  assert.ok(charged, 'a shoulder charge from 8 m');
  b.hp = b.maxHp * 0.1;
  step(1);
  assert.ok(!b.ai.fled, 'stands its ground');
});

test('Shellback and Cairn Hulk (large monsters): each follows its pattern in order', () => {
  for (const type of ['shellback', 'cairn_hulk']) {
    const p = standee();
    const m = foe(type, 0, 3, p);
    const seen = [];
    step(20, () => {
      if (m.atk && m.atk !== m._last) {
        m._last = m.atk;
        seen.push(m.atk.def.netKey[1]);
      }
    });
    const pattern = m.spec.pattern;
    assert.ok(seen.length >= pattern.length + 1, `${type} attacked ${seen.length} times`);
    seen.forEach((id, i) => assert.equal(id, pattern[i % pattern.length], `${type}: step ${i}`));
    assert.equal(canLaunch(m), false);
    m.hp = m.maxHp * 0.1;
    step(0.5);
    assert.ok(!m.ai.fled, 'a monster never flees');
  }
});

// ---------------------------------------------------------------- group play
test('turns: four brigands on one player, at most two press at once while the others circle at the edge', () => {
  const p = standee();
  const bs = [[0, 4], [3, 3], [-3, 3], [0, -4]].map(([x, z]) => foe('brigand', x, z, p));
  let maxSwinging = 0;
  let pressedByTwo = 0;
  let samples = 0;
  step(12, (tt) => {
    const swinging = bs.filter((b) => b.atk && b.atk.phase !== 'recovery').length;
    maxSwinging = Math.max(maxSwinging, swinging);
    if (tt > 2) {
      samples++;
      if (bs.filter((b) => flat(b, p) < 3.2).length <= TACTICS.strikers) pressedByTwo++;
    }
  });
  assert.ok(maxSwinging <= TACTICS.strikers, `${maxSwinging} swinging at once`);
  // the rest circle at the edge; only a turn changing hands brings a third in close for a moment
  assert.ok(pressedByTwo / samples > 0.85, `two or fewer close ${Math.round((100 * pressedByTwo) / samples)}% of the time`);
  const struck = new Set();
  for (const b of bs) if (b.ai.restUntil) struck.add(b);
  assert.ok(struck.size >= 3, `turns changed hands (${struck.size} gave one up)`);
});

test('turns: a turn that runs out without a swing rests before it is claimed again, so a waiting foe gets in', () => {
  const p = standee();
  // two pressers that never swing (kept from it, or unable to reach) hold both turns at first
  const idle = [[0, 2], [2, 0]].map(([x, z]) => foe('brigand', x, z, p));
  const hold = () => { for (const b of idle) b.ai.atkCd = 99; };
  step(0.5, hold);
  const third = foe('brigand', 0, -6, p);
  let swung = false;
  step(TACTICS.turn + TACTICS.rest + 1, () => {
    hold();
    swung ||= !!third.atk;
  });
  assert.ok(swung, 'the third brigand never got a turn while the other two held theirs without swinging');
});

// A seeded stand-in for Math.random, so a fight's rolls are the same on every run.
const seeded = (s) => () => {
  s = (s + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

test('flanks: the second brigand pressing comes in off the first one\'s line', () => {
  // Three fixed sequences of rolls: with free rolls, about 1 fight in 40 timed the two to arrive
  // together, so no flank formed and the test failed by chance.
  const real = Math.random;
  try {
    for (const seed of [1, 2, 3]) {
      Math.random = seeded(seed);
      const p = standee();
      const a = foe('brigand', 0, 6, p);
      const b = foe('brigand', 0.6, 7, p);
      let best = 0;
      step(6, () => {
        if (flat(a, p) < 4.5 && flat(b, p) < 4.5) {
          const ang = Math.abs(Math.atan2(Math.sin(Math.atan2(a.pos.x, a.pos.z) - Math.atan2(b.pos.x, b.pos.z)), Math.cos(Math.atan2(a.pos.x, a.pos.z) - Math.atan2(b.pos.x, b.pos.z))));
          best = Math.max(best, ang);
        }
      });
      assert.ok(best > 0.7, `seed ${seed}: they spread ${((best * 180) / Math.PI).toFixed(0)} degrees apart round the player`);
    }
  } finally {
    Math.random = real;
  }
});

test('falling back: a brigand brought low backs off and calls in its side from up to 30 m', () => {
  const p = standee();
  const b = foe('brigand', 0, 3, p);
  const far = enemy('brigand', 0, 28); // out of the usual 14 m alert, unaware
  far.ai.atkCd = 99;
  step(0.5);
  assert.equal(far.aggro, false);
  b.hp = b.maxHp * 0.25;
  const d0 = flat(b, p);
  step(1.5, () => (far.ai.atkCd = 99));
  assert.ok(b.ai.fled && flat(b, p) > d0 + 2, `fell back to ${flat(b, p).toFixed(1)} m`);
  assert.ok(far.aggro && far.target === p, 'and the one 28 m off answered');
  step(2);
  assert.ok(G.time > b.ai.retreatUntil, 'then it comes back to the fight');
});

test('ranged foes stay behind the melee line', () => {
  const p = standee();
  const melee = [foe('brigand', 0, 4, p), foe('brigand', 2, 4, p)];
  const h = foe('redwake_harpooner', 0, 9, p);
  let minRanged = Infinity;
  step(8, (tt) => {
    if (tt > 1) minRanged = Math.min(minRanged, flat(h, p));
  });
  const meleeAvg = melee.reduce((n, m) => n + flat(m, p), 0) / melee.length;
  assert.ok(minRanged > meleeAvg + 2, `the harpooner held ${minRanged.toFixed(1)} m back, the brigands ~${meleeAvg.toFixed(1)} m`);
});
