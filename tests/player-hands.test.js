import test from 'node:test';
import assert from 'node:assert/strict';
import * as modules from 'node:module';
import * as THREE from 'three';

if (modules.registerHooks) {
  modules.registerHooks({ load(url, context, next) {
    return url.endsWith('.css') ? { format: 'module', source: '', shortCircuit: true } : next(url, context);
  } });
} else {
  modules.register('data:text/javascript,' + encodeURIComponent(`
    export async function load(url, context, next) {
      return url.endsWith('.css') ? { format: 'module', source: '', shortCircuit: true } : next(url, context);
    }
  `), import.meta.url);
}
globalThis.document = { addEventListener() {}, querySelector() { return null; } };
globalThis.window = { addEventListener() {}, innerWidth: 1280, innerHeight: 720 };

const { G } = await import('../src/core/globals.js');
const { Player } = await import('../src/entities/player.js');
const { Game } = await import('../src/game/game.js');

const toasts = [];
G.audio = { play() {} };
G.ui = { toast: (m) => toasts.push(m) };
G.vfx = { dust() {} };
G.net = null;
G.time = 0;
G.game = { camYaw: 0 };

function hands(ch) {
  const p = Object.create(Player.prototype);
  Object.assign(p, { ch, atk: null, dead: false, knocked: false, blocking: false, parryT: 0, queued: false, actBuf: 0, combo: 0, selected: 0 });
  p.refreshWeapon = () => { p.refreshed = (p.refreshed || 0) + 1; };
  return p;
}

test('a new character wakes with its fists down; [1] raises and lowers them', () => {
  const ch = Object.create(Game.prototype).createCharacter({ name: 'Wren', race: 'ashkin', look: {} });
  assert.equal(ch.armed, false, 'fists start lowered');
  assert.deepEqual(ch.hotbar[0], { type: 'weapon' }, 'the fists keep their slot');
  const p = hands(ch);
  assert.equal(p.armed, false);
  p.selectSlot(0);
  assert.equal(p.armed, true, 'raised');
  assert.ok(p.refreshed > 0, 'the model takes the weapon up');
  p.selectSlot(0);
  assert.equal(p.armed, false, 'lowered again');
  // not mid-swing
  p.selectSlot(0);
  p.atk = { phase: 'active' };
  p.selectSlot(0);
  assert.equal(p.armed, true, 'a swing in progress keeps the hands up');
});

test('saves from before the hands could be lowered stay armed', () => {
  assert.equal(hands({}).armed, true);
});

test('lowering the hands drops a block and any buffered swing', () => {
  const p = hands({ armed: true, equipped: { weapon: null }, inventory: { weapons: [] } });
  Object.assign(p, { blocking: true, parryT: 0.2, queued: true, actBuf: 0.2 });
  p.setArmed(false);
  assert.deepEqual([p.blocking, p.parryT, p.queued, p.actBuf], [false, 0, false, 0]);
});

function roller(mods = {}) {
  const p = Object.create(Player.prototype);
  Object.assign(p, {
    ch: {}, mods, dodgeCd: 0, knocked: false, dead: false, stunT: 0, statuses: {}, gripT: 0, eatT: 0,
    grounded: false, swimming: false, climbing: false, atk: null, yaw: 0, blocking: false, charging: false,
    airDodges: 0, dodgeT: 0, dodgeDir: new THREE.Vector3(), pos: new THREE.Vector3(), derived: { dodgeCd: 0.6 },
    model: { anim: { startRoll() {} } },
  });
  p.inputDir = (out) => out.set(0, 0, 0);
  p.clearStatus = () => {};
  return p;
}

test('anyone can roll once in mid-air; Updraft and Sky Dancer give a second', () => {
  const p = roller();
  p.dodge();
  assert.ok(p.dodgeT > 0, 'the first air roll comes out');
  Object.assign(p, { dodgeT: 0, dodgeCd: 0 });
  p.dodge();
  assert.equal(p.dodgeT, 0, 'no second roll without the talent');
  const t = roller({ airDodge: true });
  t.dodge();
  Object.assign(t, { dodgeT: 0, dodgeCd: 0 });
  t.dodge();
  assert.ok(t.dodgeT > 0, 'the talent gives a second');
  Object.assign(t, { dodgeT: 0, dodgeCd: 0 });
  t.dodge();
  assert.equal(t.dodgeT, 0, 'and no third');
});
