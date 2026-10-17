// Illustrated parchment chart. Coastlines, town streets and settlements come from the
// live world layout; the paint is ink and stain, not a heightfield screenshot. The way
// between towns is not inked: it is found on foot (world/wayfinding.js).
import { G } from '../core/globals.js';
import { ACTIONS } from '../game/hooks.js';
import { REGIONS, LOCATIONS, STRUCTURES, islandAtPoint } from '../data/world.js';
import { settledRuns } from '../world/wayfinding.js';

const MAP_REGIONS = {
  surface: { key: 'surface', title: 'The Shattered Isles', subtitle: 'A chart of surviving coasts', cx: 0, cz: 480, span: 4300, rift: false },
  rift: { key: 'rift', title: 'The Rift', subtitle: 'The world beneath the world', cx: 6000, cz: 6000, span: 900, rift: true },
};

function mapRegionFor(pos, inRift) {
  if (!inRift) return MAP_REGIONS.surface;
  return MAP_REGIONS.rift;
}
const inRegion = (r, x, z) => Math.abs(x - r.cx) <= r.span / 2 && Math.abs(z - r.cz) <= r.span / 2;

const cache = {};

function paperFill(ctx, S) {
  const img = ctx.createImageData(S, S);
  for (let py = 0; py < S; py++) {
    for (let px = 0; px < S; px++) {
      const n = Math.sin(px * 12.9898 + py * 78.233) * 43758.5453;
      const grain = (n - Math.floor(n) - 0.5) * 14;
      const stain = Math.sin(px * 0.015 + py * 0.011) * 8 + Math.sin(px * 0.04 - py * 0.03) * 5;
      const edge = Math.min(px, py, S - 1 - px, S - 1 - py);
      const burn = edge < 28 ? (28 - edge) * 1.6 : 0;
      const i = (py * S + px) * 4;
      img.data[i] = 214 + grain - stain - burn;
      img.data[i + 1] = 196 + grain - stain * 0.8 - burn * 0.7;
      img.data[i + 2] = 158 + grain * 0.6 - stain * 0.4 - burn * 0.4;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function renderChart(region) {
  if (cache[region.key]) return cache[region.key];
  const S = 640;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  paperFill(ctx, S);
  const t = G.world.terrain;
  const { span, cx, cz, rift } = region;
  const worldOf = (px, py) => [cx + span / 2 - (px / S) * span, cz + span / 2 - (py / S) * span];
  const land = new Uint8Array(S * S);
  const heights = new Float32Array(S * S);
  const step = 2;
  for (let py = 0; py < S; py += step) {
    for (let px = 0; px < S; px += step) {
      const [x, z] = worldOf(px, py);
      let h = t.heightAt(x, z);
      const idx = py * S + px;
      // the fen's knee-deep meres are wet ground, not sea: only the sea and real lakes are water
      if (!rift && h < 0 && h > -1.2) {
        const hit = islandAtPoint(x, z);
        if (hit && hit.d < 0.86) h = 0.05;
      }
      heights[idx] = h;
      land[idx] = h >= (rift ? -8 : 0) ? 1 : 0;
    }
  }
  const biomeWash = {
    beach: [198, 176, 112], meadow: [132, 148, 92], forest: [86, 112, 70], marsh: [122, 138, 92], dunes: [198, 180, 124],
    snow: [228, 226, 216], tundra: [168, 172, 156], volcanic: [120, 92, 72], ashfield: [122, 112, 92], emberwood: [80, 96, 64],
    bastion: [150, 142, 104], highland: [148, 136, 96], farmland: [164, 156, 96], hush: [156, 162, 170],
    rock: [150, 142, 118], rift: [92, 72, 120], jungle: [78, 118, 72],
  };
  for (let py = 0; py < S; py += step) {
    for (let px = 0; px < S; px += step) {
      const idx = py * S + px;
      const [x, z] = worldOf(px, py);
      const h = heights[idx];
      if (!land[idx]) {
        ctx.globalAlpha = rift ? 0.28 : 0.2;
        ctx.fillStyle = rift ? '#3a2858' : '#6a8a82';
        ctx.fillRect(px, py, step, step);
        continue;
      }
      ctx.globalAlpha = 0.62;
      let rgb;
      if (rift) {
        const k = Math.min(1, (h + 4) / 30);
        rgb = [78 + k * 40, 58 + k * 30, 108 + k * 40];
      } else {
        const bi = G.world.biomeAt(x, z) || 'meadow';
        rgb = biomeWash[bi] || biomeWash.meadow;
        if (h < 1.8 && bi !== 'volcanic' && bi !== 'snow' && bi !== 'marsh') {
          const hit = islandAtPoint(x, z);
          if (!hit || hit.d > 0.72) rgb = [206, 186, 132];
        }
      }
      const shade = rift ? 0 : Math.max(-18, Math.min(18, (h - t.heightAt(x + 8, z + 8)) * 1.8));
      ctx.fillStyle = `rgb(${rgb[0] + shade | 0},${rgb[1] + shade | 0},${rgb[2] + shade * 0.6 | 0})`;
      ctx.fillRect(px, py, step, step);
    }
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = rift ? '#3a2048' : '#3c3224';
  ctx.lineWidth = 1.35;
  ctx.beginPath();
  for (let py = step; py < S - step; py += step) {
    for (let px = step; px < S - step; px += step) {
      const here = land[py * S + px];
      if (!here) continue;
      if (!land[py * S + px + step] || !land[py * S + px - step] || !land[(py + step) * S + px] || !land[(py - step) * S + px]) {
        ctx.moveTo(px, py);
        ctx.lineTo(px + 1.2, py + 0.4);
      }
    }
  }
  ctx.stroke();
  ctx.strokeStyle = '#5a4030';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, S - 10, S - 10);
  ctx.strokeStyle = '#d8c49a';
  ctx.lineWidth = 3;
  ctx.strokeRect(12, 12, S - 24, S - 24);
  ctx.strokeStyle = '#3c3224';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(16, 16, S - 32, S - 32);
  cache[region.key] = { canvas: c, span, cx, cz, S };
  return cache[region.key];
}

function compass(ctx, x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = '#3c3224';
  ctx.fillStyle = '#3c3224';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, -22); ctx.lineTo(6, 0); ctx.lineTo(0, 22); ctx.lineTo(-6, 0);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -22); ctx.lineTo(5, 2); ctx.lineTo(0, 0);
  ctx.closePath();
  ctx.fill();
  ctx.font = 'italic 13px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#2a2218';
  ctx.fillText('N', 0, -28);
  ctx.restore();
}

function cartouche(ctx, W, title, subtitle, holder) {
  ctx.save();
  // the bottom right is open sea; the Ashen Spire fills the bottom left
  const h = holder ? 68 : 52;
  ctx.translate(W - 278, W - 26 - h);
  ctx.fillStyle = 'rgba(232, 214, 170, 0.88)';
  ctx.strokeStyle = '#3c3224';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.rect(0, 0, 250, h);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#2a2218';
  ctx.font = '600 16px Cinzel, Georgia, serif';
  ctx.textAlign = 'left';
  ctx.fillText(title, 12, 22);
  ctx.font = 'italic 12px Georgia, serif';
  ctx.fillStyle = '#5a4a34';
  ctx.fillText(subtitle, 12, 40);
  if (holder) ctx.fillText(holder, 12, 57);
  ctx.restore();
}

ACTIONS.openWorldMap = (ui) => {
  const region = mapRegionFor(G.player && G.player.pos, ui.game.inRift);
  const rift = region.rift;
  const here = (x, z) => inRegion(region, x, z);
  const el = ui.openModal('map', `<div class="panel parchment-map"><h2>${region.title}</h2><canvas id="map-canvas" width="640" height="640"></canvas><div class="muted" style="text-align:center;margin-top:6px;font-size:14px">◆ quest, ▲ you, ⚓ harbor, <kbd>M</kbd> to close</div></div>`);
  const cv = el.querySelector('#map-canvas');
  const ctx = cv.getContext('2d');
  const m = renderChart(region);
  const W = cv.width;
  const toPx = (x, z) => [((m.cx + m.span / 2 - x) / m.span) * W, ((m.cz + m.span / 2 - z) / m.span) * W];
  const draw = () => {
    if (!ui.modal || ui.modal.el !== el) return;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(m.canvas, 0, 0, W, W);
    ctx.lineCap = 'round';
    for (const samples of G.world.pathSamples || []) {
      if (!samples.length || !here(samples[0].x, samples[0].z)) continue;
      for (const run of settledRuns(samples)) {
        ctx.beginPath();
        run.forEach((p, i) => { const [x, y] = toPx(p.x, p.z); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
        ctx.strokeStyle = '#4a3a24'; ctx.lineWidth = 2.4; ctx.stroke();
        ctx.strokeStyle = '#c4a86a'; ctx.lineWidth = 1.05; ctx.setLineDash([5, 4]); ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    // what the world-life systems draw over the chart: carrier lines, climbing sites, who holds the coast
    try {
      if (ACTIONS.mapOverlay) ACTIONS.mapOverlay(ctx, toPx, region, here);
    } catch (e) {
      console.error(e);
    }
    const placed = [];
    const label = (name, x, y, big) => {
      ctx.font = big ? '600 16px Cinzel, Georgia, serif' : 'italic 11px Georgia, serif';
      const width = ctx.measureText(name).width, height = big ? 18 : 13;
      if (!big && placed.some(r => Math.abs(x - r.x) < (width + r.w) / 2 + 3 && Math.abs(y - r.y) < (height + r.h) / 2 + 3)) return;
      placed.push({ x, y, w: width, h: height });
      ctx.fillStyle = big ? '#2a2218' : '#3a2e20';
      ctx.strokeStyle = '#f0e4c4'; ctx.lineWidth = big ? 3.4 : 2.4;
      ctx.strokeText(name, x, y); ctx.fillText(name, x, y);
    };
    ctx.textAlign = 'center';
    for (const r of REGIONS) {
      if (!here(r.cx, r.cz)) continue;
      const [x, y] = toPx(r.cx, r.cz);
      label(r.id === 'saltreach' ? 'Saltreach' : r.name, x, y - (r.radius > 100 ? 18 : 10), r.radius > 100);
    }
    for (const l of LOCATIONS.filter(l => /Village|Landing|Cinderstead|Garrison$/.test(l.name))) {
      if (!here(l.x, l.z)) continue;
      const [x, y] = toPx(l.x, l.z);
      ctx.fillStyle = '#5f4938';
      ctx.beginPath();
      ctx.arc(x, y, 2.4, 0, Math.PI * 2);
      ctx.fill();
      label(l.name, x, y + 14, false);
    }
    compass(ctx, W - 48, 52);
    let holder = null;
    try {
      holder = ACTIONS.mapHolder ? ACTIONS.mapHolder(region) : null;
    } catch (e) {
      console.error(e);
    }
    cartouche(ctx, W, region.title, region.subtitle, typeof holder === 'string' && holder ? holder : null);
    ctx.font = '14px sans-serif';
    for (const s of STRUCTURES) {
      if (!here(s.x, s.z)) continue;
      const icon = s.type === 'dock' ? '⚓' : rift && s.type === 'campfire' && !s.hostile ? '🔥' : s.type === 'rift_gate' ? '⛩' : null;
      if (!icon) continue;
      const [x, y] = toPx(s.x, s.z);
      ctx.fillText(icon, x, y + 5);
    }
    let markers = [];
    try { markers = (ACTIONS.mapMarkers && ACTIONS.mapMarkers(region)) || []; } catch (e) { console.error(e); }
    for (const mk of markers) {
      if (!here(mk.x, mk.z)) continue;
      const [x, y] = toPx(mk.x, mk.z);
      ctx.font = (mk.size || 15) + 'px sans-serif';
      ctx.fillStyle = mk.color || '#fff';
      ctx.fillText(mk.icon, x, y + 5);
      if (mk.label) {
        ctx.font = 'italic 11px Georgia, serif';
        ctx.strokeStyle = 'rgba(240,228,196,0.85)';
        ctx.lineWidth = 3;
        ctx.strokeText(mk.label, x, y + 18);
        ctx.fillStyle = '#2a2218';
        ctx.fillText(mk.label, x, y + 18);
      }
    }
    const qt = ui.questTarget();
    if (qt && here(qt.x, qt.z)) {
      const [x, y] = toPx(qt.x, qt.z);
      ctx.fillStyle = '#c48a18';
      ctx.font = '18px sans-serif';
      ctx.fillText('◆', x, y + 6);
    }
    if (G.net && G.net.active) {
      for (const a of G.net.avatars.values()) {
        if (!a.netPos || !here(a.pos.x, a.pos.z)) continue;
        const [x, y] = toPx(a.pos.x, a.pos.z);
        ctx.fillStyle = '#4a7a8a';
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = '600 12px Cinzel, Georgia, serif';
        ctx.fillStyle = '#2a2218';
        ctx.fillText(a.name, x, y - 10);
      }
    }
    const p = G.player;
    if (p) {
      const [x, y] = toPx(p.pos.x, p.pos.z);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-ui.game.camYaw);
      ctx.fillStyle = '#8a2018';
      ctx.strokeStyle = '#f4e8c8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(6, 7);
      ctx.lineTo(0, 3);
      ctx.lineTo(-6, 7);
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
      ctx.restore();
    }
    requestAnimationFrame(draw);
  };
  draw();
  return true;
};

export { MAP_REGIONS, renderChart };
