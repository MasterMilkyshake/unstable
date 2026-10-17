// The Ascent's lift: rides, calls and the first ride's ambush. The one lift runs from arrival,
// from the courtyard to the summit (world/ascentLifts.js); the Wound on the summit is the way
// out (game/riftSpire.js).
import { G } from '../core/globals.js';
import { START_HOOKS, UPDATE_HOOKS, ACTIONS } from './hooks.js';
import { ASCENT_LIFTS, ASCENT_LIFT, liftFlags, setLiftDest, liftById, onPad } from '../world/ascentLifts.js';

function toast(msg, kind) {
  if (G.ui) G.ui.toast(msg, kind);
}

function pack(game) {
  return game?.world?.rift?.ascentLifts || null;
}

function syncLiftInteracts(game) {
  const p = pack(game);
  if (!p) return;
  for (const lift of p.lifts) {
    const moving = lift.moving || Math.abs(lift.y - lift.dest) > 0.05;
    const atA = Math.abs(lift.y - lift.y0) < 0.35;
    const atB = Math.abs(lift.y - lift.y1) < 0.35;
    lift.ride.enabled = () => !moving && (atA || atB);
    lift.ride.label = atA ? `Ride the stone lift up to ${lift.def.label}` : `Ride the stone lift down to ${lift.def.downLabel}`;
    lift.callA.enabled = () => !moving && !atA;
    lift.callB.enabled = () => !moving && !atB;
  }
}

function markDestination(game, lift, destId) {
  const f = liftFlags(game);
  if (destId === 'summit') {
    f.rift_ascent_summit = true;
  } else {
    f[`rift_ascent_${destId}`] = true;
  }
  game.quests?.onFlag?.();
}

ACTIONS.callAscentLift = (id, destId) => {
  const game = G.game;
  const state = game?.world?.rift;
  if (!state) return;
  const lift = setLiftDest(state, id, destId);
  if (!lift) return;
  G.audio?.play('jump', { pos: lift.pad.position, vol: 0.4 });
  toast('The cage answers the call.');
};

ACTIONS.rideAscentLift = (id) => {
  const game = G.game;
  const state = game?.world?.rift;
  const p = game?.player;
  if (!state || !p) return;
  const def = ASCENT_LIFT[id];
  const lift = liftById(state, id);
  if (!lift || lift.moving) return;
  if (!onPad(p, lift, lift.y)) {
    toast('Stand on the stone cage.');
    return;
  }
  const goingUp = Math.abs(lift.y - lift.y0) < 0.45;
  const destId = goingUp ? def.to : def.from;
  setLiftDest(state, id, destId);
  lift.rideDir = goingUp ? 1 : -1;
  lift.ambushArmed = goingUp && !lift.ambushed && !liftFlags(game)[`rift_lift_ambush_${id}`];
  G.audio?.play('jump', { pos: p.pos, vol: 0.7 });
  if (G.vfx) G.vfx.burst(p.pos.clone(), 'umbra', 10, { color: '#c8a040', speed: 3, up: 1.4 });
  toast(goingUp ? `The cage climbs toward ${def.label}.` : `The cage descends to ${def.downLabel}.`);
};

function maybeFinishRide(game, lift) {
  if (lift.moving || Math.abs(lift.y - lift.dest) > 0.05) return;
  if (!lift.rideDir) return;
  const destId = lift.dest === lift.y1 ? lift.def.to : lift.def.from;
  if (onPad(game.player, lift, lift.y)) markDestination(game, lift, destId);
  lift.rideDir = 0;
  lift.ambushArmed = false;
}

function maybeAmbush(game, lift) {
  if (!lift.ambushArmed || lift.ambushed) return;
  const span = lift.y1 - lift.y0;
  const t = span > 0.1 ? (lift.y - lift.y0) / span : 0;
  if (t < 0.45) return;
  lift.ambushed = true;
  lift.ambushArmed = false;
  liftFlags(game)[`rift_lift_ambush_${lift.def.id}`] = true;
  if (!game.spawnEnemy) return;
  const pos = lift.pad.position.clone();
  pos.y += 0.1;
  pos.x += Math.sin(lift.ry) * 0.9;
  pos.z += Math.cos(lift.ry) * 0.9;
  const e = game.spawnEnemy('riftling', pos, { scaleTo: game.player?.level || 0 });
  e.ascentAmbush = true;
  e.setAggro?.(game.player);
  toast('Something unhooks from the well and follows the cage.', 'bad');
  G.audio?.play('whisper', { pos });
}

START_HOOKS.push((game) => {
  liftFlags(game);
  const p = pack(game);
  for (const lift of p?.lifts || []) {
    lift.rideDir = 0;
    lift.ambushArmed = false;
    lift.ambushed = !!game.ch.flags[`rift_lift_ambush_${lift.def.id}`];
  }
  syncLiftInteracts(game);
});

UPDATE_HOOKS.push((game, dt) => {
  if (!game.inRift || !game.player) return;
  const p = pack(game);
  if (!p) return;
  syncLiftInteracts(game);
  for (const lift of p.lifts) {
    maybeAmbush(game, lift);
    maybeFinishRide(game, lift);
  }
});

export { ASCENT_LIFTS };
