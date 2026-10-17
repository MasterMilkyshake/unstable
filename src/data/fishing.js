// Fishing catch tables per pool: [weight, item id, tier]. tier 0 common .. 3 legendary.
export const CATCH = {
  shore: [[48, 'fish_raw', 0], [14, 'eel', 1], [8, 'salt', 0], [9, 'old_boot', 0], [7, 'sunken_coin', 1], [3, 'pearl', 2], [0.8, 'mantra_spark', 3]],
  marsh: [[38, 'fish_raw', 0], [24, 'eel', 1], [10, 'mushroom', 0], [10, 'old_boot', 0], [4, 'witch_charm', 1], [2, 'pearl', 2], [0.6, 'sanity_draught', 2]],
  cold: [[50, 'fish_raw', 0], [12, 'eel', 1], [10, 'frost_lily', 1], [6, 'sunken_coin', 1], [3, 'pearl', 2], [0.8, 'mantra_spark', 3]],
  ash: [[42, 'fish_raw', 0], [12, 'eel', 1], [10, 'ember_shell', 1], [8, 'ember_pepper', 0], [4, 'ember_glass', 2], [0.8, 'mantra_spark', 3]],
  jungle: [[40, 'fish_raw', 0], [24, 'eel', 1], [8, 'serpent_scale', 1], [8, 'berries', 0], [5, 'sunken_coin', 1], [3, 'pearl', 2], [0.8, 'mantra_spark', 3]],
  rift: [[30, 'glimmerfish', 1], [30, 'rift_shard', 1], [12, 'fish_raw', 0], [6, 'abyssal_lens', 2], [0.5, 'ember_of_life', 3]],
};
