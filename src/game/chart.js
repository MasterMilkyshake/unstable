// What the world's life draws over the chart (docs/agent/WORLD_LIFE_PLAN.md, task 11).
// ui/worldmap.js calls ACTIONS.mapOverlay after its roads and before its labels, and
// ACTIONS.mapHolder for the line in its cartouche. Drawn here: who holds the coast, washed in
// their colour over the regions they keep; the carrier lines; the climbing lines by the tier
// they reach (Heights, High, Crown; the hidden ways up stay hidden); the landmarks; a legend.
import { G } from '../core/globals.js';
import { ACTIONS } from './hooks.js';
import { REGIONS } from '../data/world.js';
import { FACTIONS } from '../data/factions.js';
import { MONUMENTS } from '../data/vistas.js';
import { TIER_MARKS } from '../data/ledgeSites.js';
import { coastState, coastHolder } from './worldLife.js';

// Who keeps each region of the coast, from the story (game/worldLife.js coastState).
export function regionHolders(ch) {
  const s = coastState(ch);
  const salt = s.ending === 'break' ? 'watch' : s.ending === 'seal' ? 'ministry' : s.ending === 'claim' || s.occupied ? 'enclave' : 'watch';
  const meridian = s.ending === 'break' ? 'watch' : s.ending === 'seal' ? 'ministry' : 'enclave';
  return { saltreach: salt, meridian, the_hush: 'ministry' };
}

// the chain a line asks, as the tier its top stands in
const TIER = { 3: { name: 'Heights', fill: null, ink: '#4a3a24' }, 4: { name: 'High', fill: '#c8902c', ink: '#3a2a14' }, 5: { name: 'Crown', fill: '#e8c050', ink: '#3a2a14' } };

function triangle(ctx, x, y, r, fill, ink) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r * 0.9, y + r * 0.6);
  ctx.lineTo(x - r * 0.9, y + r * 0.6);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.2;
  ctx.stroke();
}

ACTIONS.mapOverlay = (ctx, toPx, region, here) => {
  const world = G.world, ch = G.game?.ch;
  if (!world || region.rift) return;
  const px = (m) => Math.abs(toPx(m, 0)[0] - toPx(0, 0)[0]);
  ctx.save();
  // who holds the coast: a wash of their colour over the region, its edge dashed
  if (ch) {
    for (const [id, f] of Object.entries(regionHolders(ch))) {
      const r = REGIONS.find((q) => q.id === id);
      if (!r || !here(r.cx, r.cz)) continue;
      const [x, y] = toPx(r.cx, r.cz), rad = px(r.radius) * 1.05;
      const c = FACTIONS[f].color;
      const g = ctx.createRadialGradient(x, y, rad * 0.2, x, y, rad);
      g.addColorStop(0, c + '30');
      g.addColorStop(1, c + '00');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = c + '90';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  // the carrier lines: a cable between its two ends
  for (const line of world.carrierLines || []) {
    const { a, b } = line.def;
    if (!here(a.x, a.z) && !here(b.x, b.z)) continue;
    const [ax, ay] = toPx(a.x, a.z), [bx, by] = toPx(b.x, b.z);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.strokeStyle = '#f0e4c4';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = '#2e241a';
    ctx.lineWidth = 1.3;
    ctx.stroke();
    for (const [x, y] of [[ax, ay], [bx, by]]) {
      ctx.fillStyle = '#2e241a';
      ctx.fillRect(x - 1.8, y - 1.8, 3.6, 3.6);
    }
  }
  // the climbing lines' tops, by tier (a step of one latch is no tier)
  for (const l of world.ledgeLines || []) {
    const t = TIER[l.def.chain];
    const top = l.treads[l.treads.length - 1];
    if (!t || !top || !here(top.x, top.z)) continue;
    const [x, y] = toPx(top.x, top.z);
    triangle(ctx, x, y, l.def.chain === 5 ? 5.5 : 4.5, t.fill, t.ink);
  }
  // what the high places hold, marked as they are from below
  for (const m of TIER_MARKS) {
    if (!here(m.x, m.z)) continue;
    const [x, y] = toPx(m.x, m.z);
    ctx.fillStyle = '#3a2a14';
    ctx.fillRect(x - 1.2, y - 1.2, 2.4, 2.4);
  }
  // landmarks: a diamond and the name, where it doesn't crowd another
  ctx.font = 'italic 10px Georgia, serif';
  ctx.textAlign = 'center';
  const placed = [];
  for (const m of MONUMENTS) {
    if (!m.name || !here(m.x, m.z)) continue;
    const [x, y] = toPx(m.x, m.z);
    ctx.beginPath();
    ctx.moveTo(x, y - 4);
    ctx.lineTo(x + 3, y);
    ctx.lineTo(x, y + 4);
    ctx.lineTo(x - 3, y);
    ctx.closePath();
    ctx.fillStyle = '#5a4630';
    ctx.fill();
    const w = ctx.measureText(m.name).width;
    if (placed.some((r) => Math.abs(r.x - x) < (r.w + w) / 2 + 4 && Math.abs(r.y - y) < 14)) continue;
    placed.push({ x, y, w });
    ctx.strokeStyle = 'rgba(240,228,196,0.8)';
    ctx.lineWidth = 2.4;
    ctx.strokeText(m.name, x, y + 13);
    ctx.fillStyle = '#4a3a24';
    ctx.fillText(m.name, x, y + 13);
  }
  // the legend, low on the left
  const W = ctx.canvas.width;
  const lx = 14, ly = W - 74;
  ctx.fillStyle = 'rgba(240,228,196,0.78)';
  ctx.fillRect(lx - 6, ly - 14, 150, 70);
  ctx.textAlign = 'left';
  ctx.font = '10px Georgia, serif';
  ctx.fillStyle = '#3a2e20';
  triangle(ctx, lx + 4, ly - 2, 4.5, TIER[4].fill, TIER[4].ink);
  triangle(ctx, lx + 18, ly - 2, 5.5, TIER[5].fill, TIER[5].ink);
  ctx.fillStyle = '#3a2e20';
  ctx.fillText('a high climb · a crown', lx + 28, ly + 2);
  ctx.beginPath();
  ctx.moveTo(lx - 1, ly + 14);
  ctx.lineTo(lx + 22, ly + 14);
  ctx.strokeStyle = '#2e241a';
  ctx.lineWidth = 1.3;
  ctx.stroke();
  ctx.fillText('a carrier line', lx + 28, ly + 18);
  ctx.fillStyle = (FACTIONS.watch.color) + '60';
  ctx.fillRect(lx - 1, ly + 25, 22, 8);
  ctx.fillStyle = '#3a2e20';
  ctx.fillText('who holds the coast', lx + 28, ly + 33);
  ctx.restore();
};

ACTIONS.mapHolder = (region) => {
  const ch = G.game?.ch;
  if (!ch || region.rift) return null;
  return coastHolder(ch).line;
};
