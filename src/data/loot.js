// Chests, pouches and the bank (game/loot.js, game/bank.js, core/contents.js).

// Silver income, scaled where it is paid so the tables keep their relative sizes: quest
// rewards, chests and world events paid a Power 6-10 character more than twice what the best
// shop kit costs (tools/economy-report.mjs), so silver never felt scarce. Kills and contracts
// keep their own (small) amounts.
export const INCOME = { quest: 0.45, chest: 0.5, event: 0.6 };
export const paid = (n, kind) => Math.max(n > 0 ? 1 : 0, Math.round((n || 0) * INCOME[kind]));
export const LOOT = {
  // A pouch left on the ground, or where someone fell: searched with [E] from this close.
  pouchReach: 2.2,
  // Things that never leave their owner: quest items always, and these.
  keep: ['registry_papers'],
  // Dying leaves part of what you carry where you fell, in a pouch anyone can search: this
  // share of your silver, up to `maxStacks` of your item stacks (each `itemShare` of the stack,
  // at least one), and by chance a spare weapon and a loose trinket. Nothing equipped, worn or
  // banked. In deep water or over the Abyss it is lost.
  death: { silverShare: 0.5, maxStacks: 4, itemShare: 0.34, weaponChance: 0.5, trinketChance: 0.5 },
  // The Keepers' strongbox at every inn: one account for the whole coast.
  bankSlots: 30,
};
