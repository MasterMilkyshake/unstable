// Map markers supplied by content systems (drawn by the map via ACTIONS.mapMarkers).
import { G } from '../core/globals.js';
import { ACTIONS } from './hooks.js';

ACTIONS.mapMarkers = () => {
  const game = G.game;
  const world = G.world;
  if (!game || !world || !game.ch) return [];
  const out = [];
  if (world.arena) out.push({ x: world.arena.x, z: world.arena.z, icon: '⚔', label: 'The Crucible', color: '#ffb08a' });
  for (const it of world.interactables) {
    if (it.kind === 'order') out.push({ x: it.pos.x, z: it.pos.z, icon: '⚖', label: 'Shrine of Order', color: '#e8e4dc', size: 14 });
    else if (it.kind === 'sluice') out.push({ x: it.pos.x, z: it.pos.z, icon: '⛩', label: 'Crown Sluice', color: '#a274ff', size: 14 });
  }
  const ev = ACTIONS.eventState && ACTIONS.eventState();
  if (ev) {
    const icons = { breach: ['🌀', 'Rift Breach', '#c8a8ff'], starfall: ['☄', 'Fallen Star', '#ffe9a3'], washup: ['📦', 'Wash-up', '#c4a86a'], patrol: ['⚔', 'Hunting party', '#c07050'] };
    const [icon, label, color] = icons[ev.kind] || icons.breach;
    out.push({ x: ev.pos.x, z: ev.pos.z, icon, label, color, size: 18 });
  }
  return out;
};
