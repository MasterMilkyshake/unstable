// The Crucible: trial tiers (waves of enemy types) and Pitmaster Vorn's mark shop.

export const TRIALS = [
  {
    id: 'bronze', name: 'Bronze Trial', power: 1, fee: 20, level: 4, silver: 120, marks: 1, xp: 300, color: '#c8884a',
    waves: [['mudlurker', 'mudlurker', 'mudlurker'], ['brigand', 'brigand'], ['brigand', 'brigand', 'brigand_cutthroat'], ['brigand_brute', 'brigand'], ['brigand_brute', 'brigand_cutthroat', 'brigand_cutthroat']],
  },
  {
    id: 'silver', name: 'Silver Trial', power: 6, fee: 60, level: 10, silver: 320, marks: 2, xp: 1200, color: '#c9d0dc',
    waves: [['scuttler', 'scuttler', 'gloomowl'], ['rimefang', 'rimefang', 'rimefang'], ['fen_witch', 'fen_witch', 'frost_cultist'], ['frost_cultist', 'ash_zealot'], ['frost_stalker', 'frost_stalker', 'ash_zealot']],
  },
  {
    id: 'gold', name: 'Gold Trial', power: 12, fee: 150, level: 15, silver: 750, marks: 4, xp: 3500, color: '#ffd27a',
    waves: [['ash_golem', 'cinder_imp', 'cinder_imp'], ['jungle_ape', 'jungle_ape', 'jade_serpent'], ['mossbound', 'mossbound', 'mossbound_shaman'], ['drowned_knight', 'drowned_knight'], ['abyss_knight', 'void_hound', 'void_hound']],
  },
  {
    id: 'champion', name: "Champion's Trial", power: 18, fee: 300, level: 20, silver: 1600, marks: 8, xp: 8000, color: '#ff8a5a',
    waves: [['abyss_knight', 'abyss_knight', 'void_hound'], ['ash_golem', 'ash_golem', 'thunderwing'], ['drowned_knight', 'drowned_knight', 'abyssal_watcher'], ['jungle_ape', 'jungle_ape', 'jungle_ape', 'mossbound_shaman'], ['abyss_knight', 'abyss_knight', 'abyss_knight']],
  },
];

export const MARK_SHOP = [
  { kind: 'item', id: 'mantra_spark', cost: 3 },
  { kind: 'item', id: 'iron_draught', cost: 1 },
  { kind: 'item', id: 'elixir', cost: 1 },
  { kind: 'trinket', id: 'crucible_helm', cost: 8 },
  { kind: 'trinket', id: 'champions_sigil', cost: 10 },
  { kind: 'weapon', id: 'meridian_lance', cost: 12 },
  { kind: 'weapon', id: 'champions_gladius', cost: 14 },
  { kind: 'item', id: 'ember_of_life', cost: 25 },
];
