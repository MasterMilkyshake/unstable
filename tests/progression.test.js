// Power gated by investment (task 2): XP earns points one at a time on today's curve, and Power
// rises when the 15th point earned since the last Power is invested. Creation points and points
// refunded at the Shrine of Order never count; Power never goes down; bad values recover.
import test from 'node:test';
import assert from 'node:assert/strict';
import { G, Player, arena, player } from './support/arena.js';

const { xpForLevel, POINTS_PER_LEVEL, START_POINTS, MAX_LEVEL, totalPoints, newAttrs } = await import('../src/data/stats.js');
const { RACE_BY_ID } = await import('../src/data/races.js');
const { MANTRAS } = await import('../src/data/mantras.js');
const { grantBell } = await import('../src/game/bells.js');
const { TALENTS } = await import('../src/data/talents.js');

// a fresh character, sitting by a fire (points are invested at rest)
const fresh = () => {
  arena();
  const p = player({ race: 'morrow' });
  p.derived.xpMul = 1;
  p.ch.xp = 0;
  p.sitting = true;
  return p;
};
const slice = (level) => xpForLevel(level) / POINTS_PER_LEVEL;

test('XP earns investment points one at a time, 15 per Power along today\'s XP curve; Power does not rise on XP alone', () => {
  const p = fresh();
  const ch = p.ch;
  assert.equal(ch.points, START_POINTS);
  p.addXp(Math.ceil(slice(1)) - 1);
  assert.equal(ch.earned, 0, 'just short of a point');
  p.addXp(1);
  assert.equal(ch.earned, 1);
  assert.equal(ch.points, START_POINTS + 1);
  p.addXp(xpForLevel(1)); // far more than the rest of the bar
  assert.equal(ch.earned, POINTS_PER_LEVEL, 'a full bar is 15 points');
  assert.equal(ch.points, START_POINTS + POINTS_PER_LEVEL);
  assert.equal(ch.level, 1, 'no Power without investing');
  assert.equal(ch.xp, xpForLevel(1), 'the bar stays full');
  assert.ok(ch.xpBank > 0, 'the rest is banked');
});

test('the creation points do not count toward Power 2; the 15th earned point invested raises it, with the picks and a full heal', () => {
  const p = fresh();
  const ch = p.ch;
  p.addXp(xpForLevel(1));
  assert.equal(p.invest({ strength: START_POINTS }), 0, 'creation points are spent first and count for nothing');
  assert.equal(ch.invested, 0);
  assert.equal(p.invest({ fortitude: 14 }), 14);
  assert.equal(ch.level, 1, '14 of 15');
  p.hp = 10;
  const picks = [ch.talentPicks, ch.mantraPicks];
  assert.equal(p.invest({ agility: 1 }), 1);
  assert.equal(ch.level, 2, 'the 15th point invested: Power 2');
  assert.deepEqual([ch.talentPicks, ch.mantraPicks], [picks[0] + 1, picks[1] + 1]);
  assert.equal(p.hp, p.maxHp, 'healed');
  assert.deepEqual([ch.earned, ch.invested, ch.points], [0, 0, 0]);
  assert.equal(ch.attrs.strength, RACE_BY_ID.morrow.bonus.strength + START_POINTS || START_POINTS);
});

test('invested points can be spread over several confirms; spending more than you have is refused', () => {
  const p = fresh();
  const ch = p.ch;
  p.invest({ willpower: START_POINTS });
  p.addXp(xpForLevel(1));
  for (let i = 0; i < 4; i++) p.invest({ agility: 3 });
  assert.equal(ch.invested, 12);
  assert.equal(p.invest({ agility: 4 }), -1, 'only 3 left to spend');
  assert.equal(ch.points, 3);
  p.invest({ agility: 3 });
  assert.equal(ch.level, 2);
});

test('XP banked past a full bar flows into the next Power once it rises (at most one Power\'s worth)', () => {
  const p = fresh();
  const ch = p.ch;
  p.invest({ strength: START_POINTS });
  p.addXp(xpForLevel(1) + 3 * slice(2) + 1);
  const bank = ch.xpBank;
  assert.ok(bank > 3 * slice(2));
  p.invest({ strength: POINTS_PER_LEVEL });
  assert.equal(ch.level, 2);
  assert.equal(ch.earned, 3, 'three points of Power 3 earned from the bank at once');
  assert.equal(ch.points, 3);
  assert.equal(ch.xpBank, 0);
  // the bank holds no more than the next Power's bar
  p.addXp(xpForLevel(2) * 5);
  assert.ok(ch.xpBank <= xpForLevel(3));
});

test('points refunded at the Shrine of Order can be re-spent but do not count toward the next Power; Power never goes down', async () => {
  const p = fresh();
  const ch = p.ch;
  p.invest({ strength: START_POINTS });
  p.addXp(xpForLevel(1));
  p.invest({ strength: POINTS_PER_LEVEL });
  assert.equal(ch.level, 2);
  p.derived.xpMul = 1; // (the invest recomputed it with the race's XP bonus)
  p.addXp(xpForLevel(2) * 0.5); // 7 points toward Power 3
  assert.equal(ch.earned, 7);
  p.invest({ fortitude: 4 });
  assert.equal(ch.invested, 4);
  // the Shrine's refund: every point back, Power kept
  const { respec } = await import('../src/game/order.js');
  respec(G.game);
  assert.equal(ch.points, START_POINTS + POINTS_PER_LEVEL + 7, 'all of it to spend again');
  assert.equal(ch.level, 2);
  // re-spend the refund: nothing counts until only the 3 earned, uninvested points are left
  assert.equal(p.invest({ agility: ch.points - 3 }), 0);
  assert.equal(ch.invested, 4);
  assert.equal(p.invest({ agility: 3 }), 3);
  assert.equal(ch.invested, 7);
  assert.equal(ch.level, 2, 'Power is where it was');
});

test('Power 20 earns nothing more', () => {
  const p = fresh();
  const ch = p.ch;
  ch.level = MAX_LEVEL;
  ch.points = 0;
  p.addXp(1e6);
  assert.deepEqual([ch.level, ch.earned, ch.points, ch.xp], [MAX_LEVEL, 0, 0, 0]);
});

test('a save with missing or bad progression values loads and recovers; one from before the gate gets its due points', () => {
  arena();
  const bad = player({ race: 'morrow' });
  Object.assign(bad.ch, { earned: NaN, invested: 99, points: -4, xp: 'x', xpBank: -1, level: 0 });
  bad.ensureProgress();
  assert.deepEqual([bad.ch.level, bad.ch.earned, bad.ch.invested, bad.ch.points, bad.ch.xp, bad.ch.xpBank], [1, 0, 0, 0, 0, 0]);

  // an old save: Power 4, half a bar of XP, no record of earned points
  arena();
  const ch = G.game.createCharacter({ name: 'Old', race: 'morrow', look: {} });
  Object.assign(ch, { level: 4, xp: xpForLevel(4) / 2, points: 2 });
  delete ch.earned;
  const old = new Player(ch);
  assert.equal(ch.earned, 7, 'the half bar is 7 points');
  assert.equal(ch.points, 9);
  assert.equal(old.ch.level, 4);
});

test('quest Power gates and level objectives follow the invested Power', async () => {
  const p = fresh();
  const ch = p.ch;
  const { Quests } = await import('../src/game/quests.js');
  const { meetsReqs } = await import('../src/data/stats.js');
  const quests = new Quests({ ch, save() {} });
  ch.quests.gate = { state: 'active', progress: 0, sp: [] };
  const objective = { type: 'level', level: 2 };
  p.addXp(xpForLevel(1));
  assert.equal(quests._objDone('gate', objective, 0), false, 'a full XP bar alone does not pass a Power 2 objective');
  assert.equal(meetsReqs({ level: 2 }, ch.attrs, { level: ch.level }), false, 'nor a Power 2 requirement');
  p.invest({ strength: START_POINTS + POINTS_PER_LEVEL });
  assert.equal(quests._objDone('gate', objective, 0), true);
  assert.equal(meetsReqs({ level: 2 }, ch.attrs, { level: ch.level }), true);
});

test('banners show their title alone; what to do next (and which mantra a Bell gave) comes as a toast', (t) => {
  const p = fresh();
  const seen = [];
  G.ui = new Proxy({}, {
    get: (_, k) => (k === 'banner' ? (title, sub = '') => seen.push({ banner: title, sub }) : k === 'toast' ? (msg) => seen.push({ toast: msg }) : () => {}),
  });
  p.invest({ strength: START_POINTS });
  p.addXp(xpForLevel(1));
  p.invest({ fortitude: POINTS_PER_LEVEL });
  t.mock.timers.enable({ apis: ['setTimeout'] });
  G.game.ch = p.ch;
  p.ch.hotbar = Array(10).fill(null);
  assert.ok(grantBell(G.game, 'ice_lance'));
  t.mock.timers.tick(3000);
  const banners = seen.filter((s) => s.banner);
  assert.deepEqual(banners.map((s) => s.banner), ['READY TO RISE', 'POWER 2', 'A BELL TOLLS']);
  assert.ok(banners.every((s) => s.sub === ''), 'no subtext under a banner');
  const toasts = seen.filter((s) => s.toast).map((s) => s.toast);
  assert.ok(toasts.some((m) => /Rest at a campfire and invest your points \[Tab\] to reach Power 2/.test(m)));
  assert.ok(toasts.some((m) => /Choose a talent and a mantra \[Tab\]/.test(m)));
  assert.ok(toasts.some((m) => m.startsWith(`${MANTRAS.ice_lance.name}: slot`)));
});

test('as in Deepwoken, points are invested only sitting at a campfire, never in danger; an inn only sets where you wake', () => {
  const p = fresh();
  const ch = p.ch;
  p.sitting = false;
  assert.equal(p.invest({ strength: 1 }), -1, 'refused on the road');
  assert.equal(ch.points, START_POINTS);
  p.sitting = true;
  p.dangerT = 5;
  assert.equal(p.invest({ strength: 1 }), -1, 'refused in danger, even sitting');
  p.dangerT = 0;
  assert.equal(p.invest({ strength: 1 }), 0, 'by the fire: spent (a creation point, counting for nothing)');
  assert.equal(ch.points, START_POINTS - 1);
  // an inn: the keeper sets where you wake, and that is all (no sleep, no rest)
  p.sitting = false;
  const game = G.game;
  Object.assign(game, { player: p, ch, world: Object.assign(G.world, { interactables: [] }), save() {} });
  game.ui = { ...game.ui, fade: () => assert.fail('no sleep at an inn'), toast() {} };
  game.rest('inn_salt', 0);
  assert.equal(ch.spawn.id, 'inn_salt');
  assert.equal(p.resting(), false, 'paying for a room is not a rest');
  assert.equal(p.invest({ strength: 1 }), -1);
});

test('the talent and mantra cards a rise brings are chosen anywhere; the campfire opens on whatever waits', async () => {
  const p = fresh();
  const ch = p.ch;
  p.invest({ strength: START_POINTS });
  p.addXp(xpForLevel(1));
  p.invest({ fortitude: POINTS_PER_LEVEL });
  assert.equal(ch.level, 2);
  const talent = Object.keys(TALENTS).find((id) => !TALENTS[id].vow && !TALENTS[id].reqs);
  const mantra = Object.keys(MANTRAS).find((id) => !MANTRAS[id].vow);
  p.sitting = false;
  assert.equal(p.pickTalent(talent), true, 'on the road');
  assert.ok(ch.talents.includes(talent) && ch.talentPicks === 0);
  assert.equal(p.pickMantra(mantra), true);
  assert.ok(ch.mantras[mantra] && ch.mantraPicks === 0);
  assert.equal(p.pickTalent(talent), false, 'no pick left');
  // what agent 4's campfire asks of the menu
  const { ACTIONS } = await import('../src/game/hooks.js');
  await import('../src/ui/charmenu.js');
  p.addXp(xpForLevel(2));
  assert.deepEqual(ACTIONS.readyToRise(), { points: POINTS_PER_LEVEL, talentPicks: 0, mantraPicks: 0, rise: true });
  const opened = [];
  const el = { querySelector: () => ({ innerHTML: '' }), addEventListener() {} };
  p.sitting = false;
  assert.equal(ACTIONS.openRest({ openModal: (id) => (opened.push(id), el) }), false, 'not sitting at a fire: nothing opens');
  p.sitting = true;
  assert.equal(ACTIONS.openRest({ openModal: (id) => (opened.push(id), el) }), true);
  assert.deepEqual(opened, ['charmenu']);
  p.dangerT = 5;
  assert.equal(ACTIONS.openRest({ openModal: () => el }), false, 'no rest in danger');
});

test('the Attributes tab points the way: each attribute shows the next thing it opens', async () => {
  const p = fresh();
  const ch = p.ch;
  const { nextUnlock } = await import('../src/ui/charmenu.js');
  const { WEAPONS } = await import('../src/data/weapons.js');
  const named = (name) => [...Object.values(TALENTS), ...Object.values(MANTRAS), ...Object.values(WEAPONS)].filter((x) => x.name === name);
  const attrs = { ...ch.attrs, strength: 0 };
  const n = nextUnlock('strength', 0, ch, attrs);
  assert.ok(n && n.at > 0 && n.names.length >= 1 && n.names.length <= 2);
  for (const name of n.names) assert.ok(named(name).some((x) => x.reqs && x.reqs.strength === n.at), `${name} needs Strength ${n.at}`);
  // nothing lower is skipped: no talent, mantra or weapon wanting only Strength sits between 0 and it
  const lower = [...Object.values(TALENTS), ...Object.values(MANTRAS), ...Object.values(WEAPONS)].filter((x) => !x.vow && !x.hidden && x.reqs && Object.keys(x.reqs).every((k) => k === 'strength' || k === 'level') && x.reqs.strength > 0 && x.reqs.strength < n.at);
  assert.deepEqual(lower.map((x) => x.name), []);
  // reached, it points further on
  const after = nextUnlock('strength', n.at, ch, { ...attrs, strength: n.at });
  assert.ok(!after || after.at > n.at);
});
