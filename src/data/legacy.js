// Legacy across wipes: what a lost character leaves behind (core/legacy.js, game/legacy.js).
//
// Keepers call lives name-knots: ties between a person and a coast that remembers them. When
// the last knot of a tide-born is spent, Wren strikes the name in her blanket register, and
// the coast keeps a little of what they did: Remembrance, spent when the next soul washes ashore.

// Remembrance earned by a lost character, scaled by how far it got.
export const REMEMBRANCE = {
  base: 5, // every name is remembered
  perPower: 2, // each Power above 1
  perChapter: 6, // each chapter of the main story finished
  perGreatFoe: 8, // each great foe slain
  perHour: 4, // each full hour played...
  hourCap: 6, // ...up to this many
};

// What Remembrance buys, at character creation only. At most three boons in all.
export const LEGACY_BOONS = {
  reroll: { name: 'Another Tide', desc: 'One more race reroll for this new soul.', cost: 15, max: 3 },
  bundle: { name: "Wren's Bundle", desc: 'Wake with 40 more silver, three loaves and a second waterskin.', cost: 20, max: 1, silver: 40, items: [['bread', 3], ['waterskin', 1]] },
  ember: { name: 'A Kept Ember', desc: 'Wake carrying an Ember of Life.', cost: 60, max: 1, items: [['ember_of_life', 1]] },
};

// The register keeps the most recent lost names.
export const REGISTER_LIMIT = 60;

// The keepsake chest beside the Wash camp, where an heirloom waits.
export const KEEPSAKE_CHEST = { x: -4.5, z: -318.5 };
