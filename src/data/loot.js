// Chests, pouches and the bank (game/loot.js, game/bank.js, core/contents.js).
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
