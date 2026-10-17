// Weapon outliers: M1-string damage and posture per second for every weapon, from its class's
// string and its own handling, at attributes that meet its requirements (+20 in its scaling
// stats), listed by rarity against the tier mean.
//   node tools/weapon-balance.mjs
// tests/weapons.test.js holds every weapon but fists within BAND of its tier's mean.
import { fileURLToPath } from 'node:url';
import { WEAPONS, WEAPON_CLASSES, weaponFeel } from '../src/data/weapons.js';
import { weaponScaling } from '../src/data/stats.js';

export const TIERS = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
export const BAND = 0.2;

export function weaponRows() {
  const rows = [];
  for (const [id, w] of Object.entries(WEAPONS)) {
    if (w.hidden) continue;
    const cls = WEAPON_CLASSES[w.cls];
    const f = weaponFeel(w);
    const attrs = {};
    for (const k in w.reqs || {}) if (typeof w.reqs[k] === 'number') attrs[k] = w.reqs[k];
    for (const k in w.scaling) attrs[k] = Math.max(attrs[k] || 0, 20) + 20;
    const sc = weaponScaling(w, attrs);
    const sp = f.speed * (w.enchant === 'swift' ? 1.08 : 1);
    let t = 0, dmg = 0, pos = 0;
    cls.combo.forEach((_, i) => {
      const last = i === cls.combo.length - 1;
      t += (cls.windup + cls.active + cls.recovery * 0.3 + (last ? 0.18 + cls.recovery * 0.7 : 0)) / sp; // chained at 30% of recovery
      dmg += w.damage * sc * cls.comboDmg[i];
      pos += w.posture * (cls.postureMul || 1) * (w.enchant === 'weighty' ? 1.25 : 1);
    });
    rows.push({ id, cls: w.cls, rarity: w.rarity, dps: dmg / t, pps: pos / t, reach: cls.range + f.reach, chip: f.chip, pen: f.pen, weight: f.weight, trait: w.trait || '' });
  }
  for (const tier of TIERS) {
    const r = rows.filter((x) => x.rarity === tier);
    const mean = r.reduce((n, x) => n + x.dps, 0) / r.length;
    for (const x of r) x.vsTier = x.dps / mean - 1;
  }
  return rows;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const rows = weaponRows();
  for (const tier of TIERS) {
    const r = rows.filter((x) => x.rarity === tier).sort((a, b) => b.dps - a.dps);
    const mean = r.reduce((n, x) => n + x.dps, 0) / r.length;
    console.log(`\n${tier} (${r.length}) mean DPS ${mean.toFixed(1)}`);
    for (const x of r) console.log(`  ${x.id.padEnd(20)} ${x.cls.padEnd(10)} dps ${x.dps.toFixed(1).padStart(5)} (${(x.vsTier * 100).toFixed(0).padStart(4)}%)  posture/s ${x.pps.toFixed(1).padStart(5)}  reach ${x.reach.toFixed(1)}  chip ${x.chip}  pen ${x.pen}  wt ${x.weight}  ${x.trait}`);
  }
}
