// Fishing: a timing minigame at docks and fishing spots. Land three good reels
// before the fish slips three times (or the line goes slack) to make the catch.
import { G } from '../core/globals.js';
import { ACTIONS } from './hooks.js';
import { ITEMS } from '../data/items.js';
import { openPanel } from '../ui/panel.js';
import { CATCH } from '../data/fishing.js';

const TIER = [
  { name: '', zone: 0.24, speed: 0.75 },
  { name: 'Something strong', zone: 0.19, speed: 0.95 },
  { name: 'Something rare!', zone: 0.15, speed: 1.2 },
  { name: 'Something LEGENDARY!', zone: 0.11, speed: 1.5 },
];

function roll(pool) {
  const table = CATCH[pool] || CATCH.shore;
  let total = 0;
  for (const r of table) total += r[0];
  let x = Math.random() * total;
  for (const r of table) {
    x -= r[0];
    if (x <= 0) return { id: r[1], tier: r[2] };
  }
  return { id: table[0][1], tier: table[0][2] };
}

let session = null;

export function startFishing(spot) {
  const game = G.game;
  const ui = G.ui;
  const p = game.player;
  if (!game.ch.inventory.items.fishing_rod) return ui.toast('You need a fishing rod. Pell in Saltreach and Moss in Shimmerfen sell them.', 'bad');
  if (p.inDanger) return ui.toast("You can't fish while in danger.", 'bad');
  if (session) return;
  p.yaw = Math.atan2(spot.water.x - p.pos.x, spot.water.z - p.pos.z);
  let fish = roll(spot.pool);
  if (p.mods.angler && fish.tier === 0 && Math.random() < 0.25) fish = roll(spot.pool);
  const base = TIER[fish.tier];
  const tier = p.mods.angler ? Object.assign({}, base, { zone: base.zone * 1.3 }) : base;
  const s = (session = {
    fish, tier, hits: 0, misses: 0, need: fish.tier >= 2 ? 4 : 3, pos: 0, dir: 1, zone: 0, t: 0, bite: 1.2 + Math.random() * 1.6, hooked: false, done: false, msg: 'Waiting for a bite...',
  });
  s.zone = 0.1 + Math.random() * (0.8 - tier.zone);
  G.audio.play('splash', { pos: spot.water, vol: 0.4 });
  G.vfx.splash && G.vfx.splash(spot.water);

  const render = () => {
    const pips = (n, of, cls) => Array.from({ length: of }, (_, i) => `<span class="pill" style="min-width:22px;text-align:center;${i < n ? (cls === 'good' ? 'background:#3a6a3a' : 'background:#6a2a2a') : 'opacity:0.5'}">${i < n ? (cls === 'good' ? '✓' : '✗') : '&nbsp;'}</span>`).join(' ');
    return `<h2>FISHING</h2>
      <p style="text-align:center;min-height:24px" class="fish-msg">${s.msg}</p>
      <div class="fish-track"><div class="fish-zone" style="left:${s.zone * 100}%;width:${tier.zone * 100}%;${s.hooked ? '' : 'opacity:0.15'}"></div><div class="fish-marker" style="left:${s.pos * 100}%"></div></div>
      <div class="row-flex"><span>Reels ${pips(s.hits, s.need, 'good')}</span><span class="space"></span><span>Slips ${pips(s.misses, 3, 'bad')}</span></div>
      <div class="divider"></div>
      <div class="row-flex"><span class="muted" style="font-size:13px">Press <kbd>Space</kbd> or click Reel when the marker is in the green.</span><span class="space"></span><button class="btn" data-a="close">Stop</button><button class="btn primary" data-a="reel">Reel</button></div>`;
  };

  const finish = (caught) => {
    s.done = true;
    if (caught) {
      const it = ITEMS[s.fish.id];
      game.giveItem(s.fish.id, 1, true);
      ui.toast(`You caught: ${it ? it.name : s.fish.id}!`, s.fish.tier >= 2 ? 'quest' : 'loot');
      G.audio.play(s.fish.tier >= 2 ? 'levelup' : 'coin', { vol: 0.6 });
      game.ch.stats.fishCaught = (game.ch.stats.fishCaught || 0) + 1;
      if (s.fish.tier >= 1) p.addXp(15 + s.fish.tier * 25);
      game.save();
    } else {
      ui.toast('It got away.', '');
    }
    setTimeout(() => {
      if (ui.modal && ui.modal.id === 'fishing') ui.closeModal();
    }, caught ? 700 : 900);
  };

  const reel = () => {
    if (s.done) return;
    if (!s.hooked) {
      s.msg = 'Too early - you spooked it!';
      s.misses++;
      s.bite += 1.2;
      if (s.misses >= 3) finish(false);
      return;
    }
    const inZone = s.pos >= s.zone && s.pos <= s.zone + tier.zone;
    if (inZone) {
      s.hits++;
      s.msg = s.hits >= s.need ? 'Landed it!' : 'Good reel!';
      G.audio.play('reel', { pitch: 1 + s.hits * 0.1 });
      s.zone = 0.05 + Math.random() * (0.9 - tier.zone);
      s.t = 0;
      if (s.hits >= s.need) finish(true);
    } else {
      s.misses++;
      s.msg = 'The line slips!';
      G.audio.play('dodge', { vol: 0.4 });
      if (s.misses >= 3) finish(false);
    }
  };

  const panel = openPanel(ui, 'fishing', {
    width: 560,
    render,
    onClick: (e, rerender) => {
      if (e.target.closest('[data-a="reel"]')) reel();
      rerender();
    },
    onClose: () => {
      session = null;
      window.removeEventListener('keydown', onKey, true);
    },
  });
  const onKey = (e) => {
    if (e.code === 'Space' || e.code === 'KeyE') {
      e.preventDefault();
      reel();
      panel.rerender();
    }
  };
  window.addEventListener('keydown', onKey, true);
  if (p.model && p.model.anim && p.model.anim.playPose) p.model.anim.playPose('charge', 0.6);

  let last = performance.now();
  const tick = (now) => {
    if (!panel.isOpen() || session !== s) return;
    const dt = Math.min(0.12, (now - last) / 1000);
    last = now;
    if (!s.done) {
      if (!s.hooked) {
        s.bite -= dt;
        if (s.bite <= 0) {
          s.hooked = true;
          s.msg = tier.name ? `${tier.name} takes the hook!` : 'A bite! Reel it in!';
          G.audio.play('splash', { pos: spot.water, vol: 0.7 });
        }
      } else {
        s.t += dt;
        s.pos += s.dir * tier.speed * dt * (1 + s.hits * 0.12);
        if (s.pos > 1) {
          s.pos = 1;
          s.dir = -1;
        } else if (s.pos < 0) {
          s.pos = 0;
          s.dir = 1;
        }
        if (s.t > 7) {
          s.misses++;
          s.t = 0;
          s.msg = 'The fish pulls away...';
          if (s.misses >= 3) finish(false);
        }
      }
      const m = panel.el.querySelector('.fish-marker');
      if (m) m.style.left = s.pos * 100 + '%';
      const msg = panel.el.querySelector('.fish-msg');
      if (msg && msg.textContent !== s.msg) panel.rerender();
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return s;
}

ACTIONS.startFishing = startFishing;
// for tests: current session state
ACTIONS.fishingSession = () => session;
