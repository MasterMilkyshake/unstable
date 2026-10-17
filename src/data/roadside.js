// What happens on the roads between places (game/encounters.js): ambushes by whoever works
// that country, travellers in trouble, and after dark, the Unrelieved Watchman.
import { ENEMIES } from './enemies.js';

// Who lies in wait, by region (island or biome). Every party has a reason to be there.
export const AMBUSHERS = {
  saltreach: { types: ['brigand', 'brigand', 'brigand_cutthroat'], shout: 'Redwake raiders spring out of the grass!' },
  thornwood: { types: ['brigand', 'brigand_cutthroat', 'brigand_brute'], shout: 'Brigands drop from the trees!' },
  meridian: { types: ['deserter', 'deserter', 'brigand_cutthroat'], shout: 'Deserters step out onto the road, blades drawn!' },
  frosthollow: { types: ['frost_cultist', 'frost_cultist'], shout: 'White Cultists rise out of the snow: "Be still with us."' },
  ashen_spire: { types: ['ash_zealot', 'cinder_imp'], shout: 'Zealots come down the ash slope singing.' },
  verdance: { types: ['mossbound', 'jungle_ape'], shout: 'The Mossbound have marked this path as theirs.' },
  marsh: { types: ['fen_witch', 'mudlurker', 'mudlurker'], shout: 'Something in the reeds has been following you.' },
};

// People on the road, and what they give when you come back to them alive.
export const TRAVELLERS = [
  { id: 'pilgrim', name: 'A Pilgrim', title: 'Bound for the Warden', look: { skin: '#d8b896', hair: '#d8d0c0', outfit: { main: '#c8c0b0', trim: '#8a8478', pants: '#6a6458', boots: '#3a3630' } },
    cry: 'Help! For pity, over here!', thanks: 'I was walking to the cold to be kept. I think I would rather be kept by people, for now. Take this. I won\'t need it where I meant to go.',
    reward: [['frost_lily', 2], ['ether_tonic', 1]] },
  { id: 'pedlar', name: 'A Pedlar', title: 'Short of a Mule', look: { skin: '#b08a68', hair: '#4a3a2a', beard: '#4a3a2a', outfit: { main: '#6a5a3a', trim: '#a8884a', pants: '#3a3226', boots: '#241c14' } },
    cry: 'They\'ve got my mule! They\'ve got — help!', thanks: 'The mule\'s gone, but I\'m not. Here — pick of the pack, no charge. Tell the next pedlar the road\'s worse than they think.',
    reward: [['elixir', 1], ['honey_cake', 2], ['smithing_stone', 1]] },
  { id: 'fen_walker', name: 'A Fen-Walker', title: 'Out Past the Last Lantern', look: { skin: '#a88a68', hair: '#2a2420', outfit: { main: '#5d6a4a', trim: '#8a9a6a', pants: '#3a4230', boots: '#2a2a20' } },
    cry: 'Here! I\'m here! Don\'t leave me out here!', thanks: 'They\'ll strike my name off the slate at the Last Lantern. Strike it off — I\'m walking home on it. This was for the toll; you\'ve paid it.',
    reward: [['herb', 3], ['cleansing_salts', 2]] },
  { id: 'hunter', name: 'A Hunter', title: 'Whose Line Was Wrong', look: { skin: '#c49a74', hair: '#3a3028', outfit: { main: '#5a4a3a', trim: '#8a7a5a', pants: '#3a3026', boots: '#2a2018' } },
    cry: 'Over here! My bow\'s gone!', thanks: 'Wrong line, wrong wind, wrong day. Not a wrong stranger, though. Meat\'s fresh; take it.',
    reward: [['steak', 2], ['meat_raw', 2], ['wolf_pelt', 1]] },
];

// The night road's own ghost: a man of the old Watch who still walks the lamp roads, lighting
// lamps that were taken down a lifetime ago, and does not take kindly to being followed.
export const NIGHT_WANDERERS = {
  night_watchman: {
    ...ENEMIES.brigand_brute, model: 'humanoid', name: 'The Unrelieved Watchman', title: 'Who Walks the Old Lamp Roads', level: 12, hp: 980, posture: 260,
    aggro: 18, xp: 1200, silver: [120, 180], scale: 1.18, weapon: 'watch_pike', dmgMul: 1.05, critChance: 0.25, comboMax: 4, knockable: false,
    defend: { block: 0.35, parry: 0.25, dodge: 0.05 },
    look: { skin: '#9aa0a8', hair: '#d8d8d0', outfit: { main: '#3a4048', trim: '#c8b06a', pants: '#2a2e34', boots: '#1a1c20' }, helm: '#6a7078', armored: true, cape: '#2a2e34', eyes: '#ffd27a', glowEyes: true },
    drops: [{ id: 'moonveil_katana', chance: 0.35, weapon: true }, { id: 'star_shard', chance: 1, count: [2, 2] }, { id: 'mantra_spark', chance: 0.5 }],
  },
};
for (const [id, def] of Object.entries(NIGHT_WANDERERS)) if (!ENEMIES[id]) ENEMIES[id] = def;
