// Falling into the Rift: when the Rift takes you (death, the Crown Sluice), you sink out of the
// sea overhead and fall through the dark to the ground below. No fall damage, and nothing can
// touch you mid-fall.
import * as THREE from 'three';
import { G } from '../core/globals.js';
import { UPDATE_HOOKS, START_HOOKS, ACTIONS } from './hooks.js';
import { RIFT_SCAPE } from '../world/riftscape.js';

const TERMINAL = -22;
let lastRift = null;
let fall = null; // { t }

function startFall(game) {
  const p = game.player;
  const top = RIFT_SCAPE.ceil - 12;
  p.pos.y = top;
  p.vel.set(0, -4, 0);
  p.grounded = false;
  p.fallStart = p.pos.y;
  fall = { t: 0 };
  G.audio.play('portal', { vol: 0.8 });
  G.audio.play('splash', { vol: 0.6 });
  G.vfx.burst(p.center(), 'umbra', 40, { speed: 6 });
  game.camPitch = -0.6;
}

START_HOOKS.push((game) => {
  lastRift = game.inRift;
  fall = null;
});

UPDATE_HOOKS.push((game, dt) => {
  const p = game.player;
  if (!p || p.dead) return;
  if (lastRift === false && game.inRift && !fall) startFall(game);
  lastRift = game.inRift;
  if (!fall) return;
  fall.t += dt;
  p.fallStart = p.pos.y; // never fall damage from this
  p.iframes = Math.max(p.iframes, 0.25);
  if (p.vel.y < TERMINAL) p.vel.y = TERMINAL;
  // streaks rushing past as you sink
  if (Math.random() < dt * 30) {
    const a = Math.random() * Math.PI * 2;
    const q = p.pos.clone().add(new THREE.Vector3(Math.cos(a) * 3, -2 - Math.random() * 6, Math.sin(a) * 3));
    G.vfx.add.emit(q.x, q.y, q.z, 0, 18, 0, new THREE.Color('#b89aff'), 0.18, 0.5, { drag: 0.2 });
  }
  if (p.grounded || p.swimming || fall.t > 14) {
    G.vfx.dust(p.pos, 26, '#4a3a64', 1.4);
    G.vfx.ring(p.pos, 'umbra', 4, 0.5);
    G.vfx.addShake(0.45);
    G.audio.play('land', { pos: p.pos, vol: 1 });
    G.audio.play('hitHeavy', { pos: p.pos, pitch: 0.5, vol: 0.5 });
    p.iframes = Math.max(p.iframes, 1);
    fall = null;
  }
});

ACTIONS.riftFalling = () => !!fall;

// The Crown Sluice: open the drydock's gate and let the passage take you down, alive.
ACTIONS.enterSluice = () => {
  const game = G.game;
  if (!game || game.inRift || game.transitioning) return;
  G.ui.toast('The sluice opens under you and the sea pulls you down...', 'bad');
  game.enterRift(false);
};
