// What a character can reach, by latch count: every chest, written source, camp, landmark and
// quest place on every landmass, and whether walking, a carrier line or lift, or ledges get
// there from the Wash (and in the Rift, from the arrival shelf). The sea joins the landmasses:
// swimming has no limit, so anywhere a boat goes, a swimmer goes too.
//
//   node tools/ledge-reach.mjs [--latches=3,4,5] [--only=saltreach,thornwood] [--json=out.json]
//                              [--at=x,y,z ...] [--list] [--no-rift]
//
// The graph is tools/reach/graph.mjs (the player's own ledge probes, frame by frame); the builds
// for each latch count are its PROFILES. --at asks about given points (a quest target, say) and
// prints one line each. --list prints every target, not just the ones out of reach.
// Exit code 1 if a target is out of reach at the highest latch count asked.
import { writeFileSync } from 'node:fs';
import { buildWorld } from './reach/world.mjs';
import { ReachGrid, PROFILES, profile, linkTravel, seaNodes } from './reach/graph.mjs';
import { ISLANDS, START_POS, RIFT_SPAWN, LOCATIONS, SPAWNERS, islandAtPoint } from '../src/data/world.js';
import { islandBounds } from '../src/data/coastlines.js';
import { spawnSpot } from '../src/world/spawnSpot.js';

const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
  const [k, ...v] = a.slice(2).split('=');
  return [k, v.length ? v.join('=') : true];
}));
const ats = process.argv.slice(2).filter((a) => a.startsWith('--at=')).map((a) => a.slice(5).split(',').map(Number));
const counts = String(args.latches || '3,4,5').split(',').map(Number);
const builds = counts.map((n) => PROFILES[n] || profile(n, Math.min(99, 35 * (n - 3))));
const only = args.only ? String(args.only).split(',') : null;

const t0 = performance.now();
const world = await buildWorld();
console.log(`world built in ${((performance.now() - t0) / 1000).toFixed(1)} s: ${world.colliders.all.size} colliders, ${(world.carrierLines || []).length} carrier lines`);

// ---------------------------------------------------------------- targets
const targets = [];
const KIND_OF = { chest: 'chest', lore: 'written', carving: 'written', rift_glyph: 'written', rest_point: 'bed', zipline: 'line', bell: 'landmark', seat: 'landmark' };
for (const it of world.interactables) {
  if (!it.pos) continue;
  const kind = KIND_OF[it.kind] || (it.lore ? 'written' : null);
  if (!kind) continue;
  targets.push({ kind, id: it.id || it.kind, name: it.label || it.id, x: it.pos.x, y: it.pos.y - 0.6, z: it.pos.z });
}
for (const t of world.loreTablets || []) {
  const p = t.interaction?.pos || t.group?.position;
  if (p && !targets.some((x) => x.id === t.lore.id || (x.kind === "written" && Math.hypot(x.x - p.x, x.z - p.z) < 1.5))) targets.push({ kind: 'written', id: t.lore.id, name: t.lore.title || t.lore.id, x: p.x, y: p.y - 0.6, z: p.z });
}
for (const s of SPAWNERS) {
  if (s.dungeon || s.y > 200) continue;
  const [x, y, z] = spawnSpot(world, s.x, s.z, !!s.perch, s.y ?? null);
  targets.push({ kind: s.boss ? 'great foe' : 'camp', id: s.id || s.type, name: `${s.type}${s.count > 1 ? ` x${s.count}` : ''}`, x, y, z, across: 4 });
}
for (const l of LOCATIONS) if (l.r <= 40) targets.push({ kind: 'place', id: l.name, name: l.name, x: l.x, y: world.terrain.heightAt(l.x, l.z), z: l.z, across: Math.min(10, l.r * 0.5), up: 6 });
for (const [x, y, z] of ats) targets.push({ kind: 'asked', id: `${x},${y},${z}`, name: `the point ${x}, ${y}, ${z}`, x, y, z });

// ---------------------------------------------------------------- landmasses
const lands = ISLANDS.filter((i) => (args['no-rift'] ? i.cx < 3000 : true)).filter((i) => !only || only.includes(i.id) || (i.cx > 3000 && only.includes('rift')));
const home = ISLANDS.find((i) => i.id === 'saltreach');
const ownerOf = (x, z) => (x > 3000 ? ISLANDS.find((i) => i.cx > 3000) : islandAtPoint(x, z, 1.6)?.island) || null;

const report = { builds: builds.map((b) => b.key), lands: {} };
for (const isl of lands) {
  const t1 = performance.now();
  const grid = new ReachGrid(world, islandBounds(isl, 40), isl.id);
  const links = linkTravel(grid, world);
  const mine = targets.filter((t) => ownerOf(t.x, t.z) === isl);
  const rift = isl.cx > 3000;
  // the way in: the Wash, the Rift's arrival shelf, or the open sea
  const start = isl === home ? grid.nodeNear(START_POS.x, world.groundAt(START_POS.x, START_POS.z, 400), START_POS.z, 3, 3) : -1;
  const arrival = rift ? grid.nodeNear(RIFT_SPAWN.x, world.groundAt(RIFT_SPAWN.x, RIFT_SPAWN.z, 400), RIFT_SPAWN.z, 4, 4) : -1;
  const seeds = rift ? [arrival] : [start, ...seaNodes(grid)].filter((q) => q >= 0);
  const walk = grid.search(seeds, builds[0], { climbs: false, lines: false });
  const line = grid.search(seeds, builds[0], { climbs: false, lines: true });
  const full = builds.map((b) => grid.search(seeds, b));
  const rows = [];
  for (const t of mine) {
    // reached when any standing place within reach of it is (a carving at eye height, a camp
    // on the ground under a roof)
    const near = grid.nodesNear(t.x, t.y, t.z, t.across || 3, t.up || 2.5);
    const best = (need) => near.reduce((m, q) => Math.min(m, need[q]), 255);
    const row = { kind: t.kind, id: t.id, name: t.name, at: [t.x, t.y, t.z].map((n) => +n.toFixed(1)) };
    const b = full.map((f) => best(f.need));
    if (!near.length) row.route = 'no standing place';
    else if (best(walk.need) === 0) row.route = 'walk';
    else if (best(line.need) === 0) row.route = 'line';
    else row.route = 'ledges';
    // off the Wash's continent the way in is by sea: a boat (or a long swim among the sharks)
    if (!rift && isl !== home && near.length) row.route = `boat + ${row.route}`;
    row.need = b.map((n) => (n === 255 ? null : n));
    // --route=name: the climbs, lines and lifts on the way, for the first build that gets there
    if (args.route && String(t.name + ' ' + t.id).toLowerCase().includes(String(args.route).toLowerCase())) {
      const i = b.findIndex((n, k) => n <= counts[k]);
      if (i >= 0) {
        const q = near.reduce((m, r) => (full[i].need[r] < full[i].need[m] ? r : m), near[0]);
        row.way = grid.route(full[i], q);
      }
    }
    row.reached = b.map((n, i) => n <= counts[i]);
    rows.push(row);
  }
  const secs = ((performance.now() - t1) / 1000).toFixed(1);
  report.lands[isl.id] = { name: isl.name, nodes: grid.nodes, links, secs: +secs, rows };
  // the table
  console.log(`\n## ${isl.name} (${grid.nodes.toLocaleString()} standing places, ${links} lines/lifts, ${secs} s)`);
  console.log(`| Kind | Targets | Walk | Line or lift | ${counts.map((n) => `Reached at ${n} latches`).join(' | ')} |`);
  console.log(`| --- | --- | --- | --- | ${counts.map(() => '---').join(' | ')} |`);
  for (const kind of [...new Set(rows.map((r) => r.kind))]) {
    const rs = rows.filter((r) => r.kind === kind);
    console.log(`| ${kind} | ${rs.length} | ${rs.filter((r) => r.route.endsWith('walk')).length} | ${rs.filter((r) => r.route.endsWith('line')).length} | ${counts.map((_, i) => rs.filter((r) => r.reached[i]).length).join(' | ')} |`);
  }
  for (const r of rows) {
    const out = !r.reached[r.reached.length - 1];
    if (!out && !args.list && !r.route.endsWith('ledges') && r.kind !== 'asked' && !r.way) continue;
    const need = r.need.map((n, i) => `${counts[i]}:${n ?? '-'}`).join(' ');
    console.log(`  ${out ? 'OUT ' : '    '}${r.kind} ${r.name} at ${r.at.join(', ')}: ${r.route}${r.route.endsWith('ledges') || out ? ` (latches needed by build ${need})` : ''}`);
    if (r.way) for (const st of r.way.steps) console.log(`        ${st.kind} ${st.up >= 0 ? '+' : ''}${st.up} m from ${st.from.join(', ')} to ${st.to.join(', ')}`);
  }
  // let the grid go before the next landmass
  grid.climbCache.clear();
}

const out = Object.values(report.lands).flatMap((l) => l.rows).filter((r) => !r.reached[r.reached.length - 1]);
console.log(`\n${Object.values(report.lands).reduce((a, l) => a + l.rows.length, 0)} targets; out of reach at ${counts[counts.length - 1]} latches: ${out.length}`);
if (args.json) writeFileSync(String(args.json), JSON.stringify(report, null, 1));
process.exitCode = out.length ? 1 : 0;
