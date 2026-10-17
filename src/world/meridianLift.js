import * as THREE from 'three';
import { Kit } from './kit.js';
import { PALETTES } from './style.js';
import { Mason } from './mason.js';
import { G } from '../core/globals.js';
import { MERIDIAN_LIFT } from '../data/meridian.js';
import { placedPoint } from '../data/worldPlacement.js';

export function onMeridianLift(actor, lift, y = lift.y) {
  return !!actor && !actor.dead && Math.abs(actor.pos.x - lift.x) < 2.5
    && Math.abs(actor.pos.z - lift.z) < 2.8 && Math.abs(actor.pos.y - y) < 0.5;
}

// Vertical colliders keep their spatial-hash cells: only their height interval moves.
export function updateMeridianLift(lift, dt, actors = []) {
  const before = lift.y;
  lift.y += Math.sign(lift.dest - lift.y) * Math.min(Math.abs(lift.dest - lift.y), Math.max(0, dt) * 4);
  lift.moving = Math.abs(lift.dest - lift.y) > 0.001;
  const dy = lift.y - before;
  lift.pad.position.y = lift.y;
  lift.counterweight.position.y = lift.y0 + lift.y1 - lift.y + 1;
  lift.wheel.rotation.x += dy / 2.5;
  lift.chain.position.y = lift.y + 3.1;
  lift.chain.scale.y = Math.max(0.1, lift.y1 + 6 - lift.chain.position.y);
  lift.returnChain.position.y = lift.counterweight.position.y + 3;
  lift.returnChain.scale.y = Math.max(0.1, lift.y1 + 6 - lift.returnChain.position.y);
  for (const c of lift.colliders) { c.box.y0 = lift.y + c.bottom; c.box.y1 = lift.y + c.top; }
  lift.ride.pos.y = lift.y + 1;
  lift.ride.label = lift.y < (lift.y0 + lift.y1) / 2 ? 'Ride lift to Fort Meridian' : 'Ride lift to the Lower Works';
  if (dy) for (const actor of actors) {
    if (!actor.grounded || !onMeridianLift(actor, lift, before)) continue;
    actor.pos.y += dy; actor.fallStart = actor.pos.y;
    if (actor.model?.root) actor.model.root.position.y += dy;
  }
}

export function buildMeridianLift(world, exclusions, add) {
  const [x, z] = placedPoint(MERIDIAN_LIFT.x, MERIDIAN_LIFT.z);
  const y0 = MERIDIAN_LIFT.y0 + 0.12, y1 = MERIDIAN_LIFT.y1 + 0.12;
  const p = PALETTES.enclave, palette = { ...p, edge: p.stone, dark: p.timber, metal: '#817452', glow: p.glass };
  const k = new Kit(palette), g = new THREE.Group(); g.name = 'Meridian Counterweight Lift'; g.position.set(x, 0, z);
  const fixed = (xx, yy, zz, w, h, d, color = 'stone2') => {
    k.slab(xx, yy, zz, w, h, d, color);
    world.colliders.addBox({ x: x + xx, z: z + zz, w, d, y0: yy, y1: yy + h, tag: 'meridian_lift_frame' });
  };
  for (const side of [-1, 1]) {
    fixed(0, y0 - 1.2, side * 3.7, 2, y1 - y0 + 7, 1.2);
    k.slab(-0.95, y0, side * 3.2, 0.14, y1 - y0 + 5, 0.16, 'metal', { layer: 'metal' });
    for (let y = y0 + 7; y < y1; y += 7) fixed(3.6, y, side * 3.7, 7.2, 0.6, 0.7);
  }
  fixed(0, y1 + 5.3, 0, 2.7, 0.8, 10, 'edge');
  // Deck meets the cliff and continues through its dedicated gate. The shaft is
  // open all the way to the lower yard, with no landing slab above the cage.
  fixed(7, y1 - 0.6, 0, 9, 0.6, 10);
  for (const side of [-1, 1]) {
    // the south rail opens where the Iron Stair lands on the deck
    if (side > 0) fixed(7, y1, side * 4.8, 9, 1.1, 0.4, 'stone');
    else { fixed(3.4, y1, side * 4.8, 1.8, 1.1, 0.4, 'stone'); fixed(10.6, y1, side * 4.8, 1.8, 1.1, 0.4, 'stone'); }
    k.lantern(side > 0 ? 8.5 : 10.6, y1 + (side > 0 ? 0 : 1.1), side * 4.8, { post: side > 0 ? 2.6 : 1.5 });
  }
  fixed(-4.5, y0 - 0.5, 0, 4, 0.5, 7);
  // the call posts stand beside each landing's path, never across it
  for (const [xx, yy, zz] of [[-5.8, y0, -2], [8.7, y1, 3.6]]) {
    fixed(xx, yy, zz, 0.7, 1.1, 0.6, 'stone');
    k.block(xx, yy + 1.5, zz, 0.18, 0.9, 0.18, 'metal', { rz: -0.6, layer: 'metal' });
    k.lantern(xx, yy + 1.2, zz, { post: 0 });
  }
  k.banner(0, y1 + 0.5, -4.35, 2, 3.5, p.cloth);
  g.add(k.build('meridian_lift_headframe')); add(g);

  // The lift house: brick walls round the shaft from the gorge floor to a slate roof over the
  // wheel, open where the cage meets its two landings. The supply crews' bell hangs at the top.
  const hm = new Mason(world, { x, z, yaw: 0, y: 0, palette: 'enclave', tag: 'meridian_lift_frame', name: 'Meridian lift house', lights: 3 });
  const top = y1 + 9.2, base = hm.lowest(8, 14) - 1.2;
  for (const side of [-1, 1]) {
    // north and south walls, windows up the shaft
    hm.wall(-3.8, side * 6.4, 3.8, side * 6.4, base, top - base, { t: 0.8, style: 'brick', lit: true,
      openings: [y0 + 6, y0 + 14, y0 + 22, y1 + 3].map((yy, i) => ({ u: 3.8 + (i % 2 ? 1.6 : -1.6), w: 1.0, y: yy - base, h: 1.8, lit: i % 2 === 0 })) });
  }
  // west wall: the lower landing's mouth; east wall: the upper landing's, over the gorge
  hm.wall(-3.4, -6.0, -3.4, 6.0, base, top - base, { t: 0.8, style: 'brick', openings: [{ u: 6.0, w: 6.4, y: y0 - 0.5 - base, h: 4.6, door: true }, { u: 6.0, w: 1.2, y: y0 + 12 - base, h: 2.2, lit: true }] });
  hm.wall(3.4, -6.0, 3.4, 6.0, base, top - base, { t: 0.8, style: 'brick', openings: [{ u: 6.0, w: 6.4, y: y1 - 0.6 - base, h: 4.8, door: true }, { u: 6.0, w: 1.2, y: y0 + 8 - base, h: 2.2, lit: true }] });
  hm.trim(0, y0 - 0.6, 0, 8.4, 0.3, 14.4, 'stone');
  hm.trim(0, y1 - 0.75, 0, 8.4, 0.3, 14.4, 'stone');
  hm.trim(0, top - 0.3, 0, 8.6, 0.35, 14.6, 'stone');
  hm.roof(0, top + 0.05, 0, 8, 14, 3.6, { overhang: 0.6 });
  hm.light(0, y0 + 2.5, -4.5, { intensity: 3, distance: 10, priority: 1.6 });
  hm.light(0, y1 + 2.5, -4.5, { intensity: 3, distance: 10, priority: 1.6 });
  add(hm.build());

  const pk = new Kit(palette);
  pk.slab(0, -0.65, 0, 5, 0.65, 6, 'dark');
  for (let xx = -2.2; xx < 2.5; xx += 0.55) pk.slab(xx, -0.06, 0, 0.47, 0.06, 5.7, 'stone2');
  for (const side of [-1, 1]) {
    pk.slab(0, 1.05, side * 2.85, 5, 0.16, 0.14, 'metal', { layer: 'metal' });
    for (const xx of [-2.2, 2.2]) pk.slab(xx, 0, side * 2.85, 0.15, 3, 0.15, 'metal', { layer: 'metal' });
  }
  pk.slab(0, 3, 0, 4.8, 0.18, 5.8, 'dark');
  const pad = pk.build('Meridian lift cage'); pad.position.set(x, y0, z); pad.userData.dynamic = true; add(pad);
  const wk = new Kit(palette); wk.slab(0, 0, 0, 1.6, 3, 1.4, 'stone');
  for (const y of [0.3, 2.5]) wk.slab(0, y, 0, 1.8, 0.2, 1.6, 'metal', { layer: 'metal' });
  const counterweight = wk.build('lift_counterweight'); counterweight.position.set(x, y1 + 1, z + 5); counterweight.userData.dynamic = true; add(counterweight);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(2.5, 0.24, 6, 16), new THREE.MeshStandardMaterial({ color: '#817452', metalness: 0.3, roughness: 0.65 }));
  wheel.rotation.y = Math.PI / 2; wheel.position.set(x, y1 + 6, z + 2.5); wheel.userData.dynamic = true; add(wheel);
  const ck = new Kit(palette);
  for (let i = 0; i < 60; i++) ck.slab(0, i / 60, 0, i % 2 ? 0.1 : 0.24, 1 / 60, i % 2 ? 0.24 : 0.1, 'metal', { layer: 'metal' });
  const chain = ck.build('lift_chain'); chain.position.set(x, y0 + 3.1, z); chain.userData.dynamic = true; add(chain);
  const returnChain = chain.clone(); returnChain.name = 'counterweight_chain'; returnChain.position.z += 5; add(returnChain);
  const colliders = [];
  const posts = [-2.2, 2.2].flatMap(xx => [-2.85, 2.85].map(zz => [xx, zz, 0.15, 0.15, 0, 3]));
  for (const [xx, zz, w, d, bottom, top] of [[0, 0, 5, 6, -0.65, 0], [0, -2.85, 5, 0.15, 0, 1.2], [0, 2.85, 5, 0.15, 0, 1.2], [0, 0, 4.8, 5.8, 3, 3.18], ...posts]) {
    const box = world.colliders.addBox({ x: x + xx, z: z + zz, w, d, y0: y0 + bottom, y1: y0 + top, tag: 'meridian_lift' });
    colliders.push({ box, bottom, top });
  }
  const lift = { x, z, y: y0, y0, y1, dest: y0, moving: false, pad, counterweight, chain, returnChain, wheel, colliders };
  lift.callTo = y => { if (!lift.moving) { lift.dest = y === y1 ? y1 : y0; lift.moving = Math.abs(lift.dest - lift.y) > 0.001; } };
  const ride = { id: 'meridian_lift_ride', kind: 'lift', pos: new THREE.Vector3(x, y0 + 1, z), radius: 3,
    label: 'Ride lift to Fort Meridian', enabled: () => !lift.moving,
    use: game => { if (onMeridianLift(game?.player || G.player, lift)) lift.callTo(Math.abs(lift.y - y0) < 0.2 ? y1 : y0); } };
  lift.ride = ride; world.addInteract(ride);
  for (const [id, xx, y, zz] of [['lower', -5.8, y0, -2], ['upper', 8.7, y1, 3.6]]) {
    world.addInteract({ id: `meridian_lift_call_${id}`, kind: 'lift', pos: new THREE.Vector3(x + xx, y + 1, z + zz), radius: 2.5,
      label: 'Call the supply lift', enabled: () => !lift.moving && Math.abs(lift.y - y) > 0.2, use: () => lift.callTo(y) });
  }
  world.animated.push((time, dt) => updateMeridianLift(lift, dt, G.actors || []));
  world.meridianLift = lift;
  exclusions.push({ x, z, r: 15 }); updateMeridianLift(lift, 0);
  return lift;
}
