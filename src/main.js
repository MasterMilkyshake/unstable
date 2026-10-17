import './core/sceneMatrices.js'; // before anything builds or renders the scene
import './ui/fonts/fonts.css';
import './ui/style.css';
import { Game } from './game/game.js';
import { G } from './core/globals.js';
import './game/systems.js'; // registers optional gameplay systems with game/hooks.js

window.__G = G; // handy for debugging from the console

function boot() {
  const canvas = document.getElementById('game');
  try {
    const game = new Game(canvas);
    window.__unstable = game;
  } catch (e) {
    console.error(e);
    const l = document.getElementById('loading');
    l.textContent = 'The isles failed to form: ' + e.message;
    l.style.letterSpacing = '0.05em';
    l.style.fontSize = '16px';
    return;
  }
  const l = document.getElementById('loading');
  l.style.transition = 'opacity 0.8s';
  l.style.opacity = '0';
  setTimeout(() => l.remove(), 900);
}

// let the loading text paint before the heavy world generation
requestAnimationFrame(() => setTimeout(boot, 30));
