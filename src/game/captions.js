// Sound cues (Settings → Sound cues): a short caption, with the direction it came from, for the
// sounds that warn: a swing or a cast out of view, a roar, a screech, whispers, a heartbeat, a
// bell, thunder, a guard breaking. It listens to what the game already plays; nothing here
// decides an outcome.
import { G } from '../core/globals.js';
import { BOOT_HOOKS } from './hooks.js';

// sound -> [caption, only when out of view?]
const CUES = {
  swing: ['A swing', true],
  cast: ['A mantra', true],
  screech: ['A screech', false],
  roar: ['A roar', false],
  whisper: ['Whispers', false],
  heartbeat: ['Your heartbeat', false],
  bell: ['A bell tolls', false],
  toll: ['A bell tolls', false],
  thunder: ['Thunder', false],
  guardbreak: ['A guard breaks', false],
  knock: ['Someone falls', true],
};
const MAX_LINES = 3;
const LIFE_MS = 2600;

let box = null;
const lines = [];
const recent = new Map(); // caption -> time, so a flurry reads as one line

// An arrow for where a sound is, against where the camera looks (+x is west).
function arrow(pos) {
  const game = G.game;
  const p = game && game.player;
  if (!pos || !p) return { mark: '', behind: false, inView: true };
  const dx = pos.x - p.pos.x;
  const dz = pos.z - p.pos.z;
  if (Math.hypot(dx, dz) < 1.2) return { mark: '', behind: false, inView: true };
  const fx = Math.sin(game.camYaw);
  const fz = Math.cos(game.camYaw);
  const fwd = (dx * fx + dz * fz) / Math.hypot(dx, dz);
  const side = dx * fz - dz * fx; // > 0: to the left (+x is west)
  const inView = fwd > 0.55;
  const mark = fwd > 0.55 ? '▲' : fwd < -0.55 ? '▼' : side > 0 ? '◀' : '▶';
  return { mark, behind: fwd < -0.55, inView };
}

function show(text) {
  if (!box) box = document.getElementById('captions');
  if (!box) return;
  const now = performance.now();
  if (now - (recent.get(text) || 0) < 900) return;
  recent.set(text, now);
  const el = document.createElement('div');
  el.className = 'cap';
  el.textContent = text;
  box.appendChild(el);
  lines.push(el);
  while (lines.length > MAX_LINES) lines.shift().remove();
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => {
      el.remove();
      const i = lines.indexOf(el);
      if (i >= 0) lines.splice(i, 1);
    }, 400);
  }, LIFE_MS);
}

export function caption(name, opts = {}) {
  const cue = CUES[name];
  if (!cue || !(G.settings && G.settings.soundCues)) return;
  const game = G.game;
  if (!game || game.state !== 'playing' || !game.player) return;
  const p = game.player;
  if (opts.pos && Math.hypot(opts.pos.x - p.pos.x, opts.pos.z - p.pos.z) > 40) return;
  const a = arrow(opts.pos);
  if (cue[1] && (a.inView || !opts.pos)) return; // only a warning when you can't see it
  show(`${a.mark ? a.mark + ' ' : ''}${cue[0]}${a.behind ? ' behind you' : ''}`);
}

BOOT_HOOKS.push((game) => {
  const audio = game.audio;
  const play = audio.play.bind(audio);
  audio.play = (name, opts) => {
    try {
      caption(name, opts);
    } catch (_) {
      /* a caption never stops a sound */
    }
    return play(name, opts);
  };
});
